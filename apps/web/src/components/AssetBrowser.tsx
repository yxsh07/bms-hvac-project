import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import clsx from 'clsx';
import type { Asset, PointValue, PointDefinition } from '../types/telemetry';
import { PointRenderer } from './PointRenderer';
import { getAssetTypeIcon } from '../fixtures/assetIcons';

export interface AssetBrowserProps {
  assets: Asset[];
  telemetry: Record<string, Record<string, PointValue>>;
  pointDefinitions: Record<string, PointDefinition>;
  selectedAssetId?: string;
  onSelectAsset: (assetId: string) => void;
  filterText?: string;
  onFilterChange: (text: string) => void;
  filterType?: string;
  onFilterTypeChange: (type: string) => void;
  filterZone?: string;
  onFilterZoneChange: (zone: string) => void;
  filterFloor?: string;
  onFilterFloorChange: (floor: string) => void;
  assetTypes: string[];
  zones: string[];
  floors: string[];
  className?: string;
}

interface AssetRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    assets: Asset[];
    telemetry: Record<string, Record<string, PointValue>>;
    pointDefinitions: Record<string, PointDefinition>;
    selectedAssetId?: string;
    onSelectAsset: (assetId: string) => void;
  };
}

function AssetRow({ index, style, data }: AssetRowProps) {
  const { assets, telemetry, pointDefinitions, selectedAssetId, onSelectAsset } = data;
  const asset = assets[index];
  const isSelected = asset.id === selectedAssetId;
  const assetTelemetry = telemetry[asset.id] || {};

  // Get key points for display
  const keyPoints = ['run-status', 'fault-alarm', 'power-kw', 'chw-leaving-temp', 'supply-air-temp', 'area-temp']
    .map(role => {
      const pointAbbr = asset.pointRoles?.[role];
      if (!pointAbbr) return null;
      const pointValue = assetTelemetry[pointAbbr];
      const pointDef = pointDefinitions[pointAbbr];
      if (!pointValue || !pointDef) return null;
      return { role, pointValue, pointDef };
    })
    .filter(Boolean) as Array<{ role: string; pointValue: PointValue; pointDef: PointDefinition }>;

  return (
    <div
      style={style}
      className={clsx(
        'asset-row flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer',
        isSelected ? 'bg-state-selected' : 'hover:bg-state-hover'
      )}
      onClick={() => onSelectAsset(asset.id)}
      role="option"
      aria-selected={isSelected}
    >
      {/* Asset type icon */}
      <div className="asset-type-icon w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-sunken">
        {getAssetTypeIcon(asset.type)}
      </div>

      {/* Asset info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-content-primary truncate">{asset.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-sunken text-content-tertiary">{asset.type}</span>
          {asset.criticality && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">{asset.criticality}</span>
          )}
        </div>
        <div className="text-[11px] text-content-tertiary flex items-center gap-2 mt-0.5">
          {asset.zone && <span>📍 {asset.zone}</span>}
          {asset.floor && <span>🏢 {asset.floor}</span>}
        </div>
      </div>

      {/* Key telemetry */}
      <div className="flex items-center gap-2 flex-wrap max-w-[300px]">
        {keyPoints.slice(0, 3).map(({ pointValue, pointDef }) => (
          <PointRenderer
            key={pointDef.abbreviation}
            pointValue={pointValue}
            pointDef={pointDef}
            compact
            showCoverageBadge={false}
          />
        ))}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-1 h-8 bg-chilled rounded-l-full flex-shrink-0 ml-2" aria-hidden="true" />
      )}
    </div>
  );
}

export function AssetBrowser({
  assets,
  telemetry,
  pointDefinitions,
  selectedAssetId,
  onSelectAsset,
  filterText = '',
  onFilterChange,
  filterType,
  onFilterTypeChange,
  filterZone,
  onFilterZoneChange,
  filterFloor,
  onFilterFloorChange,
  assetTypes,
  zones,
  floors,
  className
}: AssetBrowserProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesText = !filterText ||
        asset.name.toLowerCase().includes(filterText.toLowerCase()) ||
        asset.id.toLowerCase().includes(filterText.toLowerCase());
      const matchesType = !filterType || asset.type === filterType;
      const matchesZone = !filterZone || asset.zone === filterZone;
      const matchesFloor = !filterFloor || asset.floor === filterFloor;
      return matchesText && matchesType && matchesZone && matchesFloor;
    });
  }, [assets, filterText, filterType, filterZone, filterFloor]);

  // Sort assets
  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof typeof a] as string | undefined;
      const bVal = b[sortConfig.key as keyof typeof b] as string | undefined;
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAssets, sortConfig]);

  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const RowComponent = React.useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <AssetRow
        index={index}
        style={style}
        data={{ assets: sortedAssets, telemetry, pointDefinitions, selectedAssetId, onSelectAsset }}
      />
    ),
    [sortedAssets, telemetry, pointDefinitions, selectedAssetId, onSelectAsset]
  );

  return (
    <div className={clsx('asset-browser flex flex-col h-full bg-surface-base', className)}>
      {/* Filters */}
      <div className="asset-filters p-3 border-b border-default bg-surface-elevated space-y-3">
        {/* Search */}
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={filterText}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-10 pr-4 py-2 bg-surface-base border border-default rounded-md text-sm text-content-primary placeholder-content-tertiary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            aria-label="Search assets"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Type"
            value={filterType || ''}
            options={['', ...assetTypes]}
            onChange={onFilterTypeChange}
            optionLabels={{ '': 'All Types' }}
          />
          <FilterSelect
            label="Zone"
            value={filterZone || ''}
            options={['', ...zones]}
            onChange={onFilterZoneChange}
            optionLabels={{ '': 'All Zones' }}
          />
          <FilterSelect
            label="Floor"
            value={filterFloor || ''}
            options={['', ...floors]}
            onChange={onFilterFloorChange}
            optionLabels={{ '': 'All Floors' }}
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-sm text-content-tertiary">
          <span>Sort by:</span>
          <select
            value={sortConfig.key}
            onChange={(e) => handleSort(e.target.value)}
            className="px-2 py-1 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            aria-label="Sort by"
          >
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="zone">Zone</option>
            <option value="floor">Floor</option>
          </select>
          <button
            onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
            className="p-1 rounded hover:bg-state-hover transition-colors text-content-tertiary"
            aria-label={sortConfig.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={clsx(sortConfig.direction === 'desc' && 'rotate-180')}>
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="px-3 py-2 border-b border-default bg-surface-elevated text-sm text-content-tertiary">
        {filteredAssets.length} of {assets.length} assets
      </div>

      {/* Virtualized list */}
      <div className="flex-1 overflow-hidden">
        <AutoSizer>
          {({ width, height }) => (
            <List
              height={height}
              itemCount={sortedAssets.length}
              itemSize={68}
              width={width}
              overscanCount={5}
            >
              {RowComponent}
            </List>
          )}
        </AutoSizer>
      </div>

      {sortedAssets.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-content-tertiary">
          <div className="text-center p-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-content-tertiary/50">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 15h4" />
            </svg>
            <p className="text-sm">No assets match your filters</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabels?: Record<string, string>;
}

function FilterSelect({ label, value = '', options, onChange, optionLabels = {} }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus cursor-pointer"
      aria-label={label}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>
          {optionLabels[opt] || opt}
        </option>
      ))}
    </select>
  );
}
