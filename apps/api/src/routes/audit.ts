/**
 * Audit routes (§7.8, §7.9): query, signed export, chain verification.
 * Audit export is itself audited (no weaker for admin — §7.7).
 */

import type { FastifyInstance } from 'fastify';
import {
  AuditExportQuerySchema,
  AuditQuerySchema,
  AuditListResponseSchema,
  AuditVerifyResponseSchema,
  type AuditLogEntry,
} from '@contracts';
import { Actions } from '../auth/rbac.js';
import { notFound } from '../util/errors.js';
import { authenticate, authorize, parse, setCache, type RouteDeps } from './guards.js';

function toCsv(entries: AuditLogEntry[]): string {
  const header = 'seq,occurredAt,eventType,actorEmail,resource,action,justification,approverId,signature';
  const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = entries.map((e) =>
    [
      e.seq,
      e.occurredAt,
      e.eventType,
      e.actorEmail,
      e.resource,
      e.action,
      e.justification,
      e.approverId,
      e.signature,
    ]
      .map(escape)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function registerAuditRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const ensureSite = (siteId: string): void => {
    if (siteId !== deps.config.siteId) throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
  };

  app.get<{
    Params: { siteId: string };
    Querystring: { eventType?: string; actorId?: string; limit?: string; cursor?: string };
  }>(
    '/sites/:siteId/audit',
    { preHandler: [authenticate(deps), authorize(deps, Actions.auditRead)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      setCache(reply, 'no-store');
      const query = parse(AuditQuerySchema, request.query ?? {});
      const page = await deps.store.listAudit(request.params.siteId, query);
      return parse(AuditListResponseSchema, {
        items: page.items,
        nextCursor: page.nextCursor,
      });
    },
  );

  app.get<{ Params: { siteId: string }; Querystring: { format?: string } }>(
    '/sites/:siteId/audit/export',
    { preHandler: [authenticate(deps), authorize(deps, Actions.auditExport)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      const query = parse(AuditExportQuerySchema, {
        ...request.query,
        format: request.query.format ?? 'json',
      });
      const page = await deps.store.listAudit(request.params.siteId, {
        eventType: query.eventType,
        actorId: query.actorId,
        from: query.from,
        to: query.to,
        limit: 200,
      });

      await deps.chain.append({
        siteId: request.params.siteId,
        eventType: 'report.exported',
        actorId: request.authUser!.id,
        actorEmail: request.authUser!.email,
        ip: request.ip,
        device: request.headers['user-agent'] ?? null,
        resource: 'audit:export',
        action: 'export',
        before: null,
        after: { format: query.format, rowCount: page.items.length },
      });

      if (query.format === 'csv') {
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="audit.csv"');
        return reply.send(toCsv(page.items));
      }
      return { items: page.items, exported: true };
    },
  );

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/audit/verify',
    { preHandler: [authenticate(deps), authorize(deps, Actions.auditRead)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      setCache(reply, 'no-store');
      const result = await deps.store.verifyAudit(request.params.siteId);
      return parse(AuditVerifyResponseSchema, result);
    },
  );
}
