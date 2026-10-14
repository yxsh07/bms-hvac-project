/**
 * API entry point (§7.9). Wires config, store, ontology, drivers, the
 * set-point service and all route plugins into one Fastify instance.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { GatewayDriver } from '@contracts';
import { JsonOntologyDriver, type Ontology } from '@ontology';
import { AuditChain } from './audit/chain.js';
import { hashPassword, verifyPassword } from './auth/passwords.js';
import { loadConfig, resolveEnvRef, type LoadedConfig } from './config.js';
import { loadPointRoles, type PointRolesData } from './domain/classify.js';
import { buildEntityToAsset, buildPointResolver, materializeAssets } from './domain/ontology.js';
import { SimHttpGateway } from './drivers/gateway.js';
import { createSourceDriver } from './drivers/source.js';
import { startIngestWorker } from './ingest/worker.js';
import { SetpointService } from './services/setpoints.js';
import { MemoryStore } from './store/memory.js';
import { PostgresStore } from './store/postgres.js';
import type { Store, UserRecord } from './store/types.js';
import { HttpError } from './util/errors.js';
import { registerAlarmRoutes } from './routes/alarms.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerOntologyRoutes } from './routes/ontology.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerSetpointRoutes } from './routes/setpoints.js';
import { registerSiteRoutes } from './routes/sites.js';
import { registerTelemetryRoutes } from './routes/telemetry.js';
import { registerUserRoutes } from './routes/users.js';
import type { RouteDeps } from './routes/guards.js';

export interface CreateDepsOptions {
  config: LoadedConfig;
  store?: Store;
  gateway?: GatewayDriver;
  clock?: () => string;
  ontology?: Ontology;
  pointRoles?: PointRolesData;
  /** Materialise the ontology into the store's assets table (default true). */
  materialize?: boolean;
}

export interface ServerDeps extends RouteDeps {
  entityToAsset: Record<string, string>;
  source: ReturnType<typeof createSourceDriver>;
  setSourceTime: (time: string) => void;
}

/** Build the dependency graph. Exported so tests can inject fakes. */
export async function createServerDeps(opts: CreateDepsOptions): Promise<ServerDeps> {
  const config = opts.config;
  const clock = opts.clock ?? (() => new Date().toISOString());
  const store = opts.store ?? defaultStore(config);
  const ontology =
    opts.ontology ?? (await new JsonOntologyDriver(config.paths.ontology).load(config.siteId));
  const pointRoles = opts.pointRoles ?? loadPointRoles(config.paths.pointRoles);

  if (opts.materialize !== false) {
    await store.upsertAssets(config.siteId, materializeAssets(ontology, config.siteId));
  }

  const gateway = opts.gateway ?? new SimHttpGateway({ url: config.gateway.url });
  const chain = new AuditChain(store, { key: config.auditHmacKey, clock });
  const setpoints = new SetpointService({
    store,
    config,
    gateway,
    clock,
    resolvePoint: buildPointResolver(ontology),
    // E2E may shorten these so a full read-back/expiry cycle is observable.
    readbackTimeoutSeconds: Number(process.env.SETPOINT_READBACK_TIMEOUT_S) || undefined,
    watchWindowSeconds: Number(process.env.SETPOINT_WATCH_WINDOW_S) || undefined,
    dispatchDeadlineSeconds: Number(process.env.SETPOINT_DISPATCH_DEADLINE_S) || undefined,
  });

  const source = createSourceDriver({
    driver: config.telemetry.driver,
    url: config.telemetry.url,
    dsnRef: config.telemetry.dsnRef ? resolveEnvRef(config.telemetry.dsnRef) : undefined,
    path: undefined,
    table: config.telemetry.table,
    columns: config.telemetry.columns,
    measurements: config.telemetry.measurements,
  });
  let sourceTime: Date | null = null;

  return {
    config,
    store,
    chain,
    setpoints,
    ontology,
    pointRoles,
    clock,
    sourceTime: () => sourceTime,
    setSourceTime: (time) => { sourceTime = new Date(time); },
    entityToAsset: buildEntityToAsset(ontology),
    source,
  };
}

function defaultStore(config: LoadedConfig): Store {
  const dsn = process.env.SITE_STORE_DSN ?? process.env.DATABASE_URL;
  if (dsn) return new PostgresStore({ connectionString: dsn, auditKey: config.auditHmacKey });
  return new MemoryStore({ auditKey: config.auditHmacKey });
}

/** Register every route plugin under `/api/v1`. */
export async function buildServer(deps: ServerDeps, logger = true): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  // Tiny CORS hook (no @fastify/cors available offline).
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key');
    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send(error.toBody());
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) request.log.error(error as Error);
    const code =
      status === 401
        ? 'UNAUTHORIZED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : status < 500
              ? 'VALIDATION_ERROR'
              : 'INTERNAL_SERVER_ERROR';
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(status).send({ error: message, code });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({ error: `Route ${request.method} ${request.url} not found`, code: 'NOT_FOUND' });
  });

  await app.register(
    async (api) => {
      registerAuthRoutes(api, deps);
      registerSiteRoutes(api, deps);
      registerOntologyRoutes(api, deps);
      registerTelemetryRoutes(api, deps);
      registerDashboardRoutes(api, deps);
      registerSetpointRoutes(api, deps);
      registerAlarmRoutes(api, deps);
      registerReportRoutes(api, deps);
      registerAuditRoutes(api, deps);
      registerUserRoutes(api, deps);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

// ── Demo users ───────────────────────────────────────────────────────────────

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: UserRecord['roles'][string];
}

const DEMO_USERS: DemoUser[] = [
  { email: 'admin@example.com', password: 'Admin123!', name: 'Site Admin', role: 'admin' },
  { email: 'engineer@example.com', password: 'Engineer123!', name: 'Plant Engineer', role: 'engineer' },
  { email: 'facility@example.com', password: 'Facility123!', name: 'Facility Manager', role: 'facility-manager' },
  { email: 'operator@example.com', password: 'Operator123!', name: 'Operator', role: 'operator' },
  { email: 'executive@example.com', password: 'Executive123!', name: 'Executive', role: 'executive' },
];

/** Seed the five demo roles from env or defaults; passwords hashed at boot. */
export async function seedDemoUsers(store: Store, config: LoadedConfig): Promise<void> {
  for (const demo of DEMO_USERS) {
    const email = process.env[`SEED_${demo.role.toUpperCase().replace('-', '_')}_EMAIL`] ?? demo.email;
    const password = process.env[`SEED_${demo.role.toUpperCase().replace('-', '_')}_PASSWORD`] ?? demo.password;
    const existing = await store.findUserByEmail(email);
    if (existing) continue;
    const now = new Date().toISOString();
    await store.createUser({
      id: randomUUID(),
      name: demo.name,
      email,
      passwordHash: await hashPassword(password),
      roles: { [config.siteId]: demo.role },
      siteIds: [config.siteId],
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const config = await loadConfig();
  const deps = await createServerDeps({ config });
  await seedDemoUsers(deps.store, config);
  if (config.telemetry.driver === 'sim-http' && config.telemetry.url) {
    await resumeSimClock(deps.store, config.siteId, config.telemetry.url);
  }
  const app = await buildServer(deps);
  const port = Number(process.env.PORT ?? 3000);

  const stopWorkers = startBackgroundWorkers(deps);
  app.addHook('onClose', async () => stopWorkers());

  await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
}

/** Keep a restarted SimSite ahead of persisted telemetry before polling starts. */
export async function resumeSimClock(
  store: Pick<Store, 'listAssets' | 'latest'>,
  siteId: string,
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const assets = await store.listAssets(siteId);
  const readings = await Promise.all(assets.map((asset) => store.latest(siteId, asset.id)));
  const latestMs = Math.max(0, ...readings.flatMap((fields) => Object.values(fields).map((sample) => Date.parse(sample.at))));
  if (!latestMs) return;

  const base = sourceUrl.replace(/\/$/, '');
  let response: Response | undefined;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { response = await fetchImpl(`${base}/sim/state`); if (response.ok) break; }
    catch { /* SimSite may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!response?.ok) throw new Error('SimSite is unavailable for clock recovery');
  const state = await response.json() as { clock: { simTime: string } };
  if (Date.parse(state.clock.simTime) > latestMs) return;
  const seek = await fetchImpl(`${base}/sim/clock`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seek: new Date(latestMs).toISOString() }),
  });
  if (!seek.ok) throw new Error(`SimSite clock recovery failed (${seek.status})`);
  const prime = await fetchImpl(`${base}/sim/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: 1 }),
  });
  if (!prime.ok) throw new Error(`SimSite clock recovery prime failed (${prime.status})`);
}

/**
 * Start the ingest poller and the set-point scheduler (§7.5, §7.6).
 *
 * These are the only two long-running loops the prototype needs; both are
 * unref'd so they never keep the process alive on their own. Intervals are
 * overridable for e2e (INGEST_POLL_MS, SETPOINT_TICK_MS) so tests can drive a
 * scenario and observe the app without waiting a full minute.
 */
export function startBackgroundWorkers(deps: ServerDeps): () => void {
  const ingestPollMs = Number(process.env.INGEST_POLL_MS) || undefined;
  const ingest = startIngestWorker(
    deps.store,
    deps.source,
    deps.config,
    {
      ontology: deps.ontology,
      pointRoles: deps.pointRoles,
      entityToAsset: deps.entityToAsset,
    },
    (stats) => { if (stats.latestAt) deps.setSourceTime(stats.latestAt); },
    ingestPollMs,
  );

  const tickMs = Number(process.env.SETPOINT_TICK_MS) || 5000;
  const scheduler = setInterval(() => {
    void deps.setpoints.schedulerTick();
  }, tickMs);
  if (typeof scheduler.unref === 'function') scheduler.unref();

  return () => {
    ingest.stop();
    clearInterval(scheduler);
  };
}

// Re-export helpers for tests and tooling.
export { loadConfig, verifyPassword };

// Run the server when executed directly (`node --watch src/server.ts`).
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
