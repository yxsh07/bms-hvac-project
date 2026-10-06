import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Live } from './Live';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Live page (G2)', () => {
  it('logs in, lists assets, and shows a live value with its quality code', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/api/v1/auth/login')) {
        return Promise.resolve(jsonResponse({ accessToken: 'tok', refreshToken: 'r', expiresIn: 900 }));
      }
      if (u.endsWith('/api/v1/sites/simsite-hospital/assets')) {
        return Promise.resolve(jsonResponse([
          { id: 'ahu-01', name: 'AHU 1', type: 'ahu', criticality: 'medium' },
          { id: 'chiller-01', name: 'Chiller 1', type: 'chiller', criticality: 'critical' },
        ]));
      }
      if (u.endsWith('/api/v1/sites/simsite-hospital/assets/chiller-01/latest')) {
        // The login call must have carried a bearer token.
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        expect(auth).toBe('Bearer tok');
        return Promise.resolve(
          jsonResponse({
            fields: {
              CHWST: { value: 7.92, quality: 0, at: '2026-07-12T00:00:00Z' },
              CWST: { value: null, quality: 3, at: '2026-07-12T00:00:00Z' },
            },
            quality: { expectedSamples: 60, goodSamples: 30, coveragePct: 50, hasDelayedData: false },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ error: 'not found', code: 'NOT_FOUND' }, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<Live />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(screen.getByTestId('value-CHWST')).toBeInTheDocument());
    // The critical asset is auto-selected and its value rendered.
    expect(screen.getByTestId('value-CHWST')).toHaveTextContent('7.92');
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
    // A suppressed (stopped-equipment) value renders as a dash, marked.
    expect(screen.getByTestId('value-CWST')).toHaveTextContent('—');
    expect(screen.getByText('Stopped equipment')).toBeInTheDocument();
    expect(screen.getByText(/coverage 50.0%/)).toBeInTheDocument();
  });

  it('shows a helpful error when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED'))),
    );
    render(<Live />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(screen.getByText(/connect ECONNREFUSED/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/is the API running/)).toBeInTheDocument();
  });
});
