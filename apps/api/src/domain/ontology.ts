/**
 * Bridges the ontology graph to the store's materialised assets and to the
 * set-point point resolver. All lookups are by role/ontology, never by raw site
 * abbreviations hardcoded in application code.
 */

import type { Ontology } from '@ontology';
import type { AssetRecord } from '../store/types.js';
import type { SetpointPointInfo } from '../services/setpoints.js';

/** Flatten an ontology graph into per-site asset records for joins/reports. */
export function materializeAssets(ontology: Ontology, siteId: string): AssetRecord[] {
  const controllerForAsset = new Map<string, string>();
  for (const controller of ontology.controllers) {
    for (const assetId of ontology.controllerAssets[controller.id] ?? []) {
      controllerForAsset.set(assetId, controller.id);
    }
  }

  return ontology.assets.map((asset) => ({
    siteId,
    id: asset.id,
    name: asset.name,
    type: asset.type,
    criticality: asset.criticality,
    zoneId: ontology.assetZone[asset.id],
    floorId: ontology.assetFloor[asset.id],
    controllerId: controllerForAsset.get(asset.id),
    points: (ontology.points[asset.id] ?? []).map((p) => ({
      abbr: p.abbr,
      display: p.display,
      unit: p.unit,
      group: p.group,
      cls: p.cls,
      source: p.source,
      writable: p.writable,
      safeMin: p.safeMin,
      safeMax: p.safeMax,
    })),
  }));
}

/** Build a resolver the set-point service uses to validate write requests. */
export function buildPointResolver(
  ontology: Ontology,
  defaultTolerance?: number,
): (siteId: string, assetId: string, field: string) => Promise<SetpointPointInfo | null> {
  const assetById = new Map(ontology.assets.map((a) => [a.id, a]));
  return async (_siteId, assetId, field) => {
    const asset = assetById.get(assetId);
    const point = (ontology.points[assetId] ?? []).find((p) => p.abbr === field);
    if (!asset || !point) return null;
    return {
      assetId,
      assetName: asset.name,
      field,
      display: point.display,
      unit: point.unit,
      writable: point.writable,
      safeMin: point.safeMin ?? Number.NEGATIVE_INFINITY,
      safeMax: point.safeMax ?? Number.POSITIVE_INFINITY,
      tolerance: defaultTolerance,
    };
  };
}

/** Map from source entity id to ontology asset id (identity by default). */
export function buildEntityToAsset(ontology: Ontology): Record<string, string> {
  const map: Record<string, string> = {};
  for (const asset of ontology.assets) {
    map[asset.id] = asset.id;
  }
  return map;
}
