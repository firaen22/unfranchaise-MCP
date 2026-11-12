#!/usr/bin/env bash
# Final pre-commit: Fable (medium thinking) — requires cursor-agent.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$(cd "$(dirname "$0")" && pwd)"
OUT="$GATE/fable-precommit"
MODEL="${FABLE_MODEL:-claude-fable-5-1-thinking-medium}"
mkdir -p "$OUT"

cd "$REPO"
echo "[fable-precommit] npm test"
npm test

if ! command -v cursor-agent >/dev/null; then
  echo "cursor-agent not found — install Cursor CLI" >&2
  exit 1
fi

PROMPT="Read $(basename "$GATE")/fable-precommit-brief.md in repo $REPO and execute it. Write full review to $OUT/verdict.md"

cursor-agent -p -f --output-format text --model "$MODEL" "$PROMPT" | tee "$OUT/verdict-stream.txt"

if [[ ! -f "$OUT/verdict.md" ]]; then
  cp "$OUT/verdict-stream.txt" "$OUT/verdict.md"
fi

head -1 "$OUT/verdict.md" | grep -qx 'PROCEED' || {
  echo "[fable-precommit] FIX — see $OUT/verdict.md"
  exit 1
}
echo "[fable-precommit] PROCEED"
