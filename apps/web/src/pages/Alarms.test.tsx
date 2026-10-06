import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alarms } from './Alarms';
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

describe('Alarms page', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(authWith(['telemetry:read', 'alarms:read', 'alarms:acknowledge']));
  });

  it('renders the alarms list', () => {
    render(<Alarms />);
    expect(screen.getByRole('heading', { name: 'Alarms' })).toBeInTheDocument();
  });

  it('lists asserted alarms first by default', () => {
    render(<Alarms />);
    const asserted = screen.getAllByText('ASSERTED');
    expect(asserted.length).toBeGreaterThan(0);
  });

  it('filters to unacknowledged (asserted) alarms', () => {
    render(<Alarms />);
    fireEvent.click(screen.getByRole('button', { name: /Unacknowledged/ }));
    // Chiller 2's alarm is acknowledged, so it must not be shown in this filter.
    expect(screen.queryByText('Chiller 2')).not.toBeInTheDocument();
    expect(screen.getAllByText('ASSERTED').length).toBeGreaterThan(0);
  });

  it('disables acknowledge when the role lacks permission', () => {
    mockUseAuth.mockReturnValue(authWith(['telemetry:read', 'alarms:read']));
    render(<Alarms />);
    const buttons = screen.getAllByRole('button', { name: 'Acknowledge' });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(b => expect(b).toBeDisabled());
  });

  it('enables acknowledge when the role has permission', () => {
    render(<Alarms />);
    const buttons = screen.getAllByRole('button', { name: 'Acknowledge' });
    expect(buttons[0]).not.toBeDisabled();
  });
});
