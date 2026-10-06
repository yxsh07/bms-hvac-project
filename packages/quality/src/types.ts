/**
 * Quality layer core types (§7.5)
 *
 * QualityCode encoding:
 *   0 = ok
 *   1 = sentinel value (engineering null)
 *   2 = out-of-range
 *   3 = stopped-equipment suppression
 *   4 = consistency violation
 */

// ── Quality Code ──────────────────────────────────────────────────────────────

/** Numeric quality code attached to every qualified measurement. */
export type QualityCode = 0 | 1 | 2 | 3 | 4;

export const QualityCodeOk: QualityCode = 0;
export const QualityCodeSentinel: QualityCode = 1;
export const QualityCodeOutOfRange: QualityCode = 2;
export const QualityCodeStoppedEquipment: QualityCode = 3;
export const QualityCodeInconsistent: QualityCode = 4;

// ── Raw / Qualified Rows ──────────────────────────────────────────────────────

/**
 * A single measurement row as it arrives from the source driver.
 * Field names mirror the ingest schema (§7.2 / D-09).
 */
export interface RawRow {
  /** Monotonically increasing sequence number from the source. */
  seq: number;
  /** ISO-8601 timestamp string of the measurement. */
  time: string;
  /** InfluxDB / source measurement name (e.g. "components"). */
  measurement: string;
  /** Source entity identifier (tag value). */
  entityId: string;
  /** Field name within the measurement. */
  field: string;
  /** Raw numeric value as received. */
  value: number;
  /** True when this row arrived outside the expected polling window. */
  isDelayed: boolean;
}

/**
 * A measurement row after quality rules have been applied.
 *
 * - `qualifiedValue` is null when quality != 0 (the value was suppressed).
 * - `rawValue` always preserves the original reading for audit purposes.
 * - `quality` is the first failing rule's code (rules are short-circuit in order).
 */
export interface QualifiedRow extends RawRow {
  /** Null-suppressed value; null when quality != 0. */
  qualifiedValue: number | null;
  /** Quality code produced by the pipeline. 0 means the value passed all rules. */
  quality: QualityCode;
  /** Original value, always preserved even when quality != 0. */
  rawValue: number;
}

// ── Configuration Types ───────────────────────────────────────────────────────

/**
 * Min/max range rule, optionally scoped to a specific point classification.
 * Classification is matched case-insensitively against the ontology class name.
 * An entry with no classification acts as a fallback default.
 */
export interface RangeRule {
  /**
   * Ontology classification (e.g. "Temperature", "Pressure").
   * Omit to apply the rule to all classifications not otherwise matched.
   */
  classification?: string;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound. */
  max: number;
}

/**
 * Consistency rule: when a trigger condition is satisfied, an associated
 * field must satisfy a constraint.
 *
 * Example: { when: { field: "run-status", value: 0 }, then: { field: "fan-speed", max: 0 } }
 */
export interface ConsistencyRule {
  /** Field whose value acts as the trigger. */
  triggerField: string;
  /** Value (exact match) that activates the rule. */
  triggerValue: number;
  /** Field whose value is checked against the constraint. */
  targetField: string;
  /** If provided, the target field value must be >= this. */
  targetMin?: number;
  /** If provided, the target field value must be <= this. */
  targetMax?: number;
  /** If provided, the target field value must exactly equal this. */
  targetExact?: number;
}

/**
 * Top-level quality configuration for a site.
 * Keyed by field/classification; site-agnostic (no hardcoded names).
 */
export interface SiteQualityConfig {
  /**
   * List of numeric values that indicate "no reading" (e.g. 9999, -9999, 0xFFFF).
   * Applied to every field regardless of classification.
   */
  sentinelValues: number[];

  /**
   * Range rules, matched in order. First rule whose classification matches
   * (or whose classification is absent) wins.
   */
  ranges: RangeRule[];

  /**
   * Ontology classifications that represent process values and should be
   * suppressed when the associated equipment is stopped.
   * Defaults to ["Temperature", "Pressure", "Flow Sensor"] when omitted.
   */
  suppressProcessValuesWhenStopped?: string[];

  /**
   * Consistency rules evaluated after sentinel/range/stopped checks.
   */
  consistencyRules?: ConsistencyRule[];
}

/**
 * Runtime context supplied alongside each row during qualification.
 * Avoids global state: callers gather needed values from their data store
 * and pass them in.
 */
export interface QualifyContext {
  /**
   * The ontology classification of this point (e.g. "Temperature").
   * Used for range rule matching and stopped-equipment suppression decisions.
   */
  classification: string;

  /**
   * Current run-status value for the equipment that owns this point.
   * 0 = stopped, non-zero = running.
   * Null when no run-status is available (rule is skipped).
   */
  runStatus: number | null;

  /**
   * Related field values at the same timestamp for consistency checking.
   * Map of fieldName → numeric value.
   */
  relatedValues: Record<string, number>;
}
