/**
 * Binding store shape (§5.8, ADR-002)
 *
 * One zustand store keyed by "assetId.field" → { v, q, at }.
 * Fed by polling (30 s, /latest endpoint, Cache-Control 15 s) or WebSocket later.
 *
 * Rules:
 *   - Apply each payload in a single set() call.
 *   - Components subscribe to the ONE key they need; never subscribe to the whole store.
 *   - Three.js objects are NEVER stored here.
 *   - Instanced 3D reads getState() inside useFrame or on invalidate().
 *   - Bad / stale values are kept but marked via quality code (§Quality rule); never deleted.
 */

// ── Quality codes ─────────────────────────────────────────────────────────────

/**
 * Quality codes carried with every binding value.
 * Matches the quality vocabulary in packages/quality.
 *
 * GOOD        – value is fresh and valid.
 * STALE       – last update older than the staleness threshold (configurable per site).
 * BAD         – value received but flagged as bad by the BMS gateway.
 * UNAVAILABLE – no reading has ever arrived for this point.
 */
export type QualityCode = 'GOOD' | 'STALE' | 'BAD' | 'UNAVAILABLE';

// ── Binding entry ─────────────────────────────────────────────────────────────

/**
 * A single live value in the binding store.
 *
 * @template V  Value type; number for most BMS points, string for enumerations.
 */
export interface BindingEntry<V = number | string | boolean | null> {
  /** Current value.  null when quality is UNAVAILABLE. */
  v: V;
  /** Quality code; determines how the UI renders the value. */
  q: QualityCode;
  /** UTC ISO-8601 timestamp of the most recent update. */
  at: string;
}

// ── Store key ─────────────────────────────────────────────────────────────────

/**
 * Canonical string key format for the binding store.
 * Example: "CHR-001.CHWLT"  (assetId="CHR-001", field="CHWLT")
 *
 * Both segments are opaque to UI code — always go through resolveRole to obtain
 * the field abbreviation; never embed raw abbreviations in component source.
 */
export type BindingKey = `${string}.${string}`;

/** Build a BindingKey from its parts. */
export function bindingKey(assetId: string, field: string): BindingKey {
  return `${assetId}.${field}` as BindingKey;
}

// ── Store slice shape ─────────────────────────────────────────────────────────

/**
 * Shape of the zustand binding store state slice.
 *
 * The full zustand store is created in apps/web; this package exports only the
 * type so downstream code can type-check selectors and actions without coupling
 * to a specific zustand version.
 */
export interface BindingStoreState {
  /** Live readings keyed by "assetId.field". */
  bindings: Record<BindingKey, BindingEntry>;

  /**
   * Apply a batch of readings in one set() call.
   * Merges into the existing map; does not remove keys absent from the patch.
   */
  applyPatch(patch: Record<BindingKey, BindingEntry>): void;

  /**
   * Mark a set of keys as STALE when a poll cycle yields no update for them.
   * Called by the polling loop after each successful fetch.
   */
  markStale(keys: BindingKey[]): void;
}

// ── Selector helpers ──────────────────────────────────────────────────────────

/**
 * Build a zustand selector for a single binding key.
 * Usage:  const entry = useBindingStore(selectBinding("CHR-001.CHWLT"))
 *
 * Returns an UNAVAILABLE entry when the key is not yet in the store, so
 * components can render "–" before the first poll completes.
 */
export function selectBinding(key: BindingKey) {
  return (state: BindingStoreState): BindingEntry =>
    state.bindings[key] ?? { v: null, q: 'UNAVAILABLE', at: '' };
}
