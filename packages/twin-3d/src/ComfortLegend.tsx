import React from 'react';
import { Html } from '@react-three/drei';
import { useTwinStore, selectComfortBands } from './twin-store.js';

export const ComfortLegend: React.FC = () => {
  const comfortBands = useTwinStore(selectComfortBands);

  const spaceTypes = Object.keys(comfortBands);
  if (spaceTypes.length === 0) return null;

  return (
    <Html position={[-8, 0, 0]} center>
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          color: '#f8fafc',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minWidth: 160,
          fontFamily: 'sans-serif',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Comfort Legend</h4>
        {spaceTypes.map((type) => {
          const bands = comfortBands[type];
          if (!bands || bands.length === 0) return null;

          return (
            <div key={type} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                {type}
              </div>
              {bands.map((band) => (
                <div
                  key={band.label}
                  style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: band.color,
                      display: 'inline-block',
                      marginRight: 6,
                    }}
                  />
                  <span style={{ fontSize: 11 }}>
                    {band.label} ({band.min}° - {band.max}°)
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Html>
  );
};
