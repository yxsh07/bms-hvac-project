/**
 * Set-point routes (§7.9, §7.6).
 *
 * Propose / approve / reject all require an `Idempotency-Key`; every transition
 * is audited inside the service. The one-live-request rule surfaces as a 409
 * with the existing request id.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ApproveSetpointSchema,
  ProposeSetpointSchema,
  RejectSetpointSchema,
  SetpointListQuerySchema,
  SetpointListResponseSchema,
  type SetpointRequest,
  type WritablePoint,
} from '@contracts';
import { Actions } from '../auth/rbac.js';
import { toSetpointRequest, type Actor } from '../services/setpoints.js';
import { notFound } from '../util/errors.js';
import {
  authenticate,
  authorize,
  parse,
  requireIdempotency,
  setCache,
  type RouteDeps,
} from './guards.js';

function actorOf(_deps: RouteDeps, request: FastifyRequest): Actor {
  const user = request.authUser!;
  return {
    id: user.id,
    email: user.email,
    ip: request.ip,
    device: request.headers['user-agent'] ?? null,
  };
}

export function registerSetpointRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const ensureSite = (siteId: string): void => {
    if (siteId !== deps.config.siteId) throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
  };

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/setpoints',
    {
      preHandler: [authenticate(deps), authorize(deps, Actions.setpointsRead)],
    },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      setCache(reply, 'no-store');
      const points: WritablePoint[] = [];
      for (const asset of deps.ontology.assets) {
        for (const point of deps.ontology.points[asset.id] ?? []) {
          if (!point.writable) continue;
          const latest = await deps.store.latest(request.params.siteId, asset.id);
          const live = await deps.store.findLiveSetpoint(
            request.params.siteId,
            asset.id,
            point.abbr,
          );
          points.push({
            assetId: asset.id,
            assetName: asset.name,
            field: point.abbr,
            display: point.display,
            unit: point.unit,
            safeMin: point.safeMin ?? 0,
            safeMax: point.safeMax ?? 0,
            currentValue: latest[point.abbr]?.value ?? null,
            liveRequest: live ? (toSetpointRequest(live) as SetpointRequest) : null,
          });
        }
      }
      return points;
    },
  );

  const listHandler = (siteIdFrom: 'param' | 'query') =>
    async (request: any, reply: any) => {
      const siteId = siteIdFrom === 'param' ? request.params.siteId : undefined;
      if (siteId) ensureSite(siteId);
      setCache(reply, 'no-store');
      const query = parse(SetpointListQuerySchema, request.query ?? {});
      const page = await deps.store.listSetpoints({
        siteId: siteId ?? undefined,
        state: query.state,
        assetId: query.assetId,
        limit: query.limit,
        cursor: query.cursor,
      });
      return parse(SetpointListResponseSchema, {
        items: page.items.map(toSetpointRequest),
        nextCursor: page.nextCursor,
      });
    };

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/setpoint-requests',
    { preHandler: [authenticate(deps), authorize(deps, Actions.setpointsRead)] },
    listHandler('param'),
  );
  app.get(
    '/setpoint-requests',
    { preHandler: [authenticate(deps), authorize(deps, Actions.setpointsRead)] },
    listHandler('query'),
  );

  app.post<{ Params: { siteId: string; assetId: string; field: string } }>(
    '/sites/:siteId/setpoints/:assetId/:field',
    { preHandler: [authenticate(deps), authorize(deps, Actions.setpointsPropose)] },
    async (request) => {
      ensureSite(request.params.siteId);
      requireIdempotency(request);
      const body = parse(ProposeSetpointSchema, request.body ?? {});
      const record = await deps.setpoints.propose(
        actorOf(deps, request),
        request.params.siteId,
        request.params.assetId,
        request.params.field,
        body,
      );
      return toSetpointRequest(record);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/setpoint-requests/:id/approve',
    { preHandler: [authenticate(deps), authorize(deps, Actions.setpointsApprove)] },
    async (request) => {
      requireIdempotency(request);
      parse(ApproveSetpointSchema, request.body ?? {});
      const record = await deps.setpoints.approve(actorOf(deps, request), request.params.id);
      return toSetpointRequest(record);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/setpoint-requests/:id/reject',
    { preHandler: [authenticate(deps), authorize(deps, Actions.setpointsApprove)] },
    async (request) => {
      requireIdempotency(request);
      const body = parse(RejectSetpointSchema, request.body ?? {});
      const record = await deps.setpoints.reject(
        actorOf(deps, request),
        request.params.id,
        body.reason,
      );
      return toSetpointRequest(record);
    },
  );
}
