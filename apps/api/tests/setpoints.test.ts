import { beforeEach, describe, expect, it } from 'vitest';
import {
  fakeClock,
  FakeGateway,
  makeContext,
  makeService,
  type TestContext,
} from './helpers.js';
import type { SetpointService } from '../src/services/setpoints.js';

const SITE = 'simsite-hospital';
const actor = (id: string) => ({ id, email: `${id}@example.com`, ip: '127.0.0.1', device: 'vitest' });

describe('set-point state machine (§7.6)', () => {
  let ctx: TestContext;
  let gateway: FakeGateway;
  let clock: ReturnType<typeof fakeClock>;
  let service: SetpointService;

  beforeEach(async () => {
    ctx = await makeContext();
    gateway = new FakeGateway('ok');
    clock = fakeClock();
    service = makeService({ store: ctx.store, config: ctx.config, ontology: ctx.ontology, gateway, clock });
  });

  it('rejects a proposal without a justification', async () => {
    await expect(
      service.propose(actor('e1'), SITE, 'chiller-01', 'CHWSSP', { value: 8, justification: '  ' }),
    ).rejects.toMatchObject({ status: 400, code: 'MISSING_JUSTIFICATION' });
  });

  it('rejects a value outside the safe range', async () => {
    await expect(
      service.propose(actor('e1'), SITE, 'chiller-01', 'CHWSSP', { value: 50, justification: 'too hot' }),
    ).rejects.toMatchObject({ status: 422, code: 'VALUE_OUT_OF_RANGE' });
  });

  it('rejects at proposal time when the control mode is Local', async () => {
    const local = makeService({
      store: ctx.store,
      config: ctx.config,
      ontology: ctx.ontology,
      gateway,
      clock,
      controlMode: async () => 'Local',
    });
    await expect(
      local.propose(actor('e1'), SITE, 'chiller-01', 'CHWSSP', { value: 8, justification: 'ok' }),
    ).rejects.toMatchObject({ status: 422, code: 'CONTROL_MODE_BLOCKED' });
  });

  it('enforces one live request per point with a 409 and the existing id', async () => {
    const first = await service.propose(actor('e1'), SITE, 'chiller-01', 'CHWSSP', {
      value: 8,
      justification: 'first',
    });
    await expect(
      service.propose(actor('e2'), SITE, 'chiller-01', 'CHWSSP', { value: 9, justification: 'second' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'SETPOINT_REQUEST_CONFLICT',
      detail: { existingRequestId: first.id },
    });
  });

  it('forbids self-approval for every role, including admin', async () => {
    const request = await service.propose(actor('admin-1'), SITE, 'chiller-01', 'CHWSSP', {
      value: 8,
      justification: 'admin proposal',
    });
    await expect(service.approve(actor('admin-1'), request.id)).rejects.toMatchObject({
      status: 422,
      code: 'SETPOINT_SELF_APPROVE',
    });
  });

  it('approves then applies and reads back within tolerance', async () => {
    gateway.values.set('chiller-01:CHWSSP', 7);
    const request = await service.propose(actor('e1'), SITE, 'chiller-01', 'CHWSSP', {
      value: 9,
      justification: 'optimise',
    });
    const approved = await service.approve(actor('fm1'), request.id);
    expect(approved.state).toBe('APPROVED');
    expect(approved.approverId).toBe('fm1');

    const transitions = await service.schedulerTick();
    expect(transitions.some((t) => t.to === 'APPLIED')).toBe(true);
    const applied = await ctx.store.getSetpoint(request.id);
    expect(applied?.state).toBe('APPLIED');
    expect(applied?.beforeValue).toBe(7);
    expect(applied?.afterValue).toBe(9);
  });

  it('fails when the gateway rejects the write', async () => {
    gateway.preset = 'reject';
    const request = await service.propose(actor('e1'), SITE, 'chiller-01', 'CHWSSP', {
      value: 9,
      justification: 'try',
    });
    await service.approve(actor('fm1'), request.id);
    await service.schedulerTick();
    const failed = await ctx.store.getSetpoint(request.id);
    expect(failed?.state).toBe('FAILED');
    expect(failed?.reason).toContain('rejection');

    const alarms = await ctx.store.listAlarms(SITE, {});
    expect(alarms.items.some((a) => a.alarmCode === 'SETPOINT_FAILED')).toBe(true);
  });

  it('stays APPLYING on a read-back mismatch, then FAILS after the 60s deadline', async () => {
    gateway.preset = 'ignore';
    gateway.values.set('ahu-01:CHVP', 10);
    const request = await service.propose(actor('e1'), SITE, 'ahu-01', 'CHVP', {
      value: 60,
      justification: 'open valve',
    });
    await service.approve(actor('fm1'), request.id);
    await service.schedulerTick();
    expect((await ctx.store.getSetpoint(request.id))?.state).toBe('APPLYING');

    clock.advance(61);
    await service.schedulerTick();
    expect((await ctx.store.getSetpoint(request.id))?.state).toBe('FAILED');
  });

  it('reverts with a verified write-back when an alarm fires in the watch window', async () => {
    gateway.values.set('ahu-02:CHVP', 20);
    const request = await service.propose(actor('e1'), SITE, 'ahu-02', 'CHVP', {
      value: 70,
      justification: 'open valve',
    });
    await service.approve(actor('fm1'), request.id);
    await service.schedulerTick();
    expect((await ctx.store.getSetpoint(request.id))?.state).toBe('APPLIED');

    gateway.alarm = true;
    await service.schedulerTick();
    const reverted = await ctx.store.getSetpoint(request.id);
    expect(reverted?.state).toBe('REVERTED');
    expect(reverted?.afterValue).toBe(20);
    expect(gateway.values.get('ahu-02:CHVP')).toBe(20);
  });

  it('rejects a pending request with a reason', async () => {
    const request = await service.propose(actor('e1'), SITE, 'chiller-02', 'CHWSSP', {
      value: 8,
      justification: 'x',
    });
    const rejected = await service.reject(actor('fm1'), request.id, 'not needed');
    expect(rejected.state).toBe('REJECTED');
    expect(rejected.reason).toBe('not needed');
  });

  it('expires a pending request after 24 hours', async () => {
    const request = await service.propose(actor('e1'), SITE, 'chiller-02', 'CHWSSP', {
      value: 8,
      justification: 'x',
    });
    clock.advance(25 * 3600);
    await service.schedulerTick();
    const expired = await ctx.store.getSetpoint(request.id);
    expect(expired?.state).toBe('REJECTED');
    expect(expired?.reason).toBe('expired');
  });

  it('rejects an invalid transition', async () => {
    const request = await service.propose(actor('e1'), SITE, 'fcu-01', 'RATSP', {
      value: 22,
      justification: 'x',
    });
    await service.approve(actor('fm1'), request.id);
    await expect(service.reject(actor('fm1'), request.id, 'late')).rejects.toMatchObject({
      status: 409,
      code: 'SETPOINT_INVALID_TRANSITION',
    });
  });

  it('audits every transition in the chain', async () => {
    const request = await service.propose(actor('e1'), SITE, 'fcu-02', 'RATSP', {
      value: 22,
      justification: 'x',
    });
    await service.approve(actor('fm1'), request.id);
    await service.schedulerTick();

    const page = await ctx.store.listAudit(SITE, {});
    const types = page.items.map((e) => e.eventType);
    expect(types).toContain('setpoint.proposed');
    expect(types).toContain('setpoint.approved');
    expect(types).toContain('setpoint.applying');
    expect(types).toContain('setpoint.applied');
    expect((await ctx.store.verifyAudit(SITE)).valid).toBe(true);
  });
});
