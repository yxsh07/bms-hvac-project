/**
 * Range rule enforcement (§7.5 step 4)
 *
 * Each range rule may optionally scope itself to a classification.  Rules are
 * matched in order; the first rule whose classification matches (or whose
 * classification field is absent/undefined) is used.  A binary status field
 * with value > 1 is also out of range.
 */

import type { RangeRule } from './types.js';

/**
 * Find the applicable range rule for a given classification.
 *
 * Resolution order:
 *  1. First rule whose `classification` matches (case-insensitive).
 *  2. First rule with no `classification` (default/fallback).
 *  3. null — no rule applies; the caller treats the value as ok.
 *
 * @param classification  Ontology class name of the point (e.g. "Temperature").
 * @param rules           Ordered list of range rules from site config.
 */
function findApplicableRule(
  classification: string,
  rules: RangeRule[],
): RangeRule | null {
  const lc = classification.toLowerCase();

  // Pass 1: exact classification match (case-insensitive)
  for (const rule of rules) {
    if (rule.classification !== undefined && rule.classification.toLowerCase() === lc) {
      return rule;
    }
  }

  // Pass 2: default rule (no classification specified)
  for (const rule of rules) {
    if (rule.classification === undefined) {
      return rule;
    }
  }

  return null;
}

/**
 * Returns true when the value is outside the applicable range, meaning quality
 * code 2 (out-of-range) should be applied.
 *
 * Rules (from §7.5):
 *  - A binary status field (expected 0 or 1) with value > 1 is out of range.
 *  - Any value strictly below `min` or strictly above `max` is out of range.
 *  - When no rule matches the classification, the value is considered in-range.
 *
 * @param value           The (already sentinel-passed) numeric reading.
 * @param classification  Ontology class name used for rule resolution.
 * @param rangeRules      Ordered range rules from site config.
 * @returns true if out-of-range (quality 2 should be applied).
 */
export function applyRange(
  value: number,
  classification: string,
  rangeRules: RangeRule[],
): boolean {
  const rule = findApplicableRule(classification, rangeRules);
  if (rule === null) return false;

  return value < rule.min || value > rule.max;
}
