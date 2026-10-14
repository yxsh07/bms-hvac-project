import { useMemo, useState } from 'react';
import type { Alarm } from '../../../../packages/contracts/src/alarm';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useAlarmFeed } from '../hooks/useAlarmFeed';

type Filter = 'open' | 'all' | 'acknowledged' | 'cleared';
const open = (alarm: Alarm) => !alarm.clearedAt;
const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function LiveAlarms() {
  const { hasPermission } = useAuth();
  const { alarms, error, refresh, client, currentSiteId } = useAlarmFeed();
  const [filter, setFilter] = useState<Filter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const visible = useMemo(() => alarms.filter((alarm) => {
    if (filter === 'open') return open(alarm);
    if (filter === 'acknowledged') return Boolean(alarm.acknowledgedAt);
    if (filter === 'cleared') return Boolean(alarm.clearedAt);
    return true;
  }).sort((a, b) => Number(open(b)) - Number(open(a)) ||
    severityRank[a.severity] - severityRank[b.severity] || b.raisedAt.localeCompare(a.raisedAt)), [alarms, filter]);
  const activeCount = alarms.filter(open).length;

  const acknowledge = async (alarm: Alarm) => {
    if (!currentSiteId || !hasPermission('alarms:acknowledge')) return;
    setBusyId(alarm.id);
    setActionError(null);
    try { await client.ackAlarm(currentSiteId, alarm.id, {}); await refresh(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusyId(null); }
  };

  return <div className="min-h-screen bg-surface-base">
    <Header breadcrumb={[{ label: 'Overview', href: '/' }, { label: 'Alarms' }]} />
    <main className="shell-content mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-8" style={{ paddingTop: 'calc(var(--header-height) + 2rem)' }}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-content-tertiary">Response queue · live</p>
          <h1 className="mt-2 text-3xl font-semibold text-content-primary">Alarms</h1>
          <p className="mt-2 text-sm text-content-secondary">Fault transitions from the active site. Updates every five seconds.</p>
        </div>
        <div className="rounded-xl border border-default bg-surface-raised px-5 py-3 text-right">
          <span className="block text-xs uppercase tracking-widest text-content-tertiary">Open now</span>
          <strong className="font-mono text-3xl text-critical">{activeCount}</strong>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Alarm filters">
        {(['open', 'all', 'acknowledged', 'cleared'] as Filter[]).map((item) =>
          <button key={item} type="button" onClick={() => setFilter(item)}
            className={`rounded-full border px-4 py-2 text-sm capitalize ${filter === item ? 'border-chilled bg-chilled text-white' : 'border-default bg-surface-raised text-content-secondary hover:text-content-primary'}`}>
            {item}
          </button>)}
        <button type="button" onClick={() => void refresh()} className="ml-auto rounded-full border border-default px-4 py-2 text-sm text-content-secondary">Refresh</button>
      </div>
      {(error || actionError) && <p role="alert" className="mb-4 rounded-lg border border-critical/30 bg-critical/10 p-3 text-sm text-critical">{error || actionError}</p>}
      {visible.length === 0 ? <div className="rounded-2xl border border-default bg-surface-raised px-6 py-16 text-center">
        <p className="text-xl font-medium text-content-primary">{error ? 'Alarm feed unavailable' : 'No alarms in this view'}</p>
        <p className="mt-2 text-sm text-content-tertiary">{error ? 'Check the API connection and retry.' : 'Start a fault scenario in Sim Console to see a live transition here.'}</p>
      </div> : <div className="space-y-3">
        {visible.map((alarm) => <article key={alarm.id} className="rounded-xl border border-default bg-surface-raised p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${alarm.severity === 'critical' ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning'}`}>{alarm.severity}</span>
                <span className="rounded bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold uppercase text-content-secondary">{alarm.status.replaceAll('_', ' ')}</span>
                <span className="font-mono text-xs text-content-tertiary">{alarm.alarmCode}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-content-primary">{alarm.assetName}</h2>
              <p className="mt-1 text-sm text-content-secondary">{alarm.message}</p>
              <p className="mt-3 font-mono text-xs text-content-tertiary">{alarm.field ?? 'System'} · Raised {new Date(alarm.raisedAt).toLocaleString()}{alarm.clearedAt ? ` · Cleared ${new Date(alarm.clearedAt).toLocaleString()}` : ''}</p>
            </div>
            {!alarm.acknowledgedAt && <button type="button" disabled={!hasPermission('alarms:acknowledge') || busyId === alarm.id}
              onClick={() => void acknowledge(alarm)} className="rounded-lg bg-chilled px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
              {busyId === alarm.id ? 'Acknowledging…' : 'Acknowledge'}
            </button>}
          </div>
        </article>)}
      </div>}
    </main>
  </div>;
}
