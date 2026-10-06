import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControllerHealth } from './ControllerHealth';
import type { useAuth } from '../context/AuthContext';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth() as ReturnType<typeof useAuth>
}));
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'neutral', setTheme: vi.fn(), toggleTheme: vi.fn() })
}));

function auth() {
  return {
    user: { id: 'u2', name: 'HVAC Engineer', role: 'engineer', siteIds: ['simsite-hospital'] },
    sites: [{ id: 'simsite-hospital', name: 'SimSite Hospital', timezone: 'Asia/Kolkata' }],
    currentSiteId: 'simsite-hospital',
    setCurrentSite: vi.fn(),
    logout: vi.fn(),
    hasRole: () => true,
    hasPermission: (p: string) => p === 'telemetry:read'
  };
}

describe('ControllerHealth page', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(auth());
  });

  it('renders the controller list and health summary', () => {
    render(<ControllerHealth />);
    expect(screen.getByRole('heading', { name: 'Controller Health' })).toBeInTheDocument();
    expect(screen.getByText('Controller-1')).toBeInTheDocument();
    expect(screen.getByText('Avg Coverage')).toBeInTheDocument();
  });

  it('reveals the blast radius for a selected controller', () => {
    render(<ControllerHealth />);
    fireEvent.click(screen.getByRole('button', { name: /Blast Radius View/ }));
    fireEvent.click(screen.getByText('Controller-1'));
    expect(screen.getByText(/Blast Radius: Controller-1/)).toBeInTheDocument();
    expect(screen.getByText(/assets will be affected/)).toBeInTheDocument();
    // An affected asset from that controller appears in the grid.
    expect(screen.getByText('Chiller 1')).toBeInTheDocument();
  });

  it('summarises the affected zones for the blast radius', () => {
    render(<ControllerHealth />);
    fireEvent.click(screen.getByRole('button', { name: /Blast Radius View/ }));
    fireEvent.click(screen.getByText('Controller-5'));
    expect(screen.getByText('Impact Assessment')).toBeInTheDocument();
  });
});
