# BMS/HVAC App + Digital Twin + SimSite Simulator

Working prototype per PLAN.md. See docs/PLAN.md for full plan, and docs/BURN.md for token burn tracking.

## Quick start (compose)

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
# Wait for Timescale to init, then:
pnpm -w run dev      # web app on port 5173
pnpm -w run dev      # sim API on port 8000 (actually: python -m uvicorn sim:app --port 8000)
```

## Packages

- `packages/contracts` — OpenAPI + zod schemas, generated TS client
- `packages/twin-core` — layout schema, role resolver, glyph registry, SVG components
- `packages/twin-3d` — L1 R3F building view
- `packages/ontology` — loader, classification → renderer mapping
- `packages/quality` — sentinel / range / stopped / consistency rules

## Apps

- `apps/web` — React 19 + Vite + TS + Tailwind PWA (port 5173)
- `apps/api` — Fastify + TS + zod (port 3000)
- `apps/sim` — Python 3.12 + FastAPI + numpy simulator (port 8000)
- `apps/sim-console` — React 2D SVG control room (port 5174)

## CI

See `.github/workflows/ci.yml`. On Free plan: lefthook pre-push blocks main, review-gate workflow required.