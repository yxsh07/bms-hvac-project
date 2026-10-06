import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/store/memory.js';
import type { TelemetryRow } from '../src/store/types.js';

const SITE = 'simsite-hospital';
const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:10:00.000Z';
const T2 = '2026-01-01T00:20:00.000Z';
const T3 = '2026-01-01T00:30:00.000Z';

function row(field: string, value: number | null, time: string, quality = 0, rawValue: number | null = null): TelemetryRow {
  return {
    siteId: SITE,
    entityId: 'e1',
    entityKind: 'component',
    field,
    time,
    value,
    rawValue,
    quality,
    isDelayed: false,
  };
}

describe('telemetry store', () => {
  it('returns the latest sample per field, preserving quality and raw value', async () => {
    const store = new MemoryStore();
    await store.upsertTelemetry([
      row('T', 10, T0),
      row('T', 30, T3),
      row('X', null, T2, 2, 999),
    ]);

    const latest = await store.latest(SITE, 'e1');
    expect(latest.T).toMatchObject({ value: 30, quality: 0, at: T3 });
    expect(latest.X).toMatchObject({ value: null, quality: 2, rawValue: 999 });
  });

  it('aggregates 1h buckets over good samples only, counting all in n', async () => {
    const store = new MemoryStore();
    await store.upsertTelemetry([
      row('T', 10, T0),
      row('T', 20, T1),
      row('T', null, T2, 2, 999),
      row('T', 30, T3),
    ]);

    const buckets = await store.series({
      siteId: SITE,
      entityId: 'e1',
      field: 'T',
      from: T0,
      to: T3,
      resolution: '1h',
    });
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ avg: 20, min: 10, max: 30, n: 4 });
  });

  it('returns raw samples one per bucket', async () => {
    const store = new MemoryStore();
    await store.upsertTelemetry([row('T', 10, T0), row('T', 30, T3)]);
    const buckets = await store.series({
      siteId: SITE,
      entityId: 'e1',
      field: 'T',
      from: T0,
      to: T3,
      resolution: 'raw',
    });
    expect(buckets).toHaveLength(2);
    expect(buckets[1]).toMatchObject({ t: T3, avg: 30, n: 1 });
  });

  it('computes coverage from distinct minute buckets', async () => {
    const store = new MemoryStore();
    await store.upsertTelemetry([row('T', 10, T0), row('T', 20, T1), row('T', 30, T3)]);
    const cov = await store.coverage(SITE, 'e1', T0, '2026-01-01T01:00:00.000Z', 60);
    expect(cov.expected).toBe(60);
    expect(cov.received).toBe(3);
    expect(cov.pct).toBeCloseTo(5, 0);
  });

  it('sums successive positive counter differences and reports resets', async () => {
    const store = new MemoryStore();
    await store.upsertTelemetry([
      row('E', 100, T0),
      row('E', 150, T1),
      row('E', 70, T2),
      row('E', 120, T3),
    ]);
    const delta = await store.counterDelta({
      siteId: SITE,
      entityId: 'e1',
      field: 'E',
      from: T0,
      to: T3,
    });
    expect(delta.delta).toBe(100);
    expect(delta.resets).toBe(1);
  });

  it('upserts on (site, entity, field, time) instead of duplicating', async () => {
    const store = new MemoryStore();
    await store.upsertTelemetry([row('T', 10, T0), row('T', 12, T0)]);
    const latest = await store.latest(SITE, 'e1');
    expect(latest.T.value).toBe(12);
    const buckets = await store.series({
      siteId: SITE,
      entityId: 'e1',
      field: 'T',
      from: T0,
      to: T0,
      resolution: 'raw',
    });
    expect(buckets).toHaveLength(1);
  });
});
