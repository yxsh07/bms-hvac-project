# Backlog (from PLAN.md §11)

| ID | Task | Tier | Size | Needs | Prompt | Plan Section |
|---|---|---|---|---|---|---|
| T-001 | Reference UI analysis | — | — | **DONE** (§4) | — | §4 |
| T-002 | Stack and version check | C | S | — | R2 | §12.2 |
| T-003 | Twin patterns research (L1 only) | B | S | — | R3 | §5 |
| T-004 | Red-team this plan | A | M | — | A1 | Whole file |
| T-005 | Repo init, workspace, compose skeleton, hooks | C/B | M | H-2 | D1 | §2.5, §10 |
| T-006 | CI, PR template, ship/merge scripts, review gate, site-agnostic check | B | M | T-005 | D1 | §10 |
| T-007 | Backlog → GitHub issues | P | S | T-005 | D2 | §11 |
| T-010 | `build_ontology_json.py`, point-roles seed (local only) | B | M | H-1 | C1 | §3, §6.2, §7.3 |
| T-011 | `calibrate.py` → profiles, curves, gap stats | B | L | T-010 | C1 | §3.2, §6.2 |
| T-012 | Multi-block CSV parser, reconcile to `manifest.json` | B | M | H-1 | C1 | §3.1, §7.5 |
| T-013 | `packages/quality` (+ tests) | B | M | — | C2 | §7.5 |
| T-014 | Contracts v0 (ontology, telemetry, set-point, audit, gateway, controller health, floors, report run) | A | M | T-004 | B1 | §7.2, §7.4, §7.6, §7.8, §7.9 |
| T-015 | DB migrations and rollups | B | M | T-014 | B3 | §7.4 |
| T-016 | SimSite engine v0 (design A, build B) | A/B | L | T-011, H-3 | SIM1, SIM2 | §3.2, §6 |
| T-017 | Site-store writer and fault layer | B | M | T-016 | SIM2 | §6.2, §6.5 |
| T-020 | API skeleton, JWT, RBAC (5 roles) | B | M | T-014 | B2 | §7.2, §7.7 |
| T-021 | Ingest worker and drivers (csv, timescale-raw, sim-http) | B | L | T-013, T-015, T-017 | B3 | §6.2, §7.2, §7.4, §7.5 |
| T-022 | Ontology, asset, telemetry, coverage endpoints | B | M | T-020, T-021 | B2 | §7.3, §7.9 |
| T-023 | Audit hash chain and verify | B | M | T-020 | B2 | §7.8 |
| T-024 | Set-point workflow, GatewayDriver, sim gateway | A→B | L | T-023, T-017 | B4 | §7.6, §6.3 |
| T-025 | Controller health endpoint | C | S | T-022 | B2 | §7.11 |
| T-026 | `floors/summary`, `plant/kpis`, comfort config | B | S | T-022 | B2 | §7.9, §7.10 |
| T-029 | Walking skeleton: one page, live value for one asset | C | S | T-022 | W0 | §8.4 |
| T-030 | Design tokens and app shell | B | M | T-029 | F1 | §4.3, §8.1, §8.2 |
| T-031 | Auth, site selector, `PointRenderer` | B | M | T-030 | F1 | §8.3, §8.4 |
| T-032 | Asset browser, detail, charts | B | M | T-031 | F1 | §8.4 |
| T-033 | twin-core: schema, role resolver, registry, store, generator (design A) | A/B | L | T-014 | T1 | §5.3, §5.4, §5.8, §5.10 |
| T-034 | **L2** plant schematic | B | M | T-033 | T2 | §5.5 |
| T-034b | **L3** equipment templates + control strip + parameters | B | M | T-033, T-031 | T3 | §5.6 |
| T-035 | **L1** building 3D (Should) | B | L | T-033, T-026 | T4 | §5.7 |
| T-036 | Set-point UI and approval queue | B | M | T-024, T-031 | F2 | §7.6, §8.5 |
| T-037 | Alarms and controller health UI | C | M | T-025 | F2 | §7.11, §8.4 |
| T-040 | Sim Console shell and controls | B | M | T-016 | SIM3 | §6.8 |
| T-041 | Scenario engine: 8 core + 3 gateway presets | B | L | T-017 | SIM3 | §6.3, §6.6 |
| T-042 | Playwright suite ↔ Test Checklist | B | L | T-041, T-036 | QA1 | §6.8 |
| T-043 | What-if endpoint and twin overlay (Should) | A/B | M | T-034 | WIF1 | §5.9, §6.3 |
| T-044 | Sim control modes and weather strip env | B | S | T-016 | SIM3 | §6.3, §6.8 |
| T-050 | Reports 1–5 | B | L | T-022, T-041 | RPT1 | §7.10 |
| T-051 | Optimiser rules (Should) | B | M | T-043 | OPT1 | §5.9, §11 |
| T-052 | PWA and tablet pass | B | M | T-032 | F1 | §8.6, §8.1 |
| T-053 | Docs, README, demo script, seeded accounts | C | M | all | DOC1 | §13 |
| T-054 | Final whole-repo review (security, site-agnostic, RBAC) | A | M | all | REV2 | Whole file |
| T-055 | Chat panel with tool trace (Could) | B | M | T-022 | LUM1 | §4.4, §7.12 |
| T-056 | Ops overview on synthetic data (Could) | C | M | T-041 | OPS1 | §4.4, §11 |
| T-057 | Public-release sanitise (Could) | B | S | all | — | §0.2, §10.9 |
| T-058 | Second synthetic site (Should) | B | M | T-041 | Z1 | §6.9 |
| T-059 | Schedules and overrides CRUD (Should) | B | M | T-023 | B2 | §7.12, §7.7 |
| T-060 | WebSocket live updates (Could) | B | M | T-022 | — | §7.9, §8.4 |
| T-061 | Time scrubber (Could) | B | S | T-034 | T2 | §5.9 |

---

## Gates

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