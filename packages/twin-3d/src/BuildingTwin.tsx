/**
 * BuildingTwin – R3F scene assembling floor slabs, equipment and controls.
 *
 * R3F rules:
 *   - OrbitControls with autoRotate (revolve).
 *   - Frameloop="demand": invalidate() driven during revolve.
 *   - Ambient + directional light, NO shadows.
 *   - Memoised floor sort; stable keys.
 */

import React, { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { TwinLayout } from 'packages-twin-core';
import { FloorSlab } from './FloorSlab.js';
import { EquipmentInstances } from './EquipmentInstances.js';
import { ComfortLegend } from './ComfortLegend.js';
import { useTwinStore, selectExpandFactor, selectRevolve } from './twin-store.js';
import type { ComfortBands } from './twin-store.js';

export interface BuildingTwinProps {
  layout: TwinLayout;
  comfortBands: ComfortBands;
  zoneTemps?: Record<string, number> | undefined;
  floorComfort?: Record<string, number> | undefined;
}

export const BuildingTwin: React.FC<BuildingTwinProps> = ({
  layout,
  comfortBands,
  zoneTemps,
  floorComfort,
}) => {
  const expandFactor = useTwinStore(selectExpandFactor);
  const revolve = useTwinStore(selectRevolve);
  const invalidate = useThree((s) => s.invalidate);

  // In demand frameloop, continuous revolve requires per-frame invalidation
  useFrame(() => {
    if (revolve) {
      invalidate();
    }
  });

  const sortedFloors = useMemo(
    () => [...layout.floors].sort((a, b) => a.elevation - b.elevation),
    [layout.floors],
  );

  // Pre-group zones by floor id for O(1) lookup
  const zonesByFloor = useMemo(() => {
    const map = new Map<string, typeof layout.zones>();
    for (const z of layout.zones) {
      const list = map.get(z.floor);
      if (list) list.push(z);
      else map.set(z.floor, [z]);
    }
    return map;
  }, [layout.zones]);

  return (
    <>
      <color attach="background" args={['#12232d']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 10]} intensity={1.4} />

      <group>
        {sortedFloors.map((floor, i) => (
          <FloorSlab
            key={floor.id}
            floor={floor}
            zones={zonesByFloor.get(floor.id) ?? []}
            index={i}
            totalFloors={sortedFloors.length}
            comfortBands={comfortBands}
            zoneTemps={zoneTemps}
            comfortScore={floorComfort?.[floor.id]}
          />
        ))}

        <EquipmentInstances layout={layout} expandFactor={expandFactor} />
      </group>

      <ComfortLegend />
      <OrbitControls autoRotate={revolve} autoRotateSpeed={1.0} makeDefault />
    </>
  );
};

export default BuildingTwin;
