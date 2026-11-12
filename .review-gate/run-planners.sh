#!/usr/bin/env bash
# Five-lens planning packet — effort medium only (codex / agy / opencode / grok / nim).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$(cd "$(dirname "$0")" && pwd)"
DISPATCH="$GATE/dispatch-medium.sh"
BRIEF="$GATE/PLAN_BRIEF.md"
export UNF_DISPATCH_EFFORT=medium

mkdir -p "$GATE/plan-codex" "$GATE/plan-agy" "$GATE/plan-opencode" "$GATE/plan-grok" "$GATE/plan-nim"

"$DISPATCH" codex --model gpt-5.6-luna \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-codex" --name unf-plan-codex --timeout 600 \
  --cwd "$REPO" --files "$REPO/FINDINGS.md" "$REPO/README.md" --sandbox workspace-write &

"$DISPATCH" agy --model gemini-3.8-flash-medium \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-agy" --name unf-plan-agy --timeout 600 \
  --cwd "$REPO" --files "$REPO/FINDINGS.md" "$REPO/README.md" &

"$DISPATCH" opencode --model google/gemini-3.8-flash \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-opencode" --name unf-plan-oc --timeout 600 \
  --cwd "$REPO" --files "$REPO/FINDINGS.md" "$REPO/README.md" &

"$DISPATCH" grok --model grok-4.7 \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-grok" --name unf-plan-grok --timeout 600 \
  --cwd "$GATE/plan-grok" --files "$REPO/FINDINGS.md" "$REPO/README.md" &

"$DISPATCH" nim --model nvidia/nvidia/nemotron-3-ultra-550b-a55b \
  --prompt-file "$BRIEF" --outdir "$GATE/plan-nim" --name unf-plan-nim --timeout 600 \
  --cwd "$REPO" --files "$REPO/FINDINGS.md" "$REPO/README.md" &

wait
echo "planners done (effort=medium)"
