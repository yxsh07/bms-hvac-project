/**
 * Contract smoke tests (§7.1: contracts are the single source of truth).
 *
 * These do not test business logic — they pin the wire shapes so an accidental
 * schema edit (renaming a field, making something optional) fails fast.
 */

import { describe, expect, it } from 'vitest';
import {
  LoginRequestSchema,
  LoginResponseSchema,
  SiteSummarySchema,
  LatestResponseSchema,
  SeriesResponseSchema,
  SetpointRequestSchema,
  ProposeSetpointSchema,
  AuditLogEntrySchema,
  GatewayWriteRequestSchema,
  GatewayWriteResponseSchema,
  AlarmSchema,
  ReportRunSchema,
  ApiErrorSchema,
  ErrorCode,
  QualityCode,
  TERMINAL_SETPOINT_STATES,
  LIVE_SETPOINT_STATES,
  WHATIF_LABEL,
  WhatIfRequestSchema,
  WhatIfResponseSchema,
} from './index.js';

describe('auth contracts', () => {
  it('accepts a valid login request and rejects a bad email', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  it('parses a login response', () => {
    const parsed = LoginResponseSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('site summary', () => {
  it('requires id, name and timezone only', () => {
    const parsed = SiteSummarySchema.safeParse({
      id: 'simsite-hospital',
      name: 'Simulation Hospital',
      timezone: 'Asia/Kolkata',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('telemetry contracts', () => {
  it('carries a quality block on latest', () => {
    const parsed = LatestResponseSchema.safeParse({
      fields: { RUN: { value: 1, at: '2026-07-12T00:00:00Z', quality: 0 } },
      quality: { expectedSamples: 60, goodSamples: 60, coveragePct: 100, hasDelayedData: false },
    });
    expect(parsed.success).toBe(true);
  });

  it('requires sample count n on every series bucket', () => {
    const good = SeriesResponseSchema.safeParse({
      field: 'CHWST',
      resolution: '1h',
      buckets: [{ t: '2026-07-12T00:00:00Z', avg: 7.1, min: 6.9, max: 7.3, n: 60 }],
      quality: { expectedSamples: 60, goodSamples: 60, coveragePct: 100, hasDelayedData: false },
    });
    expect(good.success).toBe(true);

    const missingN = SeriesResponseSchema.safeParse({
      field: 'CHWST',
      resolution: '1h',
      buckets: [{ t: '2026-07-12T00:00:00Z', avg: 7.1, min: 6.9, max: 7.3 }],
      quality: { expectedSamples: 60, goodSamples: 60, coveragePct: 100, hasDelayedData: false },
    });
    expect(missingN.success).toBe(false);
  });

  it('exposes the documented quality codes', () => {
    expect(QualityCode).toEqual({ OK: 0, SENTINEL: 1, OUT_OF_RANGE: 2, STOPPED_EQUIPMENT: 3, INCONSISTENT: 4 });
  });
});

describe('setpoint state machine', () => {
  it('classifies terminal and live states correctly', () => {
    expect([...TERMINAL_SETPOINT_STATES].sort()).toEqual(['FAILED', 'REJECTED', 'REVERTED']);
    expect([...LIVE_SETPOINT_STATES].sort()).toEqual(['APPLYING', 'APPROVED', 'PENDING']);
  });

  it('requires a justification and a value to propose', () => {
    expect(ProposeSetpointSchema.safeParse({ value: 7, justification: '' }).success).toBe(false);
    expect(ProposeSetpointSchema.safeParse({ value: 7, justification: 'trim load' }).success).toBe(true);
  });

  it('parses a full request record', () => {
    const parsed = SetpointRequestSchema.safeParse({
      id: 'r1',
      siteId: 'simsite-hospital',
      assetId: 'chiller-01',
      field: 'CHWSSP',
      state: 'PENDING',
      requestedValue: 7,
      beforeValue: null,
      afterValue: null,
      proposerId: 'u1',
      approverId: null,
      justification: 'trim load',
      effectiveFrom: null,
      revertAt: null,
      createdAt: '2026-07-12T00:00:00Z',
      updatedAt: '2026-07-12T00:00:00Z',
      reason: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('audit contract', () => {
  it('requires every signed field including justification and approver', () => {
    const base = {
      id: 'a1',
      siteId: 's',
      occurredAt: '2026-07-12T00:00:00Z',
      eventType: 'setpoint.approved',
      actorId: 'u2',
      actorEmail: 'u2@example.com',
      ip: '10.0.0.1',
      device: 'test',
      resource: 'setpoint-request:r1',
      action: 'approve',
      before: { state: 'PENDING' },
      after: { state: 'APPROVED' },
      justification: 'ok',
      approverId: 'u2',
      signature: 'deadbeef',
      seq: 1,
    };
    expect(AuditLogEntrySchema.safeParse(base).success).toBe(true);
    const { justification, ...without } = base;
    expect(AuditLogEntrySchema.safeParse(without).success).toBe(false);
  });
});

describe('gateway contract', () => {
  it('round-trips a write and a rejection', () => {
    expect(
      GatewayWriteRequestSchema.safeParse({
        siteId: 's',
        assetId: 'chiller-01',
        point: 'CHWSSP',
        value: 7,
        idempotencyKey: 'k1',
      }).success,
    ).toBe(true);
    expect(GatewayWriteResponseSchema.safeParse({ accepted: false, reason: 'local mode' }).success).toBe(true);
  });
});

describe('alarm and report contracts', () => {
  it('parses an alarm', () => {
    const parsed = AlarmSchema.safeParse({
      id: 'al1',
      siteId: 's',
      assetId: 'chiller-01',
      assetName: 'Chiller 1',
      field: 'RUN',
      severity: 'critical',
      status: 'active',
      message: 'trip',
      alarmCode: 'TRIP',
      raisedAt: '2026-07-12T00:00:00Z',
      clearedAt: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      acknowledgeNote: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('parses a completed report run', () => {
    const parsed = ReportRunSchema.safeParse({
      id: 'run1',
      reportKey: 'energy-summary',
      status: 'completed',
      siteId: 's',
      requestedBy: 'u1',
      requestedAt: '2026-07-12T00:00:00Z',
      startedAt: '2026-07-12T00:00:01Z',
      completedAt: '2026-07-12T00:00:02Z',
      downloadUrl: 'https://example.com/r.csv',
      contentType: 'text/csv',
      rowCount: 12,
      format: 'csv',
      errorMessage: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('error contract', () => {
  it('has a stable shape and documented codes', () => {
    expect(ApiErrorSchema.safeParse({ error: 'nope', code: ErrorCode.NOT_FOUND }).success).toBe(true);
  });
});

describe('what-if contract', () => {
  it('defaults the horizon and accepts a set-point change', () => {
    const parsed = WhatIfRequestSchema.safeParse({
      changes: [{ type: 'setpoint', target: 'lead-chiller', field: 'setpoint-chw-temp', value: 9 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.horizonMin).toBe(60);
  });

  it('rejects an unknown change type and an out-of-range horizon', () => {
    expect(WhatIfRequestSchema.safeParse({ changes: [{ type: 'teleport' }] }).success).toBe(false);
    expect(WhatIfRequestSchema.safeParse({ changes: [], horizonMin: 5000 }).success).toBe(false);
  });

  it('parses a response carrying the indicative label and an envelope warning', () => {
    const sample = {
      t: '2026-07-12T01:00:00Z',
      kw: 30,
      deltaTC: 3,
      tr: 60,
      chwLeavingC: 15,
      condenserEnteringC: 25,
    };
    const parsed = WhatIfResponseSchema.safeParse({
      label: WHATIF_LABEL,
      horizonMin: 60,
      stepMinutes: 5,
      changes: [],
      liveStateUnchanged: true,
      baseline: { meanKw: 31, peakKw: 40, meanDeltaTC: 3, points: 1 },
      predicted: { meanKw: 29, peakKw: 38, meanDeltaTC: 3, points: 1, series: [sample] },
      baselineSeries: [sample],
      delta: { meanKw: -2, meanDeltaTC: 0 },
      envelope: {
        kind: 'parametric-curve',
        trainedOnDays: 3,
        tolerancePct: 5,
        bounds: { chwLeavingC: { min: 7.1, max: 12.1 } },
        samples: 1,
        samplesOutside: 1,
        insideEnvelopePct: 0,
        exceeded: true,
        fallbackActive: true,
        breaches: ['chwLeavingC'],
        warning: 'Surrogate left its training envelope',
      },
      warning: 'Surrogate left its training envelope',
    });
    expect(parsed.success).toBe(true);
    expect(WHATIF_LABEL).toBe('indicative, 3-day calibration');
  });
});
