/**
 * Stopped-equipment suppression (§7.5 step 5)
 *
 * When a piece of equipment is stopped (run-status = 0), its process-value
 * measurements (Temperature, Pressure, Flow Sensor — configurable) become
 * physically meaningless and are suppressed (quality 3).
 *
 * The following point types are NEVER suppressed regardless of run-status:
 *   • Counters        (energy meters, cycle counters)
 *   • Status / binary (run-status itself, fault flags, alarms)
 *   • Set points      (operator target values)
 *   • Alarms          (alarm states)
 *
 * This list is encoded as a hard exclusion set to avoid accidentally
 * suppressing data that would confuse operators or break alarm logic.
 */

import type { RawRow } from './types.js';

/**
 * Default process-value classifications that may be suppressed.
 * Overridable via SiteQualityConfig.suppressProcessValuesWhenStopped.
 */
export const DEFAULT_PROCESS_VALUE_CLASSES: ReadonlyArray<string> = [
  'Temperature',
  'Pressure',
  'Flow Sensor',
];

/**
 * Classifications that are NEVER suppressed.
 * Case-insensitive comparison is used.
 */
const NEVER_SUPPRESS_CLASSES: ReadonlyArray<string> = [
  'Counter',
  'Status',
  'Binary',
  'Set Point',
  'Setpoint',
  'Alarm',
  'Fault',
];

/**
 * Returns true when a measurement should be suppressed due to the associated
 * equipment being stopped, meaning quality code 3 should be applied.
 *
 * Short-circuits immediately if:
 *  - runStatus is not 0 (equipment is running → never suppress)
 *  - classification is in the never-suppress set
 *  - classification is not in the configurable suppress list
 *
 * @param _row               The raw measurement row (reserved for future field-level overrides).
 * @param runStatus          Current run-status of the owning equipment (0 = stopped).
 *                           Pass null when run-status is unavailable → rule is skipped.
 * @param classification     Ontology classification of this point.
 * @param suppressClasses    Configurable list of classifications to suppress;
 *                           defaults to DEFAULT_PROCESS_VALUE_CLASSES when omitted.
 * @returns true if the value should be suppressed (quality 3).
 */
export function applyStoppedEquipment(
  _row: RawRow,
  runStatus: number | null,
  classification: string,
  suppressClasses: ReadonlyArray<string> = DEFAULT_PROCESS_VALUE_CLASSES,
): boolean {
  // Rule does not apply when we have no run-status information.
  if (runStatus === null) return false;

  // Equipment is running — never suppress.
  if (runStatus !== 0) return false;

  const lc = classification.toLowerCase();

  // Hard exclusions — never suppress these regardless of config.
  const neverSuppress = NEVER_SUPPRESS_CLASSES.some(
    (cls) => cls.toLowerCase() === lc,
  );
  if (neverSuppress) return false;

  // Suppress only when the classification is in the configured process list.
  return suppressClasses.some((cls) => cls.toLowerCase() === lc);
}
