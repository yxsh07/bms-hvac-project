/**
 * FloorSlab – one floor in the stacked building twin.
 *
 * R3F rules applied:
 *   - NO setState in useFrame – only ref mutation.
 *   - frameloop="demand" ➜ calls invalidate() when position lerps.
 *   - Materials created once via useMemo; properties mutated via ref.
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Floor, Zone } from 'packages-twin-core';
import { usePlanTexture } from './use-plan-texture.js';
import { useTwinStore, selectExpandFactor, selectFocusedFloor } from './twin-store.js';
import type { ComfortBands } from './twin-store.js';

export interface FloorSlabProps {
  floor: Floor;
  zones: Zone[];
  index: number;
  totalFloors: number;
  comfortBands: ComfortBands;
  zoneTemps?: Record<string, number> | undefined;
}

/** Layout-unit → Three.js scale factor. */
const LU = 0.1;
/** Floor slab thickness in world units. */
const SLAB_H = 0.15;
/** Spacing multiplier when expand slider is at 1.0. */
const EXPAND_GAP = 3;

export const FloorSlab = React.memo<FloorSlabProps>(function FloorSlab({
  floor,
  zones,
  index,
  comfortBands,
  zoneTemps,
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  const expandFactor = useTwinStore(selectExpandFactor);
  const focusedFloorId = useTwinStore(selectFocusedFloor);
  const setFocusedFloor = useTwinStore((s) => s.setFocusedFloor);

  const texture = usePlanTexture(floor, zones, comfortBands, zoneTemps);

  const w = floor.footprint.w * LU;
  const d = floor.footprint.h * LU;

  // Target Y based on expansion
  const targetY = useRef(index * SLAB_H);
  targetY.current = index * SLAB_H + index * expandFactor * EXPAND_GAP;

  // Focused / dimmed state
  const isFocused = focusedFloorId === floor.id;
  const isDimmed = focusedFloorId !== null && !isFocused;

  // Materials – top gets the plan texture, sides are neutral
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: 0x387487, metalness: 0.12, roughness: 0.72 });
    const top = new THREE.MeshStandardMaterial({ color: 0x286778 });
    const bottom = new THREE.MeshStandardMaterial({ color: 0x173e4e });
    // BoxGeometry face order: +X -X +Y -Y +Z -Z
    return [side, side, top, bottom, side, side] as const;
  }, []);

  // Apply texture to top face
  useMemo(() => {
    const top = mats[2];
    if (texture) {
      top.map = texture;
      top.color.set(0xffffff);
    } else {
      top.map = null;
      top.color.set(0x286778);
    }
    top.needsUpdate = true;
  }, [texture, mats]);

  // Opacity / emissive for focus
  useMemo(() => {
    for (const m of mats) {
      m.transparent = isDimmed;
      m.opacity = isDimmed ? 0.25 : 1;
    }
    mats[2].emissive.set(isFocused ? 0x124054 : 0x000000);
  }, [isFocused, isDimmed, mats]);

  // Lerp Y position – ref-only, never setState
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dy = targetY.current - mesh.position.y;
    if (Math.abs(dy) > 0.001) {
      mesh.position.y += dy * 0.12;
      invalidate();
    }
  });

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setFocusedFloor(isFocused ? null : floor.id);
    },
    [isFocused, floor.id, setFocusedFloor],
  );

  return (
    <mesh
      ref={meshRef}
      position={[0, targetY.current, 0]}
      onClick={handleClick}
      material={mats as unknown as THREE.Material[]}
    >
      <boxGeometry args={[w, SLAB_H, d]} />
    </mesh>
  );
});
