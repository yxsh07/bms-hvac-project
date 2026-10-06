/**
 * Telemetry schemas (§7.4, §7.5, §7.9)
 *
 * Covers:
 *  - TelemetryDriver interface
 *  - SeriesQuery, CounterQuery
 *  - LatestResponse, SeriesResponse, CoverageResponse
 *  - FloorSummary (GET /sites/:s/floors/summary)
 *  - PlantKpis   (GET /sites/:s/plant/kpis)
 *
 * ALL telemetry responses carry a quality block:
 *   { expectedSamples, goodSamples, coveragePct, hasDelayedData }
 *
 * Each bucket carries `n` so the UI can mark partial hours.
 */

import { z } from 'zod';

// ── Quality block (cross-cutting, §7.9) ───────────────────────────────────────

export const QualityBlockSchema = z.object({
  expectedSamples: z.number().int().nonnegative(),
  goodSamples: z.number().int().nonnegative(),
  /** Coverage percentage [0–100]. */
  coveragePct: z.number().min(0).max(100),
  /** True if any sample in the window was ingested late. */
  hasDelayedData: z.boolean(),
});
export type QualityBlock = z.infer<typeof QualityBlockSchema>;

// ── Resolution ────────────────────────────────────────────────────────────────

export const ResolutionSchema = z.enum(['raw', '1h', '1d']);
export type Resolution = z.infer<typeof ResolutionSchema>;

// ── Queries ───────────────────────────────────────────────────────────────────

export const SeriesQuerySchema = z.object({
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  field: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
  resolution: ResolutionSchema.default('1h'),
});
export type SeriesQuery = z.infer<typeof SeriesQuerySchema>;

export const CounterQuerySchema = z.object({
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  field: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
});
export type CounterQuery = z.infer<typeof CounterQuerySchema>;

// ── Latest value ──────────────────────────────────────────────────────────────

export const LatestPointSchema = z.object({
  value: z.number().nullable(),
  /** ISO-8601 timestamp of this reading. */
  at: z.string().datetime(),
  /** Quality code (0 = ok, 1 = sentinel, 2 = out-of-range, 3 = stopped, 4 = inconsistent). */
  quality: z.number().int().min(0).max(4),
});
export type LatestPoint = z.infer<typeof LatestPointSchema>;

export const LatestResponseSchema = z.object({
  /** Keyed by field abbreviation. */
  fields: z.record(z.string(), LatestPointSchema),
  quality: QualityBlockSchema,
});
export type LatestResponse = z.infer<typeof LatestResponseSchema>;

// ── Series bucket ─────────────────────────────────────────────────────────────

export const SeriesBucketSchema = z.object({
  /** ISO-8601 bucket start time. */
  t: z.string().datetime(),
  avg: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** Sample count; allows the UI to detect partial hours. */
  n: z.number().int().nonnegative(),
});
export type SeriesBucket = z.infer<typeof SeriesBucketSchema>;

export const SeriesResponseSchema = z.object({
  field: z.string(),
  resolution: ResolutionSchema,
  buckets: z.array(SeriesBucketSchema),
  quality: QualityBlockSchema,
});
export type SeriesResponse = z.infer<typeof SeriesResponseSchema>;

// ── Coverage ──────────────────────────────────────────────────────────────────

export const CoverageResponseSchema = z.object({
  expected: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  pct: z.number().min(0).max(100),
  quality: QualityBlockSchema,
});
export type CoverageResponse = z.infer<typeof CoverageResponseSchema>;

// ── Counter delta ─────────────────────────────────────────────────────────────

export const CounterDeltaResponseSchema = z.object({
  delta: z.number(),
  /** Number of counter resets detected in the window. */
  resets: z.number().int().nonnegative(),
  quality: QualityBlockSchema,
});
export type CounterDeltaResponse = z.infer<typeof CounterDeltaResponseSchema>;

// ── Floor summary (§7.9) ──────────────────────────────────────────────────────

export const FloorSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** kWh consumed in the requested window. */
  kwh: z.number().nullable(),
  /** Mean dry-bulb temperature in °C. */
  avgTempC: z.number().nullable(),
  /**
   * Comfort score [0–1]; 1 = all samples within comfort band,
   * 0 = all samples outside.
   */
  comfort: z.number().min(0).max(1).nullable(),
  /** False when there is no data for this floor in the window. */
  hasData: z.boolean(),
});
export type FloorSummary = z.infer<typeof FloorSummarySchema>;

export const FloorSummaryResponseSchema = z.object({
  window: z.string(),
  floors: z.array(FloorSummarySchema),
  quality: QualityBlockSchema,
});
export type FloorSummaryResponse = z.infer<typeof FloorSummaryResponseSchema>;

// ── Plant KPIs (§7.9) ─────────────────────────────────────────────────────────

export const PlantKpisSchema = z.object({
  /** Total electrical demand in kW. */
  totalKw: z.number().nullable(),
  /** Total cooling capacity in Tonnes of Refrigeration. */
  totalTr: z.number().nullable(),
  /**
   * System efficiency coefficient: kW / TR (ikW/TR).
   * Lower is better.
   */
  secIkwPerTr: z.number().nullable(),
  /** Chilled-water delta T (°C). */
  chwDeltaT: z.number().nullable(),
  /**
   * Condenser approach temperature (°C):
   * condenser leaving water temp − entering wet-bulb.
   */
  approachTempC: z.number().nullable(),
  /** Number of machines currently staged on. */
  stagingCount: z.number().int().nonnegative().nullable(),
  /** Window used to compute the KPIs (e.g. "1h"). */
  window: z.string(),
  quality: QualityBlockSchema,
});
export type PlantKpis = z.infer<typeof PlantKpisSchema>;

// ── Driver interfaces (§7.2) ──────────────────────────────────────────────────

/** Raw row as produced by a source driver before quality processing. */
export interface RawRow {
  entityId: string;
  field: string;
  at: string;
  value: number | null;
  isDelayed: boolean;
}

/**
 * TelemetryDriver — implemented per site protocol (TimescaleDB, Niagara, etc.)
 * Chosen by site config, never by a branch on the site name.
 */
export interface TelemetryDriver {
  latest(
    siteId: string,
    entityId: string,
  ): Promise<Record<string, { value: number | null; at: string; quality: number }>>;

  series(q: SeriesQuery): Promise<SeriesBucket[]>;

  counterDelta(q: CounterQuery): Promise<{ delta: number; resets: number }>;

  coverage(
    siteId: string,
    entityId: string,
    from: string,
    to: string,
  ): Promise<{ expected: number; received: number; pct: number }>;
}

/**
 * SourceDriver — used only by the ingest worker.
 * Produces raw rows from an external source (e.g. InfluxDB, BACnet log).
 */
export interface SourceDriver {
  next(cursor: string | null, limit: number): Promise<{ rows: RawRow[]; cursor: string }>;
}
