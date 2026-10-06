import { describe, it, expect } from 'vitest';
import { generate, twinLayoutGenerator } from './gen_twin_layout.js';
import type { GeneratorInput } from '../packages/twin-core/src/index.js';
import { parseTwinLayout } from '../packages/twin-core/src/index.js';

describe('tools/gen_twin_layout', () => {
  const sampleInput: GeneratorInput = {
    siteId: 'site-test-1',
    assets: [
      { id: 'ct-01', type: 'cooling-tower', floorId: 'F01', zoneId: 'z-plant', classifications: ['cooling'] },
      { id: 'cp-01', type: 'condenser-pump', floorId: 'F01', zoneId: 'z-plant', classifications: ['pump'] },
      { id: 'ch-01', type: 'chiller', floorId: 'F01', zoneId: 'z-plant', classifications: ['chiller'] },
      { id: 'chwp-01', type: 'chilled-water-pump', floorId: 'F01', zoneId: 'z-plant', classifications: ['pump'] },
      { id: 'ahu-01', type: 'ahu', floorId: 'F02', zoneId: 'z-floor2', classifications: ['air'] },
    ],
    floors: [
      { id: 'F01', name: 'Basement Plant', elevation: 0 },
      { id: 'F02', name: 'Level 1', elevation: 1 },
    ],
  };

  it('implements LayoutGenerator interface', async () => {
    expect(twinLayoutGenerator.generate).toBeDefined();
    const result = await twinLayoutGenerator.generate(sampleInput);
    expect(result.ok).toBe(true);
  });

  it('generates layout with schematic: true', async () => {
    const result = await generate(sampleInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.layout.schematic).toBe(true);
    expect(result.layout.version).toBe(1);
  });

  it('validates generated layout against TwinLayoutSchema', async () => {
    const result = await generate(sampleInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // parseTwinLayout validates with zod and throws if invalid
    const parsed = parseTwinLayout(result.layout);
    expect(parsed.floors).toHaveLength(2);
    expect(parsed.zones.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(parsed.anchors)).toHaveLength(5);
  });

  it('provides a fallback for sites with no floor info', async () => {
    const inputNoFloors: GeneratorInput = {
      siteId: 'site-no-floors',
      assets: [
        { id: 'a1', type: 'chiller', classifications: [] },
        { id: 'a2', type: 'pump', classifications: [] },
      ],
    };

    const result = await generate(inputNoFloors);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.layout.floors).toHaveLength(1);
    expect(result.layout.floors[0]!.id).toBe('F00');
    expect(result.warnings.some((w) => w.code === 'UNLOCATED_ASSETS')).toBe(true);
  });

  it('orders plant nodes: cooling-towers -> condenser-pumps -> chillers -> chilled-water-pumps -> headers', async () => {
    const result = await generate(sampleInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const eqNodes = result.layout.plant.nodes.filter((n) => n.kind === 'equipment');
    const types = eqNodes.map((n) => (n as { type: string }).type);

    expect(types).toEqual(['cooling-tower', 'condenser-pump', 'chiller', 'chilled-water-pump', 'ahu']);

    // Headers are added at the end
    const headerNodes = result.layout.plant.nodes.filter((n) => n.kind === 'header');
    expect(headerNodes.length).toBe(2);
  });

  it('connects type-adjacent assets with appropriate pipe medium', async () => {
    const result = await generate(sampleInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const edges = result.layout.plant.edges;
    expect(edges.length).toBeGreaterThan(0);

    // cooling-tower -> condenser-pump should be condenser medium
    const ctToCp = edges.find((e) => e.from === 'pn-ct-01' && e.to === 'pn-cp-01');
    expect(ctToCp).toBeDefined();
    expect(ctToCp?.medium).toBe('condenser');

    // chiller -> chilled-water-pump should be chilled medium
    const chToChwp = edges.find((e) => e.from === 'pn-ch-01' && e.to === 'pn-chwp-01');
    expect(chToChwp).toBeDefined();
    expect(chToChwp?.medium).toBe('chilled');
  });

  it('respects maxPlantNodes budget and emits warning when exceeded', async () => {
    const manyAssets = Array.from({ length: 15 }, (_, i) => ({
      id: `asset-${i}`,
      type: 'chiller',
      classifications: [],
    }));

    const result = await generate({
      siteId: 'site-large',
      assets: manyAssets,
      maxPlantNodes: 10,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.warnings.some((w) => w.code === 'NODE_LIMIT_EXCEEDED')).toBe(true);
    const eqNodes = result.layout.plant.nodes.filter((n) => n.kind === 'equipment');
    expect(eqNodes.length).toBe(10);
  });

  it('never throws even with invalid/empty input', async () => {
    const result = await generate({ siteId: '', assets: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.layout.floors.length).toBeGreaterThanOrEqual(1);
    }
  });
});
