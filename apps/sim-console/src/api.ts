/**
 * Sim Console API client (§6.3, §6.8).
 *
 * Talks to a running SimSite on the compose network. No secrets, no auth —
 * the gateway is never exposed publicly.
 */

export interface SimState {
  clock: { simTime: string; simMinute: number; scale: number; paused: boolean };
  simTime: string;
  scale: number;
  paused: boolean;
  ingestLagSeconds: number;
  outdoorDbtC?: number;
  relativeHumidityPct?: number;
  occupancyMultiplier?: number;
  gatewayPreset?: string;
  activeScenarios?: string[];
  activeFaults?: string[];
}

export interface ScenarioInfo {
  name: string;
  tier: string;
  description?: string;
}

export interface ChecklistFeature {
  featureId: string;
  title: string;
  scenario: string;
  docRef?: string;
  status?: 'pass' | 'fail' | 'skipped' | 'pending' | null;
  runId?: string | null;
  evidence?: string | null;
}

export type GatewayPreset =
  | 'ok'
  | 'reject'
  | 'ignore'
  | 'apply-then-alarm'
  | 'drift'
  | 'local-mode';

export class SimClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  state(): Promise<SimState> {
    return this.request('GET', '/sim/state');
  }

  setClock(body: { scale?: number; paused?: boolean; seek?: string }): Promise<SimState['clock']> {
    return this.request('POST', '/sim/clock', body);
  }

  listScenarios(): Promise<{ scenarios: ScenarioInfo[] }> {
    return this.request('GET', '/sim/scenarios');
  }

  startScenario(name: string, seed: number): Promise<unknown> {
    return this.request('POST', `/sim/scenarios/${encodeURIComponent(name)}/start`, { seed });
  }

  stopScenario(name: string): Promise<unknown> {
    return this.request('POST', `/sim/scenarios/${encodeURIComponent(name)}/stop`, {});
  }

  setEnv(body: { outdoor_dbt?: number; rh?: number; occupancy_mult?: number }): Promise<{ outdoor_dbt: number; rh: number; occupancy_mult: number }> {
    return this.request('POST', '/sim/env', body);
  }

  injectFault(body: { type: string; target: string; params?: Record<string, unknown>; duration?: number }): Promise<unknown> {
    return this.request('POST', '/sim/faults', body);
  }

  removeFault(id: string): Promise<unknown> {
    return this.request('DELETE', `/sim/faults/${encodeURIComponent(id)}`);
  }

  setGateway(body: { preset: GatewayPreset; latencyMs: number; failureRate: number }): Promise<unknown> {
    return this.request('PUT', '/sim/gateway', body);
  }

  checklist(): Promise<{ features: ChecklistFeature[] }> {
    return this.request('GET', '/sim/checklist');
  }
}
