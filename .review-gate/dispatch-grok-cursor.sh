#!/usr/bin/env bash
# Grok reviewer via Cursor CLI (owner fallback when xAI grok dispatch hits 402).
# See ~/.claude/memory/workflow_cursor_subordinate.md — GROK FALLBACK LANE.
set -euo pipefail

PROMPT_FILE="${1:?prompt file}"
OUTDIR="${2:?outdir}"
NAME="${3:?name}"
TIMEOUT="${4:-1200}"
MODEL="${UNF_CURSOR_GROK_MODEL:-grok-4.7-medium}"

mkdir -p "$OUTDIR"
cp "$PROMPT_FILE" "$OUTDIR/00-BRIEF.md"

OUT_TXT="$OUTDIR/${NAME}-out.txt"
ERR_TXT="$OUTDIR/${NAME}-err.txt"
RESULT_JSON="$OUTDIR/${NAME}-result.json"

START=$(date +%s)
RC=0
STATUS=PASS

set +e
(
  cd "$OUTDIR"
  timeout "$TIMEOUT" cursor-agent -p --trust --mode ask \
    --model "$MODEL" --output-format text \
    "You are a reviewer, not the implementer. Read the file 00-BRIEF.md in this directory in full (complete gate packet). Do not read outside this directory unless the brief inlines sources. Reply with a first line: Verdict: PROCEED | FIX | HOLD. Then: Findings (Critical → Major → Nits), each mapped to plan acceptance A1–A6 where relevant."
) >"$OUT_TXT" 2>"$ERR_TXT"
RC=$?
set -e

END=$(date +%s)
ELAPSED=$(python3 -c "print(round(${END} - ${START}, 1))")
OUT_BYTES=$(wc -c <"$OUT_TXT" | tr -d ' ')
ERR_BYTES=$(wc -c <"$ERR_TXT" | tr -d ' ')

if [[ "$RC" -eq 124 ]]; then
  STATUS=TIMEOUT
elif [[ "$RC" -ne 0 ]]; then
  STATUS=ERROR
elif [[ "$OUT_BYTES" -lt 20 ]]; then
  STATUS=EMPTY
  RC=1
fi

if rg -q '402|usage balance exhausted' "$ERR_TXT" 2>/dev/null; then
  STATUS=LAUNCH_ERROR
fi

export RESULT_JSON NAME MODEL TIMEOUT STATUS RC ELAPSED OUT_BYTES ERR_BYTES OUT_TXT ERR_TXT OUTDIR
python3 <<'PY'
import json, os
doc = {
    "name": os.environ["NAME"],
    "tool": "cursor-agent",
    "model": os.environ["MODEL"],
    "cap": int(os.environ["TIMEOUT"]),
    "pong": False,
    "status": os.environ["STATUS"],
    "rc": int(os.environ["RC"]),
    "elapsed": float(os.environ["ELAPSED"]),
    "out_bytes": int(os.environ["OUT_BYTES"]),
    "err_bytes": int(os.environ["ERR_BYTES"]),
    "served_model": None,
    "out": os.environ["OUT_TXT"],
    "err": os.environ["ERR_TXT"],
    "cwd": os.environ["OUTDIR"],
    "effort_applied": True,
    "lane": "cursor-cli-grok-fallback",
}
with open(os.environ["RESULT_JSON"], "w") as f:
    json.dump(doc, f, indent=1)
PY

echo "{\"name\": \"${NAME}\", \"status\": \"${STATUS}\", \"rc\": ${RC}, \"lane\": \"cursor-agent\"}"
exit "$RC"