/**
 * Alarm schemas (§7.9, §7.7)
 *
 * Covers:
 *  - GET  /sites/:s/alarms         → paginated alarm list
 *  - POST /sites/:s/alarms/:id/ack → acknowledge an alarm
 *
 * Roles: all roles can read; executive cannot acknowledge (§7.7).
 */

import { z } from 'zod';

// ── Severity ──────────────────────────────────────────────────────────────────

export const AlarmSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type AlarmSeverity = z.infer<typeof AlarmSeveritySchema>;

// ── Alarm status ──────────────────────────────────────────────────────────────

export const AlarmStatusSchema = z.enum([
  'active',
  'acknowledged',
  'cleared',
  'cleared_unacknowledged',
]);
export type AlarmStatus = z.infer<typeof AlarmStatusSchema>;

// ── Alarm ─────────────────────────────────────────────────────────────────────

export const AlarmSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  /** Field abbreviation that triggered the alarm (if applicable). */
  field: z.string().nullable(),
  severity: AlarmSeveritySchema,
  status: AlarmStatusSchema,
  /** Human-readable alarm message. */
  message: z.string().min(1),
  /** Stable alarm type code (e.g. "SETPOINT_FAILED", "COVERAGE_LOW"). */
  alarmCode: z.string().min(1),
  /** ISO-8601 UTC timestamp when the alarm was raised. */
  raisedAt: z.string().datetime(),
  /** ISO-8601 UTC timestamp when the alarm was cleared (null if still active). */
  clearedAt: z.string().datetime().nullable(),
  /** User ID who acknowledged the alarm (null if not yet acknowledged). */
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: z.string().datetime().nullable(),
  /** Optional note left by the acknowledging user. */
  acknowledgeNote: z.string().nullable(),
  /** Context specific to the alarm type (e.g. setpoint request ID). */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type Alarm = z.infer<typeof AlarmSchema>;

// ── Acknowledge request ───────────────────────────────────────────────────────

export const AckAlarmRequestSchema = z.object({
  note: z.string().optional(),
});
export type AckAlarmRequest = z.infer<typeof AckAlarmRequestSchema>;

// ── List query ────────────────────────────────────────────────────────────────

export const AlarmListQuerySchema = z.object({
  status: AlarmStatusSchema.optional(),
  severity: AlarmSeveritySchema.optional(),
  assetId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});
export type AlarmListQuery = z.infer<typeof AlarmListQuerySchema>;

export const AlarmListResponseSchema = z.object({
  items: z.array(AlarmSchema),
  nextCursor: z.string().nullable(),
  /** Count of active alarms (for badge). */
  activeCount: z.number().int().nonnegative(),
});
export type AlarmListResponse = z.infer<typeof AlarmListResponseSchema>;
