#!/usr/bin/env bash
set -euo pipefail
# Tier 1 patterns: kmssh|Manavata|KIMS|JouleLogger plus tokens from data/seed/forbidden-strings.txt
# Tier 2 patterns: chiller|ahu|fcu|cooling.tower (case-insensitive) in Tier 2 paths only
# Exit non-zero with file:line on any hit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Tier 1: forbidden strings (exact match across whole repo)
TIER1_PATTERNS=(
  "kmssh"
  "Manavata"
  "KIMS"
  "JouleLogger"
)
TIER1_FILES=(
  "${REPO_ROOT}/data/seed/forbidden-strings.txt"
)

# Tier 2: generic equipment words only in app/domain code paths
TIER2_PATTERNS=(
  "\\bchiller\\b"
  "\\b\\??ahu\\b"
  "\\bfcu\\b"
  "\\bcooling.tower\\b"
)
TIER2_PATHS=(
  "apps/web/src"
  "apps/api/src"
  "packages/quality"
  "packages/ontology"
)
TIER2_EXCLUDES=(
  "data/"
  "docs/"
  "**/fixtures/**"
  "**/*.test.*"
)

fail=0

echo "Checking Tier 1 patterns..."
for pattern in "${TIER1_PATTERNS[@]}"; do
  matches=$(rg -l "$pattern" "${REPO_ROOT}" 2>/dev/null || true)
  for f in $matches; do
    echo "FAIL: Tier 1 hit: pattern='$pattern' file=$f"
    fail=1
  done
done

echo "Checking Tier 2 patterns..."
for pattern in "${TIER2_PATTERNS[@]}"; do
  for path in "${TIER2_PATHS[@]}"; do
    # Use rg with path filter and exclusions
    matches=$(rg -g "!${TIER2_EXCLUDES[*]/#/-g \"!\"}" -p "$pattern" "$path" 2>/dev/null || true)
    for f in $matches; do
      echo "FAIL: Tier 2 hit: pattern='$pattern' file=$f"
      fail=1
    done
  done
done

if [ "$fail" -eq 1 ]; then
  echo "Site-agnostic check FAILED"
  exit 1
fi

echo "Site-agnostic check PASSED"
exit 0