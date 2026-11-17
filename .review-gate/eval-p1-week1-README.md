# P1 eval — week 1 (30 rows)

Template for plan §7.1. **Mechanical preflight** ≠ P1 green — you still need host answers, citations (A2), abstention (A3), mixed labels (A4), and MCP/FINDINGS trap evidence.

## One-shot (operator)

```bash
npm run kb:p1-all
```

Or stepwise:

```bash
npm run kb:p1-prep          # consolidation + Obsidian + manuals
npm run kb:score-eval       # fills retrieval preflight
```

## Outputs

| File | Purpose |
|------|---------|
| [eval-p1-week1.csv](./eval-p1-week1.csv) | Master template |
| `eval-p1-week1-scored.csv` | After `kb:score-eval` — `retrieved_chunk_ids`, preflight columns |
| `eval-p1-week1-preflight.md` | Summary table |

## Phase 1.3 (host)

```bash
npm run kb:p1-host-fill   # after score-eval; does not overwrite retrieval preflight
```

1. For each row: run route per `expected_route` (kb CLI/MCP, unf MCP, FINDINGS).
2. Fill `cited_chunk_ids`, `observed_outcome`, `pass_fail`, `failure_class` (script fills KB/FINDINGS rows; MCP rows need `UNF_COOKIE`).
3. P1 gate:

```bash
EVAL_ATTACHMENT="$(pwd)/.review-gate/eval-p1-week1-scored.csv" \
  ./.review-gate/run-product-kb-gates.sh p1
```

**Pass rule:** all 30 rows `pass_fail=pass` (A6).