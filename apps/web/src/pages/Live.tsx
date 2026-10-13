import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient, qualityLabel, type AssetSummary, type LatestResponse } from '../api/client';
import { Header } from '../components/Header';

/**
 * Live (T-029 / gate G2): log in to the real API, open an asset and show its
 * latest values with the quality code. This is the browser half of the
 * Sim -> ingest -> quality -> API -> browser chain.
 */
export function Live() {
  const [client] = useState(() => new ApiClient());
  const [email, setEmail] = useState('engineer@example.com');
  const [password, setPassword] = useState('Engineer123!');
  const [siteId, setSiteId] = useState('simsite-hospital');
  const [connected, setConnected] = useState(false);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selected, setSelected] = useState<AssetSummary | null>(null);
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<number | null>(null);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await client.login(email, password);
      const list = await client.listAssets(siteId);
      setAssets(list);
      setConnected(true);
      // Select a critical asset by default (no equipment words in UI code).
      const preferred = list.find((a) => a.criticality === 'critical') ?? list[0] ?? null;
      setSelected(preferred);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnected(false);
    } finally {
      setBusy(false);
    }
  }, [client, email, password, siteId]);

  const loadLatest = useCallback(
    async (asset: AssetSummary) => {
      try {
        setLatest(await client.latest(siteId, asset.id));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [client, siteId],
  );

  useEffect(() => {
    if (!connected || !selected) return;
    void loadLatest(selected);
    poll.current = window.setInterval(() => void loadLatest(selected), 5000);
    return () => {
      if (poll.current !== null) window.clearInterval(poll.current);
    };
  }, [connected, selected, loadLatest]);

  return (
    <div className="min-h-screen bg-surface-base text-content-primary">
      <Header breadcrumb={[{ label: 'Live telemetry' }]} />
      <main className="live-page p-5 lg:p-8" style={{ paddingTop: 'calc(var(--header-height) + 28px)' }}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-mono tracking-widest text-content-tertiary">OBSERVE / DATA QUALITY</p><h1 className="mt-2">Live telemetry</h1><p className="mt-2 text-sm text-content-secondary">Inspect the latest values from the simulation stream.</p></div><div className="rounded-md border border-default bg-surface-elevated px-3 py-2 text-xs text-content-secondary"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-600' : 'bg-amber-500'}`} />{connected ? 'Connected' : 'Connect to API'}</div></div>

      <section className="mb-6 grid gap-3 rounded-lg border border-default bg-surface-elevated p-5 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end" aria-label="Connection">
        <label className="grid gap-1 text-sm">
          API user
          <input className="min-h-10 rounded border border-default bg-white px-2 py-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Password
          <input
            className="min-h-10 rounded border border-default bg-white px-2 py-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Site
          <input className="min-h-10 rounded border border-default bg-white px-2 py-1" value={siteId} onChange={(e) => setSiteId(e.target.value)} />
        </label>
        <button
          className="min-h-10 justify-self-start rounded bg-content-primary px-4 py-1.5 text-sm font-semibold text-white"
          onClick={() => void connect()}
          disabled={busy}
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </section>

      {error && (
        <p className="mb-4 rounded border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error} — Check the connection and try again.
        </p>
      )}

      {connected && (
        <section className="mb-6 grid gap-2 rounded-lg border border-default bg-surface-elevated p-5">
          <label className="grid gap-1 text-sm max-w-md">
            Asset ({assets.length})
            <select
              className="min-h-10 rounded border border-default bg-white px-2 py-1"
              value={selected?.id ?? ''}
              onChange={(e) => setSelected(assets.find((a) => a.id === e.target.value) ?? null)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {selected && latest && (
        <section className="overflow-x-auto rounded-lg border border-default bg-surface-elevated p-5">
          <h2 className="mb-2 text-lg font-semibold">Latest points · {selected.name}</h2>
          <div className="mb-4 text-sm text-content-tertiary">
            coverage {latest.quality.coveragePct.toFixed(1)}% · {latest.quality.goodSamples}/
            {latest.quality.expectedSamples} good samples
            {latest.quality.hasDelayedData ? ' · includes delayed data' : ''}
          </div>
          <table className="w-full min-w-[24rem] text-sm border-collapse">
            <thead>
              <tr className="text-left text-content-tertiary">
                <th className="border-b border-default py-3 pr-6">Point</th>
                <th className="border-b border-default py-3 pr-6">Value</th>
                <th className="border-b border-default py-3">Quality</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(latest.fields).map(([field, point]) => (
                <tr key={field}>
                  <td className="border-b border-default py-3 pr-6 font-mono">{field}</td>
                  <td className="border-b border-default py-3 pr-6 font-mono" data-testid={`value-${field}`}>
                    {point.value === null ? '—' : point.value}
                  </td>
                  <td className="border-b border-default py-3">{qualityLabel(point.quality)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      </main>
    </div>
  );
}
