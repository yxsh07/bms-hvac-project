import { describe, expect, it } from 'vitest';
import { ingestBatch } from '../src/ingest/worker.js';
import { FakeSource, makeContext, sourceRow } from './helpers.js';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:01:00.000Z';
const T2 = '2026-01-01T00:02:00.000Z';

describe('ingest worker quality pipeline (§7.5)', () => {
  it('keeps bad rows but marks them with quality codes 1–4 and preserves raw_value', async () => {
    const ctx = await makeContext();
    const rows = [
      sourceRow(1, 'chiller-01', 'CHWST', -273.15, T0), // sentinel → 1
      sourceRow(2, 'chiller-01', 'CHWRT', 200, T1), // out of range → 2
      sourceRow(3, 'chiller-01', 'RUN', 0, T2),
      sourceRow(4, 'chiller-01', 'CWST', 25, T2), // stopped → 3
      sourceRow(5, 'ahu-01', 'RUN', 0, T2),
      sourceRow(6, 'ahu-01', 'FANSPD', 50, T2), // inconsistent → 4
      sourceRow(7, 'chiller-01', 'KW', 100, T2), // good → 0
      sourceRow(8, 'ghost-1', 'MYSTERY', 1, T2), // unknown entity
    ];

    const stats = await ingestBatch(
      ctx.store,
      new FakeSource(rows),
      ctx.config,
      { ontology: ctx.ontology, pointRoles: ctx.pointRoles },
      100,
    );

    expect(stats.stored).toBe(8);
    expect(stats.byQuality[1]).toBe(1);
    expect(stats.byQuality[2]).toBe(1);
    expect(stats.byQuality[3]).toBe(1);
    expect(stats.byQuality[4]).toBe(1);
    expect(stats.unknownEntities).toBe(1);

    const latest = await ctx.store.latest(ctx.config.siteId, 'chiller-01');
    expect(latest.CHWST).toMatchObject({ quality: 1, value: null, rawValue: -273.15 });
    expect(latest.CHWRT).toMatchObject({ quality: 2, value: null, rawValue: 200 });
    expect(latest.CWST).toMatchObject({ quality: 3, value: null, rawValue: 25 });
    expect(latest.KW).toMatchObject({ quality: 0, value: 100, rawValue: null });

    const ahu = await ctx.store.latest(ctx.config.siteId, 'ahu-01');
    expect(ahu.FANSPD).toMatchObject({ quality: 4, value: null, rawValue: 50 });

    // The rows are retained, not deleted or averaged.
    const series = await ctx.store.series({
      siteId: ctx.config.siteId,
      entityId: 'chiller-01',
      field: 'CHWST',
      from: T0,
      to: T2,
      resolution: 'raw',
    });
    expect(series).toHaveLength(1);
    expect(series[0].n).toBe(1);

    // Unknown entity is reported, never silently dropped.
    const report = await ctx.store.listIngestReport(ctx.config.siteId);
    expect(report.some((r) => r.entityId === 'ghost-1')).toBe(true);
    expect(report.find((r) => r.entityId === 'ghost-1')?.fields).toContain('MYSTERY');

    // Cursor advanced in the same batch.
    expect(await ctx.store.getIngestCursor(ctx.config.siteId)).toBe('8');
  });

  it('ignores the device measurement but does not crash', async () => {
    const ctx = await makeContext();
    const rows = [
      sourceRow(1, 'chiller-01', 'KW', 10, T0, 'device'),
      sourceRow(2, 'chiller-01', 'KW', 11, T0, 'components'),
    ];
    const stats = await ingestBatch(
      ctx.store,
      new FakeSource(rows),
      ctx.config,
      { ontology: ctx.ontology, pointRoles: ctx.pointRoles },
      100,
    );
    expect(stats.stored).toBe(1);
    expect((await ctx.store.latest(ctx.config.siteId, 'chiller-01')).KW.value).toBe(11);
  });

  it('advances the cursor so a second run is a no-op', async () => {
    const ctx = await makeContext();
    const source = new FakeSource([sourceRow(1, 'chiller-01', 'KW', 5, T0)]);
    await ingestBatch(ctx.store, source, ctx.config, {
      ontology: ctx.ontology,
      pointRoles: ctx.pointRoles,
    });
    const second = await ingestBatch(ctx.store, source, ctx.config, {
      ontology: ctx.ontology,
      pointRoles: ctx.pointRoles,
    });
    expect(second.fetched).toBe(0);
  });
});
