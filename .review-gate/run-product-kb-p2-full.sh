#!/usr/bin/env bash
# Phase 2 ship gate: tests + sol/grok P2 review (P1 eval attached).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

TEST_LOG="$(mktemp)"
export KB_TEST_LOG="$TEST_LOG"
export EVAL_ATTACHMENT="${EVAL_ATTACHMENT:-$REPO/.review-gate/eval-p1-week1-scored.csv}"

{
  echo "$ npm test"
  npm test
  echo "$ npm run test:kb"
  npm run test:kb
} >"$TEST_LOG" 2>&1 || { cat "$TEST_LOG"; rm -f "$TEST_LOG"; exit 1; }

"$REPO/.review-gate/run-product-kb-gates.sh" p2

rm -f "$TEST_LOG"
echo "[p2-full] sol/grok outputs: .review-gate/product-kb-p2/{sol,grok}/"
echo "[pstack] optional: /interrogate on kb-server.js + kb/lib (findings-only; pair with sol/grok PROCEED)"