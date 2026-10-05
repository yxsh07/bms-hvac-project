/**
 * usePlanTexture – generates a floor plan CanvasTexture from zone geometry.
 *
 * Rules:
 *   - Canvas ≤ 1024 px on longest axis.
 *   - Texture disposed on unmount / dependency change.
 *   - Calls invalidate() so frameloop="demand" re-renders.
 */

import { useMemo, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Floor, Zone } from 'packages-twin-core';
import type { ComfortBands } from './twin-store.js';

const MAX_TEX = 1024;
const BG_COLOR = '#1a1a2e';
const ZONE_STROKE = '#ffffff';
const LABEL_FILL = '#ffffff';
const NEUTRAL_FILL = '#555555';

/**
 * Look up the comfort band colour for a given spaceType + temperature.
 * Returns neutral gray when no temp or no matching band.
 */
function bandColor(
  bands: ComfortBands,
  spaceType: string,
  temp: number | undefined,
): string {
  if (temp === undefined) return NEUTRAL_FILL;
  const list = bands[spaceType];
  if (!list) return NEUTRAL_FILL;
  for (const b of list) {
    if (temp >= b.min && temp <= b.max) return b.color;
  }
  return NEUTRAL_FILL;
}

export function usePlanTexture(
  floor: Floor,
  zones: Zone[],
  comfortBands: ComfortBands,
  zoneTemps?: Record<string, number>,
): THREE.CanvasTexture | null {
  const invalidate = useThree((s) => s.invalidate);
  const prevTexRef = useRef<THREE.CanvasTexture | null>(null);

  const texture = useMemo(() => {
    // Dispose previous texture before creating a new one
    if (prevTexRef.current) {
      prevTexRef.current.dispose();
      prevTexRef.current = null;
    }

    if (zones.length === 0) return null;

    const fw = floor.footprint.w;
    const fh = floor.footprint.h;
    const scale = Math.min(MAX_TEX / fw, MAX_TEX / fh, MAX_TEX);
    const cw = Math.max(1, Math.round(fw * scale));
    const ch = Math.max(1, Math.round(fh * scale));

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(cw, ch);
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      ctx = canvas.getContext('2d');
    }

    if (!ctx) return null;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    // Draw zones
    for (const z of zones) {
      const [zx, zy, zw, zh] = z.rect;
      const sx = zx * scale;
      const sy = zy * scale;
      const sw = zw * scale;
      const sh = zh * scale;

      const temp = zoneTemps?.[z.id];
      ctx.fillStyle = bandColor(comfortBands, z.spaceType, temp);
      ctx.fillRect(sx, sy, sw, sh);

      ctx.strokeStyle = ZONE_STROKE;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, sw, sh);

      // Label
      const fontSize = Math.max(8, Math.min(14, sh * 0.3));
      ctx.fillStyle = LABEL_FILL;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(z.spaceType, sx + sw / 2, sy + sh / 2);
    }

    const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    prevTexRef.current = tex;
    return tex;
  }, [floor, zones, comfortBands, zoneTemps]);

  // Invalidate on texture change
  useEffect(() => {
    if (texture) invalidate();
  }, [texture, invalidate]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (prevTexRef.current) {
        prevTexRef.current.dispose();
        prevTexRef.current = null;
      }
    };
  }, []);

  return texture;
}
