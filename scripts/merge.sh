#!/usr/bin/env bash
set -euo pipefail
pr="${1:?pr number}"
gh pr view "$pr" --json labels --jq '.labels[].name' | grep -qx 'reviewed-ok' || { echo "no reviewed-ok label"; exit 1; }
gh pr checks "$pr" --watch --fail-fast
gh pr merge "$pr" --squash --delete-branch