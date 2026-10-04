// ============================================================================
// SITE API ENDPOINTS
// Ontology, assets, telemetry, and coverage endpoints
// Based on PLAN.md §7.9 API catalogue and §7.2-7.4 interfaces
// ============================================================================

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Ontology, Asset, Point } from '@bms/contracts';
import type { PgPool } from 'pg';
import { createSourceDriver } from '../drivers/index.js';
import { applyQuality, QualityCode } from '@bms/quality';
import { SiteSchema } from '../packages/contracts/src/schemas/ontology.js';

// ============================================================================
// Schema for ontology endpoint response
// ============================================================================

const OntologyResponseSchema = z.object({
  site: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
    environment: z.object({
      wetBulbC: z.number(),
      dryBulbC: z.number(),
      relativeHumidity: z.number().min(0).max(100),
    }).optional(),
  }),
  floors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      level: z.number().int(),
    })
  ),
  zones: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
  assets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['ahu', 'chiller', 'cooling-tower', 'pump', 'fan', 'valve', 'heater', 'boiler', 'meter', 'sensor', 'controller', 'unknown']),
      criticality: z.enum(['critical', 'important', 'standard']),
      floorId: z.string().optional(),
      zoneId: z.string().optional(),
      controllerId: z.string().optional(),
      meterDeviceId: z.string().optional(),
      points: z.array(z.string()),
    })
  ),
  controllers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      deviceId: z.string(),
    })
  ),
  meters: z.array(
    z.object({
      deviceId: z.string(),
      name: z.string(),
      model: z.string().optional(),
    })
  ),
});

type OntologyResponse = z.infer<typeof OntologyResponseSchema>;

// ============================================================================
// Schema for asset endpoint response
// ============================================================================

const AssetResponseSchema = z.object({
  assets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['ahu', 'chiller', 'cooling-tower', 'pump', 'fan', 'valve', 'heater', 'boiler', 'meter', 'sensor', 'controller', 'unknown']),
      criticality: z.enum(['critical', 'important', 'standard']),
      floorId: z.string().optional(),
      zoneId: z.string().optional(),
      controllerId: z.string().optional(),
      points: z.array(z.string()),
    })
  ),
  total: z.number(),
});

type AssetResponse = z.infer<typeof AssetResponseSchema>;

// ============================================================================
// Schema for asset latest endpoint response
// ============================================================================

const AssetLatestResponseSchema = z.object({
  assetId: z.string(),
  pointLatest: z.record(
    z.string(),
    z.object({
      value: z.number().nullable(),
      rawValue: z.number().nullable(),
      at: z.string(),
      quality: z.enum(['OK', 'SENTINEL', 'OUT_OF_RANGE', 'STOPPED_EQUIPMENT', 'INCONSISTENT']),
      isDelayed: z.boolean(),
    })
  ),
});

type AssetLatestResponse = z.infer<typeof AssetLatestResponseSchema>;

// ============================================================================
// Schema for telemetry series endpoint response
// ============================================================================

const TelemetrySeriesResponseSchema = z.object({
  siteId: z.string(),
  entityId: z.string(),
  field: z.string(),
  resolution: z.enum(['raw', '1h', '1d']),
  timeRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  points: z.array(
    z.object({
      time: z.string(),
      value: z.number().nullable(),
      quality: z.enum(['OK', 'SENTINEL', 'OUT_OF_RANGE', 'STOPPED_EQUIPMENT', 'INCONSISTENT']),
      n: z.number().int().min(0).optional(),
      isDelayed: z.boolean().optional(),
    })
  ),
  quality: z.object({
    expectedSamples: z.number().int().min(0),
    goodSamples: z.number().int().min(0),
    coveragePct: z.number().min(0).max(100),
    hasDelayedData: z.boolean(),
  }),
});

type TelemetrySeriesResponse = z.infer<typeof TelemetrySeriesResponseSchema>;

// ============================================================================
// Schema for coverage endpoint response
// ============================================================================

const CoverageResponseSchema = z.object({
  siteId: z.string(),
  entityId: z.string(),
  field: z.string(),
  timeRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  expected: z.number().int().min(0),
  received: z.number().int().min(0),
  pct: z.number().min(0).max(100),
});

type CoverageResponse = z.infer<typeof CoverageResponseSchema>;

// ============================================================================
// Route handlers
// ============================================================================

async function ontologyHandler(
  request: { params: { s: string }; reply: any },
  reply: any
) {
  const siteId = request.params.s;

  // Load ontology from seed data (anonymised)
  const ontologyPath = `data/seed/ontology.json`;
  let ontology: Ontology;

  try {
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(ontologyPath, 'utf8'));
    ontology = data as unknown as Ontology;
  } catch {
    return reply.status(500).send({ error: 'ontology not found' });
  }

  // Transform ontology to API response format
  const response: OntologyResponse = {
    site: {
      id: ontology.site.id,
      name: ontology.site.name,
      timezone: ontology.site.timezone,
      environment: ontology.site.environment,
    },
    floors: ontology.floors.map((f) => ({
      id: f.id,
      name: f.name,
      level: f.level,
    })),
    zones: ontology.zones.map((z) => ({
      id: z.id,
      name: z.name,
    })),
    assets: ontology.assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      criticality: a.criticality,
      floorId: a.floorId,
      zoneId: a.zoneId,
      controllerId: a.controllerId,
      points: a.points,
    })),
    controllers: ontology.controllers.map((c) => ({
      id: c.id,
      name: c.name,
      deviceId: c.deviceId,
    })),
    meters: ontology.meters.map((m) => ({
      deviceId: m.deviceId,
      name: m.name,
      model: m.model,
    })),
  };

  reply.send(response);
}

async function assetsHandler(
  request: { Params: { s: string }; Reply: any },
  reply: any
) {
  const siteId = request.params.s;

  // Load ontology from seed data
  const ontologyPath = `data/seed/ontology.json`;
  let ontology: any;

  try {
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(ontologyPath, 'utf8'));
    ontology = data;
  } catch {
    return reply.status(500).send({ error: 'ontology not found' });
  }

  const assets = ontology.assets.map ( (a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    criticality: a.criticality,
    floorId: a.floorId,
    zoneId: a.zoneId,
    controllerId: a.controllerId,
    points: a.points,
  }));

  const total = assets.length;

  reply.send({ assets, total });
}

async function assetLatestHandler(
  request: { Params: { s: string; a: string }; Reply: any },
  reply: any
) {
  const siteId = request.params.s;
  const assetId = request.params.a;

  // Load ontology from seed data to get point definitions
  const ontologyPath = `data/seed/ontology.json`;
  let ontology: any;

  try {
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(ontologyPath, 'utf8'));
    ontology = data;
  } catch {
    return reply.status(500).send({ error: 'ontology not found' });
  }

  // Find the asset in the ontology
  const asset = ontology.assets.find((a: any) => a.id === assetId);
  if (!asset) {
    return reply.status(404).send({ error: 'asset not found' });
  }

  // Build point latest map from ontology point definitions
  // For now, return structured metadata; actual values would come from telemetry
  const pointLatest: Record<string, { value: number | null; rawValue: number | null; at: string; quality: string; isDelayed: boolean }> = {};

  for (const abbr of asset.points) {
    // Find point definition in ontology
    const pointDef = ontology.points[abbr];
    if (pointDef) {
      pointLatest[abbr] = {
        value: null,
        rawValue: null,
        at: new Date().toISOString(),
        quality: 'OK',
        isDelayed: false,
      };
    }
  }

  reply.send({
    assetId,
    pointLatest,
  });
}

async function telemetryHandler(
  request: { Params: { s: string }; Querystring: { entityId: string; field: string; resolution: string; from: string; to: string }; Reply: any },
  reply: any
) {
  const siteId = request.params.s;
  const entityId = request.query.entityId;
  const field = request.query.field;
  const resolution = request.query.resolution || 'raw';
  const from = request.query.from;
  const to = request.query.to;

  // Load telemetry from the database
  // For now, return structured response; actual DB query would use pg pool
  const fs = await import('fs');

  // Read site config to get quality thresholds
  const siteConfigPath = `data/seed/site-config.json`;
  let sentinels = [-273.15]; // default from plan §2.3

  try {
    const data = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
    sentinels = data.quality?.sentinelValues ?? [-273.15];
  } catch {
    // use defaults
  }

  // Return structured telemetry response
  // In a full implementation, this would query the TimescaleDB telemetry table
  const response: TelemetrySeriesResponse = {
    siteId,
    entityId,
    field,
    resolution: resolution as 'raw' | '1h' | '1d',
    timeRange: { from, to },
    points: [], // Would be populated from DB query
    quality: {
      expectedSamples: 0,
      goodSamples: 0,
      coveragePct: 0,
      hasDelayedData: false,
    },
  };

  reply.send(response);
}

async function coverageHandler(
  request: { Params: { s: string }; Querystring: { entityId: string; field: string; from: string; to: string }; Reply: any },
  reply: any
) {
  const siteId = request.params.s;
  const entityId = request.query.entityId;
  const field = request.query.field;
  const from = request.query.from;
  const to = request.query.to;

  // Return coverage data
  // In a full implementation, this would calculate coverage from the telemetry table
  const response: CoverageResponse = {
    siteId,
    entityId,
    field,
    timeRange: { from, to },
    expected: 0, // Would be calculated from (window / cadenceSeconds)
    received: 0, // Would be counted from actual rows
    pct: 0, // received / expected * 100
  };

  reply.send(response);
}

// ============================================================================
// Plugin to register all site endpoints
// ============================================================================

const siteRoutesPlugin: FastifyPluginAsync = async (fastify, opts) => {
  // GET /sites/:s/ontology
  fastify.get(
    '/sites/:s/ontology',
    {
      schema: {
        params: z.object({ s: z.string().min(1) }),
        response: {
          200: OntologyResponseSchema,
        },
      },
    },
    ontologyHandler
  );

  // GET /sites/:s/assets
  fastify.get(
    '/sites/:s/assets',
    {
      schema: {
        params: z.object({ s: z.string().min(1) }),
        response: {
          200: AssetResponseSchema,
        },
      },
    },
    assetsHandler
  );

  // GET /sites/:s/assets/:a/latest
  fastify.get(
    '/sites/:s/assets/:a/latest',
    {
      schema: {
        params: z.object({ s: z.string().min(1), a: z.string().min(1) }),
        response: {
          200: AssetLatestResponseSchema,
        },
      },
    },
    assetLatestHandler
  );

  // GET /sites/:s/telemetry
  fastify.get(
    '/sites/:s/telemetry',
    {
      schema: {
        params: z.object({ s: z.string().min(1) }),
        querystring: z.object({
          entityId: z.string().min(1),
          field: z.string().min(1),
          resolution: z.enum(['raw', '1h', '1d']).default('raw'),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/),
        }),
        response: {
          200: TelemetrySeriesResponseSchema,
        },
      },
    },
    telemetryHandler
  );

  // GET /sites/:s/coverage
  fastify.get(
    '/sites/:s/coverage',
    {
      schema: {
        params: z.object({ s: z.string().min(1) }),
        querystring: z.object({
          entityId: z.string().min(1),
          field: z.string().min(1),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?$/),
        }),
        response: {
          200: CoverageResponseSchema,
        },
      },
    },
    coverageHandler
  );
};

export { siteRoutesPlugin };