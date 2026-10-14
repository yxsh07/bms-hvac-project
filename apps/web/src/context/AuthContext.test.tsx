import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { isAuthenticated, currentSiteId, login } = useAuth();
  return <div>
    <span>{isAuthenticated ? currentSiteId : 'signed out'}</span>
    <button onClick={() => void login({ email: 'operator@example.com', password: 'Operator123!' })}>Log in</button>
  </div>;
}

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('uses API tokens to load the user and sites, then persists the session', async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/auth/login')) return Promise.resolve(new Response(JSON.stringify({ accessToken: 'access', refreshToken: 'refresh' })));
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access');
    if (path.endsWith('/me')) return Promise.resolve(new Response(JSON.stringify({
      id: 'operator', name: 'Operator', email: 'operator@example.com',
      roles: { 'simsite-hospital': 'operator' }, siteIds: ['simsite-hospital'],
    })));
    if (path.endsWith('/sites')) return Promise.resolve(new Response(JSON.stringify([{ id: 'simsite-hospital', name: 'SimSite' }])));
    throw new Error(`unexpected request ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('signed out');
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(screen.getByText('simsite-hospital')).toBeInTheDocument());
  expect(JSON.parse(localStorage.getItem('bms-session') ?? '{}')).toMatchObject({
    accessToken: 'access', refreshToken: 'refresh', currentSiteId: 'simsite-hospital',
  });
});
