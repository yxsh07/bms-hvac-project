/**
 * What-if / ghost-overlay contracts (PLAN 5.9, 6.3; task WIF1)
 *
 * `POST /sim/whatif` (SimSite) copies live state, steps it forward for
 * `horizonMin` with the proposed `changes`, and returns predicted plant kW and
 * ΔT.  It never mutates live state.  Every surface shows the result as
 * "indicative, 3-day calibration" and warns when the prediction leaves the
 * surrogate's training envelope.
 *
 * These schemas are the source of truth for that shape; the web app's local
 * sim client mirrors them (the generated API client targets /api/v1 only).
 */

import { z } from 'zod';

/** The mandatory disclaimer on every what-if surface (PLAN 5.9, R7). */
export const WHATIF_LABEL = 'indicative, 3-day calibration';

// ── Proposed changes ─────────────────────────────────────────────────────────

export const WhatIfSetpointChangeSchema = z.object({
  type: z.literal('setpoint'),
  /** Logical target ("lead-chiller") or a concrete asset id. */
  target: z.string().min(1).optional(),
  /** Set-point role/class, e.g. "setpoint-chw-temp". */
  field: z.string().min(1).optional(),
  value: z.number(),
});
export type WhatIfSetpointChange = z.infer<typeof WhatIfSetpointChangeSchema>;

export const WhatIfEnvChangeSchema = z.object({
  type: z.literal('env'),
  outdoor_dbt: z.number().optional(),
  rh: z.number().min(0).max(100).optional(),
  occupancy_mult: z.number().nonnegative().optional(),
});
export type WhatIfEnvChange = z.infer<typeof WhatIfEnvChangeSchema>;

export const WhatIfFaultChangeSchema = z.object({
  type: z.literal('fault'),
  fault: z.string().min(1),
  target: z.string().optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  durationMin: z.number().int().positive().optional(),
});
export type WhatIfFaultChange = z.infer<typeof WhatIfFaultChangeSchema>;

export const WhatIfModeChangeSchema = z.object({
  type: z.literal('mode'),
  target: z.string().min(1).optional(),
  asset: z.string().min(1).optional(),
  controlType: z.string().min(1),
});
export type WhatIfModeChange = z.infer<typeof WhatIfModeChangeSchema>;

export const WhatIfChangeSchema = z.discriminatedUnion('type', [
  WhatIfSetpointChangeSchema,
  WhatIfEnvChangeSchema,
  WhatIfFaultChangeSchema,
  WhatIfModeChangeSchema,
]);
export type WhatIfChange = z.infer<typeof WhatIfChangeSchema>;

export const WhatIfRequestSchema = z.object({
  changes: z.array(WhatIfChangeSchema).default([]),
  horizonMin: z.number().int().min(1).max(1440).default(60),
  stepMinutes: z.number().int().min(1).max(1440).optional(),
});
export type WhatIfRequest = z.infer<typeof WhatIfRequestSchema>;

// ── Predicted series ─────────────────────────────────────────────────────────

export const WhatIfSampleSchema = z.object({
  t: z.string(),
  /** Total plant electrical kW at this sim-minute. */
  kw: z.number(),
  /** Mean chilled-water ΔT across running chillers (K). */
  deltaTC: z.number(),
  tr: z.number(),
  chwLeavingC: z.number().nullable(),
  condenserEnteringC: z.number().nullable(),
});
export type WhatIfSample = z.infer<typeof WhatIfSampleSchema>;

export const WhatIfSummarySchema = z.object({
  meanKw: z.number(),
  peakKw: z.number(),
  meanDeltaTC: z.number(),
  points: z.number().int().nonnegative(),
});
export type WhatIfSummary = z.infer<typeof WhatIfSummarySchema>;

// ── Surrogate envelope ───────────────────────────────────────────────────────

export const EnvelopeBandSchema = z.object({ min: z.number(), max: z.number() });

export const WhatIfEnvelopeSchema = z.object({
  kind: z.string(),
  trainedOnDays: z.number().int().positive(),
  tolerancePct: z.number().nonnegative(),
  bounds: z.record(z.string(), EnvelopeBandSchema),
  samples: z.number().int().nonnegative(),
  samplesOutside: z.number().int().nonnegative(),
  insideEnvelopePct: z.number().min(0).max(100),
  exceeded: z.boolean(),
  fallbackActive: z.boolean(),
  breaches: z.array(z.string()),
  warning: z.string().nullable(),
});
export type WhatIfEnvelope = z.infer<typeof WhatIfEnvelopeSchema>;

export const WhatIfResponseSchema = z.object({
  label: z.string(),
  horizonMin: z.number().int(),
  stepMinutes: z.number().int(),
  siteId: z.string().optional(),
  changes: z.array(z.unknown()),
  /** Proof the endpoint copied rather than stepped the live engine. */
  liveStateUnchanged: z.boolean(),
  baseline: WhatIfSummarySchema,
  predicted: WhatIfSummarySchema.extend({ series: z.array(WhatIfSampleSchema) }),
  baselineSeries: z.array(WhatIfSampleSchema),
  delta: z.object({ meanKw: z.number(), meanDeltaTC: z.number() }),
  envelope: WhatIfEnvelopeSchema,
  warning: z.string().nullable(),
});
export type WhatIfResponse = z.infer<typeof WhatIfResponseSchema>;
