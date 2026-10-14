import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '@contracts/index';
import type { Asset, PointRoles } from '../../../../packages/contracts/src/ontology';
import type { LatestResponse } from '../../../../packages/contracts/src/telemetry';
import type { Plant, PointRolesData } from 'packages-twin-core';
import { isRole, resolveRole } from 'packages-twin-core';
import { SimClient, WHATIF_LABEL, type WhatIfResult } from '../api/sim';
import { defaultBaseUrl } from '../api/client';
import { Header } from '../components/Header';
import { WhatIfOverlay } from '../components/WhatIfOverlay';
import { useAuth } from '../context/AuthContext';

const mediumColor = { chilled: 'var(--color-semantic-chilled)', condenser: 'var(--color-semantic-condenser)', other: 'var(--color-border-strong)' };
const preferredRoles = ['power-kw', 'run-status', 'supply-air-temp', 'area-temp'];

function initialView(plant: Plant): [number, number, number, number] {
  if (window.innerWidth < 640) return [0, 0, 760, 680];
  if (window.innerWidth < 1280) return [0, 0, 1100, 760];
  return plant.viewBox;
}

export function LivePlantSchematic() {
  const { accessToken, currentSiteId } = useAuth();
  const client = useMemo(() => new ApiClient({ baseUrl: defaultBaseUrl(), getToken: () => accessToken }), [accessToken]);
  const sim = useMemo(() => new SimClient(), []);
  const [layout, setLayout] = useState<Plant | null>(null);
  const [roles, setRoles] = useState<PointRoles | null>(null);
  const [assets, setAssets] = useState<Record<string, Asset>>({});
  const [readings, setReadings] = useState<Record<string, LatestResponse>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<[number, number, number, number] | null>(null);
  const drag = useRef<{ x: number; y: number; view: [number, number, number, number] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<WhatIfResult | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [setpoint, setSetpoint] = useState<number | null>(null);
  const [horizon, setHorizon] = useState(60);

  useEffect(() => {
    if (!currentSiteId) return;
    let alive = true;
    setLayout(null); setAssets({}); setReadings({}); setSelectedId(null); setSetpoint(null);
    Promise.all([client.getPlantLayout(currentSiteId), client.getPointRoles(currentSiteId)])
      .then(async ([plant, mapping]) => {
        const ids = [...new Set(plant.nodes.flatMap((node) => 'assetId' in node ? [node.assetId] : []))];
        const details = await Promise.all(ids.map((id) => client.getAsset(currentSiteId, id)));
        if (!alive) return;
        setLayout(plant); setRoles(mapping); setAssets(Object.fromEntries(details.map((asset) => [asset.id, asset])));
        setView(initialView(plant)); setSelectedId(details[0]?.id ?? null); setError(null);
      }).catch((reason) => { if (alive) setError(String(reason)); });
    return () => { alive = false; };
  }, [client, currentSiteId]);

  const refresh = useCallback(async () => {
    if (!currentSiteId || !layout) return;
    const ids = [...new Set(layout.nodes.flatMap((node) => 'assetId' in node ? [node.assetId] : []))];
    const next = await Promise.all(ids.map(async (id) => [id, await client.latest(currentSiteId, id)] as const));
    setReadings(Object.fromEntries(next)); setError(null);
  }, [client, currentSiteId, layout]);
  useEffect(() => {
    if (!layout) return;
    let alive = true;
    const poll = () => { void refresh().catch((reason) => { if (alive) setError(String(reason)); }); };
    poll(); const timer = window.setInterval(poll, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [layout, refresh]);

  const roleData: PointRolesData | null = roles && { byType: roles.byType,
    fallbackRules: roles.fallbackRules.flatMap((rule) => isRole(rule.role) ? [{ ...rule, role: rule.role }] : []) };
  const pointFor = (asset: Asset, role: string) => {
    if (!roleData) return null;
    const metadata = Object.fromEntries(asset.points.map((point) => [point.abbr, {
      abbreviation: point.abbr, displayName: point.display, classification: point.cls, unit: point.unit,
    }]));
    const { abbreviation } = resolveRole(roleData, asset.type, role, metadata);
    return asset.points.find((point) => point.abbr === abbreviation) ?? null;
  };
  const selected = selectedId ? assets[selectedId] : null;
  const selectedRoles = selected && roleData ? Object.keys(roleData.byType[selected.type] ?? {}) : [];
  const writable = Object.values(assets).flatMap((asset) => {
    const point = pointFor(asset, 'setpoint-chw-temp');
    return point?.writable ? [{ asset, point }] : [];
  })[0];
  const proposedValue = setpoint ?? (writable && readings[writable.asset.id]?.fields[writable.point.abbr]?.value) ?? null;
  const selectedView = view ?? layout?.viewBox;
  const positions = new Map(layout?.nodes.map((node) => [node.id, node.xy]) ?? []);

  const zoom = (factor: number) => setView((old) => {
    if (!old) return old;
    const width = Math.max(260, Math.min((layout?.viewBox[2] ?? 1600) * 1.5, old[2] * factor));
    const height = old[3] * width / old[2];
    return [old[0] + (old[2] - width) / 2, old[1] + (old[3] - height) / 2, width, height];
  });
  const runWhatIf = async () => {
    setPredicting(true); setPredictError(null);
    try { setPrediction(await sim.whatIf({ changes: [{ type: 'setpoint', field: 'setpoint-chw-temp', value: proposedValue! }], horizonMin: horizon, stepMinutes: 5 })); }
    catch (reason) { setPredictError(String(reason)); }
    finally { setPredicting(false); }
  };

  return <div className="min-h-screen bg-surface-base text-content-primary">
    <Header breadcrumb={[{ label: 'Plant schematic' }]} />
    <main className="p-4 lg:p-6" style={{ paddingTop: 'calc(var(--header-height) + 24px)' }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] tracking-widest text-content-tertiary">SYSTEMS / WATER CIRCUITS</p><h1 className="mt-2">Plant schematic</h1><p className="mt-1 text-sm text-content-secondary">Site-authored topology and live equipment readings.</p></div><span className="rounded bg-surface-sunken px-3 py-1 text-xs text-content-tertiary">Schematic layout · not to scale</span></div>
      {error && <p role="alert" className="mb-4 rounded border border-critical p-3 text-sm text-critical">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 self-start rounded-lg border border-border-default bg-surface-elevated p-3" aria-label="L2 plant schematic">
          <div className="mb-2 flex justify-end gap-2"><button className="rounded border border-border-default px-3 py-1.5 text-sm" onClick={() => zoom(.8)} aria-label="Zoom in">+</button><button className="rounded border border-border-default px-3 py-1.5 text-sm" onClick={() => zoom(1.25)} aria-label="Zoom out">−</button><button className="rounded border border-border-default px-3 py-1.5 text-sm" onClick={() => setView(layout?.viewBox ?? null)}>Fit</button></div>
          {layout && selectedView ? <svg viewBox={selectedView.join(' ')} role="img" aria-label="Live plant topology" className="h-[320px] w-full touch-none rounded bg-surface-base md:h-[440px] xl:h-[520px]"
            onWheel={(event) => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.1 : .9); }}
            onPointerDown={(event) => { if ((event.target as Element).closest('[data-asset-node]')) return; drag.current = { x: event.clientX, y: event.clientY, view: [...selectedView] }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (!drag.current) return; const rect = event.currentTarget.getBoundingClientRect(); const start = drag.current; setView([start.view[0] - (event.clientX - start.x) * start.view[2] / rect.width, start.view[1] - (event.clientY - start.y) * start.view[3] / rect.height, start.view[2], start.view[3]]); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            {layout.edges.map((edge) => { const from = positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <path key={edge.id} d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`} fill="none" stroke={mediumColor[edge.medium]} strokeWidth="5" opacity=".75" /> : null; })}
            {layout.nodes.map((node) => {
              const [x, y] = node.xy;
              if (node.kind === 'header') return <g key={node.id}><path d={`M${x} ${y}h${node.w}`} stroke="var(--color-border-strong)" strokeWidth="9" /><text x={x} y={y - 14} className="fill-content-tertiary" fontSize="20">{node.label}</text></g>;
              const asset = assets[node.assetId];
              if (!asset) return null;
              const role = preferredRoles.find((candidate) => pointFor(asset, candidate)) ?? Object.keys(roleData?.byType[asset.type] ?? {})[0];
              const point = role ? pointFor(asset, role) : null;
              const reading = point ? readings[asset.id]?.fields[point.abbr] : undefined;
              const good = reading?.quality === 0;
              return <g key={node.id} data-asset-node transform={`translate(${x},${y})`} onClick={() => setSelectedId(asset.id)} className="cursor-pointer" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedId(asset.id); }} aria-label={`Select ${asset.name}`}>
                <rect x="-88" y="-42" width="176" height="96" rx="8" fill="var(--color-surface-elevated)" stroke={selectedId === asset.id ? 'var(--color-semantic-info)' : 'var(--color-border-strong)'} strokeWidth={selectedId === asset.id ? 3 : 1} />
                <text textAnchor="middle" y="-12" className="fill-content-primary" fontSize="19">{asset.name.length > 18 ? `${asset.name.slice(0, 16)}…` : asset.name}</text>
                <text textAnchor="middle" y="19" fill={good ? 'var(--color-semantic-success)' : 'var(--color-content-tertiary)'} fontSize="21" className="font-mono">{good && reading?.value != null ? `${reading.value.toFixed(1)} ${point?.unit ?? ''}` : '—'}</text>
                <text textAnchor="middle" y="44" className="fill-content-tertiary" fontSize="15">{point?.display ?? 'not available at this site'}</text>
              </g>;
            })}
          </svg> : <div className="flex h-[320px] items-center justify-center text-sm text-content-tertiary md:h-[440px] xl:h-[520px]">Loading plant layout…</div>}
          <p className="mt-3 text-xs text-content-tertiary">Select equipment for role-bound readings. Drag to pan; scroll or use controls to zoom.</p>
        </section>
        <aside className="space-y-4">
          <section className="rounded-lg border border-border-default bg-surface-elevated p-5" aria-label="Selected equipment">
            <p className="font-mono text-xs tracking-wider text-content-tertiary">SELECTED EQUIPMENT</p><h2 className="mt-2 text-lg font-semibold">{selected?.name ?? 'Select equipment'}</h2>
            {selected && <><div className="mt-4 space-y-2">{selectedRoles.slice(0, 5).map((role) => { const point = pointFor(selected, role); const reading = point ? readings[selected.id]?.fields[point.abbr] : undefined; return <div key={role} className="flex justify-between gap-2 border-b border-border-default pb-2 text-sm"><span className="text-content-secondary">{point?.display ?? role.replaceAll('-', ' ')}</span><span className="shrink-0 font-mono" title={reading?.quality === 0 ? reading.at : 'Bad or missing reading'}>{reading?.quality === 0 && reading.value != null ? `${reading.value.toFixed(1)} ${point?.unit ?? ''}` : '—'}</span></div>; })}</div><p className="mt-3 text-xs text-content-tertiary">{Object.keys(readings[selected.id]?.fields ?? {}).length}/{selected.points.length} points received</p>{selected.points.some((point) => point.writable) && <Link to="/setpoints" className="mt-4 block rounded bg-chilled px-3 py-2 text-center text-sm text-white">Request set-point change</Link>}</>}
          </section>
          <section className="rounded-lg border border-border-default bg-surface-elevated p-5" aria-label="Proposed change">
            <h2 className="text-sm font-semibold">Proposed change</h2><p className="mt-1 text-xs text-content-tertiary">Preview plant response without writing equipment.</p>
            <label className="mt-4 block text-xs text-content-secondary">Chilled-water set point ({writable?.point.unit ?? '°C'})<input aria-label="Chilled-water set point" type="number" step="0.5" min={writable?.point.safeMin} max={writable?.point.safeMax} value={proposedValue ?? ''} onChange={(event) => setSetpoint(event.target.value === '' ? null : Number(event.target.value))} className="mt-1 w-full rounded border border-border-default bg-surface-base p-2 text-sm" /></label>
            <label className="mt-3 block text-xs text-content-secondary">Horizon<select aria-label="Horizon" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} className="mt-1 w-full rounded border border-border-default bg-surface-base p-2 text-sm"><option value={30}>30 min</option><option value={60}>60 min</option><option value={120}>120 min</option></select></label>
            <button disabled={predicting || !writable || proposedValue === null || proposedValue < (writable.point.safeMin ?? -Infinity) || proposedValue > (writable.point.safeMax ?? Infinity)} onClick={() => void runWhatIf()} className="mt-4 w-full rounded bg-chilled px-3 py-2 text-sm text-white disabled:opacity-50">{predicting ? 'Predicting…' : 'Run what-if'}</button>
          </section>
          <WhatIfOverlay label={WHATIF_LABEL} result={prediction} loading={predicting} error={predictError} />
        </aside>
      </div>
    </main>
  </div>;
}
