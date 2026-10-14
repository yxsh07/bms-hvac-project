import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer, createServerDeps, seedDemoUsers } from '../src/server.js';
import { makeContext, FakeGateway, type TestContext } from './helpers.js';
import { PlantSchema } from '@contracts';

const SITE = 'simsite-hospital';

let app: FastifyInstance;
let ctx: TestContext;
let gateway: FakeGateway;

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { accessToken: string }).accessToken;
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  ctx = await makeContext();
  gateway = new FakeGateway('ok');
  const deps = await createServerDeps({
    config: ctx.config,
    store: ctx.store,
    ontology: ctx.ontology,
    pointRoles: ctx.pointRoles,
    gateway,
    clock: () => new Date().toISOString(),
  });
  await seedDemoUsers(ctx.store, ctx.config);
  app = await buildServer(deps, false);
  await app.ready();

  // Seed a little telemetry for the KPI routes.
  await ctx.store.upsertTelemetry([
    {
      siteId: SITE,
      entityId: 'chiller-01',
      entityKind: 'component',
      field: 'KW',
      time: new Date().toISOString(),
      value: 120,
      rawValue: null,
      quality: 0,
      isDelayed: false,
    },
  ]);
});

describe('auth + errors', () => {
  it('rejects unauthenticated requests with a stable code', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a bad password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'nope' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
  });

  it('returns the user and permissions from /me', async () => {
    const token = await login('operator@example.com', 'Operator123!');
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: auth(token) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe('operator@example.com');
    expect(body.roles[SITE]).toBe('operator');
  });

  it('returns 404 error codes for unknown resources', async () => {
    const token = await login('operator@example.com', 'Operator123!');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${SITE}/assets/nope/latest`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ASSET_NOT_FOUND');

    const unknown = await app.inject({ method: 'GET', url: '/api/v1/nope', headers: auth(token) });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().code).toBe('NOT_FOUND');
  });
});

describe('read routes', () => {
  it('serves the validated site plant topology to authenticated users', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const denied = await app.inject({ method: 'GET', url: `/api/v1/sites/${SITE}/plant-layout` });
    expect(denied.statusCode).toBe(401);
    const res = await app.inject({ method: 'GET', url: `/api/v1/sites/${SITE}/plant-layout`, headers: auth(token) });
    expect(res.statusCode).toBe(200);
    const plant = PlantSchema.parse(res.json());
    expect(plant.nodes.some((node) => node.kind === 'equipment')).toBe(true);
    expect(plant.edges.length).toBeGreaterThan(1);
  });

  it('serves semantic point roles from the selected site config', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const res = await app.inject({
      method: 'GET', url: `/api/v1/sites/${SITE}/point-roles`, headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(ctx.pointRoles);
    expect(res.headers['cache-control']).toContain('max-age=300');
  });

  it('sets ontology Cache-Control to 300s', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${SITE}/ontology`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=300');
  });

  it('returns controller health', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${SITE}/controllers`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('returns role-resolved floor summaries including a plant pseudo-floor', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${SITE}/floors/summary?window=1h`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    const floors = res.json().floors as Array<{ id: string }>;
    expect(floors.length).toBeGreaterThanOrEqual(3);
    expect(floors.some((f) => f.id === 'plant')).toBe(true);
  });

  it('returns plant KPIs resolved through roles', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${SITE}/plant/kpis?window=1h`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalKw).toBeGreaterThanOrEqual(120);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('RBAC denials are audited', () => {
  it('denies executive alarm ack and records the denial', async () => {
    const execToken = await login('executive@example.com', 'Executive123!');
    const denied = await app.inject({
      method: 'POST',
      url: `/api/v1/sites/${SITE}/alarms/any-id/ack`,
      headers: auth(execToken),
      payload: {},
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe('FORBIDDEN');

    const adminToken = await login('admin@example.com', 'Admin123!');
    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${SITE}/audit?eventType=authz.denied`,
      headers: auth(adminToken),
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().items.length).toBeGreaterThanOrEqual(1);
    expect(audit.json().items[0].eventType).toBe('authz.denied');
  });
});

describe('set-point HTTP flow', () => {
  it('returns 409 SETPOINT_REQUEST_CONFLICT with the existing id on the second proposal', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const body = { value: 8, justification: 'first via http' };
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/sites/${SITE}/setpoints/chiller-01/CHWSSP`,
      headers: { ...auth(token), 'idempotency-key': 'k1' },
      payload: body,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/sites/${SITE}/setpoints/chiller-01/CHWSSP`,
      headers: { ...auth(token), 'idempotency-key': 'k2' },
      payload: { value: 9, justification: 'second via http' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      code: 'SETPOINT_REQUEST_CONFLICT',
      detail: { existingRequestId: first.json().id },
    });
  });

  it('requires an Idempotency-Key on equipment writes', async () => {
    const token = await login('engineer@example.com', 'Engineer123!');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sites/${SITE}/setpoints/chiller-02/CHWSSP`,
      headers: auth(token),
      payload: { value: 8, justification: 'no key' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('denies propose to facility-manager (RBAC §7.7)', async () => {
    const token = await login('facility@example.com', 'Facility123!');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sites/${SITE}/setpoints/chiller-02/CHWSSP`,
      headers: { ...auth(token), 'idempotency-key': 'k3' },
      payload: { value: 8, justification: 'nope' },
    });
    expect(res.statusCode).toBe(403);
  });
});
