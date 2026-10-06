import React, { useState, useMemo } from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import type { UserRole } from '../types/auth';

import { MOCK_ALARMS } from '../fixtures/alarmsData';
import type { Alarm } from '../fixtures/alarmsData';

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const STATUS_ORDER = { asserted: 0, acknowledged: 1, cleared: 2 };

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  engineer: 'HVAC Engineer',
  facility_manager: 'Facility Manager',
  operator: 'Operator',
  executive: 'Executive'
};


const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'asserted', label: 'Asserted' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'unacked', label: 'Unacknowledged' }
];

export function Alarms() {
  const { hasPermission, user } = useAuth();
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Alarms' }
  ];

  const [filter, setFilter] = useState<'all' | 'asserted' | 'acknowledged' | 'cleared' | 'critical' | 'warning' | 'unacked'>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'time' | 'asset'>('severity');
  const [sortDesc, setSortDesc] = useState(true);

  const canAcknowledge = hasPermission('alarms:acknowledge');

  const filteredAndSortedAlarms = useMemo(() => {
    let result = [...MOCK_ALARMS];

    // Filter
    if (filter !== 'all') {
      if (filter === 'unacked') {
        result = result.filter(a => a.status === 'asserted');
      } else if (filter === 'critical' || filter === 'warning') {
        result = result.filter(a => a.severity === filter);
      } else {
        result = result.filter(a => a.status === filter);
      }
    }

    // Sort: asserted first, then by severity, then by time
    result.sort((a, b) => {
      if (sortBy === 'severity') {
        // Primary: status (asserted first), then severity, then time
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (statusDiff !== 0) return sortDesc ? statusDiff : -statusDiff;

        const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (severityDiff !== 0) return sortDesc ? severityDiff : -severityDiff;

        return sortDesc
          ? new Date(b.time).getTime() - new Date(a.time).getTime()
          : new Date(a.time).getTime() - new Date(b.time).getTime();
      }
      if (sortBy === 'time') {
        return sortDesc
          ? new Date(b.time).getTime() - new Date(a.time).getTime()
          : new Date(a.time).getTime() - new Date(b.time).getTime();
      }
      if (sortBy === 'asset') {
        return sortDesc ? b.asset.localeCompare(a.asset) : a.asset.localeCompare(b.asset);
      }
      return 0;
    });

    return result;
  }, [filter, sortBy, sortDesc]);

  const handleAcknowledge = (alarm: Alarm) => {
    if (!canAcknowledge) return;
    console.log('Acknowledge alarm:', alarm.id);
    // In real app, call API to acknowledge
    // For demo, update local state
    alarm.status = 'acknowledged';
    alarm.acknowledgedAt = new Date().toISOString();
    alarm.acknowledgedBy = user?.name || 'User';
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getSeverityIcon = (severity: Alarm['severity']) => {
    switch (severity) {
      case 'critical':
        return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-critical"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
      case 'warning':
        return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-warning"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
      default:
        return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-chilled"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;
    }
  };

  const getStatusBadge = (status: Alarm['status']) => {
    switch (status) {
      case 'asserted':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-critical/10 text-critical animate-pulse">ASSERTED</span>;
      case 'acknowledged':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning">ACKNOWLEDGED</span>;
      case 'cleared':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">CLEARED</span>;
    }
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Header with stats */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-semibold text-content-primary">Alarms</h1>
                <p className="text-sm text-content-tertiary">Asserted alarms shown first. Acknowledge by permission. All actions audited.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-content-tertiary">
                  <span>Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2 py-1 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                  >
                    <option value="severity">Severity (Asserted First)</option>
                    <option value="time">Time (Newest First)</option>
                    <option value="asset">Asset Name</option>
                  </select>
                  <button
                    onClick={() => setSortDesc(!sortDesc)}
                    className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-state-hover transition-colors"
                    aria-label={sortDesc ? 'Sort ascending' : 'Sort descending'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="4" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter tabs with counts */}
            <div className="flex items-center gap-1 bg-surface-base border border-default rounded-lg p-1 overflow-x-auto">
              {FILTER_OPTIONS.map(opt => {
                let count = 0;
                if (opt.value === 'all') count = MOCK_ALARMS.length;
                else if (opt.value === 'unacked') count = MOCK_ALARMS.filter(a => a.status === 'asserted').length;
                else if (opt.value === 'critical') count = MOCK_ALARMS.filter(a => a.severity === 'critical').length;
                else if (opt.value === 'warning') count = MOCK_ALARMS.filter(a => a.severity === 'warning').length;
                else count = MOCK_ALARMS.filter(a => a.status === opt.value).length;

                return (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value as typeof filter)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                      filter === opt.value
                        ? 'bg-chilled text-white'
                        : 'text-content-tertiary hover:text-content-primary hover:bg-state-hover'
                    )}
                  >
                    {opt.label} <span className={clsx('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium', filter === opt.value ? 'bg-white/20' : 'bg-surface-sunken text-content-tertiary')}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Alarm list */}
            <div className="space-y-2">
              {filteredAndSortedAlarms.length === 0 ? (
                <div className="p-8 text-center text-content-tertiary">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-content-tertiary/50">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <p>No alarms match the current filter</p>
                </div>
              ) : (
                filteredAndSortedAlarms.map(alarm => (
                  <AlarmCard
                    key={alarm.id}
                    alarm={alarm}
                    onAcknowledge={handleAcknowledge}
                    canAcknowledge={canAcknowledge}
                    formatTime={formatTime}
                    getSeverityIcon={getSeverityIcon}
                    getStatusBadge={getStatusBadge}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

interface AlarmCardProps {
  alarm: Alarm;
  onAcknowledge: (alarm: Alarm) => void;
  canAcknowledge: boolean;
  formatTime: (iso: string) => string;
  getSeverityIcon: (s: Alarm['severity']) => React.ReactNode;
  getStatusBadge: (s: Alarm['status']) => React.ReactNode;
}

function AlarmCard({ alarm, onAcknowledge, canAcknowledge, formatTime, getSeverityIcon, getStatusBadge }: AlarmCardProps) {
  const isAsserted = alarm.status === 'asserted';
  const isCritical = alarm.severity === 'critical';
  const isUnacked = alarm.status === 'asserted';

  return (
    <div className={clsx(
      'alarm-card p-4 rounded-lg border transition-colors relative',
      isCritical ? 'bg-critical/5 border-critical/20' : 'bg-warning/5 border-warning/20',
      isAsserted && 'ring-1 ring-critical/20'
    )}>
      {/* Severity indicator bar */}
      <div className={clsx('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', isCritical ? 'bg-critical' : 'bg-warning')} aria-hidden="true" />

      <div className="pl-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {getSeverityIcon(alarm.severity)}
              <span className="font-medium text-content-primary truncate">{alarm.asset}</span>
              <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase',
                alarm.severity === 'critical' ? 'bg-critical/10 text-critical' :
                alarm.severity === 'warning' ? 'bg-warning/10 text-warning' :
                'bg-chilled/10 text-chilled'
              )}>{alarm.severity.toUpperCase()}</span>
              {getStatusBadge(alarm.status)}
              {isUnacked && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-chilled/10 text-chilled animate-pulse">UNACKNOWLEDGED</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-content-tertiary mb-1 flex-wrap">
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-tertiary/50"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {alarm.zone}
              </span>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-tertiary/50"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                {alarm.floor}
              </span>
              {alarm.controllerId && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-tertiary/50"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                  {alarm.controllerId}
                </span>
              )}
            </div>

            <div className="text-sm text-content-secondary">{alarm.point}</div>

            <div className="mt-2 text-sm text-content-tertiary">{alarm.description}</div>

            <div className="flex items-center gap-4 mt-2 text-[11px] text-content-tertiary flex-wrap">
              <span>Value: <span className="font-mono tabular-nums text-content-primary">{alarm.value}</span></span>
              <span>Raised: {formatTime(alarm.time)}</span>
              {alarm.acknowledgedAt && <span>✓ Acknowledged by {alarm.acknowledgedBy} at {formatTime(alarm.acknowledgedAt)}</span>}
              {alarm.clearedAt && <span>✓ Cleared at {formatTime(alarm.clearedAt)}</span>}
            </div>
          </div>

          {/* Acknowledge button - only for asserted alarms and users with permission */}
          {isAsserted && (
            <button
              onClick={(e) => { e.stopPropagation(); onAcknowledge(alarm); }}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md font-medium flex-shrink-0 transition-colors',
                canAcknowledge
                  ? 'bg-chilled text-white hover:opacity-90'
                  : 'bg-content-disabled text-content-inverse cursor-not-allowed'
              )}
              disabled={!canAcknowledge}
              title={!canAcknowledge ? 'Your role cannot acknowledge alarms' : 'Acknowledge this alarm'}
            >
              Acknowledge
            </button>
          )}

          {/* For acknowledged/cleared, show who acknowledged */}
          {alarm.status === 'acknowledged' && !alarm.clearedAt && (
            <div className="flex-shrink-0 px-3 py-1.5 text-sm text-content-tertiary">
              Acknowledged by {alarm.acknowledgedBy}
            </div>
          )}

          {alarm.status === 'cleared' && (
            <div className="flex-shrink-0 px-3 py-1.5 text-sm text-success font-medium">
              Cleared
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
