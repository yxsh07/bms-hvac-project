/**
 * TwinCanvas – top-level lazy-loaded R3F wrapper with 2D fallback.
 *
 * Canvas settings:
 *   - frameloop="demand" (only renders when invalidated)
 *   - dpr capped at 1.5
 *   - No shadows
 *   - ErrorBoundary falls back to Twin2DFallback (no WebGL required)
 */

import React, { Suspense, lazy, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { TwinLayout, Zone } from 'packages-twin-core';
import type { ComfortBands } from './twin-store.js';
import { useTwinStore } from './twin-store.js';
import { ExpandControls } from './ExpandControls.js';

const BuildingTwin = lazy(() => import('./BuildingTwin.js'));

function FitCameraToViewport() {
  const { camera, size, invalidate } = useThree();

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const distance = Math.max(1, 1.2 / aspect);
    camera.position.set(7 * distance, 8 * distance, 11 * distance);
    invalidate();
  }, [camera, size.width, size.height, invalidate]);

  return null;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface TwinCanvasProps {
  layout: TwinLayout;
  comfortBands: ComfortBands;
  zoneTemps?: Record<string, number> | undefined;
  floorComfort?: Record<string, number> | undefined;
  focusedFloorId?: string | null;
}

// ── Error boundary ───────────────────────────────────────────────────────────

interface EBState {
  hasError: boolean;
}

class WebGLErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  EBState
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ── TwinCanvas ───────────────────────────────────────────────────────────────

export const TwinCanvas: React.FC<TwinCanvasProps> = (props) => {
  const setLayout = useTwinStore((s) => s.setLayout);
  const setComfortBands = useTwinStore((s) => s.setComfortBands);
  const setFocusedFloor = useTwinStore((s) => s.setFocusedFloor);

  useEffect(() => {
    setLayout(props.layout);
    setComfortBands(props.comfortBands);
  }, [props.layout, props.comfortBands, setLayout, setComfortBands]);

  useEffect(() => setFocusedFloor(props.focusedFloorId ?? null), [props.focusedFloorId, setFocusedFloor]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <WebGLErrorBoundary fallback={<Twin2DFallback layout={props.layout} />}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          shadows={false}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          camera={{ position: [7, 8, 11], fov: 42, near: 0.1, far: 200 }}
        >
          <FitCameraToViewport />
          <Suspense fallback={null}>
            <BuildingTwin {...props} />
          </Suspense>
        </Canvas>
        <ExpandControls />
      </WebGLErrorBoundary>
    </div>
  );
};

// ── 2D SVG fallback (no WebGL dependency) ────────────────────────────────────

export const Twin2DFallback: React.FC<{ layout: TwinLayout }> = ({ layout }) => {
  const floors = [...layout.floors].sort((a, b) => b.elevation - a.elevation);

  return (
    <div style={{ padding: 20, background: '#f0f0f4', height: '100%', overflow: 'auto' }}>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        WebGL unavailable – showing 2D floor plans
      </p>
      {floors.map((floor) => {
        const floorZones = layout.zones.filter((z: Zone) => z.floor === floor.id);
        const svgW = Math.min(floor.footprint.w * 4, 800);
        const svgH = Math.min(floor.footprint.h * 4, 400);

        return (
          <div
            key={floor.id}
            style={{
              border: '1px solid #ccc',
              borderRadius: 6,
              marginBottom: 12,
              padding: 12,
              background: '#fff',
            }}
          >
            <h4 style={{ margin: '0 0 8px' }}>
              {floor.name} (Elev {floor.elevation})
            </h4>
            <svg
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${floor.footprint.w} ${floor.footprint.h}`}
              style={{ background: '#1a1a2e', borderRadius: 4 }}
            >
              {floorZones.map((z: Zone) => {
                const [zx, zy, zw, zh] = z.rect;
                return (
                  <g key={z.id}>
                    <rect
                      x={zx}
                      y={zy}
                      width={zw}
                      height={zh}
                      fill="#555"
                      stroke="#fff"
                      strokeWidth={0.5}
                    />
                    <text
                      x={zx + zw / 2}
                      y={zy + zh / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={Math.max(2, zh * 0.25)}
                    >
                      {z.spaceType}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export default TwinCanvas;
