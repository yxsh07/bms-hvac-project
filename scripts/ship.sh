#!/usr/bin/env bash
set -euo pipefail
# WSL cannot read the Windows git worktree's .git pointer; use its native CLI.
if [ -n "${WSL_DISTRO_NAME:-}" ] && command -v git.exe >/dev/null 2>&1; then
  git() { git.exe "$@"; }
  gh() { gh.exe "$@"; }
fi
msg="${1:?conventional commit message}"
pnpm -r --if-present lint
pnpm -r --if-present typecheck
pnpm -r --if-present test
(cd apps/sim && ruff check . && pytest -q)
scripts/check-site-agnostic.sh
git add -A
if git diff --cached --name-only | grep -E '^(data/raw/|\.env)'; then echo "refusing: raw data or env staged"; exit 1; fi
big=$(git diff --cached --name-only --diff-filter=AM | while read -r f; do [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 1048576 ] && echo "$f"; done || true)
[ -z "$big" ] || { echo "refusing: files > 1 MB staged:"; echo "$big"; exit 1; }
git commit -m "$msg"
git push -u origin HEAD
existing_pr=$(gh pr view --json url --jq .url 2>/dev/null || true)
if [ -n "$existing_pr" ]; then
  printf '%s\n' "$existing_pr"
else
  gh pr create --fill --base "${PR_BASE:-main}"
fi
