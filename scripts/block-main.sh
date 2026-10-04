#!/usr/bin/env bash
set -euo pipefail
branch="$(git branch --show-current)"
if [ "$branch" = "main" ]; then
  echo "Direct push to main is blocked. Use a feature branch and PR."
  exit 1
fi