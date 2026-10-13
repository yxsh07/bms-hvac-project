import clsx from 'clsx';
import type { WhatIfResult } from '../api/sim';

/**
 * L2 ghost overlay (PLAN 5.9 item 5; task WIF1).
 *
 * Draws the predicted plant kW and chilled-water ΔT as a ghost over the
 * baseline the simulator produced. Everything is labelled "indicative,
 * 3-day calibration" and a warning is shown when the surrogate left its
 * training envelope.
 */
interface WhatIfOverlayProps {
  label: string;
  result: WhatIfResult | null;
  loading?: boolean;
  error?: string | null;
}

function polyline(values: number[], min: number, max: number): string {
  if (values.length === 0) return '';
  const span = Math.max(max - min, 1e-6);
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
      const y = 34 - ((v - min) / span) * 30;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function Trend({
  title,
  unit,
  baseline,
  predicted,
  testId,
}: {
  title: string;
  unit: string;
  baseline: number[];
  predicted: number[];
  testId: string;
}) {
  const all = [...baseline, ...predicted];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const first = predicted[0] ?? 0;
  const last = predicted[predicted.length - 1] ?? 0;
  return (
    <div className="rounded-md border border-border-default bg-surface-elevated p-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-content-tertiary">{title}</span>
        <span className="font-mono text-sm text-content-primary" data-testid={testId}>
          {last.toFixed(1)} {unit}
        </span>
      </div>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-9 w-full" role="img" aria-label={`${title} ghost overlay`}>
        <polyline points={polyline(baseline, min, max)} fill="none" stroke="var(--color-content-tertiary)" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        <polyline points={polyline(predicted, min, max)} fill="none" stroke="var(--color-semantic-info)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-content-tertiary">
        <span>now {first.toFixed(1)}</span>
        <span>+{predicted.length > 1 ? 'horizon' : '1 step'}</span>
      </div>
    </div>
  );
}

export function WhatIfOverlay({ label, result, loading, error }: WhatIfOverlayProps) {
  return (
    <section className="rounded-lg border border-border-default bg-surface-base p-3" aria-label="What-if predicted overlay">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-content-primary">What-if (ghost overlay)</h2>
        <span className="rounded-full bg-semantic-info/10 px-2 py-0.5 text-[10px] font-medium text-semantic-info" data-testid="whatif-label">
          {label}
        </span>
      </header>

      {error && (
        <p className="rounded-md border border-semantic-critical/40 bg-semantic-critical/10 px-2 py-1.5 text-xs text-semantic-critical" data-testid="whatif-error">
          {error}
        </p>
      )}

      {loading && !result && (
        <p className="py-3 text-center text-xs text-content-tertiary">Stepping a copy of live state…</p>
      )}

      {!result && !loading && !error && (
        <p className="py-3 text-center text-xs text-content-tertiary">
          Propose a chilled-water set point to see predicted kW and ΔT.
        </p>
      )}

      {result && (
        <div className="space-y-2">
          <Trend
            title="Plant kW — baseline (dashed) vs predicted"
            unit="kW"
            baseline={result.baselineSeries.map((s) => s.kw)}
            predicted={result.predicted.series.map((s) => s.kw)}
            testId="whatif-kw-predicted"
          />
          <Trend
            title="Chilled-water ΔT — baseline vs predicted"
            unit="K"
            baseline={result.baselineSeries.map((s) => s.deltaTC)}
            predicted={result.predicted.series.map((s) => s.deltaTC)}
            testId="whatif-delta-predicted"
          />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-content-tertiary">Mean kW</dt>
            <dd className="text-right font-mono text-content-primary">
              {result.baseline.meanKw.toFixed(1)} → {result.predicted.meanKw.toFixed(1)}
            </dd>
            <dt className="text-content-tertiary">Mean ΔT</dt>
            <dd className="text-right font-mono text-content-primary">
              {result.baseline.meanDeltaTC.toFixed(2)} → {result.predicted.meanDeltaTC.toFixed(2)} K
            </dd>
            <dt className="text-content-tertiary">Horizon</dt>
            <dd className="text-right font-mono text-content-primary">{result.horizonMin} min</dd>
          </dl>

          {result.warning && (
            <p
              className="rounded-md border border-semantic-warning/50 bg-semantic-warning/10 px-2 py-1.5 text-xs text-content-primary"
              data-testid="whatif-warning"
            >
              ⚠ {result.warning}
            </p>
          )}

          <p
            className={clsx(
              'text-[10px]',
              result.liveStateUnchanged ? 'text-semantic-success' : 'text-semantic-critical',
            )}
            data-testid="whatif-live-unchanged"
          >
            {result.liveStateUnchanged ? 'Live state unchanged (endpoint stepped a copy).' : 'Warning: live state changed.'}
          </p>
        </div>
      )}
    </section>
  );
}
