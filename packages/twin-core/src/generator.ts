/**
 * Layout generator interface (§5.10, ADR-002)
 *
 * The generator produces a schematic TwinLayout from the site ontology when no
 * hand-authored twin-layout.json is present or when validation fails.
 *
 * Full implementation is deferred to T-035 (L2 plant) and T-058 (L1 3D).
 * This interface is exported now so downstream packages can type-check against
 * it immediately.
 *
 * Rules (ADR-002):
 *   - Generated layouts always have { schematic: true }; the UI must display a
 *     "Schematic layout – not to scale" badge.
 *   - Plant node order: cooling-towers → condenser-pumps → chillers →
 *     chilled-water-pumps → headers.
 *   - Equipment positions are on a grid inside each zone; zone sizes are
 *     proportional to asset count (squarified packing).
 *   - Pipe topology is type-adjacency heuristic; it is NOT hydraulic truth.
 *   - The generator must not throw; it returns a GeneratorResult with either a
 *     layout or a structured error.
 *   - SVG node count of the generated plant must stay ≤ 400 (§5.5 budget);
 *     the generator must cap nodes and log a warning if the ontology is large.
 */

import type { TwinLayout } from './layout.js';

// ── Input types ───────────────────────────────────────────────────────────────

/** Minimal asset descriptor read from the site ontology. */
export interface OntologyAsset {
  id: string;
  /** Equipment type, e.g. "chiller", "pump", "ahu". */
  type: string;
  /** Floor identifier from the ontology (may be absent for unlocated assets). */
  floorId?: string;
  /** Zone or area identifier (may be absent). */
  zoneId?: string;
  /** Classification tags from the ontology (used for ordering heuristics). */
  classifications: string[];
}

/** Seed floor data used when no layout exists. */
export interface SeedFloor {
  id: string;
  name: string;
  elevation: number;
}

/** Input to the layout generator. */
export interface GeneratorInput {
  /** Site identifier (used only for logging / labelling). */
  siteId: string;
  /** All assets from the site ontology. */
  assets: OntologyAsset[];
  /**
   * Seed floor definitions.  When absent the generator creates one floor.
   */
  floors?: SeedFloor[];
  /**
   * Maximum SVG plant nodes to emit (default 400, §5.5 budget).
   * If the ontology would produce more, assets are grouped and a warning logged.
   */
  maxPlantNodes?: number;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface GeneratorWarning {
  code: 'NODE_LIMIT_EXCEEDED' | 'UNLOCATED_ASSETS' | 'UNKNOWN_ASSET_TYPE';
  message: string;
  /** Affected asset IDs when applicable. */
  assetIds?: string[];
}

export type GeneratorResult =
  | { ok: true; layout: TwinLayout; warnings: GeneratorWarning[] }
  | { ok: false; error: string; warnings: GeneratorWarning[] };

// ── Generator interface ───────────────────────────────────────────────────────

/**
 * Contract for tools/gen_twin_layout.ts.
 *
 * Implementations must:
 *   - Set layout.schematic = true.
 *   - Never throw; catch internal errors and return { ok: false, error }.
 *   - Respect maxPlantNodes (default 400).
 *   - Order plant nodes: cooling-towers → condenser-pumps → chillers →
 *     chilled-water-pumps → headers.
 */
export interface LayoutGenerator {
  generate(input: GeneratorInput): Promise<GeneratorResult>;
}

// ── Stub implementation (replaced in T-035/T-058) ────────────────────────────

/**
 * Stub generator returned until T-035/T-058 provide a real implementation.
 * Always returns { ok: false } so callers know to surface the schematic banner.
 */
export const stubGenerator: LayoutGenerator = {
  async generate(input: GeneratorInput): Promise<GeneratorResult> {
    return {
      ok: false,
      error: `Layout generator not yet implemented for site "${input.siteId}" (see T-035/T-058).`,
      warnings: [],
    };
  },
};
