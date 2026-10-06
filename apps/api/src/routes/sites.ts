/**
 * `/me` and site routes (§7.9).
 */

import type { FastifyInstance } from 'fastify';
import { MeResponseSchema, type MeResponse, type SiteSummary } from '@contracts';
import { permissionsFor } from '../auth/rbac.js';
import { notFound } from '../util/errors.js';
import { authenticate, parse, type RouteDeps } from './guards.js';

export interface SiteSummaryWithEnvironment extends SiteSummary {
  environment?: { dryBulbTemp: number | null; relativeHumidity: number | null };
}

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
    async (request) => {
      const { siteId } = request.params;
      if (siteId !== deps.config.siteId) {
        throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
      }
      const environment = await readEnvironment(deps);
      const body: SiteSummaryWithEnvironment = {
        id: deps.config.siteId,
        name: deps.config.name,
        timezone: deps.config.timezone,
        ...(environment ? { environment } : {}),
      };
      return body;
    },
  );
}

async function readEnvironment(
  deps: RouteDeps,
): Promise<{ dryBulbTemp: number | null; relativeHumidity: number | null } | undefined> {
  // Best-effort: read the site's calculated environment dashboard via roles.
  for (const asset of deps.ontology.assets) {
    const temp = deps.ontology.points[asset.id]?.find(
      (p) => p.cls === 'area-temp' || p.cls === 'supply-air-temp',
    );
    const humidity = deps.ontology.points[asset.id]?.find((p) => p.cls === 'area-humidity');
    if (temp && humidity) {
      const latest = await deps.store.latest(deps.config.siteId, asset.id);
      const t = latest[temp.abbr];
      const h = latest[humidity.abbr];
      if (t || h) {
        return {
          dryBulbTemp: t?.quality === 0 ? t.value : null,
          relativeHumidity: h?.quality === 0 ? h.value : null,
        };
      }
    }
  }
  return undefined;
}
