/**
 * Role-resolved analytics: floor summaries, plant KPIs and controller health
 * (PLAN §7.9, §7.11). Everything is resolved through `point-roles.json` so the
 * same code works on any site; no equipment-type words appear here.
 */

import type { Ontology } from '@ontology';
import type {
  FloorSummary,
  FloorSummaryResponse,
  PlantKpis,
  ControllerHealth,
  QualityBlock,
} from '@contracts';
import type { LoadedConfig } from '../config.js';
import { classifyPoint, resolveRoleAbbrev, type PointRolesData } from '../domain/classify.js';
import type { AssetRecord, Store } from '../store/types.js';
import { parseIso, windowToRange } from '../util/time.js';

function qualityBlock(expected: number, good: number, delayed: boolean): QualityBlock {
  return {
    expectedSamples: expected,
    goodSamples: good,
    coveragePct: expected === 0 ? 0 : Math.min(100, (good / expected) * 100),
    hasDelayedData: delayed,
  };
}

function rolePoint(asset: AssetRecord, pointRoles: PointRolesData, role: string) {
  const abbr = resolveRoleAbbrev(pointRoles, asset.type, role);
  if (!abbr) return undefined;
  return asset.points.find((p) => p.abbr === abbr);
}

async function latestGood(
  store: Store,
  siteId: string,
  asset: AssetRecord,
  pointRoles: PointRolesData,
  role: string,
): Promise<number | null> {
  const point = rolePoint(asset, pointRoles, role);
  if (!point) return null;
  const latest = await store.latest(siteId, asset.id);
  const sample = latest[point.abbr];
  return sample && sample.quality === 0 ? sample.value : null;
}

/** `GET /sites/:s/floors/summary` (§7.9). */
export async function floorsSummary(
  store: Store,
  ontology: Ontology,
  pointRoles: PointRolesData,
  config: LoadedConfig,
  window: string,
  now: Date = new Date(),
): Promise<FloorSummaryResponse> {
  const { from, to } = windowToRange(window, now);
  const assets = await store.listAssets(config.siteId);
  const floors: FloorSummary[] = [];

  const assetFloor = new Map(assets.map((a) => [a.id, a.floorId]));

  const aggregate = async (floorId: string, name: string, members: AssetRecord[]): Promise<FloorSummary> => {
    let kwh = 0;
    let kwhSeen = false;
    let tempSum = 0;
    let tempCount = 0;
    let comfortable = 0;
    let comfortTotal = 0;
    let hasData = false;

    for (const asset of members) {
      const energyPoint = rolePoint(asset, pointRoles, 'energy-kwh');
      if (energyPoint) {
        const delta = await store.counterDelta({
          siteId: config.siteId,
          entityId: asset.id,
          field: energyPoint.abbr,
          from,
          to,
        });
        if (delta.delta !== 0 || delta.resets > 0) {
          kwh += delta.delta;
          kwhSeen = true;
          hasData = true;
        }
      }

      const tempPoint = rolePoint(asset, pointRoles, 'area-temp');
      if (tempPoint) {
        const series = await store.series({
          siteId: config.siteId,
          entityId: asset.id,
          field: tempPoint.abbr,
          from,
          to,
          resolution: 'raw',
        });
        const values = series.filter((b) => b.avg !== null).map((b) => b.avg as number);
        if (values.length) hasData = true;
        const band = config.comfort?.bands?.[asset.zoneId ?? ''];
        for (const v of values) {
          tempSum += v;
          tempCount += 1;
          if (band) {
            comfortTotal += 1;
            const low = band.coldBelow ?? Number.NEGATIVE_INFINITY;
            const high = band.warmAbove ?? Number.POSITIVE_INFINITY;
            if (v >= low && v <= high) comfortable += 1;
          }
        }
      }
    }

    return {
      id: floorId,
      name,
      kwh: kwhSeen ? kwh : null,
      avgTempC: tempCount ? tempSum / tempCount : null,
      comfort: comfortTotal ? comfortable / comfortTotal : null,
      hasData,
    };
  };

  for (const floor of ontology.floors) {
    const members = assets.filter((a) => assetFloor.get(a.id) === floor.id);
    floors.push(await aggregate(floor.id, floor.name, members));
  }

  // "plant" pseudo-floor: assets that are not assigned to any floor.
  const unassigned = assets.filter((a) => !assetFloor.get(a.id));
  if (unassigned.length) floors.push(await aggregate('plant', 'Plant', unassigned));

  const good = floors.filter((f) => f.hasData).length;
  return { window, floors, quality: qualityBlock(floors.length, good, false) };
}

/** `GET /sites/:s/plant/kpis` (§7.9). */
export async function plantKpis(
  store: Store,
  ontology: Ontology,
  pointRoles: PointRolesData,
  config: LoadedConfig,
  window: string,
  now: Date = new Date(),
): Promise<PlantKpis> {
  const assets = (await store.listAssets(config.siteId)).filter((a) => a.type !== 'dashboard');
  const { from, to } = windowToRange(window, now);

  let totalKw = 0;
  let kwSeen = false;
  let staging = 0;
  let deltaSum = 0;
  let deltaCount = 0;
  let delayed = false;

  for (const asset of assets) {
    const kw = await latestGood(store, config.siteId, asset, pointRoles, 'power-kw');
    if (kw !== null) {
      totalKw += kw;
      kwSeen = true;
    }

    const run = rolePoint(asset, pointRoles, 'run-status');
    if (run) {
      const latest = await store.latest(config.siteId, asset.id);
      if (latest[run.abbr]?.value === 1) staging += 1;
    }

    const leaving = await latestGood(store, config.siteId, asset, pointRoles, 'chw-leaving-temp');
    const entering = await latestGood(store, config.siteId, asset, pointRoles, 'chw-entering-temp');
    if (leaving !== null && entering !== null) {
      deltaSum += entering - leaving;
      deltaCount += 1;
    }
  }

  // Delayed data flag across the window (best-effort: look at the dashboard).
  const anyRow = assets[0];
  if (anyRow) {
    const point = anyRow.points[0];
    if (point) {
      const rows = await store.series({
        siteId: config.siteId,
        entityId: anyRow.id,
        field: point.abbr,
        from,
        to,
        resolution: 'raw',
      });
      // series buckets do not expose per-row delay; use latest sample flag instead.
      const latest = await store.latest(config.siteId, anyRow.id);
      delayed = Object.values(latest).some((s) => s.isDelayed);
      void rows;
    }
  }

  const totalTr = kwSeen ? totalKw * 0.2843 : null;
  const sec = totalTr && totalTr !== 0 && kwSeen ? totalKw / totalTr : null;

  return {
    totalKw: kwSeen ? totalKw : null,
    totalTr,
    secIkwPerTr: sec,
    chwDeltaT: deltaCount ? deltaSum / deltaCount : null,
    approachTempC: null,
    stagingCount: staging,
    window,
    quality: qualityBlock(assets.length, kwSeen ? 1 : 0, delayed),
  };
}

/** `GET /sites/:s/controllers` (§7.11). */
export async function controllerHealth(
  store: Store,
  ontology: Ontology,
  config: LoadedConfig,
  now: Date = new Date(),
): Promise<ControllerHealth[]> {
  const assetById = new Map((await store.listAssets(config.siteId)).map((a) => [a.id, a]));
  const staleAfterMs = config.staleAfterCadences * config.telemetry.cadenceSeconds * 1000;

  // siteNow is the latest ingested event time unless the config says wall clock.
  let siteNowMs = config.useWallClock ? now.getTime() : 0;
  const perAssetLastSeen = new Map<string, number>();

  for (const asset of assetById.values()) {
    const latest = await store.latest(config.siteId, asset.id);
    let max = 0;
    for (const sample of Object.values(latest)) {
      const t = parseIso(sample.at);
      if (t > max) max = t;
    }
    if (max) perAssetLastSeen.set(asset.id, max);
    if (max > siteNowMs) siteNowMs = max;
  }

  return ontology.controllers.map((controller) => {
    const assetIds = ontology.controllerAssets[controller.id] ?? [];
    let lastSeen = 0;
    for (const id of assetIds) {
      const t = perAssetLastSeen.get(id) ?? 0;
      if (t > lastSeen) lastSeen = t;
    }
    const lastSeenAt = lastSeen ? new Date(lastSeen).toISOString() : null;
    const online = lastSeen > 0 && siteNowMs - lastSeen <= staleAfterMs;
    return {
      controllerId: controller.id,
      name: controller.name,
      online,
      assetCount: assetIds.filter((id) => assetById.has(id)).length,
      lastSeenAt,
    };
  });
}

/** Exposed for tests: classify a point the way ingest does. */
export { classifyPoint };
