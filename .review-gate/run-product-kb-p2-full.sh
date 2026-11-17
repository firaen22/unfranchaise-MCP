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
  echo "$ node scripts/kb-p2-host-wire-evidence.mjs"
  node scripts/kb-p2-host-wire-evidence.mjs
  echo "$ node scripts/kb-p2-typesafe-findings-rate.mjs"
  node scripts/kb-p2-typesafe-findings-rate.mjs
  echo "$ node scripts/kb-p2-mcp-transport.mjs"
  node scripts/kb-p2-mcp-transport.mjs
  echo "$ node scripts/kb-p2-host-generation-stub.mjs"
  node scripts/kb-p2-host-generation-stub.mjs
  echo "$ node scripts/kb-p2-a5-embedded-generation.mjs"
  node scripts/kb-p2-a5-embedded-generation.mjs
  echo "$ node scripts/kb-p2-classifier-oracle-red.mjs"
  node scripts/kb-p2-classifier-oracle-red.mjs
  echo "$ node scripts/kb-p2-product-family-evidence.mjs"
  node scripts/kb-p2-product-family-evidence.mjs
  echo "$ node scripts/kb-p2-preflight-artifacts.mjs"
  node scripts/kb-p2-preflight-artifacts.mjs
  echo "$ node scripts/kb-p1-trap-evidence.mjs (p1_026 findings only; no cookie OK)"
  node scripts/kb-p1-trap-evidence.mjs || true
} >"$TEST_LOG" 2>&1 || { cat "$TEST_LOG"; rm -f "$TEST_LOG"; exit 1; }

DIFF_LOG="$(mktemp)"
{
  echo "=== unstaged ==="
  git -C "$REPO" diff --stat 2>/dev/null || true
  echo "=== staged ==="
  git -C "$REPO" diff --stat --cached 2>/dev/null || true
} >"$DIFF_LOG"
export KB_PRECOMMIT_DIFF="$DIFF_LOG"

"$REPO/.review-gate/run-product-kb-gates.sh" p2

rm -f "$TEST_LOG" "$DIFF_LOG"
echo "[p2-full] sol/grok outputs: .review-gate/product-kb-p2/{sol,grok}/"
echo "[pstack] optional: /interrogate on kb-server.js + kb/lib (findings-only; pair with sol/grok PROCEED)"