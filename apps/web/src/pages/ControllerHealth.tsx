import React, { useState, useMemo } from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import { MOCK_CONTROLLERS } from '../fixtures/controllersData';
import type { Controller } from '../fixtures/controllersData';
const STATUS_COLORS: Record<Controller['status'], string> = {
  online: 'bg-success/10 text-success',
  offline: 'bg-critical/10 text-critical',
  degraded: 'bg-warning/10 text-warning',
  unknown: 'bg-surface-sunken text-content-tertiary'
};

const STATUS_LABELS: Record<Controller['status'], string> = {
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
  unknown: 'Unknown'
};

export function ControllerHealth() {
  const { hasPermission } = useAuth();
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Controller Health' }
  ];

  const [selectedController, setSelectedController] = useState<Controller | null>(null);
  const [blastRadiusMode, setBlastRadiusMode] = useState(false);

  const canRead = hasPermission('telemetry:read');

  // Calculate aggregate stats
  const stats = useMemo(() => {
    const total = MOCK_CONTROLLERS.length;
    const online = MOCK_CONTROLLERS.filter(c => c.status === 'online').length;
    const offline = MOCK_CONTROLLERS.filter(c => c.status === 'offline').length;
    const degraded = MOCK_CONTROLLERS.filter(c => c.status === 'degraded').length;
    const totalAssets = MOCK_CONTROLLERS.reduce((sum, c) => sum + c.assetCount, 0);
    const totalAlarms = MOCK_CONTROLLERS.reduce((sum, c) => sum + c.alarms, 0);
    const criticalAlarms = MOCK_CONTROLLERS.reduce((sum, c) => sum + c.criticalAlarms, 0);
    const avgCoverage = MOCK_CONTROLLERS.reduce((sum, c) => sum + c.coverage, 0) / total;

    return { total, online, offline, degraded, totalAssets, totalAlarms, criticalAlarms, avgCoverage };
  }, []);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 95) return 'text-success';
    if (coverage >= 80) return 'text-warning';
    return 'text-critical';
  };

  const getCoverageBarColor = (coverage: number) => {
    if (coverage >= 95) return 'bg-success';
    if (coverage >= 80) return 'bg-warning';
    return 'bg-critical';
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-semibold text-content-primary">Controller Health</h1>
                <p className="text-sm text-content-tertiary">Monitor controller status and blast radius when selecting a controller</p>
              </div>
              <button
                onClick={() => setBlastRadiusMode(!blastRadiusMode)}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-2',
                  blastRadiusMode
                    ? 'bg-chilled text-white'
                    : 'bg-surface-sunken text-content-primary border border-default hover:bg-state-hover'
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
                Blast Radius View
              </button>
            </div>

            {/* Aggregate Stats */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-surface-base border border-default">
                <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Controllers</p>
                <p className="text-2xl font-semibold text-content-primary tabular-nums">{stats.total}</p>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-success">{stats.online} online</span>
                  <span className="text-content-tertiary">·</span>
                  <span className="text-warning">{stats.degraded} degraded</span>
                  <span className="text-content-tertiary">·</span>
                  <span className="text-critical">{stats.offline} offline</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-surface-base border border-default">
                <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Monitored Assets</p>
                <p className="text-2xl font-semibold text-content-primary tabular-nums">{stats.totalAssets}</p>
                <p className="text-xs text-content-tertiary mt-2">Across all controllers</p>
              </div>

              <div className="p-4 rounded-lg bg-surface-base border border-default">
                <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Active Alarms</p>
                <p className={clsx('text-2xl font-semibold tabular-nums', stats.criticalAlarms > 0 ? 'text-critical' : stats.totalAlarms > 0 ? 'text-warning' : 'text-success')}>
                  {stats.totalAlarms}
                </p>
                {stats.criticalAlarms > 0 && (
                  <p className="text-xs text-critical mt-2">{stats.criticalAlarms} critical</p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-surface-base border border-default">
                <p className="text-xs font-medium text-content-secondary uppercase tracking-wider mb-1">Avg Coverage</p>
                <p className={clsx('text-2xl font-semibold tabular-nums', getCoverageColor(stats.avgCoverage))}>
                  {stats.avgCoverage.toFixed(1)}%
                </p>
                <div className="w-full h-1.5 bg-surface-sunken rounded-full mt-2 overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all', getCoverageBarColor(stats.avgCoverage))} style={{ width: `${stats.avgCoverage}%` }} />
                </div>
              </div>
            </div>

            {/* Controller List */}
            <div className="space-y-3">
              {MOCK_CONTROLLERS.map(controller => (
                <ControllerCard
                  key={controller.id}
                  controller={controller}
                  isSelected={selectedController?.id === controller.id}
                  blastRadiusMode={blastRadiusMode}
                  onClick={() => setSelectedController(selectedController?.id === controller.id ? null : controller)}
                />
              ))}
            </div>

            {/* Selected Controller Detail - Blast Radius */}
            {selectedController && blastRadiusMode && (
              <div className="mt-6 p-4 rounded-lg border-2 border-chilled bg-chilled/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-content-primary">Blast Radius: {selectedController.name}</h3>
                    <p className="text-sm text-content-tertiary">
                      If this controller fails, {selectedController.assetCount} assets will be affected
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedController(null)}
                    className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-state-hover transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Affected Assets Grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedController.assets.map(asset => (
                    <div
                      key={asset.id}
                      className={clsx(
                        'p-3 rounded-lg border transition-colors',
                        asset.status === 'offline' ? 'bg-critical/5 border-critical/20' :
                        asset.status === 'degraded' ? 'bg-warning/5 border-warning/20' :
                        asset.hasAlarm ? 'bg-critical/5 border-critical/20' :
                        'bg-surface-base border-default'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-content-primary text-sm truncate">{asset.name}</span>
                        <span className={clsx(
                          'w-2 h-2 rounded-full flex-shrink-0 mt-1',
                          asset.status === 'online' ? 'bg-success' :
                          asset.status === 'offline' ? 'bg-critical' :
                          'bg-warning'
                        )} />
                      </div>
                      <div className="text-xs text-content-tertiary flex items-center gap-2">
                        <span>{asset.type}</span>
                        <span>·</span>
                        <span>{asset.zone}</span>
                      </div>
                      {asset.lastValue && (
                        <div className="text-xs font-mono tabular-nums text-content-secondary mt-1">
                          {asset.lastValue}
                        </div>
                      )}
                      {asset.hasAlarm && (
                        <span className="inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-critical/10 text-critical">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg>
                          Alarm
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Impact Summary */}
                <div className="mt-4 p-3 rounded-lg bg-surface-sunken border border-default">
                  <h4 className="text-sm font-medium text-content-primary mb-2">Impact Assessment</h4>
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <span className="text-content-tertiary">Zone(s) affected:</span>
                      <span className="ml-2 text-content-primary font-medium">
                        {[...new Set(selectedController.assets.map(a => a.zone))].join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-content-tertiary">Floor(s):</span>
                      <span className="ml-2 text-content-primary font-medium">
                        {[...new Set(selectedController.assets.map(a => a.floor))].join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-content-tertiary">Asset types:</span>
                      <span className="ml-2 text-content-primary font-medium">
                        {[...new Set(selectedController.assets.map(a => a.type))].join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ControllerCard({
  controller,
  isSelected,
  blastRadiusMode,
  onClick
}: {
  controller: Controller;
  isSelected: boolean;
  blastRadiusMode: boolean;
  onClick: () => void;
}) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 95) return 'text-success';
    if (coverage >= 80) return 'text-warning';
    return 'text-critical';
  };

  const getCoverageBarColor = (coverage: number) => {
    if (coverage >= 95) return 'bg-success';
    if (coverage >= 80) return 'bg-warning';
    return 'bg-critical';
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'controller-card p-4 rounded-lg border transition-all cursor-pointer',
        isSelected && blastRadiusMode
          ? 'border-chilled bg-chilled/5 ring-1 ring-chilled/20'
          : controller.status === 'offline'
          ? 'bg-critical/5 border-critical/20'
          : controller.status === 'degraded'
          ? 'bg-warning/5 border-warning/20'
          : 'bg-surface-base border-default hover:bg-state-hover'
      )}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-content-primary">{controller.name}</span>
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[controller.status])}>
              {STATUS_LABELS[controller.status]}
            </span>
            {controller.alarms > 0 && (
              <span className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                controller.criticalAlarms > 0 ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning'
              )}>
                {controller.alarms} alarm{controller.alarms !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-content-tertiary flex-wrap">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-tertiary/50">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {controller.assetCount} assets
            </span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-tertiary/50">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Last heartbeat: {formatTime(controller.lastHeartbeat)}
            </span>
          </div>
        </div>

        {/* Coverage */}
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-content-tertiary">Coverage</span>
            <span className={clsx('font-mono tabular-nums text-sm font-medium', getCoverageColor(controller.coverage))}>
              {controller.coverage.toFixed(1)}%
            </span>
          </div>
          <div className="w-24 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', getCoverageBarColor(controller.coverage))}
              style={{ width: `${controller.coverage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && blastRadiusMode && (
        <div className="mt-3 pt-3 border-t border-chilled/20">
          <p className="text-xs text-chilled font-medium">Click to view blast radius details →</p>
        </div>
      )}
    </div>
  );
}
