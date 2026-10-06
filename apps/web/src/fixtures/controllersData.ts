// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic gate).
export interface AssetSummary {
  id: string;
  name: string;
  type: string;
  zone: string;
  floor: string;
  status: 'online' | 'offline' | 'degraded';
  lastValue?: string;
  hasAlarm: boolean;
}

export interface Controller {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  lastHeartbeat: string;
  assetCount: number;
  assets: AssetSummary[];
  coverage: number;
  alarms: number;
  criticalAlarms: number;
}

export const MOCK_CONTROLLERS: Controller[] = [
  {
    id: 'CTRL-001',
    name: 'Controller-1',
    type: 'Controller',
    status: 'degraded',
    lastHeartbeat: '2026-10-05T10:25:00Z',
    assetCount: 9,
    assets: [
      { id: 'ch-001', name: 'Chiller 1', type: 'chiller', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: '7.2°C', hasAlarm: false },
      { id: 'ch-002', name: 'Chiller 2', type: 'chiller', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: '7.5°C', hasAlarm: true },
      { id: 'ch-003', name: 'Chiller 3', type: 'chiller', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: '7.8°C', hasAlarm: false },
      { id: 'pump-001', name: 'CHW Pump 1', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Running', hasAlarm: false },
      { id: 'pump-002', name: 'CHW Pump 2', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'degraded', lastValue: 'Running', hasAlarm: true },
      { id: 'pump-003', name: 'CHW Pump 3', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Standby', hasAlarm: false },
      { id: 'pump-004', name: 'CHW Pump 4', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Standby', hasAlarm: false },
      { id: 'pump-005', name: 'CHW Pump 5', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Running', hasAlarm: false },
    ],
    coverage: 87.5,
    alarms: 2,
    criticalAlarms: 0
  },
  {
    id: 'CTRL-002',
    name: 'Controller-2',
    type: 'Controller',
    status: 'online',
    lastHeartbeat: '2026-10-05T10:28:00Z',
    assetCount: 8,
    assets: [
      { id: 'ct-001', name: 'Cooling Tower 1', type: 'coolingTower', zone: 'Plant Room', floor: 'Roof', status: 'online', lastValue: '4.1°C', hasAlarm: true },
      { id: 'ct-002', name: 'Cooling Tower 2', type: 'coolingTower', zone: 'Plant Room', floor: 'Roof', status: 'online', lastValue: '4.0°C', hasAlarm: false },
      { id: 'ct-003', name: 'Cooling Tower 3', type: 'coolingTower', zone: 'Plant Room', floor: 'Roof', status: 'online', lastValue: '3.9°C', hasAlarm: false },
      { id: 'ct-004', name: 'Cooling Tower 4', type: 'coolingTower', zone: 'Plant Room', floor: 'Roof', status: 'online', lastValue: '4.2°C', hasAlarm: false },
      { id: 'cp-001', name: 'Condenser Pump 1', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Running', hasAlarm: false },
      { id: 'cp-002', name: 'Condenser Pump 2', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Running', hasAlarm: false },
      { id: 'cp-003', name: 'Condenser Pump 3', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Standby', hasAlarm: false },
      { id: 'cp-004', name: 'Condenser Pump 4', type: 'pump', zone: 'Plant Room', floor: 'B1', status: 'online', lastValue: 'Standby', hasAlarm: false },
    ],
    coverage: 100,
    alarms: 1,
    criticalAlarms: 0
  },
  {
    id: 'CTRL-005',
    name: 'Controller-5',
    type: 'Controller',
    status: 'offline',
    lastHeartbeat: '2026-10-05T08:12:00Z',
    assetCount: 37,
    assets: [
      { id: 'fcu-001', name: 'FCU-5F-01', type: 'fcu', zone: 'Patient Ward', floor: '5F', status: 'offline', hasAlarm: true },
      { id: 'fcu-002', name: 'FCU-5F-02', type: 'fcu', zone: 'Patient Ward', floor: '5F', status: 'online', lastValue: '23.1°C', hasAlarm: false },
      { id: 'fcu-003', name: 'FCU-5F-03', type: 'fcu', zone: 'Patient Ward', floor: '5F', status: 'online', lastValue: '22.8°C', hasAlarm: false },
      { id: 'ahu-001', name: 'AHU-1', type: 'ahu', zone: 'ICU/Critical Care', floor: '3F', status: 'online', lastValue: '13.9°C', hasAlarm: true },
      { id: 'ahu-002', name: 'AHU-2', type: 'ahu', zone: 'Patient Ward', floor: '5F', status: 'online', lastValue: '14.2°C', hasAlarm: false },
    ],
    coverage: 7.1,
    alarms: 3,
    criticalAlarms: 2
  },
  {
    id: 'CTRL-025',
    name: 'Controller-25',
    type: 'Controller',
    status: 'online',
    lastHeartbeat: '2026-10-05T10:28:00Z',
    assetCount: 12,
    assets: [
      { id: 'panel-001', name: 'LT Panel 1', type: 'panel', zone: 'Utility/Electrical', floor: 'B1', status: 'online', lastValue: '415V', hasAlarm: false },
      { id: 'panel-002', name: 'Emergency Panel', type: 'panel', zone: 'Utility/Electrical', floor: 'B1', status: 'online', lastValue: '415V', hasAlarm: false },
      { id: 'ups-001', name: 'UPS-1', type: 'ups', zone: 'Utility/Electrical', floor: 'B1', status: 'online', lastValue: '98%', hasAlarm: false },
      { id: 'apfc-001', name: 'APFC-1', type: 'apfc', zone: 'Utility/Electrical', floor: 'B1', status: 'online', lastValue: '0.92', hasAlarm: false },
    ],
    coverage: 100,
    alarms: 0,
    criticalAlarms: 0
  }
];
