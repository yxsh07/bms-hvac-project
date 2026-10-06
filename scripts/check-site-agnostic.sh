#!/usr/bin/env bash
set -euo pipefail
# Tier 1 patterns: kmssh|Manavata|KIMS|JouleLogger plus tokens from data/seed/forbidden-strings.txt
# Tier 2 patterns: chiller|ahu|fcu|cooling.tower (case-insensitive) in Tier 2 paths only
# Exit non-zero with file:line on any hit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Tier 1: forbidden strings (exact match across whole repo)
TIER1_PATTERNS=(
  "kmssh"
  "Manavata"
  "KIMS"
  "JouleLogger"
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

fail=0

echo "Checking Tier 1 patterns..."
for pattern in "${TIER1_PATTERNS[@]}"; do
  matches=$(grep -r -l -E \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=data \
    --exclude-dir=docs \
    --exclude-dir=fixtures \
    --exclude-dir=scripts \
    --exclude="build_ontology_json.py" \
    --exclude="*.test.*" \
    "$pattern" "$REPO_ROOT" 2>/dev/null || true)
  for f in $matches; do
    echo "FAIL: Tier 1 hit: pattern='$pattern' file=$f"
    fail=1
  done
done

# Check forbidden-strings.txt if it exists
if [ -f "${REPO_ROOT}/data/seed/forbidden-strings.txt" ]; then
  while IFS= read -r pattern; do
    [[ "$pattern" =~ ^#.*$ ]] && continue
    [[ -z "$pattern" ]] && continue
    matches=$(grep -r -l -E \
      --exclude-dir=node_modules \
      --exclude-dir=.git \
      --exclude-dir=data \
      --exclude-dir=docs \
      --exclude-dir=fixtures \
      --exclude-dir=scripts \
      --exclude="build_ontology_json.py" \
      --exclude="*.test.*" \
      "$pattern" "$REPO_ROOT" 2>/dev/null || true)
    for f in $matches; do
      echo "FAIL: Tier 1 hit: forbidden string '$pattern' file=$f"
      fail=1
    done
  done < "${REPO_ROOT}/data/seed/forbidden-strings.txt"
fi

echo "Checking Tier 2 patterns..."
for pattern in "${TIER2_PATTERNS[@]}"; do
  for path in "${TIER2_PATHS[@]}"; do
    if [ -d "${REPO_ROOT}/$path" ]; then
      matches=$(grep -r -n -E \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=data \
        --exclude-dir=docs \
        --exclude-dir=fixtures \
        --exclude="*.test.*" \
        -i "$pattern" "${REPO_ROOT}/$path" 2>/dev/null || true)
      for line in $matches; do
        echo "FAIL: Tier 2 hit: pattern='$pattern' line=$line"
        fail=1
      done
    fi
  done
done

if [ "$fail" -eq 1 ]; then
  echo "Site-agnostic check FAILED"
  exit 1
fi

echo "Site-agnostic check PASSED"
exit 0