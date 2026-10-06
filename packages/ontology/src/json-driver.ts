/**
 * JsonOntologyDriver — loads and assembles the Ontology graph from a JSON file.
 *
 * JSON schema (raw shape):
 * {
 *   site: Site,
 *   floors: Floor[],
 *   zones: Zone[],
 *   assets: Array<Asset & { zoneId: string; floorId?: string; points: Point[] }>,
 *   controllers: Array<Controller & { assetIds: string[] }>,
 *   meters: Meter[],
 * }
 *
 * DEC-9: ON_FLOOR edges (assetFloor) are optional. When floorId is absent on an
 * asset record the edge is simply omitted from the assembled graph — never an
 * error.
 */

import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { OntologyDriver } from './driver.js';
import type { Ontology } from './types.js';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const SiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
});

const FloorSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int(),
});

const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const PointSchema = z.object({
  abbr: z.string(),
  display: z.string(),
  unit: z.string(),
  group: z.string(),
  cls: z.string(),
  source: z.string(),
  writable: z.boolean(),
  safeMin: z.number().optional(),
  safeMax: z.number().optional(),
});

const AssetRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  criticality: z.enum(['critical', 'high', 'medium', 'low']),
  zoneId: z.string(),
  floorId: z.string().optional(),
  points: z.array(PointSchema),
});

const ControllerRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  deviceId: z.string(),
  assetIds: z.array(z.string()),
});

const MeterSchema = z.object({
  deviceId: z.string(),
  name: z.string(),
  model: z.string(),
});

const OntologyFileSchema = z.object({
  site: SiteSchema,
  floors: z.array(FloorSchema),
  zones: z.array(ZoneSchema),
  assets: z.array(AssetRecordSchema),
  controllers: z.array(ControllerRecordSchema),
  meters: z.array(MeterSchema).default([]),
});

type OntologyFile = z.infer<typeof OntologyFileSchema>;

// ── Driver ────────────────────────────────────────────────────────────────────

export class JsonOntologyDriver implements OntologyDriver {
  constructor(private readonly filePath: string) {}

  /**
   * Load the ontology JSON from disk, validate it, and assemble the graph.
   *
   * @param siteId  Expected site ID; validated against `site.id` in the file.
   * @throws        If the file cannot be read, is invalid JSON, fails schema
   *                validation, or the site ID does not match.
   */
  async load(siteId: string): Promise<Ontology> {
    const raw = await readFile(this.filePath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`JsonOntologyDriver: invalid JSON in ${this.filePath}: ${String(err)}`);
    }

    const result = OntologyFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `JsonOntologyDriver: schema validation failed for ${this.filePath}: ${result.error.message}`,
      );
    }

    const file: OntologyFile = result.data;

    if (file.site.id !== siteId) {
      throw new Error(
        `JsonOntologyDriver: site ID mismatch — expected "${siteId}", got "${file.site.id}"`,
      );
    }

    return assembleGraph(file);
  }
}

// ── Graph assembly ────────────────────────────────────────────────────────────

function assembleGraph(file: OntologyFile): Ontology {
  const assets = file.assets.map(({ id, name, type, criticality }) => ({
    id,
    name,
    type,
    criticality,
  }));

  const points: Record<string, z.infer<typeof PointSchema>[]> = {};
  const assetZone: Record<string, string> = {};
  const assetFloor: Record<string, string> = {};

  for (const record of file.assets) {
    points[record.id] = record.points;
    assetZone[record.id] = record.zoneId;
    // ON_FLOOR is optional (DEC-9); omit the edge when floorId is absent
    if (record.floorId !== undefined && record.floorId !== '') {
      assetFloor[record.id] = record.floorId;
    }
  }

  const controllers = file.controllers.map(({ id, name, deviceId }) => ({
    id,
    name,
    deviceId,
  }));

  const controllerAssets: Record<string, string[]> = {};
  for (const record of file.controllers) {
    controllerAssets[record.id] = record.assetIds;
  }

  return {
    site: file.site,
    floors: file.floors,
    zones: file.zones,
    assets,
    points,
    controllers,
    meters: file.meters,
    assetZone,
    assetFloor,
    controllerAssets,
  };
}
