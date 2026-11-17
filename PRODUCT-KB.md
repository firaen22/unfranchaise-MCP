# Product knowledge routing (operator)

Companion to [`.review-gate/PLAN-product-kb-rag.md`](./.review-gate/PLAN-product-kb-rag.md). Not loaded by MCP.

## Knowledge retrieval (primary)

- **Target:** local `kb` MCP — `kb_search`, `kb_get` over gitignored `corpus/` (see plan §4.0).
- **No NotebookLM required** at runtime for grok bot or shipped workflow.

## Notebook (optional benchmark)

- **ID:** `784c829c-ea44-4d19-b040-cc6edca5ae19` — compare answers on same eval rows only.
- **MCP / `nlm`:** optional for operator; not a gate dependency.

## Obsidian second brain (Drive)

Operator vault (Google Drive sync on Mac):

```text
UNF_OBSIDIAN_VAULT_SHOPCOM=
  …/My Drive/secondbrain/SHOPCOM
```

Default if unset:  
`/Users/yauch/Library/CloudStorage/GoogleDrive-ilovegemini31@gmail.com/My Drive/secondbrain/SHOPCOM`

| Folder | Ingest to `corpus/`? | `claim_class` |
|--------|----------------------|---------------|
| `00-Dashboard/` | **No** (pipeline tables — stale fast) | — |
| `01-Business-Plan/` | **Post-P1** only | `operator_synthesis` |
| `01-Business-Plan/product-catalog*.md` | **Never** (`ingest_allowed=false`) | — |
| `02-B2B/` | **Yes (0.8)** | `operator_synthesis` |
| `03-Downline/` | **Post-P1** when non-empty | `operator_synthesis` |
| `Templates/` | **Yes (0.8)** | `operator_synthesis` |

**0.8 allowlist:** mirrors plan **§4.3** (authoritative). Do not widen folders without plan edit.

**Flow:** vault markdown → ingest script → `manifest.jsonl` + `chunks.jsonl` → local index → `kb_search`. Grokbot does **not** read the vault path at runtime.

Resolve Obsidian `[[wikilinks]]` on ingest; store `vault_rel_path` in chunk metadata.

## Build order (operator)

1. **0.7-lite** — `corpus/consolidation.md` §1 = authority stack in plan §6.3 (MCP → FINDINGS → manual → Obsidian → training → social).
2. **0.8 Second brain** — ingest **`02-B2B/` + `Templates/` only** → manifest + chunks → index v0 → interim `kb search`/`kb get` smoke (plan §5).
3. **Enhancement (0.4)** — `npm run kb:ingest-manuals` (ch 15,16,19,20,22,25); merges with Obsidian corpus; raw HTML → `corpus/raw/manual/`.
4. **Eval** — template [.review-gate/eval-p1-week1.csv](./.review-gate/eval-p1-week1.csv).
5. **Post-P1 (0.9)** — curated training, X, other vault folders; new freeze before scoring.

Full consolidation rules: plan [§6.4](./.review-gate/PLAN-product-kb-rag.md). Do not index all 466 NLM YouTube sources on v0.

## Routing (quick)

| If the question needs… | Use |
|------------------------|-----|
| Live SKU, BV, IBV, UC, SRP, price, promos, cart, Form 1000 | `unfranchaise-MCP` + [FINDINGS.md](./FINDINGS.md) |
| Policy / ordering / ads / PC rules | `kb_search` / `kb_get` ([plan §6.3](./.review-gate/PLAN-product-kb-rag.md), [DOCUMENTS.md](./DOCUMENTS.md)) |
| Talk tracks (when chunked into corpus) | `kb_search` |
| Dated corporate news (e.g. SHOP.COM migration) | `kb_search`/`kb_get` if chunk in `corpus/` (post-P1 ingest); else abstain — **not** for order URLs |

**Hard rule:** Numbers and “where to click to order” → MCP/FINDINGS only.

## X (Twitter) allowlist

Only **verified** accounts you add here may be ingested via **single-post URLs**. No timeline/hashtag imports.

| Handle | Verified? | Notes |
|--------|-----------|--------|
| *(X not in 資源 → 社群媒體; add corporate X if you have URL)* | | Portal lists FB/IG/YT only [FINDINGS § 資源] |
| `https://www.facebook.com/markethongkong` | y | Ingest specific posts via URL if needed |
| `https://www.instagram.com/markethongkong` | y | |
| `https://www.youtube.com/markethongkongvideos` | y | Overlaps NLM notebook sources |

**Ingest one post:** allowlist → `manifest.jsonl` with `ingest_allowed=true` only after **post-P1 freeze** (plan 0.9); until then inventory-only (`ingest_allowed=false`, no `chunks.jsonl`). **Optional mirror:** NotebookLM — benchmark only.

Label mentally: `claim_class=official_social`. Posts before **2026-09-28** about `shop.com` → historical context only.

## Eval sheet

30-row template: see plan §7.1. Store filled CSV outside git or in `.review-gate/` when ready.

## P2 sidecar ship (operator)

**Gate:** dual `PROCEED` on `.review-gate/product-kb-p2/{sol,grok}/` (2026-11-17). **Not required for daily use:** re-run `npm run kb:p2-gate` unless you change kb code.

1. **Corpus:** `npm run kb:p1-prep` if `corpus/manifest.jsonl` is missing.
2. **MCP:** add `unfranchaise-kb` in README `mcp.json` snippet (`node kb-server.js`).
3. **Smoke:** `npm run kb:ship-smoke` before enabling in a host agent.
4. **Mix plane:** live BV/price/cart → `unfranchaise-hk` MCP only; policy/manual → `kb_*`. Never pass `UNF_COOKIE` into kb args or `UNF_KB_OP_CONTEXT` poison.

**Provenance nit (p1-029):** frozen eval `retrieved_chunk_ids` may differ from a fresh `runKbSearch` on uncited slots (`#8` vs `#10`); cited `#5` unchanged. Rescore only when rebasing the eval sheet — see `.review-gate/eval-p1-week1-provenance.md`.

**Phase 3 (optional):** second product family, 60-row holdout, hybrid retrieval — plan §5 after operator sign-off.