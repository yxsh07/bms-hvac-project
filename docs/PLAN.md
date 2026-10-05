# BMS Digital Twin Prototype — PLAN.md

**Version** 2.0 (merged) · **Date** 3 Oct 2026 · **Owner** you (human orchestrator) · **Repo visibility** PRIVATE until §0 R3 is cleared

Merges four things: (1) the Document 2 technical guide (KIMS Manavata / Smart Joules BMS SCADA), (2) your digital-twin + SimSite idea, (3) the analysis of the four DeJoule product screenshots, (4) an Orca ADE multi-agent workflow sized for ~1–2M tokens.

> **For agents:** never load this whole file. Run `scripts/plan.sh <n>` to print section *n* only (for example `scripts/plan.sh 6`). Your prompt names the sections you need. The Document 2 PDF is not in the repo and you must not look for it: everything you need from it is digested in §3 and §7.

| § | Title | Read by |
|---|---|---|
| 0 | Reality checks and decisions | everyone, once |
| 1 | Goals, client commitments, traceability | orchestrator, QA |
| 2 | Architecture | everyone |
| 3 | Site facts (CONFIDENTIAL, client-derived) | sim, calibration, QA |
| 4 | Reference UI and design language | frontend, twin |
| 5 | Digital twin (L1 / L2 / L3) | twin, frontend |
| 6 | SimSite and Sim Console | sim, QA |
| 7 | Backend and domain spec | api, data |
| 8 | App UI spec | frontend |
| 9 | Scope tiers, budget, cut order | orchestrator |
| 10 | Operating model: Orca, GitHub, CI, skills | devops, orchestrator |
| 11 | Phases, backlog, gates | orchestrator |
| 12 | Prompt pack | orchestrator |
| 13 | Demo script and Test Checklist | QA, docs |
| 14 | Open questions, risks, unverified claims | orchestrator |

---

## 0. Reality checks and decisions

### 0.1 Reality checks (read first)

**R1 — The reference UI has been analysed.** Four marketing screenshots of the DeJoule product, all in landscape tablet frames, so **tablet landscape is their hero form factor**. Content is demo/anonymised ("Enterprise Facility", "Facility Gamma"). Colours in §4 are eyeballed. Task T-001 is done; its output is merged into §4, and nothing else needs the images except the frontend agents (keep them in `docs/reference/`, private repo only).

**R2 — The full vision does not fit 1–2M tokens.** Web + tablet + phone, three twin layers, simulator, RBAC, approval workflow, audit chain, five reports is a team-quarter of work. §9 splits it into Must / Should / Could with a cut order. The Document 2 deliverables S1–S12 are the floor (§1.2); the twin, SimSite, optimiser and chat are **additions beyond Document 2's declared scope**, and Document 2 §8.3 lists "AI-driven optimisation" as out of scope. So anything "optimiser" or "chat" here is rule-based or synthetic and labelled so (DEC-11).

**R3 — Confidentiality.** Document 2 is marked Confidential and §3 of this file contains numbers derived from the client's data. Therefore:
- The GitHub repo stays **private**. Before it is ever made public: get Smart Joules' written OK, run T-057 (sanitise), and delete or generalise §3 and `docs/reference/`.
- Raw CSVs, the building-model xlsx and the Document 2 PDF live in `data/raw/` (git-ignored) and are **never** shown to agents, especially free-tier ones that may log prompts.
- Agents see only small derived calibration JSON, anonymised seed data, and synthetic fixtures.
- Do not copy their logos, Brand Bible, equipment renders, CAD plans or exact copy. "Similar" means original design (§4.5).

**R4 — Token numbers are estimates, and "tokens" is ambiguous.** Agentic coding burns most tokens re-reading context on every turn, not writing code. If your 1–2M counts input plus output across all turns, §9's budget is optimistic. Track real burn per task in `docs/BURN.md` from the first task and re-plan at gate G2 (§9.2).

**R5 — Weaker and free models get only low-risk work.** Boilerplate, tests, fixtures, Dockerfiles, docs. Never contracts, the set-point state machine, audit crypto, or sim physics design (§10.2).

**R6 — SimSite proves the app against a model of the site, not against the site.** It is calibrated on 3 days of data, so it reproduces the shapes in §3.2 and nothing more. The real proof is the client's dummy database (gate G7). Passing every scenario in the Test Checklist does not mean passing on their data.

**R7 — The twin is schematic, and the predictive part is indicative.** No CAD/BIM exists, `ON_FLOOR` is empty, `SERVES`/`FED_BY` edges do not exist (§3.4). Layouts are procedural or seed-authored. The what-if overlay uses a physics-lite model calibrated on 3 days and must say "indicative" in the UI.

**R8 — Platform limits you will hit.** GitHub branch protection, rulesets and auto-merge are not available on **private repos on the Free plan** (the API returns 403 "Upgrade to GitHub Pro"). Private-repo Actions minutes are capped. §10.5 gives the workaround and CI cost controls.

### 0.2 Decisions

| ID | Decision | Why | Reverse cost |
|---|---|---|---|
| DEC-1 | **One responsive React PWA, tablet-landscape first**, instead of React Native/Expo (Document 2 S6). Optional Capacitor wrapper last. | A 3D twin in React Native is the riskiest item for the budget; their own product shots are tablets. | **High: changes a committed deliverable.** Needs written OK (Q1, §14.1) before Phase 3. If they insist on RN/Expo, re-plan: L1 moves to a WebView or is cut; my guess is +150–250k tokens. |
| DEC-2 | Telemetry drivers: `CsvDriver` (reads the export directly) + `TimescaleDriver` (app store and SimSite's raw store). `InfluxDriver` is a stub behind the same interface. | No Influx access; Document 2 §2.1 itself recommends CsvDriver to start without credentials. | Low: one class per driver. |
| DEC-3 | Twin = three layers: L2 plant **SVG schematic** (Must), L3 equipment **SVG template + auto parameter list** (Must), L1 building **R3F 3D** (Should). | Mirrors how the reference product does it; SVG-first saves roughly 40–60k tokens versus all-3D (a guess; verify after T-034). | Low. |
| DEC-4 | L3 templates and L2 sensor chips bind to **semantic roles** (`supply-air-temp`), resolved per site by `data/seed/point-roles.json`, with a fallback on classification + unit. Templates never contain point abbreviations. | An abbreviation like `coollwt` in a component is site-hardcoding. Roles keep the site-agnostic rule intact. | Low. |
| DEC-5 | SimSite is a **separate system** that writes the same raw shape as the client's store. The app pulls from it through the real driver, ingest worker and quality layer. | The app must not know it is talking to a simulator. | Medium. |
| DEC-6 | "Swap to the client's dummy DB" means **a site config + column mapping; worst case one new driver class**, not "config only". | Their schema is unknown until B-03 resolves. Promising config-only is a claim we cannot back yet. | — |
| DEC-7 | Merge gate = **required CI + a `reviewed-ok` label** set by the review agent. No auto-approve, no auto-merge before review. | Agents run under your single GitHub identity, so they cannot approve your own PR; auto-merge would skip review. | Low. |
| DEC-8 | All client-derived facts live in **§3 only** (plus `data/`). Everything else in this file is generic. | One place to scrub before any public release. | — |
| DEC-9 | Floors for L1 come from a one-time **seed floor map** (name-prefix parse, lives in `data/seed/`), as a stopgap for the empty `ON_FLOOR`. Reports still group by **zone** (Document 2 §5.1). | Parsing prefixes in app code would hardcode the site; in seed data it is allowed and documented. | Low. |
| DEC-10 | Control UI keeps the reference affordance (input + green check, pencil to unlock) but **the check opens a confirm sheet that creates a request**. There is **no direct-apply path** for any control write in the prototype (Document 2's four-eyes rule: no self-approval, not even for admin). A "trusted direct write" policy would be a client decision (§14.1). | Reconciles their UX with the client's approval and audit requirement. | Low. |
| DEC-11 | Optimiser = **rule-based advisory** (Should). Chat ("Lumen"-style) and Ops overview are **Could**, read-only or synthetic, always labelled. | Document 2 §8.3 puts AI-driven optimisation out of scope. | — |
| DEC-12 | The reports' late-data policy (Document 2 D-08): every run is stamped with generation time; runs whose window ended less than 2 h ago carry a PROVISIONAL mark; the late-data count is printed. | Document 2 asks us to choose and state it in writing. | Low. |
| DEC-13 | Scenario names and sim code are **generic** (`lead-chiller-trip`, `controller-outage`). Site-specific targets live in `data/scenarios/*.yaml` and the profile. | Keeps `apps/sim` free of site strings and makes a second site possible (§6.8). | Low. |

---

## 1. Goals, client commitments, traceability

### 1.1 Goal and success criteria

Build a working, demonstrable prototype of a site-agnostic BMS/HVAC application with a digital twin, plus a simulator that lets every feature be shown and tested without the real hospital. "Done" means a mentor can, in ten minutes (§13):

1. Watch live values from SimSite appear in the app through the real ingest and quality path.
2. Open the plant schematic, click a chiller, see live tags, trigger a trip, watch the alarm and failover.
3. Run the full set-point workflow (propose, approve, apply, read-back, revert) and see every audit row, and see a tampered audit record detected.
4. Switch roles and see permissions enforced and denials audited.
5. Run five reports and open one PDF.
6. See the Test Checklist go green from automated runs.
7. Point the same app at a different site (config only) and see a different plant. (Needs the Should-tier second site, T-058.)

### 1.2 Client commitments (Document 2 §8.1) and where they live

| Doc 2 | Deliverable | Tasks (§11) | Proof |
|---|---|---|---|
| S1 | Ingestion pipeline, parser reconciled to manifest line counts | T-012, T-021 | G1 (you run it on real data locally) |
| S2 | Ontology loader: assets, types, zones, controllers, point definitions | T-010, T-022 | asset browser shows every asset with correct name/type/unit |
| S3 | Quality layer: sentinels, ranges, stopped-equipment suppression, coverage | T-013, T-021 | `sensor-garbage`, `stopped-equipment-zeros` |
| S4 | REST API with JWT | T-020, T-022 | contract tests |
| S5 | RBAC, five roles, server-side, denials audited | T-020 | role-matrix e2e |
| S6 | Mobile app, ontology-driven, zero hardcoded assets | T-030–T-032, T-052 | **PWA per DEC-1**; site-agnostic grep gate in CI |
| S7 | Browse, live values, history with resolution switching | T-031, T-032 | e2e |
| S8 | Set-point workflow against a dummy DB | T-024, T-036 | three gateway presets |
| S9 | Audit chain with tamper detection | T-023 | tamper test |
| S10 | Five reports in the agreed format | T-050 | golden files |
| S11 | Controller health with blast radius | T-025, T-037 | `controller-outage` |
| S12 | Bidirectional demo against the dummy DB | T-024, T-040, T-041, G7 | SimSite now, client dummy DB at G7 |

### 1.3 Additions beyond Document 2

Digital twin (L1/L2/L3), SimSite + Sim Console, rule-based optimiser advice, optional chat and ops overview. These are the differentiators, but they never displace S1–S12 in the cut order (§9.3).

---

## 2. Architecture

### 2.1 Three systems

| System | What it is | Port |
|---|---|---|
| **App** (`apps/web` + `apps/api`) | The product: ontology-driven UI, twin, RBAC, set-point workflow, audit, reports | web 5173, api 3000 |
| **SimSite** (`apps/sim`) | A fake hospital: physics-lite engine over a *profile*, fault layer, raw telemetry writer, mock BMS gateway (write + read-back) | 8000 |
| **Sim Console** (`apps/sim-console`) | 2D control-room page on its own server: clock, weather, faults, scenarios, gateway settings, Test Checklist | 5174 |

```
                ┌───────────── Sim Console (2D SVG, :5174) ─────────────┐
                │ clock · weather · faults · scenarios · gateway · checklist │
                └────────────────────────┬──────────────────────────────┘
                                         │ HTTP / WS
 ┌──────────────────────── SimSite (:8000) ▼ ───────────────────────────┐
 │ profile (ontology + calibration) → physics-lite engine + fault layer │
 │  ├─ writes raw points ──► site_store.points (Timescale, raw shape)   │
 │  └─ mock BMS gateway: POST /gateway/write · GET /gateway/read        │
 └─────────────▲───────────────────────────────────────▲────────────────┘
               │ pull by seq (driver: timescale-raw)   │ write + read-back (GatewayDriver)
 ┌─────────────┴────────────────── API (:3000) ────────┴────────────────┐
 │ ingest worker → quality layer → app_store (Timescale + rollups)      │
 │ ontology · RBAC · set-point workflow · audit chain · reports · floors │
 └──────────────────────────────▲────────────────────────────────────────┘
                                │ REST (WS later)
            ┌───────────────────┴─────────────────────────┐
            │ Web PWA (:5173)                             │
            │ L1 building 3D · L2 plant SVG · L3 equipment │
            │ asset browser · charts · set-points · alarms │
            └─────────────────────────────────────────────┘
```

Compose runs one Timescale/Postgres container with two databases (`site_store`, `app_store`, created by an init script) plus `api`, `web`, `sim`, `sim-console`. Neo4j is not run; the ontology loads from JSON behind an `OntologyDriver` interface.

### 2.2 What is real and what is simulated

| Real (the product) | Simulated (the stand-in for the client's world) |
|---|---|
| Ingest worker, quality layer, rollups, API, RBAC, workflow, audit, reports, UI, twin | The building's telemetry, the gateway/controller behaviour, weather, occupancy, faults |

The app is pointed at SimSite **by site config only**. The same mechanism later points it at the client's dummy DB (DEC-6).

### 2.3 Site config (server-side only; secrets never reach the client)

```jsonc
{
  "siteId": "simsite-hospital",
  "timezone": "Asia/Kolkata",
  "telemetry": {
    "driver": "timescale-raw",               // csv | timescale-raw | sim-http | influx (stub)
    "dsnRef": "env:SITE_STORE_DSN",
    "table": "points",
    "columns": { "time": "time", "measurement": "measurement", "entity": "entity_id",
                 "field": "field", "value": "value", "delayed": "is_delayed", "cursor": "seq" },
    "measurements": { "component": "components", "device": "device" },
    "cadenceSeconds": 60
  },
  "gateway":  { "driver": "sim-http", "url": "http://sim:8000/gateway" },
  "ontology": { "driver": "json", "path": "data/seed/ontology.json" },
  "pointRoles": "data/seed/point-roles.json",
  "twin":     { "layout": "data/seed/twin-layout.json" },
  "quality":  { "sentinelValues": [-273.15],
                "ranges": { "temperature": {"min": -10, "max": 90}, "pf": {"min": -1, "max": 1},
                            "frequency": {"min": 45, "max": 55}, "voltage": {"min": 0, "max": 500} },
                "suppressProcessValuesWhenStopped": true },
  "comfort":  { "bands": { "patient-room": { "coldBelow": 20, "warmAbove": 24, "hotAbove": 27 } } },
  "staleAfterCadences": 5
}
```

Quality thresholds, sentinels, comfort bands and the stale rule are **site config**, never constants (a different building may run 60 Hz or use another sentinel).

### 2.4 Driver matrix

| Interface | Implementations now | Later |
|---|---|---|
| `TelemetryDriver` (read) | `CsvDriver`, `TimescaleDriver` | `InfluxDriver` (stub, throws NotImplemented), `DynamoDbDriver` |
| `SourceDriver` (ingest cursor) | `csv`, `timescale-raw`, `sim-http` | `influx` |
| `GatewayDriver` (write + read-back) | `SimGatewayDriver` | client dummy-DB driver |
| `OntologyDriver` | `JsonOntologyDriver` | `Neo4jDriver` |

### 2.5 Repo layout (pnpm workspace)

```
apps/web            React 19 + Vite + TS + Tailwind, PWA; apps/web/e2e = Playwright
apps/api            Fastify + TS + zod; ingest worker; report queue
apps/sim            Python 3.12 + FastAPI + numpy (scikit-learn only for the surrogate)
apps/sim-console    React + Vite, 2D SVG
packages/contracts  OpenAPI + zod → generated TS client (single source of truth)
packages/twin-core  layout schema, role resolver, glyph registry, binding store, SVG components, layout generator
packages/twin-3d    L1 R3F building view (separate package so three.js stays out of the main chunk)
packages/ontology   loader, classification → renderer mapping
packages/quality    sentinel / range / stopped / consistency rules (unit-tested)
data/raw            GIT-IGNORED: client CSVs, building model xlsx, Document 2 PDF
data/calibration    small derived JSON (profiles, curves) from tools/calibrate.py
data/seed           ontology.json, point-roles.json, twin-layout.json, site configs (anonymised where committed)
data/scenarios      scenario definitions (yaml), targets resolved through the profile
tools/              calibrate.py, build_ontology_json.py, gen_twin_layout.ts
infra/              docker-compose.yml, Dockerfiles, db init
scripts/            plan.sh, ship.sh, merge.sh, check-site-agnostic.sh
docs/               PLAN.md, BURN.md, BACKLOG.md, adr/, research/, reference/
.github/            workflows, PR template, dependabot
AGENTS.md           ≤ 60 lines; every agent reads this first
```

**Site-agnostic rule (Document 2 §2.1), in two enforceable tiers** (CI script `scripts/check-site-agnostic.sh`, §10.7):
- **Tier 1, hard fail anywhere outside `data/`, test fixtures and `docs/`:** site and asset identity (`kmssh`, `Manavata`, `KIMS`, `JouleLogger`, component IDs like `kmssh-nas_224`) and the client's *distinctive* raw point abbreviations (a curated list in `data/seed/forbidden-strings.txt`, built by T-010; ordinary words such as `status`, `kw`, `current` are excluded).
- **Tier 2, hard fail only in the app's UI and domain code** (`apps/web/src/{screens,components}`, `apps/api/src/{routes,queries,services}`, `packages/{quality,ontology}`): generic equipment-type words (`chiller`, `ahu`, `fcu`, `cooling tower`). They are allowed in the twin `GlyphRegistry` and role vocabulary (`packages/twin-core/src/{glyphs,roles}`), in `apps/sim` (the sim models equipment by type, and *which* unit a scenario hits is data), and in tests.

---

## 3. Site facts (CONFIDENTIAL, client-derived)

> Everything in this section comes from Document 2 (computed from the client's 3-day export, 12–14 July 2026 IST). It is the **only** place in this file with client-derived numbers (DEC-8). Delete or generalise before any public release (T-057). Use it for sim acceptance tests, calibration targets and QA; never paste it into a free-tier model unprompted.

### 3.1 Shape of the data and ontology

| Item | Value |
|---|---|
| Window / cadence | 12–14 Jul 2026 IST, 3 days = 4,320 min, 1-minute cadence |
| `components` measurement | 12 files, 2,385,291 rows, 3,918 table blocks, 571 entities (named, typed, joined to the ontology) |
| `device` measurement | 12 files, 6,676,400 rows, 6,500 blocks, 1,949 entities (**73% unnamed**; out of scope, Document 2 D-10) |
| Row rate we must sustain | components ≈ **552 rows per sim-minute** (2,385,291 / 4,320); whole site ≈ 2,100 per minute |
| Ontology | 625 assets, 5,103 asset–point mappings, 337 point definitions, 20 controllers (JouleLogger), 536 meters, 18 zones (extracted), 13 floor nodes |
| Point classes | 17 classes exist; 13 have a renderer case (§8.3); Air Quality, Voltage, Current and Frequency sensors use the default case |
| Counts by asset type | fcu 152, circuitBreaker 98, cas 87, exhaustfan 81, ahu 44, criticalAhu 28, boosterPump 13, dashboard 11 (virtual), vav 11, radsys 9, chilledWaterPump 5, tank 5, coolingTower 4, condenserWaterPump 4, damper 4, chiller 3 (39–45 fields each), treatedFreshAir 3, pressurizationFan 3, plus one each of airCooledChiller, airwasher, airscrubber, hrvu |
| Orphans | 2 components emit data with no ontology entry (Document 2 D-01) |
| Gaps | `ON_FLOOR` empty (B-01); `SERVES`/`FED_BY` absent; only 231 of 625 assets have a named controller |

Write path facts: only **1** point definition has class `Setpoint`, yet many setpoint-like fields exist (thermostat, chiller, AHU). Editability must come from the ontology's `writable` flag, not from `cls === 'Setpoint'`. Task T-010 reports how many writable points exist and under which classes.

### 3.2 Behaviour the simulator must reproduce (acceptance targets)

| Target | Value |
|---|---|
| Mean total floor kW by hour (IST) | 00:00 34.1 · 02:00 31.1 · 04:00 **29.8 (trough)** · 06:00 30.5 · 07:00 64.7 · 08:00 54.3 · 10:00 59.7 · 12:00 68.5 · 13:00 **76.2 (peak)** · 14:00 68.9 · 16:00 60.4 · 18:00 64.3 · 20:00 52.3 · 22:00 45.0. Overall mean 51.8, min 2.8, max 136.1. Peak:trough ≈ 2.6:1. The step at 07:00 more than doubles load. |
| Chiller sequencing | lead alone 72.6% of time; lead + lag 27.2%; neither 0.2%; second standby and the air-cooled unit never run |
| Lead chiller | leaving water mean 7.93 °C (7.1–12.1, target 8.0); entering 10.99 °C (9.9–12.5); **ΔT mean 3.06 °C** (1.3–4.8); output mean 67.1 TR (0–181, nameplate 180); loading mean 35.1% (0–94); efficiency **0.47 ikW/TR** (0.2–0.8); mean kW 32.6, peak 104.0 |
| Lag chiller | runtime 27.2%, mean kW 8.9, peak 78.7 |
| Cooling tower | approach mean 1.00 °C (−1.0 to 2.8; the negative values are a data oddity, keep them as noise); range mean 3.22 °C (1.3–5.2) |
| Critical AHU (cath lab) | valve mean 95.24%, ≥ 90% for 86.0% of time, at 97% cap for 75.7%; return-air RH mean 75.85%, > 60% for 99.8%, > 70% for 76.6%; supply air mean 13.94 °C; return air mean 18.81 °C; set point 21.0 °C constant |
| Cadence and loss | ~4,311 of 4,320 timestamps per entity (99.79%); dropped polls ≈ 0.2% |
| Late data | `is_delayed_data` present on 0.181% of device rows (12,068), always 1.0 |
| Basement outage | ten assets, one floor, coverage 7.1–11.8% (308–509 of 4,320 minutes) |
| Stopped unit | the air-cooled chiller reports `status 0`, `kw 0`, and **0.0 for leaving/entering water temperature** about 4,300 times |
| Contradictory unit | one FCU reports `status 0`, `kw 0`, valve 0, `fanspeed 7` for the whole window while room temperature varies around 25.8 °C |
| Impossible values (device layer) | pf up to 10,383; set point −273.15 and up to 219; frequency up to 436.63 Hz; status up to 52,086; kW down to −1.21 and up to 3.8M; voltage up to 18,257 |

**Physics sanity (use as a sim acceptance test).** Thermal power in kW = 1.163 × flow (m³/h) × ΔT (K); 1 TR = 3.517 kW; electrical kW = TR × ikW/TR. For the lead chiller's means: 67.1 TR ≈ 236 kW thermal ≈ 66 m³/h (about 290 GPM) at ΔT 3.06 K, and 67.1 × 0.47 ≈ 31.5 kW electrical against 32.6 kW measured. The engine must keep flow, ΔT, TR and kW mutually consistent within a few percent.

Open question for `calibrate.py` (T-011): the "total floor kW" series may or may not include plant (chiller) power. Compare it with metered plant kW and record the answer in `data/calibration/README.md` before the sim sums them.

### 3.3 Document 2 findings → where this plan handles each

| Finding | Handled by |
|---|---|
| D-01 orphan entities | ingest `ingest_report` (§7.5); scenario `orphan-entities` |
| D-02 basement coverage outage | coverage metric + controller health (§7.11); scenario `controller-outage` |
| D-03 41 undocumented (derived KPI) fields | profile treats `dashboard` assets as virtual; ask client (Q-table §14.1) |
| D-04 impossible values | quality rules sentinel/range (§7.5); scenario `sensor-garbage` |
| D-05 stopped equipment reports 0.0 | stopped-equipment rule (§7.5); scenario `stopped-equipment-zeros` |
| D-06 flat signals | not an error; UI shows "flat for N h" hint only, never a fault |
| D-07 contradictory FCU | consistency rule → quality code 4 (§7.5); scenario `contradictory-fcu` |
| D-08 late data | `is_delayed` kept end to end; cursor on `seq`; DEC-12; scenario `late-data-backfill` |
| D-09/D-10 device layer anonymous | out of scope; `device` measurement ignored by default |
| B-01 empty `ON_FLOOR` | DEC-9 seed floor map |

### 3.4 Structure the app and twin can rely on

- **Floors** (13, from name prefixes): B2, B1, GF, 1F–10F, plus 34 assets with no prefix (plant, panels). Asset counts per prefix: 1F 58, 6F 48, 7F 47, 8F 42, 9F 41, 10F 40, B1 39, 3F 38, 5F 37, GF 33, 2F 31, 4F 31, B2 30. An 11th-floor KPI series exists (`11Fkw`) but no 11F prefix, so treat it as a roof/terrace pseudo-floor if the layout needs one.
- **Zones** (18, all assets covered), largest: Patient Ward 169, Plant Room 134, Utility/Electrical 83, MEP/Exhaust 44, Corridor/Support 33, ICU/Critical Care 29, Plant Room–Pumps 27, OT Complex 20, OPD/Reception 19, Radiology/Imaging 17.
- **Virtual KPI assets:** 11 `dashboard` assets carry per-floor power (`1Fkw`…`11Fkw`, `b2kw`) and per-floor efficiency (`1fikW/TR`…). They are computed upstream; the app consumes them, it does not recompute them.
- **Controllers (blast radius):** JouleLogger-1 monitors 9 assets (air-cooled chiller, all 5 chilled-water pumps, the three 180 TR chillers); JouleLogger-2 monitors 8 (all 4 condenser pumps and 4 tower fans); JouleLogger-25 monitors 37 (LT panel, emergency panels, UPS, APFC). The relationship is `Controller -[:MONITORS]-> Asset`; it is the only topology edge we can trust.
- **Plant topology (which pump feeds which chiller)** is not in the ontology. L2 schematic edges therefore come from the seed layout (§5.3), authored once, not inferred.

---

## 4. Reference UI and design language

Source: four DeJoule marketing screenshots (tablet landscape). Confidence tags: **SEEN** = visible, **GUESSED** = inferred.

### 4.1 Screen inventory

**UI-1 Chiller Plant Layout** (module "Chiller Plant Optimiser"). SEEN
- Header: hamburger, wordmark, site switcher, **weather strip** (WB/DB temperature, humidity, timezone), info icon, tools icon, bell with count, user chip with role.
- Breadcrumb `Dashboard → Hvac System → Chiller Plant`; tabs: Chiller Plant Layout, Chiller Plant Summary, BTU Meter.
- Canvas: 2D P&ID-style schematic. Blue pipes chilled water, orange condenser/hot. Green-outlined sensor chips with live °C at pipe nodes, flow arrows, `NA` for missing values, wide diagram with horizontal scroll.
- Floating **asset card** per chiller: title with capacity, rows (Average Active Power, Loading Capacity, Alarm Status, Control Type, Evaporator Flow), a mode bar (Hybrid/Recipe Mode with a pencil), then On/Off toggle + set-point input + green check, expand chevron. Per pump/VFD strip above: On/Off + "Set VFD Tr…" input + check.

**UI-2 Asset detail** (module "AHU Optimiser"). SEEN
- Asset picker, mode chip, red alert badge, kebab, settings gear.
- Left: isometric AHU illustration with **callout labels bound to live points** (Return Air, Pre-filter, Fine filter, Heaters 1/3, Valve %, Supply Air). Below: dark **control strip** (Heater Output, Valve Position, Motor Speed, On/Off toggle, Humidity Setpoint, Temperature Set Point), each an input + green check, or a pencil to unlock.
- Right: **PARAMETERS**, a scrollable two-column label/value list using the official point display names, which is the same idea as our ontology-driven `PointRenderer`.
- Flaws to avoid: raw `null` shown to users; an overlapping label.

**UI-3 Building view + chat** (modules "Digital Twin", "Lumen"). SEEN
- Left **BUILDING** list, "Live · Last 1h": per floor name, kWh (red when high), mean temperature (coloured), comfort label; includes a "Terrace plant" pseudo-floor and an electrical panel with no data (grey). Selected floor outlined.
- Centre: **3D viewer** on dark background: the floor's **CAD plan as a textured plane**, extruded equipment blocks on it, blue 3D pipe runs; buttons "Floor CAD", **Revolve**, **Expand Floors** slider; legend Cold / Comfortable / Warm / Hot / No data-off (blue, green, yellow, red, grey).
- Right: chat panel with "Traced 4 steps · 16s" (collapsible trace), plain-language answer with numbers, a **Checked** badge, a "grounded via <tool>" tag, three follow-up chips, thumbs, copy, latency. Mechanism is GUESSED (tool-using agent with a verification pass); UI is SEEN.

**UI-4 Operations overview** (module "JouleOps"). SEEN
- Range buttons (Today, This Month, 30 Days, All), date picker, SLA month picker. Tabs: Overview, Energy, SLA, Complaints, Maintenance, Site Logs, Incidents, Staffing, Inventory.
- Sections with small uppercase labels and an orange left bar: energy efficiency (high/low side, kWh/TRh), SLA site ranking with gradient bars, core operational status (open tickets, pending PM, pending site logs, open incidents), planned vs completed charts (PM by equipment category, site logs, tickets by category).
- This is a CMMS-style ops layer, not HVAC control. "JouleTick" is not visible; it may be ticketing (GUESSED; ask, §14.1).

### 4.2 Their twin, decoded

They do not use one 3D twin. They use three layers of increasing detail, all bound to the same ontology points: **L1 building** (3D, CAD plan as texture, comfort colouring), **L2 plant** (2D schematic with live tags and floating control cards), **L3 equipment** (annotated illustration, control strip, auto parameter list). The expensive-looking parts are pre-rendered images and CAD; the live binding is labels, colours and inputs. Controls live inside the picture. Their KPI is SEC in kWh/TRh, numerically equal to kW/TR, so the UI says SEC and maps it to the `ikW/TR` fields. We own no CAD and no renders, so we substitute generated SVG and procedural plans (§5).

### 4.3 Design language (observed, approximate)

- Dark deep-teal top bar, light neutral page, white cards with soft shadow, 8–12 px radius, dense but airy.
- Palette roles (eyeballed, sample from the images if you need exact): header teal ≈ `#0B3A40`; data blue ≈ `#1F5FA8`; hot/condenser/accent orange ≈ `#E8702A`; success green ≈ `#2E9E5B`; red for critical; greys for idle/no-data. The semantic conventions (blue chilled, orange hot, green OK) are industry-standard, not proprietary.
- Geometric sans, large bold tabular numerals for KPIs, small uppercase letter-spaced section labels with an accent bar.
- Patterns: sticky dark control strip, input + check to commit and pencil to unlock, toggle switches, mode chips, collapsible side panels, legends under 3D, a "beta" tag on the wordmark.
- Data states: NA/null/grey for no data; red numbers for out-of-norm.

### 4.4 Their modules → our scope

| Their module | Screen | Our build | Tier |
|---|---|---|---|
| Chiller Plant Optimiser | UI-1 | L2 plant schematic + plant summary + rule-based advice | Must |
| AHU Optimiser | UI-2 | L3 equipment screen (template + parameters + control strip) | Must |
| Digital Twin | UI-3 left/centre | L1 building 3D with generated plans, explode, revolve, comfort legend | Should |
| Lumen | UI-3 right | tool-grounded chat with trace and verification | Could |
| JouleOps | UI-4 | ops overview on **synthetic** tickets/PM/logs | Could |
| JouleTick | — | unknown; ask | Could |

### 4.5 Do it better, and branding rules

Original differentiators:
1. Show `—` plus a reason ("no data", "stale 14 min", "sensor sentinel") instead of `null` or `NA`.
2. Coverage and data-quality badges on every tile (Document 2 D-02).
3. Pan/zoom with a "fit" button instead of horizontal scroll; collapsible control cards on tablet portrait.
4. Truncation-proof labels (wrap or tooltip) and WCAG-AA contrast.
5. Chat: show provenance (tool + time window); show "Checked" only when every number in the answer appears in tool output, else "Unverified".
6. Controller blast-radius overlay on L1 and L2.

Branding: build theming as design tokens with two themes: `neutral` (default, public-safe, own name and logo) and `smartjoules` (private; colours and type from the Smart Joules Brand Bible PDF the client supplied, not from eyeballed values; keep out of any public repo unless they agree in writing). Do **not** copy the DeJoule wordmark, equipment renders, CAD plans or exact copy.

---

## 5. Digital twin (L1 / L2 / L3)

### 5.1 What exists and what does not

There is no geometry in the data: no CAD/BIM, `ON_FLOOR` is empty, `SERVES`/`FED_BY` edges are absent (§3.4). So the twin is **procedural and schematic**, driven by a layout file, not by a scanned building. Say so openly in the UI ("schematic layout"). It is still what many HVAC products show. Every visual element is data-bound to ontology points; nothing is decorative state.

### 5.2 Three layers

| Layer | Form | Tech | Fed by | Tier | Task |
|---|---|---|---|---|---|
| **L2 Plant** | 2D P&ID-style schematic, live sensor chips, floating asset cards with controls | inline SVG, CSS animation | `twin-layout.json` `plant` + binding store | Must | T-034 |
| **L3 Equipment** | SVG template per equipment family with callouts + dark control strip + auto PARAMETERS list | inline SVG + `PointRenderer` | role resolver + ontology | Must | T-034b |
| **L1 Building** | R3F 3D: stacked floors, generated plan textures, instanced equipment, comfort colouring, explode and revolve | `packages/twin-3d`, lazy chunk | layout + `floors/summary` | Should | T-035 |

If L3 has no template for a family, the screen shows the auto-generated parameter list only. If WebGL fails or the device is low-end, L1 falls back to the floor list with a comfort heat table.

### 5.3 `twin-layout.json` (per site, validated by a zod schema in `twin-core`)

```jsonc
{
  "version": 1,
  "floors": [ { "id": "F07", "name": "7F", "elevation": 7, "footprint": { "w": 60, "h": 40 }, "planImage": null } ],
  "zones":  [ { "id": "z-ward-7", "floor": "F07", "rect": [2, 2, 28, 16], "spaceType": "patient-room" } ],
  "anchors": { "<assetId>": { "floor": "F07", "zone": "z-ward-7", "xy": [10, 8] } },
  "plant": {
    "viewBox": [0, 0, 1600, 900],
    "nodes": [
      { "id": "n1", "kind": "equipment", "assetId": "<id>", "type": "chiller", "xy": [400, 520] },
      { "id": "s1", "kind": "sensor",    "assetId": "<id>", "role": "chw-leaving-temp", "xy": [380, 300] },
      { "id": "h1", "kind": "header",    "label": "CHW supply", "xy": [200, 300], "w": 1200 }
    ],
    "edges": [ { "id": "e1", "from": "n1", "to": "h1", "medium": "chilled", "flowRole": "chw-flow", "assetId": "<id>" } ]
  }
}
```

- `kind`: `equipment | sensor | valve | header | tank`. `medium`: `chilled | condenser | other`.
- `spaceType` keys the comfort bands in site config (§2.3). `planImage` optionally overrides the generated plan texture for a floor.
- Plant topology (which pump feeds which chiller) is **authored seed data**, not inferred from the ontology (§3.4). Mark generated layouts "schematic".

### 5.4 Role binding (DEC-4)

A **role** is a semantic point name from a small generic vocabulary in `packages/twin-core/src/roles.ts` (`run-status`, `fault-alarm`, `power-kw`, `loading-pct`, `chw-leaving-temp`, `chw-entering-temp`, `chw-flow`, `setpoint-chw-temp`, `supply-air-temp`, `return-air-temp`, `valve-position`, `fan-speed`, `area-temp`, `area-humidity`, `filter-status`, …). Resolution order, implemented once in `resolveRole(assetType, role)`:

1. `data/seed/point-roles.json` `byType[assetType][role]` → point abbreviation (this file may contain raw abbreviations; it is data).
2. Fallback rules in the same file: match on classification + unit + display-name pattern.
3. No match → the callout or chip renders `—` with the reason "not available at this site", and never throws.

Templates and plant nodes reference roles only. This is what makes the same SVG template work on a site whose dictionary uses other abbreviations.

### 5.5 L2 plant schematic (spec)

- Inline SVG built from `plant.nodes/edges`. Pipe colour by `medium` (design tokens, no hardcoded colours); optional overlay colouring by temperature.
- **Flow animation:** CSS `stroke-dasharray` + `stroke-dashoffset` animation; duration inversely proportional to flow; only for edges with flow above a threshold; respects `prefers-reduced-motion`. Animate nothing else.
- **Sensor chips:** green-outlined chips at pipe nodes bound to `assetId.field` through the role resolver; show `—` plus reason when missing, stale or flagged.
- **Equipment glyphs:** `GlyphRegistry` of simple SVG symbols (chiller, pump, tower, tank, valve); unknown type → generic box.
- **Asset card (floating):** title, 4–5 key points by role, alarm state, mode chip, controls generated from `writable` points; the check button opens the confirm sheet and creates a set-point request (DEC-10); never writes directly. Collapsible on tablet portrait.
- **Navigation:** pan/zoom through pointer events on the `viewBox` (no scrollbar), a **Fit** button, keyboard support.
- **Overlays:** alarm pulse outline (CSS); coverage badge on each equipment; controller blast-radius highlight (§3.4, select a controller and highlight the assets it monitors).
- Tabs: Layout (this), Summary (KPIs: kW, TR, ikW/TR, ΔT, approach, staging), later BTU meter if the data exists.
- Budgets: ≤ 400 SVG nodes, 60 fps on a mid-range tablet while animating, no SVG filters.

### 5.6 L3 equipment screen (spec)

- Header: asset picker (virtualised, grouped by type and zone), mode chip, alert badge.
- **Template:** one hand-authored SVG per family (AHU section view with filters, coil, heater, fan, valve; chiller front; FCU; pump), each ≤ 8 KB. A template declares `anchors: [{ id, role, x, y, format }]`. Template choice comes from `templateRegistry[assetType]`. **Original artwork only.**
- **Control strip:** dark strip generated from the asset's `writable` points: widget by classification (input + check for numeric, toggle for on/off, pencil to unlock), each action goes through the request flow.
- **PARAMETERS list:** two-column list of every point rendered by `PointRenderer` (§8.3): alarms first, then status, then the rest; `—` with reason for missing; coverage and stale badges.
- Missing template → the parameter list only. This is always available.

### 5.7 L1 building 3D (spec)

- Stacked floor planes at `y = i × gap × explode`, an **Expand Floors** slider and **Revolve** (`OrbitControls autoRotate`).
- Per-floor **plan texture generated to a canvas** from zone rectangles and labels (thin CAD-like lines), ≤ 1024² per floor, disposed on unmount; optional per-floor image override from the layout.
- **Instanced boxes** for equipment (one `InstancedMesh` per type); positions from `anchors`; pipe tubes only for the main riser and headers (≤ 20).
- **Comfort colouring** per zone or floor from site-config bands: Cold / Comfortable / Warm / Hot / No data (blue, green, yellow, red, grey), with a legend. Colours are updated imperatively from the store, not by re-rendering React.
- Left **floor list** from `GET /sites/:s/floors/summary` (kWh, mean °C, comfort); selecting an item focuses the floor (camera tween).
- Budgets (my targets, measure and report): draw calls ≤ 150, triangles ≤ 150k, ≥ 30 fps on a mid-range phone, 3D chunk lazy-loaded.
- Rules: `Canvas frameloop="demand"` and `invalidate()` on data change or interaction; DPR capped at 1.5; no shadows; no post-processing except optional selective bloom on alarms; create geometry and materials once, dispose in cleanup; always ship the 2D fallback.

### 5.8 Binding store

One zustand store keyed by `assetId.field` → `{ v, q, at }` (value, quality code, timestamp). Fed by polling (30 s, `latest` endpoint, Cache-Control 15 s) or WebSocket later. Apply each payload in a single `set`. Components subscribe to the **one key** they need. Do not store Three.js objects in the store. Instanced 3D reads `getState()` inside `useFrame` or on `invalidate`.

### 5.9 Interactions in priority order

1. Click-select anywhere opens the side panel or card using `PointRenderer`.
2. L2 controls through the request flow; L3 control strip.
3. L1 heatmap toggle (temperature / humidity / kW) and alarm highlight.
4. Blast-radius overlay on L1 and L2.
5. **What-if panel** (Should): change CHW set point → `POST /sim/whatif` → ghost overlay of predicted kW and ΔT, labelled "indicative, 3-day calibration".
6. Time scrubber replaying hourly rollups (ties to the 90-day degradation view).

### 5.10 Layout generator (proves site-agnosticism)

`tools/gen_twin_layout.ts` takes `ontology.json` plus the seed floor map. With no layout shipped it generates one: floors by grouping, squarified zone packing sized by asset count, equipment anchors on a grid inside each zone, plant nodes on a row ordered towers → condenser pumps → chillers → chilled-water pumps → headers, with edges joined by type adjacency. This is **heuristic and schematic, not hydraulic truth**; label it in the UI. Ugly but functional is the acceptance bar.

### 5.11 Tooling, plugins, assets

No special plugin is needed: L1 is React Three Fiber + drei + zustand; L2/L3 are plain SVG. What helps agents are skills (§10.4): `r3f-best-practices` and `three-best-practices` for the L1 agent only, `frontend-design` for UI and SVG art. Do not hand-model in Blender. If you later want nicer glyphs, use free glTF models through `useGLTF`, optimise with `gltf-transform`, and check each licence. Pin versions with task T-002 (R3F v9 pairs with React 19; v8 with React 18).

---

## 6. SimSite and Sim Console

### 6.1 Honest description

SimSite is **calibrated physics-lite plus replayed real patterns**, not magic ML. Three days of data cannot support forecasting, so:
- Hourly shapes and noise come from `data/calibration` (§3.2 targets).
- Zones follow a first-order thermal model; the plant follows load → staging → efficiency curve → tower approach.
- ML appears in exactly one honest place: a small surrogate for chiller kW (§6.4), validated on a held-out day, with the validation error shown in the console. Do not call anything "AI-predicted" unless the numbers back it.
- The mess is real: sentinels, out-of-range values, stopped units reporting zero, dropped polls, delayed backfill, orphan IDs, contradictory units, controller outages, counter resets, injected by a fault layer using the measured rates in §3.2.

The engine reads a **profile** (`ontology.json` + calibration JSON + scenario yaml). It contains no site strings (DEC-13), which is what allows the second site in §6.9.

### 6.2 Raw store contract (mimics the client's raw shape)

```sql
-- database site_store
CREATE TABLE points (
  seq         BIGSERIAL,
  time        TIMESTAMPTZ NOT NULL,        -- event time, sim clock, UTC
  measurement TEXT NOT NULL,               -- 'components' | 'device'
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,
  value       DOUBLE PRECISION,
  is_delayed  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (time, seq)                  -- a hypertable key must include time
);
CREATE INDEX ON points (seq);
SELECT create_hypertable('points', 'time', chunk_time_interval => INTERVAL '1 day');
-- dev retention: 7 days
```

- **The ingest cursor is `seq`, not event time.** Late backfill rows carry old timestamps; a time cursor would skip them (Document 2 D-08). The Influx stub would need a time cursor with an overlap window instead.
- In the client's export, `is_delayed_data` is a *field* (value 1.0) on the `device` measurement. The CSV driver (T-012) maps it onto `is_delayed`. SimSite writes the column directly.

### 6.3 SimSite API

| Endpoint | Purpose |
|---|---|
| `POST /sim/clock {scale, paused, seek}` · `GET /sim/state` | clock control (scale 1× to 600×), state including `ingestLagSeconds` |
| `GET /sim/scenarios` · `POST /sim/scenarios/{name}/start\|stop` | scenario runner, every start takes a `seed` |
| `POST /sim/faults {type,target,params,duration}` · `DELETE /sim/faults/{id}` | manual fault injection |
| `POST /sim/env {outdoor_dbt, rh, occupancy_mult}` | weather and occupancy; wet-bulb derived (Stull approximation) |
| `POST /sim/modes {asset, controlType}` | control-mode state (Auto / Manual / Local / Hybrid / Recipe, **semantics guessed**, §14.3) |
| `POST /gateway/write {asset, point, value, idempotencyKey}` → 202 | mock BMS write |
| `GET /gateway/read?asset&point` | read-back of the **actual** equipment value (not the telemetry stream) |
| `PUT /sim/gateway {preset, latencyMs, failureRate}` | gateway presets below |
| `POST /sim/whatif {changes[], horizonMin}` | predicted series, never mutates state |
| `GET/POST /sim/checklist` | Test Checklist state (§6.8) |
| `WS /sim/stream` | live state for the console |

**Gateway presets:** `ok` (apply after latency), `reject` (HTTP 409 with reason), `ignore` (202 but value unchanged, tests read-back mismatch), `apply-then-alarm` (applies, then raises an alarm inside the watch window, tests auto-revert), `drift` (applies value ± more than tolerance), `local-mode` (rejects writes when the asset's control type is Local). The gateway has **no authentication**: it lives on the compose network only and is never exposed.

### 6.4 Engine design

**Time stepping.** One sim-minute per step; Euler integration is valid because the zone RC time constant is hours (assert `dt ≤ RC/10`, otherwise substep). Checkpoint the full state every sim-hour; `seek` restores the nearest earlier checkpoint and re-runs at most 60 steps.

**Determinism.** Each scenario takes a `seed`. Noise is a stateless hash of `(seed, entity, field, t)`, so seeking and replay are exact. Same seed and same sim version produce an identical `points` export for a fixed window.

**State and equations**
- **Weather:** diurnal dry-bulb curve (min/max from the profile) + slider offset; RH moves inversely; wet-bulb via the Stull approximation.
- **Occupancy/load:** the hourly curve in §3.2 normalised into a multiplier, with block-bootstrap residual noise from real hours; internal gain per zone = base × multiplier × slider.
- **Zones (≈ 224 FCU/AHU loops):** `C·dT/dt = (T_out − T)/R + Q_int − Q_cool`, with `Q_cool = valve × Q_max`; the valve follows a PI controller with anti-windup toward the thermostat set point; vectorised in numpy.
- **Plant:** CHW load = Σ valve × Q_max (kW thermal) → TR. Flow comes from a pump rule fitted so that ΔT emerges at ≈ 3 K at part-load (low-ΔT behaviour is a result, not a hardcode); ΔT = Q / (1.163 · flow).
- **Staging:** lead always on; lag stages in above ~85% lead loading for 10 min and out below ~55% for 15 min; 10-min minimum on/off; standby promotes on a fault. Thresholds are calibration parameters tuned so the lag-unit runtime share matches the §3.2 target.
- **Chiller power:** `kW = TR × eff(PLR, T_cond_ent, T_chw_leave)` where `eff` is a quadratic in PLR plus a condenser-temperature term, fitted so mean efficiency matches the §3.2 target. **Surrogate:** gradient-boosted regressor of kW on (TR, leaving temp, condenser entering temp), trained on days 1–2 and validated on day 3. Trees do not extrapolate, so use the surrogate only inside the training envelope (± 5%); outside it (for example `heatwave`) fall back to the parametric curve. The condenser sensitivity used there is an **assumption** (default about 2.5% per K, to be replaced with a fitted or sourced value) and the console flags "assumption" when it is active. Show validation error and envelope-usage % in the console. If validation error is poor, the curve is used throughout.
- **Tower:** `approach = a0 + a1·load + fouling(t) + noise`; `T_cond_ent = T_wb + approach`; heat rejection = thermal load + compressor kW.
- **Modes:** each controllable asset has a control type that gates gateway writes.
- **Counters:** cumulative kWh/kVAh integrate power monotonically; the fault layer can reset them.
- **Alarms:** derived from thresholds and faults (trip, high temperature, comms loss).

**Volume and speed.** The component row rate per sim-minute is in §3.1: at 60× the writer emits that many rows per second, at 600× ten times as many. The writer batches with `COPY`. The console auto-throttles the scale when `ingestLagSeconds` grows, and the ingest worker must sustain ≥ 6k rows/s in batches. A 90-day run at full cadence would be tens of millions of rows (the §3.1 rate × 129,600 minutes), so **`fouling-90d` runs in coarse mode**: plant-only subset, hourly points (~130k rows), served through a separate site config with `cadenceSeconds: 3600` (compose profile `coarse`). It still goes through the normal ingest and rollups.

### 6.5 Fault layer

Types and defaults (rates from §3.2, all configurable): `sentinel` (−273.15 on set-point and temperature fields), `out-of-range` (pf, frequency, voltage, status spikes), `dropped-polls` (~0.2%, bursts allowed), `delayed-backfill` (`is_delayed` bursts with old timestamps), `orphan` (IDs unknown to the ontology), `stopped-zero` (stopped units report 0.0 for process values; a **baseline behaviour** for flagged assets, not only a scenario), `contradictory` (status 0 with fan speed stuck at 7), `controller-outage` (every asset a controller monitors stops reporting), `counter-reset`, `flatline` (stuck sensor), `negative-kw`. Faults mutate the *emitted* rows only; the physics state stays truthful, so the app's quality layer can be tested against known ground truth.

### 6.6 Scenario catalogue

Scenarios are yaml timelines of env and fault events in `data/scenarios/`; targets are resolved through the profile (DEC-13). **Core = tier Must** (8 scenarios + 3 gateway presets).

| Scenario | Tier | Injected behaviour | App proof (Doc 2 ref) |
|---|---|---|---|
| `normal-day` | core | calibrated baseline | live values, charts, load-curve shape |
| `heatwave` | core | +6 °C outdoor | lag stages in, approach widens, alarms, surrogate falls back to curve |
| `lead-chiller-trip` | core | lead chiller trips | alarm, failover to standby, kW shift, twin turns red |
| `controller-outage` | core | one controller's assets stop (coverage in the §3.2 basement-outage band) | coverage CRITICAL, controller health, blast radius (D-02) |
| `sensor-garbage` | core | sentinels, pf 10383, 436 Hz | quality flags; averages not poisoned (D-04) |
| `stopped-equipment-zeros` | core | idle unit reports 0.0 water temps | plant average excludes it (D-05) |
| `critical-ahu-drift` | core | critical AHU valve ≥ 97%, RH > 60% | Critical Environment report excursions (O-02) |
| `low-delta-t` | core | ΔT ≈ 3 K | optimiser recommendation fires (O-03) |
| gateway `ok` / `reject` or `ignore` / `apply-then-alarm` | core | gateway presets (§6.3) | every workflow state + audit rows (S8) |
| `monday-surge` | later | 07:00 ramp × 2 | energy report, peak detection |
| `late-data-backfill` | later | burst of `is_delayed` | report regeneration changes, flag carried (D-08) |
| `orphan-entities` | later | IDs unknown to ontology | ingest report lists them (D-01) |
| `contradictory-fcu` | later | status 0, fan speed 7 | consistency flag (D-07) |
| `counter-reset` | later | cumulative kWh resets mid-window | energy report not over-counted (§7.10) |
| `fouling-90d` | later | approach widens over 90 sim-days, coarse mode | degradation view in plant report |
| `replay-real` | local only | streams the real export through the raw store | never in CI; needs `data/raw` |

### 6.7 Acceptance tests for the sim (proposed tolerances)

Each is a pytest on a fixed seed and window: mean ikW/TR within ± 0.03 of the §3.2 value; mean ΔT within ± 0.3 K of the §3.2 value; lead-alone runtime share within ± 5 points of §3.2; hourly load curve within 10% of §3.2 per hour; dropped-poll rate within ± 0.1 point of §3.2; physics sanity (§3.2) within 5%; entities per type match the profile; determinism (identical export on a rerun); every injected fault produces the expected quality code downstream (cross-checked in the e2e suite).

### 6.8 Sim Console (2D SVG, separate server)

Panels: clock (pause, 1×–600×, seek), weather and occupancy sliders, fault buttons with target pickers, scenario runner, gateway settings (preset, latency, failure rate), a live mini-schematic of the plant (reuses `twin-core` glyph colours), surrogate validation readout, and the **Test Checklist**.

**Test Checklist protocol.** `data/scenarios/features.yaml` lists features: `{ id, title, scenario, docRef }`. Each Playwright test starts its scenario (seeded), waits on app state (never sleeps), asserts, then `POST /sim/checklist {featureId, status, runId, evidence}`. The console renders feature, scenario, last run time, pass/fail and a link to the trace. This checklist is the mentor demo (§13).

### 6.9 Second synthetic site (Should, T-058)

A generated `office-small` profile (~90 assets, 4 floors, an air-cooled chiller, AHUs and FCUs, no cooling towers or condenser pumps). Run SimSite against it and point the app at it by site config: the plant schematic shows a different plant, the asset browser a different tree, and the site selector lists two sites. It is the cheapest proof of the client's hardest requirement, and it also drives the row-level-security isolation test (§7.4).

---

## 7. Backend and domain spec

This section is the digest of Document 2 (chapters 2, 4, 5) plus the corrections found while merging. Agents implement from here, never from the PDF.

### 7.1 Principles

- **Contracts first:** zod schemas + OpenAPI in `packages/contracts`, generated TS client; nobody invents endpoints.
- **Site-agnostic:** everything site-specific comes from the ontology, site config, `point-roles.json` and the layout (§2.5 rule).
- **Quality:** bad values are kept but marked (`value` NULL + `quality` code), never deleted, never averaged.
- **Time:** UTC internally; ISO-8601 with offset at the API edge in site timezone (`Asia/Kolkata`); the app never does timezone maths.
- **Audit:** every mutation is recorded by a global hook, never by hand per route.
- **Idempotency:** `Idempotency-Key` is required on `POST`s that cause equipment writes (propose and approve).
- Plain SQL migrations; no ORM for telemetry.

### 7.2 Interfaces

```ts
export interface TelemetryDriver {
  latest(siteId: string, entityId: string): Promise<Record<string, { value: number | null; at: string; quality: number }>>;
  series(q: SeriesQuery): Promise<Point[]>;                       // raw | 1h | 1d
  counterDelta(q: CounterQuery): Promise<{ delta: number; resets: number }>;
  coverage(siteId: string, entityId: string, from: string, to: string):
    Promise<{ expected: number; received: number; pct: number }>;
}
export interface SourceDriver {            // used only by the ingest worker
  next(cursor: string | null, limit: number): Promise<{ rows: RawRow[]; cursor: string }>;
}
export interface GatewayDriver {
  write(req: { siteId: string; assetId: string; point: string; value: number; idempotencyKey: string }):
    Promise<{ accepted: boolean; reason?: string }>;
  read(siteId: string, assetId: string, point: string): Promise<{ value: number | null; at: string }>;
}
export interface OntologyDriver { load(siteId: string): Promise<Ontology>; }
```

The driver for a site is chosen by site config, never by a code branch on site name.

### 7.3 Ontology model

Nodes: `Site{id,name,timezone}`, `Floor{id,name,level}`, `Zone{id,name}`, `Asset{id,name,type,criticality}`, `Point{abbr,display,unit,group,cls,source,writable,safeMin,safeMax}`, `Controller{id,name,deviceId}`, `Meter{deviceId,name,model}`. Edges: `HAS_ASSET`, `ON_FLOOR` (**empty** in the client model; DEC-9), `IN_ZONE`, `HAS_POINT`, `MONITORS` (controller → asset), `METERED_BY`, `SERVES`/`FED_BY` (absent). Component IDs are strings, never integers.

### 7.4 Storage (database `app_store`)

```sql
CREATE TABLE telemetry (
  time TIMESTAMPTZ NOT NULL, site_id TEXT NOT NULL, entity_id TEXT NOT NULL,
  entity_kind TEXT NOT NULL,                   -- component | device
  field TEXT NOT NULL,
  value DOUBLE PRECISION,                      -- NULL when invalid
  raw_value DOUBLE PRECISION,                  -- original reading, kept only when quality <> 0 (the evidence)
  quality SMALLINT NOT NULL DEFAULT 0,         -- 0 ok, 1 sentinel, 2 out of range, 3 stopped equipment, 4 inconsistent
  is_delayed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (site_id, entity_id, field, time)   -- idempotent ingest; late rows upsert (changes Document 2's schema on purpose)
);
SELECT create_hypertable('telemetry', 'time', chunk_time_interval => INTERVAL '1 day');

CREATE MATERIALIZED VIEW telemetry_hourly WITH (timescaledb.continuous) AS
SELECT time_bucket(INTERVAL '1 hour', time) AS bucket, site_id, entity_id, field,
       avg(value) FILTER (WHERE quality = 0) AS avg_value,
       min(value) FILTER (WHERE quality = 0) AS min_value,
       max(value) FILTER (WHERE quality = 0) AS max_value,
       count(*)   FILTER (WHERE quality = 0) AS good_samples,
       count(*)   FILTER (WHERE is_delayed)  AS late_samples,
       count(*)                              AS total_samples
FROM telemetry GROUP BY bucket, site_id, entity_id, field;
```
A `telemetry_daily` view follows the same pattern. Dashboards hit rollups, never raw data. `good_samples / expected` is the coverage figure surfaced in the UI.

Gotchas to handle explicitly:
- A continuous aggregate's refresh policy must have `start_offset` ≥ the maximum lateness you accept (default 48 h). Backfill older than that needs a manual `refresh_continuous_aggregate`.
- Compression and retention policies (Document 2: compress after 7 d, retain 90 d) are **Should** and off in the dev compose; keep recent chunks uncompressed so late rows upsert cheaply.
- Other tables: `users`, `user_sites`, `refresh_tokens`, `assets` (materialised from the ontology on load for report joins), `setpoint_requests`, `audit_log`, `ingest_cursor`, `ingest_report`, `report_runs`, `alarms`, `schedules`, `overrides`.
- **Row-level security (Should):** enable RLS on tenant tables with `site_id = ANY(string_to_array(current_setting('app.user_sites', true), ','))`, set per request with `SET LOCAL app.user_sites = ...` from the verified JWT. Test with two sites (T-058).

### 7.5 Ingest worker and quality layer

Worker loop, per batch, in one transaction (so cursor and data advance together):

1. `SourceDriver.next(cursor, limit)`. Only the `components` measurement by default (`device` ignored, D-10).
2. Map entity → ontology asset and point. **Unknown entity:** keep the rows, and record entity, first/last seen, row count and fields in `ingest_report` (D-01); never silently drop.
3. **Sentinel** values from site config → `value` NULL, original kept in `raw_value`, quality 1.
4. **Range** rules from site config keyed by classification or parameter group (not by abbreviation) → NULL (original in `raw_value`), quality 2. A binary `status` field above 1 is out of range.
5. **Stopped equipment:** join with the asset's `run-status` role value at the same timestamp (nearest within one cadence). If it is 0 and the field is a **process value** (classes Temperature / Pressure / Flow Sensor, configurable), set NULL (original in `raw_value`), quality 3. Counters, status, set points and alarms are never suppressed.
6. **Consistency rules** from config (for example `{ when: run-status = 0, then: fan-speed must be 0 }`): the dependent value is kept with quality 4 and the pair is reported; do not guess which side is wrong (D-07).
7. Carry `is_delayed`. Upsert on the primary key.
8. Advance `ingest_cursor` in the same transaction.

Coverage = distinct minute buckets with at least one row ÷ expected (window ÷ `cadenceSeconds`). Dropped polls are simply absent rows. Default flags: CRITICAL below 20%, WARNING below 50% (config). Unit-test the quality layer with table-driven tests only.

### 7.6 Set-point workflow (the most intricate piece)

| State | Entered when | Exits to | Timeout |
|---|---|---|---|
| PENDING | proposal accepted | APPROVED / REJECTED | auto-expire after 24 h |
| REJECTED | approver declines | terminal | — |
| APPROVED | approver accepts | APPLYING | must dispatch within 15 min |
| APPLYING | command sent to gateway | APPLIED / FAILED | 60 s to read-back |
| APPLIED | read-back within tolerance | REVERTED if an alarm fires | 30 min watch window |
| FAILED | read-back mismatch, rejection or no acknowledgement | terminal, alarm raised | — |
| REVERTED | alarm in watch window, or manual rollback | terminal | — |

- `DRAFT` (Document 2) is a **UI-only** state. The server creates the request directly in PENDING after the guards pass (422 out of range, 400 missing justification); the audit trail starts at `setpoint.proposed`.
- **Guards:** justification present; value within the point's `safeMin`/`safeMax` from the ontology (an out-of-range value never enters the workflow); approver has `setpoint:approve` and **is not the requester** (also for admin); the asset's control mode permits the write (a Local mode rejects at proposal time, 422 `CONTROL_MODE_BLOCKED`).
- **One live request per point:** a partial unique index on `(site_id, asset_id, field)` where state is PENDING, APPROVED or APPLYING; violating it returns 409 `SETPOINT_REQUEST_CONFLICT` with the existing request ID.
- **APPLYING:** capture `beforeValue`, call `GatewayDriver.write`, then poll `read` until the value is within the point's tolerance (default configurable) or 60 s pass. **A command that was sent is not a command that took effect.** Mismatch or a rejected write → FAILED.
- **REVERTED:** write `beforeValue` back through the gateway and verify it the same way; if the revert read-back fails, raise a critical alarm.
- Timeouts run in one scheduler loop (5-second tick) that selects due rows and performs each as a normal audited transition.
- `effectiveFrom` and `revertAt` from Document 2's example are optional; the scheduler honours them if present.
- **Every transition is audited**, in the same transaction as the state change, with before/after state and value, actor and justification.
- Tests: table-driven for every edge and guard, a fake gateway, and one end-to-end per gateway preset (§6.3).

### 7.7 RBAC (five roles, enforced server-side; the UI only hides)

| Resource / action | Admin | Engineer | Fac. Manager | Operator | Executive |
|---|---|---|---|---|---|
| Telemetry, ontology, alarms, set points, schedules — read | ● | ● | ● | ● | ● |
| Alarms — acknowledge | ● | ● | ● | ● | – |
| Set point — propose | ● | ● | – | – | – |
| Set point — approve | ● | – | ● | – | – |
| Schedule — write | ● | ● | ● | – | – |
| Override — create | ● | ● | ● | – | – |
| Override — approve | ● | – | ● | – | – |
| Report — run | ● | ● | ● | ● | ● |
| Report — export | ● | ● | ● | – | ● |
| Audit — read | ● | ● | ● | – | ● |
| Audit — export | ● | – | ● | – | – |
| User — manage | ● | – | – | – | – |
| Site — configure | ● | – | – | – | – |

Every denial is written to the audit log. Admin actions are audited the same way (no weaker).

### 7.8 Audit trail

Logged events: login/logout (user, time, IP, device, outcome), permission denied (user, site, resource, action), set-point transition, override created/expired, schedule modified (full before/after), report exported (user, report, parameters, format, row count), user or role changed.

Hash chain, with three corrections to Document 2's sketch:
1. **Sign every persisted field** (add `justification`, `approverId`, `ip`, `device`); Document 2's payload omitted them, so tampering with a justification would go undetected.
2. Use **canonical JSON** (sorted keys) for the payload so verification never fails from key order.
3. **Serialise writers per site** (`pg_advisory_xact_lock(hash(site_id))`, then read the last signature) so concurrent inserts cannot fork the chain.

`signature = HMAC-SHA256(key, canonical(record) + prevSignature)`. `GET /sites/:s/audit/verify` walks the chain and returns the first broken ID. The key comes from env for the prototype (`AUDIT_HMAC_KEY`); long-term key custody is out of scope. A test modifies one stored row by SQL and asserts verification fails at that row and every later one.

### 7.9 API catalogue (`/api/v1`)

| Method and path | Roles | Purpose |
|---|---|---|
| `POST /auth/login` · `/auth/refresh` · `/auth/logout` | public / public / any | token pair, refresh, revoke |
| `GET /me` · `GET /sites` · `GET /sites/:s` | any | user + permissions, sites, site summary incl. `environment` (WB/DB/RH, timezone) |
| `GET /sites/:s/ontology` · `/assets` · `/assets/:a` | any | tree, filterable list, one asset with points |
| `GET /sites/:s/assets/:a/latest` · `/telemetry` · `/coverage` | any | latest, series (raw / 1h / 1d), coverage |
| `GET /sites/:s/floors/summary?window=1h` | any | `[{id,name,kwh,avgTempC,comfort,hasData}]`; "plant" pseudo-floor allowed (new) |
| `GET /sites/:s/plant/kpis?window=` | any | plant kW, TR, SEC (ikW/TR), ΔT, approach, staging (new, role-resolved) |
| `GET /sites/:s/controllers` | any | health and blast radius |
| `GET /sites/:s/setpoints` · `GET /setpoint-requests` | any | writable points, queue by state |
| `POST /sites/:s/setpoints/:a/:f` | admin, engineer | propose |
| `POST /setpoint-requests/:id/approve` · `/reject` | admin, fac. mgr | decide |
| `GET/POST/PUT /sites/:s/schedules` · `POST /sites/:s/overrides` · `GET /sites/:s/overrides/active` | per §7.7 | schedules, overrides (Should) |
| `GET /sites/:s/alarms` · `POST /sites/:s/alarms/:id/ack` | any / not executive | alarms |
| `GET /reports` · `POST /reports/:key/run` · `GET /reports/runs/:id` | any | report definitions, queue, status + download |
| `GET /sites/:s/audit` · `/audit/export` · `/audit/verify` | per §7.7 | query, signed export, chain verification |
| `GET /users` + CRUD | admin | users |
| `WS /sites/:s/live` | any | live subscription (Could; polling is the default) |

**Cross-cutting:** pagination `?limit=&cursor=` (default 50, max 200); rate limits 120 req/min per user for reads, 10/min for writes, 5/min for report runs; `Cache-Control`: ontology 300 s, historical telemetry 300 s, latest 15 s, set points `no-store`; errors always `{error, code}` with stable machine codes; telemetry responses always carry a `quality` block (`expectedSamples`, `goodSamples`, `coveragePct`, `hasDelayedData`) and each bucket carries `n` so a chart can mark a partial hour.

### 7.10 The five reports

Queue-based: a `report_runs` table polled by a worker with `FOR UPDATE SKIP LOCKED` (no new infrastructure). Outputs: PDF (HTML template → Playwright `page.pdf`), XLSX (exceljs), CSV. Every export is audited. Golden-file tests run against a pinned dataset in `data/seed/golden/`, generated by the sim at a recorded version (regenerate deliberately when the physics changes). Per DEC-12, every run is stamped with generation time, a late-sample count, and a PROVISIONAL mark if the window ended under 2 h ago. "Prescribed format" is unknown (Q-table §14.1), so templates are configurable.

| # | Report | Persona | Method and rules | Format |
|---|---|---|---|---|
| 1 | Energy by zone | Fac. manager, executive | Group by **zone** (floor is not populated). Counter consumption = **sum of successive positive differences** of good samples per asset, with the reset count reported. *Document 2's `max − min` query over-counts across a reset; do not use it.* Percent of total per zone. | PDF + XLSX + CSV |
| 2 | Chiller plant performance | Engineer | Runtime hours, mean/peak kW, mean ikW/TR, ΔT, tonnage, tower approach; stopped-equipment values excluded; **degradation view** (month-over-month ikW/TR and approach; the `fouling-90d` run exercises it) | PDF with charts + CSV |
| 3 | Set-point and override audit | Fac. manager, executive, compliance | From the audit table only. **Collapse and flag rapid reversals** (two changes that cancel within 60 s). | signed PDF + CSV; export audited |
| 4 | Equipment health and coverage | Engineer, operator | Active alarms, trip/fault counts, assets below coverage threshold, controllers with stale data, quality-flagged readings. Suitable for a scheduled daily email (Could). | PDF + CSV |
| 5 | Critical environment compliance | Fac. manager, clinical engineering | Scope: critical AHU assets. Time in range for temperature and humidity, valve saturation, excursion list with durations. **Thresholds come from site config, never from us**; with none configured the report runs in informational mode (no pass/fail) and says so (B-06). Present observations with their numbers, never as a compliance judgement. | PDF designed to be filed |

### 7.11 Controller health and staleness

`GET /sites/:s/controllers`: per controller, last-seen = latest event time among its monitored assets' entities, coverage over the window, and the monitored asset list (blast radius). Stale when `siteNow − lastSeen > staleAfterCadences × cadence`. **`siteNow` is the site's latest ingested event time**, not the wall clock, because the sim clock differs from wall time and replayed exports are old by definition (config `useWallClock: true` for production).

### 7.12 Alarms, schedules, overrides, chat tools

- Alarms open and close on transitions of points classified Alarm/Fault; acknowledgement is by permission and audited.
- Schedules and overrides (Should) are stored, audited and shown; executing them against the gateway goes through the same request flow and is Could.
- Chat tools (Could, read-only): `energy_summary`, `asset_latest`, `alarms_active`, `coverage`, `compare_periods`, `sec_trend`.

---

## 8. App UI spec

### 8.1 Form factors

Design **tablet-landscape first** (1180 × 820), then tablet portrait (820 × 1180), phone (390), desktop (1440). At ≥ 1024 px use side-by-side panels; 640–1023 px collapsible panels; below 640 px single column with bottom navigation. Touch targets ≥ 44 px. Required screenshots per UI task: 390, 820, 1180×820, 1440.

### 8.2 App shell

Header: hamburger, product mark, site switcher, **weather strip** (WB, DB, RH, timezone, from the site `environment` block), info and tools icons, alarm bell with count, user chip with role. Below: breadcrumb and tabs. Collapsible side panels. Theme tokens only (no hardcoded colours).

### 8.3 `PointRenderer` (ontology-driven; Document 2 §2.1)

One component, switching on point classification. Nowhere in it may asset-type or site words appear.

| Classification | Renders as | Interaction |
|---|---|---|
| Temperature / Humidity / Pressure / Flow Sensor | value + unit + sparkline, colour-scaled | tap for history |
| Power/Energy Meter | instantaneous value; cumulative counters as **period deltas** | tap for consumption chart |
| Status/Control | pill: Running / Stopped | read-only |
| Alarm/Fault | badge, red when asserted, raised to top of lists | tap for detail |
| Actuator/Position | horizontal bar 0–100% | read-only |
| Setpoint (and any `writable` point) | value + unit + edit affordance if permitted | edit → request flow |
| Mode/Control | enumerated label | read-only |
| Calculated KPI | value + trend arrow vs previous period | tap for trend |
| Count | integer | read-only |
| Other, Air Quality, Voltage, Current, Frequency | value + unit if known (default case) | read-only |

Editability is decided by `writable` + permission, not by classification alone (§3.1). Every value renders one of: **live**, **stale** (older than the site's stale rule), **flagged** (quality ≠ 0, show the code's meaning), **missing** (`—` plus reason), with a **coverage badge** where coverage is below threshold.

### 8.4 Screens

Login · site selector · dashboard (active alarms, plant KPIs, coverage tiles) · asset browser (virtualised; filter by type, zone, and floor when available) · **asset detail = L3** · charts (resolution switching, ≤ 500 points per series, partial hours marked) · **plant = L2** · **building = L1** · set-point queue and detail (state timeline, read-back result) · alarms · controller health with blast radius · reports (run, poll, download) · audit (read, verify badge) · users (minimal admin).

### 8.5 Control UX

Input + green check commits, pencil unlocks (DEC-10). The check opens a **confirm sheet**: current value, new value, safe range, justification (required), optional effective window and revert time, the roles that can approve. Buttons the role lacks permission for are disabled with a tooltip; the server remains the authority. The detail view shows the request's state timeline and the read-back outcome.

### 8.6 PWA

Web manifest and icons, installable on tablet and phone. The service worker caches the app shell and ontology GETs (stale-while-revalidate). It **never caches or queues writes** (offline writes are out of scope, Document 2 §8.3). Show an offline banner and mark stale readings. Capacitor wrapper only if mentors insist on a native app (Could).

### 8.7 Performance and accessibility

Virtualise every long list; never fetch raw minutes for windows over ~6 h (use rollups); lazy-load the 3D chunk; WCAG AA contrast; keyboard navigation; respect `prefers-reduced-motion`; labels wrap or show tooltips instead of truncating or overlapping; never show `null` or `NA` to a user.

---

## 9. Scope tiers, budget, cut order

### 9.1 Tiers

| Tier | Items |
|---|---|
| **Must** | Document 2 S1–S12 (§1.2): ingest + quality, ontology-driven asset browser and charts, RBAC with five roles, set-point workflow with audit hash chain, five reports, controller health. Plus: SimSite with the 8 core scenarios and 3 gateway presets, Sim Console with Test Checklist, **L2 plant schematic and L3 equipment screen**, floors/summary endpoint, compose + CI with the site-agnostic gate. |
| **Should** | **L1 building 3D**, what-if overlay, rule-based optimiser advice, schedules/overrides CRUD, second synthetic site (T-058), PWA polish, RLS isolation test, compression/retention policies, remaining scenarios. |
| **Could** | Chat panel with tool trace, ops overview on synthetic data, time scrubber, WebSocket live (else 30 s polling), Capacitor APK, Neo4j and Influx drivers, scheduled emailed reports, public-release sanitise (T-057). |

### 9.2 Token budget

Estimates, not measurements (R4). Record real burn per task in `docs/BURN.md` (columns: task, agent/model, tokens in, tokens out, turns, outcome) and compare at each gate. If cumulative burn at gate G2 exceeds 60% of the Phase 1–2 caps, switch to the Lean column.

| Phase | Lean (~1M) | Baseline (~1.5M) | Full (~2M) |
|---|---|---|---|
| 0 Foundation (repo, CI, AGENTS.md, research, red-team) | 70k | 100k | 150k |
| 1 Data, ontology, quality, SimSite core | 220k | 300k | 350k |
| 2 API (auth, RBAC, audit, workflow, ingest) | 160k | 220k | 250k |
| 3 Web app + twin | 250k (L2 + L3 only) | 380k | 450k |
| 4 Sim Console, scenarios, e2e | 120k | 200k | 250k |
| 5 Reports, polish, docs, demo | 100k | 150k | 200k |
| Reserve | 80k | 150k | 350k |

**Premium tier cap.** Your scarce premium model (GPT-6 Luna) gets at most about 140k (≈ 9% of the Baseline total, 14% of Lean, 7% of Full), spent only on A1 red-team (≤ 25k), B1 contracts (≤ 25k), B4 workflow design (≤ 20k), SIM1 sim design (≤ 25k), T1 twin design (≤ 15k) and the final review T-054 (≤ 30k). Free tiers carry boilerplate and tests, fixtures only, with rate limits in mind.

**Lean build:** drop Should and Could, build **L2 + L3 only** (no L1), make PDFs from one HTML template, use 30 s polling.

### 9.3 Cut order when over budget

Capacitor → chat panel → ops overview → WebSocket (poll instead) → schedules/overrides → L1 building 3D (keep the floor list + comfort table) → what-if → second synthetic site → time scrubber → 3 of the 8 core scenarios. **Never cut:** ingest + quality, set-point workflow, RBAC, audit chain, the five reports, controller health, L2 plant, the L3 parameter list, CI, and the site-agnostic gate.

---

## 10. Operating model: Orca, GitHub, CI, skills

### 10.1 What Orca gives you (checked against its docs and repo)

Orca is a free, open-source (MIT) Agent Development Environment from Stably AI. Each task runs in its own **git worktree**; it runs any CLI agent (opencode, Pi, Claude Code, Codex, and others), so **Kiro CLI can be its own lane** as long as it runs in a terminal; it has native GitHub and Linear integration (browse PRs and issues, open worktrees from tasks, review diffs); a built-in browser that agents can drive once you enable it (Settings → Orca Browser Use); an **Orca CLI** (`orca worktree create`, `snapshot`, `click`, `fill`; on Linux the binary is `orca-ide`); and a mobile companion app for notifications. It does not proxy models; you bring your own. "Fan one prompt across five agents" multiplies token cost, so use it only for the two things worth paying twice for: the L2/L3 visual style and the first sim-engine prototype.

### 10.2 Model tiers and routing

| Tier | Use for | Models |
|---|---|---|
| **A** (scarce) | red-team, contracts, set-point state machine, sim physics design, twin design, final review | GPT-6 Luna via opencode (per your description; I could not verify its limits) |
| **B** (workhorse) | feature implementation | GLM / best OpenRouter model |
| **C** (free) | boilerplate, Dockerfiles, tests from a spec, fixtures, docs, lint fixes | OpenRouter free, Kiro |
| **P** | tiny edits, renames, commit messages, issue creation | pi agent |

Routing rules: anything touching contracts, auth, audit crypto, the workflow, or sim physics is A (design) → B (build) → A or a different B (review). Free tiers may log prompts, so they get only fixtures and generic code, never `data/raw` and never §3 unless the task needs a specific number (then paste only that number). A reviewer is always a different model than the author.

### 10.3 Token-saving rules (these matter more than model choice)

1. `AGENTS.md` ≤ 60 lines; prompts name `scripts/plan.sh <n>` sections, never "read the whole repo" or this whole file.
2. Agents never open raw CSVs. You run `tools/calibrate.py` and the parser reconciliation locally and commit only the small JSON (H-steps, §10.9).
3. One task = one worktree = one PR ≤ ~400 changed lines.
4. Spec first (`packages/contracts`), then code to the contract.
5. Hard stop: if an agent fails the same check twice it writes `BLOCKED.md` and stops; you escalate the tier or re-scope.
6. Final messages ≤ 5 lines: diffs and summaries, not file dumps.
7. **Skills cost context.** opencode lists every installed skill's name and description in the skill tool; install only what a lane uses, and hide the rest per agent with opencode's `permission.skill` patterns.
8. Keep MCP servers to a minimum: their tool schemas load into every session. Use `gh` instead of a GitHub MCP.

### 10.4 Skills and plugins

opencode discovers `SKILL.md` skills in `.opencode/skills/`, `.claude/skills/` and `.agents/skills/` (project and global), so skills installed by `npx skills add` are picked up. Each skill folder must contain an all-caps `SKILL.md` whose `name` matches the directory.

| Lane | Skill | Install |
|---|---|---|
| L1 3D agent | `r3f-best-practices` (R3F, drei, zustand; re-render and dispose rules) | `npx skills add emalorenzo/three-agent-skills --skill r3f-best-practices` |
| L1 3D agent | `three-best-practices` (instancing, disposal, performance) | `npx skills add emalorenzo/three-agent-skills --skill three-best-practices` |
| UI, SVG, tokens | Anthropic `frontend-design` (distinctive, non-templated UI) | from the `anthropics/skills` repo (`npx skills add anthropics/skills --skill frontend-design`; verify the path) |
| UI verification | Orca built-in browser for screenshots; Playwright for CI | built in / `pnpm dlx playwright install` |
| Repo and DevOps | `gh` CLI (authenticated), Docker, Orca's GitHub integration | — |
| **Skip** | `3d-web-experience` (mostly knowledge a capable agent has). **Everything Claude Code (ECC) wholesale**: it ships dozens of agents and well over a hundred skills plus hooks that run shell commands on your machine, so it is a large context and security cost. If you want it, cherry-pick two or three items (TDD, code review, security review) and measure the context cost first. | — |

Community skills are third-party instructions: read a `SKILL.md` before installing it. Pin versions with T-002 (R3F v9 ↔ React 19).

### 10.5 GitHub automation: the "real team" loop

Use the `gh` CLI plus Orca's GitHub integration. Do not add the GitHub MCP unless `gh` cannot do something.

**Plan limits (R8).** On the GitHub **Free plan, private repos cannot use branch protection, rulesets, or auto-merge** (the API returns 403). Choose one: (a) GitHub Pro (check whether you qualify through the Student Developer Pack; verify current terms), which enables everything below; or (b) stay on Free and enforce the same rules with a `lefthook` pre-push hook that blocks pushes to `main`, plus `scripts/merge.sh` as the only merge path, and treat the review label as convention. The plan assumes (a) and degrades to (b).

Loop: issue → Orca worktree `feat/T-014-contracts` → agent implements with tests → `scripts/ship.sh` → PR → CI → review agent (different model) adds label `reviewed-ok` (or `changes-requested`) → you run `scripts/merge.sh <pr>` → squash-merge, branch deleted, worktree removed.

**DEC-7 in practice.** All agents act as your single GitHub identity, so they cannot "approve" your PR. The merge gate is therefore: required CI check + required check `review-gate` (a tiny workflow that passes only when label `reviewed-ok` is present and `changes-requested` is absent). Do not use auto-merge until `review-gate` exists.

Conventions: Conventional Commits; labels `feat fix chore sim twin api web docs`; backlog in `docs/BACKLOG.md`; issues created with `gh issue create -t "T-0xx title" -F -`; PR template checklist (tests added, contract changed?, screenshots for UI, site-agnostic grep clean, burn recorded).

### 10.6 CI (`.github/workflows/ci.yml`)

- Install with the lockfile; cache pnpm and Docker layers.
- Jobs: `lint-typecheck-unit` (pnpm + `ruff` + `pytest`), `contracts-drift` (regenerate client, fail on diff), `site-agnostic` (§10.7), `docker-build` (all images), `e2e-smoke` (compose up + Playwright against SimSite `normal-day`; upload the Playwright report), `review-gate`.
- Cost control (private-repo minutes are capped): path filters so docs-only PRs skip heavy jobs; the full e2e suite runs on `main` and on PRs labelled `e2e`, while PRs run the smoke subset.
- On `main`: push images to GHCR. Dependabot weekly.
- Gate `site-agnostic` and `contracts-drift` are required checks.

### 10.7 Scripts (commit these)

`scripts/plan.sh`: print one plan section.
```bash
#!/usr/bin/env bash
# usage: scripts/plan.sh 7   -> prints "## 7. ..." up to the next "## " heading
set -euo pipefail
awk -v n="${1:?section number}" '/^## / { p = ($0 ~ "^## " n "[. ]") } p' docs/PLAN.md
```

`scripts/ship.sh`: verify, commit, push, open the PR. It does **not** merge.
```bash
#!/usr/bin/env bash
set -euo pipefail
msg="${1:?conventional commit message}"
pnpm -r --if-present lint && pnpm -r --if-present typecheck && pnpm -r --if-present test   # each package's test script is "vitest run"
(cd apps/sim && ruff check . && pytest -q)
scripts/check-site-agnostic.sh
git add -A
if git diff --cached --name-only | grep -E '^(data/raw/|\.env)'; then echo "refusing: raw data or env staged"; exit 1; fi
big=$(git diff --cached --name-only --diff-filter=AM | while read -r f; do [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 1048576 ] && echo "$f"; done || true)
[ -z "$big" ] || { echo "refusing: files > 1 MB staged:"; echo "$big"; exit 1; }
git commit -m "$msg"
git push -u origin HEAD
gh pr create --fill --base main
```

`scripts/merge.sh`: the only merge path.
```bash
#!/usr/bin/env bash
set -euo pipefail
pr="${1:?pr number}"
gh pr view "$pr" --json labels --jq '.labels[].name' | grep -qx 'reviewed-ok' || { echo "no reviewed-ok label"; exit 1; }
gh pr checks "$pr" --watch --fail-fast
gh pr merge "$pr" --squash --delete-branch
```

`scripts/check-site-agnostic.sh`: implements the two tiers of §2.5. Tier 1 patterns: `kmssh|Manavata|KIMS|JouleLogger` plus the distinctive tokens in `data/seed/forbidden-strings.txt` (curated by T-010; never include ordinary words like `status` or `kw`). Tier 2 patterns: `\b(chiller|ahu|fcu|cooling ?tower)\b`, case-insensitive, searched only in the Tier 2 paths. Exclude `data/`, `docs/`, `**/fixtures/**`, `**/*.test.*`, and the allow-listed Tier 2 exceptions. Exit non-zero with `file:line` on any hit.

### 10.8 `AGENTS.md` (commit verbatim, trim as the project grows)

```
# AGENTS.md
Project: BMS/HVAC app + digital twin + SimSite simulator. Plan: docs/PLAN.md.
Read a plan section with: scripts/plan.sh <n>. Never load the whole plan. NEVER open data/raw.
Rules
- Work only in your worktree/branch. One task, one PR (<=400 changed lines).
- Contracts first: change packages/contracts, regenerate the client, then code.
- Site-agnostic: tier rules in PLAN 2.5; bind UI and twin to ROLES (point-roles.json), never to
  point abbreviations or asset names. scripts/check-site-agnostic.sh must pass.
- Quality: bad values are kept but marked (quality code), never deleted or averaged.
- Every mutation writes an audit record via the hook; never per route by hand.
- Control writes go through the set-point request flow only; there is no direct write.
- Time: UTC internally; ISO-8601 with offset at the API edge (site tz from config).
- Tests with every change (vitest / pytest). No snapshot tests for 3D.
- Original design only: no copied logos, renders, plans or copy.
Definition of Done
- lint + typecheck + tests pass; scripts/ship.sh succeeds; PR text lists what changed, how
  to verify, anything skipped; UI changes attach screenshots (390/820/1180x820/1440).
- Append one line to docs/BURN.md (task, tokens if known, turns, outcome).
Stop rule: same check fails twice -> write BLOCKED.md (what, tried, suspected) and stop.
Final message: <=5 lines.
Stack: pnpm workspace; React 19+Vite+TS+Tailwind; Fastify+zod; Timescale/Postgres (plain SQL);
Python 3.12+FastAPI (sim); R3F+drei+zustand (L1 only); SVG (L2/L3); Vitest, Playwright, pytest.
```

### 10.9 Human steps (only you can do these) and handoffs

| ID | Step | When |
|---|---|---|
| H-1 | Save the four screenshots in `docs/reference/`; keep `data/raw/` (CSVs, xlsx, PDF) git-ignored | Phase 0 |
| H-2 | Authenticate `gh`; decide GitHub Pro vs Free (§10.5); create the private repo | Phase 0 |
| H-3 | Run `tools/build_ontology_json.py` and `tools/calibrate.py` on real data locally, run the manifest reconciliation, check outputs contain no raw rows, then commit only `data/calibration/*.json` and the anonymised seed | after T-010/T-011/T-012 |
| H-4 | Send the Q-table to Smart Joules (§14.1); record answers in `docs/adr/` | Phase 0 |
| H-5 | Review each merged PR's screenshot and the Test Checklist at every gate | every gate |
| H-6 | Update `docs/BURN.md` totals; apply the Lean switch rule at G2 | G2 |

**Handoff note** (end of every task, in the PR body): what changed, how to verify, what was skipped, what the next agent should know (≤ 10 lines). **`BLOCKED.md`**: what, what was tried, suspected cause, what would unblock.

### 10.10 Security hygiene

`.env` and secrets git-ignored; secrets referenced through `secretRef`, never in config committed to git; a `gitleaks` step in `lefthook` pre-commit and in CI; dependency lockfile committed; the sim gateway is unauthenticated and internal only; JWT secrets and `AUDIT_HMAC_KEY` come from env; never paste credentials into a prompt.

---

## 11. Phases, backlog, gates

Size: S < 15k tokens, M 15–40k, L 40–80k. Tier = model tier (§10.2). Vertical slice first: by the end of Phase 2 you should see **one chiller's live temperature from SimSite in the browser** (T-029, gate G2).

| ID | Task | Tier | Size | Needs | Prompt |
|---|---|---|---|---|---|
| **Phase 0** | | | | | |
| T-001 | Reference UI analysis | — | — | **DONE** (§4) | — |
| T-002 | Stack and version check | C | S | — | R2 |
| T-003 | Twin patterns research (L1 only) | B | S | — | R3 |
| T-004 | Red-team this plan | A | M | — | A1 |
| T-005 | Repo init, workspace, compose skeleton, hooks | C/B | M | H-2 | D1 |
| T-006 | CI, PR template, ship/merge scripts, review gate, site-agnostic check | B | M | T-005 | D1 |
| T-007 | Backlog → GitHub issues | P | S | T-005 | D2 |
| **Phase 1** | | | | | |
| T-010 | `build_ontology_json.py`, point-roles seed (local only) | B | M | H-1 | C1 |
| T-011 | `calibrate.py` → profiles, curves, gap stats | B | L | T-010 | C1 |
| T-012 | Multi-block CSV parser, reconcile to `manifest.json` | B | M | H-1 | C1 |
| T-013 | `packages/quality` (+ tests) | B | M | — | C2 |
| T-014 | Contracts v0 (ontology, telemetry, set-point, audit, gateway, controller health, floors, report run) | A | M | T-004 | B1 |
| T-015 | DB migrations and rollups | B | M | T-014 | B3 |
| T-016 | SimSite engine v0 (design A, build B) | A/B | L | T-011, H-3 | SIM1, SIM2 |
| T-017 | Site-store writer and fault layer | B | M | T-016 | SIM2 |
| **Phase 2** | | | | | |
| T-020 | API skeleton, JWT, RBAC (5 roles) | B | M | T-014 | B2 |
| T-021 | Ingest worker and drivers (csv, timescale-raw, sim-http) | B | L | T-013, T-015, T-017 | B3 |
| T-022 | Ontology, asset, telemetry, coverage endpoints | B | M | T-020, T-021 | B2 |
| T-023 | Audit hash chain and verify | B | M | T-020 | B2 |
| T-024 | Set-point workflow, GatewayDriver, sim gateway | A→B | L | T-023, T-017 | B4 |
| T-025 | Controller health endpoint | C | S | T-022 | B2 |
| T-026 | `floors/summary`, `plant/kpis`, comfort config | B | S | T-022 | B2 |
| T-029 | Walking skeleton: one page, live value for one asset | C | S | T-022 | W0 |
| **Phase 3** | | | | | |
| T-030 | Design tokens and app shell | B | M | T-029 | F1 |
| T-031 | Auth, site selector, `PointRenderer` | B | M | T-030 | F1 |
| T-032 | Asset browser, detail, charts | B | M | T-031 | F1 |
| T-033 | twin-core: schema, role resolver, registry, store, generator (design A) | A/B | L | T-014 | T1 |
| T-034 | **L2** plant schematic | B | M | T-033 | T2 |
| T-034b | **L3** equipment templates + control strip + parameters | B | M | T-033, T-031 | T3 |
| T-035 | **L1** building 3D (Should) | B | L | T-033, T-026 | T4 |
| T-036 | Set-point UI and approval queue | B | M | T-024, T-031 | F2 |
| T-037 | Alarms and controller health UI | C | M | T-025 | F2 |
| **Phase 4** | | | | | |
| T-040 | Sim Console shell and controls | B | M | T-016 | SIM3 |
| T-041 | Scenario engine: 8 core + 3 gateway presets | B | L | T-017 | SIM3 |
| T-042 | Playwright suite ↔ Test Checklist | B | L | T-041, T-036 | QA1 |
| T-043 | What-if endpoint and twin overlay (Should) | A/B | M | T-034 | WIF1 |
| T-044 | Sim control modes and weather strip env | B | S | T-016 | SIM3 |
| **Phase 5** | | | | | |
| T-050 | Reports 1–5 | B | L | T-022, T-041 | RPT1 |
| T-051 | Optimiser rules (Should) | B | M | T-043 | OPT1 |
| T-052 | PWA and tablet pass | B | M | T-032 | F1 |
| T-053 | Docs, README, demo script, seeded accounts | C | M | all | DOC1 |
| T-054 | Final whole-repo review (security, site-agnostic, RBAC) | A | M | all | REV2 |
| T-055 | Chat panel with tool trace (Could) | B | M | T-022 | LUM1 |
| T-056 | Ops overview on synthetic data (Could) | C | M | T-041 | OPS1 |
| T-057 | Public-release sanitise (Could) | B | S | all | — |
| T-058 | Second synthetic site (Should) | B | M | T-041 | Z1 |
| T-059 | Schedules and overrides CRUD (Should) | B | M | T-023 | B2 |
| T-060 | WebSocket live updates (Could) | B | M | T-022 | — |
| T-061 | Time scrubber (Could) | B | S | T-034 | T2 |

**Gates**

| Gate | Condition |
|---|---|
| G0 | CI green on the empty skeleton; `site-agnostic` and `review-gate` exist |
| G1 | Parser line counts reconcile to `manifest.json` on the real data (you run it, H-3) |
| G2 | **Sim → ingest → quality → API → browser shows a live chiller value**; apply the Lean rule (H-6) |
| G3 | Set-point workflow demonstrated against all three gateway presets; audit rows present; tamper test fails verification as expected |
| G4 | All core scenarios green in the Test Checklist |
| G5 | L2 + L3 live and bound by roles; second site (if built) renders a different plant |
| G6 | Five reports pass golden tests; demo rehearsal (§13) completed |
| G7 | **Client dummy DB** plugged in via site config (+ mapping, at worst one driver class); read and write paths demonstrated |

---

## 12. Prompt pack

**Common header** (put at the top of every prompt; omitted below): `Read AGENTS.md and the plan sections named below (scripts/plan.sh <n>). Work in your worktree. Follow the Definition of Done. Final message ≤ 5 lines.`

### 12.1 Orchestrator checklist (you, per task)

1. Pick the issue; create the Orca worktree `feat/T-0xx-name` (Orca UI or `orca worktree create`).
2. Choose the tier from §11 and §10.2; open the agent (opencode with the right model, Pi for P, Kiro CLI for C).
3. Paste header + prompt. Install only the skills that lane lists.
4. Watch burn; if the agent loops, stop it (stop rule) and escalate or re-scope.
5. `scripts/ship.sh "<conventional message>"`; attach screenshots for UI.
6. Start the review agent (different model, prompt REV1); read its verdict.
7. `scripts/merge.sh <pr>`; remove the worktree; add a line to `docs/BURN.md`.
8. At each gate, run the gate condition (§11) and the Test Checklist (§13).

### 12.2 Phase 0: research and foundation

**R2 — Stack and version validator** · Tier C (needs web) · skills: none · T-002
```
Using current official docs only, verify and tabulate in docs/research/stack-versions.md (<=500 words):
React, Vite, @react-three/fiber, @react-three/drei, three, zustand, Tailwind, Fastify, zod, Playwright,
TimescaleDB docker tag, FastAPI, Python, pnpm, exceljs, Capacitor, the `skills` CLI, opencode skill
discovery paths, Orca CLI binary name. For each: latest stable, compatibility constraints (for example
R3F major vs React major), one gotcha. End with a recommended pinned set. No code, no installs.
```

**R3 — Twin patterns research** · Tier B (needs web) · skills: r3f-best-practices · T-003 · plan §5
```
Find up to 4 open-source examples of data-driven building, plant or P&ID-style visualisations (SVG or
R3F). For each: licence, what is reusable, what we must not copy. Then answer: (a) cheapest way to
animate pipe flow in SVG on tablets (CSS dashoffset vs SMIL vs canvas); (b) cheapest per-zone heatmap in
R3F (vertex colours vs instanced colour vs canvas texture); (c) tips for generating a plan texture to a
canvas. Output docs/research/twin-patterns.md <=900 words with links. Do not add dependencies.
```

**A1 — Plan red-team** · Tier A · skills: none · T-004 · plan: whole file (only agent allowed to read all)
```
Act as a sceptical staff engineer reviewing a 2-person prototype with a ~1.5M-token budget. Output
docs/adr/000-redteam.md (<=800 words): top 10 risks ranked by likelihood x damage; the three decisions you
would change and why; anything over-scoped; any contradiction between sections; whether the budget in §9.2
is plausible given context re-reading. Do not rewrite the plan.
```

**D1 — Repo and DevOps** · Tier B then C · skills: gh CLI · T-005, T-006 · plan §2.5, §10
```
Initialise the pnpm workspace per §2.5 with empty packages that build. Add: docker-compose.yml (one
timescale container with databases site_store and app_store created by an init script; api, web, sim,
sim-console; healthchecks; ports per §2.1; compose profile "coarse"), Dockerfiles, lefthook (lint +
typecheck + gitleaks on commit; pre-push blocks main), .gitignore (data/raw, .env, node_modules,
__pycache__), AGENTS.md from §10.8, scripts from §10.7, PR template, dependabot, ci.yml per §10.6 incl.
the review-gate workflow. Create the PRIVATE repo with gh and the labels. If the account has GitHub Pro,
protect main via gh api (require ci + review-gate + site-agnostic, no direct push); otherwise skip and
say so. Verify: `docker compose config` valid; CI green on the skeleton PR.
```

**D2 — Backlog to issues** · Tier P/C · T-007 · plan §11
```
Convert the §11 table into docs/BACKLOG.md and create one GitHub issue per row with gh (title
"T-0xx name", labels from the area, body = the row plus <=3 acceptance bullets inferred from the plan
section it cites). Do not start any task.
```

### 12.3 Phase 1: data, contracts, SimSite core

**C1 — Ontology and data tooling (local only)** · Tier B · skills: none · T-010, T-011, T-012 · plan §3, §6.2, §7.3
```
Everything under tools/ and packages/ontology. Raw files live in data/raw (git-ignored): do not print
rows or paste data into output. Tests use synthetic fixtures only.
1. build_ontology_json.py: building-model xlsx -> data/seed/ontology.json (assets, points with
   classification/writable/safeMin/safeMax, zones, controllers). Flag --anonymise for committed fixtures.
   Also emit data/seed/point-roles.json (skeleton keyed by asset type), data/seed/forbidden-strings.txt
   (distinctive tokens only), and a stdout summary: counts, and how many writable points exist by class.
2. Multi-block annotated-CSV parser: blank line ends a block, '#' rows are annotations, header per block,
   ragged-row guard, UTC->IST, map field is_delayed_data onto is_delayed. Line counts must reconcile to
   manifest.json; a failed reconciliation fails the test.
3. calibrate.py -> data/calibration/*.json (each <200 KB): hourly mean/p5/p95 per asset type and field,
   dropped-poll rate, chiller part-load curve points, tower approach vs wet-bulb, fault-distribution stats,
   and whether "total floor kW" includes plant power (write the answer in data/calibration/README.md).
```

**C2 — Quality layer** · Tier B · skills: none · T-013 · plan §7.5
```
packages/quality (TypeScript). Implement steps 3-7 of §7.5 as a pure function (row, context) ->
{value, raw_value, quality, flags}: sentinel (configurable list), per-class range rules, stopped-equipment
suppression of process values joined to the run-status role, consistency rules (quality 4), is_delayed
pass-through. 100% unit-tested with table-driven tests. No site-specific strings, no point abbreviations.
```

**B1 — Contracts (do before any parallel work)** · Tier A · skills: none · T-014 · plan §7.2, §7.4, §7.6, §7.8, §7.9
```
Create packages/contracts: zod schemas + OpenAPI for ontology, telemetry series (with quality block and
per-bucket n), set-point lifecycle (states, transitions, error codes), audit record (all signed fields),
gateway write/read, controller health, floors summary, plant kpis, report run, ingest report. Generate a
typed TS client. Add a CI check that regeneration produces no diff. Write a 1-page docs/adr/001-contracts.md.
These are the interfaces every other agent codes to: be strict, no optional fields without a reason.
```

**SIM1 — SimSite design** · Tier A · skills: none · T-016 (design) · plan §3.2, §6 · reads data/calibration/*.json, not raw
```
Write docs/adr/003-sim.md (<=800 words): state vector, update equations (weather, zone RC, valve PI, plant
staging, chiller curve, tower, counters), time stepping with hourly checkpoints and seek, determinism via
stateless hashed noise, calibration parameters and where each comes from, fault-layer hooks, the surrogate
(training days, validation day, envelope rule, fallback), and the acceptance tests from §6.7 with tolerances
you would propose. Flag every assumption explicitly.
```

**SIM2 — SimSite build** · Tier B · skills: none · T-016, T-017 · plan §6, §7.4 (rows only) · input: docs/adr/003-sim.md
```
Implement the ADR in apps/sim (FastAPI + numpy): profile loader (ontology + calibration + scenarios yaml),
scalable clock, engine, COPY-batched writer to site_store.points exactly as §6.2, the endpoints in §6.3
including the mock gateway with presets, latency and failure rate, and the fault layer of §6.5. No site
strings in code. Acceptance tests from §6.7 must pass. Same seed => identical export.
```

**B3 — Migrations, ingest, drivers** · Tier B · skills: none · T-015, T-021 · plan §6.2, §7.2, §7.4, §7.5
```
Plain SQL migrations (telemetry with raw_value, hourly and daily continuous aggregates with late_samples,
ingest_cursor, ingest_report, report_runs, alarms) and the ingest worker in apps/api: SourceDriver
(csv, timescale-raw, sim-http; influx throws NotImplemented), cursor on seq, one transaction per batch,
packages/quality, upsert, ingest_report for unknown entities. Driver chosen by site config only. Integration
test against compose Timescale including a late-backfill case. Target >= 6k rows/s in batches; report the
measured number.
```

### 12.4 Phase 2: API

**B2 — Backend core** · Tier B · skills: none · T-020, T-022, T-023, T-025, T-026 (T-059 later) · plan §7
```
Fastify + TS in apps/api against packages/contracts only. JWT access/refresh; RBAC middleware from §7.7
(deny and audit denials); ontology, asset, latest, telemetry, coverage, controllers, floors/summary and
plant/kpis endpoints per §7.9 with the caching headers; the audit writer as a global hook with the canonical
HMAC chain, per-site advisory lock and verify endpoint, plus the tamper test. Plain SQL. Role-resolved KPIs
use data/seed/point-roles.json via packages/ontology.
```

**B4 — Set-point workflow** · Tier A (design, 20k cap) → B (build) · skills: none · T-024 · plan §7.6, §6.3
```
Implement the state machine in §7.6 including guards, timeouts via the scheduler tick, no self-approval
(also for admin), one live request per point (409 via partial unique index), safeMin/safeMax from the
ontology, control-mode gating, Idempotency-Key, APPLYING via GatewayDriver.write then read-back within
tolerance/60 s, FAILED on mismatch, REVERTED via verified write-back on alarm in the watch window. Every
transition audited in the same transaction. Table-driven tests for every edge, a fake gateway, and one
end-to-end per gateway preset against SimSite. No UI.
```

**W0 — Walking skeleton** · Tier C · skills: none · T-029 · plan §2.1
```
Smallest possible apps/web page using the generated contracts client: log in as a seeded user, list assets,
open one, show its latest values with unit and timestamp. No styling work. Goal: gate G2 (a live chiller
value from SimSite in the browser).
```

### 12.5 Phase 3: web app and twin

**F1 — Frontend shell and renderer** · Tier B · skills: frontend-design · T-030, T-031, T-032, T-052 · plan §4, §8
```
Design tokens with two themes (neutral default; smartjoules private), responsive app shell per §8.1-8.2
(header with weather strip, breadcrumb, tabs), auth + site selector, and the ontology-driven PointRenderer
per §8.3 with live/stale/flagged/missing states and coverage badges. Asset browser (virtualised), asset
detail with sparklines, historical charts with resolution switching (<=500 points per series, partial hours
marked). Generated contracts client only. Original design: do not copy DeJoule branding. After the main
work, add the PWA per §8.6. Screenshots at 390, 820, 1180x820, 1440.
```

**F2 — Set-point UI, alarms, controller health** · Tier B/C · skills: frontend-design · T-036, T-037 · plan §7.6, §8.4, §8.5
```
Confirm sheet and request flow per §8.5, approval queue, state timeline with read-back result, alarms list
(asserted first, acknowledge by permission), controller health view with blast radius. Disable actions the
role lacks permission for but rely on server enforcement. Screenshots required.
```

**T1 — Twin core design** · Tier A (15k cap) · skills: none · T-033 · plan §5
```
Design only, no scene. Write docs/adr/002-twin.md (<=600 words) and the TypeScript in packages/twin-core:
TwinLayout zod schema (§5.3), roles vocabulary and resolveRole (§5.4), GlyphRegistry and templateRegistry
interfaces, binding-store shape (assetId.field -> {v,q,at}), generator interface (§5.10). State the rules for
unknown asset types and for sites without a layout, and the performance budgets (§5.5, §5.7). The generator
may be stubbed here; it is implemented under T-035/T-058.
```

**T2 — L2 plant schematic** · Tier B · skills: frontend-design · T-034 (+ T-061 optional) · plan §5.3-5.5, §5.8
```
PlantSchematic in packages/twin-core + apps/web as inline SVG from TwinLayout. Pipe colour by medium; CSS
dash-offset flow animation with duration inversely proportional to flow; sensor chips bound by role through
the store; click equipment -> floating card (title, 4-5 key points, mode chip, controls from writable points,
confirm sheet -> request flow, never a direct write). Pan/zoom by pointer events with a Fit button;
collapsible cards on portrait tablet; alarm pulse; coverage badges; blast-radius highlight. GlyphRegistry of
simple SVG symbols, unknown type -> generic box. Tokens only, no hardcoded colours. Synthetic layout fixture.
Screenshots at 1180x820 and 820x1180.
```

**T3 — L3 equipment screen** · Tier B · skills: frontend-design · T-034b · plan §5.4, §5.6, §8.3
```
Equipment detail screen: asset picker, mode chip, alert badge; left an SVG template per family with callouts
bound by role; below it a dark control strip generated from writable points; right a scrollable PARAMETERS
list generated from the ontology via PointRenderer. Templates: AHU section view, chiller front, FCU, pump,
each <=8 KB, original artwork. Missing template -> parameter list only. Show "—" with a reason for missing
data, never "null". Screenshots at 1180x820 and 820x1180.
```

**T4 — L1 building 3D (Should)** · Tier B · skills: r3f-best-practices, three-best-practices · T-035 · plan §5.7
```
packages/twin-3d: R3F BuildingTwin with stacked floors, Expand slider, Revolve, per-floor plan texture
generated from zone rectangles and labels (<=1024 px, disposed), instanced equipment, comfort colouring and
legend from site config, floor list from floors/summary with focus on select, frameloop="demand", DPR <=1.5,
no shadows, lazy-loaded, 2D fallback. Implement tools/gen_twin_layout.ts from ontology + seed floor map with
a fallback for sites with no floor info. Measure and report draw calls, triangles and fps in the PR.
```

### 12.6 Phase 4: scenarios and tests

**SIM3 — Sim Console and scenarios** · Tier B · skills: frontend-design · T-040, T-041, T-044 · plan §6.3, §6.6, §6.8
```
apps/sim-console (2D SVG, own server): clock, sliders, fault buttons with target pickers, scenario runner,
gateway settings, live mini-schematic, surrogate validation readout, and the Test Checklist. In apps/sim,
implement the 8 core scenarios and 3 gateway presets of §6.6 as seeded yaml timelines in data/scenarios,
plus control modes and the environment block feeding the app's weather strip. Utilitarian UI.
```

**WIF1 — What-if (Should)** · Tier A/B · skills: none · T-043 · plan §5.9, §6.3
```
Implement POST /sim/whatif (a copy of the state stepped forward for horizonMin with the proposed changes,
never mutating live state) and the L2 ghost overlay of predicted kW and delta-T. Label everything
"indicative, 3-day calibration". Show a warning when the surrogate left its training envelope.
```

**QA1 — End-to-end suite** · Tier B/C · skills: Playwright · T-042 · plan §6.8, §7.6, §7.7, §13
```
Playwright suite in apps/web/e2e: for each Test Checklist feature in §13, start its seeded scenario through
the SimSite API, wait on app state (never sleep), assert, then POST the result to /sim/checklist. Include RBAC
for all five roles, the full set-point flow for every gateway preset, and the audit tamper check. Runs in CI
against compose (smoke on PRs, full on main). Flake budget zero.
```

### 12.7 Phase 5: reports, advice, docs, review

**RPT1 — Reports** · Tier B · skills: none · T-050 · plan §7.10
```
Five reports per §7.10: queue-based runs (report_runs + SKIP LOCKED worker), PDF via an HTML template and
Playwright page.pdf, XLSX via exceljs, CSV. Counter consumption by successive positive differences with
reset counts; rapid-reversal collapsing; thresholds from config with an informational mode; every export
audited; PROVISIONAL and late-sample notes per DEC-12. Golden-file tests against data/seed/golden.
```

**OPT1 — Optimiser rules (Should)** · Tier B · skills: none · T-051 · plan §5.9, §6.6
```
Rule-based advisory engine (not AI; say so in the UI): low delta-T (mean below a configured threshold for N
hours), valve saturation (valve at or above a configured percentage for more than X% of the window), poor
staging (lag unit running below a configured loading). Thresholds in site config. Each recommendation shows
its evidence numbers, the window, and "rule-based advisory"; where what-if exists, show the predicted effect
as indicative. Tests drive it with the low-delta-t scenario.
```

**REV1 — Reviewer (per PR)** · a different model than the author; Tier A for risky PRs · skills: none
```
Review PR #<n> against AGENTS.md, the linked issue and the plan sections it cites. Report only: (1) bugs,
(2) security, RBAC or audit bypasses, (3) site-hardcoding (run scripts/check-site-agnostic.sh), (4) missing
tests, (5) contract drift, (6) violations of the DECs in §0.2. <=15 bullets, file:line each. Then run
`gh pr edit <n> --add-label reviewed-ok` or `--add-label changes-requested` and post the bullets with
`gh pr comment`. No style nitpicks.
```

**DOC1 — Docs and demo** · Tier C · skills: none · T-053 · plan §13
```
README (setup in 5 commands via compose), architecture diagram (mermaid), seeded accounts per role,
scenario catalogue, known limitations (from §0.1), and the 10-minute demo script from §13. Run every
command you document and fix what fails.
```

**REV2 — Final review (T-054)** · Tier A (30k cap)
```
Whole-repo review: security (secrets, authz, injection), RBAC and audit bypasses, site-agnostic grep with
both tiers, contract drift, anything in §0.2 that the code violates, and the top five risks to the demo.
Output docs/adr/004-final-review.md <=600 words. No fixes, only findings.
```

**LUM1 — Chat panel (Could)** · Tier B · T-055 · plan §4.1 (UI-3), §7.12
```
Chat panel with an agent loop over the six read-only tools in §7.12 using an OpenRouter model through a
server-side proxy (key never in the client). UI: collapsible "Traced N steps · Ns", answer, "grounded via
<tool>" tags, three follow-up chips, copy, thumbs. Verification: show "Checked" only if every number in the
answer appears in tool output (rounding tolerance), else "Unverified". Cap tool calls at 6 per question and
cap answer tokens. Label it a read-only assistant, not an optimiser.
```

**OPS1 — Ops overview (Could)** · Tier C · skills: frontend-design · T-056 · plan §4.1 (UI-4)
```
Ops overview page with tabs and a date-range bar fed by a synthetic generator in apps/sim (tickets from
alarms, PM schedule by equipment category, site-log schedule, SLA scores). Cards: SEC high/low, SLA ranking,
open tickets, pending PM, pending logs, incidents; charts: PM planned vs completed, logs recorded vs
scheduled, tickets by category. Mark every figure "synthetic".
```

**Z1 — Second synthetic site (Should)** · Tier B · skills: none · T-058 · plan §6.9, §7.4
```
Generate the office-small profile (~90 assets, 4 floors, an air-cooled chiller, AHUs, FCUs, no towers):
ontology.json, point-roles.json, twin-layout (via the generator), scenario targets, site config. Run SimSite
against it and show the app rendering a different plant by config only. Add the RLS isolation test using two
sites and two users. Report any code change that was needed (each is a site-agnostic bug).
```

---

## 13. Demo script and Test Checklist

### 13.1 Ten-minute demo

1. **Sim Console:** `normal-day` at 60×; the app's live values update; point out the app is configured by site config only.
2. **L2 plant:** pipes coloured by medium, sensor chips live; click the lead chiller → card; trigger `lead-chiller-trip` → alarm, failover visible on the schematic and in charts.
3. **Coverage:** `controller-outage` → coverage CRITICAL → controller health blast radius (and the L1 floor heat table if L1 is built).
4. **Quality:** `sensor-garbage` + `stopped-equipment-zeros` → quality flags; the plant average stays sane.
5. **Workflow:** an engineer proposes a chilled-water set-point change from the L2 card; a manager approves; gateway applies; read-back; audit rows; then the `apply-then-alarm` preset for the auto-revert path.
6. **L3:** open an AHU, show the template, control strip and auto parameter list; run `critical-ahu-drift`.
7. **Advice:** what-if overlay (labelled indicative) and the optimiser recommendation under `low-delta-t`.
8. **Reports:** run the five reports; open one PDF.
9. **Site-agnostic proof:** switch to the second site (config only) and show a different plant.
10. **Trust:** the Test Checklist all green; the audit-chain verify failing on a deliberately modified row.

### 13.2 Test Checklist features (`data/scenarios/features.yaml`)

| ID | Feature | Scenario | Assertion | Doc 2 |
|---|---|---|---|---|
| F-01 | Live values | `normal-day` | latest value for an asset is within 2 cadences of site time | S7 |
| F-02 | Load-curve shape | `normal-day` (24 h) | hourly kW within tolerance of §3.2 | — |
| F-03 | Heatwave staging | `heatwave` | lag unit on, approach above baseline, alarm raised | — |
| F-04 | Chiller failover | `lead-chiller-trip` | alarm, standby running, L2 unit red | — |
| F-05 | Coverage and blast radius | `controller-outage` | coverage < 20% for monitored assets; controller stale; radius lists them | S11 |
| F-06 | Quality flags | `sensor-garbage` | codes 1 and 2 present; hourly averages exclude them | S3 |
| F-07 | Stopped equipment excluded | `stopped-equipment-zeros` | plant mean excludes the idle unit; code 3 | S3 |
| F-08 | Critical environment | `critical-ahu-drift` | excursion list non-empty; saturation % reported | — |
| F-09 | Optimiser advice | `low-delta-t` | recommendation with evidence appears | — |
| F-10 | Set point: success | gateway `ok` | PENDING → APPROVED → APPLYING → APPLIED with audit rows | S8 |
| F-11 | Set point: failure | gateway `ignore` | FAILED and alarm | S8 |
| F-12 | Set point: revert | gateway `apply-then-alarm` | REVERTED, write-back verified | S8 |
| F-13 | Workflow guards | — | self-approval blocked; second request 409; out-of-range 422 | S8 |
| F-14 | RBAC matrix | — | each role allowed/denied correctly; denial audited | S5 |
| F-15 | Audit tamper | — | verify fails at the modified row | S9 |
| F-16 | Reports 1–5 | pinned dataset | golden comparison | S10 |
| F-17 | Late data | `late-data-backfill` | regenerated report differs; late count shown | — |
| F-18 | Orphans | `orphan-entities` | ingest report lists the unknown IDs | — |
| F-19 | Inconsistent unit | `contradictory-fcu` | quality 4 on the dependent field | — |
| F-20 | Counter reset | `counter-reset` | energy not over-counted | — |
| F-21 | Site-agnostic | second site | a different plant renders with no code change | S6 |
| F-22 | What-if | — | overlay labelled indicative; live state unchanged | — |
| F-23 | Manifest reconciliation | local only | parser counts equal `manifest.json` | S1 |

---

## 14. Open questions, risks, unverified claims

### 14.1 Questions to resolve with Smart Joules

"Doc 2 X-nn" refers to the question IDs in Document 2 chapter 9. Send these early; Q1 gates Phase 3.

| # | Question | Why | Blocks |
|---|---|---|---|
| Q1 | Is a responsive **PWA (tablet-first)** acceptable instead of React Native/Expo? | DEC-1 changes committed deliverable S6 | Phase 3 |
| Q2 | Is the digital twin + simulator welcome as an addition to the declared S1–S12 scope? | Avoid surprise at the demo | — |
| Q3 | Timeline and milestones (Doc 2 S-01); approval of the use-case list (S-02) | Phase planning; their stated gate | planning |
| Q4 | Which five reports and what "prescribed format" means (Doc 2 R-01, R-02) | Report templates | T-050 |
| Q5 | Dummy DB: when, schema, credentials (Doc 2 B-03). Is it Timescale/Influx-shaped with the raw columns in §6.2, or something else? | DEC-6, gate G7 | G7 |
| Q6 | Is any direct write (without approval) ever acceptable, or always the request flow? Writes to live equipment remain out of scope (Doc 2 S-03) | DEC-10 | — |
| Q7 | Permission to publish derived data and assets if the repo goes public; use of the Brand Bible for the private theme | R3, T-057 | public release |
| Q8 | What do JouleOps and JouleTick cover? | LUM1/OPS1 scope | Could items |
| Q9 | Semantics of control modes (Auto, Manual, Hybrid, Recipe, Local) and which block writes | sim modes, workflow guard | T-044 |
| Q10 | Populate `ON_FLOOR` and `SERVES`/`FED_BY`; where does plant topology come from? (Doc 2 T-02) | DEC-9, L2 layout | — |
| Q11 | Environmental ranges for critical spaces (Doc 2 R-03) | Report 5 pass/fail | — |
| Q12 | Authoritative telemetry store, derived-KPI naming, orphan entities, `is_delayed_data` settling time, device metadata, retention, protocols (Doc 2 T-01, T-03–T-08) | driver and report decisions | — |

### 14.2 Plan-level risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token burn exceeds budget | High | High | `docs/BURN.md`, Lean switch at G2, cut order (§9.3) |
| Scope creep toward the full platform or a richer twin | High | High | tiers and the never-cut list; L1 stays Should |
| PWA rejected in favour of React Native/Expo | Medium | High | ask Q1 before Phase 3; re-plan with the DEC-1 cost note |
| SimSite becomes a time sink | Medium | High | design ADR first, core 8 scenarios, coarse mode, stop at the §6.7 targets |
| Sim-to-real gap or dummy DB shape mismatch | Medium | High | raw-shape contract, mapping config + one driver class, gate G7 |
| Confidential data leaks via a free-tier model or a public repo | Low–Medium | High | R3 rules, private repo, gitleaks, §3 isolation, T-057 |
| 3D performance on tablets | Medium | Medium | L1 is Should; budgets, instancing, 2D fallback |
| Agent drift and site hardcoding | High | Medium | AGENTS.md, site-agnostic gate, different-model reviewer |
| Workflow or audit bugs | Medium | High | tier A design and review, table-driven tests, tamper test |
| GitHub plan limits and CI minutes | Medium | Medium | §10.5 fallback, path filters, smoke on PRs |
| Golden tests become brittle | Medium | Medium | pinned dataset and sim version, deliberate regeneration |

### 14.3 What I could not verify (treat as assumptions)

- GPT-6 Luna's capabilities and limits, and whether Kiro's free tier logs prompts (Orca runs any terminal agent, but model terms are theirs).
- What JouleOps and JouleTick cover beyond the one ops screen; whether "Lumen" verifies as I described.
- Control-mode semantics (Auto/Manual/Hybrid/Recipe/Local), inferred from screenshots and point names.
- The condenser-temperature sensitivity default (~2.5% per K), sim tolerances, performance budgets and token estimates: all my proposals.
- Eligibility and current terms of the GitHub Student Developer Pack.
- The `npx skills add anthropics/skills --skill frontend-design` path, and all package versions until T-002 runs.
- Whether "total floor kW" includes plant power (answered by T-011).
- Whether the client's dummy DB resembles the raw shape in §6.2.
- Colours in §4.3 are eyeballed, not sampled.