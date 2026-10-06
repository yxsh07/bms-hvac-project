import { describe, expect, it } from 'vitest';
import { classifyPoint, resolveRoleAbbrev, EMPTY_POINT_ROLES } from '../src/domain/classify.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { signToken, verifyToken, TokenExpiredError, TokenInvalidError, newJti } from '../src/auth/jwt.js';
import { Actions, auditDenial, can, permissionsFor } from '../src/auth/rbac.js';
import { MemoryStore } from '../src/store/memory.js';

describe('classifyPoint', () => {
  const cases: Array<[string, string, ReturnType<typeof classifyPoint>]> = [
    ['chilled-water-supply-temp', '°C', 'Temperature'],
    ['differential-pressure', 'kPa', 'Pressure'],
    ['condenser-water-flow', 'm³/h', 'Flow Sensor'],
    ['power', 'kW', 'Power'],
    ['energy-kwh', 'kWh', 'Energy'],
    ['run-status', '', 'Status'],
    ['fault-alarm', '', 'Status'],
    ['setpoint-chw-temp', '°C', 'Setpoint'],
    ['valve-position', '%', 'Actuator'],
    ['fan-speed', '%', 'Actuator'],
    ['area-humidity', '%', 'Humidity'],
    ['loading-percentage', '%', 'Other'],
    ['cop', '', 'Other'],
  ];

  it.each(cases)('classifies %s as %s', (cls, unit, expected) => {
    expect(classifyPoint({ cls, unit })).toBe(expected);
  });

  it('prefers setpoint over the temp suffix', () => {
    expect(classifyPoint({ cls: 'setpoint-chw-temp' })).toBe('Setpoint');
  });

  it('classifies by role when provided', () => {
    expect(classifyPoint({ role: 'area-temp' })).toBe('Temperature');
    expect(classifyPoint({ role: 'energy-kwh' })).toBe('Energy');
  });
});

describe('resolveRoleAbbrev', () => {
  const roles = {
    byType: { alpha: { 'run-status': 'RUN', 'energy-kwh': 'KWH' } },
    fallbackRules: [{ classificationContains: 'humidity', role: 'area-humidity' }],
  };

  it('resolves from byType', () => {
    expect(resolveRoleAbbrev(roles, 'alpha', 'run-status')).toBe('RUN');
  });

  it('falls back to rules with point metadata', () => {
    const abbr = resolveRoleAbbrev(roles, 'missing-type', 'area-humidity', {
      HUM: { classification: 'area-humidity', unit: '%', displayName: 'Humidity' },
    });
    expect(abbr).toBe('HUM');
  });

  it('returns null and never throws when unavailable', () => {
    expect(resolveRoleAbbrev(EMPTY_POINT_ROLES, 'alpha', 'chw-flow')).toBeNull();
  });
});

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});

describe('jwt', () => {
  const secret = 'test-secret';
  const claims = {
    sub: 'u1',
    name: 'User',
    email: 'u@example.com',
    roles: { s: 'admin' as const },
    siteIds: ['s'],
    jti: newJti(),
  };

  it('round-trips an access token', () => {
    const token = signToken(claims, secret, { expiresInSeconds: 900, tokenType: 'access' });
    const payload = verifyToken(token, secret);
    expect(payload.sub).toBe('u1');
    expect(payload.typ).toBe('access');
  });

  it('rejects a tampered signature', () => {
    const token = signToken(claims, secret, { expiresInSeconds: 900 });
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => verifyToken(tampered, secret)).toThrow(TokenInvalidError);
  });

  it('rejects an expired token', () => {
    const token = signToken(claims, secret, { expiresInSeconds: -10 });
    expect(() => verifyToken(token, secret)).toThrow(TokenExpiredError);
  });

  it('rejects a token signed with another key', () => {
    const token = signToken(claims, 'other', { expiresInSeconds: 900 });
    expect(() => verifyToken(token, secret)).toThrow(TokenInvalidError);
  });
});

describe('rbac matrix (§7.7)', () => {
  it('grants/denies per role', () => {
    expect(can('admin', Actions.usersManage)).toBe(true);
    expect(can('admin', Actions.setpointsApprove)).toBe(true);
    expect(can('engineer', Actions.setpointsPropose)).toBe(true);
    expect(can('engineer', Actions.setpointsApprove)).toBe(false);
    expect(can('facility-manager', Actions.setpointsApprove)).toBe(true);
    expect(can('facility-manager', Actions.setpointsPropose)).toBe(false);
    expect(can('operator', Actions.alarmsAcknowledge)).toBe(true);
    expect(can('operator', Actions.reportsExport)).toBe(false);
    expect(can('operator', Actions.auditRead)).toBe(false);
    expect(can('executive', Actions.alarmsAcknowledge)).toBe(false);
    expect(can('executive', Actions.auditRead)).toBe(true);
    expect(can('executive', Actions.auditExport)).toBe(false);
    expect(can('unknown-role', Actions.telemetryRead)).toBe(false);
  });

  it('lists permissions per role', () => {
    expect(permissionsFor('executive')).toContain(Actions.reportsExport);
    expect(permissionsFor('bogus')).toEqual([]);
  });

  it('audits every denial', async () => {
    const store = new MemoryStore({ auditKey: 'k' });
    await auditDenial(store, {
      siteId: 's',
      actorId: 'u1',
      actorEmail: 'u@example.com',
      role: 'operator',
      action: Actions.auditExport,
      resource: '/audit/export',
    });
    const page = await store.listAudit('s', {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0].eventType).toBe('authz.denied');
    expect(page.items[0].action).toBe(Actions.auditExport);
    expect((await store.verifyAudit('s')).valid).toBe(true);
  });
});
