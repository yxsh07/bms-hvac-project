// Development fixtures for the Dashboard tab placeholders (PLAN §2.5: fixtures
// are excluded from the site-agnostic gate).
export const ALARM_PLACEHOLDER = [
  { id: 'a1', asset: 'AHU-1 (Critical)', point: 'High Return Air Humidity', value: '78%', severity: 'critical', time: '10:23', acknowledged: false },
  { id: 'a2', asset: 'Chiller 2', point: 'High Condenser Pressure', value: '18.5 bar', severity: 'warning', time: '09:45', acknowledged: true },
  { id: 'a3', asset: 'FCU-5F-01', point: 'Communication Lost', value: '—', severity: 'critical', time: '08:12', acknowledged: false },
];

export const SETPOINT_PLACEHOLDER = [
  { id: 'sp1', asset: 'Chiller 1', point: 'CHW Setpoint', current: '7.0°C', requested: '6.5°C', status: 'PENDING', requester: 'Engineer', time: '10:15' },
  { id: 'sp2', asset: 'AHU-1', point: 'Supply Air Temp', current: '13.0°C', requested: '12.5°C', status: 'APPLIED', requester: 'Engineer', time: '08:30' },
  { id: 'sp3', asset: 'Chiller 2', point: 'CHW Setpoint', current: '7.0°C', requested: '6.8°C', status: 'FAILED', requester: 'Manager', time: 'Yesterday' },
];
