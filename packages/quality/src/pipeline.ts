/**
 * Quality pipeline — qualifyRow (§7.5)
 *
 * Applies all quality rules in the mandated order:
 *   1. Sentinel  → quality 1
 *   2. Range     → quality 2
 *   3. Stopped   → quality 3
 *   4. Consistency → quality 4
 *
 * Rules short-circuit: the first failing rule wins and later rules are not
 * evaluated (there is no point ranging a sentinel, for example).
 *
 * When quality != 0:
 *   - qualifiedValue is set to null (value suppressed)
 *   - rawValue preserves the original reading for audit / reporting
 *
 * When quality == 0:
 *   - qualifiedValue == rawValue (pass-through)
 */

import { applySentinel } from './sentinel.js';
import { applyRange } from './range.js';
import { applyStoppedEquipment, DEFAULT_PROCESS_VALUE_CLASSES } from './stopped.js';
import { applyConsistencyRules } from './consistency.js';
import type {
  RawRow,
  QualifiedRow,
  SiteQualityConfig,
  QualifyContext,
  QualityCode,
} from './types.js';
import {
  QualityCodeOk,
  QualityCodeSentinel,
  QualityCodeOutOfRange,
  QualityCodeStoppedEquipment,
} from './types.js';

/**
 * Qualify a single raw measurement row by running it through the full
 * quality pipeline.
 *
 * @param row     Raw measurement as received from the source driver.
 * @param config  Site-level quality configuration.
 * @param ctx     Runtime context (classification, run-status, related values).
 * @returns A QualifiedRow with quality code, qualified value, and preserved raw value.
 */
export function qualifyRow(
  row: RawRow,
  config: SiteQualityConfig,
  ctx: QualifyContext,
): QualifiedRow {
  const rawValue = row.value;
  let quality: QualityCode = QualityCodeOk;

  // ── Step 1: Sentinel ────────────────────────────────────────────────────────
  if (applySentinel(rawValue, config.sentinelValues)) {
    quality = QualityCodeSentinel;
  }

  // ── Step 2: Range ───────────────────────────────────────────────────────────
  if (quality === QualityCodeOk) {
    if (applyRange(rawValue, ctx.classification, config.ranges)) {
      quality = QualityCodeOutOfRange;
    }
  }

  // ── Step 3: Stopped equipment ───────────────────────────────────────────────
  if (quality === QualityCodeOk) {
    const suppressClasses =
      config.suppressProcessValuesWhenStopped ?? DEFAULT_PROCESS_VALUE_CLASSES;

    if (
      applyStoppedEquipment(row, ctx.runStatus, ctx.classification, suppressClasses)
    ) {
      quality = QualityCodeStoppedEquipment;
    }
  }

  // ── Step 4: Consistency ─────────────────────────────────────────────────────
  if (quality === QualityCodeOk) {
    const consistencyRules = config.consistencyRules ?? [];
    quality = applyConsistencyRules(
      row.field,
      rawValue,
      ctx.relatedValues,
      consistencyRules,
    );
  }

  // ── Produce qualified row ───────────────────────────────────────────────────
  return {
    ...row,
    rawValue,
    qualifiedValue: quality === QualityCodeOk ? rawValue : null,
    quality,
  };
}
