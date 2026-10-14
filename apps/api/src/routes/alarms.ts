/**
 * Alarm routes (§7.9, §7.7). Read is available to all roles; acknowledging is
 * denied to executive (and the denial is audited by `authorize`).
 */

import type { FastifyInstance } from 'fastify';
import {
  AckAlarmRequestSchema,
  AlarmListQuerySchema,
  AlarmListResponseSchema,
  type Alarm,
} from '@contracts';
import { Actions } from '../auth/rbac.js';
import { notFound } from '../util/errors.js';
import { authenticate, authorize, parse, setCache, type RouteDeps } from './guards.js';

export function registerAlarmRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const ensureSite = (siteId: string): void => {
    if (siteId !== deps.config.siteId) throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
  };

  app.get<{
    Params: { siteId: string };
    Querystring: { status?: string; severity?: string; assetId?: string; limit?: string };
  }>(
    '/sites/:siteId/alarms',
    { preHandler: [authenticate(deps), authorize(deps, Actions.alarmsRead)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      setCache(reply, 'no-store');
      const query = parse(AlarmListQuerySchema, request.query ?? {});
      const page = await deps.store.listAlarms(request.params.siteId, query);
      const active = page.items.filter((a) => a.status === 'active' || a.status === 'cleared_unacknowledged');
      return parse(AlarmListResponseSchema, {
        items: page.items as Alarm[],
        nextCursor: page.nextCursor,
        activeCount: active.length,
      });
    },
  );

  app.post<{ Params: { siteId: string; id: string } }>(
    '/sites/:siteId/alarms/:id/ack',
    { preHandler: [authenticate(deps), authorize(deps, Actions.alarmsAcknowledge)] },
    async (request) => {
      ensureSite(request.params.siteId);
      const body = parse(AckAlarmRequestSchema, request.body ?? {});
      const alarm = await deps.store.getAlarm(request.params.id);
      if (!alarm || alarm.siteId !== request.params.siteId) {
        throw notFound('ALARM_NOT_FOUND', `Alarm ${request.params.id} not found`);
      }
      const updated = await deps.store.updateAlarm(request.params.id, {
        status: alarm.clearedAt ? 'cleared' : 'acknowledged',
        acknowledgedBy: request.authUser!.id,
        acknowledgedAt: deps.clock(),
        acknowledgeNote: body.note ?? null,
      });
      if (updated) request.auditChange = {
        siteId: request.params.siteId,
        eventType: 'alarm.acknowledged',
        resource: `alarm:${alarm.id}`,
        before: alarm,
        after: updated,
      };
      return updated ?? alarm;
    },
  );
}
