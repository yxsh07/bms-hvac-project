/**
 * Unit tests for packages/twin-core
 * Coverage: TwinLayout schema, resolveRole, binding-store helpers, generator stub.
 */

import { describe, it, expect } from 'vitest';
import {
  parseTwinLayout,
  TwinLayoutSchema,
  resolveRole,
  isRole,
  ROLES,
  bindingKey,
  selectBinding,
  stubGenerator,
} from '../src/index.js';
import type { PointRolesData, BindingStoreState, BindingKey } from '../src/index.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const minimalLayout = {
  version: 1,
  floors: [{ id: 'F01', name: '1F', elevation: 1, footprint: { w: 60, h: 40 }, planImage: null }],
  zones: [{ id: 'z-01', floor: 'F01', rect: [0, 0, 30, 20], spaceType: 'plant-room' }],
  anchors: { 'CHR-001': { floor: 'F01', zone: 'z-01', xy: [10, 10] } },
  plant: {
    viewBox: [0, 0, 1600, 900],
    nodes: [
      { id: 'n1', kind: 'equipment', assetId: 'CHR-001', type: 'chiller', xy: [400, 520] },
    ],
    edges: [],
  },
};

const pointRoles: PointRolesData = {
  byType: {
    chiller: {
      'chw-leaving-temp': 'CHWLT',
      'run-status': 'RS',
    },
  },
  fallbackRules: [
    { classificationContains: 'temperature', unitContains: '°c', role: 'chw-leaving-temp' },
  ],
};

// ── TwinLayout schema ─────────────────────────────────────────────────────────

describe('TwinLayoutSchema', () => {
  it('parses a minimal valid layout', () => {
    const layout = parseTwinLayout(minimalLayout);
    expect(layout.version).toBe(1);
    expect(layout.floors).toHaveLength(1);
    expect(layout.plant.nodes).toHaveLength(1);
  });

  it('rejects version other than 1', () => {
    expect(() => parseTwinLayout({ ...minimalLayout, version: 2 })).toThrow();
  });

  it('rejects missing floors', () => {
    expect(() => parseTwinLayout({ ...minimalLayout, floors: [] })).toThrow();
  });

  it('accepts schematic flag', () => {
    const layout = parseTwinLayout({ ...minimalLayout, schematic: true });
    expect(layout.schematic).toBe(true);
  });

  it('accepts plant with header node', () => {
    const layout = parseTwinLayout({
      ...minimalLayout,
      plant: {
        ...minimalLayout.plant,
        nodes: [{ id: 'h1', kind: 'header', label: 'CHW supply', xy: [200, 300], w: 1200 }],
      },
    });
    const node = layout.plant.nodes[0];
    expect(node?.kind).toBe('header');
  });

  it('rejects unknown medium on edge', () => {
    expect(() =>
      parseTwinLayout({
        ...minimalLayout,
        plant: {
          ...minimalLayout.plant,
          edges: [{ id: 'e1', from: 'n1', to: 'n2', medium: 'steam' }],
        },
      }),
    ).toThrow();
  });
});

// ── Roles ─────────────────────────────────────────────────────────────────────

describe('ROLES vocabulary', () => {
  it('contains at least the plan §5.4 required roles', () => {
    const required = ['run-status', 'fault-alarm', 'power-kw', 'chw-leaving-temp', 'area-temp'];
    for (const r of required) {
      expect(ROLES).toContain(r);
    }
  });

  it('isRole returns true for known roles', () => {
    expect(isRole('run-status')).toBe(true);
    expect(isRole('not-a-role')).toBe(false);
  });
});

describe('resolveRole', () => {
  it('step 1 – resolves via byType lookup', () => {
    const result = resolveRole(pointRoles, 'chiller', 'chw-leaving-temp');
    expect(result.abbreviation).toBe('CHWLT');
    expect(result.reason).toBeNull();
  });

  it('step 2 – falls back to fallbackRules when byType has no match', () => {
    const result = resolveRole(
      pointRoles,
      'chiller',
      'chw-leaving-temp',
      {
        'CHWLT-ALT': { abbreviation: 'CHWLT-ALT', displayName: 'CHW Leaving', classification: 'Temperature', unit: '°C' },
      },
    );
    // Step 1 still wins here (byType has a match)
    expect(result.abbreviation).toBe('CHWLT');
  });

  it('step 2 – uses fallback rules for unknown asset types', () => {
    const result = resolveRole(
      pointRoles,
      'unknown-type',
      'chw-leaving-temp',
      {
        'CHWLT-SENSOR': {
          abbreviation: 'CHWLT-SENSOR',
          displayName: 'CHW Leaving Temp',
          classification: 'temperature',
          unit: '°C',
        },
      },
    );
    expect(result.abbreviation).toBe('CHWLT-SENSOR');
    expect(result.reason).toBeNull();
  });

  it('step 3 – returns null with reason when no match', () => {
    const result = resolveRole(pointRoles, 'pump', 'cop');
    expect(result.abbreviation).toBeNull();
    expect(result.reason).toBe('not available at this site');
  });

  it('never throws for any input', () => {
    expect(() => resolveRole({ byType: {}, fallbackRules: [] }, '', '')).not.toThrow();
  });
});

// ── Binding store helpers ─────────────────────────────────────────────────────

describe('bindingKey', () => {
  it('formats as assetId.field', () => {
    expect(bindingKey('CHR-001', 'CHWLT')).toBe('CHR-001.CHWLT');
  });
});

describe('selectBinding', () => {
  const mockState: BindingStoreState = {
    bindings: {
      'CHR-001.CHWLT': { v: 6.5, q: 'GOOD', at: '2026-10-05T04:00:00Z' },
    } as Record<BindingKey, { v: number; q: 'GOOD'; at: string }>,
    applyPatch: () => {},
    markStale: () => {},
  };

  it('returns the binding entry when present', () => {
    const entry = selectBinding('CHR-001.CHWLT' as BindingKey)(mockState);
    expect(entry.v).toBe(6.5);
    expect(entry.q).toBe('GOOD');
  });

  it('returns UNAVAILABLE entry when key is absent', () => {
    const entry = selectBinding('CHR-001.MISSING' as BindingKey)(mockState);
    expect(entry.q).toBe('UNAVAILABLE');
    expect(entry.v).toBeNull();
  });
});

// ── Generator stub ────────────────────────────────────────────────────────────

describe('stubGenerator', () => {
  it('returns ok: false with a descriptive error', async () => {
    const result = await stubGenerator.generate({
      siteId: 'site-alpha',
      assets: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('site-alpha');
    }
  });
});
