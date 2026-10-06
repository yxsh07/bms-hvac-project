// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic gate).
export interface Alarm {
  id: string;
  asset: string;
  assetType: string;
  zone: string;
  floor: string;
  point: string;
  value: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'asserted' | 'acknowledged' | 'cleared';
  time: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  clearedAt?: string;
  description: string;
  controllerId?: string;
}

export const MOCK_ALARMS: Alarm[] = [
  {
    id: 'alm-001',
    asset: 'AHU-1 (Critical)',
    assetType: 'ahu',
    zone: 'ICU/Critical Care',
    floor: '3F',
    point: 'High Return Air Humidity',
    value: '78%',
    severity: 'critical',
    status: 'asserted',
    time: '2026-10-05T10:23:15Z',
    description: 'Return air humidity exceeds 75% threshold for critical care zone. Risk of condensation and microbial growth.',
    controllerId: 'CTRL-001'
  },
  {
    id: 'alm-002',
    asset: 'Chiller 2',
    assetType: 'chiller',
    zone: 'Plant Room',
    floor: 'B1',
    point: 'High Condenser Pressure',
    value: '18.5 bar',
    severity: 'warning',
    status: 'acknowledged',
    time: '2026-10-05T09:45:32Z',
    acknowledgedAt: '2026-10-05T09:47:10Z',
    acknowledgedBy: 'HVAC Engineer',
    description: 'Condenser pressure above 18 bar. Check cooling tower operation and condenser water flow.',
    controllerId: 'CTRL-001'
  },
  {
    id: 'alm-003',
    asset: 'FCU-5F-01',
    assetType: 'fcu',
    zone: 'Patient Ward',
    floor: '5F',
    point: 'Communication Lost',
    value: '—',
    severity: 'critical',
    status: 'asserted',
    time: '2026-10-05T08:12:05Z',
    description: 'No data received from FCU-5F-01 for 15 minutes. Last heartbeat 08:12. Possible controller or network issue.',
    controllerId: 'CTRL-005'
  },
  {
    id: 'alm-004',
    asset: 'Cooling Tower 1',
    assetType: 'coolingTower',
    zone: 'Plant Room',
    floor: 'Roof',
    point: 'High Approach Temperature',
    value: '4.2°C',
    severity: 'warning',
    status: 'acknowledged',
    time: '2026-10-05T07:30:00Z',
    acknowledgedAt: '2026-10-05T07:35:00Z',
    acknowledgedBy: 'Operator',
    description: 'Tower approach temperature above 4°C. Check fan operation and water distribution.',
    controllerId: 'CTRL-002'
  },
  {
    id: 'alm-005',
    asset: 'Chiller 1',
    assetType: 'chiller',
    zone: 'Plant Room',
    floor: 'B1',
    point: 'Chiller Trip',
    value: 'Trip',
    severity: 'critical',
    status: 'cleared',
    time: '2026-10-05T06:15:00Z',
    acknowledgedAt: '2026-10-05T06:16:00Z',
    acknowledgedBy: 'HVAC Engineer',
    clearedAt: '2026-10-05T06:45:00Z',
    description: 'Chiller 1 tripped on high motor current. Auto-restart attempted. Lag chiller started.',
    controllerId: 'CTRL-001'
  },
  {
    id: 'alm-006',
    asset: 'AHU-3',
    assetType: 'ahu',
    zone: 'OT Complex',
    floor: '2F',
    point: 'Low Supply Air Temperature',
    value: '9.2°C',
    severity: 'warning',
    status: 'asserted',
    time: '2026-10-05T10:10:22Z',
    description: 'Supply air temperature below 10°C setpoint. Heating coil valve may be stuck or sensor fault.',
    controllerId: 'CTRL-003'
  },
  {
    id: 'alm-007',
    asset: 'CHW Pump 2',
    assetType: 'pump',
    zone: 'Plant Room',
    floor: 'B1',
    point: 'VFD Fault',
    value: 'Fault',
    severity: 'critical',
    status: 'asserted',
    time: '2026-10-05T09:55:00Z',
    description: 'VFD reporting overcurrent fault. Pump stopped. CHW flow maintained by Pump 1.',
    controllerId: 'CTRL-001'
  },
  {
    id: 'alm-008',
    asset: 'Cooling Tower 2',
    assetType: 'coolingTower',
    zone: 'Plant Room',
    floor: 'Roof',
    point: 'Low Basin Level',
    value: '0.3m',
    severity: 'warning',
    status: 'asserted',
    time: '2026-10-05T10:05:10Z',
    description: 'Cooling tower basin level below 0.5m. Makeup water valve may not be opening.',
    controllerId: 'CTRL-002'
  }
];
