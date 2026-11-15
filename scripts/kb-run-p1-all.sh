#!/usr/bin/env bash
# Operator: full Phase 1 mechanical track (tests + corpus + eval preflight).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[p1-all] npm test"
npm test

echo "[p1-all] corpus prep 0.7-lite + 0.8 + 0.4"
node "$ROOT/scripts/kb-p1-prep.mjs"

echo "[p1-all] eval preflight (retrieval only)"
node "$ROOT/scripts/kb-score-eval.mjs"

echo "[p1-all] done — fill cited_chunk_ids via host; then: EVAL_ATTACHMENT=$ROOT/.review-gate/eval-p1-week1-scored.csv ./.review-gate/run-product-kb-gates.sh p1"