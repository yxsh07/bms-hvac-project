import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@contracts/index';
import type { WritablePoint, SetpointRequest } from '../../../../packages/contracts/src/setpoint';
import { defaultBaseUrl } from '../api/client';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';

export function LiveSetpoints() {
  const { accessToken, currentSiteId, hasPermission } = useAuth();
  const client = useMemo(() => new ApiClient({ baseUrl: defaultBaseUrl(), getToken: () => accessToken }), [accessToken]);
  const [points, setPoints] = useState<WritablePoint[]>([]);
  const [requests, setRequests] = useState<SetpointRequest[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [value, setValue] = useState('');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentSiteId) return;
    try {
      const [nextPoints, page] = await Promise.all([
        client.listWritableSetpoints(currentSiteId), client.listSetpointRequests(currentSiteId),
      ]);
      setPoints(nextPoints);
      setRequests(page.items);
      setSelectedKey((previous) => previous || (nextPoints[0] ? `${nextPoints[0].assetId}:${nextPoints[0].field}` : ''));
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [client, currentSiteId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selected = points.find((point) => `${point.assetId}:${point.field}` === selectedKey);
  const perform = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); setMessage(success); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const propose = () => {
    if (!selected || !currentSiteId) return;
    const numeric = Number(value);
    if (!value || !Number.isFinite(numeric) || numeric < selected.safeMin || numeric > selected.safeMax) {
      setError(`Enter a value from ${selected.safeMin} to ${selected.safeMax} ${selected.unit}.`);
      return;
    }
    if (!justification.trim()) { setError('A reason is required for an audited request.'); return; }
    void perform(
      () => client.proposeSetpoint(currentSiteId, selected.assetId, selected.field, { value: numeric, justification: justification.trim() }, crypto.randomUUID()),
      'Proposal submitted. A different authorized user must approve it.',
    );
  };

  return <div className="min-h-screen bg-surface-base text-content-primary">
    <Header breadcrumb={[{ label: 'Set-point requests' }]} />
    <main className="mx-auto max-w-6xl p-5 lg:p-8" style={{ paddingTop: 'calc(var(--header-height) + 28px)' }}>
      <p className="font-mono text-xs tracking-widest text-content-tertiary">CONTROL / AUDITED WORKFLOW</p>
      <h1 className="mt-2">Set-point requests</h1>
      <p className="mt-2 text-sm text-content-secondary">Propose a value, then have a different authorized user approve it. The API writes through SimSite’s mock gateway and verifies read-back.</p>
      {error && <p role="alert" className="mt-4 rounded border border-critical p-3 text-sm text-critical">{error}</p>}
      {message && <p role="status" className="mt-4 rounded border border-success p-3 text-sm text-success">{message}</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="rounded-lg border border-border-default bg-surface-elevated p-5">
          <h2 className="text-lg font-semibold">Propose a change</h2>
          <label className="mt-5 block text-sm">Writable point
            <select className="mt-1 w-full rounded border border-border-default bg-surface-base p-2" value={selectedKey} onChange={(event) => { setSelectedKey(event.target.value); setValue(''); }}>
              {points.map((point) => <option key={`${point.assetId}:${point.field}`} value={`${point.assetId}:${point.field}`}>{point.assetName} · {point.display}</option>)}
            </select>
          </label>
          {selected && <p className="mt-2 text-xs text-content-tertiary">Current: {selected.currentValue ?? 'unavailable'} {selected.unit} · safe range {selected.safeMin}–{selected.safeMax} {selected.unit}{selected.liveRequest ? ' · request already active' : ''}</p>}
          <label className="mt-5 block text-sm">Proposed value
            <input className="mt-1 w-full rounded border border-border-default bg-surface-base p-2" type="number" step="any" min={selected?.safeMin} max={selected?.safeMax} value={value} onChange={(event) => setValue(event.target.value)} />
          </label>
          <label className="mt-5 block text-sm">Reason
            <textarea className="mt-1 min-h-20 w-full rounded border border-border-default bg-surface-base p-2" value={justification} onChange={(event) => setJustification(event.target.value)} />
          </label>
          <button className="mt-4 rounded bg-chilled px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !selected || !!selected.liveRequest || !hasPermission('setpoints:propose')} onClick={propose}>Submit proposal</button>
          {!hasPermission('setpoints:propose') && <p className="mt-2 text-xs text-content-tertiary">This role can view requests but cannot propose a change.</p>}
        </section>
        <section className="rounded-lg border border-border-default bg-surface-elevated p-5">
          <h2 className="text-lg font-semibold">Request queue</h2>
          {requests.length === 0 && <p className="mt-5 text-sm text-content-tertiary">No requests yet.</p>}
          <div className="mt-4 space-y-3">{requests.map((request) => {
            const point = points.find((entry) => entry.assetId === request.assetId && entry.field === request.field);
            return <div key={request.id} className="rounded border border-border-default p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{point?.assetName ?? request.assetId} · {point?.display ?? request.field}</strong><span className="font-mono text-xs text-content-tertiary">{request.state}</span></div>
              <p className="mt-1 text-sm">Requested {request.requestedValue} {point?.unit ?? ''} · {request.justification}</p>
              {request.state === 'PENDING' && hasPermission('setpoints:approve') && <div className="mt-3 flex gap-2">
                <button disabled={busy} className="rounded bg-chilled px-3 py-1.5 text-xs text-white disabled:opacity-50" onClick={() => void perform(() => client.approveSetpoint(request.id, {}, crypto.randomUUID()), 'Request approved and queued for gateway dispatch.')}>Approve</button>
                <button disabled={busy} className="rounded border border-border-strong px-3 py-1.5 text-xs disabled:opacity-50" onClick={() => void perform(() => client.rejectSetpoint(request.id, { reason: 'Rejected in operations console' }, crypto.randomUUID()), 'Request rejected.')}>Reject</button>
              </div>}
            </div>;
          })}</div>
        </section>
      </div>
    </main>
  </div>;
}
