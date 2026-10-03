# Plan Red-Team (T-004)

Sceptical staff-engineer review of the merged PLAN.md v2.0.

## Top 10 risks (likelihood × damage)

1. **SimSite physics never matches real hospital** (High × High) — 3 days of calibration cannot prove a full-year building; gate G7 with real dummy DB is the only proof. Mitigation: label all sim outputs "indicative", stop at §6.7 tolerances.
2. **Token burn exceeds 1.5M Baseline** (High × High) — R4 notes free-tier logging inflates counts; BURN.md tracking starts now, Lean switch at G2.
3. **Agent site-hardcoding** (High × Medium) — the site-agnostic gate is the only defence; review agent must run it on every PR.
4. **GitHub Free plan blocks branch protection** (Medium × High) — private repos get 403 on rulesets; decide Pro vs lefthook fallback before T-006.
5. **Set-point workflow is the most intricate state machine** (Medium × High) — 7 states, timeouts, gateway read-back, revert; table-driven tests + fake gateway essential. A-tier design first.
6. **No CAD/BIM means twin is schematic** (Medium × Medium) — users may mistake it for reality; label "schematic layout" in UI.
7. **Cont confidential data in repo** (Low–Medium × High) — R3 rules, git-ignore data/raw, T-057 sanitise before any public release.
8. **Three.js / R3F version mismatch** (Medium × Medium) — R3F v9 pairs with React 19; pin at T-002.
9. **Scope creep: chat, ops overview, L1 pull budget** (Medium × Medium) — cut order in §9.3; never-cut list enforced by CI.
10. **Free-tier models on contracts/audit** (Medium × High) — R5: A-tier for contracts, B for build, A or different B for review.

## Three decisions I would change

1. **DEC-1 (PWA vs RN):** The plan defers the RN decision to Q1, but the prompt pack starts Phase 3 with PWA anyway. If the client insists on RN, L1 is cut (+150–250k tokens). Ask Q1 before T-030, not after.
2. **DEC-12 (PROVISIONAL mark):** The 2-hour threshold is arbitrary; the client's D-08 says "choose and state in writing". Get confirmation in Q-table (H-4) before T-050 reports ship.
3. **Tiering of optimiser:** DEC-11 calls it rule-based "Should", but §5.9 item 5 makes it part of the what-if overlay which is a Should. If the sim never produces good ΔT predictions (tolerances in §6.7), the optimiser has nothing to build on — move it to Could and document the dependency.

## Over-scoped items

- L1 3D (Should) with expand floors, revolve, comfort heatmap — measure performance before committing; the 2D fallback must ship regardless.
- 90-day `fouling-90d` scenario runs in coarse mode; still expensive. Verify the coarse-mode site config actually works before building.
- Chat with 6 tool calls and token cap — complexity disproportionate to the Could tier; consider simpler "ask a question" pattern.

## Contradictions between sections

- §2.3 site config says `cadenceSeconds: 60` but §7.4 says the continuous aggregate refresh offset must be ≥ max lateness. If late data arrives >60s after the window, the rollup misses it. Resolve: refresh offset ≥ 120s, or state the assumption.
- §5.5 L2 budget says "≤400 SVG nodes" but the plant layout in §5.3 can grow with anchors. The generator (§5.10) is heuristic; cap it and validate in CI.
- DEC-10 says no direct-apply path, but §8.5 "pencil to unlock" implies an edit affordance. The plan reconciles this (unlock → request flow), but agents may miss the distinction — make it explicit in AGENTS.md.

## Budget plausibility (§9.2)

The 1.5M Baseline allocates 100k to Phase 0 (~7%). T-004 alone is 25k premium tokens (A-tier). That leaves 75k for T-002, T-003, T-005, T-006, T-007 — enough if research is web-only and repo init is B/C tier. The sim design (SIM1, 25k) and twin design (T1, 15k) eat 40k of the 140k premium cap, leaving ~100k for B1 contracts and B4 workflow design. Plausible, but track burn from T-004 onward; if the premium model burns >50% of its cap by T-014, switch to Lean and drop L1.
