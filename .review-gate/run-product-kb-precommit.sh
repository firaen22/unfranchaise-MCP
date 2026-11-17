#!/usr/bin/env bash
# Product KB precommit: tests + sol 6.1 + grok P2-style review of kb diff.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

DIFF="$(mktemp)"
git diff --stat HEAD >"$DIFF" 2>/dev/null || true
git status --short >>"$DIFF" 2>/dev/null || true

TEST_LOG="$(mktemp)"
{
  echo "$ npm test"
  npm test
  echo "$ npm run test:kb"
  npm run test:kb
} >"$TEST_LOG" 2>&1 || { cat "$TEST_LOG"; rm -f "$DIFF" "$TEST_LOG"; exit 1; }

export KB_PRECOMMIT_DIFF="$DIFF"
export KB_TEST_LOG="$TEST_LOG"
export EVAL_ATTACHMENT="$DIFF"

echo "[kb-precommit] product-kb gate p2 (sol + grok)"
"$REPO/.review-gate/run-product-kb-gates.sh" p2

rm -f "$DIFF" "$TEST_LOG"
echo "[kb-precommit] complete — inspect .review-gate/product-kb-p2/{sol,grok}/"