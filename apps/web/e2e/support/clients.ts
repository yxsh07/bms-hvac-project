/**
 * Thin API + SimSite clients for the Playwright suite (PLAN §6.3, §7.9).
 *
 * Everything site-specific (URLs, credentials, site id) comes from env with
 * local defaults, so the same specs run against the local dev stack or compose.
 */

import { expect, request, type APIRequestContext } from '@playwright/test';

export const SITE_ID = process.env.E2E_SITE_ID ?? 'simsite-hospital';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
export const SIM_URL = process.env.E2E_SIM_URL ?? 'http://localhost:8000';
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';

export interface Credentials {
  email: string;
  password: string;
}

/** Seeded demo accounts (apps/api/src/server.ts). Role → credentials. */
export const ROLE_CREDENTIALS: Record<string, Credentials> = {
  admin: { email: 'admin@example.com', password: 'Admin123!' },
  engineer: { email: 'engineer@example.com', password: 'Engineer123!' },
  facility: { email: 'facility@example.com', password: 'Facility123!' },
  operator: { email: 'operator@example.com', password: 'Operator123!' },
  executive: { email: 'executive@example.com', password: 'Executive123!' },
};

export type Role = keyof typeof ROLE_CREDENTIALS;

export interface HttpResult<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

async function toResult<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<HttpResult<T>> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.headers())) headers[k.toLowerCase()] = v;
  return { status: res.status(), body: body as T, headers };
}

/** App API client (/api/v1). One instance logs in per role and caches tokens. */
export class ApiClient {
  private readonly tokens = new Map<Role, string>();

  constructor(private readonly ctx: APIRequestContext, private readonly baseUrl = API_URL) {}

  static async create(baseUrl = API_URL): Promise<ApiClient> {
    const ctx = await request.newContext({ baseURL: baseUrl });
    return new ApiClient(ctx, baseUrl);
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  token(role: Role): string {
    const token = this.tokens.get(role);
    if (!token) throw new Error(`not logged in as ${role}; call login() first`);
    return token;
  }

  async login(role: Role): Promise<string> {
    const existing = this.tokens.get(role);
    if (existing) return existing;
    const res = await this.ctx.post(`${this.baseUrl}/api/v1/auth/login`, {
      data: ROLE_CREDENTIALS[role],
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await toResult<{ accessToken?: string }>(res);
    expect(result.status, `login ${role} failed: ${JSON.stringify(result.body)}`).toBe(200);
    const token = result.body.accessToken;
    expect(token, `login ${role} returned no token`).toBeTruthy();
    this.tokens.set(role, token!);
    return token!;
  }

  private headers(role?: Role, idempotencyKey?: string): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (role) h.Authorization = `Bearer ${this.token(role)}`;
    if (idempotencyKey) h['Idempotency-Key'] = idempotencyKey;
    return h;
  }

  get<T = unknown>(path: string, role?: Role): Promise<HttpResult<T>> {
    return this.ctx
      .get(this.baseUrl + path, { headers: this.headers(role) })
      .then((r) => toResult<T>(r));
  }

  post<T = unknown>(path: string, role?: Role, data?: unknown, idempotencyKey?: string): Promise<HttpResult<T>> {
    return this.ctx
      .post(this.baseUrl + path, { data, headers: this.headers(role, idempotencyKey) })
      .then((r) => toResult<T>(r));
  }

  put<T = unknown>(path: string, role?: Role, data?: unknown): Promise<HttpResult<T>> {
    return this.ctx
      .put(this.baseUrl + path, { data, headers: this.headers(role) })
      .then((r) => toResult<T>(r));
  }
}

/** SimSite client for scenarios, gateway presets, what-if and the checklist. */
export class SimClient {
  constructor(private readonly ctx: APIRequestContext, private readonly baseUrl = SIM_URL) {}

  static async create(baseUrl = SIM_URL): Promise<SimClient> {
    const ctx = await request.newContext({ baseURL: baseUrl });
    return new SimClient(ctx, baseUrl);
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  private async call<T>(method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown): Promise<HttpResult<T>> {
    const res =
      method === 'get'
        ? await this.ctx.get(this.baseUrl + path)
        : method === 'post'
          ? await this.ctx.post(this.baseUrl + path, { data })
          : method === 'put'
            ? await this.ctx.put(this.baseUrl + path, { data })
            : await this.ctx.delete(this.baseUrl + path);
    return toResult<T>(res);
  }

  state(): Promise<HttpResult<Record<string, unknown>>> {
    return this.call('get', '/sim/state');
  }

  startScenario(name: string, seed?: number): Promise<HttpResult<{ started?: boolean }>> {
    return this.call('post', `/sim/scenarios/${name}/start`, seed === undefined ? {} : { seed });
  }

  stopScenario(name: string): Promise<HttpResult<unknown>> {
    return this.call('post', `/sim/scenarios/${name}/stop`);
  }

  /** Advance the engine deterministically; returns the emitted row count. */
  run(minutes: number): Promise<HttpResult<{ emitted: number; total: number }>> {
    return this.call('post', '/sim/run', { minutes });
  }

  setGateway(preset: string, extra: Record<string, unknown> = {}): Promise<HttpResult<unknown>> {
    return this.call('put', '/sim/gateway', { preset, ...extra });
  }

  setMode(asset: string, controlType: string): Promise<HttpResult<unknown>> {
    return this.call('post', '/sim/modes', { asset, controlType });
  }

  whatIf(changes: unknown[], horizonMin = 60): Promise<HttpResult<Record<string, unknown>>> {
    return this.call('post', '/sim/whatif', { changes, horizonMin, stepMinutes: 5 });
  }

  postChecklist(featureId: string, status: string, runId: string, evidence?: string): Promise<HttpResult<unknown>> {
    return this.call('post', '/sim/checklist', { featureId, status, runId, evidence });
  }
}

/** Poll until `check` passes or the timeout elapses; never a fixed sleep. */
export async function pollUntil<T>(
  check: () => Promise<T>,
  predicate: (value: T) => boolean,
  { timeoutMs = 15_000, intervalMs = 250, message = 'condition' } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      last = await check();
      if (predicate(last)) return last;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `pollUntil(${message}) timed out after ${timeoutMs}ms; last=${JSON.stringify(last)}` +
      (lastError ? `; error=${String(lastError)}` : ''),
  );
}
