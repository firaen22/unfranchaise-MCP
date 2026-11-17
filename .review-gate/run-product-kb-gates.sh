#!/usr/bin/env bash
# Product KB plan gates: sol (gpt-6.1-sol) + grok-4.7, medium effort only.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$REPO/.review-gate"
export UNF_GROK_VIA_CURSOR="${UNF_GROK_VIA_CURSOR:-1}"
DISPATCH="$GATE/dispatch-medium.sh"
ROUND="${1:-p0}"
EVAL_ATTACHMENT="${EVAL_ATTACHMENT:-}"

case "$ROUND" in
  p0|p1|p2) ;;
  *)
    echo "Usage: $0 p0|p1|p2" >&2
    echo "  p1: set EVAL_ATTACHMENT to eval results path (optional)" >&2
    exit 2
    ;;
esac

OUT="$GATE/product-kb-$ROUND"
mkdir -p "$OUT/sol" "$OUT/grok"

PROMPT="$OUT/brief-$ROUND.md"
cat >"$PROMPT" <<EOF
# Product KB gate — $ROUND

You are a **reviewer**, not the implementer. Reply with a first line: **Verdict: PROCEED | FIX | HOLD**.

Then: Findings (Critical → Nits), each mapped to plan acceptance A1–A6 or gate criteria where relevant.

## Contract
- Cross-family advisory/plan review; grade claims against inlined artifacts only.
- Do not invent repo files; if missing, say HOLD and name what is needed.

EOF

F_EXTRA=()
[[ -f "$GATE/PLAN-product-kb-rag.md" ]] && F_EXTRA+=("$GATE/PLAN-product-kb-rag.md")

case "$ROUND" in
  p0)
    cat >>"$PROMPT" <<'EOF'
## Task
Review the phased plan for product knowledge RAG (**own RAG primary**: local corpus, Obsidian 0.8 bootstrap, manual enhancement 0.4, kb MCP Phase 2; NotebookLM benchmark-only).

Required: scope, reviewer gates, stop rules, acceptance A1–A6, 0.7-lite→0.8→0.4 ordering, dual-plane architecture (no cookie on knowledge plane), commercial_numeric exclusion on kb_search AND kb_get.

If FIX: list minimal edits to the plan file sections (by section number).
EOF
    echo "" >>"$PROMPT"
    echo "## Inlined plan" >>"$PROMPT"
    cat "$GATE/PLAN-product-kb-rag.md" >>"$PROMPT"
    F_EXTRA+=(
      "$GATE/rag-advice-brief.md"
      "$GATE/rag-advice-2026-11-14/sol/rag-advice-sol-out.txt"
      "$GATE/rag-advice-2026-11-14/grok/rag-advice-grok-out.txt"
      "$GATE/PRODUCT-KB-INTEL.md"
      "$GATE/agy-shopcom-2026-11-14/shopcom-research-out.txt"
      "$REPO/FINDINGS.md"
      "$REPO/PRODUCT-KB.md"
      "$REPO/DOCUMENTS.md"
    )
    ;;
  p1)
    cat >>"$PROMPT" <<'EOF'
## Task
Review Phase 1 completion: routing doc, 30-row eval results, failure log.

Required: Do results meet A1–A6 at stated thresholds? Should operator proceed to Phase 2 kb MCP ship?

If eval attachment missing, Verdict: HOLD and say what to attach.
EOF
    echo "" >>"$PROMPT"
    echo "## PRODUCT-KB routing (if present)" >>"$PROMPT"
    if [[ -f "$REPO/PRODUCT-KB.md" ]]; then
      cat "$REPO/PRODUCT-KB.md" >>"$PROMPT"
    else
      echo "(not yet committed — HOLD unless operator inlines)" >>"$PROMPT"
    fi
    if [[ -n "$EVAL_ATTACHMENT" && -f "$EVAL_ATTACHMENT" ]]; then
      echo "" >>"$PROMPT"
      echo "## Eval attachment" >>"$PROMPT"
      cat "$EVAL_ATTACHMENT" >>"$PROMPT"
    fi
  P1_BUNDLE=(
    "$GATE/eval-p1-week1-acceptance-A1-A6.md"
    "$GATE/eval-p1-week1-failure-log.md"
    "$GATE/eval-p1-week1-host-answers.md"
    "$GATE/eval-p1-week1-preflight-rationale.md"
    "$GATE/eval-p1-week1-a5-capture.json"
    "$GATE/eval-p1-week1-a5-host-boundary.txt"
    "$GATE/eval-p1-week1-a5-mixed-turn.json"
    "$GATE/eval-p1-week1-a1-claim-class-harness.json"
    "$GATE/eval-p1-week1-a6-version-harness.json"
    "$GATE/eval-p1-week1-a5-host-contract.md"
    "$GATE/eval-p1-week1-a5-generation-context.json"
    "$GATE/eval-p1-week1-typesafe-findings-rating.json"
    "$GATE/eval-p1-week1-provenance.md"
    "$GATE/eval-p1-week1-manifest-freeze.json"
    "$GATE/eval-p1-week1-harness-empty-corpus.txt"
    "$GATE/eval-p1-week1-harness-test-kb-excerpt.txt"
    "$GATE/eval-p1-week1-scored-answers.md"
    "$GATE/eval-p1-week1-retrieval-path.md"
    "$GATE/eval-p1-week1-edge-p1-020-022.json"
    "$GATE/eval-p1-week1-trap-mcp-traces.json"
  )
  for bf in "${P1_BUNDLE[@]}"; do
    [[ -f "$bf" ]] || continue
    echo "" >>"$PROMPT"
    echo "## Bundle: $(basename "$bf")" >>"$PROMPT"
    cat "$bf" >>"$PROMPT"
    F_EXTRA+=("$bf")
  done
  if [[ -n "${KB_TEST_LOG:-}" && -f "$KB_TEST_LOG" ]]; then
    echo "" >>"$PROMPT"
    echo "## npm test output" >>"$PROMPT"
    cat "$KB_TEST_LOG" >>"$PROMPT"
    F_EXTRA+=("$KB_TEST_LOG")
  fi
    ;;
  p2)
    cat >>"$PROMPT" <<'EOF'
## Task
Pre-merge review of kb sidecar MCP (kb_search, kb_get only).

Required: no session cookie; no generate tool; manifest metadata; commercial_numeric exclusion; eval traps still green.

Grade implementation against plan acceptance A1–A6 (inlined below). Implementation sources are attached as files and summarized inline.

Prerequisite: P1 promotion (30/30 pass) — eval sheet and bundle attached when present.

Operator addendum `eval-p2-plan-71-sidecar-addendum.md` includes **English-primary manual + A1 oracle scope** — grade P2 A1 against that section, not full spelled-Chinese matrix.
EOF
    echo "" >>"$PROMPT"
    echo "## Plan acceptance A1–A6 (excerpt)" >>"$PROMPT"
    sed -n '17,46p' "$GATE/PLAN-product-kb-rag.md" >>"$PROMPT"
    P2_EVAL="${EVAL_ATTACHMENT:-$GATE/eval-p1-week1-scored.csv}"
    if [[ -f "$P2_EVAL" ]]; then
      echo "" >>"$PROMPT"
      echo "## P1 eval (attached)" >>"$PROMPT"
      cat "$P2_EVAL" >>"$PROMPT"
      F_EXTRA+=("$P2_EVAL")
    fi
    P2_BUNDLE=(
      "$GATE/eval-p1-week1-a5-capture.json"
      "$GATE/eval-p1-week1-a5-mixed-turn.json"
      "$GATE/eval-p1-week1-a5-generation-context.json"
      "$GATE/eval-p1-week1-a1-claim-class-harness.json"
      "$GATE/eval-p1-week1-a6-version-harness.json"
      "$GATE/eval-p1-week1-host-answers.md"
      "$GATE/eval-p1-week1-manifest-freeze.json"
      "$GATE/eval-p1-week1-a5-host-boundary.txt"
      "$GATE/eval-p1-week1-trap-mcp-traces.json"
      "$GATE/eval-p1-week1-p1-026-rationale.md"
      "$GATE/eval-p1-week1-failure-log.md"
      "$GATE/eval-p1-week1-provenance.md"
      "$GATE/eval-p2-host-wire.json"
      "$GATE/eval-p2-mcp-transport.json"
      "$GATE/eval-p2-a5-sidecar-contract.json"
      "$GATE/eval-p2-host-generation-stub.json"
      "$GATE/eval-p2-a5-embedded-generation.json"
      "$GATE/eval-p2-plan-71-sidecar-addendum.md"
      "$GATE/eval-p1-week1-harness-empty-corpus.txt"
      "$GATE/eval-p2-retrieval-live-traces.json"
      "$GATE/eval-p2-classifier-oracle-red-green.json"
      "$GATE/eval-p2-product-family-wrong-family.json"
      "$GATE/eval-p2-typesafe-findings-rating.json"
      "$GATE/eval-p2-typesafe-fix-plan.json"
    )
    for bf in "${P2_BUNDLE[@]}"; do
      [[ -f "$bf" ]] || continue
      echo "" >>"$PROMPT"
      echo "## P1 bundle: $(basename "$bf")" >>"$PROMPT"
      cat "$bf" >>"$PROMPT"
      F_EXTRA+=("$bf")
    done
  if [[ -n "${KB_TEST_LOG:-}" && -f "$KB_TEST_LOG" ]]; then
      echo "" >>"$PROMPT"
      echo "## npm test / test:kb output" >>"$PROMPT"
      cat "$KB_TEST_LOG" >>"$PROMPT"
    fi
    if [[ -n "${KB_PRECOMMIT_DIFF:-}" && -f "$KB_PRECOMMIT_DIFF" ]]; then
      echo "" >>"$PROMPT"
      echo "## Git diff stat" >>"$PROMPT"
      cat "$KB_PRECOMMIT_DIFF" >>"$PROMPT"
    fi
    KB_INLINE=(
      "$REPO/kb-server.js"
      "$REPO/kb/lib/classify.js"
      "$REPO/kb/lib/spelled-commercial-en.js"
      "$REPO/kb/lib/guard-normalize.js"
      "$REPO/kb/lib/eligibility.js"
      "$REPO/kb/lib/index-db.js"
      "$REPO/kb/lib/retrieve.js"
      "$REPO/kb/lib/kb-search-run.js"
      "$REPO/kb/lib/search-query.js"
      "$REPO/kb/lib/jsonl.js"
      "$REPO/kb/lib/query-enhance.js"
      "$REPO/kb/lib/chunk-markdown.js"
      "$REPO/kb/lib/paths.js"
      "$REPO/kb/lib/merge-corpus.js"
      "$REPO/kb/lib/canary.js"
      "$REPO/kb/ingest/obsidian.js"
      "$REPO/kb/ingest/oracle-fixtures.js"
      "$REPO/kb/ingest/manual-html.js"
      "$REPO/kb/ingest/manual-chapters.js"
      "$REPO/kb/lib/index-harness.js"
      "$REPO/kb/lib/manifest-schema.js"
      "$REPO/kb/lib/kb-env.js"
      "$REPO/kb/lib/kb-tool-capture.js"
      "$REPO/kb/lib/message-content.js"
      "$REPO/kb/lib/kb-handlers.js"
      "$REPO/test-kb-mcp.mjs"
      "$REPO/test-kb-classify.mjs"
      "$REPO/kb/fixtures/mixed-policy.md"
      "$REPO/kb/fixtures/mixed-manual.html"
      "$REPO/kb/cli.js"
      "$REPO/test-kb.mjs"
      "$REPO/package.json"
      "$GATE/PLAN-product-kb-rag.md"
    )
    for f in "${KB_INLINE[@]}"; do
      [[ -f "$f" ]] || continue
      echo "" >>"$PROMPT"
      echo "## File: ${f#$REPO/}" >>"$PROMPT"
      echo '```' >>"$PROMPT"
      cat "$f" >>"$PROMPT"
      echo '```' >>"$PROMPT"
    done
    F_EXTRA+=("${KB_INLINE[@]}")
    ;;
esac

# Only pass files that exist (dispatch may choke on missing)
F_LIST=()
for f in "${F_EXTRA[@]}"; do
  [[ -f "$f" ]] && F_LIST+=("$f")
done

"$DISPATCH" codex --model gpt-6.1-sol \
  --prompt-file "$PROMPT" --outdir "$OUT/sol" --name "product-kb-$ROUND-sol" --timeout 1200 \
  --cwd "$OUT/sol" --files "${F_LIST[@]}" &

# Default: Grok via Cursor CLI (avoids xAI Grok Build 402). Set UNF_GROK_VIA_CURSOR=0 for ~/.grok dispatch.
# Set UNF_SKIP_GROK=1 to run Sol-only (e.g. close Sol FIX before Grok re-gate).
if [[ "${UNF_SKIP_GROK:-0}" != "1" ]]; then
  if [[ "${UNF_GROK_VIA_CURSOR:-1}" == "1" ]]; then
    bash "$GATE/dispatch-grok-cursor.sh" "$PROMPT" "$OUT/grok" "product-kb-$ROUND-grok" 1200 &
  else
    "$DISPATCH" grok --model grok-4.7 \
      --prompt-file "$PROMPT" --outdir "$OUT/grok" --name "product-kb-$ROUND-grok" --timeout 1200 \
      --cwd "$OUT/grok" --files "${F_LIST[@]}" &
  fi
fi

wait

GATE_RC=0
if [[ "${UNF_SKIP_GROK:-0}" != "1" ]]; then
  GROK_RESULT="$OUT/grok/product-kb-$ROUND-grok-result.json"
  if [[ -f "$GROK_RESULT" ]]; then
    GROK_STATUS="$(python3 -c "import json; print(json.load(open('$GROK_RESULT'))['status'])")"
    if [[ "$GROK_STATUS" != "PASS" ]]; then
      echo "[grok] reviewer status=$GROK_STATUS (expected PASS; xAI 402 → keep UNF_GROK_VIA_CURSOR=1)" >&2
      GATE_RC=1
    fi
  else
    echo "[grok] missing $GROK_RESULT" >&2
    GATE_RC=1
  fi
fi

echo "=== product-kb gate $ROUND complete ==="
for lens in sol grok; do
  [[ "$lens" == grok && "${UNF_SKIP_GROK:-0}" == "1" ]] && continue
  f=$(ls "$OUT/$lens"/*-out.txt 2>/dev/null | head -1)
  echo "--- $lens ---"
  head -20 "$f" 2>/dev/null || echo "(no output)"
done
echo "Full paths: $OUT/{sol,grok}/"
exit "$GATE_RC"