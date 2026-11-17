#!/usr/bin/env bash
# Delegate P1 host handoff + gate review (sol + grok).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DISPATCH="$REPO/.review-gate/dispatch-medium.sh"
BRIEF="$REPO/.review-gate/delegation-p1-host-handoff.md"
OUT="$REPO/.review-gate/delegation-p1"
mkdir -p "$OUT/sol" "$OUT/grok"

PROMPT="$OUT/brief.md"
{
  cat "$BRIEF"
  echo ""
  echo "## Eval preflight"
  cat "$REPO/.review-gate/eval-p1-week1-preflight.md"
  echo ""
  echo "## Scored CSV (first 15 lines)"
  head -16 "$REPO/.review-gate/eval-p1-week1-scored.csv"
} >"$PROMPT"

"$DISPATCH" codex --model gpt-6.1-sol \
  --prompt-file "$PROMPT" --outdir "$OUT/sol" --name "p1-host-sol" --timeout 900 \
  --cwd "$OUT/sol" --files "$BRIEF" "$REPO/FINDINGS.md" "$REPO/PRODUCT-KB.md" &

"$DISPATCH" grok --model grok-4.7 \
  --prompt-file "$PROMPT" --outdir "$OUT/grok" --name "p1-host-grok" --timeout 900 \
  --cwd "$OUT/grok" --files "$BRIEF" "$REPO/.review-gate/eval-p1-week1-preflight.md" &

wait
echo "=== P1 delegation complete ==="
head -25 "$OUT/sol"/*-out.txt 2>/dev/null || true
head -25 "$OUT/grok"/*-out.txt 2>/dev/null || true