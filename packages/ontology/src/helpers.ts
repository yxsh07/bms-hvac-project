/**
 * Query helpers for the Ontology graph.
 *
 * All functions are pure (no I/O, no mutation) and return undefined / []
 * rather than throwing when a node is not found, making them safe to call in
 * hot rendering paths.
 */

import type { Asset, Ontology, Point } from './types.js';

// ── Single-node lookups ───────────────────────────────────────────────────────

/**
 * Find an asset by its ID.
 * Returns `undefined` if the asset is not in the ontology.
 */
export function findAsset(ontology: Ontology, assetId: string): Asset | undefined {
  return ontology.assets.find((a) => a.id === assetId);
}

/**
 * Find a specific point on an asset by point abbreviation.
 * Returns `undefined` if the asset or point does not exist.
 */
export function findPoint(
  ontology: Ontology,
  assetId: string,
  abbr: string,
): Point | undefined {
  return ontology.points[assetId]?.find((p) => p.abbr === abbr);
}

// ── Multi-node queries ────────────────────────────────────────────────────────

/**
 * Return all assets of a given type (case-sensitive).
 */
export function getAssetsByType(ontology: Ontology, type: string): Asset[] {
  return ontology.assets.filter((a) => a.type === type);
}

/**
 * Return all assets that belong to a given zone (via IN_ZONE edge).
 */
export function getAssetsByZone(ontology: Ontology, zoneId: string): Asset[] {
  return ontology.assets.filter((a) => ontology.assetZone[a.id] === zoneId);
}

/**
 * Return all writable points for an asset.
 * Returns an empty array when the asset has no points.
 */
export function getWritablePoints(ontology: Ontology, assetId: string): Point[] {
  return (ontology.points[assetId] ?? []).filter((p) => p.writable);
}

// ── Graph traversal ───────────────────────────────────────────────────────────

/**
 * Return the full blast radius of a controller: every asset it monitors.
 *
 * The "blast radius" is the set of assets that would be affected if the
 * controller goes offline — used for criticality assessment (§5.1).
 *
 * Returns an empty array when the controller is not found or monitors no assets.
 */
export function getControllerBlastRadius(
  ontology: Ontology,
  controllerId: string,
): Asset[] {
  const assetIds = ontology.controllerAssets[controllerId] ?? [];
  return assetIds.flatMap((id) => {
    const asset = findAsset(ontology, id);
    return asset ? [asset] : [];
  });
}
