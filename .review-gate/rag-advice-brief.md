# Advisory brief — Product RAG from training material (UnFranchise HK)

You are advising the operator (Angus) on architecture/strategy only. Do NOT propose edits to the repo unless as optional future sketches.

## Context

- **Repo:** `unfranchaise-MCP` — stdio MCP + CLI for Market Hong Kong 超連鎖 (`hk.unfranchise.com`).
- **v0 shipped:** 17 tools — live catalog/cart (cookie session), volume/Form 1000 rules, checkout field map, placement URL helpers. Dry-run by default; FINDINGS.md is behavioral ground truth.
- **Live product truth:** `unf_search_products`, `unf_get_product` parse BV/IBV/UC from signed-in HTML — not from training PDFs.

## Question

Should Angus add a **product knowledge RAG** corpus built from **official distributor training material** (PDFs, slides, talk tracks) — separate from the operational MCP?

Secondary: how does this relate to a generic RAG primer (R→A→G: clean/chunk/metadata, hybrid search, re-rank, low temperature, debug pipeline not just bigger models)?

## Constraints / operator context

- Health/MLM-adjacent product claims — compliance and citation matter.
- BV/IBV/price/promos must stay on live MCP + FINDINGS, never inferred from training text.
- Operator also has NotebookLM MCP for ad-hoc notebook Q&A.
- Prefer minimal scope; correctness over speed.

## Deliverable (structured)

1. **Verdict** — yes / no / phased — one sentence.
2. **Architecture** — how to split operational MCP vs knowledge RAG (tools, data flow, or alternate v0 using NotebookLM only).
3. **Corpus & metadata** — what to ingest first, chunking strategy (SKU/product_family/locale/doc_version), hybrid search when it pays off.
4. **Risks** — top 5 failure modes (stale training, claim hallucination, BV confusion, access control, eval gap).
5. **v0 scope** — 2-week shippable slice with concrete acceptance criteria (incl. eval harness ideas).
6. **Explicit anti-patterns** — what not to build yet.

Be direct. Tag uncertainty. Disagree with "dump all training into one vector DB" if you think it's wrong.