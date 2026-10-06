/**
 * Coverage computation (§7.5)
 *
 * Coverage measures how many distinct minute-buckets have at least one row
 * compared to the number of expected readings in the window.
 *
 * Formula:
 *   expected = floor(windowMinutes * 60 / cadenceSeconds)
 *   pct      = received / expected   (0–1 range; can exceed 1 if cadence varies)
 *
 * Default alert thresholds (for reference — enforcement is in the caller):
 *   CRITICAL: pct < 0.20
 *   WARNING:  pct < 0.50
 */

export interface CoverageResult {
  /** Number of readings expected in the window at the given cadence. */
  expected: number;
  /** Number of distinct minute-buckets that had at least one row. */
  received: number;
  /**
   * Coverage fraction in [0, n] (received / expected).
   * Values > 1.0 indicate higher-than-expected data density.
   * 0 when expected == 0 to avoid division by zero.
   */
  pct: number;
}

/**
 * Compute data coverage for a polling window.
 *
 * @param distinctMinutes  Count of distinct 1-minute buckets that contain ≥ 1 row.
 * @param windowMinutes    Width of the assessment window in minutes.
 * @param cadenceSeconds   Expected polling cadence in seconds (e.g. 60, 300).
 * @returns CoverageResult with expected, received, and pct fields.
 *
 * @throws {RangeError} if windowMinutes or cadenceSeconds are non-positive.
 */
export function computeCoverage(
  distinctMinutes: number,
  windowMinutes: number,
  cadenceSeconds: number,
): CoverageResult {
  if (windowMinutes <= 0) {
    throw new RangeError(`windowMinutes must be positive, got ${windowMinutes}`);
  }
  if (cadenceSeconds <= 0) {
    throw new RangeError(`cadenceSeconds must be positive, got ${cadenceSeconds}`);
  }

  const expected = Math.floor((windowMinutes * 60) / cadenceSeconds);
  const received = Math.max(0, distinctMinutes);
  const pct = expected === 0 ? 0 : received / expected;

  return { expected, received, pct };
}
