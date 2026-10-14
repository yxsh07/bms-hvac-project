/**
 * Audit trail schemas (§7.8)
 *
 * Logged events: login/logout, permission denied, setpoint transitions,
 * override created/expired, schedule modified, report exported, user/role changed.
 *
 * Hash chain: HMAC-SHA256(key, canonical(record) + prevSignature).
 * Canonical JSON uses sorted keys to ensure deterministic serialisation.
 * Writers are serialised per site via pg_advisory_xact_lock.
 *
 * GET /sites/:s/audit/verify walks the chain and returns the first broken ID.
 */

import { z } from 'zod';

// ── Event types ───────────────────────────────────────────────────────────────

export const AuditEventTypeSchema = z.enum([
  // Auth
  'auth.login',
  'auth.logout',
  'auth.login_failed',

  // Access control
  'authz.denied',

  // Alarms
  'alarm.acknowledged',

  // Setpoints
  'setpoint.proposed',
  'setpoint.approved',
  'setpoint.rejected',
  'setpoint.applying',
  'setpoint.applied',
  'setpoint.failed',
  'setpoint.reverted',

  // Overrides
  'override.created',
  'override.expired',
  'override.cancelled',

  // Schedules
  'schedule.created',
  'schedule.updated',
  'schedule.deleted',

  // Reports
  'report.exported',

  // Users / roles
  'user.created',
  'user.updated',
  'user.deleted',
  'user.role_changed',

  // Site config
  'site.configured',
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// ── Audit log entry ───────────────────────────────────────────────────────────

export const AuditLogEntrySchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  /** ISO-8601 UTC timestamp when the event occurred. */
  occurredAt: z.string().datetime(),
  eventType: AuditEventTypeSchema,
  /** Actor who caused the event (user ID). Null for system events. */
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  /** IP address of the actor. */
  ip: z.string().nullable(),
  /** User-agent / device string. */
  device: z.string().nullable(),
  /** Resource affected (e.g. "setpoint-request:abc123"). */
  resource: z.string().nullable(),
  /** Free-form action description (e.g. "approve"). */
  action: z.string().nullable(),
  /** State before the change (JSON-serialisable). */
  before: z.unknown().nullable(),
  /** State after the change (JSON-serialisable). */
  after: z.unknown().nullable(),
  justification: z.string().nullable(),
  approverId: z.string().nullable(),
  /** HMAC-SHA256 signature of this record + previous signature. */
  signature: z.string().min(1),
  /** Sequence number within the site's chain (1-indexed). */
  seq: z.number().int().positive(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ── Query ─────────────────────────────────────────────────────────────────────

export const AuditQuerySchema = z.object({
  eventType: AuditEventTypeSchema.optional(),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;

export const AuditListResponseSchema = z.object({
  items: z.array(AuditLogEntrySchema),
  nextCursor: z.string().nullable(),
});
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;

// ── Chain verification ────────────────────────────────────────────────────────

export const AuditVerifyResponseSchema = z.object({
  /** True if the entire chain is intact. */
  valid: z.boolean(),
  /** ID of the first entry with a broken signature, or null if valid. */
  firstBrokenId: z.string().nullable(),
  /** Sequence number of the first broken entry, or null if valid. */
  firstBrokenSeq: z.number().int().nullable(),
  /** Total number of entries checked. */
  checkedCount: z.number().int().nonnegative(),
});
export type AuditVerifyResponse = z.infer<typeof AuditVerifyResponseSchema>;

// ── Export ────────────────────────────────────────────────────────────────────

export const AuditExportQuerySchema = AuditQuerySchema.omit({ limit: true, cursor: true }).extend({
  format: z.enum(['json', 'csv']).default('json'),
});
export type AuditExportQuery = z.infer<typeof AuditExportQuerySchema>;
