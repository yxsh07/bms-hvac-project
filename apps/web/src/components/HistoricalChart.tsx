import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { TelemetrySeriesPoint } from '../types/telemetry';

interface SparklinesProps {
  data: TelemetrySeriesPoint[];
  color?: string;
  height?: number;
  width?: number;
  showPoints?: boolean;
  showArea?: boolean;
  className?: string;
}

export function Sparklines({
  data,
  color = 'var(--color-content-secondary)',
  height = 40,
  width,
  showPoints = false,
  showArea = true,
  className
}: SparklinesProps) {
  const validPoints = useMemo(() =>
    data.filter(p => p.value !== null).map(p => ({ ...p, value: p.value! })),
    [data]
  );

  const { points, min, max, range } = useMemo(() => {
    if (validPoints.length < 2) {
      return { points: [], min: 0, max: 0, range: 1 };
    }
    const values = validPoints.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = validPoints.map((p, i) => {
      const x = (i / (validPoints.length - 1)) * (width || 200);
      const y = height - ((p.value - min) / range) * (height - 8) - 4;
      return { x, y, value: p.value, time: p.time, quality: p.quality, isDelayed: p.isDelayed };
    });

    return { points, min, max, range };
  }, [validPoints, height, width]);

  if (validPoints.length < 2) {
    return (
      <div className={clsx('sparkline-empty', className)} style={{ height, width: width || '100%' }} aria-hidden="true">
        <svg width="100%" height="100%" viewBox={`0 0 ${width || 100} ${height}`}>
          <line x1="0" y1={height / 2} x2={width || 100} y2={height / 2} stroke={color} strokeWidth="1" strokeDasharray="4,4" opacity="0.3" />
        </svg>
      </div>
    );
  }

  const w = width || points[points.length - 1]?.x || 200;

  // Resolution indicator for partial hours
  const hasPartialHours = validPoints.some(p => p.n !== undefined && p.n < 60);
  const resolution = validPoints[0]?.n ? `${validPoints[0].n} samples` : 'raw';

  return (
    <div className={clsx('sparkline-container relative', className)} style={{ height, width: w }}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="sparkline-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <g stroke="var(--color-border-default)" strokeWidth="0.5" opacity="0.5">
          <line x1="0" y1={height / 3} x2={w} y2={height / 3} />
          <line x1="0" y1={2 * height / 3} x2={w} y2={2 * height / 3} />
        </g>

        {/* Area */}
        {showArea && (
          <path
            d={[
              `M${points[0].x},${height}`,
              ...points.map(p => `L${p.x},${p.y}`),
              `L${points[points.length - 1].x},${height}`,
              'Z'
            ].join(' ')}
            fill="url(#sparkline-area-gradient)"
          />
        )}

        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
        />

        {/* Points */}
        {showPoints && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={p.quality === 0 ? color : 'var(--color-semantic-warning)'}
            stroke="var(--color-surface-base)"
            strokeWidth={1.5}
          />
        ))}

        {/* Partial hour markers */}
        {validPoints.map((p, i) => p.n !== undefined && p.n < 60 && points[i] ? (
          <line
            key={i}
            x1={points[i].x}
            y1={height - 2}
            x2={points[i].x}
            y2={height}
            stroke="var(--color-semantic-warning)"
            strokeWidth="1.5"
            strokeDasharray="2,2"
          />
        ) : null)}
      </svg>

      {/* Tooltip / legend */}
      <div className="sparkline-meta flex items-center justify-between text-[10px] text-content-tertiary mt-1 px-1">
        <span className="font-mono tabular-nums">
          {validPoints.length} pts
        </span>
        <span className="flex items-center gap-1">
          {hasPartialHours && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-warning/10 text-warning" title="Partial hour - less than 60 samples">
              <span>⚠</span> Partial
            </span>
          )}
          <span>{resolution}</span>
        </span>
        <span className="font-mono tabular-nums">
          {min.toFixed(1)} – {max.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// Historical chart with resolution switching
interface HistoricalChartProps {
  series: Array<{
    id: string;
    label: string;
    data: TelemetrySeriesPoint[];
    color: string;
    unit: string;
    yAxis?: 'left' | 'right';
  }>;
  resolution: 'raw' | '1h' | '1d';
  onResolutionChange: (resolution: 'raw' | '1h' | '1d') => void;
  timeRange: { from: string; to: string };
  onTimeRangeChange: (range: { from: string; to: string }) => void;
  height?: number;
  className?: string;
  maxPoints?: number; // Default 500 per series
}

export function HistoricalChart({
  series,
  resolution,
  onResolutionChange,
  timeRange,
  onTimeRangeChange,
  height = 300,
  className,
  maxPoints = 500
}: HistoricalChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Downsample if too many points
  const processedSeries = useMemo(() => {
    return series.map(s => ({
      ...s,
      data: downsample(s.data, maxPoints)
    }));
  }, [series, maxPoints]);

  // Find global min/max for Y axis
  const { min, max, range } = useMemo(() => {
    let globalMin = Infinity;
    let globalMax = -Infinity;
    processedSeries.forEach(s => {
      s.data.forEach(p => {
        if (p.value !== null) {
          globalMin = Math.min(globalMin, p.value);
          globalMax = Math.max(globalMax, p.value);
        }
      });
    });
    const r = globalMax - globalMin || 1;
    return { min: globalMin, max: globalMax, range: r };
  }, [processedSeries]);

  const chartWidth = 800; // Will be responsive via container
  const padding = { top: 20, right: 60, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xScale = (index: number, total: number) => padding.left + (index / Math.max(1, total - 1)) * innerWidth;
  const yScale = (value: number) => padding.top + innerHeight - ((value - min) / range) * innerHeight;

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    if (resolution === '1d') return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={clsx('historical-chart', className)} style={{ height: height + 60 }}>
      {/* Toolbar */}
      <div className="chart-toolbar flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-content-primary">{series.map(s => s.label).join(', ')}</span>
          <span className="text-[11px] text-content-tertiary px-2 py-0.5 rounded bg-surface-sunken">
            {resolution === 'raw' ? 'Raw (1 min)' : resolution === '1h' ? 'Hourly' : 'Daily'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ResolutionSelector
            value={resolution}
            onChange={onResolutionChange}
          />
          <TimeRangePicker
            value={timeRange}
            onChange={onTimeRangeChange}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="chart-container relative" style={{ height }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none">
          <defs>
            <clipPath id="chart-clip">
              <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} />
            </clipPath>
            <linearGradient id="sparkline-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-content-secondary)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-content-secondary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grid */}
          <g stroke="var(--color-chart-grid)" strokeWidth="0.5" clipPath="url(#chart-clip)">
            {/* Horizontal grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => (
              <line
                key={frac}
                x1={padding.left}
                y1={padding.top + frac * innerHeight}
                x2={padding.left + innerWidth}
                y2={padding.top + frac * innerHeight}
              />
            ))}
            {/* Vertical grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => (
              <line
                key={frac}
                x1={padding.left + frac * innerWidth}
                y1={padding.top}
                x2={padding.left + frac * innerWidth}
                y2={padding.top + innerHeight}
              />
            ))}
          </g>

          {/* Y axis labels */}
          <g className="chart-y-axis" fontSize="10" fill="var(--color-chart-axis)">
            {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
              <text
                key={i}
                x={padding.left - 8}
                y={padding.top + frac * innerHeight + 3}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {(max - frac * range).toFixed(frac === 0 || frac === 1 ? 0 : 1)}
              </text>
            ))}
          </g>

          {/* X axis labels */}
          <g className="chart-x-axis" fontSize="10" fill="var(--color-chart-axis)" textAnchor="middle">
            {processedSeries[0]?.data.map((_, i) => {
              if (i % Math.max(1, Math.floor(processedSeries[0].data.length / 6)) !== 0) return null;
              const p = processedSeries[0].data[i];
              return (
                <text
                  key={i}
                  x={xScale(i, processedSeries[0].data.length)}
                  y={padding.top + innerHeight + 16}
                  dominantBaseline="hanging"
                >
                  {formatTime(p.time)}
                </text>
              );
            })}
          </g>

          {/* Series */}
          {processedSeries.map((s, si) => (
            <g key={s.id} clipPath="url(#chart-clip)">
              {/* Area */}
              <path
                d={[
                  `M${xScale(0, s.data.length)},${padding.top + innerHeight}`,
                  ...s.data.map((p, i) => p.value !== null
                    ? `L${xScale(i, s.data.length)},${yScale(p.value)}`
                    : ''
                  ).filter(Boolean),
                  `L${xScale(s.data.length - 1, s.data.length)},${padding.top + innerHeight}`,
                  'Z'
                ].join(' ')}
                fill={s.color}
                fillOpacity={0.1}
              />

              {/* Line */}
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={s.data.map((p, i) => p.value !== null
                  ? `${xScale(i, s.data.length)},${yScale(p.value)}`
                  : ''
                ).filter(Boolean).join(' ')}
              />

              {/* Points on hover */}
              {hoveredIndex !== null && hoveredIndex < s.data.length && s.data[hoveredIndex].value !== null && (
                <circle
                  cx={xScale(hoveredIndex, s.data.length)}
                  cy={yScale(s.data[hoveredIndex].value!)}
                  r={4}
                  fill={s.color}
                  stroke="var(--color-surface-base)"
                  strokeWidth={2}
                />
              )}

              {/* Partial hour markers */}
              {s.data.map((p, i) => p.n !== undefined && p.n < 60 && p.value !== null ? (
                <line
                  key={`${s.id}-${i}`}
                  x1={xScale(i, s.data.length)}
                  y1={padding.top + innerHeight - 4}
                  x2={xScale(i, s.data.length)}
                  y2={padding.top + innerHeight}
                  stroke="var(--color-semantic-warning)"
                  strokeWidth={1.5}
                  strokeDasharray="2,2"
                />
              ) : null)}
            </g>
          ))}

          {/* Crosshair */}
          {hoveredIndex !== null && (
            <line
              x1={xScale(hoveredIndex, processedSeries[0]?.data.length || 1)}
              y1={padding.top}
              x2={xScale(hoveredIndex, processedSeries[0]?.data.length || 1)}
              y2={padding.top + innerHeight}
              stroke="var(--color-content-tertiary)"
              strokeWidth={1}
              strokeDasharray="4,4"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Legend */}
        <div className="chart-legend absolute bottom-2 left-2 right-2 flex flex-wrap gap-3 justify-center">
          {processedSeries.map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
              <span className="text-[11px] text-content-secondary">{s.label}</span>
              <span className="text-[11px] font-mono tabular-nums text-content-tertiary">{s.unit}</span>
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredIndex !== null && processedSeries[0]?.data[hoveredIndex] && (
          <ChartTooltip
            index={hoveredIndex}
            series={processedSeries}
            x={xScale(hoveredIndex, processedSeries[0].data.length)}
            y={padding.top + 20}
            yScale={yScale}
            min={min}
            max={max}
          />
        )}

        {/* Mouse tracking area */}
        <div
          className="absolute inset-0"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
          onTouchMove={handleTouchMove}
        />
      </div>
    </div>
  );

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relativeX = (x - padding.left) / innerWidth;
    const index = Math.round(relativeX * (processedSeries[0]?.data.length - 1 || 0));
    setHoveredIndex(Math.max(0, Math.min(index, (processedSeries[0]?.data.length || 1) - 1)));
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const relativeX = (x - padding.left) / innerWidth;
    const index = Math.round(relativeX * (processedSeries[0]?.data.length - 1 || 0));
    setHoveredIndex(Math.max(0, Math.min(index, (processedSeries[0]?.data.length || 1) - 1)));
  }
}

function ResolutionSelector({ value, onChange }: { value: 'raw' | '1h' | '1d'; onChange: (v: 'raw' | '1h' | '1d') => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'raw' | '1h' | '1d')}
      className="px-2 py-1 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
      aria-label="Resolution"
    >
      <option value="raw">Raw (1 min)</option>
      <option value="1h">Hourly</option>
      <option value="1d">Daily</option>
    </select>
  );
}

function TimeRangePicker({ value, onChange }: { value: { from: string; to: string }; onChange: (v: { from: string; to: string }) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="datetime-local"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="px-2 py-1 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
        aria-label="From"
      />
      <span className="text-content-tertiary px-1">–</span>
      <input
        type="datetime-local"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="px-2 py-1 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
        aria-label="To"
      />
    </div>
  );
}

function ChartTooltip({
  index,
  series,
  x,
  y,
  yScale,
  min,
  max
}: {
  index: number;
  series: Array<{ id: string; label: string; data: TelemetrySeriesPoint[]; color: string; unit: string }>;
  x: number;
  y: number;
  yScale: (value: number) => number;
  min: number;
  max: number;
}) {
  const point = series[0]?.data[index];
  if (!point) return null;

  const time = new Date(point.time).toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div
      className="chart-tooltip absolute pointer-events-none z-10 px-3 py-2 bg-content-primary text-white rounded-lg shadow-lg text-xs"
      style={{
        left: x + 10,
        top: y,
        transform: 'translateX(-50%)'
      }}
      role="tooltip"
    >
      <div className="font-medium mb-1">{time}</div>
      {series.map(s => {
        const p = s.data[index];
        if (!p || p.value === null) return null;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded" style={{ backgroundColor: s.color }} />
            <span>{s.label}: </span>
            <span className="font-mono tabular-nums font-medium">{p.value.toFixed(1)} {s.unit}</span>
            {p.quality !== 0 && <span className="text-[9px] px-1 py-0.5 rounded bg-warning/20 text-warning">Q{p.quality}</span>}
            {p.n !== undefined && p.n < 60 && <span className="text-[9px] px-1 py-0.5 rounded bg-warning/20 text-warning">Partial</span>}
          </div>
        );
      })}
    </div>
  );
}

// Downsample using LTTB (Largest-Triangle-Three-Buckets) algorithm
function downsample<T extends { time: string; value: number | null }>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;

  // Simple every-nth downsampling for now (LTTB can be added later)
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}