/**
 * GlyphRegistry and TemplateRegistry interfaces (§5.5, §5.6, ADR-002)
 *
 * Rules:
 *   - Unknown asset types → "generic-box" glyph (GlyphRegistry) or parameter-
 *     list-only view (TemplateRegistry). Neither case throws in production.
 *   - In development (import.meta.env.DEV), a console.debug warning is logged
 *     for missing glyphs/templates to aid authoring.
 */

import type { Role } from './roles.js';

// ── Glyph (L2 equipment symbols, §5.5) ───────────────────────────────────────

/**
 * A glyph is a simple SVG symbol for one equipment family.
 * Symbols are 64 × 64 viewBox units by convention; rendered at the node's xy.
 *
 * Rules:
 *   - All artwork must be original (no copied SVGs).
 *   - No SVG filters permitted (performance budget §5.5).
 *   - Colours must use design tokens / CSS custom properties; no hardcoded values.
 */
export interface Glyph {
  /** Asset type this symbol represents, e.g. "chiller", "pump". */
  assetType: string;
  /**
   * Returns an SVG string for the glyph body (the <g> contents, not the outer
   * element).  The renderer wraps this in a correctly positioned <g>.
   */
  render(): string;
}

/**
 * Registry of SVG equipment glyphs for the L2 plant schematic (§5.5).
 *
 * Built-in types: chiller | pump | cooling-tower | tank | valve | generic-box.
 *
 * Rule – unknown asset type:
 *   get() always returns a Glyph.  If the requested assetType is not registered,
 *   the "generic-box" glyph is returned and a debug warning is emitted.
 */
export interface GlyphRegistry {
  /** Register a glyph implementation for an asset type. */
  register(assetType: string, glyph: Glyph): void;

  /**
   * Retrieve the glyph for assetType.
   * Falls back to "generic-box" for unregistered types; never throws.
   */
  get(assetType: string): Glyph;

  /** Returns true if assetType has an explicit (non-fallback) glyph registered. */
  has(assetType: string): boolean;
}

// ── Template (L3 equipment screen, §5.6) ──────────────────────────────────────

/**
 * One anchor point declared by an SVG template.
 * The renderer positions a sensor chip or control widget at (x, y) and populates
 * it from the binding store via role resolution.
 */
export interface TemplateAnchor {
  id: string;
  /** Semantic role bound at this anchor position. */
  role: Role;
  x: number;
  y: number;
  /** Display format hint, e.g. "°C 1dp", "%" */
  format?: string;
}

/**
 * A hand-authored SVG template for one equipment family (§5.6).
 *
 * Constraints (§5.6):
 *   - Each template file is ≤ 8 KB.
 *   - Artwork is original; no copied renders or plans.
 *   - Colours use design tokens; no hardcoded hex values.
 */
export interface EquipmentTemplate {
  /** Asset type this template covers, e.g. "ahu", "chiller", "fcu", "pump". */
  assetType: string;
  /**
   * The SVG markup for the equipment illustration.
   * Must be a safe, sanitised string (no scripts).
   */
  svgMarkup: string;
  /** Anchor declarations for sensor chips / control widgets. */
  anchors: TemplateAnchor[];
}

/**
 * Registry of per-family SVG templates for the L3 equipment screen (§5.6).
 *
 * Rule – missing template:
 *   get() returns null for unregistered asset types.  The L3 screen must then
 *   render only the PARAMETERS list (always available). A debug warning is logged
 *   in development.
 */
export interface TemplateRegistry {
  /** Register a template implementation for an asset type. */
  register(assetType: string, template: EquipmentTemplate): void;

  /**
   * Retrieve the template for assetType.
   * Returns null for unregistered types; never throws.
   */
  get(assetType: string): EquipmentTemplate | null;

  /** Returns true if assetType has a registered template. */
  has(assetType: string): boolean;
}
