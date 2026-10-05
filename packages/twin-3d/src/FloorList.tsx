import React from 'react';
import type { FloorSummary } from './twin-store.js';
import {
  useTwinStore,
  selectFloorSummaries,
  selectFocusedFloor,
} from './twin-store.js';

export interface FloorListProps {
  /** Optional floor summary list (e.g. from GET /floors/summary). Defaults to store. */
  floors?: FloorSummary[];
  onSelectFloor?: (floorId: string | null) => void;
}

export const FloorList: React.FC<FloorListProps> = ({
  floors: propFloors,
  onSelectFloor,
}) => {
  const storeSummaries = useTwinStore(selectFloorSummaries);
  const focusedFloorId = useTwinStore(selectFocusedFloor);
  const setFocusedFloor = useTwinStore((s) => s.setFocusedFloor);

  const floors = propFloors ?? storeSummaries;

  const handleSelect = (floorId: string) => {
    const next = focusedFloorId === floorId ? null : floorId;
    setFocusedFloor(next);
    onSelectFloor?.(next);
  };

  if (floors.length === 0) {
    return (
      <div style={{ padding: 12, color: '#64748b', fontSize: 13, fontFamily: 'sans-serif' }}>
        No floors available
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 12,
        background: '#0f172a',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        Floors
      </div>
      {floors.map((floor) => {
        const isFocused = floor.id === focusedFloorId;
        return (
          <button
            type="button"
            key={floor.id}
            onClick={() => handleSelect(floor.id)}
            style={{
              padding: '8px 12px',
              background: isFocused ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
              color: isFocused ? '#ffffff' : '#e2e8f0',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: isFocused ? '1px solid #38bdf8' : '1px solid transparent',
              fontSize: 13,
              fontWeight: isFocused ? 600 : 400,
              textAlign: 'left',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <span>{floor.name}</span>
            <span
              style={{
                fontSize: 11,
                color: isFocused ? '#e0f2fe' : '#94a3b8',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              EL: {floor.elevation}
            </span>
          </button>
        );
      })}
    </div>
  );
};
