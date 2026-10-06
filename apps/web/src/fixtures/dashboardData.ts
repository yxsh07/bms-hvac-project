// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic
// gate). Production UI must bind to ontology roles, never to these literals.
import type { Asset, PointValue, PointDefinition, TelemetrySeriesPoint, QualityCode } from '../types/telemetry';

export const MOCK_ASSETS: Asset[] = [
  { id: 'ch-001', name: 'Chiller 1', type: 'chiller', zone: 'Plant Room', floor: 'B1', criticality: 'Critical', pointRoles: { 'run-status': 'ch1_status', 'fault-alarm': 'ch1_alarm', 'power-kw': 'ch1_kw', 'chw-leaving-temp': 'ch1_lwt' } },
  { id: 'ch-002', name: 'Chiller 2', type: 'chiller', zone: 'Plant Room', floor: 'B1', criticality: 'Critical', pointRoles: { 'run-status': 'ch2_status', 'fault-alarm': 'ch2_alarm', 'power-kw': 'ch2_kw', 'chw-leaving-temp': 'ch2_lwt' } },
  { id: 'ch-003', name: 'Chiller 3', type: 'chiller', zone: 'Plant Room', floor: 'B1', criticality: 'Critical', pointRoles: { 'run-status': 'ch3_status', 'fault-alarm': 'ch3_alarm', 'power-kw': 'ch3_kw', 'chw-leaving-temp': 'ch3_lwt' } },
  { id: 'ct-001', name: 'Cooling Tower 1', type: 'coolingTower', zone: 'Plant Room', floor: 'Roof', criticality: 'High', pointRoles: { 'run-status': 'ct1_status', 'fault-alarm': 'ct1_alarm', 'power-kw': 'ct1_kw' } },
  { id: 'ct-002', name: 'Cooling Tower 2', type: 'coolingTower', zone: 'Plant Room', floor: 'Roof', criticality: 'High', pointRoles: { 'run-status': 'ct2_status', 'fault-alarm': 'ct2_alarm', 'power-kw': 'ct2_kw' } },
  { id: 'ahu-001', name: 'AHU-1 (Critical)', type: 'ahu', zone: 'ICU/Critical Care', floor: '3F', criticality: 'Critical', pointRoles: { 'run-status': 'ahu1_status', 'fault-alarm': 'ahu1_alarm', 'supply-air-temp': 'ahu1_sat', 'return-air-temp': 'ahu1_rat', 'valve-position': 'ahu1_valve' } },
  { id: 'ahu-002', name: 'AHU-2', type: 'ahu', zone: 'Patient Ward', floor: '5F', criticality: 'High', pointRoles: { 'run-status': 'ahu2_status', 'fault-alarm': 'ahu2_alarm', 'supply-air-temp': 'ahu2_sat', 'return-air-temp': 'ahu2_rat', 'valve-position': 'ahu2_valve' } },
  { id: 'fcu-001', name: 'FCU-5F-01', type: 'fcu', zone: 'Patient Ward', floor: '5F', criticality: 'Normal', pointRoles: { 'run-status': 'fcu1_status', 'area-temp': 'fcu1_temp', 'valve-position': 'fcu1_valve' } },
  { id: 'fcu-002', name: 'FCU-5F-02', type: 'fcu', zone: 'Patient Ward', floor: '5F', criticality: 'Normal', pointRoles: { 'run-status': 'fcu2_status', 'area-temp': 'fcu2_temp', 'valve-position': 'fcu2_valve' } },
  { id: 'pump-001', name: 'CHW Pump 1', type: 'pump', zone: 'Plant Room', floor: 'B1', criticality: 'High', pointRoles: { 'run-status': 'pump1_status', 'power-kw': 'pump1_kw', 'chw-flow': 'pump1_flow' } },
];

export const MOCK_POINT_DEFINITIONS: Record<string, PointDefinition> = {
  ch1_status: { abbreviation: 'ch1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ch1_alarm: { abbreviation: 'ch1_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ch1_kw: { abbreviation: 'ch1_kw', displayName: 'Active Power', unit: 'kW', group: 'Power', classification: 'Power', writable: false, source: 'component' },
  ch1_lwt: { abbreviation: 'ch1_lwt', displayName: 'Leaving Water Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ch2_status: { abbreviation: 'ch2_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ch2_alarm: { abbreviation: 'ch2_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ch2_kw: { abbreviation: 'ch2_kw', displayName: 'Active Power', unit: 'kW', group: 'Power', classification: 'Power', writable: false, source: 'component' },
  ch2_lwt: { abbreviation: 'ch2_lwt', displayName: 'Leaving Water Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ch3_status: { abbreviation: 'ch3_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ch3_alarm: { abbreviation: 'ch3_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ch3_kw: { abbreviation: 'ch3_kw', displayName: 'Active Power', unit: 'kW', group: 'Power', classification: 'Power', writable: false, source: 'component' },
  ch3_lwt: { abbreviation: 'ch3_lwt', displayName: 'Leaving Water Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ct1_status: { abbreviation: 'ct1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ct1_alarm: { abbreviation: 'ct1_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ct1_kw: { abbreviation: 'ct1_kw', displayName: 'Fan Power', unit: 'kW', group: 'Power', classification: 'Power', writable: false, source: 'component' },
  ct2_status: { abbreviation: 'ct2_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ct2_alarm: { abbreviation: 'ct2_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ct2_kw: { abbreviation: 'ct2_kw', displayName: 'Fan Power', unit: 'kW', group: 'Power', classification: 'Power', writable: false, source: 'component' },
  ahu1_status: { abbreviation: 'ahu1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ahu1_alarm: { abbreviation: 'ahu1_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ahu1_sat: { abbreviation: 'ahu1_sat', displayName: 'Supply Air Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ahu1_rat: { abbreviation: 'ahu1_rat', displayName: 'Return Air Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ahu1_valve: { abbreviation: 'ahu1_valve', displayName: 'Valve Position', unit: '%', group: 'Actuator', classification: 'Actuator', writable: false, source: 'component' },
  ahu2_status: { abbreviation: 'ahu2_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  ahu2_alarm: { abbreviation: 'ahu2_alarm', displayName: 'Fault Alarm', unit: '', group: 'Alarm', classification: 'Alarm', writable: false, source: 'component' },
  ahu2_sat: { abbreviation: 'ahu2_sat', displayName: 'Supply Air Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ahu2_rat: { abbreviation: 'ahu2_rat', displayName: 'Return Air Temp', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  ahu2_valve: { abbreviation: 'ahu2_valve', displayName: 'Valve Position', unit: '%', group: 'Actuator', classification: 'Actuator', writable: false, source: 'component' },
  fcu1_status: { abbreviation: 'fcu1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  fcu1_temp: { abbreviation: 'fcu1_temp', displayName: 'Room Temperature', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  fcu1_valve: { abbreviation: 'fcu1_valve', displayName: 'Valve Position', unit: '%', group: 'Actuator', classification: 'Actuator', writable: false, source: 'component' },
  fcu2_status: { abbreviation: 'fcu2_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  fcu2_temp: { abbreviation: 'fcu2_temp', displayName: 'Room Temperature', unit: '°C', group: 'Temperature', classification: 'Temperature', writable: false, source: 'component' },
  fcu2_valve: { abbreviation: 'fcu2_valve', displayName: 'Valve Position', unit: '%', group: 'Actuator', classification: 'Actuator', writable: false, source: 'component' },
  pump1_status: { abbreviation: 'pump1_status', displayName: 'Run Status', unit: '', group: 'Status', classification: 'Status', writable: false, source: 'component' },
  pump1_kw: { abbreviation: 'pump1_kw', displayName: 'Power', unit: 'kW', group: 'Power', classification: 'Power', writable: false, source: 'component' },
  pump1_flow: { abbreviation: 'pump1_flow', displayName: 'CHW Flow', unit: 'L/s', group: 'Flow', classification: 'Flow', writable: false, source: 'component' },
};

export function generateMockTelemetry(): Record<string, Record<string, PointValue>> {
  const telemetry: Record<string, Record<string, PointValue>> = {};
  const now = Date.now();

  MOCK_ASSETS.forEach(asset => {
    telemetry[asset.id] = {};
    Object.entries(asset.pointRoles || {}).forEach(([role, abbr]) => {
      const def = MOCK_POINT_DEFINITIONS[abbr];
      if (!def) return;

      let value: number | null = null;
      let quality: QualityCode = 0;

      switch (def.classification) {
        case 'Status':
          value = Math.random() > 0.1 ? 1 : 0;
          break;
        case 'Alarm':
          value = Math.random() > 0.95 ? 1 : 0;
          if (value === 1) quality = 2;
          break;
        case 'Power':
          value = def.abbreviation.includes('ch') ? 45 + Math.random() * 30 :
                  def.abbreviation.includes('ct') ? 5 + Math.random() * 8 :
                  12 + Math.random() * 5;
          break;
        case 'Temperature':
          value = def.abbreviation.includes('lwt') || def.abbreviation.includes('sat') ? 7 + Math.random() * 3 :
                  def.abbreviation.includes('rat') ? 20 + Math.random() * 3 :
                  22 + Math.random() * 4;
          break;
        case 'Actuator':
          value = 20 + Math.random() * 60;
          break;
        case 'Flow':
          value = 30 + Math.random() * 20;
          break;
        default:
          value = Math.random() * 100;
      }

      if (Math.random() < 0.02) {
        quality = (Math.floor(Math.random() * 4) + 1) as QualityCode;
        value = null;
      }

      telemetry[asset.id][abbr] = {
        value,
        quality,
        timestamp: new Date(now - Math.random() * 300000).toISOString(),
        isDelayed: Math.random() < 0.01
      };
    });
  });

  return telemetry;
}

export function generateMockHistorical(): Record<string, TelemetrySeriesPoint[]> {
  const historical: Record<string, TelemetrySeriesPoint[]> = {};
  const now = Date.now();

  Object.keys(MOCK_POINT_DEFINITIONS).forEach(abbr => {
    const def = MOCK_POINT_DEFINITIONS[abbr];
    const points: TelemetrySeriesPoint[] = [];

    for (let i = 0; i < 120; i++) {
      const time = new Date(now - (119 - i) * 60000).toISOString();
      let value: number | null = null;

      switch (def.classification) {
        case 'Power':
          value = def.abbreviation.includes('ch') ? 45 + Math.random() * 30 + Math.sin(i * 0.1) * 10 :
                  def.abbreviation.includes('ct') ? 5 + Math.random() * 8 :
                  12 + Math.random() * 5;
          break;
        case 'Temperature':
          value = def.abbreviation.includes('lwt') || def.abbreviation.includes('sat') ? 7 + Math.random() * 3 + Math.sin(i * 0.05) * 1 :
                  def.abbreviation.includes('rat') ? 20 + Math.random() * 3 :
                  22 + Math.random() * 4;
          break;
        case 'Actuator':
          value = 20 + Math.random() * 60 + Math.sin(i * 0.08) * 20;
          break;
        case 'Flow':
          value = 30 + Math.random() * 20;
          break;
        default:
          value = Math.random() * 100;
      }

      if (Math.random() < 0.02) {
        value = null;
      }

      points.push({
        time,
        value,
        quality: value === null ? 1 : 0,
        n: 60
      });
    }

    historical[abbr] = points;
  });

  return historical;
}
