/**
 * Pure telemetry aggregation helpers shared by the memory and pg stores.
 *
 * Rollups exclude non-good samples from avg/min/max (§7.4: `avg(value) FILTER
 * (WHERE quality = 0)`) but count every sample in `n` so a chart can mark a
 * partial bucket.
 */

import type { SeriesBucket, SeriesQuery, CounterQuery } from '@contracts';
import type { Coverage, TelemetryRow } from './types.js';

function sortByTime(rows: TelemetryRow[]): TelemetryRow[] {
  return [...rows].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

export function latestFrom(rows: TelemetryRow[]): TelemetryRow | null {
  let best: TelemetryRow | null = null;
  for (const row of rows) {
    if (!best || row.time > best.time) best = row;
  }
  return best;
}

function bucketStart(iso: string, resolution: '1h' | '1d'): string {
  const d = new Date(iso);
  if (resolution === '1d') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()),
  ).toISOString();
}

export function seriesFrom(rows: TelemetryRow[], q: SeriesQuery): SeriesBucket[] {
  const inWindow = sortByTime(
    rows.filter((r) => r.time >= q.from && r.time <= q.to),
  );

  if (q.resolution === 'raw') {
    return inWindow.map((r) => ({
      t: r.time,
      avg: r.value,
      min: r.value,
      max: r.value,
      n: 1,
    }));
  }

  const groups = new Map<string, TelemetryRow[]>();
  for (const row of inWindow) {
    const key = bucketStart(row.time, q.resolution);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([t, list]) => {
      const good = list.filter((r) => r.quality === 0 && r.value !== null);
      const values = good.map((r) => r.value as number);
      return {
        t,
        avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        n: list.length,
      };
    });
}

export function coverageFrom(
  rows: TelemetryRow[],
  from: string,
  to: string,
  cadenceSeconds: number,
): Coverage {
  const windowMs = Math.max(0, Date.parse(to) - Date.parse(from));
  const expected = cadenceSeconds > 0 ? Math.floor(windowMs / 1000 / cadenceSeconds) : 0;

  const minutes = new Set<string>();
  for (const row of rows) {
    if (row.time < from || row.time > to) continue;
    const d = new Date(row.time);
    minutes.add(
      `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}T${d.getUTCHours()}:${d.getUTCMinutes()}`,
    );
  }
  const received = minutes.size;
  const pct = expected === 0 ? (received > 0 ? 100 : 0) : Math.min(100, (received / expected) * 100);
  return { expected, received, pct };
}

/**
 * Counter consumption = sum of successive positive differences of good
 * samples, with reset count reported (§7.10 report 1: never max − min).
 */
export function counterDeltaFrom(
  rows: TelemetryRow[],
  q: CounterQuery,
): { delta: number; resets: number } {
  const samples = sortByTime(
    rows.filter((r) => r.time >= q.from && r.time <= q.to),
  ).filter((r) => r.quality === 0 && r.value !== null) as Array<TelemetryRow & { value: number }>;

  let delta = 0;
  let resets = 0;
  for (let i = 1; i < samples.length; i++) {
    const diff = samples[i].value - samples[i - 1].value;
    if (diff >= 0) delta += diff;
    else resets += 1;
  }
  return { delta, resets };
}
