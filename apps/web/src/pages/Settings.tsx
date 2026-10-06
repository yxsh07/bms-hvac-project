import React, { useState } from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Settings' }
  ];

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-xl font-semibold text-content-primary">Settings</h1>

            {/* Profile */}
            <section className="bg-surface-base border border-default rounded-lg p-4">
              <h2 className="text-sm font-medium text-content-primary mb-4">Profile</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-chilled flex items-center justify-center text-white font-medium text-lg">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-medium text-content-primary">{user?.name}</div>
                    <div className="text-sm text-content-tertiary">{user?.email}</div>
                    <div className="text-xs text-content-tertiary mt-1 capitalize">{user?.role?.replace('_', ' ')}</div>
                  </div>
                </div>
                <div className="pt-3 border-t border-default flex items-center gap-4 text-sm">
                  <span className="text-content-tertiary">Member of</span>
                  <span className="font-mono tabular-nums text-content-primary">{user?.siteIds?.length || 0} sites</span>
                </div>
              </div>
            </section>

            {/* Appearance */}
            <section className="bg-surface-base border border-default rounded-lg p-4">
              <h2 className="text-sm font-medium text-content-primary mb-4">Appearance</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">Theme</label>
                  <div className="flex gap-3">
                    {['neutral', 'smartjoules'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTheme(t as 'neutral' | 'smartjoules')}
                        className={clsx(
                          'flex-1 p-3 rounded-lg border-2 transition-all',
                          theme === t
                            ? 'border-chilled bg-state-selected'
                            : 'border-default hover:border-strong'
                        )}
                      >
                        <div className="font-medium text-content-primary capitalize">{t}</div>
                        <div className="text-xs text-content-tertiary mt-1">
                          {t === 'neutral' ? 'Public-safe default' : 'Private brand theme'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Preferences */}
            <section className="bg-surface-base border border-default rounded-lg p-4">
              <h2 className="text-sm font-medium text-content-primary mb-4">Preferences</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium text-content-primary">Email Notifications</div>
                    <div className="text-sm text-content-tertiary">Receive alarm and report notifications</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="w-4 h-4 accent-chilled"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium text-content-primary">Auto Refresh</div>
                    <div className="text-sm text-content-tertiary">Automatically refresh live data</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 accent-chilled"
                  />
                </label>

                {autoRefresh && (
                  <div>
                    <label className="block text-sm font-medium text-content-secondary mb-2">Refresh Interval (seconds)</label>
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="w-full max-w-xs px-3 py-2 bg-surface-base border border-default rounded-md text-sm text-content-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                    >
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={60}>60</option>
                      <option value={120}>120</option>
                      <option value={300}>300</option>
                    </select>
                  </div>
                )}
              </div>
            </section>

            {/* Data & Cache */}
            <section className="bg-surface-base border border-default rounded-lg p-4">
              <h2 className="text-sm font-medium text-content-primary mb-4">Data & Cache</h2>
              <div className="space-y-3">
                <button className="w-full px-3 py-2 text-left bg-surface-sunken hover:bg-state-hover transition-colors rounded-md text-content-primary border border-default">
                  Clear Service Worker Cache
                </button>
                <button className="w-full px-3 py-2 text-left bg-surface-sunken hover:bg-state-hover transition-colors rounded-md text-content-primary border border-default">
                  Reset All Preferences
                </button>
              </div>
            </section>

            {/* About */}
            <section className="bg-surface-base border border-default rounded-lg p-4">
              <h2 className="text-sm font-medium text-content-primary mb-4">About</h2>
              <div className="space-y-1 text-sm text-content-tertiary">
                <div className="flex justify-between"><span>Version</span><span className="font-mono tabular-nums">0.1.0-prototype</span></div>
                <div className="flex justify-between"><span>Build</span><span className="font-mono tabular-nums">2026-10-05</span></div>
                <div className="flex justify-between"><span>Stack</span><span className="font-mono tabular-nums">React 19 + Vite + TypeScript + Tailwind</span></div>
                <div className="flex justify-between"><span>PWA</span><span className="font-mono tabular-nums">Enabled</span></div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}