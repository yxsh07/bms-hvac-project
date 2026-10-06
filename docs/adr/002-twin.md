# ADR 002 – Digital Twin Core Design

**Status:** Accepted  
**Date:** 2026-10-05  
**Deciders:** Project team  
**Tasks:** T-030 (twin-core scaffold), T-035 (L2 plant), T-058 (L1 3D)

---

## Context

The digital twin must render the same UI components across multiple hospital sites whose BMS point
dictionaries use different abbreviations and asset naming conventions. All UI and 3D layers must bind
through semantic *roles*, not raw point abbreviations, so that a single SVG template or Three.js
scene works on any site without modification.

Three visual layers are planned:

| Layer | Technology | Status |
|---|---|---|
| L1 – Building 3D | R3F + drei + zustand | Should |
| L2 – Plant schematic | Inline SVG | Must |
| L3 – Equipment screen | SVG template per family | Must |

---

## Decisions

### §5.3 – TwinLayout schema

Each site ships one `twin-layout.json`, validated on load by a zod schema exported from
`packages/twin-core`. The file is authored seed data, not inferred from the ontology. Generated
layouts are labelled **"schematic"** in the UI (§5.10).

**Rule – sites without a layout:** When `twin-layout.json` is absent or fails validation, the twin
falls back to a generated layout produced by `gen_twin_layout.ts`. The generated layout carries
`"schematic": true` at the top level and the UI must display a visible "Schematic layout – not to
scale" badge. No UI component may throw or refuse to render because a layout is missing; the plant
schematic falls back to an ordered row of equipment nodes, and L1 renders a single floor plane.

### §5.4 – Role vocabulary and resolution

A **role** is a stable semantic identifier (e.g. `chw-leaving-temp`, `run-status`) drawn from the
vocabulary defined in `roles.ts`. Roles are the *only* identifiers used in SVG templates and Three.js
scenes; raw point abbreviations never appear in UI code.

`resolveRole(assetType, role)` implements a three-step resolution order:

1. Look up `data/seed/point-roles.json` → `byType[assetType][role]` → point abbreviation.  
2. Apply fallback rules in the same file: match by classification + unit + display-name pattern.  
3. No match → return `null`; the callout renders `–` with reason `"not available at this site"`.
   The function never throws.

### §5.5 – L2 plant performance budget

| Constraint | Limit |
|---|---|
| SVG nodes total | ≤ 400 |
| Target frame rate (mid-range tablet, animating) | 60 fps |
| SVG filters | None permitted |
| Flow animation | CSS `stroke-dasharray/offset` only; `prefers-reduced-motion` respected |

### §5.7 – L1 3D performance budgets (targets; measure and report)

| Constraint | Target |
|---|---|
| Draw calls | ≤ 150 |
| Triangles | ≤ 150 k |
| Frame rate (mid-range phone) | ≥ 30 fps |
| Device pixel ratio | Capped at 1.5 |
| Chunk loading | Lazy (3D bundle separate) |
| Shadows / post-processing | None (optional selective bloom on alarms only) |
| `frameloop` | `"demand"`; `invalidate()` on data change or interaction |

### §5.8 – Binding store

One zustand store keyed `assetId.field → { v, q, at }`. Fed by polling (30 s) or WebSocket. Each
payload applied in a single `set()`. Components subscribe to exactly one key. Three.js instances
read `getState()` inside `useFrame`; Three.js objects are never stored in the store.

### §5.10 – Generator

`tools/gen_twin_layout.ts` is stubbed in `twin-core`; full implementation deferred to T-035/T-058.
The generator interface is exported so downstream packages can type-check against it now.

**Rule – unknown asset types:** Any asset type not present in `GlyphRegistry` receives the built-in
`"generic-box"` glyph (a plain rectangle). Unknown types in `templateRegistry` fall back to the
parameter-list-only view (§5.6). Neither case throws or logs an error in production; a `DEBUG`
console warning is acceptable in development.

---

## Consequences

- All SVG templates and Three.js scenes are site-agnostic by construction; `check-site-agnostic.sh`
  enforces this on every PR.
- Adding a new site requires only a new `twin-layout.json` and an updated `point-roles.json` section;
  no UI code changes are needed.
- The generator produces an ugly-but-functional schematic; hydraulic accuracy is explicitly out of
  scope (see §5.10 acceptance bar).
- Performance budgets are targets, not hard CI gates in this task; T-035 and T-058 must measure and
  report against them.
