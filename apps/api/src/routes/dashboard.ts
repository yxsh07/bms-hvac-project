/**
 * Dashboard routes (§7.9): floor summaries, plant KPIs, controller health.
 * All three resolve points through roles, never through file names.
 */

import type { FastifyInstance } from 'fastify';
import { FloorSummaryResponseSchema, PlantKpisSchema, ControllerHealthSchema } from '@contracts';
import { controllerHealth, floorsSummary, plantKpis } from '../services/analytics.js';
import { notFound } from '../util/errors.js';
import { authenticate, parse, setCache, type RouteDeps } from './guards.js';

export function registerDashboardRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const ensureSite = (siteId: string): void => {
    if (siteId !== deps.config.siteId) throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
  };

  app.get<{ Params: { siteId: string }; Querystring: { window?: string } }>(
    '/sites/:siteId/floors/summary',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      setCache(reply, 'telemetry');
      const window = request.query.window ?? '1h';
      const body = await floorsSummary(deps.store, deps.ontology, deps.pointRoles, deps.config, window);
      return parse(FloorSummaryResponseSchema, body);
    },
  );

  app.get<{ Params: { siteId: string }; Querystring: { window?: string } }>(
    '/sites/:siteId/plant/kpis',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      setCache(reply, 'telemetry');
      const window = request.query.window ?? '1h';
      const body = await plantKpis(deps.store, deps.ontology, deps.pointRoles, deps.config, window);
      return parse(PlantKpisSchema, body);
    },
  );

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/controllers',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
    ensureSite(request.params.siteId);
    setCache(reply, 'telemetry');
    const body = await controllerHealth(deps.store, deps.ontology, deps.config);
    return body.map((item) => parse(ControllerHealthSchema, item));
  });
}
