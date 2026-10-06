/**
 * Gateway driver interface and schemas (§7.2, §7.6)
 *
 * GatewayDriver abstracts communication with the BMS/field controller.
 * The driver implementation is chosen by site config — never by a branch
 * on the site name.
 *
 * Gateway presets (§6.3) are named driver configurations stored in site
 * config that map to a concrete GatewayDriver implementation.
 */

import { z } from 'zod';

// ── Write request / response ──────────────────────────────────────────────────

export const GatewayWriteRequestSchema = z.object({
  siteId: z.string().min(1),
  assetId: z.string().min(1),
  /** Field abbreviation (point.abbr). */
  point: z.string().min(1),
  value: z.number(),
  /** UUID that ensures exactly-once delivery. */
  idempotencyKey: z.string().min(1),
});
export type GatewayWriteRequest = z.infer<typeof GatewayWriteRequestSchema>;

export const GatewayWriteResponseSchema = z.object({
  accepted: z.boolean(),
  /** Present when accepted = false. */
  reason: z.string().optional(),
});
export type GatewayWriteResponse = z.infer<typeof GatewayWriteResponseSchema>;

// ── Read response ─────────────────────────────────────────────────────────────

export const GatewayReadResponseSchema = z.object({
  value: z.number().nullable(),
  /** ISO-8601 UTC timestamp of the reading. */
  at: z.string().datetime(),
});
export type GatewayReadResponse = z.infer<typeof GatewayReadResponseSchema>;

// ── Preset definition ─────────────────────────────────────────────────────────

/**
 * Named gateway configuration (§6.3).
 * Stored in site config; selects the concrete GatewayDriver implementation.
 *
 * `driver` identifies the implementation class (e.g. "bacnet", "modbus", "niagara").
 * `options` are driver-specific and passed to the driver constructor.
 */
export const GatewayPresetSchema = z.object({
  name: z.string().min(1),
  /** Driver implementation key. Open enum — forward-compatible. */
  driver: z.string().min(1),
  /** Driver-specific connection options. */
  options: z.record(z.string(), z.unknown()),
  /** Read-back timeout in milliseconds (default from global config). */
  readbackTimeoutMs: z.number().int().positive().optional(),
  /** Absolute tolerance for read-back verification (same unit as point). */
  readbackTolerance: z.number().positive().optional(),
});
export type GatewayPreset = z.infer<typeof GatewayPresetSchema>;

// ── Driver interface ──────────────────────────────────────────────────────────

/**
 * GatewayDriver — implemented per BMS protocol/vendor.
 * Chosen by site config, never by a branch on the site name.
 *
 * Implementors MUST honour idempotencyKey: if the same key arrives twice,
 * return the same response without issuing a second field command.
 */
export interface GatewayDriver {
  /**
   * Write a value to a field controller point.
   * Returns { accepted: true } if the command was accepted by the field device,
   * or { accepted: false, reason } if it was rejected.
   *
   * NOTE: accepted ≠ applied. The caller must poll `read` to verify.
   */
  write(req: GatewayWriteRequest): Promise<GatewayWriteResponse>;

  /**
   * Read the current live value of a point from the field controller.
   * Returns null when the point is unavailable or in error.
   */
  read(siteId: string, assetId: string, point: string): Promise<GatewayReadResponse>;
}
