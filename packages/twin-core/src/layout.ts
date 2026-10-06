/**
 * twin-layout.json zod schema (§5.3, ADR-002)
 *
 * This schema is the single source of truth for what a site layout file must
 * contain.  It is validated on load; failures trigger the generator fallback
 * (see §5.10 / ADR-002).
 *
 * Authoring note: all coordinates are in a dimensionless "layout unit" space
 * whose scale is defined per-floor via footprint.  The plant viewBox uses its
 * own SVG coordinate space.
 */

import { z } from 'zod';

// ── Floors ────────────────────────────────────────────────────────────────────

export const FloorSchema = z.object({
  /** Stable identifier, e.g. "F07". */
  id: z.string().min(1),
  /** Human-readable label shown in the floor list. */
  name: z.string().min(1),
  /** Elevation index (used for L1 stacking order). */
  elevation: z.number(),
  /** Layout-unit bounding box of the floor plate. */
  footprint: z.object({ w: z.number().positive(), h: z.number().positive() }),
  /**
   * Optional per-floor image that overrides the procedurally generated plan
   * texture.  null = use generated texture (§5.7).
   */
  planImage: z.string().url().nullable(),
});
export type Floor = z.infer<typeof FloorSchema>;

// ── Zones ─────────────────────────────────────────────────────────────────────

export const ZoneSchema = z.object({
  id: z.string().min(1),
  floor: z.string().min(1),
  /** [x, y, w, h] in layout units relative to the floor origin. */
  rect: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
  /**
   * Keys the comfort bands in site-config §2.3.
   * Open enum: forward-compatible with new space types.
   */
  spaceType: z.string().min(1),
});
export type Zone = z.infer<typeof ZoneSchema>;

// ── Anchors ───────────────────────────────────────────────────────────────────

export const AnchorSchema = z.object({
  floor: z.string().min(1),
  zone: z.string().min(1).optional(),
  /** [x, y] in layout units. */
  xy: z.tuple([z.number(), z.number()]),
});
export type Anchor = z.infer<typeof AnchorSchema>;

// ── Plant (L2 schematic, §5.5) ────────────────────────────────────────────────

/** Pipe medium — determines colour via design tokens (no hardcoded colours). */
export const MediumSchema = z.enum(['chilled', 'condenser', 'other']);
export type Medium = z.infer<typeof MediumSchema>;

/** Node kinds present in the plant diagram. */
export const NodeKindSchema = z.enum(['equipment', 'sensor', 'valve', 'header', 'tank']);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const PlantNodeSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('equipment'),
    assetId: z.string().min(1),
    /** Asset type string — looked up in GlyphRegistry; falls back to "generic-box". */
    type: z.string().min(1),
    xy: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('sensor'),
    assetId: z.string().min(1),
    /** Semantic role from the vocabulary in roles.ts. */
    role: z.string().min(1),
    xy: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('valve'),
    assetId: z.string().min(1),
    role: z.string().min(1),
    xy: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('header'),
    label: z.string(),
    xy: z.tuple([z.number(), z.number()]),
    w: z.number().positive(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('tank'),
    assetId: z.string().min(1),
    type: z.string().min(1),
    xy: z.tuple([z.number(), z.number()]),
  }),
]);
export type PlantNode = z.infer<typeof PlantNodeSchema>;

export const PlantEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  medium: MediumSchema,
  /** Semantic role for flow value (used for animation speed). */
  flowRole: z.string().optional(),
  assetId: z.string().optional(),
});
export type PlantEdge = z.infer<typeof PlantEdgeSchema>;

export const PlantSchema = z.object({
  /** SVG coordinate space, e.g. [0, 0, 1600, 900]. */
  viewBox: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
  nodes: z.array(PlantNodeSchema),
  edges: z.array(PlantEdgeSchema),
});
export type Plant = z.infer<typeof PlantSchema>;

// ── Root TwinLayout ───────────────────────────────────────────────────────────

export const TwinLayoutSchema = z.object({
  version: z.literal(1),
  /**
   * True when this layout was produced by the generator (§5.10) rather than
   * hand-authored.  The UI must display a "Schematic layout – not to scale"
   * badge when this flag is set.
   */
  schematic: z.boolean().optional(),
  floors: z.array(FloorSchema).min(1),
  zones: z.array(ZoneSchema),
  /**
   * Map of assetId → anchor position.
   * Assets absent from this map are not placed on L1 or L2.
   */
  anchors: z.record(z.string(), AnchorSchema),
  plant: PlantSchema,
});
export type TwinLayout = z.infer<typeof TwinLayoutSchema>;

/**
 * Validate raw JSON against TwinLayoutSchema.
 * Returns the parsed layout on success, throws ZodError on failure.
 * Callers should catch and fall back to the generator (§5.10).
 */
export function parseTwinLayout(raw: unknown): TwinLayout {
  return TwinLayoutSchema.parse(raw);
}
