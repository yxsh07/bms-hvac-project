import { describe, expect, it, vi } from 'vitest';
import { SimHttpSource } from '../src/drivers/source.js';

describe('SimHttpSource', () => {
  it('reads raw telemetry and advances the sequence cursor', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      points: [{
        seq: 42,
        time: '2026-07-12T00:01:00+00:00',
        measurement: 'components',
        entity_id: 'ahu-01',
        field: 'SAT',
        value: 13.9,
        is_delayed: false,
      }],
      cursor: 42,
    }), { status: 200 }));
    const source = new SimHttpSource({
      baseUrl: 'http://sim:8000',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const batch = await source.next('41', 100);

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://sim:8000/sim/raw?since=41&limit=100',
      { headers: { Accept: 'application/json' } },
    );
    expect(batch.cursor).toBe('42');
    expect(batch.rows).toEqual([{
      seq: '42',
      time: '2026-07-12T00:01:00+00:00',
      measurement: 'components',
      entityId: 'ahu-01',
      field: 'SAT',
      value: 13.9,
      isDelayed: false,
    }]);
  });
});
