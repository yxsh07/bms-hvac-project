import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import { WhatIfOverlay } from '../components/WhatIfOverlay';
import { MEDIUM_STROKE, MOCK_PLANT, PLANT_TARGETS, PLANT_VIEWBOX } from '../fixtures/plantLayout';
import type { PlantNodeFixture } from '../fixtures/plantLayout';
import { SimClient, WHATIF_LABEL, type WhatIfResult } from '../api/sim';
import { useSiteData } from '../hooks/useSiteData';
import clsx from 'clsx';

/**
 * L2 plant schematic with the what-if ghost overlay (PLAN 5.5, 5.9).
 *
 * The schematic is schematic-only (no CAD/BIM), pan/zoom and asset cards are
 * later work; this slice renders role-bound sensor chips and the what-if
 * overlay, which is labelled "indicative, 3-day calibration" and warns when the
 * prediction leaves the surrogate's training envelope.
 */
export function PlantSchematic() {
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Plant Schematic' },
  ];
  const [client] = useState(() => new SimClient());
  const [horizon, setHorizon] = useState(60);
  const [setpoint, setSetpoint] = useState(8);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { plant, error: liveError } = useSiteData();

  const nodeById = useMemo(() => {
    const map = new Map<string, PlantNodeFixture>();
    for (const n of MOCK_PLANT.nodes) map.set(n.id, n);
    return map;
  }, []);

  const ghostKw = result?.predicted.series.at(-1)?.kw ?? null;
  const ghostDt = result?.predicted.series.at(-1)?.deltaTC ?? null;

  const runWhatIf = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await client.whatIf({
        changes: [
          { type: 'setpoint', target: PLANT_TARGETS.lead, field: 'setpoint-chw-temp', value: Number(setpoint) },
        ],
        horizonMin: horizon,
        stepMinutes: 5,
      });
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main style={{ paddingTop: 'calc(var(--header-height) + 24px)' }} className="p-4 lg:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[10px] font-mono tracking-widest text-content-tertiary">SYSTEMS / WATER CIRCUITS</p><h1 className="mt-2 text-content-primary">Plant schematic</h1><p className="mt-1 text-sm text-content-secondary">Trace connected equipment and model a proposed change. {liveError ? `Live data unavailable: ${liveError}` : plant ? 'Live values update every 5 seconds.' : 'Connecting to live data…'}</p></div>
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-content-tertiary">
            schematic layout — not to scale
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-lg border border-border-default bg-surface-elevated p-2" aria-label="L2 plant schematic">
            <svg
              viewBox={PLANT_VIEWBOX.join(' ')}
              className="h-auto w-full max-sm:min-w-[700px]"
              role="img"
              aria-label="Schematic of the chilled and condenser water loops"
            >
              {MOCK_PLANT.edges.map((edge) => {
                const from = nodeById.get(edge.from);
                const to = nodeById.get(edge.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={edge.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={MEDIUM_STROKE[edge.medium]}
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                );
              })}

              {MOCK_PLANT.nodes.map((node) => {
                const isSelected = selected === node.id;
                if (node.kind === 'header') {
                  return (
                    <g key={node.id}>
                      <line x1={node.x} y1={node.y} x2={node.x + 700} y2={node.y} stroke="var(--color-border-strong)" strokeWidth={8} strokeLinecap="round" />
                      <text x={node.x} y={node.y - 10} className="fill-content-tertiary" fontSize="11">{node.label}</text>
                    </g>
                  );
                }
                if (node.kind === 'sensor') {
                  const value = node.role === 'power-kw' ? plant?.totalKw : node.role === 'chw-delta-t' ? plant?.chwDeltaT : null;
                  const ghost = node.role === 'power-kw' ? ghostKw : node.role === 'chw-delta-t' ? ghostDt : null;
                  const ghostTestId = node.role === 'power-kw' ? 'ghost-kw' : node.role === 'chw-delta-t' ? 'ghost-delta-t' : undefined;
                  return (
                    <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                      <rect x={-34} y={-14} width={68} height={28} rx={14} fill="var(--color-surface-base)" stroke="var(--color-semantic-success)" />
                      <text textAnchor="middle" y={-2} fontSize="9" className="fill-content-tertiary">{node.label}</text>
                      <text textAnchor="middle" y={9} fontSize="10" className="fill-content-primary font-mono">{value == null ? '—' : `${value.toFixed(1)}${node.unit ?? ''}`}</text>
                      {ghost !== null && (
                        <g transform="translate(0,30)" data-testid={ghostTestId}>
                          <rect x={-34} y={-13} width={68} height={26} rx={13} fill="var(--color-surface-base)" stroke="var(--color-semantic-info)" strokeDasharray="4 2" />
                          <text textAnchor="middle" y={-1} fontSize="8" fill="var(--color-semantic-info)">ghost</text>
                          <text textAnchor="middle" y={9} fontSize="10" fill="var(--color-semantic-info)" className="font-mono">{ghost.toFixed(1)}{node.unit}</text>
                        </g>
                      )}
                    </g>
                  );
                }
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onClick={() => setSelected(node.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={-38}
                      y={-20}
                      width={76}
                      height={40}
                      rx={6}
                      fill="var(--color-surface-base)"
                      stroke={isSelected ? 'var(--color-semantic-info)' : 'var(--color-border-strong)'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    <text textAnchor="middle" y={4} fontSize="11" className="fill-content-primary">{node.label}</text>
                  </g>
                );
              })}
            </svg>
          </section>

          <aside className="space-y-3">
            <section className="rounded-lg border border-border-default bg-surface-base p-3" aria-label="Proposed change">
              <h2 className="mb-2 text-sm font-semibold text-content-primary">Proposed change</h2>
              <label className="mb-2 grid gap-1 text-xs text-content-tertiary">
                Chilled-water set point (°C)
                <input
                  type="number"
                  step={0.5}
                  min={5}
                  max={16}
                  className="rounded border border-border-default bg-surface-elevated px-2 py-1 font-mono text-sm text-content-primary"
                  value={setpoint}
                  onChange={(e) => setSetpoint(Number(e.target.value))}
                  aria-label="Chilled-water set point"
                />
              </label>
              <label className="mb-3 grid gap-1 text-xs text-content-tertiary">
                Horizon
                <select
                  className="rounded border border-border-default bg-surface-elevated px-2 py-1 text-sm text-content-primary"
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                  aria-label="Horizon"
                >
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                  <option value={120}>120 min</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => void runWhatIf()}
                disabled={loading}
                className={clsx(
                  'w-full rounded bg-chilled px-3 py-1.5 text-sm font-medium text-content-inverse',
                  loading && 'opacity-60',
                )}
              >
                {loading ? 'Predicting…' : 'Run what-if'}
              </button>
            </section>

            <WhatIfOverlay label={WHATIF_LABEL} result={result} loading={loading} error={error} />
          </aside>
        </div>
      </main>
    </div>
  );
}
