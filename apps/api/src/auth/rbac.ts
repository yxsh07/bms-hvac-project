/**
 * Role-based access control (PLAN §7.7).
 *
 * Five roles; the server is the enforcement point (the UI only hides). Every
 * denial is written to the audit log, and admin actions are audited the same
 * way as any other role's.
 */

import type { Role } from '@contracts';
import type { AuditSink } from '../store/types.js';

// ── Actions ──────────────────────────────────────────────────────────────────

export const Actions = {
  telemetryRead: 'telemetry:read',
  ontologyRead: 'ontology:read',
  alarmsRead: 'alarms:read',
  alarmsAcknowledge: 'alarms:acknowledge',
  setpointsRead: 'setpoints:read',
  setpointsPropose: 'setpoints:propose',
  setpointsApprove: 'setpoints:approve',
  schedulesRead: 'schedules:read',
  schedulesWrite: 'schedules:write',
  overridesRead: 'overrides:read',
  overridesCreate: 'overrides:create',
  overridesApprove: 'overrides:approve',
  reportsRead: 'reports:read',
  reportsRun: 'reports:run',
  reportsExport: 'reports:export',
  auditRead: 'audit:read',
  auditExport: 'audit:export',
  usersManage: 'users:manage',
  sitesConfigure: 'sites:configure',
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

// ── Matrix (§7.7) ────────────────────────────────────────────────────────────

/** Read-only access shared by all five roles. */
const READ_ALL: Action[] = [
  Actions.telemetryRead,
  Actions.ontologyRead,
  Actions.alarmsRead,
  Actions.setpointsRead,
  Actions.schedulesRead,
  Actions.overridesRead,
  Actions.reportsRead,
];

const MATRIX: Record<Role, ReadonlySet<Action>> = {
  admin: new Set<Action>([
    ...READ_ALL,
    Actions.alarmsAcknowledge,
    Actions.setpointsPropose,
    Actions.setpointsApprove,
    Actions.schedulesWrite,
    Actions.overridesCreate,
    Actions.overridesApprove,
    Actions.reportsRun,
    Actions.reportsExport,
    Actions.auditRead,
    Actions.auditExport,
    Actions.usersManage,
    Actions.sitesConfigure,
  ]),
  engineer: new Set<Action>([
    ...READ_ALL,
    Actions.alarmsAcknowledge,
    Actions.setpointsPropose,
    Actions.schedulesWrite,
    Actions.overridesCreate,
    Actions.reportsRun,
    Actions.reportsExport,
    Actions.auditRead,
  ]),
  'facility-manager': new Set<Action>([
    ...READ_ALL,
    Actions.alarmsAcknowledge,
    Actions.setpointsApprove,
    Actions.schedulesWrite,
    Actions.overridesCreate,
    Actions.overridesApprove,
    Actions.reportsRun,
    Actions.reportsExport,
    Actions.auditRead,
    Actions.auditExport,
  ]),
  operator: new Set<Action>([
    ...READ_ALL,
    Actions.alarmsAcknowledge,
    Actions.reportsRun,
  ]),
  executive: new Set<Action>([
    ...READ_ALL,
    Actions.reportsRun,
    Actions.reportsExport,
    Actions.auditRead,
  ]),
};

/** True when `role` may perform `action`. Unknown roles deny. */
export function can(role: string, action: Action): boolean {
  const set = MATRIX[role as Role];
  return set ? set.has(action) : false;
}

/** All actions a role may perform (used by `GET /me`). */
export function permissionsFor(role: string): Action[] {
  const set = MATRIX[role as Role];
  return set ? [...set] : [];
}

// ── Denial auditing hook ─────────────────────────────────────────────────────

export interface DenialContext {
  siteId: string;
  actorId: string | null;
  actorEmail?: string | null;
  role: string;
  action: Action;
  resource: string | null;
  ip?: string | null;
  device?: string | null;
}

/**
 * Record an `authz.denied` event. Call this before throwing `forbidden()` so
 * that the denial is always persisted (PLAN §7.7).
 */
export async function auditDenial(sink: AuditSink, ctx: DenialContext): Promise<void> {
  await sink.appendAudit({
    siteId: ctx.siteId,
    eventType: 'authz.denied',
    actorId: ctx.actorId,
    actorEmail: ctx.actorEmail ?? null,
    ip: ctx.ip ?? null,
    device: ctx.device ?? null,
    resource: ctx.resource,
    action: ctx.action,
    justification: null,
    before: { role: ctx.role, action: ctx.action },
    after: null,
  });
}

/**
 * Deny-and-audit helper: audits and returns a `forbidden()` HttpError. Routes
 * should `throw await denyAndAudit(...)`.
 */
export async function denyAndAudit(
  sink: AuditSink,
  ctx: DenialContext,
): Promise<Error> {
  await auditDenial(sink, ctx);
  const { HttpError } = await import('../util/errors.js');
  return new HttpError(403, 'FORBIDDEN', 'Permission denied', {
    action: ctx.action,
    role: ctx.role,
  });
}
