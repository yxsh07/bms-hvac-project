/**
 * Point classification and role → abbreviation resolution (PLAN §5.4, §7.5).
 *
 * Classification maps a point to the vocabulary used by the quality layer and
 * by site-config range rules. It is derived from the point's semantic role
 * (`point-roles.json`), its ontology `cls`, and its unit — never from a
 * hardcoded site abbreviation.
 *
 * `resolveRoleAbbrev` reads `data/seed/point-roles.json` via the config path
 * and returns the site's abbreviation for a role on an asset type.
 */

import { readFileSync } from 'node:fs';

// ── Classification vocabulary ────────────────────────────────────────────────

export type PointClassification =
  | 'Temperature'
  | 'Humidity'
  | 'Pressure'
  | 'Flow Sensor'
  | 'Power'
  | 'Energy'
  | 'Voltage'
  | 'Current'
  | 'Frequency'
  | 'Power Factor'
  | 'Status'
  | 'Setpoint'
  | 'Actuator'
  | 'Other';

export interface ClassifyInput {
  /** Semantic role from the ROLES vocabulary (e.g. "area-temp"). */
  role?: string | null;
  /** Ontology `cls` field (e.g. "chilled-water-supply-temp"). */
  cls?: string | null;
  /** Engineering unit (e.g. "°C", "kW", "kWh"). */
  unit?: string | null;
}

/**
 * Map a point's role / `cls` / unit to a quality classification.
 *
 * Precedence (site-agnostic, role first):
 *   setpoint-*             → Setpoint
 *   run-status/fault-alarm → Status
 *   valve-position/fan-speed → Actuator
 *   area-humidity          → Humidity
 *   power-kw               → Power
 *   energy-kwh             → Energy
 *   *temp / cls *temp      → Temperature
 *   *pressure              → Pressure
 *   *flow                  → Flow Sensor
 *   else                   → Other
 */
export function classifyPoint(input: ClassifyInput): PointClassification {
  const role = (input.role ?? '').toLowerCase();
  const cls = (input.cls ?? '').toLowerCase();
  const unit = (input.unit ?? '').toLowerCase().trim();

  // Setpoint before temperature: "setpoint-chw-temp" must not become Temperature.
  if (role.startsWith('setpoint-') || cls.startsWith('setpoint')) return 'Setpoint';

  if (
    role === 'run-status' ||
    role === 'fault-alarm' ||
    role === 'filter-status' ||
    cls === 'run-status' ||
    cls === 'status' ||
    cls.includes('fault') ||
    cls.includes('alarm')
  ) {
    return 'Status';
  }

  if (
    role === 'valve-position' ||
    role === 'fan-speed' ||
    cls === 'valve-position' ||
    cls === 'fan-speed' ||
    cls.includes('valve') ||
    cls.includes('speed')
  ) {
    return 'Actuator';
  }

  if (role === 'area-humidity' || cls.includes('humidity')) return 'Humidity';

  // Unit-based fallbacks for points without a clear cls/role.
  if (unit === 'kw' || role === 'power-kw' || cls === 'power' || cls.includes('power')) {
    if (!cls.includes('factor')) return 'Power';
  }
  if (cls.includes('power factor') || unit === 'pf') return 'Power Factor';
  if (unit === 'kwh' || role === 'energy-kwh' || cls.includes('energy')) return 'Energy';
  if (unit === 'v' || cls.includes('voltage')) return 'Voltage';
  if (unit === 'a' || cls.includes('current')) return 'Current';
  if (unit === 'hz' || cls.includes('frequency')) return 'Frequency';

  if (role.endsWith('temp') || cls.includes('temp') || unit === '°c' || unit === 'degc') {
    return 'Temperature';
  }
  if (role.includes('pressure') || cls.includes('pressure')) return 'Pressure';
  if (role.includes('flow') || cls.includes('flow')) return 'Flow Sensor';

  return 'Other';
}

// ── Role resolution ──────────────────────────────────────────────────────────

export interface PointRolesData {
  byType: Record<string, Record<string, string>>;
  fallbackRules: Array<{
    classificationContains?: string;
    unitContains?: string;
    nameContains?: string;
    role: string;
  }>;
}

const DEFAULT_POINT_ROLES: PointRolesData = { byType: {}, fallbackRules: [] };

/**
 * Resolve a role to the site's point abbreviation for an asset type.
 *
 * Reads `data/seed/point-roles.json` (path supplied by site config). Falls back
 * to the file's `fallbackRules` when provided with point metadata, then returns
 * null when the role is not available at this site — never throws.
 */
export function resolveRoleAbbrev(
  pointRoles: PointRolesData,
  assetType: string,
  role: string,
  pointsMeta?: Record<string, { classification: string; unit: string; displayName: string }>,
): string | null {
  const abbr = pointRoles.byType[assetType]?.[role];
  if (abbr) return abbr;

  if (pointsMeta) {
    for (const rule of pointRoles.fallbackRules) {
      if (rule.role !== role) continue;
      for (const [abbreviation, meta] of Object.entries(pointsMeta)) {
        const classOk =
          rule.classificationContains === undefined ||
          meta.classification.toLowerCase().includes(rule.classificationContains.toLowerCase());
        const unitOk =
          rule.unitContains === undefined ||
          meta.unit.toLowerCase().includes(rule.unitContains.toLowerCase());
        const nameOk =
          rule.nameContains === undefined ||
          meta.displayName.toLowerCase().includes(rule.nameContains.toLowerCase());
        if (classOk && unitOk && nameOk) return abbreviation;
      }
    }
  }
  return null;
}

/** Parse a point-roles.json document. */
export function parsePointRoles(raw: unknown): PointRolesData {
  if (!raw || typeof raw !== 'object') return DEFAULT_POINT_ROLES;
  const doc = raw as Partial<PointRolesData>;
  return {
    byType: doc.byType ?? {},
    fallbackRules: doc.fallbackRules ?? [],
  };
}

/** Load `point-roles.json` from disk (uses the config-provided path). */
export function loadPointRoles(filePath: string): PointRolesData {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  return parsePointRoles(raw);
}

/** In-memory fallback (tests / dev). */
export const EMPTY_POINT_ROLES: PointRolesData = DEFAULT_POINT_ROLES;
