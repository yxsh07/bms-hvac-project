// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic
// gate). Generic asset types only, placed in the L2 plant coordinate space.

export interface PlantNodeFixture {
  id: string;
  kind: 'equipment' | 'header' | 'sensor';
  label: string;
  type?: string;
  x: number;
  y: number;
  role?: string;
  value?: number;
  unit?: string;
}

export interface PlantEdgeFixture {
  id: string;
  from: string;
  to: string;
  medium: 'chilled' | 'condenser' | 'other';
}

export const PLANT_VIEWBOX = [0, 0, 920, 440] as const;

export const MOCK_PLANT: { nodes: PlantNodeFixture[]; edges: PlantEdgeFixture[] } = {
  nodes: [
    { id: 't1', kind: 'equipment', label: 'Tower 1', type: 'tower', x: 120, y: 60 },
    { id: 't2', kind: 'equipment', label: 'Tower 2', type: 'tower', x: 240, y: 60 },
    { id: 'cp1', kind: 'equipment', label: 'Cond P1', type: 'pump', x: 120, y: 150 },
    { id: 'cp2', kind: 'equipment', label: 'Cond P2', type: 'pump', x: 240, y: 150 },
    { id: 'h-cond', kind: 'header', label: 'Condenser water', x: 60, y: 200 },
    { id: 'c1', kind: 'equipment', label: 'Chiller 1', type: 'chiller', x: 120, y: 285 },
    { id: 'c2', kind: 'equipment', label: 'Chiller 2', type: 'chiller', x: 280, y: 285 },
    { id: 'c3', kind: 'equipment', label: 'Chiller 3', type: 'chiller', x: 440, y: 285 },
    { id: 'p1', kind: 'equipment', label: 'CHW P1', type: 'pump', x: 120, y: 385 },
    { id: 'p2', kind: 'equipment', label: 'CHW P2', type: 'pump', x: 280, y: 385 },
    { id: 'h-chw', kind: 'header', label: 'CHW supply', x: 60, y: 250 },
    { id: 's-chw', kind: 'sensor', label: 'CHWST', role: 'chw-leaving-temp', x: 620, y: 285, value: 7.9, unit: '°C' },
    { id: 's-dt', kind: 'sensor', label: 'ΔT', role: 'chw-delta-t', x: 760, y: 285, value: 3.1, unit: 'K' },
    { id: 's-kw', kind: 'sensor', label: 'kW', role: 'power-kw', x: 690, y: 170, value: 41.2, unit: 'kW' },
  ],
  edges: [
    { id: 'e1', from: 't1', to: 'cp1', medium: 'condenser' },
    { id: 'e2', from: 't2', to: 'cp2', medium: 'condenser' },
    { id: 'e3', from: 'cp1', to: 'h-cond', medium: 'condenser' },
    { id: 'e4', from: 'cp2', to: 'h-cond', medium: 'condenser' },
    { id: 'e5', from: 'h-cond', to: 'c1', medium: 'condenser' },
    { id: 'e6', from: 'h-cond', to: 'c2', medium: 'condenser' },
    { id: 'e7', from: 'c1', to: 'h-chw', medium: 'chilled' },
    { id: 'e8', from: 'c2', to: 'h-chw', medium: 'chilled' },
    { id: 'e9', from: 'c3', to: 'h-chw', medium: 'chilled' },
    { id: 'e10', from: 'h-chw', to: 'p1', medium: 'chilled' },
    { id: 'e11', from: 'h-chw', to: 'p2', medium: 'chilled' },
    { id: 'e12', from: 'p1', to: 's-chw', medium: 'chilled' },
    { id: 'e13', from: 'p2', to: 's-chw', medium: 'chilled' },
  ],
};

export const MEDIUM_STROKE: Record<PlantEdgeFixture['medium'], string> = {
  chilled: 'var(--color-semantic-chilled)',
  condenser: 'var(--color-semantic-condenser)',
  other: 'var(--color-border-strong)',
};

/**
 * Logical simulator targets (PLAN 6.8, DEC-13). Kept in fixtures so the UI
 * references a logical name rather than a concrete, site-specific asset id.
 */
export const PLANT_TARGETS = {
  lead: 'lead-chiller',
  standby: 'standby-chiller',
} as const;

/** Baseline plant KPIs shown before a what-if is run. */
export const MOCK_LIVE_KPIS = {
  kw: 41.2,
  deltaTC: 3.1,
  at: '2026-07-12T00:00:00Z',
};
