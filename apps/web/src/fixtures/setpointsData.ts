// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic gate).
import type { UserRole } from '../types/auth';
import type { PointDefinition } from '../types/telemetry';

export interface ProposalTarget {
  asset: string;
  point: string;
  currentValue: string;
  unit: string;
  pointDefinition: PointDefinition;
}

// Default target shown by the confirm sheet in the prototype until an asset
// picker drives the proposal (§8.5).
export const DEFAULT_PROPOSAL: ProposalTarget = {
  asset: 'Chiller 1',
  point: 'CHW Setpoint',
  currentValue: '7.0°C',
  unit: '°C',
  pointDefinition: {
    abbreviation: 'ch1_chw_sp',
    displayName: 'CHW Setpoint',
    unit: '°C',
    group: 'Setpoint',
    classification: 'Setpoint',
    writable: true,
    safeMin: 5.0,
    safeMax: 10.0,
    source: 'component'
  }
};

export interface SetpointRequest {
  id: string;
  asset: string;
  point: string;
  currentValue: string;
  requestedValue: string;
  unit: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'APPLYING' | 'APPLIED' | 'FAILED' | 'REJECTED' | 'REVERTED' | 'EXPIRED';
  requester: string;
  requesterRole: UserRole;
  requestedAt: string;
  approver?: string;
  approverRole?: UserRole;
  approvedAt?: string;
  appliedAt?: string;
  readbackValue?: string;
  readbackAt?: string;
  readbackMatch?: boolean;
  justification: string;
  effectiveWindow?: { start: string; end: string };
  revertTime?: string;
  revertedAt?: string;
  revertReadbackValue?: string;
  revertReadbackAt?: string;
  revertReadbackMatch?: boolean;
  idempotencyKey: string;
  safeMin?: number;
  safeMax?: number;
}

export const MOCK_REQUESTS: SetpointRequest[] = [
  {
    id: 'sp-001',
    asset: 'Chiller 1',
    point: 'CHW Setpoint',
    currentValue: '7.0°C',
    requestedValue: '6.5°C',
    unit: '°C',
    status: 'PENDING',
    requester: 'HVAC Engineer',
    requesterRole: 'engineer',
    requestedAt: '2026-10-05T10:15:23Z',
    justification: 'Optimize chiller efficiency during partial load conditions. Current leaving water temperature is 7.0°C but load analysis suggests 6.5°C is sufficient for current demand.',
    safeMin: 5.0,
    safeMax: 10.0,
    effectiveWindow: { start: '2026-10-05T10:30:00Z', end: '2026-10-05T18:00:00Z' },
    revertTime: '2026-10-05T18:00:00Z',
    idempotencyKey: 'idem-sp-001-abc123'
  },
  {
    id: 'sp-002',
    asset: 'AHU-1 (Critical)',
    point: 'Supply Air Temp',
    currentValue: '13.0°C',
    requestedValue: '12.5°C',
    unit: '°C',
    status: 'APPLIED',
    requester: 'HVAC Engineer',
    requesterRole: 'engineer',
    requestedAt: '2026-10-05T08:30:00Z',
    approver: 'Facility Manager',
    approverRole: 'facility_manager',
    approvedAt: '2026-10-05T08:35:12Z',
    appliedAt: '2026-10-05T08:35:28Z',
    readbackValue: '12.5°C',
    readbackAt: '2026-10-05T08:35:45Z',
    readbackMatch: true,
    justification: 'Lower supply air temperature to improve dehumidification in ICU zone. Current RH trending above 70%.',
    safeMin: 11.0,
    safeMax: 16.0,
    idempotencyKey: 'idem-sp-002-def456'
  },
  {
    id: 'sp-003',
    asset: 'Chiller 2',
    point: 'CHW Setpoint',
    currentValue: '7.0°C',
    requestedValue: '6.8°C',
    unit: '°C',
    status: 'FAILED',
    requester: 'Facility Manager',
    requesterRole: 'facility_manager',
    requestedAt: '2026-10-04T14:22:10Z',
    approver: 'Admin User',
    approverRole: 'admin',
    approvedAt: '2026-10-04T14:25:00Z',
    appliedAt: '2026-10-04T14:25:15Z',
    readbackValue: '7.0°C',
    readbackAt: '2026-10-04T14:25:45Z',
    readbackMatch: false,
    justification: 'Test lower setpoint for energy savings during low load period.',
    safeMin: 5.0,
    safeMax: 10.0,
    idempotencyKey: 'idem-sp-003-ghi789'
  },
  {
    id: 'sp-004',
    asset: 'AHU-2',
    point: 'Valve Max Position',
    currentValue: '100%',
    requestedValue: '85%',
    unit: '%',
    status: 'APPROVED',
    requester: 'HVAC Engineer',
    requesterRole: 'engineer',
    requestedAt: '2026-10-05T09:00:00Z',
    approver: 'Facility Manager',
    approverRole: 'facility_manager',
    approvedAt: '2026-10-05T09:15:00Z',
    justification: 'Limit valve position to reduce pumping energy during partial load. Pump VFD will compensate.',
    safeMin: 50,
    safeMax: 100,
    idempotencyKey: 'idem-sp-004-jkl012'
  },
  {
    id: 'sp-005',
    asset: 'Chiller 3',
    point: 'CHW Setpoint',
    currentValue: '7.0°C',
    requestedValue: '6.0°C',
    unit: '°C',
    status: 'REVERTED',
    requester: 'HVAC Engineer',
    requesterRole: 'engineer',
    requestedAt: '2026-10-04T06:00:00Z',
    approver: 'Facility Manager',
    approverRole: 'facility_manager',
    approvedAt: '2026-10-04T06:10:00Z',
    appliedAt: '2026-10-04T06:11:00Z',
    readbackValue: '6.0°C',
    readbackAt: '2026-10-04T06:11:30Z',
    readbackMatch: true,
    revertedAt: '2026-10-04T18:00:00Z',
    revertReadbackValue: '7.0°C',
    revertReadbackAt: '2026-10-04T18:00:45Z',
    revertReadbackMatch: true,
    justification: 'Night setback test - auto revert at 18:00.',
    safeMin: 5.0,
    safeMax: 10.0,
    effectiveWindow: { start: '2026-10-04T06:15:00Z', end: '2026-10-04T18:00:00Z' },
    revertTime: '2026-10-04T18:00:00Z',
    idempotencyKey: 'idem-sp-005-mno345'
  }
];
