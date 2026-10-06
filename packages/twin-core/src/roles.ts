/**
 * Role vocabulary and resolver (§5.4, ADR-002, DEC-4)
 *
 * A "role" is a stable semantic identifier for a BMS point function.
 * Templates, plant nodes and UI components reference roles only — never raw
 * point abbreviations — so the same code works on any site.
 *
 * Resolution order (implemented in resolveRole):
 *   1. point-roles.json  byType[assetType][role]  → point abbreviation
 *   2. Fallback rules in point-roles.json (classification + unit + name pattern)
 *   3. null              → render "–" with reason "not available at this site"
 *
 * resolveRole never throws.
 */

// ── Vocabulary ────────────────────────────────────────────────────────────────

/**
 * The canonical set of role identifiers used across all UI layers.
 * Extend here when a new semantic point function is needed project-wide;
 * never add site-specific identifiers.
 */
export const ROLES = [
  'run-status',
  'fault-alarm',
  'power-kw',
  'loading-pct',
  'chw-leaving-temp',
  'chw-entering-temp',
  'chw-flow',
  'cond-leaving-temp',
  'cond-entering-temp',
  'cond-flow',
  'setpoint-chw-temp',
  'setpoint-cond-temp',
  'supply-air-temp',
  'return-air-temp',
  'supply-air-flow',
  'valve-position',
  'fan-speed',
  'area-temp',
  'area-humidity',
  'filter-status',
  'differential-pressure',
  'energy-kwh',
  'cop',
] as const;

export type Role = (typeof ROLES)[number];

/** Type guard — returns true if s is a known role string. */
export function isRole(s: string): s is Role {
  return (ROLES as readonly string[]).includes(s);
}

// ── point-roles.json shape ────────────────────────────────────────────────────

/** Shape of data/seed/point-roles.json (read at runtime; may contain raw abbreviations). */
export interface PointRolesData {
  /** Primary lookup: assetType → role → point abbreviation on this site. */
  byType: Record<string, Record<string, string>>;
  /**
   * Fallback rules applied in order when byType yields no match.
   * Each rule matches on one or more point metadata fields (string patterns).
   */
  fallbackRules: FallbackRule[];
}

export interface FallbackRule {
  /** Substring match against the point's classification (case-insensitive). */
  classificationContains?: string;
  /** Substring match against the engineering unit string. */
  unitContains?: string;
  /** Substring match against the display name. */
  nameContains?: string;
  /** The role to assign when this rule matches. */
  role: Role;
}

// ── Resolution context ────────────────────────────────────────────────────────

/** Metadata about a BMS point used for fallback rule matching. */
export interface PointMeta {
  abbreviation: string;
  displayName: string;
  classification: string;
  unit: string;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

export interface ResolveResult {
  /** The matched point abbreviation, or null when the role is unavailable. */
  abbreviation: string | null;
  /**
   * Human-readable reason when abbreviation is null.
   * Always "not available at this site" for the null case.
   */
  reason: string | null;
}

/**
 * Resolve a semantic role to a site point abbreviation.
 *
 * @param pointRoles  Parsed contents of data/seed/point-roles.json.
 * @param assetType   Asset type string (e.g. "chiller", "ahu").
 * @param role        Semantic role from the ROLES vocabulary.
 * @param pointsMeta  Optional map of abbreviation → PointMeta for fallback matching.
 *
 * Resolution order (§5.4):
 *   1. byType[assetType][role]
 *   2. fallbackRules matched against pointsMeta entries
 *   3. { abbreviation: null, reason: "not available at this site" }
 *
 * Never throws; returns a ResolveResult in all cases.
 */
export function resolveRole(
  pointRoles: PointRolesData,
  assetType: string,
  role: string,
  pointsMeta?: Record<string, PointMeta>,
): ResolveResult {
  // Step 1 – primary lookup
  const abbr = pointRoles.byType[assetType]?.[role];
  if (abbr) {
    return { abbreviation: abbr, reason: null };
  }

  // Step 2 – fallback rules against PointMeta entries
  if (pointsMeta) {
    for (const rule of pointRoles.fallbackRules) {
      if (rule.role !== role) continue;
      for (const [abbreviation, meta] of Object.entries(pointsMeta)) {
        if (
          (rule.classificationContains === undefined ||
            meta.classification.toLowerCase().includes(rule.classificationContains.toLowerCase())) &&
          (rule.unitContains === undefined ||
            meta.unit.toLowerCase().includes(rule.unitContains.toLowerCase())) &&
          (rule.nameContains === undefined ||
            meta.displayName.toLowerCase().includes(rule.nameContains.toLowerCase()))
        ) {
          return { abbreviation, reason: null };
        }
      }
    }
  }

  // Step 3 – no match
  return { abbreviation: null, reason: 'not available at this site' };
}
