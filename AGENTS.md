# AGENTS.md
Project: BMS/HVAC app + digital twin + SimSite simulator. Plan: docs/PLAN.md.
Read a plan section with: scripts/plan.sh <n>. Never load the whole plan. NEVER open data/raw.
Rules
- Work only in your worktree/branch. One task, one PR (<=400 changed lines).
- Contracts first: change packages/contracts, regenerate the client, then code.
- Site-agnostic: tier rules in PLAN 2.5; bind UI and twin to ROLES (point-roles.json), never to point abbreviations or asset names. scripts/check-site-agnostic.sh must pass.
- Quality: bad values are kept but marked (quality code), never deleted or averaged.
- Every mutation writes an audit record via the hook; never per route by hand.
- Control writes go through the set-point request flow only; there is no direct write.
- Time: UTC internally; ISO-8601 with offset at the API edge (site tz from config).
- Tests with every change (vitest / pytest). No snapshot tests for 3D.
- Original design only: no copied logos, renders, plans or copy.
Definition of Done
- lint + typecheck + tests pass; scripts/ship.sh succeeds; PR text lists what changed, how to verify, anything skipped; UI changes attach screenshots (390/820/1180x820/1440).
- Append one line to docs/BURN.md (task, tokens if known, turns, outcome).
Stop rule: same check fails twice -> write BLOCKED.md (what, tried, suspected) and stop.
Final message: <=5 lines.
Stack: pnpm workspace; React 19+Vite+TS+Tailwind; Fastify+zod; Timescale/Postgres (plain SQL); Python 3.12+FastAPI (sim); R3F+drei+zustand (L1 only); SVG (L2/L3); Vitest, Playwright, pytest.
