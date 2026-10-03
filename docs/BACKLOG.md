# Backlog (T-007)

This file tracks all tasks from PLAN.md §11. Each task is one GitHub issue created with `gh issue create`. 

## Phase 0

- [T-001] Reference UI analysis - DONE (§4)
- [T-002] Stack and version validator - research complete (docs/research/stack-versions.md)
- [T-003] Twin patterns research - research complete (docs/research/twin-patterns.md)
- [T-004] Plan red-team - complete (docs/adr/000-redteam.md)
- [T-005] Repo init, workspace, compose skeleton, hooks - repo created (private), AGENTS.md, scripts, CI
- [T-006] CI, PR template, ship/merge scripts, review gate, site-agnostic check - CI workflow (.github/workflows/ci.yml) created
- [T-007] Backlog → GitHub issues - converting §11 table to docs/BACKLOG.md and creating issues

## Phase 1

- [T-010] `build_ontology_json.py`, point-roles seed (local only)
- [T-011] `calibrate.py` → profiles, curves, gap stats
- [T-012] Multi-block CSV parser, reconcile to `manifest.json`
- [T-013] `packages/quality` (+ tests)
- [T-014] Contracts v0 (ontology, telemetry, set-point, audit, gateway, controller health, floors, report run)
- [T-015] DB migrations and rollups
- [T-016] SimSite engine v0 (design A, build B)
- [T-017] Site-store writer and fault layer

## Phase 2

- [T-020] API skeleton, JWT, RBAC (5 roles)
- [T-021] Ingest worker and drivers (csv, timescale-raw, sim-http)
- [T-022] Ontology, asset, telemetry, coverage endpoints
- [T-023] Audit hash chain and verify
- [T-024] Set-point workflow, GatewayDriver, sim gateway
- [T-025] Controller health endpoint
- [T-026] `floors/summary`, `plant/kpis`, comfort config
- [T-029] Walking skeleton: one page, live value for one asset

## Phase 3

- [T-030] Design tokens and app shell
- [T-031] Auth, site selector, `PointRenderer`
- [T-032] Asset browser, detail, charts
- [T-033] twin-core: schema, role resolver, registry, store, generator (design A)
- [T-034] L2 plant schematic
- [T-034b] L3 equipment templates + control strip + parameters
- [T-035] L1 building 3D (Should)

## Phase 4

- [T-040] Sim Console shell and controls
- [T-041] Scenario engine: 8 core + 3 gateway presets
- [T-042] Playwright suite ↔ Test Checklist
- [T-043] What-if endpoint and twin overlay (Should)
- [T-044] Sim control modes and weather strip env

## Phase 5

- [T-050] Reports 1–5
- [T-051] Optimiser rules (Should)
- [T-052] PWA and tablet pass
- [T-053] Docs, README, demo script, seeded accounts
- [T-054] Final whole-repo review (security, site-agnostic, RBAC)
- [T-055] Chat panel with tool trace (Could)
- [T-056] Ops overview on synthetic data (Could)
- [T-057] Public-release sanitise (Could)
- [T-058] Second synthetic site (Should)
- [T-059] Schedules and overrides CRUD (Should)
- [T-060] WebSocket live updates (Could)
- [T-061] Time scrubber (Could)

## Gates

- [G0] CI green on the empty skeleton; `site-agnostic` and `review-gate` exist
- [G1] Parser line counts reconcile to `manifest.json` on the real data (you run it, H-3)
- [G2] **Sim → ingest → quality → API → browser shows a live chiller value**; apply the Lean rule (H-6)
- [G3] Set-point workflow demonstrated against all three gateway presets; audit rows present; tamper test fails verification as expected
- [G4] All core scenarios green in the Test Checklist
- [G5] L2 + L3 live and bound by roles; second site (if built) renders a different plant
- [G6] Five reports pass golden tests; demo rehearsal (§13) completed
- [G7] **Client dummy DB** plugged in via site config (+ mapping, at worst one driver class); read and write paths demonstrated