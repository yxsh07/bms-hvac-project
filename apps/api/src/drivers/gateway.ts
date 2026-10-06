/**
 * Gateway driver (PLAN §7.2, §6.3).
 *
 * The gateway performs the actual field write and read-back. `accepted` never
 * means `applied`: the setpoint service always polls `read`.
 */

import type {
  GatewayDriver,
  GatewayReadResponse,
  GatewayWriteRequest,
  GatewayWriteResponse,
} from '@contracts';

export interface SimHttpGatewayOptions {
  /** Base URL of the gateway, e.g. `http://localhost:8000/gateway`. */
  url: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** SimSite mock-BMS gateway: `POST {url}/write`, `GET {url}/read`. */
export class SimHttpGateway implements GatewayDriver {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: SimHttpGatewayOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async write(req: GatewayWriteRequest): Promise<GatewayWriteResponse> {
    const url = `${this.opts.url.replace(/\/$/, '')}/write`;
    const res = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: req.assetId,
        point: req.point,
        value: req.value,
        idempotencyKey: req.idempotencyKey,
      }),
    });

    if (res.status === 409) {
      let reason = 'rejected by gateway';
      try {
        const body = (await res.json()) as { reason?: string; detail?: string };
        reason = body.reason ?? body.detail ?? reason;
      } catch {
        /* keep default reason */
      }
      return { accepted: false, reason };
    }
    if (!res.ok) return { accepted: false, reason: `gateway HTTP ${res.status}` };

    let accepted = true;
    let reason: string | undefined;
    try {
      const body = (await res.json()) as { accepted?: boolean; reason?: string };
      if (body.accepted === false) {
        accepted = false;
        reason = body.reason;
      }
    } catch {
      /* 202 with no body means accepted */
    }
    return reason ? { accepted, reason } : { accepted };
  }

  async read(siteId: string, assetId: string, point: string): Promise<GatewayReadResponse> {
    const url = new URL(`${this.opts.url.replace(/\/$/, '')}/read`);
    url.searchParams.set('asset', assetId);
    url.searchParams.set('point', point);
    const res = await this.request(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`gateway read HTTP ${res.status}`);
    const body = (await res.json()) as { value?: number | null; at?: string };
    return {
      value: body.value === undefined ? null : body.value,
      at: body.at ?? new Date().toISOString(),
    };
  }
}
