#!/usr/bin/env bash
set -euo pipefail
msg="${1:?conventional commit message}"
pnpm -r --if-present lint && pnpm -r --if-present typecheck && pnpm -r --if-present test   # each package's test script is "vitest run"
(cd apps/sim && ruff check . && pytest -q)
scripts/check-site-agnostic.sh
git add -A
if git diff --cached --name-only | grep -E '^(data/raw/|\.env)'; then echo "refusing: raw data or env staged"; exit 1; fi
big=$(git diff --cached --name-only --diff-filter=AM | while read -r f; do [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 1048576 ] && echo "$f"; done || true)
[ -z "$big" ] || { echo "refusing: files > 1 MB staged:"; echo "$big"; exit 1; }
git commit -m "$msg"
git push -u origin HEAD
gh pr create --fill --base main