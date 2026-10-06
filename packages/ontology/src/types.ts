/**
 * Ontology type definitions (§7.3)
 *
 * Nodes: Site, Floor, Zone, Asset, Point, Controller, Meter
 * Edges: HAS_ASSET, ON_FLOOR (empty per DEC-9), IN_ZONE, HAS_POINT,
 *        MONITORS (controller → asset), METERED_BY
 *
 * All IDs are strings, never integers.
 */

// ── Node types ────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  timezone: string;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
}

export interface Zone {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * A BMS measurement or control point on an asset.
 *
 * - `abbr`    Short identifier used in telemetry (e.g. "CHWST").
 * - `display` Human-readable name.
 * - `unit`    Engineering unit string (e.g. "°C", "kW", "%").
 * - `group`   Logical grouping for UI panels.
 * - `cls`     Classification used for fallback role resolution.
 * - `source`  Origin tag (e.g. "modbus", "bacnet", "calculated").
 * - `writable` True when this point accepts setpoint writes.
 * - `safeMin` / `safeMax` — optional operational safety limits.
 */
export interface Point {
  abbr: string;
  display: string;
  unit: string;
  group: string;
  cls: string;
  source: string;
  writable: boolean;
  safeMin?: number;
  safeMax?: number;
}

export interface Controller {
  id: string;
  name: string;
  deviceId: string;
}

export interface Meter {
  deviceId: string;
  name: string;
  model: string;
}

// ── Graph (assembled ontology) ────────────────────────────────────────────────

/**
 * The fully-assembled ontology graph for a single site.
 *
 * Edges are represented as plain record lookups rather than graph traversal
 * objects so consumers can use simple property access without a graph library.
 */
export interface Ontology {
  site: Site;
  floors: Floor[];
  zones: Zone[];
  assets: Asset[];
  /** HAS_POINT edges: assetId → ordered list of points */
  points: Record<string, Point[]>;
  controllers: Controller[];
  meters: Meter[];
  /** IN_ZONE edges: assetId → zoneId */
  assetZone: Record<string, string>;
  /**
   * ON_FLOOR edges: assetId → floorId.
   * Empty in the current client model (DEC-9) — always check before use.
   */
  assetFloor: Record<string, string>;
  /** MONITORS edges: controllerId → assetIds */
  controllerAssets: Record<string, string[]>;
}
