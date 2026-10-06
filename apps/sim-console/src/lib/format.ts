/**
 * Pure formatting helpers for the Sim Console. Kept dependency-free so they can
 * be unit-tested without a DOM.
 */

/** Format a sim time ISO string as HH:MM (site-local intent; display only). */
export function formatSimClock(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Human label for a clock scale factor (1x .. 600x). */
export function formatScale(scale: number): string {
  if (!Number.isFinite(scale) || scale <= 0) return '—';
  const rounded = Math.round(scale * 100) / 100;
  return `${rounded}×`;
}

export type IngestHealth = 'healthy' | 'throttle' | 'unknown';

/**
 * Decide whether the console should auto-throttle the scale. SimSite is
 * expected to keep ingest lag low; above 30 s of sim backlog we recommend
 * winding the clock down (§6.4).
 */
export function ingestHealth(lagSeconds: number | null | undefined): IngestHealth {
  if (lagSeconds === null || lagSeconds === undefined || !Number.isFinite(lagSeconds)) {
    return 'unknown';
  }
  return lagSeconds > 30 ? 'throttle' : 'healthy';
}

/** Next scale in the 1 → 60 → 600 ladder, for a single throttle button. */
export function nextScale(current: number): number {
  if (current < 60) return 60;
  if (current < 600) return 600;
  return 1;
}

/** Percentage for a slider, clamped to [0, 100]. */
export function clampPercent(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}
