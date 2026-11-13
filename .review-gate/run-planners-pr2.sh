#!/usr/bin/env bash
# PR2: codex + agy + grok planning only (medium effort).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$(cd "$(dirname "$0")" && pwd)"
DISPATCH="$GATE/dispatch-medium.sh"
BRIEF="$GATE/PLAN_BRIEF_PR2.md"
export UNF_DISPATCH_EFFORT=medium

for d in plan-codex-pr2 plan-agy-pr2 plan-grok-pr2; do
  mkdir -p "$GATE/$d"
done

"$DISPATCH" codex --model gpt-5.6-luna \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-codex-pr2" --name unf-pr2-codex --timeout 900 \
  --cwd "$REPO" --files "$REPO/CHECKOUT.md" "$REPO/NETWORK.md" "$REPO/lib/tools.js" &

"$DISPATCH" agy --model gemini-3.8-flash-medium \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-agy-pr2" --name unf-pr2-agy --timeout 900 \
  --cwd "$REPO" --files "$REPO/CHECKOUT.md" "$REPO/NETWORK.md" "$REPO/lib/tools.js" &

"$DISPATCH" grok --model grok-4.7 \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-grok-pr2" --name unf-pr2-grok --timeout 900 \
  --cwd "$GATE/plan-grok-pr2" --files "$REPO/CHECKOUT.md" "$REPO/NETWORK.md" "$REPO/lib/tools.js" &

wait
echo "pr2 planners done"
