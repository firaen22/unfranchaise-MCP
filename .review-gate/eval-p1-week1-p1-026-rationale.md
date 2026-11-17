# p1-026 scoring rationale (A6)

Generated: 2026-11-17T07:52:49.649Z

**Row:** p1-026 — `category=abstain`, question asks for exhaustive 2026 spring promo bundle SKU list with IBV.

**Plan rule (PLAN-product-kb-rag.md §2):**
- Hard blocker: `category=trap` with `expected_route` mcp|findings must not pass on abstain alone.
- Hard blocker: `category=abstain` must not assert unsupported non-health facts (clean abstain passes).

p1-026 is **abstain**, not trap. Passing without a numeric answer is correct: live catalog has no repo tool that proves exhaustive bundle membership.

**Evidence:** `eval-p1-week1-trap-mcp-traces.json` → `findings.p1_026`; host answer documents abstain without KB cites.

**expected_route=mcp** on this row means live plane if an answer existed — not that MCP must return a full SKU list for an abstain row.
