import { describe, expect, it } from 'vitest';
import { clampPercent, formatScale, formatSimClock, ingestHealth, nextScale } from './format';

describe('formatSimClock', () => {
  it('renders HH:MM in UTC and handles junk', () => {
    expect(formatSimClock('2026-07-12T04:05:00Z')).toBe('04:05');
    expect(formatSimClock('not-a-date')).toBe('--:--');
    expect(formatSimClock(null)).toBe('--:--');
  });
});

describe('formatScale', () => {
  it('renders integer and fractional scales', () => {
    expect(formatScale(1)).toBe('1×');
    expect(formatScale(600)).toBe('600×');
    expect(formatScale(60.555)).toBe('60.56×');
    expect(formatScale(0)).toBe('—');
  });
});

describe('ingestHealth', () => {
  it('flags high lag and missing data', () => {
    expect(ingestHealth(0)).toBe('healthy');
    expect(ingestHealth(30)).toBe('healthy');
    expect(ingestHealth(31)).toBe('throttle');
    expect(ingestHealth(null)).toBe('unknown');
  });
});

describe('nextScale', () => {
  it('walks the ladder and wraps', () => {
    expect(nextScale(1)).toBe(60);
    expect(nextScale(60)).toBe(600);
    expect(nextScale(600)).toBe(1);
  });
});

describe('clampPercent', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});
