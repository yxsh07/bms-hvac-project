import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';
import type { Site } from '../types/auth';

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

export function Header({
  breadcrumb = [],
  tabs = [],
  activeTab,
  onTabChange,
  onMenuClick,
  onInfoClick,
  onToolsClick
}: HeaderProps) {
  const { user, sites, currentSiteId, setCurrentSite, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentSite = sites.find(s => s.id === currentSiteId);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteMenuRef.current && !siteMenuRef.current.contains(event.target as Node)) {
        setSiteMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    engineer: 'HVAC Engineer',
    facility_manager: 'Facility Manager',
    operator: 'Operator',
    executive: 'Executive'
  };

  return (
    <header className="app-header fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 h-[var(--header-height)] bg-surface-base border-b border-default">
      {/* Hamburger menu */}
      <button
        onClick={() => { setMenuOpen((open) => !open); onMenuClick?.(); }}
        className="header-hamburger p-2 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors text-content-primary"
        aria-label="Open main menu"
        aria-expanded={menuOpen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {menuOpen && (
        <nav aria-label="Main navigation" className="absolute left-3 top-full z-dropdown mt-1 grid min-w-[220px] gap-1 rounded-lg border border-default bg-surface-base p-2 shadow-lg">
          {[
            ['/', 'Dashboard'],
            ['/building', 'Building twin'],
            ['/plant', 'Plant schematic'],
            ['/live', 'Live telemetry'],
            ['/alarms', 'Alarms'],
            ['/setpoints', 'Set-points'],
            ['/controllers', 'Controller health'],
          ].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-content-primary hover:bg-state-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{label}</a>
          ))}
        </nav>
      )}

      {/* Product mark */}
      <div className="header-brand flex items-center gap-2 flex-shrink-0" aria-label="BMS Digital Twin">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--color-semantic-chilled)" />
          <path d="M8 16 L14 10 L24 22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span className="font-semibold text-content-primary text-lg tracking-tight hidden sm:block">BMS Twin</span>
      </div>

      {/* Site selector */}
      <div className="header-site-selector flex items-center gap-2 flex-1 max-w-md" role="combobox" aria-label="Select site">
        <button
          onClick={() => setSiteMenuOpen(!siteMenuOpen)}
          className="site-trigger w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors text-content-primary border border-default min-w-0"
          aria-expanded={siteMenuOpen}
          aria-haspopup="listbox"
        >
          <span className="truncate font-medium">{currentSite?.name || 'Select site'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={clsx('flex-shrink-0 transition-transform', siteMenuOpen && 'rotate-180')}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {siteMenuOpen && (
          <div
            ref={siteMenuRef}
            className="site-dropdown absolute top-full left-0 right-0 mt-1 bg-surface-base border border-default rounded-lg shadow-lg overflow-hidden z-dropdown min-w-[280px]"
            role="listbox"
          >
            {sites.map(site => (
              <button
                key={site.id}
                onClick={() => {
                  setCurrentSite(site.id);
                  setSiteMenuOpen(false);
                }}
                className={clsx(
                  'w-full px-3 py-2.5 text-left transition-colors flex items-center gap-3',
                  currentSiteId === site.id ? 'bg-state-selected' : 'hover:bg-state-hover'
                )}
                role="option"
                aria-selected={currentSiteId === site.id}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{site.name}</div>
                  <div className="text-[11px] text-content-tertiary flex items-center gap-1">
                    <span>🕐</span>
                    <span>{site.timezone}</span>
                  </div>
                </div>
                {currentSiteId === site.id && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-semantic-chilled)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Weather strip */}
      {currentSite?.environment && (
        <div
          className="weather-strip flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-sunken border border-default hidden md:flex"
          onClick={() => setShowWeatherDetail(!showWeatherDetail)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowWeatherDetail(!showWeatherDetail); } }}
          aria-expanded={showWeatherDetail}
        >
          <div className="weather-item flex items-center gap-1.5">
            <span className="text-[11px] text-content-tertiary">WB</span>
            <span className="font-mono tabular-nums text-sm font-medium text-content-primary">{currentSite.environment.wetBulbTemp?.toFixed(1)}°C</span>
          </div>
          <div className="weather-divider w-px h-4 bg-border-default mx-1" aria-hidden="true" />
          <div className="weather-item flex items-center gap-1.5">
            <span className="text-[11px] text-content-tertiary">DB</span>
            <span className="font-mono tabular-nums text-sm font-medium text-content-primary">{currentSite.environment.dryBulbTemp?.toFixed(1)}°C</span>
          </div>
          <div className="weather-divider w-px h-4 bg-border-default mx-1" aria-hidden="true" />
          <div className="weather-item flex items-center gap-1.5">
            <span className="text-[11px] text-content-tertiary">RH</span>
            <span className="font-mono tabular-nums text-sm font-medium text-content-primary">{currentSite.environment.relativeHumidity?.toFixed(0)}%</span>
          </div>
          {showWeatherDetail && (
            <div className="weather-detail absolute top-full right-0 mt-1 w-56 bg-surface-base border border-default rounded-lg shadow-lg p-3 z-dropdown">
              <div className="text-[11px] text-content-tertiary mb-2">Weather Details</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Wet Bulb</span><span className="font-mono tabular-nums font-medium">{currentSite.environment.wetBulbTemp?.toFixed(1)}°C</span></div>
                <div className="flex justify-between"><span>Dry Bulb</span><span className="font-mono tabular-nums font-medium">{currentSite.environment.dryBulbTemp?.toFixed(1)}°C</span></div>
                <div className="flex justify-between"><span>Relative Humidity</span><span className="font-mono tabular-nums font-medium">{currentSite.environment.relativeHumidity?.toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Timezone</span><span className="font-medium">{currentSite.timezone}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Theme toggle (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors text-content-tertiary hidden lg:flex"
          aria-label={`Switch to ${theme === 'neutral' ? 'SmartJoules' : 'Neutral'} theme`}
          title={`Current: ${theme}`}
        >
          <span className="text-xs font-mono">{theme === 'neutral' ? 'NEU' : 'SJ'}</span>
        </button>
      )}

      {/* Actions */}
      <div className="header-actions flex items-center gap-1">
        {/* Info */}
        <button
          onClick={onInfoClick}
          className="header-action p-2 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors text-content-tertiary hover:text-content-primary"
          aria-label="Information"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>

        {/* Tools */}
        <button
          onClick={onToolsClick}
          className="header-action p-2 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors text-content-tertiary hover:text-content-primary"
          aria-label="Tools"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </button>

        {/* Alarm bell */}
        <button className="header-action relative p-2 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors text-content-tertiary hover:text-content-primary" aria-label="Alarms (3)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-critical text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</span>
        </button>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="header-user flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-elevated hover:bg-state-hover transition-colors"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <div className="user-avatar w-7 h-7 rounded-full bg-chilled flex items-center justify-center text-white text-xs font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden md:block text-left min-w-0">
              <div className="text-sm font-medium text-content-primary truncate">{user?.name || 'User'}</div>
              <div className="text-[10px] text-content-tertiary capitalize">{roleLabels[user?.role || '']}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={clsx('flex-shrink-0 text-content-tertiary transition-transform', userMenuOpen && 'rotate-180')}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="user-dropdown absolute right-0 top-full mt-1 w-56 bg-surface-base border border-default rounded-lg shadow-lg overflow-hidden z-dropdown">
              <div className="px-3 py-2 border-b border-default">
                <div className="font-medium text-content-primary">{user?.name}</div>
                <div className="text-[11px] text-content-tertiary">{user?.email}</div>
                <div className="text-[10px] text-content-tertiary capitalize mt-0.5">{roleLabels[user?.role || '']}</div>
              </div>
              <button
                onClick={() => { void logout(); }}
                className="w-full px-3 py-2 text-left text-content-primary hover:bg-state-hover transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
