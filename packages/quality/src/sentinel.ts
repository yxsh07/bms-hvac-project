/**
 * Sentinel value detection (§7.5 step 3)
 *
 * Sentinel values are engineering nulls — readings whose numeric value is a
 * well-known placeholder (e.g. 9999, -9999, 0xFFFF) that the BMS uses when
 * a sensor is disconnected or in fault.  They carry no physical meaning and
 * must be treated as missing data.
 */

/**
 * Returns true when `value` exactly matches any entry in `sentinelValues`.
 *
 * Equality is checked with `===` (strict numeric equality).  If the caller
 * needs fuzzy matching they should pre-round `value` before calling this.
 *
 * @param value         The raw numeric reading.
 * @param sentinelValues  Array of numeric sentinel constants from site config.
 * @returns true if `value` is a sentinel (quality 1 should be applied).
 */
export function applySentinel(value: number, sentinelValues: number[]): boolean {
  if (sentinelValues.length === 0) return false;
  return sentinelValues.includes(value);
}
