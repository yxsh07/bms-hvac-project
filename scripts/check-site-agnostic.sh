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

# Build exclude args for rg
EXCLUDE_ARGS=(
  "-g" "!data/"
  "-g" "!docs/"
  "-g" "!**/fixtures/**"
  "-g" "!**/*.test.*"
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

# Also check forbidden-strings.txt if it exists
if [ -f "${REPO_ROOT}/data/seed/forbidden-strings.txt" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    matches=$(rg -l "$line" "${REPO_ROOT}" 2>/dev/null || true)
    for f in $matches; do
      echo "FAIL: Tier 1 hit (forbidden-strings): pattern='$line' file=$f"
      fail=1
    done
  done < "${REPO_ROOT}/data/seed/forbidden-strings.txt"
fi

echo "Checking Tier 2 patterns..."
for pattern in "${TIER2_PATTERNS[@]}"; do
  for path in "${TIER2_PATHS[@]}"; do
    full_path="${REPO_ROOT}/${path}"
    [ -d "$full_path" ] || continue
    matches=$(rg -i -p "${EXCLUDE_ARGS[@]}" "$pattern" "$full_path" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      while IFS= read -r line; do
        [ -z "$line" ] && continue
        echo "FAIL: Tier 2 hit: pattern='$pattern' file=$line"
        fail=1
      done <<< "$matches"
    fi
  done
done

if [ "$fail" -eq 1 ]; then
  echo "Site-agnostic check FAILED"
  exit 1
fi

echo "Site-agnostic check PASSED"
exit 0