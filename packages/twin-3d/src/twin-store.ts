import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TwinLayout } from 'packages-twin-core';

export interface ComfortBand {
  label: string;
  min: number;
  max: number;
  color: string; // hex
}

export interface ComfortBands {
  [spaceType: string]: ComfortBand[] | undefined;
}

export interface FloorSummary {
  id: string;
  name: string;
  elevation: number;
}

export interface TwinStoreState {
  layout: TwinLayout | null;
  expandFactor: number;
  revolve: boolean;
  focusedFloorId: string | null;
  comfortBands: ComfortBands;
  hoveredZoneId: string | null;
  floorSummaries: FloorSummary[];
  setLayout: (layout: TwinLayout) => void;
  setExpandFactor: (factor: number) => void;
  setRevolve: (revolve: boolean) => void;
  toggleRevolve: () => void;
  setFocusedFloor: (floorId: string | null) => void;
  setComfortBands: (bands: ComfortBands) => void;
  setHoveredZone: (zoneId: string | null) => void;
}

export const useTwinStore = create<TwinStoreState>()(
  subscribeWithSelector((set) => ({
    layout: null,
    expandFactor: 0.45,
    revolve: false,
    focusedFloorId: null,
    comfortBands: {},
    hoveredZoneId: null,
    floorSummaries: [],
    setLayout: (layout: TwinLayout) => {
      const summaries = layout.floors.map((f) => ({
        id: f.id,
        name: f.name,
        elevation: f.elevation,
      }));
      set({ layout, floorSummaries: summaries });
    },
    setExpandFactor: (factor: number) => set({ expandFactor: Math.max(0, Math.min(1, factor)) }),
    setRevolve: (revolve: boolean) => set({ revolve }),
    toggleRevolve: () => set((state) => ({ revolve: !state.revolve })),
    setFocusedFloor: (floorId: string | null) => set({ focusedFloorId: floorId }),
    setComfortBands: (bands: ComfortBands) => set({ comfortBands: bands }),
    setHoveredZone: (zoneId: string | null) => set({ hoveredZoneId: zoneId }),
  })),
);

export const selectExpandFactor = (state: TwinStoreState) => state.expandFactor;
export const selectRevolve = (state: TwinStoreState) => state.revolve;
export const selectFocusedFloor = (state: TwinStoreState) => state.focusedFloorId;
export const selectFloorSummaries = (state: TwinStoreState) => state.floorSummaries;
export const selectComfortBands = (state: TwinStoreState) => state.comfortBands;
export const selectHoveredZone = (state: TwinStoreState) => state.hoveredZoneId;
