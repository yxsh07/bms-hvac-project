import React, { memo, useMemo } from 'react';
import type { PointValue, PointDefinition, QualityCode, DataFreshness, RenderedPointData, PointClassification } from '../types/telemetry';
import { QUALITY_LABELS, QUALITY_SEVERITY, POINT_CLASSIFICATION_GROUPS } from '../types/telemetry';
import clsx from 'clsx';

interface PointRendererProps {
  pointValue: PointValue;
  pointDef: PointDefinition;
  coveragePct?: number;
  staleThresholdMinutes?: number;
  showCoverageBadge?: boolean;
  showSparkline?: boolean;
  sparklineData?: number[];
  onEdit?: (pointDef: PointDefinition, currentValue: number | null) => void;
  compact?: boolean;
  className?: string;
}

const STALE_COLORS = {
  live: 'var(--color-content-primary)',
  stale: 'var(--color-semantic-stale)',
  flagged: 'var(--color-semantic-warning)',
  missing: 'var(--color-semantic-missing)'
} as const;

const FRESHNESS_LABELS: Record<DataFreshness, string> = {
  live: 'Live',
  stale: 'Stale',
  flagged: 'Flagged',
  missing: 'Missing'
};

const MISSING_REASONS = {
  sentinel: 'Sensor sentinel value',
  outOfRange: 'Out of range',
  stopped: 'Equipment stopped',
  inconsistent: 'Inconsistent reading',
  noData: 'No data available',
  stale: 'Data stale'
} as const;

function determineFreshness(
  pointValue: PointValue,
  pointDef: PointDefinition,
  staleThresholdMinutes: number = 5
): { freshness: DataFreshness; reason?: string } {
  // Missing value
  if (pointValue.value === null && pointValue.rawValue === undefined) {
    return { freshness: 'missing', reason: MISSING_REASONS.noData };
  }

  // Quality flagged
  if (pointValue.quality !== 0) {
    const qualityReasons: Record<QualityCode, string> = {
      0: '',
      1: MISSING_REASONS.sentinel,
      2: MISSING_REASONS.outOfRange,
      3: MISSING_REASONS.stopped,
      4: MISSING_REASONS.inconsistent
    };
    return { freshness: 'flagged', reason: qualityReasons[pointValue.quality] };
  }

  // Check staleness
  const now = new Date().getTime();
  const timestamp = new Date(pointValue.timestamp).getTime();
  const ageMinutes = (now - timestamp) / 60000;

  if (ageMinutes > staleThresholdMinutes) {
    return { freshness: 'stale', reason: `Stale ${Math.round(ageMinutes)} min` };
  }

  return { freshness: 'live' };
}

function formatValue(value: number | null, unit: string, classification: PointClassification): string {
  if (value === null) return '—';

  const precision: Record<PointClassification, number> = {
    Temperature: 1,
    Humidity: 1,
    Pressure: 1,
    Flow: 1,
    Power: 1,
    Energy: 0,
    Status: 0,
    Alarm: 0,
    Actuator: 1,
    Setpoint: 1,
    Mode: 0,
    KPI: 2,
    Count: 0,
    AirQuality: 0,
    Voltage: 1,
    Current: 1,
    Frequency: 2,
    Other: 1
  };

  const decimals = precision[classification] ?? 1;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return `${formatted} ${unit}`;
}

function formatCompactValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  return `${value.toFixed(1)} ${unit}`;
}

export const PointRenderer = memo(function PointRenderer({
  pointValue,
  pointDef,
  coveragePct,
  staleThresholdMinutes = 5,
  showCoverageBadge = true,
  showSparkline = false,
  sparklineData,
  onEdit,
  compact = false,
  className
}: PointRendererProps) {
  const { freshness, reason } = useMemo(
    () => determineFreshness(pointValue, pointDef, staleThresholdMinutes),
    [pointValue, pointDef, staleThresholdMinutes]
  );

  const classificationGroup = POINT_CLASSIFICATION_GROUPS[pointDef.classification];
  const isWritable = pointDef.writable && !!onEdit;
  const qualityLabel = QUALITY_LABELS[pointValue.quality];
  const qualitySeverity = QUALITY_SEVERITY[pointValue.quality];
  const showBadge = showCoverageBadge && coveragePct !== undefined && coveragePct < 50;

  const displayValue = compact
    ? formatCompactValue(pointValue.value, pointDef.unit)
    : formatValue(pointValue.value, pointDef.unit, pointDef.classification);

  const trend = sparklineData && sparklineData.length >= 2
    ? sparklineData[sparklineData.length - 1] > sparklineData[0]
      ? 'up'
      : sparklineData[sparklineData.length - 1] < sparklineData[0]
        ? 'down'
        : 'stable'
    : undefined;

  const baseClasses = 'point-renderer inline-flex items-center gap-2';
  const containerClasses = clsx(baseClasses, className);

  // Render based on classification
  switch (classificationGroup.renderAs) {
    case 'value-sparkline':
      return renderValueSparkline();
    case 'value-delta':
      return renderValueDelta();
    case 'pill':
      return renderPill();
    case 'badge':
      return renderBadge();
    case 'bar':
      return renderBar();
    case 'editable':
      return renderEditable();
    case 'label':
      return renderLabel();
    case 'trend':
      return renderTrend();
    case 'integer':
      return renderInteger();
    default:
      return renderDefault();
  }

  function renderValueSparkline() {
    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${displayValue}${reason ? ` (${reason})` : ''}`}>
        <div className="flex flex-col items-start min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                'font-mono tabular-nums transition-colors',
                compact ? 'text-xs' : 'text-sm',
                freshness === 'live' ? 'text-content-primary' :
                freshness === 'stale' ? 'text-stale' :
                freshness === 'flagged' ? 'text-warning' : 'text-missing'
              )}
            >
              {displayValue}
            </span>
            {pointValue.isDelayed && (
              <span className="text-[10px] px-1 py-0.5 bg-warning/10 text-warning rounded-full" title="Delayed data">
                ⏱
              </span>
            )}
          </div>
          {showSparkline && sparklineData && sparklineData.length > 1 && (
            <Sparkline data={sparklineData} color={getSparklineColor()} height={compact ? 20 : 28} />
          )}
          <div className="flex items-center gap-1 text-[10px] text-content-tertiary">
            {showBadge && coveragePct !== undefined && (
              <CoverageBadge pct={coveragePct} />
            )}
            {freshness !== 'live' && (
              <span className={clsx('flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
                <StatusDot color={STALE_COLORS[freshness]} size={6} />
                {reason}
              </span>
            )}
          </div>
        </div>
        {compact && pointDef.displayName && (
          <span className="text-[10px] text-content-tertiary whitespace-nowrap hidden sm:block">{pointDef.displayName}</span>
        )}
      </div>
    );
  }

  function renderValueDelta() {
    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${displayValue}${reason ? ` (${reason})` : ''}`}>
        <div className="flex flex-col items-start min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                'font-mono tabular-nums transition-colors font-medium',
                compact ? 'text-sm' : 'text-base',
                freshness === 'live' ? 'text-content-primary' :
                freshness === 'stale' ? 'text-stale' :
                freshness === 'flagged' ? 'text-warning' : 'text-missing'
              )}
            >
              {displayValue}
            </span>
            {pointValue.isDelayed && (
              <span className="text-[10px] px-1 py-0.5 bg-warning/10 text-warning rounded-full" title="Delayed data">
                ⏱
              </span>
            )}
          </div>
          {showSparkline && sparklineData && sparklineData.length > 1 && (
            <Sparkline data={sparklineData} color={getSparklineColor()} height={compact ? 20 : 28} />
          )}
          <div className="flex items-center gap-1 text-[10px] text-content-tertiary">
            {showBadge && coveragePct !== undefined && (
              <CoverageBadge pct={coveragePct} />
            )}
            {freshness !== 'live' && (
              <span className={clsx('flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
                <StatusDot color={STALE_COLORS[freshness]} size={6} />
                {reason}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderPill() {
    const status = pointValue.value === 1 ? 'running' : pointValue.value === 0 ? 'stopped' : 'unknown';
    const statusClasses = {
      running: 'status-running',
      stopped: 'status-stopped',
      unknown: 'status-unknown'
    };

    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${status}${reason ? ` (${reason})` : ''}`}>
        <span className={clsx('status-pill px-2 py-0.5 rounded-full text-xs font-medium', statusClasses[status])}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <span className={clsx('text-[10px] flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </span>
        )}
      </div>
    );
  }

  function renderBadge() {
    const isActive = pointValue.value === 1;
    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${isActive ? 'Active' : 'Clear'}${reason ? ` (${reason})` : ''}`}>
        <span className={clsx(
          'alarm-badge px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
          isActive ? 'bg-critical/10 text-critical' : 'bg-success/10 text-success'
        )}>
          <StatusDot color={isActive ? 'var(--color-semantic-critical)' : 'var(--color-semantic-success)'} size={6} />
          {isActive ? 'ALARM' : 'CLEAR'}
        </span>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <span className={clsx('text-[10px] flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </span>
        )}
      </div>
    );
  }

  function renderBar() {
    const percent = pointValue.value ?? 0;
    const clampedPercent = Math.max(0, Math.min(100, percent));

    return (
      <div className={containerClasses} style={{ minWidth: compact ? '120px' : '160px' }} title={`${pointDef.displayName}: ${percent.toFixed(1)}%${reason ? ` (${reason})` : ''}`}>
        <div className="w-full flex items-center gap-2">
          <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden" role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full bg-chilled rounded-full transition-all duration-300"
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <span className={clsx('font-mono tabular-nums text-xs', freshness === 'live' ? 'text-content-primary' : 'text-stale')}>
            {clampedPercent.toFixed(0)}%
          </span>
        </div>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <div className={clsx('text-[10px] flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </div>
        )}
      </div>
    );
  }

  function renderEditable() {
    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${displayValue}${reason ? ` (${reason})` : ''}`}>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'font-mono tabular-nums transition-colors',
              compact ? 'text-sm' : 'text-base',
              freshness === 'live' ? 'text-content-primary' :
              freshness === 'stale' ? 'text-stale' :
              freshness === 'flagged' ? 'text-warning' : 'text-missing'
            )}
          >
            {displayValue}
          </span>
          {isWritable && (
            <button
              onClick={() => onEdit?.(pointDef, pointValue.value)}
              className="edit-trigger p-1.5 rounded-md bg-surface-sunken hover:bg-state-hover transition-colors text-content-tertiary hover:text-content-primary"
              aria-label={`Edit ${pointDef.displayName}`}
              title="Edit setpoint"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <div className={clsx('text-[10px] flex items-center gap-0.5 mt-1', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </div>
        )}
      </div>
    );
  }

  function renderLabel() {
    const labels: Record<number, string> = {
      0: 'Auto',
      1: 'Manual',
      2: 'Local',
      3: 'Hybrid',
      4: 'Recipe'
    };
    const label = pointValue.value !== null ? labels[pointValue.value] ?? `Mode ${pointValue.value}` : '—';

    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${label}${reason ? ` (${reason})` : ''}`}>
        <span className={clsx('mode-chip px-2 py-0.5 rounded-md text-xs font-medium bg-surface-sunken border border-default', freshness === 'live' ? 'text-content-primary' : 'text-stale')}>
          {label}
        </span>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <span className={clsx('text-[10px] flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </span>
        )}
      </div>
    );
  }

  function renderTrend() {
    const trendIcon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
    const trendColor = trend === 'up' ? 'var(--color-semantic-success)' : trend === 'down' ? 'var(--color-semantic-critical)' : 'var(--color-content-tertiary)';

    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${displayValue}${reason ? ` (${reason})` : ''}`}>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'font-mono tabular-nums transition-colors font-medium',
              compact ? 'text-sm' : 'text-base',
              freshness === 'live' ? 'text-content-primary' :
              freshness === 'stale' ? 'text-stale' :
              freshness === 'flagged' ? 'text-warning' : 'text-missing'
            )}
          >
            {displayValue}
          </span>
          <span style={{ color: trendColor }} className="text-xs">{trendIcon}</span>
        </div>
        {showSparkline && sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={getSparklineColor()} height={compact ? 20 : 28} />
        )}
        <div className="flex items-center gap-1 text-[10px] text-content-tertiary">
          {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
          {freshness !== 'live' && (
            <span className={clsx('flex items-center gap-0.5', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
              <StatusDot color={STALE_COLORS[freshness]} size={6} />
              {reason}
            </span>
          )}
        </div>
      </div>
    );
  }

  function renderInteger() {
    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${displayValue}${reason ? ` (${reason})` : ''}`}>
        <span
          className={clsx(
            'font-mono tabular-nums transition-colors',
            compact ? 'text-sm' : 'text-base',
            freshness === 'live' ? 'text-content-primary' :
            freshness === 'stale' ? 'text-stale' :
            freshness === 'flagged' ? 'text-warning' : 'text-missing'
          )}
        >
          {displayValue}
        </span>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <span className={clsx('text-[10px] flex items-center gap-0.5 ml-2', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </span>
        )}
      </div>
    );
  }

  function renderDefault() {
    return (
      <div className={containerClasses} title={`${pointDef.displayName}: ${displayValue}${reason ? ` (${reason})` : ''}`}>
        <span
          className={clsx(
            'font-mono tabular-nums transition-colors',
            compact ? 'text-sm' : 'text-base',
            freshness === 'live' ? 'text-content-primary' :
            freshness === 'stale' ? 'text-stale' :
            freshness === 'flagged' ? 'text-warning' : 'text-missing'
          )}
        >
          {displayValue}
        </span>
        {showBadge && coveragePct !== undefined && <CoverageBadge pct={coveragePct} />}
        {freshness !== 'live' && (
          <span className={clsx('text-[10px] flex items-center gap-0.5 ml-2', freshness === 'stale' ? 'text-stale' : 'text-warning')}>
            <StatusDot color={STALE_COLORS[freshness]} size={6} />
            {reason}
          </span>
        )}
      </div>
    );
  }

  function getSparklineColor() {
    switch (pointDef.classification) {
      case 'Temperature': return 'var(--color-semantic-chilled)';
      case 'Humidity': return 'var(--color-content-tertiary)';
      case 'Pressure': return 'var(--color-semantic-condenser)';
      case 'Flow': return 'var(--color-semantic-chilled)';
      case 'Power': return 'var(--color-semantic-warning)';
      case 'Energy': return 'var(--color-semantic-warning)';
      default: return 'var(--color-content-secondary)';
    }
  }
});

PointRenderer.displayName = 'PointRenderer';

// Supporting components
function StatusDot({ color, size }: { color: string; size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0
      }}
      aria-hidden="true"
    />
  );
}

function CoverageBadge({ pct }: { pct: number }) {
  const color = pct < 20 ? 'var(--color-semantic-critical)' : pct < 50 ? 'var(--color-semantic-warning)' : 'var(--color-semantic-success)';
  return (
    <span
      className="coverage-badge px-1.5 py-0.5 rounded-full text-[9px] font-medium tabular-nums"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}40`
      }}
      title={`${pct.toFixed(0)}% coverage`}
    >
      {pct.toFixed(0)}%
    </span>
  );
}

function Sparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = data.length * 3; // 3px per point

  const points = data.map((value, i) => {
    const x = i * 3;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="w-full max-w-[200px]" role="img" aria-label="Trend sparkline" focusable="false">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}
      />
      <polyline
        fill="url(#sparkline-gradient)"
        stroke="none"
        points={`${points} ${width},${height} 0,${height}`}
        opacity={0.3}
      />
    </svg>
  );
}