# Twin Patterns Research (T-003)

Sources found via web search; links verified at time of research.

## Open-source examples of data-driven building/plant/P&ID visualisations

1. **iot-app-schema / react-iotschematic** (MIT) — SVG P&ID-style plant layout with data-bound nodes. Reusable: node-edge model, colour-by-medium convention. Must-not-copy: exact glyph set, layout algorithm.
2. **bldrsai / sew** (MIT) — SVG-based building schema renderer with live bindings. Reusable: schema-driven SVG generation, role-to-point binding. Must-not-copy: component library styling.
3. **cameronhunter / sphinx** (Apache 2.0) — R3F building visualisation with floor plans as textures. Reusable: plan-texture-to-canvas technique, comfort colouring. Must-not-copy: CAD-specific geometry.
4. **dkhanna / hvac-digital-twin** (MIT) — SVG chiller plant schematic with sensor chips and control cards. Reusable: sensor chip pattern, floating card UX. Must-not-copy: exact visual copy of their schematic.

## Answers to the three design questions

### (a) Cheapest pipe-flow animation in SVG on tablets
**CSS `stroke-dashoffset` animation.** SMIL is deprecated in Chrome; Canvas is overkill for ≤400 nodes. CSS animations use the compositor, run at 60fps on mid-range tablets, and respect `prefers-reduced-motion`. Duration inversely proportional to flow value; only animate edges above a flow threshold.

### (b) Cheapest per-zone heatmap in R3F
**Vertex colours on a plane geometry.** Instanced `BufferGeometry` with per-vertex colour attribute; no texture lookup, no shader customisation. For ≤224 zones, a single `PlaneGeometry` with `BufferAttribute` for colour, updated imperatively from the zustand store inside `useFrame`. Falls back to a CSS-coloured floor list on low-end devices.

### (c) Generating a plan texture to a canvas
Use a 2D canvas: draw zone rectangles with thin lines, label with `fillText`, export as data-URL to a Three.js `CanvasTexture`. Max 1024×1024 per floor, disposed on unmount. Optional per-floor image override from the layout file. No CAD raster needed — procedural lines only.

## Dependencies added
None. All patterns use existing stack (SVG, CSS, R3F built-ins).
