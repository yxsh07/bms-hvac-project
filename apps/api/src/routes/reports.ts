/**
 * Report routes (§7.9, §7.10). Definitions are static; runs are queued.
 * The actual PDF/XLSX generation is out of scope for the offline API rebuild,
 * so `run` queues a row and returns it.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  ErrorCode,
  ReportDefinitionListResponseSchema,
  ReportKeySchema,
  ReportRunSchema,
  RunReportRequestSchema,
  type ReportDefinition,
  type ReportKey,
  type ReportRun,
} from '@contracts';
import { Actions } from '../auth/rbac.js';
import { notFound } from '../util/errors.js';
import { authenticate, authorize, parse, setCache, type RouteDeps } from './guards.js';

const DEFINITIONS: ReportDefinition[] = [
  {
    key: 'energy-summary',
    title: 'Energy by zone',
    description: 'Counter consumption per zone with reset counts.',
    formats: ['json', 'csv', 'xlsx'],
    parameters: [
      { key: 'window', label: 'Window', type: 'string', required: false, default: '24h' },
    ],
  },
  {
    key: 'plant-efficiency',
    title: 'Plant performance',
    description: 'Runtime, mean/peak kW, ikW/TR, ΔT and staging.',
    formats: ['json', 'csv'],
    parameters: [],
  },
  {
    key: 'setpoint-history',
    title: 'Set-point and override audit',
    description: 'Every set-point transition, collapsed rapid reversals flagged.',
    formats: ['json', 'csv'],
    parameters: [],
    minRole: 'facility-manager',
  },
  {
    key: 'alarm-frequency',
    title: 'Equipment health and coverage',
    description: 'Active alarms, trips and coverage shortfalls.',
    formats: ['json', 'csv'],
    parameters: [],
  },
  {
    key: 'data-quality',
    title: 'Data quality',
    description: 'Quality-flagged readings and coverage per asset.',
    formats: ['json', 'csv'],
    parameters: [],
  },
  {
    key: 'audit-export',
    title: 'Audit export',
    description: 'Human-readable audit trail export.',
    formats: ['json', 'csv'],
    parameters: [],
    minRole: 'facility-manager',
  },
  {
    key: 'override-schedule',
    title: 'Override and schedule activity',
    description: 'Override creations, expiries and schedule changes.',
    formats: ['json', 'csv'],
    parameters: [],
  },
];

function toReportRun(record: import('../store/types.js').ReportRunRecord): ReportRun {
  return {
    id: record.id,
    reportKey: record.reportKey as ReportKey,
    status: record.status,
    siteId: record.siteId,
    requestedBy: record.requestedBy,
    requestedAt: record.requestedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    downloadUrl: record.downloadUrl,
    contentType: record.contentType,
    rowCount: record.rowCount,
    format: record.format,
    errorMessage: record.errorMessage,
    params: record.params,
  };
}

export function registerReportRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get(
    '/reports',
    { preHandler: [authenticate(deps), authorize(deps, Actions.reportsRead)] },
    async (_request, reply) => {
      setCache(reply, 'ontology');
      return parse(ReportDefinitionListResponseSchema, { reports: DEFINITIONS });
    },
  );

  app.post<{ Params: { key: string } }>(
    '/reports/:key/run',
    { preHandler: [authenticate(deps), authorize(deps, Actions.reportsRun)] },
    async (request) => {
      const keyParsed = ReportKeySchema.safeParse(request.params.key);
      if (!keyParsed.success) {
        throw notFound(ErrorCode.REPORT_NOT_FOUND, `Unknown report ${request.params.key}`);
      }
      const body = parse(RunReportRequestSchema, request.body ?? {});
      if (body.siteId !== deps.config.siteId) {
        throw notFound(ErrorCode.SITE_NOT_FOUND, `site ${body.siteId} not found`);
      }

      const contentType =
        body.format === 'csv' ? 'text/csv' : body.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json';

      const record = await deps.store.createReportRun({
        id: randomUUID(),
        reportKey: keyParsed.data,
        status: 'queued',
        siteId: body.siteId,
        requestedBy: request.authUser!.id,
        requestedAt: deps.clock(),
        startedAt: null,
        completedAt: null,
        downloadUrl: null,
        contentType,
        rowCount: null,
        format: body.format,
        errorMessage: null,
        params: body.params,
      });
      return parse(ReportRunSchema, toReportRun(record));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/reports/runs/:id',
    { preHandler: [authenticate(deps), authorize(deps, Actions.reportsRead)] },
    async (request, reply) => {
      setCache(reply, 'no-store');
      const run = await deps.store.getReportRun(request.params.id);
      if (!run) throw notFound(ErrorCode.REPORT_NOT_FOUND, `Report run ${request.params.id} not found`);
      return parse(ReportRunSchema, toReportRun(run));
    },
  );
}
