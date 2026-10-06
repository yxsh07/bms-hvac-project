/**
 * Audit hash chain (PLAN §7.8).
 *
 * Corrections applied over Document 2's sketch:
 *   1. Every persisted field is signed, including `justification`,
 *      `approverId`, `ip` and `device`.
 *   2. The payload is canonical JSON with sorted keys (recursively).
 *   3. Writers are serialised per site so concurrent inserts cannot fork.
 *
 *   signature = HMAC-SHA256(key, canonical(record) + prevSignature)
 */

import { createHmac, randomUUID } from 'node:crypto';
import type { AuditLogEntry, AuditEventType } from '@contracts';
import type { AuditAppendInput, AuditSink, AuditVerifyResult } from '../store/types.js';

// ── Canonical JSON ───────────────────────────────────────────────────────────

/** Deterministic JSON with keys sorted at every level. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = canonicalize(obj[key]);
  return out;
}

// ── Signed payload ───────────────────────────────────────────────────────────

/**
 * The exact set of fields that enter the signature. `signature` itself is
 * excluded (it does not exist yet); `seq` is included so reordering is caught.
 */
function signedFields(entry: AuditLogEntry): Record<string, unknown> {
  return {
    id: entry.id,
    siteId: entry.siteId,
    occurredAt: entry.occurredAt,
    eventType: entry.eventType,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    ip: entry.ip,
    device: entry.device,
    resource: entry.resource,
    action: entry.action,
    before: entry.before,
    after: entry.after,
    justification: entry.justification,
    approverId: entry.approverId,
    seq: entry.seq,
  };
}

function computeSignature(key: string, entry: AuditLogEntry, prevSignature: string): string {
  const payload = canonicalJson(signedFields(entry)) + prevSignature;
  return createHmac('sha256', key).update(payload).digest('hex');
}

// ── Chain ────────────────────────────────────────────────────────────────────

export interface AuditChainOptions {
  key: string;
  /** Injectable clock for deterministic tests. */
  clock?: () => string;
  /** Inject id generation for deterministic tests. */
  newId?: () => string;
}

export class AuditChain {
  private readonly key: string;
  private readonly clock: () => string;
  private readonly newId: () => string;

  constructor(private readonly sink: AuditSink, opts: AuditChainOptions) {
    this.key = opts.key;
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this.newId = opts.newId ?? (() => randomUUID());
  }

  /**
   * Append one record. Readers of the last signature and the insert happen
   * under the per-site lock so two writers can never read the same predecessor.
   */
  async append(input: AuditAppendInput): Promise<AuditLogEntry> {
    return this.sink.withSiteLock(input.siteId, async () => {
      const last = await this.sink.auditLast(input.siteId);
      const seq = last ? last.seq + 1 : 1;
      const prevSignature = last ? last.signature : '';

      const entry: AuditLogEntry = {
        id: input.id ?? this.newId(),
        siteId: input.siteId,
        occurredAt: input.occurredAt ?? this.clock(),
        eventType: input.eventType as AuditEventType,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        ip: input.ip ?? null,
        device: input.device ?? null,
        resource: input.resource ?? null,
        action: input.action ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        justification: input.justification ?? null,
        approverId: input.approverId ?? null,
        signature: '',
        seq,
      };
      entry.signature = computeSignature(this.key, entry, prevSignature);

      await this.sink.auditInsert(entry);
      return entry;
    });
  }

  /** Recompute the whole chain and return the first broken entry, if any. */
  async verify(siteId: string): Promise<AuditVerifyResult> {
    const entries = (await this.sink.auditAll(siteId)).slice().sort((a, b) => a.seq - b.seq);
    let prevSignature = '';
    let checkedCount = 0;
    for (const entry of entries) {
      checkedCount += 1;
      const expected = computeSignature(this.key, entry, prevSignature);
      if (entry.signature !== expected) {
        return {
          valid: false,
          firstBrokenId: entry.id,
          firstBrokenSeq: entry.seq,
          checkedCount,
        };
      }
      prevSignature = entry.signature;
    }
    return { valid: true, firstBrokenId: null, firstBrokenSeq: null, checkedCount };
  }
}
