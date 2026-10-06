/**
 * Shared test fixtures: config, ontology, store, fake gateway/source/clock.
 */

import type { GatewayDriver, GatewayReadResponse, GatewayWriteRequest, GatewayWriteResponse } from '@contracts';
import { JsonOntologyDriver, type Ontology } from '@ontology';
import { AuditChain } from '../src/audit/chain.js';
import { loadConfig, type LoadedConfig } from '../src/config.js';
import { loadPointRoles, type PointRolesData } from '../src/domain/classify.js';
import { materializeAssets } from '../src/domain/ontology.js';
import { MemoryStore } from '../src/store/memory.js';
import type { SourceBatch, SourceDriver, SourceRow } from '../src/drivers/source.js';
import { SetpointService, type SetpointPointInfo } from '../src/services/setpoints.js';

export interface TestContext {
  config: LoadedConfig;
  store: MemoryStore;
  chain: AuditChain;
  ontology: Ontology;
  pointRoles: PointRolesData;
}

export async function makeContext(opts: { auditKey?: string; clock?: () => string } = {}): Promise<TestContext> {
  const config = await loadConfig();
  const store = new MemoryStore({ auditKey: opts.auditKey ?? 'test-audit-key', clock: opts.clock });
  const chain = new AuditChain(store, { key: opts.auditKey ?? 'test-audit-key', clock: opts.clock });
  const ontology = await new JsonOntologyDriver(config.paths.ontology).load(config.siteId);
  const pointRoles = loadPointRoles(config.paths.pointRoles);
  await store.upsertAssets(config.siteId, materializeAssets(ontology, config.siteId));
  return { config, store, chain, ontology, pointRoles };
}

// ── Fake clock ───────────────────────────────────────────────────────────────

export interface FakeClock {
  now(): string;
  advance(seconds: number): void;
  set(iso: string): void;
}

export function fakeClock(start = '2026-01-01T00:00:00.000Z'): FakeClock {
  let ms = Date.parse(start);
  return {
    now: () => new Date(ms).toISOString(),
    advance: (seconds) => {
      ms += seconds * 1000;
    },
    set: (iso) => {
      ms = Date.parse(iso);
    },
  };
}

// ── Fake gateway ─────────────────────────────────────────────────────────────

export type GatewayPreset = 'ok' | 'reject' | 'ignore' | 'drift' | 'apply-then-alarm';

export class FakeGateway implements GatewayDriver {
  readonly values = new Map<string, number>();
  alarm = false;

  constructor(public preset: GatewayPreset = 'ok') {}

  private key(assetId: string, point: string): string {
    return `${assetId}:${point}`;
  }

  async write(req: GatewayWriteRequest): Promise<GatewayWriteResponse> {
    if (this.preset === 'reject') return { accepted: false, reason: 'local-mode rejection' };
    if (this.preset === 'ignore') return { accepted: true };
    const value = this.preset === 'drift' ? req.value + 5 : req.value;
    this.values.set(this.key(req.assetId, req.point), value);
    if (this.preset === 'apply-then-alarm') this.alarm = true;
    return { accepted: true };
  }

  async read(_siteId: string, assetId: string, point: string): Promise<GatewayReadResponse> {
    return {
      value: this.values.get(this.key(assetId, point)) ?? null,
      at: new Date().toISOString(),
    };
  }
}

// ── Fake source ──────────────────────────────────────────────────────────────

export class FakeSource implements SourceDriver {
  constructor(private readonly rows: SourceRow[]) {}

  async next(cursor: string | null, limit: number): Promise<SourceBatch> {
    const from = cursor ? Number(cursor) : 0;
    const page = this.rows.slice(from, from + limit);
    return { rows: page, cursor: page.length ? String(from + page.length) : cursor ?? '0' };
  }
}

export function sourceRow(
  seq: number,
  entityId: string,
  field: string,
  value: number,
  time = '2026-01-01T00:00:00.000Z',
  measurement = 'components',
): SourceRow {
  return { seq: String(seq), time, measurement, entityId, field, value, isDelayed: false };
}

// ── Setpoint service factory ─────────────────────────────────────────────────

export interface ServiceOptions {
  store: MemoryStore;
  config: LoadedConfig;
  ontology: Ontology;
  gateway: FakeGateway;
  clock: FakeClock;
  controlMode?: (siteId: string, assetId: string) => Promise<string | null>;
  hasAlarm?: () => boolean | Promise<boolean>;
  resolvePoint?: (siteId: string, assetId: string, field: string) => Promise<SetpointPointInfo | null>;
}

export function makeService(opts: ServiceOptions): SetpointService {
  return new SetpointService({
    store: opts.store,
    config: opts.config,
    gateway: opts.gateway,
    clock: opts.clock.now,
    controlMode: opts.controlMode,
    hasAlarm: async () => (opts.hasAlarm ? opts.hasAlarm() : opts.gateway.alarm),
    resolvePoint:
      opts.resolvePoint ??
      (async (_siteId, assetId, field) => {
        const asset = opts.ontology.assets.find((a) => a.id === assetId);
        const point = (opts.ontology.points[assetId] ?? []).find((p) => p.abbr === field);
        if (!asset || !point) return null;
        return {
          assetId,
          assetName: asset.name,
          field,
          display: point.display,
          unit: point.unit,
          writable: point.writable,
          safeMin: point.safeMin ?? 0,
          safeMax: point.safeMax ?? 100,
        };
      }),
  });
}
