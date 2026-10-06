/**
 * Telemetry routes (§7.9): latest, series (raw/1h/1d), coverage.
 * Every response carries a quality block; each bucket carries `n`.
 */

import type { FastifyInstance } from 'fastify';
import {
  CoverageResponseSchema,
  LatestResponseSchema,
  SeriesQuerySchema,
  SeriesResponseSchema,
  type QualityBlock,
} from '@contracts';
import { badRequest, notFound } from '../util/errors.js';
import { windowToRange } from '../util/time.js';
import { authenticate, parse, setCache, type RouteDeps } from './guards.js';

function quality(expected: number, good: number, delayed: boolean): QualityBlock {
  return {
    expectedSamples: expected,
    goodSamples: good,
    coveragePct: expected === 0 ? 0 : Math.min(100, (good / expected) * 100),
    hasDelayedData: delayed,
  };
}

export function registerTelemetryRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const ensureSite = (siteId: string): void => {
    if (siteId !== deps.config.siteId) throw notFound('SITE_NOT_FOUND', `site ${siteId} not found`);
  };
  const ensureAsset = (assetId: string): void => {
    if (!deps.ontology.assets.some((a) => a.id === assetId)) {
      throw notFound('ASSET_NOT_FOUND', `Asset ${assetId} not found`);
    }
  };

  app.get<{ Params: { siteId: string; assetId: string } }>(
    '/sites/:siteId/assets/:assetId/latest',
    { preHandler: [authenticate(deps)] },
    async (request, reply) => {
      ensureSite(request.params.siteId);
      ensureAsset(request.params.assetId);
      setCache(reply, 'latest');

      const latest = await deps.store.latest(request.params.siteId, request.params.assetId);
      const fields: Record<string, { value: number | null; at: string; quality: number }> = {};
      let delayed = false;
      let good = 0;
      for (const [field, sample] of Object.entries(latest)) {
        fields[field] = { value: sample.value, at: sample.at, quality: sample.quality };
        if (sample.isDelayed) delayed = true;
        if (sample.quality === 0) good += 1;
      }

      const { from, to } = windowToRange('1h');
      const cov = await deps.store.coverage(
        request.params.siteId,
        request.params.assetId,
        from,
        to,
        deps.config.telemetry.cadenceSeconds,
      );

      return parse(LatestResponseSchema, {
        fields,
        quality: quality(cov.expected, good, delayed),
      });
    },
  );

  app.get<{
    Params: { siteId: string; assetId: string };
    Querystring: { field: string; from: string; to: string; resolution?: string };
  }>('/sites/:siteId/assets/:assetId/telemetry', { preHandler: [authenticate(deps)] }, async (request, reply) => {
    ensureSite(request.params.siteId);
    ensureAsset(request.params.assetId);
    setCache(reply, 'telemetry');

    const query = parse(SeriesQuerySchema, {
      siteId: request.params.siteId,
      entityId: request.params.assetId,
      ...request.query,
    });

    const buckets = await deps.store.series(query);
    const cov = await deps.store.coverage(
      query.siteId,
      query.entityId,
      query.from,
      query.to,
      deps.config.telemetry.cadenceSeconds,
    );
    const good = buckets.filter((b) => b.avg !== null).length;

    return parse(SeriesResponseSchema, {
      field: query.field,
      resolution: query.resolution,
      buckets,
      quality: quality(cov.expected, good, false),
    });
  });

  app.get<{
    Params: { siteId: string; assetId: string };
    Querystring: { from: string; to: string };
  }>('/sites/:siteId/assets/:assetId/coverage', { preHandler: [authenticate(deps)] }, async (request, reply) => {
    ensureSite(request.params.siteId);
    ensureAsset(request.params.assetId);
    setCache(reply, 'telemetry');

    const from = request.query.from;
    const to = request.query.to;
    if (!from || !to) throw badRequest('from and to are required');

    const cov = await deps.store.coverage(
      request.params.siteId,
      request.params.assetId,
      from,
      to,
      deps.config.telemetry.cadenceSeconds,
    );
    return parse(CoverageResponseSchema, {
      expected: cov.expected,
      received: cov.received,
      pct: cov.pct,
      quality: quality(cov.expected, cov.received, false),
    });
  });
}
