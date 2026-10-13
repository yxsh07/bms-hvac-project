/**
 * SimSite client (PLAN 6.3; task WIF1).
 *
 * The what-if endpoint lives on the simulator, not the /api/v1 app, so it gets
 * its own small client. The wire shape mirrors packages/contracts/src/whatif.ts;
 * the simulator is the source of truth.
 */

/** The mandatory disclaimer on every what-if surface (PLAN 5.9, R7). */
export const WHATIF_LABEL = 'indicative, 3-day calibration';

export interface WhatIfSample {
  t: string;
  kw: number;
  deltaTC: number;
  tr: number;
  chwLeavingC: number | null;
  condenserEnteringC: number | null;
}

export interface WhatIfSummary {
  meanKw: number;
  peakKw: number;
  meanDeltaTC: number;
  points: number;
}

export interface WhatIfEnvelope {
  kind: string;
  trainedOnDays: number;
  tolerancePct: number;
  insideEnvelopePct: number;
  exceeded: boolean;
  fallbackActive: boolean;
  breaches: string[];
  warning: string | null;
}

export interface WhatIfResult {
  label: string;
  horizonMin: number;
  stepMinutes: number;
  liveStateUnchanged: boolean;
  baseline: WhatIfSummary;
  predicted: WhatIfSummary & { series: WhatIfSample[] };
  baselineSeries: WhatIfSample[];
  delta: { meanKw: number; meanDeltaTC: number };
  envelope: WhatIfEnvelope;
  warning: string | null;
}

export interface WhatIfSetpointChange {
  type: 'setpoint';
  target?: string;
  field?: string;
  value: number;
}

export interface WhatIfEnvChange {
  type: 'env';
  outdoor_dbt?: number;
  rh?: number;
  occupancy_mult?: number;
}

export interface WhatIfFaultChange {
  type: 'fault';
  fault: string;
  target?: string;
  durationMin?: number;
}

export type WhatIfChange = WhatIfSetpointChange | WhatIfEnvChange | WhatIfFaultChange;

export interface WhatIfRequest {
  changes: WhatIfChange[];
  horizonMin?: number;
  stepMinutes?: number;
}

export function defaultSimUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return env.VITE_SIM_URL ?? 'http://localhost:8000';
}

export class SimClient {
  constructor(private readonly baseUrl: string = defaultSimUrl()) {}

  async whatIf(req: WhatIfRequest): Promise<WhatIfResult> {
    const res = await fetch(this.baseUrl.replace(/\/$/, '') + '/sim/whatif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(req),
    });
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json ?? {}) as { detail?: string; error?: string };
      throw new Error(err.detail ?? err.error ?? `SimSite error ${res.status}`);
    }
    return json as WhatIfResult;
  }
}
