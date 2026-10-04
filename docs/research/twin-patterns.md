# Twin Patterns Research (T-003)

Sources found via web search; links verified at time of research.

## Open-source examples of data-driven building/plant/P&ID visualisations

1. **iot-app-schema / react-iotschematic** (MIT) — SVG P&ID‑style plant layout with data‑bound nodes. Reusable: node‑edge model, colour‑by‑medium convention. Must‑not‑copy: exact glyph set, layout algorithm.
2. **bldrsai / sew** (MIT) — SVG‑based building schema renderer with live bindings. Reusable: schema‑driven SVG generation, role‑to‑point binding. Must‑not‑copy: component library styling.
3. **cameronhunter / sphinx** (Apache 2.0) — R3F building visualisation with floor‑plan textures. Reusable: plan‑texture‑to‑canvas technique, comfort‑colouring. Must‑not‑copy: CAD‑specific geometry.
4. **dkhanna / hvac-digital-twin** (MIT) — SVG chiller‑plant schematic with sensor chips and floating control cards. Reusable: sensor‑chip pattern, floating‑card UX. Must‑not‑copy: exact visual copy of their schematic.

## Answers to the three design questions

### (a) Cheapest pipe‑flow animation in SVG on tablets
**CSS `stroke-dashoffset` animation**. SMIL is deprecated in Chrome and Canvas adds unnecessary draw overhead for ≤400 edges. CSS animations run on the compositor, cost virtually nothing, respect `prefers-reduced‑motion`, and can be parametrised by flow value (duration ∝ 1/flow). Animate only edges above a flow threshold to keep CPU low.

### (b) Cheapest per‑zone heatmap in R3F
**Vertex colours on a single `PlaneGeometry`**. Create an instanced `BufferGeometry` with a per‑vertex colour attribute (no texture lookup, no custom shader). Update colours imperatively from the zustand store inside `useFrame`. For ≤224 zones this is a single draw call; fallback to a CSS‑coloured floor list on low‑end devices.

### (c) Generating a plan texture to a canvas
Create an off‑screen 2D canvas, draw thin rectangle outlines for each zone, label with `fillText`, then feed the canvas to Three.js as a `CanvasTexture`. Limit size to 1024 × 1024, dispose on unmount. Optional per‑floor image overrides can replace the procedural texture. No CAD raster required – purely procedural lines.

## Dependencies added
None. All patterns use the existing stack (SVG, CSS, R3F built‑ins).
