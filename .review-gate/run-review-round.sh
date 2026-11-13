#!/usr/bin/env bash
# Pre-commit / manual review: gpt-6.1-sol + grok-4.7 on staged MCP sources.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$(cd "$(dirname "$0")" && pwd)"
DISPATCH="$GATE/dispatch-medium.sh"
EFFORT=medium
export UNF_DISPATCH_EFFORT=medium
ROUND="${1:-r1}"
mkdir -p "$GATE/files-$ROUND" "$GATE/sol-$ROUND" "$GATE/grok-$ROUND"

FILES=(
  package.json server.js cli.js pure-smoke.mjs test-form1000-optimise.mjs
  lib/urls.js lib/volume.js lib/client.js lib/tools.js lib/confirm.js lib/validate.js
  lib/parse-forms.js lib/parse-checkout.js lib/network-patterns.js lib/billship-fixtures.js lib/redact.js
  lib/form1000-optimise.js lib/form1000-sheet.js lib/form1000-quarters.js lib/form1000-cli.js
  scripts/capture-session.mjs scripts/capture-xhr-playwright.mjs
  CHECKOUT.md NETWORK.md README.md FORM1000.md .gitignore
  fixtures/checkout-billship.synthetic.html fixtures/checkout-billship.parsed.json
  fixtures/form1000-sheet.example.csv fixtures/form1000-quarters.example.json
)
rm -rf "$GATE/files-$ROUND"
mkdir -p "$GATE/files-$ROUND/lib" "$GATE/files-$ROUND/scripts" "$GATE/files-$ROUND/fixtures"
for f in "${FILES[@]}"; do
  case "$f" in
    lib/*) cp "$REPO/$f" "$GATE/files-$ROUND/$f" ;;
    scripts/*) cp "$REPO/$f" "$GATE/files-$ROUND/$f" ;;
    fixtures/*) cp "$REPO/$f" "$GATE/files-$ROUND/$f" ;;
    *) cp "$REPO/$f" "$GATE/files-$ROUND/" ;;
  esac
done

(cd "$REPO" && git diff --no-color HEAD -- "${FILES[@]}" 2>/dev/null; git diff --no-color --cached -- "${FILES[@]}" 2>/dev/null) \
  | sort -u > "$GATE/pr-$ROUND.diff" || true
if [[ ! -s "$GATE/pr-$ROUND.diff" ]]; then
  git -C "$REPO" diff --no-color HEAD~1..HEAD -- "${FILES[@]}" > "$GATE/pr-$ROUND.diff" 2>/dev/null || touch "$GATE/pr-$ROUND.diff"
fi

cat > "$GATE/brief-$ROUND.md" <<EOF
# Unfranchise MCP review ($ROUND)

Read-only security + correctness review of the Unfranchise HK MCP (Node stdio, cookie auth).

Scope: server.js, cli.js, lib/*.js, form1000 modules, capture scripts, pure-smoke + test-form1000-optimise — cookie handling, dry-run gates, Form 1000 optimiser must never assign/submit/order or fetch.

Threat focus: cookie leakage, accidental mutations without confirm, SSRF, path traversal on fixturePath, PII in captures, optimiser calling network on confirm.

Consensus: **PROCEED** or **approve with nits** with zero High/Critical in scope.

Output: Verdict, Findings (Critical→Nits), Suggested tests.
EOF

cat "$GATE/brief-$ROUND.md" > "$GATE/sol-prompt-$ROUND.md"
echo "" >> "$GATE/sol-prompt-$ROUND.md"
echo "## FINDINGS.md excerpt (rules)" >> "$GATE/sol-prompt-$ROUND.md"
head -80 "$REPO/FINDINGS.md" >> "$GATE/sol-prompt-$ROUND.md"
if rg -n '^## Gaps' "$REPO/FINDINGS.md" >/dev/null 2>&1; then
  echo "" >> "$GATE/sol-prompt-$ROUND.md"
  echo "## FINDINGS.md Gaps" >> "$GATE/sol-prompt-$ROUND.md"
  awk '/^## Gaps/{p=1} p' "$REPO/FINDINGS.md" >> "$GATE/sol-prompt-$ROUND.md"
fi

F_LIST=()
for f in "${FILES[@]}"; do
  [[ -f "$GATE/files-$ROUND/$f" ]] && F_LIST+=("$GATE/files-$ROUND/$f")
done
FD="$GATE/pr-$ROUND.diff"

"$DISPATCH" codex --model gpt-6.1-sol \
  --prompt-file "$GATE/sol-prompt-$ROUND.md" --outdir "$GATE/sol-$ROUND" --name "unf-$ROUND-sol" --timeout 1800 \
  --cwd "$GATE" --files "${F_LIST[@]}" "$FD" &

"$DISPATCH" grok --model grok-4.7 \
  --prompt-file "$GATE/brief-$ROUND.md" --outdir "$GATE/grok-$ROUND" --name "unf-$ROUND-grok" --timeout 1800 \
  --cwd "$GATE/grok-$ROUND" --files "${F_LIST[@]}" "$FD" &

wait

echo "=== $ROUND review complete ==="
for lens in sol grok; do
  f=$(ls "$GATE/$lens-$ROUND"/*-out.txt 2>/dev/null | head -1)
  echo "--- $lens ---"
  head -15 "$f" 2>/dev/null || echo "(no output)"
done
