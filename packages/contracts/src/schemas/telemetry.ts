// ============================================================================
// TELEMETRY SCHEMAS
// Based on PLAN.md §7.4 - Storage and §7.5 - Quality layer
// ============================================================================

/** Quality codes for telemetry values */
export const QualityCodeSchema = z.enum([
  'OK',               // 0 - good value
  'SENTINEL',         // 1 - sentinel value detected
  'OUT_OF_RANGE',     // 2 - value outside configured range
  'STOPPED_EQUIPMENT',// 3 - equipment stopped, process value suppressed
  'INCONSISTENT',     // 4 - failed consistency rule
]);

export const QualityCode = z.nativeEnum({
  OK: 0,
  SENTINEL: 1,
  OUT_OF_RANGE: 2,
  STOPPED_EQUIPMENT: 3,
  INCONSISTENT: 4,
});

export type QualityCode = z.infer<typeof QualityCode>;

/** Single telemetry value with quality */
export const TelemetryValueSchema = z.object({
  value: z.number().nullable(),      // NULL when quality !== 0
  rawValue: z.number().nullable(),   // Original value kept when quality !== 0
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/, 'Invalid ISO 8601 datetime'), // ISO-8601 with offset
  quality: QualityCode,
  isDelayed: z.boolean().default(false),
});

export type TelemetryValue = z.infer<typeof TelemetryValueSchema>;

/** Latest values for an entity */
export const EntityLatestSchema = z.record(
  z.string(), // field name
  TelemetryValueSchema
);

export type EntityLatest = z.infer<typeof EntityLatestSchema>;

/** Series resolution */
export const SeriesResolutionSchema = z.enum(['raw', '1h', '1d']);

export type SeriesResolution = z.infer<typeof SeriesResolutionSchema>;

/** Time range for series queries */
export const TimeRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/, 'Invalid ISO 8601 datetime'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/, 'Invalid ISO 8601 datetime'),
});

export type TimeRange = z.infer<typeof TimeRangeSchema>;

/** Series query parameters */
export const SeriesQuerySchema = z.object({
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  field: z.string().min(1),
  resolution: SeriesResolutionSchema.default('raw'),
  timeRange: TimeRangeSchema,
});

export type SeriesQuery = z.infer<typeof SeriesQuerySchema>;

/** Single telemetry point in a series */
export const TelemetryPointSchema = z.object({
  time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/, 'Invalid ISO 8601 datetime'),
  value: z.number().nullable(),
  quality: QualityCode,
  n: z.number().int().min(0).optional(), // Sample count for aggregated buckets
  isDelayed: z.boolean().optional(),
});

export type TelemetryPoint = z.infer<typeof TelemetryPointSchema>;

/** Series response */
export const TelemetrySeriesSchema = z.object({
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  field: z.string().min(1),
  resolution: SeriesResolutionSchema,
  timeRange: TimeRangeSchema,
  points: z.array(TelemetryPointSchema),
  quality: z.object({
    expectedSamples: z.number().int().min(0),
    goodSamples: z.number().int().min(0),
    coveragePct: z.number().min(0).max(100),
    hasDelayedData: z.boolean(),
  }),
});

export type TelemetrySeries = z.infer<typeof TelemetrySeriesSchema>;

/** Counter query for energy meters */
export const CounterQuerySchema = z.object({
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  field: z.string().min(1),
  timeRange: TimeRangeSchema,
});

export type CounterQuery = z.infer<typeof CounterQuerySchema>;

/** Counter delta response */
export const CounterDeltaSchema = z.object({
  delta: z.number(),       // Sum of positive differences
  resets: z.number().int().min(0), // Number of counter resets detected
});

export type CounterDelta = z.infer<typeof CounterDeltaSchema>;

/** Coverage query parameters */
export const CoverageQuerySchema = z.object({
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  timeRange: TimeRangeSchema,
});

export type CoverageQuery = z.infer<typeof CoverageQuerySchema>;

/** Coverage response */
export const CoverageSchema = z.object({
  expected: z.number().int().min(0),
  received: z.number().int().min(0),
  pct: z.number().min(0).max(100),
});

export type Coverage = z.infer<typeof CoverageSchema>;

/** Telemetry quality block (returned with all telemetry responses) */
export const TelemetryQualityBlockSchema = z.object({
  expectedSamples: z.number().int().min(0),
  goodSamples: z.number().int().min(0),
  coveragePct: z.number().min(0).max(100),
  hasDelayedData: z.boolean(),
  lateSampleCount: z.number().int().min(0).optional(),
  isProvisional: z.boolean().optional(), // True if window ended < 2h ago
});

export type TelemetryQualityBlock = z.infer<typeof TelemetryQualityBlockSchema>;

/** Entity kind for telemetry */
export const EntityKindSchema = z.enum(['component', 'device']);

export type EntityKind = z.infer<typeof EntityKindSchema>;

/** Raw row from source driver */
export const RawRowSchema = z.object({
  time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/, 'Invalid ISO 8601 datetime'),
  siteId: z.string().min(1),
  entityId: z.string().min(1),
  entityKind: EntityKindSchema,
  field: z.string().min(1),
  value: z.number(),
  isDelayed: z.boolean().default(false),
  seq: z.string().optional(), // Cursor for source driver
});

export type RawRow = z.infer<typeof RawRowSchema>;

/** Source driver next batch response */
export const SourceBatchSchema = z.object({
  rows: z.array(RawRowSchema),
  cursor: z.string(),
});

export type SourceBatch = z.infer<typeof SourceBatchSchema>;