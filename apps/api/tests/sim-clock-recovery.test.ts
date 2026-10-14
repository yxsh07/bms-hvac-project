import { expect, it } from 'vitest';
import { resumeSimClock } from '../src/server.js';
import { makeContext } from './helpers.js';

it('seeks a restarted simulator beyond persisted site samples and primes a new reading', async () => {
  const { store, config } = await makeContext();
  const asset = (await store.listAssets(config.siteId))[0];
  await store.upsertTelemetry([{
    siteId: config.siteId, entityId: asset.id, entityKind: 'component', field: asset.points[0].abbr,
    time: '2026-07-15T02:20:00.000Z', value: 1, rawValue: null, quality: 0, isDelayed: false,
  }]);
  const calls: Array<{ url: string; body?: string }> = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body as string | undefined });
    return new Response(JSON.stringify(url.endsWith('/sim/state')
      ? { clock: { simTime: '2026-07-12T00:06:00Z' } } : {}), { status: 200 });
  }) as typeof fetch;
  await resumeSimClock(store, config.siteId, 'http://sim:8000', fakeFetch);
  expect(calls.map(({ url }) => url)).toEqual([
    'http://sim:8000/sim/state', 'http://sim:8000/sim/clock', 'http://sim:8000/sim/run',
  ]);
  expect(JSON.parse(calls[1].body ?? '')).toEqual({ seek: '2026-07-15T02:20:00.000Z' });
});
