import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PointRenderer } from './PointRenderer';
import type { PointValue, PointDefinition } from '../types/telemetry';

const mockPointDef: PointDefinition = {
  abbreviation: 'test_temp',
  displayName: 'Test Temperature',
  unit: '°C',
  group: 'Temperature',
  classification: 'Temperature',
  writable: false,
  source: 'component'
};

const mockPointValue: PointValue = {
  value: 22.5,
  quality: 0,
  timestamp: new Date().toISOString()
};

describe('PointRenderer', () => {
  it('renders temperature value with unit', () => {
    render(<PointRenderer pointValue={mockPointValue} pointDef={mockPointDef} />);
    expect(screen.getByText('22.5 °C')).toBeInTheDocument();
  });

  it('shows missing state for null value', () => {
    const missingValue: PointValue = { ...mockPointValue, value: null };
    render(<PointRenderer pointValue={missingValue} pointDef={mockPointDef} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows quality flag for non-zero quality', () => {
    const flaggedValue: PointValue = { ...mockPointValue, quality: 2 };
    render(<PointRenderer pointValue={flaggedValue} pointDef={mockPointDef} />);
    expect(screen.getByText('Out of range')).toBeInTheDocument();
  });

  it('shows delayed indicator when isDelayed is true', () => {
    const delayedValue: PointValue = { ...mockPointValue, isDelayed: true };
    render(<PointRenderer pointValue={delayedValue} pointDef={mockPointDef} />);
    expect(screen.getByTitle('Delayed data')).toBeInTheDocument();
  });

  it('shows edit button for writable points', () => {
    const writableDef: PointDefinition = { ...mockPointDef, writable: true, classification: 'Setpoint' };
    const onEdit = vi.fn();
    render(<PointRenderer pointValue={mockPointValue} pointDef={writableDef} onEdit={onEdit} />);
    const editButton = screen.getByLabelText('Edit Test Temperature');
    expect(editButton).toBeInTheDocument();
    editButton.click();
    expect(onEdit).toHaveBeenCalledWith(writableDef, 22.5);
  });

  it('renders sparkline when showSparkline and data provided', () => {
    render(
      <PointRenderer
        pointValue={mockPointValue}
        pointDef={mockPointDef}
        showSparkline
        sparklineData={[20, 21, 22, 22.5, 23]}
      />
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows coverage badge when coverage is low', () => {
    render(<PointRenderer pointValue={mockPointValue} pointDef={mockPointDef} coveragePct={30} showCoverageBadge />);
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('applies compact mode styling', () => {
    render(<PointRenderer pointValue={mockPointValue} pointDef={mockPointDef} compact />);
    const valueElement = screen.getByText('22.5 °C');
    expect(valueElement).toHaveClass('text-xs');
  });
});