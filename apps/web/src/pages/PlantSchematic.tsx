import React from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import clsx from 'clsx';

export function PlantSchematic() {
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Plant Schematic' }
  ];

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] flex items-center justify-center bg-surface-base">
          <div className="text-center p-8">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-content-tertiary/50">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 15h4" />
            </svg>
            <h1 className="text-2xl font-semibold text-content-primary mb-2">Plant Schematic (L2)</h1>
            <p className="text-content-tertiary max-w-md mx-auto mb-6">
              2D P&ID-style schematic with live sensor chips, floating asset cards with controls,
              pipe flow animation, pan/zoom with Fit button, alarm pulse outlines, coverage badges,
              and controller blast-radius highlight.
            </p>
            <div className="text-sm text-content-tertiary space-y-1">
              <p>Status: In progress (Task T-034)</p>
              <p>Tech: Inline SVG, CSS dash-offset flow animation, zustand binding store</p>
              <p>Features: Role-bound sensor chips, writable point controls via confirm sheet, collapsible cards on portrait</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}