import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetpointRequestDetail } from './SetpointRequestDetail';
import type { useAuth } from '../context/AuthContext';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth() as ReturnType<typeof useAuth>
}));

const baseRequest = {
  id: 'sp-001',
  asset: 'Chiller 1',
  point: 'CHW Setpoint',
  currentValue: '7.0°C',
  requestedValue: '6.5°C',
  unit: '°C',
  status: 'APPLIED' as const,
  requester: 'HVAC Engineer',
  requesterRole: 'engineer' as const,
  requestedAt: '2026-10-05T10:15:23Z',
  approver: 'Facility Manager',
  approverRole: 'facility_manager' as const,
  approvedAt: '2026-10-05T10:20:00Z',
  appliedAt: '2026-10-05T10:20:15Z',
  readbackValue: '6.5°C',
  readbackAt: '2026-10-05T10:20:30Z',
  readbackMatch: true,
  justification: 'Reduce setpoint for efficiency during low load.',
  idempotencyKey: 'idem-sp-001-abcdef123456',
  safeMin: 5,
  safeMax: 10
};

describe('SetpointRequestDetail', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      hasRole: () => true,
      hasPermission: (p: string) => p === 'setpoints:propose'
    });
  });

  it('renders the full state timeline with read-back result', () => {
    render(<SetpointRequestDetail request={baseRequest} onClose={vi.fn()} />);
    expect(screen.getByText('State Timeline')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getAllByText('Applied').length).toBeGreaterThan(0);
    expect(screen.getByText('Read-back Verification')).toBeInTheDocument();
    expect(screen.getByText(/Match confirmed/i)).toBeInTheDocument();
  });

  it('flags a read-back mismatch', () => {
    render(
      <SetpointRequestDetail
        request={{ ...baseRequest, status: 'FAILED', readbackValue: '7.0°C', readbackMatch: false }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByText(/Mismatch/i).length).toBeGreaterThan(0);
  });

  it('shows the justification and idempotency key', () => {
    render(<SetpointRequestDetail request={baseRequest} onClose={vi.fn()} />);
    expect(screen.getByText(baseRequest.justification)).toBeInTheDocument();
    expect(screen.getByText(baseRequest.idempotencyKey)).toBeInTheDocument();
  });
});
