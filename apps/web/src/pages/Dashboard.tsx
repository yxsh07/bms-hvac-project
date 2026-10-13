import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { MOCK_ASSETS } from '../fixtures/dashboardData';
import { MOCK_ALARMS } from '../fixtures/alarmsData';
import { parseTwinLayout } from 'packages-twin-core';
import seedLayout from '../../../../data/seed/twin-layout.json';
import './overview.css';

const layout = parseTwinLayout(seedLayout);
const floors = [...layout.floors].sort((a, b) => b.elevation - a.elevation);
const zones = new Set(MOCK_ASSETS.map((asset) => asset.zone).filter(Boolean));
const openAlarmCount = MOCK_ALARMS.filter((alarm) => alarm.status === 'asserted').length;

export function Dashboard() {
  const { sites, currentSiteId } = useAuth();
  const site = sites.find((entry) => entry.id === currentSiteId);

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={[{ label: 'Overview' }]} />
      <main className="overview-main">
        <div className="overview-kicker"><span className="overview-signal" /> OPERATIONS OVERVIEW <span className="overview-divider">/</span> PROTOTYPE DATA</div>
        <div className="overview-heading">
          <div><h1>{site?.name ?? 'Site overview'}</h1><p>Building systems at a glance. Choose a space or system to inspect.</p></div>
          <Link className="overview-primary-link" to="/building">Explore building <span aria-hidden="true">↗</span></Link>
        </div>

        <section className="overview-pulse" aria-label="Site pulse">
          <div className="overview-pulse-intro"><span className="overview-pulse-label">SITE PULSE</span><strong>Systems in view</strong><span>Simulator snapshot</span></div>
          <Link to="/alarms" className="overview-pulse-stat attention"><span>Needs attention</span><strong>{String(openAlarmCount).padStart(2, '0')}</strong><small>Review alarm queue ↗</small></Link>
          <Link to="/assets" className="overview-pulse-stat"><span>Assets monitored</span><strong>{String(MOCK_ASSETS.length).padStart(2, '0')}</strong><small>Browse equipment ↗</small></Link>
          <Link to="/building" className="overview-pulse-stat"><span>Spaces mapped</span><strong>{String(zones.size).padStart(2, '0')}</strong><small>Across {floors.length} levels ↗</small></Link>
        </section>

        <div className="overview-content">
          <section className="overview-building" aria-labelledby="overview-building-title">
            <div className="overview-card-heading"><div><span className="overview-section-label">01 / SPATIAL VIEW</span><h2 id="overview-building-title">Explore the building</h2><p>Move from site to floor, then inspect connected assets.</p></div><Link to="/building" className="overview-text-link">Open digital twin ↗</Link></div>
            <div className="overview-building-stage">
              <div className="overview-building-grid" aria-hidden="true" />
              <div className="overview-building-stack" aria-label={`${floors.length} building floors`}>
                {floors.map((floor, index) => <Link to="/building" key={floor.id} className="overview-floor" style={{ '--floor-index': index } as CSSProperties}><span className="overview-floor-number">{floor.name}</span><span className="overview-floor-line" /><span className="overview-floor-count">{Object.values(layout.anchors).filter((anchor) => anchor.floor === floor.id).length} assets</span></Link>)}
              </div>
              <div className="overview-building-note"><span className="overview-signal" /> SCHEMATIC MODEL <span>NOT TO SCALE</span></div>
            </div>
          </section>

          <div className="overview-side">
            <section className="overview-systems" aria-labelledby="overview-systems-title"><div className="overview-card-heading"><div><span className="overview-section-label">02 / SYSTEMS</span><h2 id="overview-systems-title">Follow the flow</h2></div></div>
              <Link to="/plant" className="overview-system-link chilled"><span className="overview-system-icon">↝</span><span><strong>Plant schematic</strong><small>Chilled and condenser loops</small></span><b aria-hidden="true">↗</b></Link>
              <Link to="/live" className="overview-system-link"><span className="overview-system-icon">⌁</span><span><strong>Live telemetry</strong><small>Latest point values and quality</small></span><b aria-hidden="true">↗</b></Link>
              <Link to="/controllers" className="overview-system-link"><span className="overview-system-icon">▤</span><span><strong>Controller health</strong><small>Connectivity and device status</small></span><b aria-hidden="true">↗</b></Link>
            </section>
            <section className="overview-attention" aria-labelledby="overview-attention-title"><div className="overview-card-heading"><div><span className="overview-section-label">03 / RESPONSE</span><h2 id="overview-attention-title">Action queue</h2></div><Link to="/alarms" className="overview-text-link">All alarms ↗</Link></div><p><span className="overview-alert-dot" /> {openAlarmCount} asserted sample alarms in the queue</p><Link to="/alarms" className="overview-queue-link">Review and acknowledge <span aria-hidden="true">→</span></Link></section>
          </div>
        </div>
      </main>
    </div>
  );
}
