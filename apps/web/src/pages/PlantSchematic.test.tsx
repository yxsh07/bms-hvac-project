import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlantSchematic } from './PlantSchematic';
import type { useAuth } from '../context/AuthContext';
import type { WhatIfResult } from '../api/sim';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth() as ReturnType<typeof useAuth>,
}));
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'neutral', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

function auth() {
  return {
    user: { id: 'u2', name: 'HVAC Engineer', role: 'engineer', siteIds: ['simsite-hospital'] },
    sites: [{ id: 'simsite-hospital', name: 'SimSite Hospital', timezone: 'Asia/Kolkata' }],
    currentSiteId: 'simsite-hospital',
    setCurrentSite: vi.fn(),
    logout: vi.fn(),
    hasRole: () => true,
    hasPermission: () => true,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function whatIfResult(overrides: Partial<WhatIfResult> = {}): WhatIfResult {
  const sample = (t: string, kw: number, deltaTC: number) => ({
    t,
    kw,
    deltaTC,
    tr: 60,
    chwLeavingC: 8,
    condenserEnteringC: 25,
  });
  return {
    label: 'indicative, 3-day calibration',
    horizonMin: 60,
    stepMinutes: 5,
    liveStateUnchanged: true,
    baseline: { meanKw: 42, peakKw: 45, meanDeltaTC: 3.1, points: 2 },
    predicted: {
      meanKw: 36.4,
      peakKw: 39,
      meanDeltaTC: 3.0,
      points: 2,
      series: [sample('2026-07-12T00:05:00Z', 37, 3.0), sample('2026-07-12T00:10:00Z', 36, 3.0)],
    },
    baselineSeries: [sample('2026-07-12T00:05:00Z', 43, 3.1), sample('2026-07-12T00:10:00Z', 41, 3.1)],
    delta: { meanKw: -5.6, meanDeltaTC: -0.1 },
    envelope: {
      kind: 'parametric-curve',
      trainedOnDays: 3,
      tolerancePct: 5,
      insideEnvelopePct: 0,
      exceeded: true,
      fallbackActive: true,
      breaches: ['chwLeavingC'],
      warning: 'Surrogate left its training envelope',
    },
    warning: 'Surrogate left its training envelope',
    ...overrides,
  };
}

describe('PlantSchematic what-if overlay (WIF1)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(auth());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels the overlay indicative and posts the proposed set point', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      expect(String(url)).toContain('/sim/whatif');
      const rawBody = init?.body as string | undefined;
      const body = JSON.parse(rawBody ?? '{}') as {
        changes: Array<{ type: string; value: number }>;
        horizonMin: number;
      };
      expect(body.changes[0].type).toBe('setpoint');
      expect(body.changes[0].value).toBe(8);
      expect(body.horizonMin).toBe(60);
      return Promise.resolve(jsonResponse(whatIfResult()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PlantSchematic />);
    expect(screen.getByTestId('whatif-label')).toHaveTextContent('indicative, 3-day calibration');

    fireEvent.click(screen.getByRole('button', { name: 'Run what-if' }));

    await waitFor(() => expect(screen.getByTestId('whatif-kw-predicted')).toHaveTextContent('36.0'));
    expect(screen.getByTestId('whatif-delta-predicted')).toHaveTextContent('3.0 K');
    // The ghost also sits on the L2 schematic chip.
    expect(screen.getByTestId('ghost-kw')).toHaveTextContent('36.0');
    expect(screen.getByTestId('ghost-delta-t')).toHaveTextContent('3.0');
    expect(screen.getByTestId('whatif-warning')).toHaveTextContent(/training envelope/);
    expect(screen.getByTestId('whatif-live-unchanged')).toHaveTextContent(/Live state unchanged/);
  });

  it('shows no warning when the prediction stays inside the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            whatIfResult({
              warning: null,
              envelope: {
                kind: 'parametric-curve',
                trainedOnDays: 3,
                tolerancePct: 5,
                insideEnvelopePct: 100,
                exceeded: false,
                fallbackActive: false,
                breaches: [],
                warning: null,
              },
            }),
          ),
        ),
      ),
    );

    render(<PlantSchematic />);
    fireEvent.click(screen.getByRole('button', { name: 'Run what-if' }));

    await waitFor(() => expect(screen.getByTestId('whatif-kw-predicted')).toBeInTheDocument());
    expect(screen.queryByTestId('whatif-warning')).not.toBeInTheDocument();
  });

  it('surfaces a simulator error without losing the label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ detail: 'horizonMin must be between 1 and 1440' }, 422))),
    );

    render(<PlantSchematic />);
    fireEvent.click(screen.getByRole('button', { name: 'Run what-if' }));

    await waitFor(() =>
      expect(screen.getByTestId('whatif-error')).toHaveTextContent(/horizonMin/),
    );
    expect(screen.getByTestId('whatif-label')).toHaveTextContent('indicative, 3-day calibration');
  });
});
