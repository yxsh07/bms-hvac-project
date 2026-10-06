/**
 * Minimal typed client for the BMS/HVAC API (PLAN §7.9).
 *
 * Kept local to the web app so it needs no build step; the generated client in
 * packages/contracts/client is the fuller surface and the API is the source of
 * truth for shapes.
 */

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AssetSummary {
  id: string;
  name: string;
  type: string;
  criticality?: string;
}

export interface LatestPoint {
  value: number | null;
  quality: number;
  at: string;
}

export interface LatestResponse {
  fields: Record<string, LatestPoint>;
  quality: {
    expectedSamples: number;
    goodSamples: number;
    coveragePct: number;
    hasDelayedData: boolean;
  };
}

const QUALITY_LABELS: Record<number, string> = {
  0: 'OK',
  1: 'Sentinel value',
  2: 'Out of range',
  3: 'Stopped equipment',
  4: 'Inconsistent',
};

export function qualityLabel(code: number): string {
  return QUALITY_LABELS[code] ?? `Unknown (${code})`;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function defaultBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return env.VITE_API_URL ?? 'http://localhost:3000';
}

export class ApiClient {
  private token: string | null = null;

  constructor(private readonly baseUrl: string = defaultBaseUrl()) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(this.baseUrl.replace(/\/$/, '') + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json ?? {}) as { error?: string; code?: string };
      throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.error ?? res.statusText);
    }
    return json as T;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('POST', '/api/v1/auth/login', { email, password });
    this.token = res.accessToken;
    return res;
  }

  listAssets(siteId: string): Promise<AssetSummary[]> {
    return this.request('GET', `/api/v1/sites/${siteId}/assets`);
  }

  latest(siteId: string, assetId: string): Promise<LatestResponse> {
    return this.request('GET', `/api/v1/sites/${siteId}/assets/${assetId}/latest`);
  }
}
