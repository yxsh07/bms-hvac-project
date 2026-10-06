/**
 * Consistency rule evaluation (§7.5 step 6)
 *
 * Consistency rules encode invariants between two fields on the same equipment.
 * Example: when run-status = 0, fan-speed must be 0.
 *
 * When a rule fires the dependent value is kept (not nulled) with quality 4
 * so operators can see both values and decide which side is wrong (D-07).
 * The pipeline never guesses which measurement is authoritative.
 */

import type { ConsistencyRule, QualityCode } from './types.js';
import { QualityCodeInconsistent, QualityCodeOk } from './types.js';

/**
 * Evaluate all consistency rules against the current row and its related
 * measurements.
 *
 * A rule fires when:
 *  1. The trigger field is present in `relatedValues` with the trigger value.
 *  2. The target field matches the current row's `field`.
 *  3. The target value violates the constraint (targetMin / targetMax / targetExact).
 *
 * Only the first firing rule contributes; subsequent rules are not checked once
 * quality 4 is set (short-circuit for efficiency).
 *
 * @param field         The field name of the current row.
 * @param value         The (already sentinel/range/stopped passed) numeric value.
 * @param relatedValues Map of other field values at the same timestamp.
 * @param rules         Consistency rules from site config.
 * @returns QualityCode 4 if any rule fires, 0 otherwise.
 */
export function applyConsistencyRules(
  field: string,
  value: number,
  relatedValues: Record<string, number>,
  rules: ConsistencyRule[],
): QualityCode {
  for (const rule of rules) {
    // Only evaluate rules targeting this field.
    if (rule.targetField !== field) continue;

    // Check if the trigger condition is active.
    const triggerValue = relatedValues[rule.triggerField];
    if (triggerValue === undefined) continue;
    if (triggerValue !== rule.triggerValue) continue;

    // Trigger is active — evaluate the constraint against `value`.
    const violated = isConstraintViolated(value, rule);
    if (violated) return QualityCodeInconsistent;
  }

  return QualityCodeOk;
}

/** Returns true when `value` violates the constraint defined in `rule`. */
function isConstraintViolated(value: number, rule: ConsistencyRule): boolean {
  if (rule.targetExact !== undefined && value !== rule.targetExact) return true;
  if (rule.targetMin !== undefined && value < rule.targetMin) return true;
  if (rule.targetMax !== undefined && value > rule.targetMax) return true;
  return false;
}

// Re-export ConsistencyRule so callers only need one import.
export type { ConsistencyRule };
