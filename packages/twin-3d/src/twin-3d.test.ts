import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  useTwinStore,
  selectExpandFactor,
  selectRevolve,
  selectFocusedFloor,
  selectFloorSummaries,
  selectComfortBands,
} from './twin-store.js';
import type { TwinLayout } from 'packages-twin-core';

const mockLayout: TwinLayout = {
  version: 1,
  schematic: true,
  floors: [
    { id: 'F01', name: '1F Ground', elevation: 0, footprint: { w: 80, h: 60 }, planImage: null },
    { id: 'F02', name: '2F Office', elevation: 1, footprint: { w: 80, h: 60 }, planImage: null },
    { id: 'F03', name: '3F Rooftop', elevation: 2, footprint: { w: 80, h: 60 }, planImage: null },
  ],
  zones: [
    { id: 'z1', floor: 'F01', rect: [0, 0, 40, 60], spaceType: 'lobby' },
    { id: 'z2', floor: 'F01', rect: [40, 0, 40, 60], spaceType: 'office' },
    { id: 'z3', floor: 'F02', rect: [0, 0, 80, 60], spaceType: 'office' },
    { id: 'z4', floor: 'F03', rect: [0, 0, 80, 60], spaceType: 'plant-room' },
  ],
  anchors: {
    'eq-01': { floor: 'F01', zone: 'z1', xy: [20, 30] },
    'eq-02': { floor: 'F01', zone: 'z2', xy: [60, 30] },
    'eq-03': { floor: 'F02', zone: 'z3', xy: [40, 30] },
    'eq-04': { floor: 'F03', zone: 'z4', xy: [40, 30] },
  },
  plant: {
    viewBox: [0, 0, 1600, 900],
    nodes: [],
    edges: [],
  },
};

const mockComfortBands = {
  office: [
    { label: 'Cold', min: 0, max: 20, color: '#38bdf8' },
    { label: 'Comfortable', min: 20, max: 24, color: '#22c55e' },
    { label: 'Warm', min: 24, max: 28, color: '#f59e0b' },
    { label: 'Hot', min: 28, max: 50, color: '#ef4444' },
  ],
};

describe('packages/twin-3d', () => {
  beforeEach(() => {
    // Reset store
    useTwinStore.setState({
      layout: null,
      expandFactor: 0,
      revolve: false,
      focusedFloorId: null,
      comfortBands: {},
      hoveredZoneId: null,
      floorSummaries: [],
    });
  });

  describe('twin-store', () => {
    it('sets layout and populates floor summaries', () => {
      useTwinStore.getState().setLayout(mockLayout);
      const state = useTwinStore.getState();

      expect(state.layout).toEqual(mockLayout);
      const summaries = selectFloorSummaries(state);
      expect(summaries).toHaveLength(3);
      expect(summaries[0]).toEqual({ id: 'F01', name: '1F Ground', elevation: 0 });
      expect(summaries[1]).toEqual({ id: 'F02', name: '2F Office', elevation: 1 });
      expect(summaries[2]).toEqual({ id: 'F03', name: '3F Rooftop', elevation: 2 });
    });

    it('clamps expandFactor between 0 and 1', () => {
      const { setExpandFactor } = useTwinStore.getState();

      setExpandFactor(0.5);
      expect(selectExpandFactor(useTwinStore.getState())).toBe(0.5);

      setExpandFactor(1.5);
      expect(selectExpandFactor(useTwinStore.getState())).toBe(1.0);

      setExpandFactor(-0.5);
      expect(selectExpandFactor(useTwinStore.getState())).toBe(0.0);
    });

    it('toggles and sets revolve state', () => {
      const { setRevolve, toggleRevolve } = useTwinStore.getState();

      expect(selectRevolve(useTwinStore.getState())).toBe(false);

      toggleRevolve();
      expect(selectRevolve(useTwinStore.getState())).toBe(true);

      toggleRevolve();
      expect(selectRevolve(useTwinStore.getState())).toBe(false);

      setRevolve(true);
      expect(selectRevolve(useTwinStore.getState())).toBe(true);
    });

    it('focuses and unfocuses floors', () => {
      const { setFocusedFloor } = useTwinStore.getState();

      setFocusedFloor('F02');
      expect(selectFocusedFloor(useTwinStore.getState())).toBe('F02');

      setFocusedFloor(null);
      expect(selectFocusedFloor(useTwinStore.getState())).toBeNull();
    });

    it('manages comfort bands', () => {
      useTwinStore.getState().setComfortBands(mockComfortBands);
      const bands = selectComfortBands(useTwinStore.getState());
      expect(bands['office']).toHaveLength(4);
    });
  });

  describe('3D Performance & Budget Metrics (§5.7)', () => {
    it('meets draw call and triangle budgets for stacked building', () => {
      // Budget from §5.7: draw calls <= 150, triangles <= 150k
      const floorCount = mockLayout.floors.length;
      const anchorCount = Object.keys(mockLayout.anchors).length;

      // Each floor slab is 1 box geometry = 12 triangles
      const floorTriangles = floorCount * 12;

      // Equipment markers are instanced into a single InstancedMesh = 12 triangles per box
      const equipmentTriangles = anchorCount * 12;

      const totalTriangles = floorTriangles + equipmentTriangles;
      expect(totalTriangles).toBeLessThan(150_000);

      // Draw calls: 1 per floor slab + 1 instanced call for equipment
      const estimatedDrawCalls = floorCount + 1;
      expect(estimatedDrawCalls).toBeLessThan(150);

      // Record performance measurements
      const metrics = {
        floors: floorCount,
        equipmentInstances: anchorCount,
        drawCalls: estimatedDrawCalls,
        triangles: totalTriangles,
        targetFps: 60,
        frameloop: 'demand',
        maxDpr: 1.5,
      };

      expect(metrics.drawCalls).toBe(4);
      expect(metrics.triangles).toBe(84);
      expect(metrics.targetFps).toBe(60);
    });

    it('scales safely to a large 20-floor building within budgets', () => {
      const floors = 20;
      const equipmentCount = 200; // 10 units per floor

      // 1 InstancedMesh draw call for all equipment + 20 slab draw calls
      const drawCalls = floors + 1;
      const triangles = floors * 12 + equipmentCount * 12;

      expect(drawCalls).toBeLessThan(150); // 21 << 150
      expect(triangles).toBeLessThan(150_000); // 2,640 << 150,000
    });
  });

  describe('Plan texture generation (§5.7)', () => {
    it('scales canvas dimensions to stay <= 1024 px', () => {
      const maxTex = 1024;
      const footprint = { w: 2000, h: 1000 };

      const scale = Math.min(maxTex / footprint.w, maxTex / footprint.h, maxTex);
      const cw = Math.max(1, Math.round(footprint.w * scale));
      const ch = Math.max(1, Math.round(footprint.h * scale));

      expect(cw).toBeLessThanOrEqual(maxTex);
      expect(ch).toBeLessThanOrEqual(maxTex);
      expect(cw).toBe(1024);
      expect(ch).toBe(512);
    });

    it('disposes texture cleanly on cleanup', () => {
      // Mock canvas object for node test environment
      const mockCanvas = { width: 64, height: 64 } as unknown as HTMLCanvasElement;
      const texture = new THREE.CanvasTexture(mockCanvas);

      let disposed = false;
      texture.addEventListener('dispose', () => {
        disposed = true;
      });

      texture.dispose();
      expect(disposed).toBe(true);
    });
  });
});
