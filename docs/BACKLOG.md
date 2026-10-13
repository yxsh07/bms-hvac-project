# Backlog (T-007)

Tracks the tasks in PLAN.md §11. Each task is normally one GitHub issue.
Status as of the repo-recovery session (see docs/BURN.md).

## Phase 0

- [x] T-001 Reference UI analysis (§4)
- [x] T-002 Stack and version validator (docs/research/stack-versions.md)
- [x] T-003 Twin patterns research (docs/research/twin-patterns.md)
- [x] T-004 Plan red-team (docs/adr/000-redteam.md)
- [x] T-005 Repo init, workspace, compose skeleton, hooks
- [x] T-006 CI, PR template, ship/merge scripts, review gate, site-agnostic check
- [x] T-007 Backlog → issues (docs/BACKLOG.md)

## Phase 1

- [x] T-010 `build_ontology_json.py` + seed role/forbidden files — **guarded scaffold**; the xlsx parser is blocked on `data/raw` (H-1/G1)
- [x] T-011 `calibrate.py` → profiles — synthetic `data/calibration/profile.json` committed from §3.2; the real parser is implemented and tested (`sim/calibration.py`, 6 pytest) and runs once `data/raw` is present
- [x] T-012 Multi-block annotated CSV parser + `manifest.json` reconciliation — implemented in `apps/api/src/drivers/csv-parser.ts`, wired into `CsvSource`, 10 vitest; real reconciliation at G1 needs `data/raw`
- [x] T-013 `packages/quality` (+ tests) — 68 tests
- [x] T-014 Contracts v0 + generated client + ADR-001 — 14 tests
- [x] T-015 DB migrations and rollups (`apps/api/src/migrations`)
- [x] T-016 SimSite engine v0 (apps/sim) — ADR-003
- [x] T-017 Site-store writer and fault layer (apps/sim) — 30 pytest

## Phase 2

- [x] T-020 API skeleton, JWT, RBAC (5 roles)
- [x] T-021 Ingest worker and drivers (csv, timescale-raw, sim-http; influx stub) — Timescale integration test still pending a live DB
- [x] T-022 Ontology, asset, telemetry, coverage endpoints
- [x] T-023 Audit hash chain and verify (tamper test)
- [x] T-024 Set-point workflow, GatewayDriver, sim gateway
- [x] T-025 Controller health endpoint
- [x] T-026 `floors/summary`, `plant/kpis`, comfort config
- [x] T-029 Walking skeleton — web `/live` page logs in, lists assets and shows live values with quality; `pnpm g2` proves the Sim→API chain; a running-stack screenshot is still pending

## Phase 3

- [x] T-030 Design tokens and app shell
- [x] T-031 Auth, site selector, `PointRenderer`
- [x] T-032 Asset browser, detail, charts
- [x] T-033 twin-core: schema, role resolver, registry, store, generator
- [~] T-034 / T-034b L2 schematic and L3 templates (packages exist; app wiring partial)
- [~] T-035 L1 building 3D (`packages/twin-3d`; web page is a placeholder)

## Phase 4

- [x] T-040 Sim Console shell and controls (apps/sim-console)
- [~] T-041 Scenario engine + gateway presets (engine done; console start/stop wired)
- [ ] T-042 Playwright suite ↔ Test Checklist
- [x] T-043 What-if endpoint and twin overlay
- [ ] T-044 Sim control modes and weather strip env (env endpoints done)

## Phase 5

- [ ] T-050 Reports 1–5 (API has a queued stub)
- [ ] T-051 Optimiser rules
- [x] T-052 PWA manifest and icons
- [ ] T-053 Docs, demo script, seeded accounts
- [ ] T-054 Final whole-repo review
- [ ] T-055 Chat panel
- [ ] T-056 Ops overview
- [ ] T-057 Public-release sanitise
- [ ] T-058 Second synthetic site
- [ ] T-059 Schedules and overrides CRUD
- [ ] T-060 WebSocket live updates
- [ ] T-061 Time scrubber

## Gates

- [~] G0 CI green on the empty skeleton — CI defined and green locally
- [~] G1 Parser reconciles to `manifest.json` — parser + reconciliation implemented and unit-tested; needs `data/raw` for the real count
- [~] G2 Sim → ingest → quality → API → browser live chiller value — `pnpm g2` passes end-to-end; `/live` page wired to the API (mocked-API test); running-stack screenshot pending
- [~] G3 Set-point workflow + audit (unit-tested; live gateway demo pending)
- [ ] G4 All core scenarios green in the Test Checklist
- [~] G5 L2 + L3 bound by roles (packages ready)
- [ ] G6 Five reports pass golden tests
- [ ] G7 Client dummy DB plugged in
