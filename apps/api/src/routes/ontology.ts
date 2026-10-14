/**
 * Ontology / asset routes (§7.9).
 *
 * The graph loaded by `packages-ontology` is flattened into the wire contracts
 * shape. `cls` is projected onto the contract's `PointClass` enum; the richer
 * semantic classification stays available through `group`/role resolution.
 */

import type { FastifyInstance } from 'fastify';
import {
  PointRolesSchema,
  type Asset as ContractAsset,
  type AssetSummary,
  type Floor,
  type Ontology as ContractOntology,
  type Point as ContractPoint,
  type PointClass,
  type Site as ContractSite,
  type Zone,
} from '@contracts';
import type { Ontology as GraphOntology } from '@ontology';
import { classifyPoint, type PointClassification } from '../domain/classify.js';
import { notFound } from '../util/errors.js';
import { setCache, authenticate, parse, type RouteDeps } from './guards.js';

function toPointClass(classification: PointClassification): PointClass {
  const map: Record<PointClassification, PointClass> = {
    Temperature: 'Temperature',
    Humidity: 'Other',
    Pressure: 'Pressure',
    'Flow Sensor': 'Flow',
    Power: 'Power',
    Energy: 'Energy',
    Voltage: 'Other',
    Current: 'Other',
    Frequency: 'Other',
    'Power Factor': 'Other',
    Status: 'Status',
    Setpoint: 'Setpoint',
    Actuator: 'Other',
    Other: 'Other',
  };
  return map[classification];
}

function toContractPoint(point: GraphOntology['points'][string][number]): ContractPoint {
  const classification = classifyPoint({ cls: point.cls, unit: point.unit });
  const projected: ContractPoint = {
    abbr: point.abbr,
    display: point.display,
    unit: point.unit,
    group: point.group,
    cls: toPointClass(classification),
    source: point.source,
    writable: point.writable,
  };
  if (point.safeMin !== undefined) projected.safeMin = point.safeMin;
  if (point.safeMax !== undefined) projected.safeMax = point.safeMax;
  return projected;
}

/** Flatten the graph into the contract's `Site`/`Ontology` shape. */
export function toContractOntology(graph: GraphOntology): ContractOntology {
  const controllers = Object.fromEntries(graph.controllers.map((c) => [c.id, c]));
  const meters = Object.fromEntries(graph.meters.map((m) => [m.deviceId, m]));

  const controllerForAsset = new Map<string, string>();
  for (const controller of graph.controllers) {
    for (const assetId of graph.controllerAssets[controller.id] ?? []) {
      controllerForAsset.set(assetId, controller.id);
    }
  }

  const zonesByFloor = new Map<string, Set<string>>();
  for (const asset of graph.assets) {
    const floorId = graph.assetFloor[asset.id];
    const zoneId = graph.assetZone[asset.id];
    if (floorId && zoneId) {
      const set = zonesByFloor.get(floorId) ?? new Set<string>();
      set.add(zoneId);
      zonesByFloor.set(floorId, set);
    }
  }

  const floors: Floor[] = graph.floors.map((floor) => {
    const zoneIds = zonesByFloor.get(floor.id) ?? new Set<string>();
    const zones: Zone[] = graph.zones
      .filter((z) => zoneIds.has(z.id))
      .map((z) => ({
        id: z.id,
        name: z.name,
        assetIds: graph.assets
          .filter((a) => graph.assetFloor[a.id] === floor.id && graph.assetZone[a.id] === z.id)
          .map((a) => a.id),
      }));
    return { id: floor.id, name: floor.name, level: floor.level, zones };
  });

  const assetSummary = (asset: GraphOntology['assets'][number]): AssetSummary => {
    const summary: AssetSummary = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      criticality: asset.criticality,
    };
    const controllerId = controllerForAsset.get(asset.id);
    if (controllerId) summary.controllerId = controllerId;
    return summary;
  };

  const site: ContractSite = {
    id: graph.site.id,
    name: graph.site.name,
    timezone: graph.site.timezone,
    floors,
    // ON_FLOOR is mostly empty (DEC-9): top-level assets are those without a floor.
    assets: graph.assets.filter((a) => !graph.assetFloor[a.id]).map(assetSummary),
    controllers: graph.controllers,
    meters: graph.meters,
  };

  return { site, controllers, meters };
}

function toContractAsset(
  graph: GraphOntology,
  asset: GraphOntology['assets'][number],
  controllerId: string | undefined,
): ContractAsset {
  const result: ContractAsset = {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    criticality: asset.criticality,
    points: (graph.points[asset.id] ?? []).map(toContractPoint),
  };
  if (controllerId) result.controllerId = controllerId;
  return result;
}

export function registerOntologyRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const graph = deps.ontology;

  const controllerForAsset = new Map<string, string>();
  for (const controller of graph.controllers) {
    for (const assetId of graph.controllerAssets[controller.id] ?? []) {
      controllerForAsset.set(assetId, controller.id);
    }
  }

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/ontology',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
    ensureSite(deps, request.params.siteId);
    setCache(reply, 'ontology');
    return toContractOntology(graph);
  });

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/point-roles',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      ensureSite(deps, request.params.siteId);
      setCache(reply, 'ontology');
      return parse(PointRolesSchema, deps.pointRoles);
    },
  );

  app.get<{ Params: { siteId: string }; Querystring: { type?: string; zone?: string } }>(
    '/sites/:siteId/assets',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      ensureSite(deps, request.params.siteId);
      setCache(reply, 'ontology');
      const { type, zone } = request.query;
      return graph.assets
        .filter((a) => (!type || a.type === type) && (!zone || graph.assetZone[a.id] === zone))
        .map((asset) => {
          const summary: AssetSummary = {
            id: asset.id,
            name: asset.name,
            type: asset.type,
            criticality: asset.criticality,
          };
          const controllerId = controllerForAsset.get(asset.id);
          if (controllerId) summary.controllerId = controllerId;
          return summary;
        });
    },
  );

  app.get<{ Params: { siteId: string; assetId: string } }>(
    '/sites/:siteId/assets/:assetId',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      ensureSite(deps, request.params.siteId);
      const asset = graph.assets.find((a) => a.id === request.params.assetId);
      if (!asset) throw notFound('ASSET_NOT_FOUND', `Asset ${request.params.assetId} not found`);
      setCache(reply, 'ontology');
      return toContractAsset(graph, asset, controllerForAsset.get(asset.id));
    },
  );
}

function ensureSite(deps: RouteDeps, siteId: string): void {
  if (siteId !== deps.config.siteId) throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
}
