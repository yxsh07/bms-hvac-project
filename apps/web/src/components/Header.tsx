import { useState } from 'react';
import { NavLink, useInRouterContext, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarmFeed } from '../hooks/useAlarmFeed';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface HeaderProps {
  breadcrumb?: BreadcrumbItem[];
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onMenuClick?: () => void;
  onInfoClick?: () => void;
  onToolsClick?: () => void;
}

const navigation = [
  { group: 'Observe', items: [
    { href: '/', label: 'Overview', code: 'OV' },
    { href: '/assets', label: 'Assets', code: 'AS' },
    { href: '/building', label: 'Building twin', code: '3D' },
    { href: '/plant', label: 'Plant schematic', code: 'PL' },
    { href: '/live', label: 'Live telemetry', code: 'LV' },
  ] },
  { group: 'Respond', items: [
    { href: '/alarms', label: 'Alarms', code: 'AL' },
    { href: '/setpoints', label: 'Set-points', code: 'SP' },
    { href: '/controllers', label: 'Controllers', code: 'CT' },
  ] },
  { group: 'Records', items: [
    { href: '/reports', label: 'Reports', code: 'RP' },
    { href: '/audit', label: 'Audit trail', code: 'AU' },
    { href: '/users', label: 'Users', code: 'US' },
    { href: '/settings', label: 'Settings', code: 'ST' },
  ] },
] as const;

function Navigation({ onNavigate, label, openAlarmCount }: { onNavigate?: () => void; label: string; openAlarmCount: number }) {
  return (
    <nav aria-label={label} className="shell-navigation">
      {navigation.map((section) => (
        <div className="shell-nav-group" key={section.group}>
          <p className="shell-nav-heading">{section.group}</p>
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              onClick={onNavigate}
              className={({ isActive }) => `shell-nav-link${isActive ? ' is-active' : ''}`}
            >
              <span className="shell-nav-code" aria-hidden="true">{item.code}</span>
              <span>{item.label}</span>
              {item.href === '/alarms' && <span className="shell-nav-alert" aria-label={`${openAlarmCount} asserted alarms`}>{openAlarmCount}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Header(props: HeaderProps) {
  const inRouter = useInRouterContext();
  if (!inRouter) return <header className="shell-topbar"><span className="shell-page-title">{props.breadcrumb?.at(-1)?.label ?? 'Overview'}</span></header>;
  return <ShellHeader {...props} />;
}

function ShellHeader({ breadcrumb = [], onMenuClick }: HeaderProps) {
  const { user, sites, currentSiteId, setCurrentSite, logout } = useAuth();
  const { alarms } = useAlarmFeed();
  const openAlarmCount = alarms.filter((alarm) => !alarm.clearedAt).length;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const activeItem = navigation.flatMap((section) => [...section.items] as Array<{ href: string; label: string; code: string }>).find((item) => item.href === location.pathname);
  const title = breadcrumb.at(-1)?.label ?? activeItem?.label ?? 'Overview';
  const site = sites.find((entry) => entry.id === currentSiteId);

  return (
    <>
      <aside className="shell-rail" aria-label="Product sidebar">
        <NavLink to="/" className="shell-brand" aria-label="BMS Twin overview">
          <span className="shell-brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span className="shell-brand-name">BMS<span>Twin</span><small>Operations console</small></span>
        </NavLink>
        <Navigation label="Primary navigation" openAlarmCount={openAlarmCount} />
        <div className="shell-rail-foot">
          <span className="shell-online-dot" />
          <span>Prototype mode</span>
          <span className="shell-rail-foot-code">SIM</span>
        </div>
      </aside>

      <header className="shell-topbar">
        <div className="shell-topbar-start">
          <button
            type="button"
            className="shell-menu-button"
            aria-label="Open main menu"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen((open) => !open); onMenuClick?.(); }}
          >
            <span /><span /><span />
          </button>
          <div className="shell-page-identity">
            <span className="shell-page-eyebrow">WORKSPACE / {site?.name ?? 'SITE'}</span>
            <span className="shell-page-title">{title}</span>
          </div>
        </div>
        <div className="shell-topbar-end">
          <label className="shell-site-select-wrap">
            <span>Site</span>
            <select aria-label="Select site" value={currentSiteId ?? ''} onChange={(event) => setCurrentSite(event.target.value)}>
              {sites.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          {site?.environment && (
            <div className="shell-weather" aria-label="Outdoor conditions">
              <span>OUTDOOR</span>
              <strong>{site.environment.dryBulbTemp?.toFixed(1)}°</strong>
              <small>{site.environment.relativeHumidity?.toFixed(0)}% RH</small>
            </div>
          )}
          <NavLink className="shell-alarm-button" to="/alarms" aria-label={`Alarms (${openAlarmCount})`}>
            <span className="shell-alarm-light" />
            <span>Alarms</span>
            <strong>{String(openAlarmCount).padStart(2, '0')}</strong>
          </NavLink>
          <details className="shell-user-menu">
            <summary aria-label="User menu"><span className="shell-avatar">{user?.name?.charAt(0) ?? 'U'}</span><span className="shell-user-name">{user?.name ?? 'User'}</span></summary>
            <div className="shell-user-popover">
              <strong>{user?.name}</strong><span>{user?.email}</span>
              <button type="button" onClick={() => void logout()}>Sign out</button>
            </div>
          </details>
        </div>
      </header>

      {menuOpen && (
        <div className="shell-menu-layer">
          <button className="shell-menu-backdrop" aria-label="Close main menu" onClick={() => setMenuOpen(false)} />
          <div className="shell-menu-panel">
            <div className="shell-menu-head"><span>Navigate</span><button type="button" onClick={() => setMenuOpen(false)} aria-label="Close main menu">×</button></div>
            <Navigation label="Main navigation" openAlarmCount={openAlarmCount} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
