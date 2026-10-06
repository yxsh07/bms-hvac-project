// Telemetry and point types
export interface Asset {
  id: string;
  name: string;
  type: string;
  zone?: string;
  floor?: string;
  criticality?: string;
  pointRoles?: Record<string, string>;
}

export interface PointValue {
  value: number | null;
  rawValue?: number;
  quality: QualityCode;
  timestamp: string; // ISO 8601 UTC
  isDelayed?: boolean;
}

export type QualityCode = 0 | 1 | 2 | 3 | 4;

export const QUALITY_LABELS: Record<QualityCode, string> = {
  0: 'OK',
  1: 'Sentinel value',
  2: 'Out of range',
  3: 'Stopped equipment',
  4: 'Inconsistent'
};

export const QUALITY_SEVERITY: Record<QualityCode, 'ok' | 'warning' | 'critical'> = {
  0: 'ok',
  1: 'critical',
  2: 'warning',
  3: 'warning',
  4: 'warning'
};

export interface PointDefinition {
  abbreviation: string;
  displayName: string;
  unit: string;
  group: string;
  classification: PointClassification;
  writable: boolean;
  safeMin?: number;
  safeMax?: number;
  source: 'component' | 'device';
}

export type PointClassification =
  | 'Temperature'
  | 'Humidity'
  | 'Pressure'
  | 'Flow'
  | 'Power'
  | 'Energy'
  | 'Status'
  | 'Alarm'
  | 'Actuator'
  | 'Setpoint'
  | 'Mode'
  | 'KPI'
  | 'Count'
  | 'AirQuality'
  | 'Voltage'
  | 'Current'
  | 'Frequency'
  | 'Other';

export interface TelemetrySeriesPoint {
  time: string;
  value: number | null;
  quality: QualityCode;
  isDelayed?: boolean;
  n?: number; // sample count for rollup buckets
}

export interface TelemetrySeriesResponse {
  points: TelemetrySeriesPoint[];
  quality: {
    expectedSamples: number;
    goodSamples: number;
    coveragePct: number;
    hasDelayedData: boolean;
  };
  resolution: 'raw' | '1h' | '1d';
}

export interface CoverageData {
  expected: number;
  received: number;
  pct: number;
}

export interface AssetTelemetry {
  entityId: string;
  points: Record<string, PointValue>;
}

export interface LatestTelemetryResponse {
  [entityId: string]: {
    [field: string]: PointValue;
  };
}

// Point renderer classification groups
export const POINT_CLASSIFICATION_GROUPS: Record<PointClassification, {
  renderAs: 'value-sparkline' | 'value-delta' | 'pill' | 'badge' | 'bar' | 'editable' | 'label' | 'trend' | 'integer' | 'default';
  interaction: 'history' | 'consumption' | 'read-only' | 'detail' | 'edit' | 'none';
}> = {
  Temperature: { renderAs: 'value-sparkline', interaction: 'history' },
  Humidity: { renderAs: 'value-sparkline', interaction: 'history' },
  Pressure: { renderAs: 'value-sparkline', interaction: 'history' },
  Flow: { renderAs: 'value-sparkline', interaction: 'history' },
  Power: { renderAs: 'value-delta', interaction: 'consumption' },
  Energy: { renderAs: 'value-delta', interaction: 'consumption' },
  Status: { renderAs: 'pill', interaction: 'read-only' },
  Alarm: { renderAs: 'badge', interaction: 'detail' },
  Actuator: { renderAs: 'bar', interaction: 'read-only' },
  Setpoint: { renderAs: 'editable', interaction: 'edit' },
  Mode: { renderAs: 'label', interaction: 'read-only' },
  KPI: { renderAs: 'trend', interaction: 'history' },
  Count: { renderAs: 'integer', interaction: 'read-only' },
  AirQuality: { renderAs: 'default', interaction: 'read-only' },
  Voltage: { renderAs: 'default', interaction: 'read-only' },
  Current: { renderAs: 'default', interaction: 'read-only' },
  Frequency: { renderAs: 'default', interaction: 'read-only' },
  Other: { renderAs: 'default', interaction: 'none' }
};

// Data freshness states
export type DataFreshness = 'live' | 'stale' | 'flagged' | 'missing';

export interface RenderedPointData {
  value: string;
  unit: string;
  displayName: string;
  freshness: DataFreshness;
  freshnessReason?: string;
  quality: QualityCode;
  qualityLabel: string;
  coveragePct?: number;
  showCoverageBadge: boolean;
  isWritable: boolean;
  classification: PointClassification;
  sparklineData?: number[];
  trend?: 'up' | 'down' | 'stable';
}