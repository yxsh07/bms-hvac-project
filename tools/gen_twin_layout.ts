/**
 * tools/gen_twin_layout.ts
 *
 * Layout generator implementation (§5.10, ADR-002).
 * Produces a schematic TwinLayout from the site ontology when no
 * hand-authored twin-layout.json is present.
 *
 * Rules:
 *   - Always sets schematic: true.
 *   - Never throws; catches internal errors → { ok: false, error }.
 *   - Respects maxPlantNodes (default 400).
 *   - Plant node order: cooling-towers → condenser-pumps → chillers →
 *     chilled-water-pumps → headers.
 */

import type {
  GeneratorInput,
  GeneratorWarning,
  GeneratorResult,
  LayoutGenerator,
  OntologyAsset,
  Floor,
  Zone,
  Anchor,
  PlantNode,
  PlantEdge,
} from '../packages/twin-core/src/index.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Canonical ordering for plant schematic columns. */
const PLANT_TYPE_ORDER = [
  'cooling-tower',
  'condenser-pump',
  'chiller',
  'chilled-water-pump',
  'pump',
  'ahu',
  'fcu',
] as const;

/** Condenser-side types use 'condenser' medium; all others use 'chilled'. */
const CONDENSER_TYPES = new Set(['cooling-tower', 'condenser-pump']);

const PLANT_VB_W = 1600;
const PLANT_VB_H = 900;
const DEFAULT_FLOOR_SIZE = 100;
const DEFAULT_FLOOR_DEPTH = 60;

// ── Helpers ──────────────────────────────────────────────────────────────────

function typeIndex(type: string): number {
  const idx = (PLANT_TYPE_ORDER as readonly string[]).indexOf(type);
  return idx === -1 ? 999 : idx;
}

function mediumBetween(fromType: string, toType: string): 'chilled' | 'condenser' | 'other' {
  if (CONDENSER_TYPES.has(fromType) || CONDENSER_TYPES.has(toType)) return 'condenser';
  return 'chilled';
}

// ── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate a schematic TwinLayout from ontology assets and optional seed floors.
 * Falls back to a single floor when no floor info is provided.
 */
export async function generate(input: GeneratorInput): Promise<GeneratorResult> {
  try {
    const warnings: GeneratorWarning[] = [];
    const maxNodes = input.maxPlantNodes ?? 400;

    // ── Floors ─────────────────────────────────────────────────────────────
    const seedFloors =
      input.floors && input.floors.length > 0
        ? input.floors
        : [{ id: 'F00', name: 'Ground Floor', elevation: 0 }];

    // ── Group assets by floor → zone ───────────────────────────────────────
    const unlocated: string[] = [];
    const byFloor = new Map<string, OntologyAsset[]>();

    for (const asset of input.assets) {
      const fid = asset.floorId ?? seedFloors[0]!.id;
      if (!asset.floorId) unlocated.push(asset.id);
      const list = byFloor.get(fid);
      if (list) list.push(asset);
      else byFloor.set(fid, [asset]);
    }

    if (unlocated.length > 0) {
      warnings.push({
        code: 'UNLOCATED_ASSETS',
        message: `${unlocated.length} asset(s) had no floor; assigned to ${seedFloors[0]!.id}.`,
        assetIds: unlocated,
      });
    }

    // ── Build floors, zones, anchors ───────────────────────────────────────
    const floors: Floor[] = [];
    const zones: Zone[] = [];
    const anchors: Record<string, Anchor> = {};
    let zoneSeq = 0;

    for (const sf of seedFloors) {
      floors.push({
        id: sf.id,
        name: sf.name,
        elevation: sf.elevation,
        footprint: { w: DEFAULT_FLOOR_SIZE, h: DEFAULT_FLOOR_DEPTH },
        planImage: null,
      });

      const assets = byFloor.get(sf.id) ?? [];
      // Sub-group by zoneId (or a synthetic zone)
      const zoneMap = new Map<string, OntologyAsset[]>();
      for (const a of assets) {
        const zk = a.zoneId ?? `_auto_${sf.id}`;
        const list = zoneMap.get(zk);
        if (list) list.push(a);
        else zoneMap.set(zk, [a]);
      }

      const zoneColumns = Math.max(1, Math.ceil(Math.sqrt(zoneMap.size)));
      const zoneRows = Math.max(1, Math.ceil(zoneMap.size / zoneColumns));
      const zW = DEFAULT_FLOOR_SIZE / zoneColumns;
      const zH = DEFAULT_FLOOR_DEPTH / zoneRows;
      for (const [zoneIndex, [rawZid, zAssets]] of [...zoneMap.entries()].entries()) {
        zoneSeq++;
        const zid = rawZid.startsWith('_auto_') ? `Z${String(zoneSeq).padStart(2, '0')}` : rawZid;
        const zx = (zoneIndex % zoneColumns) * zW;
        const zy = Math.floor(zoneIndex / zoneColumns) * zH;

        zones.push({
          id: zid,
          floor: sf.id,
          rect: [zx, zy, zW, zH] as [number, number, number, number],
          spaceType: 'general',
        });

        const assetColumns = Math.max(1, Math.ceil(Math.sqrt(zAssets.length * zW / zH)));
        const assetRows = Math.max(1, Math.ceil(zAssets.length / assetColumns));
        for (const [assetIndex, asset] of zAssets.entries()) {
          const ax = zx + ((assetIndex % assetColumns) + 0.5) * zW / assetColumns;
          const ay = zy + (Math.floor(assetIndex / assetColumns) + 0.5) * zH / assetRows;
          anchors[asset.id] = { floor: sf.id, zone: zid, xy: [ax, ay] as [number, number] };
        }
      }
    }

    // ── Plant schematic ────────────────────────────────────────────────────
    const plantAssets = input.assets
      .slice(0, maxNodes)
      .sort((a, b) => typeIndex(a.type) - typeIndex(b.type));

    if (input.assets.length > maxNodes) {
      warnings.push({
        code: 'NODE_LIMIT_EXCEEDED',
        message: `Capped plant nodes to ${maxNodes} (${input.assets.length} total assets).`,
        assetIds: input.assets.slice(maxNodes).map((a) => a.id),
      });
    }

    const nodes: PlantNode[] = [];
    const edges: PlantEdge[] = [];
    const unknownTypes: string[] = [];

    // Column positions for each type
    const colSpacing = Math.floor(PLANT_VB_W / (PLANT_TYPE_ORDER.length + 1));
    const typeX = new Map<string, number>();
    PLANT_TYPE_ORDER.forEach((t, i) => typeX.set(t, colSpacing * (i + 1)));

    const typeRowY = new Map<string, number>();

    for (const asset of plantAssets) {
      if (typeIndex(asset.type) === 999) unknownTypes.push(asset.id);

      const x = typeX.get(asset.type) ?? PLANT_VB_W - 100;
      const y = typeRowY.get(asset.type) ?? 100;
      typeRowY.set(asset.type, y + 120);

      nodes.push({
        id: `pn-${asset.id}`,
        kind: 'equipment',
        assetId: asset.id,
        type: asset.type,
        xy: [x, y] as [number, number],
      } as PlantNode);
    }

    // Add supply/return header nodes
    const hdrY = PLANT_VB_H - 60;
    nodes.push({
      id: 'hdr-chw-supply',
      kind: 'header',
      label: 'CHW Supply',
      xy: [colSpacing * 4, hdrY] as [number, number],
      w: colSpacing * 2,
    } as PlantNode);
    nodes.push({
      id: 'hdr-chw-return',
      kind: 'header',
      label: 'CHW Return',
      xy: [colSpacing * 4, hdrY + 40] as [number, number],
      w: colSpacing * 2,
    } as PlantNode);

    // Type-adjacency edges
    let edgeSeq = 0;
    for (let i = 0; i < plantAssets.length - 1; i++) {
      const cur = plantAssets[i]!;
      const nxt = plantAssets[i + 1]!;
      const ci = typeIndex(cur.type);
      const ni = typeIndex(nxt.type);
      if (ci !== 999 && ni !== 999 && ni - ci === 1) {
        edgeSeq++;
        edges.push({
          id: `pe-${edgeSeq}`,
          from: `pn-${cur.id}`,
          to: `pn-${nxt.id}`,
          medium: mediumBetween(cur.type, nxt.type),
        });
      }
    }

    if (unknownTypes.length > 0) {
      warnings.push({
        code: 'UNKNOWN_ASSET_TYPE',
        message: `${unknownTypes.length} asset(s) have unrecognised types.`,
        assetIds: unknownTypes,
      });
    }

    return {
      ok: true,
      layout: {
        version: 1 as const,
        schematic: true,
        floors,
        zones,
        anchors,
        plant: {
          viewBox: [0, 0, PLANT_VB_W, PLANT_VB_H] as [number, number, number, number],
          nodes,
          edges,
        },
      },
      warnings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown generator error';
    return { ok: false, error: msg, warnings: [] };
  }
}

/** Exported generator conforming to the LayoutGenerator contract. */
export const twinLayoutGenerator: LayoutGenerator = { generate };
