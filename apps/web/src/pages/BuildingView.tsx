import React from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import clsx from 'clsx';

export function BuildingView() {
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Building View' }
  ];

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] flex items-center justify-center bg-surface-base">
          <div className="text-center p-8">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-content-tertiary/50">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <h1 className="text-2xl font-semibold text-content-primary mb-2">Building View (L1)</h1>
            <p className="text-content-tertiary max-w-md mx-auto mb-6">
              3D digital twin with stacked floors, generated plan textures, instanced equipment,
              comfort coloring from site config bands, Expand Floors slider, Revolve auto-rotate,
              floor list with focus-on-select, and 2D fallback.
            </p>
            <div className="text-sm text-content-tertiary space-y-1">
              <p>Status: Should tier (Task T-035)</p>
              <p>Tech: React Three Fiber + drei + zustand, lazy-loaded chunk</p>
              <p>Budgets: ≤150 draw calls, ≤150k triangles, ≥30 fps on mid-range phone</p>
              <p>Features: frameloop="demand", DPR ≤1.5, no shadows, imperative color updates</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}