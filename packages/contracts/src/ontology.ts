/**
 * Ontology schemas (§7.3)
 *
 * Nodes: Site, Floor, Zone, Asset, Point, Controller, Meter
 * Edges represented as nested collections.
 *
 * Component IDs are always strings, never integers (§7.3).
 */

import { z } from 'zod';

/** Site-configured semantic roles; point abbreviations stay in this response. */
export const PointRolesSchema = z.object({
  byType: z.record(z.string(), z.record(z.string(), z.string())),
  fallbackRules: z.array(z.object({
    classificationContains: z.string().optional(),
    unitContains: z.string().optional(),
    nameContains: z.string().optional(),
    role: z.string(),
  })),
});
export type PointRoles = z.infer<typeof PointRolesSchema>;

// ── Quality codes (§7.4) ─────────────────────────────────────────────────────

export const QualityCode = {
  OK: 0,
  SENTINEL: 1,
  OUT_OF_RANGE: 2,
  STOPPED_EQUIPMENT: 3,
  INCONSISTENT: 4,
} as const;
export type QualityCode = (typeof QualityCode)[keyof typeof QualityCode];

// ── Point ─────────────────────────────────────────────────────────────────────

/** Classification / semantic group used for quality rules. */
export const PointClassSchema = z.enum([
  'Temperature',
  'Pressure',
  'Flow',
  'Power',
  'Energy',
  'Status',
  'Setpoint',
  'Counter',
  'Alarm',
  'Other',
]);
export type PointClass = z.infer<typeof PointClassSchema>;

export const PointSchema = z.object({
  /** Stable parameter abbreviation used as a field name in telemetry. */
  abbr: z.string().min(1),
  /** Human-readable display label. */
  display: z.string().min(1),
  /** Engineering unit (e.g. "°C", "kW", "m³/h"). Empty string when unitless. */
  unit: z.string(),
  /** Semantic group for dashboarding and quality-rule matching. */
  group: z.string().min(1),
  /** Semantic class used for quality rules (e.g. Temperature). */
  cls: PointClassSchema,
  /** Source field name in the ingest driver. */
  source: z.string().min(1),
  /** Whether this point can be written via the setpoint workflow. */
  writable: z.boolean(),
  /** Minimum safe write value (inclusive). Only present when writable. */
  safeMin: z.number().optional(),
  /** Maximum safe write value (inclusive). Only present when writable. */
  safeMax: z.number().optional(),
  /** Tolerance for read-back verification (absolute, same unit). Default from config. */
  tolerance: z.number().optional(),
});
export type Point = z.infer<typeof PointSchema>;

// ── Controller ────────────────────────────────────────────────────────────────

export const ControllerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Vendor/protocol device identifier. */
  deviceId: z.string().min(1),
});
export type Controller = z.infer<typeof ControllerSchema>;

// ── Meter ─────────────────────────────────────────────────────────────────────

export const MeterSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().min(1),
  model: z.string(),
});
export type Meter = z.infer<typeof MeterSchema>;

// ── Asset ─────────────────────────────────────────────────────────────────────

export const AssetCriticalitySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type AssetCriticality = z.infer<typeof AssetCriticalitySchema>;

export const AssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Open-ended type string (e.g. "chiller", "ahu", "pump"). */
  type: z.string().min(1),
  criticality: AssetCriticalitySchema,
  /** Points belonging to this asset. */
  points: z.array(PointSchema),
  /** Controller that monitors this asset (if any). */
  controllerId: z.string().optional(),
  /** Meter associated with this asset (if any). */
  meterDeviceId: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

/** Lightweight asset summary (list endpoints, without points). */
export const AssetSummarySchema = AssetSchema.omit({ points: true });
export type AssetSummary = z.infer<typeof AssetSummarySchema>;

// ── Zone ──────────────────────────────────────────────────────────────────────

export const ZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** IDs of assets located in this zone. */
  assetIds: z.array(z.string()),
});
export type Zone = z.infer<typeof ZoneSchema>;

// ── Floor ─────────────────────────────────────────────────────────────────────

export const FloorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Floor level number (0 = ground, negative = basement). */
  level: z.number().int(),
  zones: z.array(ZoneSchema),
});
export type Floor = z.infer<typeof FloorSchema>;

// ── Site ──────────────────────────────────────────────────────────────────────

export const SiteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** IANA timezone (e.g. "Asia/Kuala_Lumpur"). */
  timezone: z.string().min(1),
  floors: z.array(FloorSchema),
  /** Top-level assets not on any floor (e.g. plant-room equipment). */
  assets: z.array(AssetSummarySchema),
  controllers: z.array(ControllerSchema),
  meters: z.array(MeterSchema),
});
export type Site = z.infer<typeof SiteSchema>;

/** Lightweight site summary for the /sites list. */
export const SiteSummarySchema = SiteSchema.pick({ id: true, name: true, timezone: true });
export type SiteSummary = z.infer<typeof SiteSummarySchema>;

// ── Ontology (full tree for a site) ──────────────────────────────────────────

export const OntologySchema = z.object({
  site: SiteSchema,
  /** All controllers, keyed by id. */
  controllers: z.record(z.string(), ControllerSchema),
  /** All meters, keyed by deviceId. */
  meters: z.record(z.string(), MeterSchema),
});
export type Ontology = z.infer<typeof OntologySchema>;

// ── Controller health ─────────────────────────────────────────────────────────

export const ControllerHealthSchema = z.object({
  controllerId: z.string().min(1),
  name: z.string().min(1),
  online: z.boolean(),
  /** Number of assets monitored by this controller. */
  assetCount: z.number().int().nonnegative(),
  lastSeenAt: z.string().datetime().nullable(),
});
export type ControllerHealth = z.infer<typeof ControllerHealthSchema>;
