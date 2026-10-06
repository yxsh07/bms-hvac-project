/**
 * Standard API error shape (§7.9)
 *
 * All error responses from the API follow this structure:
 *   { error: string, code: string }
 *
 * `error`  — human-readable message (may change across versions)
 * `code`   — stable machine-readable string constant (never changes)
 */

import { z } from 'zod';

// ── Wire shape ────────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  /** Human-readable description of the error. */
  error: z.string(),
  /** Stable machine-readable code. */
  code: z.string(),
  /** Optional extra context (e.g. conflicting request ID). */
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ── Stable error codes ────────────────────────────────────────────────────────

/** Every stable machine code the server can emit. */
export const ErrorCode = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',

  // ── Validation ────────────────────────────────────────────────────────────
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_JUSTIFICATION: 'MISSING_JUSTIFICATION',
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
  CONTROL_MODE_BLOCKED: 'CONTROL_MODE_BLOCKED',

  // ── Setpoints ─────────────────────────────────────────────────────────────
  SETPOINT_REQUEST_CONFLICT: 'SETPOINT_REQUEST_CONFLICT',
  SETPOINT_SELF_APPROVE: 'SETPOINT_SELF_APPROVE',
  SETPOINT_NOT_FOUND: 'SETPOINT_NOT_FOUND',
  SETPOINT_INVALID_TRANSITION: 'SETPOINT_INVALID_TRANSITION',

  // ── Resources ─────────────────────────────────────────────────────────────
  NOT_FOUND: 'NOT_FOUND',
  SITE_NOT_FOUND: 'SITE_NOT_FOUND',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  POINT_NOT_FOUND: 'POINT_NOT_FOUND',
  ALARM_NOT_FOUND: 'ALARM_NOT_FOUND',
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // ── Rate limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // ── Gateway ───────────────────────────────────────────────────────────────
  GATEWAY_WRITE_REJECTED: 'GATEWAY_WRITE_REJECTED',
  GATEWAY_READBACK_TIMEOUT: 'GATEWAY_READBACK_TIMEOUT',
  GATEWAY_READBACK_MISMATCH: 'GATEWAY_READBACK_MISMATCH',

  // ── Audit ─────────────────────────────────────────────────────────────────
  AUDIT_CHAIN_BROKEN: 'AUDIT_CHAIN_BROKEN',

  // ── Internal ─────────────────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
