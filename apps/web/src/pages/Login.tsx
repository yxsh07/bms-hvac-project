import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

export function Login() {
  const { login, isLoading } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState('engineer@bms.local');
  const [password, setPassword] = useState('eng123');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    login({ email, password }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Login failed');
    });
  };

  const demoUsers = [
    { email: 'admin@bms.local', password: 'admin123', role: 'Administrator' },
    { email: 'engineer@bms.local', password: 'eng123', role: 'HVAC Engineer' },
    { email: 'manager@bms.local', password: 'mgr123', role: 'Facility Manager' },
    { email: 'operator@bms.local', password: 'op123', role: 'Operator' },
    { email: 'executive@bms.local', password: 'exec123', role: 'Executive' }
  ];

  return (
    <div className="login-page min-h-screen flex items-center justify-center p-4 bg-surface-base">
      <div className="login-card w-full max-w-md bg-surface-base border border-default rounded-xl p-8 shadow-lg">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-chilled mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="28" height="28" rx="6" fill="white" />
              <path d="M8 16 L14 10 L24 22" stroke="var(--color-semantic-chilled)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-content-primary">BMS Digital Twin</h1>
          <p className="text-content-tertiary mt-1">Sign in to continue</p>
        </div>

        {/* Theme indicator (dev) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-2 rounded-lg bg-surface-sunken text-center text-[11px] text-content-tertiary">
            Theme: <span className="font-mono font-medium capitalize">{theme}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-critical/10 border border-critical/30 text-critical text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={(e) => { handleSubmit(e); }} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-content-secondary mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-base border border-default rounded-lg text-content-primary placeholder-content-tertiary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus transition-colors"
              placeholder="engineer@bms.local"
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-content-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-base border border-default rounded-lg text-content-primary placeholder-content-tertiary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus transition-colors pr-10"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-primary"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-chilled text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-chilled focus:ring-offset-2"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="mt-6 pt-6 border-t border-default">
          <p className="text-[11px] text-content-tertiary text-center mb-3">Demo accounts:</p>
          <div className="space-y-1.5">
            {demoUsers.map(user => (
              <button
                key={user.email}
                type="button"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(user.password);
                }}
                className="w-full px-3 py-2 text-left text-sm rounded-lg bg-surface-sunken hover:bg-state-hover transition-colors border border-default"
                disabled={isLoading}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-content-primary">{user.role}</span>
                  <span className="text-[11px] text-content-tertiary font-mono">{user.email}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-content-tertiary">
          BMS Digital Twin Prototype — Tablet-first responsive PWA
        </p>
      </div>
    </div>
  );
}