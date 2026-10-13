import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Tabs, TabPanel } from '../components/Tabs';
import { AssetBrowser } from '../components/AssetBrowser';
import { AssetDetail } from '../components/AssetDetail';
import { HistoricalChart } from '../components/HistoricalChart';
import { SidePanel, useResponsiveSidePanel } from '../components/SidePanel';
import type { TelemetrySeriesPoint } from '../types/telemetry';

import { MOCK_ASSETS, MOCK_POINT_DEFINITIONS, generateMockTelemetry, generateMockHistorical } from '../fixtures/dashboardData';

export function AssetWorkspace() {
  const { isLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useResponsiveSidePanel();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(MOCK_ASSETS[0]?.id);
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
    { label: 'Assets' },
    { label: activeTab === 'assets' ? 'Assets' : activeTab === 'plant' ? 'Plant' : activeTab === 'building' ? 'Building' : 'Charts' }
  ], [activeTab]);

  const tabs = useMemo(() => [
    { id: 'assets', label: 'Assets', count: MOCK_ASSETS.length },
    { id: 'charts', label: 'Trends' },
  ], []);


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
          <aside className="asset-browser-panel flex flex-col border-r border-default bg-surface-base" style={{ width: '360px', minWidth: '320px', maxWidth: '420px' }}>
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

          {/* Selected asset and trends */}
          <div className="content-panel flex-1 flex flex-col min-w-0 overflow-hidden">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            <div className="flex-1 overflow-hidden">
              <TabPanel id="assets-panel" tabId="assets" activeTab={activeTab}>
                <AssetDetail
                  asset={selectedAsset || null}
                  telemetry={assetTelemetry}
                  pointDefinitions={MOCK_POINT_DEFINITIONS}
                  historicalData={historicalData}
                  onEditSetpoint={() => navigate('/setpoints')}
                />
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
              onEditSetpoint={() => navigate('/setpoints')}
            />
          </SidePanel>
        </div>
      </main>
    </div>
  );
}
