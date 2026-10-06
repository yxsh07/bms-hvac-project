/**
 * Site configuration loader / validator (PLAN §2.3, §7.1).
 *
 * Everything site-specific lives in a JSON config file (default
 * `data/seed/site.json`) and may be overridden by environment variables.
 * There are deliberately **no branches on the site name** anywhere: the
 * driver, paths, thresholds, sentinels and comfort bands all come from here.
 */

import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// ── Repo root ────────────────────────────────────────────────────────────────
// src/config.ts → apps/api/src → repo root is three levels up.
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..', '..');

// ── Zod schemas ──────────────────────────────────────────────────────────────

const RangeRuleSchema = z.object({
  classification: z.string().optional(),
  min: z.number(),
  max: z.number(),
});

const ConsistencyRuleSchema = z.object({
  triggerField: z.string(),
  triggerValue: z.number(),
  targetField: z.string(),
  targetMin: z.number().optional(),
  targetMax: z.number().optional(),
  targetExact: z.number().optional(),
});

const QualitySchema = z
  .object({
    sentinelValues: z.array(z.number()).default([]),
    ranges: z.array(RangeRuleSchema).default([]),
    suppressProcessValuesWhenStopped: z.array(z.string()).optional(),
    consistencyRules: z.array(ConsistencyRuleSchema).default([]),
  })
  .passthrough();

const TelemetrySchema = z
  .object({
    driver: z.enum(['csv', 'timescale-raw', 'sim-http', 'influx']),
    url: z.string().optional(),
    dsnRef: z.string().optional(),
    path: z.string().optional(),
    table: z.string().default('points'),
    columns: z
      .object({
        time: z.string().default('time'),
        measurement: z.string().default('measurement'),
        entity: z.string().default('entity_id'),
        field: z.string().default('field'),
        value: z.string().default('value'),
        delayed: z.string().default('is_delayed'),
        cursor: z.string().default('seq'),
      })
      .passthrough()
      .optional(),
    measurements: z
      .object({
        component: z.string().default('components'),
        device: z.string().default('device'),
      })
      .optional(),
    cadenceSeconds: z.number().int().positive().default(60),
  })
  .passthrough();

const GatewaySchema = z.object({
  driver: z.string().min(1),
  url: z.string().min(1),
});

const OntologySchema = z.object({
  driver: z.string().default('json'),
  path: z.string().default('data/seed/ontology.json'),
});

const ComfortBandSchema = z.object({
  coldBelow: z.number().optional(),
  warmAbove: z.number().optional(),
  hotAbove: z.number().optional(),
});

const SiteFileSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  telemetry: TelemetrySchema,
  gateway: GatewaySchema,
  ontology: OntologySchema,
  pointRoles: z.string().default('data/seed/point-roles.json'),
  twin: z.object({ layout: z.string() }).optional(),
  quality: QualitySchema,
  comfort: z.object({ bands: z.record(z.string(), ComfortBandSchema) }).optional(),
  staleAfterCadences: z.number().int().positive().default(5),
  useWallClock: z.boolean().default(false),
});

export type SiteFileConfig = z.infer<typeof SiteFileSchema>;
export type QualityConfig = z.infer<typeof QualitySchema>;
export type ComfortBand = z.infer<typeof ComfortBandSchema>;

/** Fully-resolved runtime configuration. */
export interface LoadedConfig extends SiteFileConfig {
  /** Absolute repo root (parent of apps/). */
  repoRoot: string;
  /** Absolute paths resolved from the repo root. */
  paths: {
    ontology: string;
    pointRoles: string;
    twinLayout?: string;
  };
  /** HMAC key for the audit chain. */
  auditHmacKey: string;
  /** Secret used to sign JWTs. */
  jwtSecret: string;
  /** Access / refresh token lifetimes (seconds). */
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

// ── Env helpers ──────────────────────────────────────────────────────────────

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? undefined : v;
}

/** Resolve a `env:NAME` reference (used by `dsnRef`). */
export function resolveEnvRef(ref: string): string | undefined {
  if (ref.startsWith('env:')) return env(ref.slice(4));
  return ref;
}

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

// ── Loader ───────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG_PATH = resolve(REPO_ROOT, 'data', 'seed', 'site.json');

/**
 * Load and validate the site config. Environment overrides (all optional):
 *   SITE_CONFIG_PATH, SITE_ID, SITE_TIMEZONE, SITE_TELEMETRY_DRIVER,
 *   SITE_TELEMETRY_URL, SITE_GATEWAY_URL, SITE_ONTOLOGY_PATH,
 *   SITE_POINT_ROLES, AUDIT_HMAC_KEY, JWT_SECRET
 */
export async function loadConfig(path?: string): Promise<LoadedConfig> {
  const configPath = path ?? env('SITE_CONFIG_PATH') ?? DEFAULT_CONFIG_PATH;
  const raw = await readFile(configPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`site config: invalid JSON in ${configPath}: ${String(err)}`);
  }

  const result = SiteFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`site config: validation failed for ${configPath}: ${result.error.message}`);
  }

  const file = result.data;

  // ── Environment overrides (no site-name branching) ─────────────────────────
  const siteId = env('SITE_ID') ?? file.siteId;
  const timezone = env('SITE_TIMEZONE') ?? file.timezone;
  const telemetryDriver = env('SITE_TELEMETRY_DRIVER') ?? file.telemetry.driver;
  const telemetryUrl = env('SITE_TELEMETRY_URL') ?? file.telemetry.url;
  const gatewayUrl = env('SITE_GATEWAY_URL') ?? file.gateway.url;
  const ontologyPath = env('SITE_ONTOLOGY_PATH') ?? file.ontology.path;
  const pointRolesPath = env('SITE_POINT_ROLES') ?? file.pointRoles;

  return {
    ...file,
    siteId,
    timezone,
    telemetry: {
      ...file.telemetry,
      driver: telemetryDriver as SiteFileConfig['telemetry']['driver'],
      url: telemetryUrl,
    },
    gateway: { ...file.gateway, url: gatewayUrl },
    ontology: { ...file.ontology, path: ontologyPath },
    pointRoles: pointRolesPath,
    repoRoot: REPO_ROOT,
    paths: {
      ontology: resolvePath(ontologyPath),
      pointRoles: resolvePath(pointRolesPath),
      twinLayout: file.twin ? resolvePath(file.twin.layout) : undefined,
    },
    auditHmacKey: env('AUDIT_HMAC_KEY') ?? 'dev-audit-key-do-not-use-in-production',
    jwtSecret: env('JWT_SECRET') ?? 'dev-jwt-secret-do-not-use-in-production',
    accessTokenTtlSeconds: Number(env('ACCESS_TOKEN_TTL') ?? 900),
    refreshTokenTtlSeconds: Number(env('REFRESH_TOKEN_TTL') ?? 604800),
  };
}
