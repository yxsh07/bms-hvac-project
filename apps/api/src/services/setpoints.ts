/**
 * Set-point workflow (PLAN §7.6) — the state machine, guards and scheduler.
 *
 *   PENDING → APPROVED → APPLYING → APPLIED → (REVERTED if an alarm fires)
 *          ↘ REJECTED                ↘ FAILED
 *
 * DRAFT is UI-only: the server creates requests directly in PENDING once the
 * guards pass. Every transition is audited in the same transaction as the
 * state change. Time and the gateway are injected so every edge is testable.
 */

import { randomUUID } from 'node:crypto';
import {
  ErrorCode,
  TERMINAL_SETPOINT_STATES,
  type GatewayDriver,
  type GatewayWriteRequest,
  type SetpointRequest,
} from '@contracts';
import type { LoadedConfig } from '../config.js';
import { conflict, HttpError, notFound, unprocessable } from '../util/errors.js';
import { addSeconds, parseIso } from '../util/time.js';
import { SetpointConflictError, type SetpointRecord, type Store } from '../store/types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SetpointPointInfo {
  assetId: string;
  assetName: string;
  field: string;
  display: string;
  unit: string;
  writable: boolean;
  safeMin: number;
  safeMax: number;
  tolerance?: number;
}

export interface Actor {
  id: string;
  email?: string | null;
  ip?: string | null;
  device?: string | null;
}

export interface ProposeInput {
  value: number;
  justification: string;
  effectiveFrom?: string;
  revertAt?: string;
}

export interface SetpointTransition {
  id: string;
  from: SetpointRecord['state'];
  to: SetpointRecord['state'];
  reason?: string;
}

export interface SetpointServiceDeps {
  store: Store;
  config: LoadedConfig;
  gateway: GatewayDriver;
  clock: () => string;
  resolvePoint: (siteId: string, assetId: string, field: string) => Promise<SetpointPointInfo | null>;
  controlMode?: (siteId: string, assetId: string) => Promise<string | null>;
  /** True when an alarm for the asset fired at/after `since` (watch window). */
  hasAlarm?: (siteId: string, assetId: string, since: string) => Promise<boolean>;
  newId?: () => string;
  defaultTolerance?: number;
  watchWindowSeconds?: number;
  readbackTimeoutSeconds?: number;
  dispatchDeadlineSeconds?: number;
  pendingExpirySeconds?: number;
}

export class SetpointService {
  private readonly store: Store;
  private readonly config: LoadedConfig;
  private readonly gateway: GatewayDriver;
  private readonly clock: () => string;
  private readonly resolvePoint: SetpointServiceDeps['resolvePoint'];
  private readonly controlMode: (siteId: string, assetId: string) => Promise<string | null>;
  private readonly hasAlarm: (siteId: string, assetId: string, since: string) => Promise<boolean>;
  private readonly newId: () => string;
  private readonly defaultTolerance: number;
  private readonly watchWindowSeconds: number;
  private readonly readbackTimeoutSeconds: number;
  private readonly dispatchDeadlineSeconds: number;
  private readonly pendingExpirySeconds: number;

  constructor(deps: SetpointServiceDeps) {
    this.store = deps.store;
    this.config = deps.config;
    this.gateway = deps.gateway;
    this.clock = deps.clock;
    this.resolvePoint = deps.resolvePoint;
    this.controlMode = deps.controlMode ?? (async () => null);
    this.hasAlarm = deps.hasAlarm ?? (async () => false);
    this.newId = deps.newId ?? (() => randomUUID());
    this.defaultTolerance = deps.defaultTolerance ?? 0.5;
    this.watchWindowSeconds = deps.watchWindowSeconds ?? 30 * 60;
    this.readbackTimeoutSeconds = deps.readbackTimeoutSeconds ?? 60;
    this.dispatchDeadlineSeconds = deps.dispatchDeadlineSeconds ?? 15 * 60;
    this.pendingExpirySeconds = deps.pendingExpirySeconds ?? 24 * 3600;
  }

  // ── Guards / propose ───────────────────────────────────────────────────────

  async propose(actor: Actor, siteId: string, assetId: string, field: string, input: ProposeInput): Promise<SetpointRecord> {
    const point = await this.resolvePoint(siteId, assetId, field);
    if (!point) throw notFound(ErrorCode.POINT_NOT_FOUND, `Point ${assetId}/${field} not found`);
    if (!point.writable) {
      throw unprocessable(ErrorCode.VALIDATION_ERROR, `Point ${field} is not writable`);
    }
    if (!input.justification || input.justification.trim() === '') {
      throw new HttpError(
        400,
        ErrorCode.MISSING_JUSTIFICATION,
        'A justification is required to propose a set point',
      );
    }
    if (input.value < point.safeMin || input.value > point.safeMax) {
      throw unprocessable(
        ErrorCode.VALUE_OUT_OF_RANGE,
        `Value ${input.value} is outside safe range [${point.safeMin}, ${point.safeMax}]`,
        { safeMin: point.safeMin, safeMax: point.safeMax },
      );
    }
    const mode = await this.controlMode(siteId, assetId);
    if (mode && mode.toLowerCase() === 'local') {
      throw unprocessable(ErrorCode.CONTROL_MODE_BLOCKED, 'Asset control mode is Local and blocks writes');
    }

    const now = this.clock();
    const record: SetpointRecord = {
      id: this.newId(),
      siteId,
      assetId,
      field,
      state: 'PENDING',
      requestedValue: input.value,
      beforeValue: null,
      afterValue: null,
      proposerId: actor.id,
      approverId: null,
      justification: input.justification,
      effectiveFrom: input.effectiveFrom ?? null,
      revertAt: input.revertAt ?? null,
      createdAt: now,
      updatedAt: now,
      reason: null,
      tolerance: point.tolerance ?? this.defaultTolerance,
      applyDeadline: null,
      applyStartedAt: null,
      watchUntil: null,
    };

    try {
      await this.store.withTransaction(async () => {
        await this.store.createSetpoint(record);
        await this.store.appendAudit({
          siteId,
          eventType: 'setpoint.proposed',
          actorId: actor.id,
          actorEmail: actor.email ?? null,
          ip: actor.ip ?? null,
          device: actor.device ?? null,
          resource: `setpoint-request:${record.id}`,
          action: 'propose',
          before: null,
          after: this.auditShape(record),
          justification: record.justification,
        });
      });
    } catch (err) {
      if (err instanceof SetpointConflictError) {
        throw conflict(
          ErrorCode.SETPOINT_REQUEST_CONFLICT,
          'A live set-point request already exists for this point',
          { existingRequestId: err.existingRequestId },
        );
      }
      throw err;
    }
    return record;
  }

  async approve(actor: Actor, id: string): Promise<SetpointRecord> {
    const request = await this.store.getSetpoint(id);
    if (!request) throw notFound(ErrorCode.SETPOINT_NOT_FOUND, `Set-point request ${id} not found`);
    if (request.state !== 'PENDING') {
      throw conflict(ErrorCode.SETPOINT_INVALID_TRANSITION, `Cannot approve a ${request.state} request`);
    }
    // No self-approval — including for admin (§7.6).
    if (request.proposerId === actor.id) {
      throw unprocessable(ErrorCode.SETPOINT_SELF_APPROVE, 'A requester cannot approve their own request');
    }

    const now = this.clock();
    const updated = await this.transition(request, 'APPROVED', actor, {
      approverId: actor.id,
      updatedAt: now,
    });
    return updated;
  }

  async reject(actor: Actor, id: string, reason: string): Promise<SetpointRecord> {
    const request = await this.store.getSetpoint(id);
    if (!request) throw notFound(ErrorCode.SETPOINT_NOT_FOUND, `Set-point request ${id} not found`);
    if (request.state !== 'PENDING') {
      throw conflict(ErrorCode.SETPOINT_INVALID_TRANSITION, `Cannot reject a ${request.state} request`);
    }
    return this.transition(request, 'REJECTED', actor, { reason, updatedAt: this.clock() });
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  /**
   * One scheduler pass (5-second tick in production). Selects due rows and
   * performs each as a normal audited transition. Returns what changed so tests
   * can assert edges without inspecting storage.
   */
  async schedulerTick(): Promise<SetpointTransition[]> {
    const now = this.clock();
    const transitions: SetpointTransition[] = [];
    const open = await this.store.listOpenSetpoints(this.config.siteId);

    for (const request of open) {
      const age = (now: string, then: string): number => (parseIso(now) - parseIso(then)) / 1000;
      if (request.state === 'PENDING') {
        if (age(now, request.updatedAt) >= this.pendingExpirySeconds) {
          const expired = await this.transition(request, 'REJECTED', systemActor(), {
            reason: 'expired',
            updatedAt: now,
          });
          transitions.push({ id: expired.id, from: 'PENDING', to: 'REJECTED', reason: 'expired' });
        }
        continue;
      }

      if (request.state === 'APPROVED') {
        if (age(now, request.updatedAt) >= this.dispatchDeadlineSeconds) {
          const failed = await this.fail(request, 'dispatch timeout');
          transitions.push({ id: failed.id, from: 'APPROVED', to: 'FAILED', reason: 'dispatch timeout' });
          continue;
        }
        if (request.effectiveFrom && parseIso(request.effectiveFrom) > parseIso(now)) continue;
        transitions.push(...(await this.apply(request, now)));
        continue;
      }

      if (request.state === 'APPLYING') {
        transitions.push(...(await this.completeReadback(request, now)));
        continue;
      }

      if (request.state === 'APPLIED') {
        if (request.revertAt && parseIso(request.revertAt) <= parseIso(now)) {
          const reverted = await this.revert(request, 'scheduled revert');
          transitions.push({ id: reverted.id, from: 'APPLIED', to: 'REVERTED', reason: 'scheduled revert' });
          continue;
        }
        if (request.watchUntil && parseIso(request.watchUntil) <= parseIso(now)) continue;
        const alarmed = await this.hasAlarm(request.siteId, request.assetId, request.updatedAt);
        if (alarmed) {
          const reverted = await this.revert(request, 'alarm in watch window');
          transitions.push({ id: reverted.id, from: 'APPLIED', to: 'REVERTED', reason: 'alarm in watch window' });
        }
        continue;
      }
    }
    return transitions;
  }

  // ── Applying / read-back / revert ──────────────────────────────────────────

  private async apply(request: SetpointRecord, now: string): Promise<SetpointTransition[]> {
    if (request.state !== 'APPROVED') return [];
    // Capture the before value, send the command, then poll for read-back.
    const before = await this.gateway.read(request.siteId, request.assetId, request.field);
    const applying = await this.store.updateSetpoint(request.id, {
      state: 'APPLYING',
      beforeValue: before.value,
      applyStartedAt: now,
      applyDeadline: addSeconds(now, this.readbackTimeoutSeconds),
      updatedAt: now,
    });
    await this.audit(applying, 'setpoint.applying', systemActor(), 'apply', {
      before: { state: 'APPROVED', value: before.value },
      after: { state: 'APPLYING' },
    });

    const writeReq: GatewayWriteRequest = {
      siteId: applying.siteId,
      assetId: applying.assetId,
      point: applying.field,
      value: applying.requestedValue,
      idempotencyKey: `${applying.id}:apply`,
    };
    const write = await this.gateway.write(writeReq);

    if (!write.accepted) {
      const failed = await this.fail(applying, write.reason ?? 'gateway rejected write');
      return [{ id: failed.id, from: 'APPLYING', to: 'FAILED', reason: failed.reason ?? undefined }];
    }

    const done = await this.completeReadback(applying, now);
    return done;
  }

  private async completeReadback(request: SetpointRecord, now: string): Promise<SetpointTransition[]> {
    const read = await this.gateway.read(request.siteId, request.assetId, request.field);
    if (read.value !== null && Math.abs(read.value - request.requestedValue) <= request.tolerance) {
      const applied = await this.transition(request, 'APPLIED', systemActor(), {
        afterValue: read.value,
        updatedAt: now,
        watchUntil: addSeconds(now, this.watchWindowSeconds),
      });
      return [{ id: applied.id, from: request.state, to: 'APPLIED' }];
    }

    // Mismatch: keep APPLYING until the read-back deadline, then FAIL.
    if (request.applyDeadline && parseIso(now) >= parseIso(request.applyDeadline)) {
      const failed = await this.fail(request, 'read-back mismatch');
      return [{ id: failed.id, from: request.state, to: 'FAILED', reason: 'read-back mismatch' }];
    }
    return [];
  }

  private async revert(request: SetpointRecord, reason: string): Promise<SetpointRecord> {
    const target = request.beforeValue;
    let verified = false;
    if (target !== null) {
      const write = await this.gateway.write({
        siteId: request.siteId,
        assetId: request.assetId,
        point: request.field,
        value: target,
        idempotencyKey: `${request.id}:revert`,
      });
      if (write.accepted) {
        const read = await this.gateway.read(request.siteId, request.assetId, request.field);
        verified = read.value !== null && Math.abs(read.value - target) <= request.tolerance;
      }
    } else {
      verified = true;
    }

    const reverted = await this.store.updateSetpoint(request.id, {
      state: 'REVERTED',
      afterValue: target,
      reason,
      updatedAt: this.clock(),
    });
    await this.audit(reverted, 'setpoint.reverted', systemActor(), 'revert', {
      before: { state: request.state, value: request.requestedValue },
      after: { state: 'REVERTED', value: target, verified },
    });

    if (!verified) {
      await this.raiseAlarm(reverted, 'critical', 'SETPOINT_REVERT_FAILED', 'Revert write-back could not be verified');
    }
    return reverted;
  }

  private async fail(request: SetpointRecord, reason: string): Promise<SetpointRecord> {
    const failed = await this.transition(request, 'FAILED', systemActor(), {
      reason,
      updatedAt: this.clock(),
    });
    await this.raiseAlarm(failed, 'critical', 'SETPOINT_FAILED', `Set-point request failed: ${reason}`);
    return failed;
  }

  // ── Persistence helpers ────────────────────────────────────────────────────

  private async transition(
    request: SetpointRecord,
    to: SetpointRecord['state'],
    actor: Actor,
    patch: Partial<SetpointRecord>,
  ): Promise<SetpointRecord> {
    const from = request.state;
    let updated!: SetpointRecord;
    await this.store.withTransaction(async () => {
      updated = await this.store.updateSetpoint(request.id, { ...patch, state: to });
      await this.store.appendAudit({
        siteId: request.siteId,
        eventType: eventFor(to),
        actorId: actor.id === 'system' ? null : actor.id,
        actorEmail: actor.email ?? null,
        ip: actor.ip ?? null,
        device: actor.device ?? null,
        resource: `setpoint-request:${request.id}`,
        action: to.toLowerCase(),
        before: { state: from, value: request.requestedValue },
        after: this.auditShape(updated),
        justification: updated.justification,
        approverId: updated.approverId,
      });
    });
    return updated;
  }

  private async audit(
    request: SetpointRecord,
    eventType: Parameters<Store['appendAudit']>[0]['eventType'],
    actor: Actor,
    action: string,
    payload: { before: unknown; after: unknown },
  ): Promise<void> {
    await this.store.appendAudit({
      siteId: request.siteId,
      eventType,
      actorId: actor.id === 'system' ? null : actor.id,
      resource: `setpoint-request:${request.id}`,
      action,
      before: payload.before,
      after: payload.after,
      justification: request.justification,
      approverId: request.approverId,
    });
  }

  private async raiseAlarm(
    request: SetpointRecord,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    code: string,
    message: string,
  ): Promise<void> {
    await this.store.createAlarm({
      id: this.newId(),
      siteId: request.siteId,
      assetId: request.assetId,
      assetName: request.assetId,
      field: request.field,
      severity,
      status: 'active',
      message,
      alarmCode: code,
      raisedAt: this.clock(),
      clearedAt: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      acknowledgeNote: null,
      context: { requestId: request.id },
    });
  }

  private auditShape(record: SetpointRecord): Record<string, unknown> {
    return {
      state: record.state,
      requestedValue: record.requestedValue,
      beforeValue: record.beforeValue,
      afterValue: record.afterValue,
      approverId: record.approverId,
      reason: record.reason,
    };
  }
}

function systemActor(): Actor {
  return { id: 'system' };
}

function eventFor(state: SetpointRecord['state']): Parameters<Store['appendAudit']>[0]['eventType'] {
  switch (state) {
    case 'APPROVED':
      return 'setpoint.approved';
    case 'REJECTED':
      return 'setpoint.rejected';
    case 'APPLYING':
      return 'setpoint.applying';
    case 'APPLIED':
      return 'setpoint.applied';
    case 'FAILED':
      return 'setpoint.failed';
    case 'REVERTED':
      return 'setpoint.reverted';
    default:
      return 'setpoint.proposed';
  }
}

/** Project the internal record to the wire contract (drops scheduler fields). */
export function toSetpointRequest(record: SetpointRecord): SetpointRequest {
  return {
    id: record.id,
    siteId: record.siteId,
    assetId: record.assetId,
    field: record.field,
    state: record.state,
    requestedValue: record.requestedValue,
    beforeValue: record.beforeValue,
    afterValue: record.afterValue,
    proposerId: record.proposerId,
    approverId: record.approverId,
    justification: record.justification,
    effectiveFrom: record.effectiveFrom,
    revertAt: record.revertAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    reason: record.reason,
  };
}

export { TERMINAL_SETPOINT_STATES };
