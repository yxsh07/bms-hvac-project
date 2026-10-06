# ADR-001 — Contracts as the single source of truth

**Status** Accepted · **Task** T-014 · **Plan** §7.1, §7.2, §7.4, §7.6, §7.8, §7.9

## Context

Five surfaces consume the same shapes: the Fastify API, the ingest worker, the
SimSite gateway/read path, the report runner and the React client. If each
invents its own request/response types the set-point state machine and the
quality contract drift silently, and no reviewer can see a breaking change.

## Decision

`packages/contracts` holds zod schemas for every wire shape (ontology,
telemetry series with the quality block and per-bucket `n`, set-point
lifecycle, audit record, gateway write/read, controller health, floors summary,
plant KPIs, report run, alarms, auth). They are the source of truth:

- API handlers validate input and build responses from these schemas.
- `src/index.ts` re-exports the whole surface; there is no per-route schema.
- The generated typed client (`client/index.ts`) is produced deterministically
  by `scripts/generate-client.mjs` from the same schemas.

We chose a hand-written generator over `openapi-generator` because the
prototype has no Java toolchain and the surface is small. `openapi.yaml` is kept
as the human-readable catalogue; the zod schemas are authoritative.

## Consequences

- CI runs `pnpm generate:client` and fails on drift (`git diff --exit-code`).
- Changing a shape means editing `packages/contracts` first, regenerating, then
  updating callers — never the reverse.
- The audit record schema deliberately includes **every signed field**
  (`justification`, `approverId`, `ip`, `device`), so tampering with a
  justification is detectable.
- `Regeneration produces no diff` is enforced; stray edits to `client/` fail CI.
