# Delegation — P1 host completion (Angus)

## Context (verified on disk 2026-11-14)

- Corpus: `npm run kb:p1-prep` → 10 manifest rows, 107 chunks, 95 indexed.
- Preflight: `npm run kb:score-eval` → `eval-p1-week1-scored.csv`, `eval-p1-week1-preflight.md`.
- Mechanical pass/fail ≠ P1 green — need host `pass_fail` on all 30 rows.

## Assignment (delegates)

### sol (gpt-6.1-sol)

Produce **operator checklist** (numbered) to complete rows **p1-008–p1-015** and **p1-026** with **exact MCP/CLI commands** from this repo (`cli.js`, FINDINGS.md). No invented tools.

### grok (grok-4.7)

Produce **retrieval tuning recommendations** for abstain rows **p1-009, p1-010** (false-positive kb hits) without weakening A1. Map each preflight `fail` row to **fix owner**: ingest | query rewrite | host discipline.

## Artifacts to read

- `.review-gate/eval-p1-week1-preflight.md`
- `.review-gate/eval-p1-week1-scored.csv`
- `PRODUCT-KB.md`, `FINDINGS.md`

## Output format

Verdict: PROCEED | FIX | HOLD  
Deliverable: markdown sections `sol-checklist` and `grok-tuning` (grok fills second only).