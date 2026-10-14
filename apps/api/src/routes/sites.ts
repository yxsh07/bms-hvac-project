/**
 * `/me` and site routes (§7.9).
 */

import type { FastifyInstance } from 'fastify';
import { MeResponseSchema, SiteDetailSchema, type MeResponse, type SiteSummary } from '@contracts';
import { permissionsFor } from '../auth/rbac.js';
import { notFound } from '../util/errors.js';
import { authenticate, parse, setCache, type RouteDeps } from './guards.js';

export function registerSiteRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get(
    '/me',
    { preHandler: [authenticate(deps)] },
    async (request) => {
    const user = request.authUser!;
    const role = Object.values(user.roles)[0];
    const body: MeResponse & { permissions: string[] } = {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      siteIds: user.siteIds,
      permissions: role ? permissionsFor(role) : [],
    };
    return parse(MeResponseSchema, body);
  });

  app.get('/sites', { preHandler: [authenticate(deps)] }, async (request) => {
    const user = request.authUser!;
    const known: SiteSummary = {
      id: deps.config.siteId,
      name: deps.config.name,
      timezone: deps.config.timezone,
    };
    return user.siteIds.includes(known.id) ? [known] : [];
  });

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      const { siteId } = request.params;
      if (siteId !== deps.config.siteId) {
        throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
      }
      const environment = await readEnvironment(deps);
      setCache(reply, 'no-store');
      return parse(SiteDetailSchema, {
        id: deps.config.siteId,
        name: deps.config.name,
        timezone: deps.config.timezone,
        ...(environment ? { environment } : {}),
      });
    },
  );
}

async function readEnvironment(
  deps: RouteDeps,
): Promise<{ dryBulbTemp: number | null; relativeHumidity: number | null } | undefined> {
  if (deps.config.telemetry.driver !== 'sim-http' || !deps.config.telemetry.url) return undefined;
  try {
    const response = await fetch(`${deps.config.telemetry.url.replace(/\/$/, '')}/sim/state`, {
      signal: AbortSignal.timeout(1500), cache: 'no-store',
    });
    if (!response.ok) return undefined;
    const state = await response.json() as { outdoorDbtC?: unknown; relativeHumidityPct?: unknown };
    if (typeof state.outdoorDbtC !== 'number' || typeof state.relativeHumidityPct !== 'number') return undefined;
    return { dryBulbTemp: state.outdoorDbtC, relativeHumidity: state.relativeHumidityPct };
  } catch { return undefined; }
}
