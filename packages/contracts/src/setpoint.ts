/**
 * Setpoint workflow schemas (§7.6)
 *
 * State machine:
 *   PENDING → APPROVED → APPLYING → APPLIED → (REVERTED if alarm fires)
 *          ↘ REJECTED (terminal)     ↘ FAILED (terminal)
 *
 * DRAFT is a UI-only concept; the server creates requests directly in PENDING.
 * Every transition is audited in the same DB transaction as the state change.
 */

import { z } from 'zod';

// ── State machine ─────────────────────────────────────────────────────────────

export const SetpointStateSchema = z.enum([
  'PENDING',
  'APPROVED',
  'APPLYING',
  'APPLIED',
  'FAILED',
  'REVERTED',
  'REJECTED',
]);
export type SetpointState = z.infer<typeof SetpointStateSchema>;

/** Terminal states — no further transitions possible. */
export const TERMINAL_SETPOINT_STATES: ReadonlySet<SetpointState> = new Set([
  'REJECTED',
  'FAILED',
  'REVERTED',
]);

/** States that occupy the "one live request per point" slot. */
export const LIVE_SETPOINT_STATES: ReadonlySet<SetpointState> = new Set([
  'PENDING',
  'APPROVED',
  'APPLYING',
]);

// ── Setpoint request ──────────────────────────────────────────────────────────

export const SetpointRequestSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  assetId: z.string().min(1),
  /** Field abbreviation (point.abbr). */
  field: z.string().min(1),
  state: SetpointStateSchema,
  /** Value requested by the proposer. */
  requestedValue: z.number(),
  /** Value read from the asset before the write (captured at APPLYING). */
  beforeValue: z.number().nullable(),
  /** Effective read-back value after write (captured at APPLIED). */
  afterValue: z.number().nullable(),
  proposerId: z.string().min(1),
  approverId: z.string().nullable(),
  justification: z.string().min(1),
  /** Optional scheduled effective time. */
  effectiveFrom: z.string().datetime().nullable(),
  /** Optional automatic revert time (within the watch window). */
  revertAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** If REJECTED or FAILED: reason. */
  reason: z.string().nullable(),
});
export type SetpointRequest = z.infer<typeof SetpointRequestSchema>;

// ── Propose ───────────────────────────────────────────────────────────────────

export const ProposeSetpointSchema = z.object({
  value: z.number(),
  justification: z.string().min(1),
  effectiveFrom: z.string().datetime().optional(),
  revertAt: z.string().datetime().optional(),
});
export type ProposeSetpoint = z.infer<typeof ProposeSetpointSchema>;

// ── Approve ───────────────────────────────────────────────────────────────────

export const ApproveSetpointSchema = z.object({
  /** Optional comment from the approver. */
  comment: z.string().optional(),
});
export type ApproveSetpoint = z.infer<typeof ApproveSetpointSchema>;

// ── Reject ────────────────────────────────────────────────────────────────────

export const RejectSetpointSchema = z.object({
  reason: z.string().min(1),
});
export type RejectSetpoint = z.infer<typeof RejectSetpointSchema>;

// ── Paginated list ────────────────────────────────────────────────────────────

export const SetpointListQuerySchema = z.object({
  state: SetpointStateSchema.optional(),
  assetId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});
export type SetpointListQuery = z.infer<typeof SetpointListQuerySchema>;

export const SetpointListResponseSchema = z.object({
  items: z.array(SetpointRequestSchema),
  nextCursor: z.string().nullable(),
});
export type SetpointListResponse = z.infer<typeof SetpointListResponseSchema>;

// ── Writable points (GET /sites/:s/setpoints) ────────────────────────────────

export const WritablePointSchema = z.object({
  assetId: z.string().min(1),
  assetName: z.string().min(1),
  field: z.string().min(1),
  display: z.string().min(1),
  unit: z.string(),
  safeMin: z.number(),
  safeMax: z.number(),
  /** Current value (latest). Null if unavailable. */
  currentValue: z.number().nullable(),
  /** Any live (non-terminal) request for this point, if one exists. */
  liveRequest: SetpointRequestSchema.nullable(),
});
export type WritablePoint = z.infer<typeof WritablePointSchema>;
