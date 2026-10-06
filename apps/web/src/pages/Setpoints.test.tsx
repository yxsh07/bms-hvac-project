import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Setpoints } from './Setpoints';
import type { useAuth } from '../context/AuthContext';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth() as ReturnType<typeof useAuth>
}));
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'neutral', setTheme: vi.fn(), toggleTheme: vi.fn() })
}));

function authWith(permissions: string[]) {
  return {
    user: { id: 'u2', name: 'HVAC Engineer', role: 'engineer', siteIds: ['simsite-hospital'] },
    sites: [{ id: 'simsite-hospital', name: 'SimSite Hospital', timezone: 'Asia/Kolkata' }],
    currentSiteId: 'simsite-hospital',
    setCurrentSite: vi.fn(),
    logout: vi.fn(),
    hasRole: () => true,
    hasPermission: (p: string) => permissions.includes(p)
  };
}

describe('Setpoints page', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(authWith(['setpoints:read', 'setpoints:propose']));
  });

  it('renders the request queue heading', () => {
    render(<Setpoints />);
    expect(screen.getByRole('heading', { name: 'Set-point Requests' })).toBeInTheDocument();
  });

  it('shows read-back results on applied requests', () => {
    render(<Setpoints />);
    expect(screen.getAllByText(/Match/).length).toBeGreaterThan(0);
  });

  it('disables propose when the role lacks permission', () => {
    mockUseAuth.mockReturnValue(authWith(['setpoints:read']));
    render(<Setpoints />);
    expect(screen.getByRole('button', { name: 'Propose Change' })).toBeDisabled();
  });

  it('opens the confirm sheet for a new proposal when permitted', () => {
    render(<Setpoints />);
    fireEvent.click(screen.getByRole('button', { name: 'Propose Change' }));
    expect(screen.getByRole('heading', { name: 'Confirm Set-point Change' })).toBeInTheDocument();
  });

  it('opens the request detail timeline when a request is clicked', () => {
    render(<Setpoints />);
    fireEvent.click(screen.getByText('Chiller 1'));
    expect(screen.getByRole('heading', { name: 'Set-point Request Detail' })).toBeInTheDocument();
  });

  it('filters requests by status', () => {
    render(<Setpoints />);
    fireEvent.click(screen.getByRole('button', { name: /Failed/ }));
    // the applied AHU-1 request should no longer be listed
    expect(screen.queryByText(/AHU-1/)).not.toBeInTheDocument();
  });
});
