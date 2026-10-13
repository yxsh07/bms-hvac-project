import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import { Tabs, TabPanel } from '../components/Tabs';
import { AssetBrowser } from '../components/AssetBrowser';
import { AssetDetail } from '../components/AssetDetail';
import { HistoricalChart } from '../components/HistoricalChart';
import { PointRenderer } from '../components/PointRenderer';
import { SidePanel, useResponsiveSidePanel } from '../components/SidePanel';
import type { Asset, PointValue, PointDefinition, TelemetrySeriesPoint, QualityCode } from '../types/telemetry';
import clsx from 'clsx';

import { MOCK_ASSETS, MOCK_POINT_DEFINITIONS, generateMockTelemetry, generateMockHistorical } from '../fixtures/dashboardData';
import { ALARM_PLACEHOLDER, SETPOINT_PLACEHOLDER } from '../fixtures/dashboardPlaceholders';

export function Dashboard() {
  const { user, currentSiteId, sites, isLoading } = useAuth();
  const isMobile = useResponsiveSidePanel();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>('ch-001');
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('assets');
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [chartResolution, setChartResolution] = useState<'raw' | '1h' | '1d'>('1h');
  const [chartTimeRange, setChartTimeRange] = useState({
    from: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
    to: new Date().toISOString().slice(0, 16)
  });

  const telemetry = useMemo(() => generateMockTelemetry(), []);
  const historicalData = useMemo(() => generateMockHistorical(), []);
  const selectedAsset = MOCK_ASSETS.find(a => a.id === selectedAssetId);
  const assetTelemetry = selectedAssetId ? telemetry[selectedAssetId] : {};
  const assetTypes = [...new Set(MOCK_ASSETS.map(a => a.type))].sort();
  const zones = [...new Set(MOCK_ASSETS.map(a => a.zone).filter(Boolean))].sort() as string[];
  const floors = [...new Set(MOCK_ASSETS.map(a => a.floor).filter(Boolean))].sort() as string[];

  const breadcrumb = useMemo(() => [
    { label: 'Dashboard', onClick: () => setActiveTab('dashboard') },
    { label: activeTab === 'assets' ? 'Assets' : activeTab === 'plant' ? 'Plant' : activeTab === 'building' ? 'Building' : 'Charts' }
  ], [activeTab]);

  const tabs = useMemo(() => [
    { id: 'assets', label: 'Assets', count: MOCK_ASSETS.length },
    { id: 'plant', label: 'Plant Schematic' },
    { id: 'building', label: 'Building' },
    { id: 'charts', label: 'Charts' },
    { id: 'alarms', label: 'Alarms', count: 3 },
    { id: 'setpoints', label: 'Set-points' }
  ], []);

  const currentSite = sites.find(s => s.id === currentSiteId);

  const selectedAssetHistoricalSeries = useMemo(() => {
    if (!selectedAsset) return [];
    const asset = selectedAsset;
    const series: Array<{ id: string; label: string; data: TelemetrySeriesPoint[]; color: string; unit: string }> = [];

    Object.entries(asset.pointRoles || {}).forEach(([role, abbr]) => {
      const def = MOCK_POINT_DEFINITIONS[abbr];
      const data = historicalData[abbr];
      if (!def || !data?.length) return;

      let color = 'var(--color-content-secondary)';
      if (def.classification === 'Temperature') color = 'var(--color-semantic-chilled)';
      else if (def.classification === 'Power') color = 'var(--color-semantic-warning)';
      else if (def.classification === 'Actuator') color = 'var(--color-semantic-chilled)';
      else if (def.classification === 'Flow') color = 'var(--color-semantic-chilled)';
      else if (def.classification === 'Alarm') color = 'var(--color-semantic-critical)';

      series.push({ id: abbr, label: def.displayName, data, color, unit: def.unit });
    });

    return series;
  }, [selectedAsset, historicalData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-content-tertiary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app min-h-screen bg-surface-base">
      <Header
        breadcrumb={breadcrumb}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onInfoClick={() => {}}
        onToolsClick={() => {}}
      />

      <main className="main-content pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="dashboard-grid h-[calc(100vh-var(--header-height))] flex">
          {/* Left panel - Asset Browser */}
          <aside className={clsx(
            'asset-browser-panel flex flex-col border-r border-default bg-surface-base',
            isMobile ? 'hidden lg:flex' : 'flex'
          )} style={{ width: '360px', minWidth: '320px', maxWidth: '420px' }}>
            <AssetBrowser
              assets={MOCK_ASSETS}
              telemetry={telemetry}
              pointDefinitions={MOCK_POINT_DEFINITIONS}
              selectedAssetId={selectedAssetId}
              onSelectAsset={(id) => {
                setSelectedAssetId(id);
                if (isMobile) setDetailPanelOpen(true);
              }}
              filterText={filterText}
              onFilterChange={setFilterText}
              filterType={filterType}
              onFilterTypeChange={setFilterType}
              filterZone={filterZone}
              onFilterZoneChange={setFilterZone}
              filterFloor={filterFloor}
              onFilterFloorChange={setFilterFloor}
              assetTypes={assetTypes}
              zones={zones}
              floors={floors}
            />
          </aside>

          {/* Center panel - Content based on tab */}
          <div className="content-panel flex-1 flex flex-col min-w-0 overflow-hidden">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            <div className="flex-1 overflow-hidden">
              <TabPanel id="assets-panel" tabId="assets" activeTab={activeTab}>
                <AssetDetail
                  asset={selectedAsset || null}
                  telemetry={assetTelemetry}
                  pointDefinitions={MOCK_POINT_DEFINITIONS}
                  historicalData={historicalData}
                  onEditSetpoint={(def, val) => console.log('Edit setpoint', def, val)}
                />
              </TabPanel>

              <TabPanel id="plant-panel" tabId="plant" activeTab={activeTab}>
                <PlantSchematicPlaceholder />
              </TabPanel>

              <TabPanel id="building-panel" tabId="building" activeTab={activeTab}>
                <BuildingViewPlaceholder />
              </TabPanel>

              <TabPanel id="charts-panel" tabId="charts" activeTab={activeTab}>
                <div className="h-full p-4">
                  {selectedAssetHistoricalSeries.length > 0 ? (
                    <HistoricalChart
                      series={selectedAssetHistoricalSeries}
                      resolution={chartResolution}
                      onResolutionChange={setChartResolution}
                      timeRange={chartTimeRange}
                      onTimeRangeChange={setChartTimeRange}
                      height={400}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-content-tertiary">
                      Select an asset to view charts
                    </div>
                  )}
                </div>
              </TabPanel>

              <TabPanel id="alarms-panel" tabId="alarms" activeTab={activeTab}>
                <AlarmsPlaceholder />
              </TabPanel>

              <TabPanel id="setpoints-panel" tabId="setpoints" activeTab={activeTab}>
                <SetpointsPlaceholder />
              </TabPanel>
            </div>
          </div>

          {/* Right panel - Asset Detail (mobile) or additional info */}
          <SidePanel
            isOpen={detailPanelOpen && isMobile}
            onClose={() => setDetailPanelOpen(false)}
            title={selectedAsset?.name || 'Asset Detail'}
            position="right"
            width={360}
          >
            <AssetDetail
              asset={selectedAsset || null}
              telemetry={assetTelemetry}
              pointDefinitions={MOCK_POINT_DEFINITIONS}
              historicalData={historicalData}
              onEditSetpoint={(def, val) => console.log('Edit setpoint', def, val)}
            />
          </SidePanel>
        </div>
      </main>
    </div>
  );
}

// Placeholder components for other tabs
function PlantSchematicPlaceholder() {
  return (
    <div className="h-full flex items-center justify-center bg-surface-base">
      <div className="text-center p-8">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-content-tertiary/50">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6M9 15h4" />
        </svg>
        <h3 className="text-lg font-medium text-content-primary mb-1">Plant Schematic</h3>
        <p className="text-content-tertiary">L2 P&ID-style schematic with live sensor chips and floating asset cards</p>
        <p className="text-sm text-content-tertiary mt-2">Implementation in progress (T-034)</p>
      </div>
    </div>
  );
}

function BuildingViewPlaceholder() {
  return (
    <div className="h-full flex items-center justify-center bg-surface-base">
      <div className="text-center p-8">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-content-tertiary/50">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <h3 className="text-lg font-medium text-content-primary mb-1">Building View (L1)</h3>
        <p className="text-content-tertiary">3D digital twin with comfort coloring, explode and revolve</p>
        <p className="text-sm text-content-tertiary mt-2">Should tier - implementation in progress (T-035)</p>
      </div>
    </div>
  );
}

function AlarmsPlaceholder() {
  const mockAlarms = ALARM_PLACEHOLDER;

  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="space-y-2">
        {mockAlarms.map(alarm => (
          <div key={alarm.id} className={clsx('alarm-row p-3 rounded-lg border transition-colors', alarm.severity === 'critical' ? 'bg-critical/5 border-critical/20' : 'bg-warning/5 border-warning/20')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx('font-medium', alarm.severity === 'critical' ? 'text-critical' : 'text-warning')}>{alarm.asset}</span>
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-medium', alarm.severity === 'critical' ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning')}>
                    {alarm.severity.toUpperCase()}
                  </span>
                  {!alarm.acknowledged && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-chilled/10 text-chilled">UNACK</span>
                  )}
                </div>
                <div className="text-sm text-content-secondary">{alarm.point}</div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-content-tertiary">
                  <span>Value: <span className="font-mono tabular-nums text-content-primary">{alarm.value}</span></span>
                  <span>Time: {alarm.time}</span>
                </div>
              </div>
              {!alarm.acknowledged && (
                <button className="px-3 py-1.5 bg-chilled text-white text-sm rounded-md hover:opacity-90 transition-opacity flex-shrink-0">Acknowledge</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetpointsPlaceholder() {
  const mockSetpoints = SETPOINT_PLACEHOLDER;

  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="space-y-2">
        {mockSetpoints.map(sp => (
          <div key={sp.id} className="p-3 rounded-lg border border-default bg-surface-base">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <span className="font-medium text-content-primary">{sp.asset}</span>
                <span className="text-content-tertiary ml-2">{sp.point}</span>
              </div>
              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                sp.status === 'PENDING' ? 'bg-warning/10 text-warning' :
                sp.status === 'APPLIED' ? 'bg-success/10 text-success' :
                sp.status === 'FAILED' ? 'bg-critical/10 text-critical' :
                'bg-surface-sunken text-content-tertiary'
              )}>{sp.status}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-content-tertiary">
                <span>Current:</span>
                <span className="font-mono tabular-nums text-content-primary">{sp.current}</span>
              </div>
              {sp.requested && (
                <div className="flex items-center gap-1 text-content-tertiary">
                  <span>Requested:</span>
                  <span className="font-mono tabular-nums text-chilled">{sp.requested}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-content-tertiary">
                <span>By:</span>
                <span className="text-content-secondary">{sp.requester}</span>
              </div>
              <div className="flex items-center gap-1 text-content-tertiary">
                <span>At:</span>
                <span className="font-mono tabular-nums">{sp.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
