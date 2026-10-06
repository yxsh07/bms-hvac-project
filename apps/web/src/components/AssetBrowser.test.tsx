import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssetBrowser } from './AssetBrowser';
import type { Asset, PointValue, PointDefinition } from '../types/telemetry';

const mockAssets: Asset[] = [
  { id: 'ch-001', name: 'Chiller 1', type: 'chiller', zone: 'Plant Room', floor: 'B1', criticality: 'Critical', pointRoles: { 'run-status': 'ch1_status' } },
  { id: 'ahu-001', name: 'AHU-1', type: 'ahu', zone: 'ICU', floor: '3F', criticality: 'High', pointRoles: { 'run-status': 'ahu1_status' } },
  { id: 'fcu-001', name: 'FCU-1', type: 'fcu', zone: 'Ward', floor: '5F', pointRoles: { 'run-status': 'fcu1_status' } },
];

const mockTelemetry: Record<string, Record<string, PointValue>> = {
  'ch-001': { ch1_status: { value: 1, quality: 0, timestamp: new Date().toISOString() } },
  'ahu-001': { ahu1_status: { value: 1, quality: 0, timestamp: new Date().toISOString() } },
  'fcu-001': { fcu1_status: { value: 0, quality: 0, timestamp: new Date().toISOString() } },
};

const mockPointDefinitions: Record<string, PointDefinition> = {
  ch1_status: { abbreviation: 'ch1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ahu1_status: { abbreviation: 'ahu1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  fcu1_status: { abbreviation: 'fcu1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
};

describe('AssetBrowser', () => {
  const defaultProps = {
    assets: mockAssets,
    telemetry: mockTelemetry,
    pointDefinitions: mockPointDefinitions,
    selectedAssetId: 'ch-001',
    onSelectAsset: vi.fn(),
    filterText: '',
    onFilterChange: vi.fn(),
    filterType: '',
    onFilterTypeChange: vi.fn(),
    filterZone: '',
    onFilterZoneChange: vi.fn(),
    filterFloor: '',
    onFilterFloorChange: vi.fn(),
    assetTypes: ['chiller', 'ahu', 'fcu'],
    zones: ['Plant Room', 'ICU', 'Ward'],
    floors: ['B1', '3F', '5F']
  };

  it('renders asset list with correct count', () => {
    render(<AssetBrowser {...defaultProps} />);
    expect(screen.getByText('3 of 3 assets')).toBeInTheDocument();
  });

  it('filters assets by search text', () => {
    render(<AssetBrowser {...defaultProps} filterText="Chiller" onFilterChange={vi.fn()} />);
    expect(screen.getByText('Chiller 1')).toBeInTheDocument();
    expect(screen.queryByText('AHU-1')).not.toBeInTheDocument();
  });

  it('filters assets by type', () => {
    render(<AssetBrowser {...defaultProps} filterType="ahu" onFilterTypeChange={vi.fn()} />);
    expect(screen.getByText('AHU-1')).toBeInTheDocument();
    expect(screen.queryByText('Chiller 1')).not.toBeInTheDocument();
  });

  it('filters assets by zone', () => {
    render(<AssetBrowser {...defaultProps} filterZone="ICU" onFilterZoneChange={vi.fn()} />);
    expect(screen.getByText('AHU-1')).toBeInTheDocument();
    expect(screen.queryByText('Chiller 1')).not.toBeInTheDocument();
  });

  it('filters assets by floor', () => {
    render(<AssetBrowser {...defaultProps} filterFloor="5F" onFilterFloorChange={vi.fn()} />);
    expect(screen.getByText('FCU-1')).toBeInTheDocument();
    expect(screen.queryByText('Chiller 1')).not.toBeInTheDocument();
  });

  it('calls onSelectAsset when asset row is clicked', () => {
    render(<AssetBrowser {...defaultProps} />);
    const chillerRow = screen.getByText('Chiller 1').closest('div[role="option"]');
    fireEvent.click(chillerRow!);
    expect(defaultProps.onSelectAsset).toHaveBeenCalledWith('ch-001');
  });

  it('shows selected asset with highlight', () => {
    render(<AssetBrowser {...defaultProps} selectedAssetId="ahu-001" />);
    const selectedRow = screen.getByText('AHU-1').closest('div[aria-selected="true"]');
    expect(selectedRow).toBeInTheDocument();
  });

  it('renders filter dropdowns with correct options', () => {
    render(<AssetBrowser {...defaultProps} />);
    const typeSelect = screen.getByLabelText('Type');
    expect(typeSelect).toHaveValue('');
    expect(within(typeSelect).getByText('All Types')).toBeInTheDocument();
    expect(within(typeSelect).getByText('chiller')).toBeInTheDocument();
    expect(within(typeSelect).getByText('ahu')).toBeInTheDocument();
    expect(within(typeSelect).getByText('fcu')).toBeInTheDocument();
  });

  it('shows empty state when no assets match filters', () => {
    render(<AssetBrowser {...defaultProps} filterText="NonExistent" onFilterChange={vi.fn()} />);
    expect(screen.getByText('No assets match your filters')).toBeInTheDocument();
  });
});