import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Asset, PointValue, PointDefinition, PointClassification, TelemetrySeriesPoint } from '../types/telemetry';
import { PointRenderer } from './PointRenderer';
import { Sparklines } from './HistoricalChart';
import { getAssetTypeIcon as getAssetTypeIconFixture } from '../fixtures/assetIcons';
import { POINT_CLASSIFICATION_GROUPS, QUALITY_LABELS } from '../types/telemetry';

interface AssetDetailProps {
  asset: Asset | null;
  telemetry: Record<string, PointValue>;
  pointDefinitions: Record<string, PointDefinition>;
  historicalData: Record<string, TelemetrySeriesPoint[]>;
  onEditSetpoint?: (pointDef: PointDefinition, currentValue: number | null) => void;
  className?: string;
}

export function AssetDetail({
  asset,
  telemetry,
  pointDefinitions,
  historicalData,
  onEditSetpoint,
  className
}: AssetDetailProps) {
  // Organize points by classification
  const pointsByClassification = useMemo(() => {
    const grouped: Record<PointClassification, Array<{ pointValue: PointValue; pointDef: PointDefinition; sparklineData?: number[] }>> = {
      Temperature: [],
      Humidity: [],
      Pressure: [],
      Flow: [],
      Power: [],
      Energy: [],
      Status: [],
      Alarm: [],
      Actuator: [],
      Setpoint: [],
      Mode: [],
      KPI: [],
      Count: [],
      AirQuality: [],
      Voltage: [],
      Current: [],
      Frequency: [],
      Other: []
    };

    Object.entries(telemetry).forEach(([abbr, pointValue]) => {
      const pointDef = pointDefinitions[abbr];
      if (!pointDef) return;

      const sparklineData = historicalData[abbr]?.map(p => p.value).filter((v): v is number => v !== null);
      grouped[pointDef.classification].push({ pointValue, pointDef, sparklineData });
    });

    return grouped;
  }, [telemetry, pointDefinitions, historicalData]);

  // Classification display order (alarms first, then status, then rest)
  const classificationOrder: PointClassification[] = [
    'Alarm', 'Status', 'Temperature', 'Humidity', 'Pressure', 'Flow',
    'Power', 'Energy', 'Actuator', 'Setpoint', 'Mode', 'KPI',
    'Count', 'AirQuality', 'Voltage', 'Current', 'Frequency', 'Other'
  ];

  if (!asset) {
    return (
      <div className={clsx('asset-detail-empty flex-1 flex items-center justify-center', className)}>
        <div className="text-center p-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-content-tertiary/50">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 15h4" />
          </svg>
          <p className="text-content-tertiary">Select an asset to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('asset-detail flex flex-col h-full', className)}>
      {/* Asset header */}
      <div className="asset-header p-4 border-b border-default bg-surface-elevated">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="asset-type-badge w-10 h-10 rounded-lg flex items-center justify-center bg-surface-sunken flex-shrink-0">
                {getAssetTypeIcon(asset.type, true)}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-content-primary truncate">{asset.name}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <span className="px-2 py-0.5 rounded-full bg-surface-sunken text-content-secondary">{asset.type}</span>
                  {asset.criticality && (
                    <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[11px] font-medium">{asset.criticality}</span>
                  )}
                  {asset.zone && <span className="text-content-tertiary">📍 {asset.zone}</span>}
                  {asset.floor && <span className="text-content-tertiary">🏢 {asset.floor}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-content-tertiary">Last updated</div>
              <div className="font-mono tabular-nums text-sm text-content-primary">
                {getLastUpdateTime(telemetry)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Points list */}
      <div className="asset-points flex-1 overflow-y-auto p-4 space-y-6">
        {classificationOrder.map(classification => {
          const points = pointsByClassification[classification];
          if (!points.length) return null;

          const groupInfo = POINT_CLASSIFICATION_GROUPS[classification];

          return (
            <section key={classification} className="point-group">
              <header className="point-group-header flex items-center justify-between mb-3 pb-2 border-b border-default">
                <h2 className="text-xs font-semibold text-content-tertiary tracking-wider uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getClassificationColor(classification) }} />
                  {classification} ({points.length})
                </h2>
                {points.some(p => p.pointValue.quality !== 0) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                    {points.filter(p => p.pointValue.quality !== 0).length} flagged
                  </span>
                )}
              </header>

              <div className="point-group-grid grid gap-3" style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'
              }}>
                {points.map(({ pointValue, pointDef, sparklineData }) => (
                  <PointCard
                    key={pointDef.abbreviation}
                    pointValue={pointValue}
                    pointDef={pointDef}
                    sparklineData={sparklineData}
                    onEdit={onEditSetpoint}
                    classification={classification}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PointCard({
  pointValue,
  pointDef,
  sparklineData,
  onEdit,
  classification
}: {
  pointValue: PointValue;
  pointDef: PointDefinition;
  sparklineData?: number[];
  onEdit?: (pointDef: PointDefinition, currentValue: number | null) => void;
  classification: PointClassification;
}) {
  const groupInfo = POINT_CLASSIFICATION_GROUPS[classification];
  const isWritable = pointDef.writable && !!onEdit;
  const qualityLabel = QUALITY_LABELS[pointValue.quality];
  const freshness = pointValue.value === null && pointValue.rawValue === undefined ? 'missing' :
    pointValue.quality !== 0 ? 'flagged' : 'live';

  return (
    <div className={clsx(
      'point-card p-3 rounded-lg border transition-colors',
      freshness === 'live' ? 'bg-surface-base border-default' :
      freshness === 'flagged' ? 'bg-warning/5 border-warning/30' : 'bg-surface-sunken border-default'
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-medium text-content-secondary truncate">{pointDef.displayName}</span>
            {pointValue.isDelayed && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-warning/10 text-warning flex-shrink-0" title="Delayed data">⏱</span>
            )}
            {pointValue.quality !== 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-critical/10 text-critical flex-shrink-0" title={qualityLabel}>
                Q{pointValue.quality}
              </span>
            )}
          </div>
          <span className="text-[10px] text-content-tertiary">{pointDef.unit}</span>
        </div>
        {isWritable && (
          <button
            onClick={() => onEdit?.(pointDef, pointValue.value)}
            className="p-1.5 rounded-md bg-surface-sunken hover:bg-state-hover transition-colors text-content-tertiary hover:text-content-primary flex-shrink-0"
            aria-label={`Edit ${pointDef.displayName}`}
            title="Edit setpoint"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      <PointRenderer
        pointValue={pointValue}
        pointDef={pointDef}
        sparklineData={sparklineData}
        showSparkline={groupInfo.renderAs === 'value-sparkline' || groupInfo.renderAs === 'value-delta' || groupInfo.renderAs === 'trend'}
        compact
        showCoverageBadge={false}
      />
    </div>
  );
}

function getAssetTypeIcon(type: string, filled: boolean = false): React.ReactNode {
  return getAssetTypeIconFixture(type, { filled, size: 20 });
}

function getClassificationColor(classification: PointClassification): string {
  const colors: Record<PointClassification, string> = {
    Temperature: 'var(--color-semantic-chilled)',
    Humidity: 'var(--color-content-tertiary)',
    Pressure: 'var(--color-semantic-condenser)',
    Flow: 'var(--color-semantic-chilled)',
    Power: 'var(--color-semantic-warning)',
    Energy: 'var(--color-semantic-warning)',
    Status: 'var(--color-content-secondary)',
    Alarm: 'var(--color-semantic-critical)',
    Actuator: 'var(--color-semantic-chilled)',
    Setpoint: 'var(--color-semantic-info)',
    Mode: 'var(--color-content-secondary)',
    KPI: 'var(--color-semantic-success)',
    Count: 'var(--color-content-tertiary)',
    AirQuality: 'var(--color-semantic-success)',
    Voltage: 'var(--color-semantic-warning)',
    Current: 'var(--color-semantic-warning)',
    Frequency: 'var(--color-semantic-warning)',
    Other: 'var(--color-content-tertiary)'
  };
  return colors[classification] || 'var(--color-content-tertiary)';
}

function getLastUpdateTime(telemetry: Record<string, PointValue>): string {
  const timestamps = Object.values(telemetry).map(p => new Date(p.timestamp).getTime()).filter(t => !isNaN(t));
  if (timestamps.length === 0) return '—';
  const latest = new Date(Math.max(...timestamps));
  return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}