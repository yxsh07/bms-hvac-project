// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic gate).
export const AUDIT_ENTRIES = [
  { id: 'aud1', time: '2026-10-05 10:15:23', user: 'engineer@bms.local', action: 'SETPOINT_PROPOSED', resource: 'Chiller 1 / CHW Setpoint', details: '7.0°C → 6.5°C', status: 'PENDING', verified: true },
  { id: 'aud2', time: '2026-10-05 10:18:45', user: 'manager@bms.local', action: 'SETPOINT_APPROVED', resource: 'Chiller 1 / CHW Setpoint', details: 'Approved 6.5°C', status: 'APPROVED', verified: true },
  { id: 'aud3', time: '2026-10-05 10:19:12', user: 'system', action: 'GATEWAY_WRITE', resource: 'Chiller 1 / CHW Setpoint', details: 'Write 6.5°C, idempotency-key: abc123', status: 'APPLYING', verified: true },
  { id: 'aud4', time: '2026-10-05 10:19:28', user: 'system', action: 'GATEWAY_READBACK', resource: 'Chiller 1 / CHW Setpoint', details: 'Read-back 6.5°C ✓', status: 'APPLIED', verified: true },
  { id: 'aud5', time: '2026-10-05 09:30:00', user: 'operator@bms.local', action: 'PERMISSION_DENIED', resource: 'Set-point Propose', details: 'Operator role lacks setpoint:propose', status: 'DENIED', verified: true },
  { id: 'aud6', time: '2026-10-05 08:45:11', user: 'engineer@bms.local', action: 'LOGIN', resource: 'Authentication', details: 'Success, IP: 192.168.1.45', status: 'SUCCESS', verified: true },
];
