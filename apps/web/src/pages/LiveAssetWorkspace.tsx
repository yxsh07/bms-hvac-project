import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '@contracts/index';
import type { Asset, AssetSummary, PointRoles } from '../../../../packages/contracts/src/ontology';
import type { LatestResponse } from '../../../../packages/contracts/src/telemetry';
import { isRole, resolveRole } from 'packages-twin-core';
import { defaultBaseUrl } from '../api/client';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';

const qualityName = ['Good', 'Sentinel', 'Out of range', 'Stopped equipment', 'Inconsistent'];

export function LiveAssetWorkspace() {
  const { accessToken, currentSiteId } = useAuth();
  const client = useMemo(() => new ApiClient({ baseUrl: defaultBaseUrl(), getToken: () => accessToken }), [accessToken]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [roles, setRoles] = useState<PointRoles | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSiteId) return;
    let alive = true;
    setLoading(true);
    setSelectedId(null);
    setAsset(null);
    setLatest(null);
    Promise.all([client.listAssets(currentSiteId), client.getPointRoles(currentSiteId)])
      .then(([items, mapping]) => {
        if (!alive) return;
        setAssets(items);
        setRoles(mapping);
        setSelectedId(items[0]?.id ?? null);
        setError(null);
      })
      .catch((reason) => { if (alive) setError(String(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client, currentSiteId]);

  const refresh = useCallback(async () => {
    if (!currentSiteId || !selectedId) return;
    const [detail, readings] = await Promise.all([
      client.getAsset(currentSiteId, selectedId), client.latest(currentSiteId, selectedId),
    ]);
    setAsset(detail);
    setLatest(readings);
    setError(null);
  }, [client, currentSiteId, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const poll = () => { void refresh().catch((reason) => { if (alive) setError(String(reason)); }); };
    poll();
    const timer = window.setInterval(poll, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [refresh, selectedId]);

  const types = [...new Set(assets.map((entry) => entry.type))].sort();
  const visible = assets.filter((entry) => (!type || entry.type === type)
    && `${entry.name} ${entry.type}`.toLowerCase().includes(query.toLowerCase()));
  const metadata = Object.fromEntries((asset?.points ?? []).map((point) => [point.abbr, {
    abbreviation: point.abbr, displayName: point.display, classification: point.cls, unit: point.unit,
  }]));
  const roleData = roles && { byType: roles.byType, fallbackRules: roles.fallbackRules.flatMap((rule) => isRole(rule.role) ? [{ ...rule, role: rule.role }] : []) };
  const mapped = roleData && asset ? Object.entries(roleData.byType[asset.type] ?? {}).map(([role]) => {
    const result = resolveRole(roleData, asset.type, role, metadata);
    const point = asset.points.find((entry) => entry.abbr === result.abbreviation);
    return { role, point, reading: result.abbreviation ? latest?.fields[result.abbreviation] : undefined, reason: result.reason };
  }) : [];
  const mappedAbbr = new Set(mapped.map((item) => item.point?.abbr));
  const extra = (asset?.points ?? []).filter((point) => !mappedAbbr.has(point.abbr));
  const total = asset?.points.length ?? 0;
  const received = asset?.points.filter((point) => latest?.fields[point.abbr] !== undefined).length ?? 0;
  const firstStatus = mapped.find((entry) => entry.role === 'run-status');
  const firstFault = mapped.find((entry) => entry.role === 'fault-alarm');

  return <div className="min-h-screen bg-surface-base text-content-primary">
    <Header breadcrumb={[{ label: 'Assets' }]} />
    <main className="mx-auto max-w-7xl p-5 lg:p-8" style={{ paddingTop: 'calc(var(--header-height) + 28px)' }}>
      <p className="font-mono text-xs tracking-widest text-content-tertiary">EQUIPMENT / LIVE SITE DATA</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div><h1>Asset workspace</h1><p className="mt-2 text-sm text-content-secondary">Inspect equipment readings and quality. Values refresh every five seconds.</p></div>
        <span className="font-mono text-xs text-content-tertiary">{assets.length} ASSETS · {currentSiteId}</span>
      </div>
      {error && <p role="alert" className="mt-5 rounded border border-critical p-3 text-sm text-critical">{error}</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-border-default bg-surface-elevated p-4" aria-label="Asset browser">
          <label className="block text-xs font-medium text-content-secondary">Search assets
            <input className="mt-2 w-full rounded border border-border-default bg-surface-base p-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or equipment type" />
          </label>
          <label className="mt-4 block text-xs font-medium text-content-secondary">Equipment type
            <select className="mt-2 w-full rounded border border-border-default bg-surface-base p-2 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>{types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
            {visible.map((entry) => <button key={entry.id} type="button" onClick={() => { setSelectedId(entry.id); setAsset(null); setLatest(null); }} aria-pressed={entry.id === selectedId}
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm ${entry.id === selectedId ? 'bg-surface-base text-content-primary' : 'text-content-secondary hover:bg-surface-base'}`}>
              <span className="truncate font-medium">{entry.name}</span><span className="truncate font-mono text-[10px] uppercase text-content-tertiary">{entry.type}</span>
            </button>)}
            {!loading && visible.length === 0 && <p className="p-3 text-sm text-content-tertiary">No matching equipment.</p>}
            {loading && <p className="p-3 text-sm text-content-tertiary">Loading assets…</p>}
          </div>
        </aside>
        <section className="min-w-0 space-y-5" aria-label="Equipment details">
          {!selectedId && !loading && <p className="rounded-lg border border-border-default bg-surface-elevated p-8 text-content-tertiary">No equipment is available for this site.</p>}
          {selectedId && !asset && <p className="rounded-lg border border-border-default bg-surface-elevated p-8 text-content-tertiary">Loading equipment…</p>}
          {asset && <>
            <div className="rounded-lg border border-border-default bg-surface-elevated p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-mono text-xs uppercase tracking-wider text-content-tertiary">{asset.type} / {asset.criticality} priority</p><h2 className="mt-1 text-2xl font-semibold">{asset.name}</h2></div>
                <div className="flex gap-2 text-xs"><span className="rounded border border-border-default px-3 py-2">{firstStatus?.reading?.value === 1 ? 'Running' : firstStatus?.reading?.value === 0 ? 'Stopped' : 'Status unavailable'}</span><span className="rounded border border-border-default px-3 py-2">{firstFault?.reading?.value === 1 ? 'Fault' : 'No reported fault'}</span></div>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
                <svg viewBox="0 0 540 180" role="img" aria-label={`Schematic equipment view of ${asset.name}`} className="w-full rounded bg-surface-base">
                  <path d="M45 90h450" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
                  <rect x="130" y="30" width="280" height="120" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M160 65h220M160 90h220M160 115h220" stroke="currentColor" strokeOpacity=".4" strokeWidth="2" />
                  <circle cx="270" cy="90" r="27" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M270 66v48M246 90h48" stroke="currentColor" strokeWidth="2" />
                  <text x="270" y="169" textAnchor="middle" fill="currentColor" fontSize="10" letterSpacing="2">SCHEMATIC LAYOUT · {asset.type.toUpperCase()}</text>
                </svg>
                <div className="flex flex-col justify-center gap-3 text-sm"><span className="font-mono text-xs text-content-tertiary">POINT COVERAGE</span><strong className="text-3xl">{received}/{total}</strong><span className="text-content-secondary">readings received</span><Link to="/setpoints" className="mt-2 rounded bg-chilled px-3 py-2 text-center text-sm text-white">Request set-point change</Link></div>
              </div>
            </div>
            <div className="rounded-lg border border-border-default bg-surface-elevated p-5 md:p-6">
              <h3 className="text-lg font-semibold">Parameters</h3>
              <p className="mt-1 text-sm text-content-tertiary">Site roles first, followed by all other equipment points.</p>
              <div className="mt-4 grid gap-x-6 md:grid-cols-2">
                {mapped.map(({ role, point, reading, reason }) => <Parameter key={role} label={point?.display ?? role.replaceAll('-', ' ')} unit={point?.unit ?? ''} value={reading?.value} quality={reading?.quality} at={reading?.at} reason={reason ?? (!point ? 'not available at this site' : undefined)} />)}
                {extra.map((point) => <Parameter key={point.abbr} label={point.display} unit={point.unit} value={latest?.fields[point.abbr]?.value} quality={latest?.fields[point.abbr]?.quality} at={latest?.fields[point.abbr]?.at} />)}
              </div>
            </div>
          </>}
        </section>
      </div>
    </main>
  </div>;
}

export function parameterState(quality: number | undefined, at: string | undefined, reason?: string, now = Date.now()) {
  if (reason) return reason;
  if (quality === undefined) return 'No reading';
  if (quality !== 0) return qualityName[quality] ?? 'Bad quality';
  if (at && now - Date.parse(at) > 120_000) return 'Stale';
  return 'Good';
}

function Parameter({ label, value, unit, quality, at, reason }: { label: string; value?: number | null; unit: string; quality?: number; at?: string; reason?: string }) {
  const state = parameterState(quality, at, reason);
  const valid = state === 'Good' && value !== null && value !== undefined;
  return <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border-default py-3 text-sm">
    <div className="min-w-0"><p className="truncate font-medium">{label}</p><p className="mt-1 text-xs text-content-tertiary">{state}</p></div>
    <span className="shrink-0 font-mono tabular-nums" title={at ?? state}>{valid ? `${value} ${unit}` : '—'}</span>
  </div>;
}
