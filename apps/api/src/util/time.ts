/**
 * Time helpers (PLAN §7.1).
 *
 * Internally everything is UTC. Responses use ISO-8601 with an explicit offset
 * (`Z` for UTC) so `z.string().datetime()` in the contracts package validates.
 * The site timezone is carried on the config for display/report scheduling and
 * is never used to do arithmetic on the wire.
 */

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoAt(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Normalise any parseable timestamp to UTC ISO-8601 with a `Z` suffix.
 * Source exports and the simulator may send `+00:00`; the contracts require the
 * UTC form (`z.string().datetime()` rejects explicit offsets by default).
 */
export function toUtcIso(value: string): string {
  return new Date(parseIso(value)).toISOString();
}

/** Parse an ISO string to epoch ms; throws on invalid input. */
export function parseIso(value: string): number {
  const t = Date.parse(value);
  if (Number.isNaN(t)) throw new Error(`invalid ISO timestamp: ${value}`);
  return t;
}

export function addSeconds(iso: string, seconds: number): string {
  return isoAt(parseIso(iso) + seconds * 1000);
}

export function addMinutes(iso: string, minutes: number): string {
  return isoAt(parseIso(iso) + minutes * 60_000);
}

export function minutesBetween(a: string, b: string): number {
  return (parseIso(b) - parseIso(a)) / 60_000;
}

/** A window token ("1h", "24h", "7d", "1d", "15m", or seconds) → duration ms. */
export function windowToMs(window: string): number {
  const m = /^(\d+)([smhd])$/.exec(window.trim());
  if (!m) {
    const n = Number(window);
    if (Number.isFinite(n) && n > 0) return n * 1000;
    throw new Error(`invalid window: ${window}`);
  }
  const n = Number(m[1]);
  const unit = m[2];
  const scale = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * scale;
}

/** Resolve a window token to a `{ from, to }` ISO range ending at `now`. */
export function windowToRange(window: string, now: Date = new Date()): { from: string; to: string } {
  const ms = windowToMs(window);
  return { from: new Date(now.getTime() - ms).toISOString(), to: now.toISOString() };
}
