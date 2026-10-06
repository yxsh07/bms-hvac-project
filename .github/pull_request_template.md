# Pull request

## Task
<!-- T-0xx, link the issue -->

## What changed
<!-- Bullet list. Keep the PR <= 400 changed lines (one task, one PR). -->

## How to verify
<!-- Exact commands / steps a reviewer runs. -->

## Screenshots (UI changes only)
<!-- Attach 390 / 820 / 1180x820 / 1440 widths. -->

## Checklist
- [ ] lint + typecheck + tests pass (`pnpm lint && pnpm typecheck && pnpm test`; `pnpm -C apps/sim test`)
- [ ] `scripts/check-site-agnostic.sh` passes
- [ ] contracts unchanged, or `pnpm generate:client` re-run and committed
- [ ] no direct control write: set-point changes go through the request flow
- [ ] every mutation is audited via the hook, not per route
- [ ] one line added to `docs/BURN.md`

## Skipped / follow-ups
<!-- Anything intentionally not done, with the reason. -->
