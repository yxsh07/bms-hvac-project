import { expect, it } from 'vitest';
import { makeContext } from './helpers.js';
import { resolveRoleAbbrev } from '../src/domain/classify.js';
import { floorsSummary, plantKpis } from '../src/services/analytics.js';

it('uses the latest site timestamp for simulator floor windows', async () => {
  const ctx = await makeContext();
  const assets = await ctx.store.listAssets(ctx.config.siteId);
  const asset = assets.find((entry) => entry.floorId && resolveRoleAbbrev(ctx.pointRoles, entry.type, 'area-temp'));
  expect(asset).toBeDefined();
  const field = resolveRoleAbbrev(ctx.pointRoles, asset!.type, 'area-temp')!;
  await ctx.store.upsertTelemetry([{
    siteId: ctx.config.siteId, entityId: asset!.id, entityKind: 'component', field,
    time: '2026-01-01T00:30:00.000Z', value: 23, rawValue: null, quality: 0, isDelayed: false,
  }]);
  await ctx.store.upsertTelemetry([{
    siteId: ctx.config.siteId, entityId: asset!.id, entityKind: 'component', field,
    time: '2026-07-14T00:30:00.000Z', value: 35, rawValue: null, quality: 0, isDelayed: false,
  }]);
  const currentRun = await floorsSummary(ctx.store, ctx.ontology, ctx.pointRoles, ctx.config, '1h', new Date('2026-01-01T00:30:00.000Z'));
  expect(currentRun.floors.find((floor) => floor.id === asset!.floorId)?.avgTempC).toBe(23);
  const summary = await floorsSummary(ctx.store, ctx.ontology, ctx.pointRoles, ctx.config, '1h');
  expect(summary.floors.find((floor) => floor.id === asset!.floorId)?.avgTempC).toBe(35);
});

it('uses current-run power rather than a later sample from an earlier run', async () => {
  const ctx = await makeContext();
  const assets = await ctx.store.listAssets(ctx.config.siteId);
  const asset = assets.find((entry) => resolveRoleAbbrev(ctx.pointRoles, entry.type, 'power-kw'));
  expect(asset).toBeDefined();
  const field = resolveRoleAbbrev(ctx.pointRoles, asset!.type, 'power-kw')!;
  for (const [time, value] of [['2026-01-01T00:30:00.000Z', 10], ['2026-07-14T00:30:00.000Z', 90]] as const) {
    await ctx.store.upsertTelemetry([{
      siteId: ctx.config.siteId, entityId: asset!.id, entityKind: 'component', field,
      time, value, rawValue: null, quality: 0, isDelayed: false,
    }]);
  }
  const kpis = await plantKpis(ctx.store, ctx.ontology, ctx.pointRoles, ctx.config, '1h', new Date('2026-01-01T00:30:00.000Z'));
  expect(kpis.totalKw).toBe(10);
});
