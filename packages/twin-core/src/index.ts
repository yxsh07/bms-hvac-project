/**
 * packages/twin-core public API
 *
 * Re-exports everything a consumer needs; internal helpers are not exported.
 */

// Layout schema (§5.3)
export {
  TwinLayoutSchema,
  FloorSchema,
  ZoneSchema,
  AnchorSchema,
  PlantSchema,
  PlantNodeSchema,
  PlantEdgeSchema,
  MediumSchema,
  NodeKindSchema,
  parseTwinLayout,
} from './layout.js';
export type {
  TwinLayout,
  Floor,
  Zone,
  Anchor,
  Plant,
  PlantNode,
  PlantEdge,
  Medium,
  NodeKind,
} from './layout.js';

// Roles vocabulary and resolver (§5.4)
export { ROLES, isRole, resolveRole } from './roles.js';
export type { Role, PointRolesData, FallbackRule, PointMeta, ResolveResult } from './roles.js';

// Glyph and template registries (§5.5, §5.6)
export type { Glyph, GlyphRegistry, EquipmentTemplate, TemplateAnchor, TemplateRegistry } from './registry.js';

// Binding store (§5.8)
export { bindingKey, selectBinding } from './binding-store.js';
export type {
  QualityCode,
  BindingEntry,
  BindingKey,
  BindingStoreState,
} from './binding-store.js';

// Generator interface (§5.10)
export { stubGenerator } from './generator.js';
export type {
  OntologyAsset,
  SeedFloor,
  GeneratorInput,
  GeneratorWarning,
  GeneratorResult,
  LayoutGenerator,
} from './generator.js';
