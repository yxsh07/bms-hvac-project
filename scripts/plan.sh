#!/usr/bin/env bash
set -euo pipefail
# usage: scripts/plan.sh 7   -> prints "## 7. ..." up to the next "## " heading
awk -v n="${1:?section number}" '/^## / { p = ($0 ~ "^## " n "[. ]") } p' docs/PLAN.md