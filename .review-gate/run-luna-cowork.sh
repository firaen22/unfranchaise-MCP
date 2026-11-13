#!/usr/bin/env bash
# Luna 5.6 implementation pass — model_reasoning_effort=medium only.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$(cd "$(dirname "$0")" && pwd)"
ROUND="${1:-r1}"
LUNA_DIR="$GATE/luna-$ROUND/cowork"
mkdir -p "$LUNA_DIR/lib" "$LUNA_DIR/fixtures"
cp "$REPO"/{package.json,server.js,cli.js,pure-smoke.mjs,test-form1000-optimise.mjs} "$LUNA_DIR/"
cp "$REPO/lib/"*.js "$LUNA_DIR/lib/"
cp "$REPO/fixtures/"* "$LUNA_DIR/fixtures/" 2>/dev/null || true
cp "$REPO/FINDINGS.md" "$LUNA_DIR/00-FINDINGS.md" 2>/dev/null || true
cp "$GATE/PLAN-fox-fix.md" "$LUNA_DIR/00-PLAN.md" 2>/dev/null || true
cp "$GATE/brief-luna-cowork.md" "$LUNA_DIR/00-BRIEF.md"
cp -R "$REPO/scripts" "$LUNA_DIR/" 2>/dev/null || true

if ! command -v codex >/dev/null; then
  echo "codex CLI not found"
  exit 1
fi

(
  cd "$LUNA_DIR"
  codex exec -m gpt-5.6-luna -c model_reasoning_effort=medium \
    --sandbox workspace-write --skip-git-repo-check \
    -o "$GATE/luna-$ROUND/luna-cowork-final.txt" \
    "Read 00-BRIEF.md. Implement. Run node pure-smoke.mjs before finishing." </dev/null
)

(cd "$LUNA_DIR" && node pure-smoke.mjs)
