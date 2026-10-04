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
};

export { siteRoutesPlugin };