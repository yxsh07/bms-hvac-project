import { z } from 'zod';

// ============================================================================
// ONTOLOGY SCHEMAS
// Based on PLAN.md §7.3 - Ontology model
// ============================================================================

/** Site - top-level container */
export const SiteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().regex(/^[A-Za-z]+\/[A-Za-z_]+$/),
  environment: z.object({
    wetBulbC: z.number(),
    dryBulbC: z.number(),
    relativeHumidity: z.number().min(0).max(100),
  }).optional(),
});

export type Site = z.infer<typeof SiteSchema>;

/** Floor - building level */
export const FloorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int(),
});

export type Floor = z.infer<typeof FloorSchema>;

/** Zone - logical grouping of assets */
export const ZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type Zone = z.infer<typeof ZoneSchema>;

/** Asset criticality levels */
export const AssetCriticalitySchema = z.enum(['critical', 'important', 'standard']);

export type AssetCriticality = z.infer<typeof AssetCriticalitySchema>;

/** Asset type categories */
export const AssetTypeSchema = z.enum([
  'ahu',
  'chiller',
  'cooling-tower',
  'pump',
  'fan',
  'valve',
  'heater',
  'boiler',
  'meter',
  'sensor',
  'controller',
  'unknown',
]);

export type AssetType = z.infer<typeof AssetTypeSchema>;

/** Asset - equipment or logical entity */
export const AssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: AssetTypeSchema,
  criticality: AssetCriticalitySchema,
  floorId: z.string().optional(), // ON_FLOOR edge (may be empty per PLAN DEC-9)
  zoneId: z.string().optional(),  // IN_ZONE edge
  controllerId: z.string().optional(), // MONITORS edge
  meterDeviceId: z.string().optional(), // METERED_BY edge
  points: z.array(z.string()), // HAS_POINT edges (point abbreviations)
});

export type Asset = z.infer<typeof AssetSchema>;

/** Point classification - for quality rules */
export const PointClassSchema = z.enum([
  'Temperature',
  'Pressure',
  'Flow',
  'Power',
  'Energy',
  'Status',
  'Alarm',
  'Setpoint',
  'Counter',
  'Humidity',
  'Velocity',
  'Frequency',
  'Voltage',
  'Current',
  'PowerFactor',
  'Unknown',
]);

export type PointClass = z.infer<typeof PointClassSchema>;

/** Point source */
export const PointSourceSchema = z.enum(['bacnet', 'modbus', 'internal', 'calculated']);

export type PointSource = z.infer<typeof PointSourceSchema>;

/** Point - a data point on an asset */
export const PointSchema = z.object({
  abbr: z.string().min(1),           // Unique abbreviation (e.g., "coollwt")
  display: z.string().min(1),        // Display name
  unit: z.string().min(1),           // Unit of measurement
  group: z.string().optional(),      // Parameter group
  cls: PointClassSchema,             // Classification for quality rules
  source: PointSourceSchema,         // Data source type
  writable: z.boolean(),             // Can be set via set-point workflow
  safeMin: z.number().optional(),    // Safe operating minimum
  safeMax: z.number().optional(),    // Safe operating maximum
  tolerance: z.number().optional(),  // Read-back tolerance for set-points
});

export type Point = z.infer<typeof PointSchema>;

/** Controller device */
export const ControllerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  deviceId: z.string().min(1), // Physical device identifier
});

export type Controller = z.infer<typeof ControllerSchema>;

/** Meter device */
export const MeterSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().min(1),
  model: z.string().optional(),
});

export type Meter = z.infer<typeof MeterSchema>;

/** Complete ontology */
export const OntologySchema = z.object({
  site: SiteSchema,
  floors: z.array(FloorSchema),
  zones: z.array(ZoneSchema),
  assets: z.array(AssetSchema),
  points: z.record(z.string(), PointSchema), // Map by abbreviation
  controllers: z.array(ControllerSchema),
  meters: z.array(MeterSchema),
});

export type Ontology = z.infer<typeof OntologySchema>;

/** Asset with full point details for API responses */
export const AssetWithPointsSchema = AssetSchema.extend({
  pointDetails: z.array(PointSchema),
});

export type AssetWithPoints = z.infer<typeof AssetWithPointsSchema>;

/** Edge types for ontology */
export const EdgeTypeSchema = z.enum([
  'HAS_ASSET',
  'ON_FLOOR',
  'IN_ZONE',
  'HAS_POINT',
  'MONITORS',
  'METERED_BY',
  'SERVES',
  'FED_BY',
]);

export type EdgeType = z.infer<typeof EdgeTypeSchema>;