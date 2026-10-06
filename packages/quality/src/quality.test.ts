/**
 * Unit tests for the quality layer (§7.5)
 *
 * Table-driven, covering:
 *   - applySentinel
 *   - applyRange
 *   - applyStoppedEquipment
 *   - applyConsistencyRules
 *   - qualifyRow (full pipeline)
 *   - computeCoverage
 *
 * Key invariant: bad values are marked (quality != 0) but kept in rawValue.
 */

import { describe, it, expect } from 'vitest';
import { applySentinel } from './sentinel.js';
import { applyRange } from './range.js';
import { applyStoppedEquipment } from './stopped.js';
import { applyConsistencyRules } from './consistency.js';
import { qualifyRow } from './pipeline.js';
import { computeCoverage } from './coverage.js';
import type {
  RawRow,
  SiteQualityConfig,
  QualifyContext,
  RangeRule,
  ConsistencyRule,
} from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    seq: 1,
    time: '2024-01-01T00:00:00Z',
    measurement: 'components',
    entityId: 'ahu-01',
    field: 'supply-air-temp',
    value: 22.5,
    isDelayed: false,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<SiteQualityConfig> = {}): SiteQualityConfig {
  return {
    sentinelValues: [9999, -9999, 32767],
    ranges: [
      { classification: 'Temperature', min: -30, max: 60 },
      { classification: 'Pressure', min: 0, max: 1200 },
      { classification: 'Flow Sensor', min: 0, max: 5000 },
      { classification: 'Status', min: 0, max: 1 },
      { min: -9000, max: 9000 }, // default fallback
    ],
    suppressProcessValuesWhenStopped: ['Temperature', 'Pressure', 'Flow Sensor'],
    consistencyRules: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<QualifyContext> = {}): QualifyContext {
  return {
    classification: 'Temperature',
    runStatus: 1,
    relatedValues: {},
    ...overrides,
  };
}

// ── applySentinel ─────────────────────────────────────────────────────────────

describe('applySentinel', () => {
  const sentinels = [9999, -9999, 32767];

  const cases: Array<{ value: number; expected: boolean; label: string }> = [
    { value: 9999, expected: true, label: 'matches sentinel 9999' },
    { value: -9999, expected: true, label: 'matches sentinel -9999' },
    { value: 32767, expected: true, label: 'matches sentinel 32767' },
    { value: 22.5, expected: false, label: 'normal reading' },
    { value: 0, expected: false, label: 'zero is not a sentinel' },
    { value: 9998, expected: false, label: 'near-sentinel is not a sentinel' },
  ];

  for (const { value, expected, label } of cases) {
    it(label, () => {
      expect(applySentinel(value, sentinels)).toBe(expected);
    });
  }

  it('returns false when sentinelValues is empty', () => {
    expect(applySentinel(9999, [])).toBe(false);
  });
});

// ── applyRange ────────────────────────────────────────────────────────────────

describe('applyRange', () => {
  const rules: RangeRule[] = [
    { classification: 'Temperature', min: -30, max: 60 },
    { classification: 'Pressure', min: 0, max: 1200 },
    { classification: 'Status', min: 0, max: 1 },
    { min: -9000, max: 9000 }, // default
  ];

  const cases: Array<{
    value: number;
    classification: string;
    expected: boolean;
    label: string;
  }> = [
    { value: 22.5, classification: 'Temperature', expected: false, label: 'temp in range' },
    { value: 61, classification: 'Temperature', expected: true, label: 'temp above max' },
    { value: -31, classification: 'Temperature', expected: true, label: 'temp below min' },
    { value: -30, classification: 'Temperature', expected: false, label: 'temp at min (inclusive)' },
    { value: 60, classification: 'Temperature', expected: false, label: 'temp at max (inclusive)' },
    { value: 700, classification: 'Pressure', expected: false, label: 'pressure in range' },
    { value: 1201, classification: 'Pressure', expected: true, label: 'pressure above max' },
    { value: 2, classification: 'Status', expected: true, label: 'binary status > 1 is out-of-range' },
    { value: 1, classification: 'Status', expected: false, label: 'binary status = 1 ok' },
    { value: 0, classification: 'Status', expected: false, label: 'binary status = 0 ok' },
    { value: 5000, classification: 'Humidity', expected: false, label: 'uses default rule for unknown class' },
    { value: 9001, classification: 'Humidity', expected: true, label: 'exceeds default rule' },
  ];

  for (const { value, classification, expected, label } of cases) {
    it(label, () => {
      expect(applyRange(value, classification, rules)).toBe(expected);
    });
  }

  it('returns false when no rule matches and no default', () => {
    const noDefault: RangeRule[] = [{ classification: 'Temperature', min: 0, max: 50 }];
    expect(applyRange(999, 'Humidity', noDefault)).toBe(false);
  });

  it('classification matching is case-insensitive', () => {
    const rules2: RangeRule[] = [{ classification: 'temperature', min: 0, max: 50 }];
    expect(applyRange(100, 'Temperature', rules2)).toBe(true);
  });
});

// ── applyStoppedEquipment ─────────────────────────────────────────────────────

describe('applyStoppedEquipment', () => {
  const processClasses = ['Temperature', 'Pressure', 'Flow Sensor'];

  const cases: Array<{
    runStatus: number | null;
    classification: string;
    expected: boolean;
    label: string;
  }> = [
    { runStatus: 0, classification: 'Temperature', expected: true, label: 'temperature suppressed when stopped' },
    { runStatus: 0, classification: 'Pressure', expected: true, label: 'pressure suppressed when stopped' },
    { runStatus: 0, classification: 'Flow Sensor', expected: true, label: 'flow sensor suppressed when stopped' },
    { runStatus: 1, classification: 'Temperature', expected: false, label: 'temperature not suppressed when running' },
    { runStatus: null, classification: 'Temperature', expected: false, label: 'skipped when runStatus unknown' },
    { runStatus: 0, classification: 'Status', expected: false, label: 'status never suppressed' },
    { runStatus: 0, classification: 'Counter', expected: false, label: 'counter never suppressed' },
    { runStatus: 0, classification: 'Alarm', expected: false, label: 'alarm never suppressed' },
    { runStatus: 0, classification: 'Set Point', expected: false, label: 'set point never suppressed' },
    { runStatus: 0, classification: 'Setpoint', expected: false, label: 'setpoint variant never suppressed' },
    { runStatus: 0, classification: 'Humidity', expected: false, label: 'unknown class not in suppress list: not suppressed' },
    { runStatus: 2, classification: 'Temperature', expected: false, label: 'non-zero run status means running' },
  ];

  for (const { runStatus, classification, expected, label } of cases) {
    it(label, () => {
      const row = makeRow({ field: 'some-field' });
      expect(applyStoppedEquipment(row, runStatus, classification, processClasses)).toBe(expected);
    });
  }

  it('classification matching is case-insensitive for suppress list', () => {
    const row = makeRow();
    expect(applyStoppedEquipment(row, 0, 'temperature', ['Temperature'])).toBe(true);
  });

  it('classification matching is case-insensitive for never-suppress list', () => {
    const row = makeRow();
    expect(applyStoppedEquipment(row, 0, 'ALARM', ['Alarm'])).toBe(false);
  });
});

// ── applyConsistencyRules ─────────────────────────────────────────────────────

describe('applyConsistencyRules', () => {
  const rules: ConsistencyRule[] = [
    {
      triggerField: 'run-status',
      triggerValue: 0,
      targetField: 'fan-speed',
      targetExact: 0,
    },
    {
      triggerField: 'run-status',
      triggerValue: 1,
      targetField: 'supply-air-temp',
      targetMin: 5,
      targetMax: 50,
    },
  ];

  it('returns 0 when trigger field is absent from related values', () => {
    expect(applyConsistencyRules('fan-speed', 5, {}, rules)).toBe(0);
  });

  it('returns 0 when trigger value does not match', () => {
    expect(applyConsistencyRules('fan-speed', 5, { 'run-status': 1 }, rules)).toBe(0);
  });

  it('returns 4 when fan-speed != 0 while run-status = 0', () => {
    expect(applyConsistencyRules('fan-speed', 5, { 'run-status': 0 }, rules)).toBe(4);
  });

  it('returns 0 when fan-speed = 0 while run-status = 0', () => {
    expect(applyConsistencyRules('fan-speed', 0, { 'run-status': 0 }, rules)).toBe(0);
  });

  it('returns 4 when supply-air-temp below min while run-status = 1', () => {
    expect(applyConsistencyRules('supply-air-temp', 2, { 'run-status': 1 }, rules)).toBe(4);
  });

  it('returns 4 when supply-air-temp above max while run-status = 1', () => {
    expect(applyConsistencyRules('supply-air-temp', 55, { 'run-status': 1 }, rules)).toBe(4);
  });

  it('returns 0 when no rule targets this field', () => {
    expect(applyConsistencyRules('unrelated-field', 99, { 'run-status': 0 }, rules)).toBe(0);
  });

  it('returns 0 when rule list is empty', () => {
    expect(applyConsistencyRules('fan-speed', 5, { 'run-status': 0 }, [])).toBe(0);
  });
});

// ── qualifyRow (pipeline) ─────────────────────────────────────────────────────

describe('qualifyRow', () => {
  describe('sentinel suppression', () => {
    it('marks sentinel as quality 1 and nulls qualifiedValue', () => {
      const row = makeRow({ value: 9999 });
      const result = qualifyRow(row, makeConfig(), makeCtx());
      expect(result.quality).toBe(1);
      expect(result.qualifiedValue).toBeNull();
      expect(result.rawValue).toBe(9999);
    });

    it('sentinel value is preserved in rawValue', () => {
      const row = makeRow({ value: -9999 });
      const result = qualifyRow(row, makeConfig(), makeCtx());
      expect(result.rawValue).toBe(-9999);
    });
  });

  describe('range suppression', () => {
    it('marks out-of-range as quality 2 and nulls qualifiedValue', () => {
      const row = makeRow({ value: 100 }); // > 60 for Temperature
      const result = qualifyRow(row, makeConfig(), makeCtx({ classification: 'Temperature' }));
      expect(result.quality).toBe(2);
      expect(result.qualifiedValue).toBeNull();
      expect(result.rawValue).toBe(100);
    });
  });

  describe('stopped equipment suppression', () => {
    it('marks suppressed value as quality 3 and nulls qualifiedValue', () => {
      const row = makeRow({ value: 22.5, field: 'supply-air-temp' });
      const result = qualifyRow(
        row,
        makeConfig(),
        makeCtx({ classification: 'Temperature', runStatus: 0 }),
      );
      expect(result.quality).toBe(3);
      expect(result.qualifiedValue).toBeNull();
      expect(result.rawValue).toBe(22.5);
    });

    it('does not suppress counter when equipment is stopped', () => {
      const row = makeRow({ value: 1500, field: 'energy-counter' });
      const result = qualifyRow(
        row,
        makeConfig(),
        makeCtx({ classification: 'Counter', runStatus: 0 }),
      );
      expect(result.quality).toBe(0);
      expect(result.qualifiedValue).toBe(1500);
    });
  });

  describe('consistency suppression', () => {
    it('marks inconsistent value as quality 4 but KEEPS it in rawValue', () => {
      const config = makeConfig({
        consistencyRules: [
          {
            triggerField: 'run-status',
            triggerValue: 0,
            targetField: 'fan-speed',
            targetExact: 0,
          },
        ],
      });
      const row = makeRow({ value: 200, field: 'fan-speed' });
      const result = qualifyRow(
        row,
        config,
        makeCtx({
          classification: 'Fan Speed',
          runStatus: 1, // equipment is running (so stopped rule won't fire)
          relatedValues: { 'run-status': 0 }, // but related field says stopped
        }),
      );
      expect(result.quality).toBe(4);
      expect(result.qualifiedValue).toBeNull();
      expect(result.rawValue).toBe(200); // kept for audit
    });
  });

  describe('pass-through (quality 0)', () => {
    it('passes a normal value with quality 0', () => {
      const row = makeRow({ value: 22.5 });
      const result = qualifyRow(row, makeConfig(), makeCtx({ runStatus: 1 }));
      expect(result.quality).toBe(0);
      expect(result.qualifiedValue).toBe(22.5);
      expect(result.rawValue).toBe(22.5);
    });

    it('preserves all original row fields on pass-through', () => {
      const row = makeRow({ seq: 42, isDelayed: true });
      const result = qualifyRow(row, makeConfig(), makeCtx({ runStatus: 1 }));
      expect(result.seq).toBe(42);
      expect(result.isDelayed).toBe(true);
      expect(result.quality).toBe(0);
    });
  });

  describe('rule short-circuiting', () => {
    it('sentinel fires before range (quality = 1, not 2)', () => {
      // 9999 is also "out of range" for Temperature, but sentinel wins
      const row = makeRow({ value: 9999 });
      const result = qualifyRow(
        row,
        makeConfig(),
        makeCtx({ classification: 'Temperature', runStatus: 1 }),
      );
      expect(result.quality).toBe(1);
    });

    it('range fires before stopped-equipment (quality = 2, not 3)', () => {
      // value is out-of-range and equipment is stopped; range wins
      const row = makeRow({ value: 100, field: 'supply-air-temp' });
      const result = qualifyRow(
        row,
        makeConfig(),
        makeCtx({ classification: 'Temperature', runStatus: 0 }),
      );
      expect(result.quality).toBe(2);
    });
  });

  describe('table-driven multi-case', () => {
    const config = makeConfig();

    const cases: Array<{
      value: number;
      classification: string;
      runStatus: number | null;
      expectedQuality: number;
      label: string;
    }> = [
      { value: 22.5, classification: 'Temperature', runStatus: 1, expectedQuality: 0, label: 'normal temp running' },
      { value: 9999, classification: 'Temperature', runStatus: 1, expectedQuality: 1, label: 'sentinel' },
      { value: 200, classification: 'Temperature', runStatus: 1, expectedQuality: 2, label: 'out of range' },
      { value: 22.5, classification: 'Temperature', runStatus: 0, expectedQuality: 3, label: 'temp stopped' },
      { value: 22.5, classification: 'Humidity', runStatus: 0, expectedQuality: 0, label: 'humidity not in suppress list, ok' },
      { value: 22.5, classification: 'Counter', runStatus: 0, expectedQuality: 0, label: 'counter never suppressed' },
    ];

    for (const { value, classification, runStatus, expectedQuality, label } of cases) {
      it(label, () => {
        const row = makeRow({ value, field: 'test-field' });
        const result = qualifyRow(row, config, makeCtx({ classification, runStatus }));
        expect(result.quality).toBe(expectedQuality);
        // rawValue always preserved
        expect(result.rawValue).toBe(value);
        // qualifiedValue is null iff quality != 0
        if (expectedQuality === 0) {
          expect(result.qualifiedValue).toBe(value);
        } else {
          expect(result.qualifiedValue).toBeNull();
        }
      });
    }
  });
});

// ── computeCoverage ───────────────────────────────────────────────────────────

describe('computeCoverage', () => {
  it('computes 100% coverage for a 60-minute window at 60s cadence with 60 buckets', () => {
    const result = computeCoverage(60, 60, 60);
    expect(result.expected).toBe(60);
    expect(result.received).toBe(60);
    expect(result.pct).toBeCloseTo(1.0);
  });

  it('computes 50% coverage', () => {
    const result = computeCoverage(30, 60, 60);
    expect(result.expected).toBe(60);
    expect(result.received).toBe(30);
    expect(result.pct).toBeCloseTo(0.5);
  });

  it('computes 0% coverage when no buckets received', () => {
    const result = computeCoverage(0, 60, 60);
    expect(result.expected).toBe(60);
    expect(result.received).toBe(0);
    expect(result.pct).toBeCloseTo(0);
  });

  it('handles 5-minute cadence correctly', () => {
    // 60-minute window at 300s cadence → 12 expected
    const result = computeCoverage(10, 60, 300);
    expect(result.expected).toBe(12);
    expect(result.received).toBe(10);
    expect(result.pct).toBeCloseTo(10 / 12);
  });

  it('returns pct > 1 when more buckets than expected', () => {
    const result = computeCoverage(70, 60, 60);
    expect(result.pct).toBeGreaterThan(1);
  });

  it('clamps received to 0 when distinctMinutes is negative', () => {
    const result = computeCoverage(-5, 60, 60);
    expect(result.received).toBe(0);
  });

  it('throws RangeError for non-positive windowMinutes', () => {
    expect(() => computeCoverage(30, 0, 60)).toThrow(RangeError);
    expect(() => computeCoverage(30, -1, 60)).toThrow(RangeError);
  });

  it('throws RangeError for non-positive cadenceSeconds', () => {
    expect(() => computeCoverage(30, 60, 0)).toThrow(RangeError);
    expect(() => computeCoverage(30, 60, -1)).toThrow(RangeError);
  });

  it('uses floor division for expected count', () => {
    // 61 minutes at 60s cadence → floor(61*60/60) = 61
    const result = computeCoverage(55, 61, 60);
    expect(result.expected).toBe(61);
  });
});
