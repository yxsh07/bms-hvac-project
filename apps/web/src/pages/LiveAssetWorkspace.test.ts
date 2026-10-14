import { describe, expect, it } from 'vitest';
import { parameterState } from './LiveAssetWorkspace';

describe('equipment reading state', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  it('keeps bad readings distinguishable from missing and stale readings', () => {
    expect(parameterState(2, '2026-10-14T11:59:59Z', undefined, now)).toBe('Out of range');
    expect(parameterState(0, '2026-10-14T11:55:00Z', undefined, now)).toBe('Stale');
    expect(parameterState(0, '2026-07-12T00:06:00Z', undefined, Date.parse('2026-07-12T00:06:00Z'))).toBe('Good');
    expect(parameterState(undefined, undefined)).toBe('No reading');
    expect(parameterState(undefined, undefined, 'not available at this site')).toBe('not available at this site');
  });
});
