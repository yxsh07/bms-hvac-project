import React from 'react';
import {
  useTwinStore,
  selectExpandFactor,
  selectRevolve,
} from './twin-store.js';

export const ExpandControls: React.FC = () => {
  const expandFactor = useTwinStore(selectExpandFactor);
  const setExpandFactor = useTwinStore((s) => s.setExpandFactor);
  const revolve = useTwinStore(selectRevolve);
  const toggleRevolve = useTwinStore((s) => s.toggleRevolve);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        color: '#f8fafc',
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: 12,
        fontFamily: 'sans-serif',
      }}
    >
      <label
        htmlFor="expand-slider"
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <span style={{ fontWeight: 500 }}>Expand</span>
        <input
          id="expand-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={expandFactor}
          onChange={(e) => setExpandFactor(parseFloat(e.target.value))}
          style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
        />
        <span style={{ width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(expandFactor * 100)}%
        </span>
      </label>

      <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.2)' }} />

      <button
        type="button"
        onClick={toggleRevolve}
        style={{
          background: revolve ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          border: 'none',
          padding: '4px 10px',
          borderRadius: 4,
          cursor: 'pointer',
          fontWeight: 500,
          transition: 'background 0.2s',
        }}
      >
        {revolve ? 'Pause Revolve' : 'Revolve'}
      </button>
    </div>
  );
};
