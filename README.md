# BMS/HVAC App + Digital Twin + SimSite Simulator

Working prototype per [docs/PLAN.md](docs/PLAN.md). Token burn is tracked in
[docs/BURN.md](docs/BURN.md); the task list is [docs/BACKLOG.md](docs/BACKLOG.md).

## Quick start (compose)

```bash
pnpm install
pnpm generate:client                       # regenerate packages/contracts/client
docker compose -f infra/docker-compose.yml up -d --build
```

| Service | URL | What |
|---|---|---|
| Web PWA | http://localhost:5173 | React 19 + Vite, L1/L2/L3 twin, set-points |
| API | http://localhost:3000/api/v1 | Fastify + zod, ingest, RBAC, audit, reports |
| SimSite | http://localhost:8000 | Python simulator + mock BMS gateway |
| Sim Console | http://localhost:5174 | 2D control room, scenarios, Test Checklist |

One Timescale/Postgres container hosts both logical stores: the raw
client-shaped `site_store.points` and the normalised `app_store.*` tables
(created by `apps/api/src/migrations`).

### Run pieces locally (no Docker)

```bash
pnpm -C apps/sim dev        # SimSite on :8000 (uvicorn sim.app:app)
pnpm -C apps/api dev        # API on :3000 (needs a TS runtime, e.g. tsx)
pnpm -C apps/web dev        # web on :5173
pnpm -C apps/sim-console dev
```

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test     # JS/TS workspace, serialized
pnpm -C apps/sim test                        # pytest (SimSite)
bash scripts/check-site-agnostic.sh          # PLAN 2.5 tier rules
```

## Packages

- `packages/contracts` — zod schemas + OpenAPI + generated TS client (single source of truth)
- `packages/twin-core` — layout schema, role resolver, glyph registry, binding store, layout generator
- `packages/twin-3d` — L1 R3F building view (lazy chunk)
- `packages/ontology` — JSON loader, classification → renderer mapping
- `packages/quality` — sentinel / range / stopped / consistency rules

## Data

- `data/seed/` — `ontology.json`, `point-roles.json`, `site.json`, `forbidden-strings.txt`
- `data/calibration/` — synthetic `profile.json` (replaced by `tools/calibrate.py` at gate G1)
- `data/scenarios/` — scenario catalogue and Test Checklist features
- `data/raw/` — GIT-IGNORED client export; never opened by agents

## CI

See [.github/workflows/ci.yml](.github/workflows/ci.yml): lint + typecheck +
unit tests, contracts drift, site-agnostic grep, and a review gate. Docker
image builds run on manual dispatch.
