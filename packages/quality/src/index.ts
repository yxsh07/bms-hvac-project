/**
 * Public API surface for @bms/quality (§7.5)
 *
 * Re-exports everything needed by downstream packages (ingest worker,
 * report runner, tests).  Internal helpers stay private to their modules.
 */

// Types
export type {
  QualityCode,
  RawRow,
  QualifiedRow,
  RangeRule,
  ConsistencyRule,
  SiteQualityConfig,
  QualifyContext,
} from './types.js';

export {
  QualityCodeOk,
  QualityCodeSentinel,
  QualityCodeOutOfRange,
  QualityCodeStoppedEquipment,
  QualityCodeInconsistent,
} from './types.js';

// Rules
export { applySentinel } from './sentinel.js';
export { applyRange } from './range.js';
export { applyStoppedEquipment, DEFAULT_PROCESS_VALUE_CLASSES } from './stopped.js';
export { applyConsistencyRules } from './consistency.js';

// Pipeline
export { qualifyRow } from './pipeline.js';

// Coverage
export { computeCoverage } from './coverage.js';
export type { CoverageResult } from './coverage.js';
