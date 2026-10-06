import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmSheet } from './ConfirmSheet';
import type { PointDefinition } from '../types/telemetry';
import type { useAuth } from '../context/AuthContext';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth() as ReturnType<typeof useAuth>
}));

const pointDefinition: PointDefinition = {
  abbreviation: 'ch1_chw_sp',
  displayName: 'CHW Setpoint',
  unit: '°C',
  group: 'Temperature',
  classification: 'Setpoint',
  writable: true,
  safeMin: 5,
  safeMax: 10,
  source: 'component'
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof ConfirmSheet>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmSheet
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      assetName="Chiller 1"
      pointDisplayName="CHW Setpoint"
      currentValue="7.0°C"
      pointDefinition={pointDefinition}
      unit="°C"
      safeMin={5}
      safeMax={10}
      {...overrides}
    />
  );
  return { onConfirm, onClose };
}

describe('ConfirmSheet', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      hasPermission: (p: string) => p === 'setpoints:propose'
    });
  });

  it('shows current and safe range and prefills the new value', () => {
    renderSheet();
    expect(screen.getByDisplayValue('7.0°C')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7.0')).toBeInTheDocument();
    expect(screen.getByText(/Safe Operating Range/i)).toBeInTheDocument();
  });

  it('requires a justification before submitting', () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /Propose Change/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Justification is required')).toBeInTheDocument();
  });

  it('rejects values outside the safe range', () => {
    const { onConfirm } = renderSheet();
    fireEvent.change(screen.getByLabelText(/New Value/i), { target: { value: '99' } });
    fireEvent.change(screen.getByLabelText(/Justification/i), { target: { value: 'a valid justification string' } });
    fireEvent.click(screen.getByRole('button', { name: /Propose Change/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Above safe maximum/i)).toBeInTheDocument();
  });

  it('submits a valid request with value, unit and justification', () => {
    const { onConfirm } = renderSheet();
    fireEvent.change(screen.getByLabelText(/New Value/i), { target: { value: '6.5' } });
    fireEvent.change(screen.getByLabelText(/Justification/i), { target: { value: 'Reduce setpoint for efficiency' } });
    fireEvent.click(screen.getByRole('button', { name: /Propose Change/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      newValue: '6.5 °C',
      justification: 'Reduce setpoint for efficiency'
    }));
  });

  it('disables submission when the role lacks propose permission', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false });
    renderSheet();
    expect(screen.getByRole('button', { name: /Request Approval/i })).toBeDisabled();
  });

  it('states that no self-approval is allowed', () => {
    renderSheet();
    expect(screen.getByText(/No self-approval/i)).toBeInTheDocument();
  });
});
