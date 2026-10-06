/**
 * EquipmentInstances – instanced rendering of equipment anchors on the building.
 *
 * R3F rules applied:
 *   - Drei <Instances> for GPU instancing by equipment type.
 *   - Position read from layout.anchors (assetId → Anchor).
 *   - Floor elevation × expandFactor for Y offset.
 *   - NO setState in useFrame.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import type { TwinLayout, Anchor } from 'packages-twin-core';

export interface EquipmentInstancesProps {
  layout: TwinLayout;
  expandFactor: number;
}

/** Layout-unit → Three.js scale factor (must match FloorSlab). */
const LU = 0.1;
/** Equipment marker half-size. */
const EQ_SIZE = 0.2;
/** Expand gap (must match FloorSlab). */
const EXPAND_GAP = 3;

interface AnchorEntry {
  assetId: string;
  anchor: Anchor;
  floorIndex: number;
  elevation: number;
}

/** Shared colour for quality codes. */
const Q_COLORS = {
  GOOD: new THREE.Color(0x22c55e),
  STALE: new THREE.Color(0xeab308),
  BAD: new THREE.Color(0xef4444),
  UNAVAILABLE: new THREE.Color(0x888888),
} as const;

export const EquipmentInstances = React.memo<EquipmentInstancesProps>(
  function EquipmentInstances({ layout, expandFactor }) {
    const invalidate = useThree((s) => s.invalidate);

    // Build a sorted floor index map once
    const floorIndex = useMemo(() => {
      const sorted = [...layout.floors].sort((a, b) => a.elevation - b.elevation);
      const map = new Map<string, { idx: number; elevation: number }>();
      sorted.forEach((f, i) => map.set(f.id, { idx: i, elevation: f.elevation }));
      return map;
    }, [layout.floors]);

    // Flatten anchors into a typed list
    const entries: AnchorEntry[] = useMemo(() => {
      const list: AnchorEntry[] = [];
      for (const [assetId, anchor] of Object.entries(layout.anchors)) {
        const fi = floorIndex.get(anchor.floor);
        if (!fi) continue;
        list.push({ assetId, anchor, floorIndex: fi.idx, elevation: fi.elevation });
      }
      return list;
    }, [layout.anchors, floorIndex]);

    if (entries.length === 0) return null;

    return (
      <Instances limit={Math.max(entries.length, 1)} range={entries.length}>
        <boxGeometry args={[EQ_SIZE, EQ_SIZE, EQ_SIZE]} />
        <meshStandardMaterial color={Q_COLORS.UNAVAILABLE} />
        {entries.map((e) => (
          <EquipmentDot
            key={e.assetId}
            entry={e}
            expandFactor={expandFactor}
          />
        ))}
      </Instances>
    );
  },
);

// ── Individual instance (lerps Y, no setState) ──────────────────────────────

interface DotProps {
  entry: AnchorEntry;
  expandFactor: number;
}

const EquipmentDot = React.memo<DotProps>(function EquipmentDot({ entry, expandFactor }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const invalidate = useThree((s) => s.invalidate);

  const x = entry.anchor.xy[0] * LU;
  const z = entry.anchor.xy[1] * LU;
  const targetY =
    entry.floorIndex * 0.15 + // slab thickness offset
    entry.floorIndex * expandFactor * EXPAND_GAP +
    0.15; // sit on top of slab

  useFrame(() => {
    const inst = ref.current;
    if (!inst) return;
    const dy = targetY - inst.position.y;
    if (Math.abs(dy) > 0.001) {
      inst.position.y += dy * 0.12;
      invalidate();
    }
  });

  return <Instance ref={ref} position={[x, targetY, z]} />;
});
