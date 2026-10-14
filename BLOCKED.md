# Resolved: Sim Console to BMS Twin browser check

Resolved on 2026-10-14: live dashboard responses now bypass the five-minute browser cache, ingest reads 2,500 rows per poll, and Postgres writes telemetry in batches. The Chromium bridge check passed against the rebuilt Compose stack (1 test, 10.5 s).

- Check: `pnpm -C apps/web exec playwright test e2e/sim-bridge.spec.ts --project=chromium --reporter=line` failed twice on 2026-10-13.
- First failure: the generated API client called browser `fetch` without its binding. Fixed the generator, regenerated the client, rebuilt the web app, and updated the running container.
- Second failure: real API login and initial plant data appeared, but changing outdoor conditions and speed in Sim Console did not change the overview plant-power value within 30 seconds.
- Direct API verification: after a manual SimSite `/sim/env` and `/sim/clock` change, `/api/v1/sites/simsite-hospital/plant/kpis` changed from 2.49 kW to 8.11 kW. The persisted ingest cursor reset from 195115 to the new SimSite stream after restart.
- Suspected next checks: compare the Sim Console request payload and current scenario state, confirm ingest catches up at 600x, and inspect browser polling responses or PWA caching. Do not claim the browser bridge is complete.
- Checks passed: API and web typecheck, API/web/twin unit tests, API/web lint, site-agnostic check, SimSite API tests. The running web/API containers include current source copied after local builds, but Docker images need a final rebuild after the last source edits.
