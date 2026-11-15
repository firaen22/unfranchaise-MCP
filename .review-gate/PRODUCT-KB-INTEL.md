# Product KB — gathered intel (2026-11-14)

**Purpose:** Inputs for `PLAN-product-kb-rag.md`. Not committed operational truth for BV/price.

## NotebookLM — Market Hong Kong Official

| Field | Value |
|-------|--------|
| Notebook ID | `784c829c-ea44-4d19-b040-cc6edca5ae19` |
| Sources | **466** (mostly YouTube training / MHKAC / LS / AC sessions) |
| MCP (canonical) | `source_add`, `notebook_query`, `notebook_get` — **no `nlm` CLI required** for agents/grok |
| CLI (optional) | `nlm source list 784c829c-ea44-4d19-b040-cc6edca5ae19` |

**Corpus skew [verified: nlm source list keyword counts]:** heavy on UnFranchise / Shopping Annuity / recruiting (~12 SHOP-titled sources, 20 Isotonix, etc.); **no** obvious `hkg-*.documents.unfranchise.com` manual chapters in titles (政策/手冊 keyword hits 0). Treat notebook as **field training + platform overviews**, not the full compliance manual.

**Citation shape [verified: notebook_query sample]:** answers use inline `[n]` refs; MCP returns a citations map (~91 entries on shop.com relationship query). P1 eval must map `[n]` → source **title** (A2).

## Platform map (agy + official docs + NLM)

| Surface | Audience | RAG / MCP role |
|---------|----------|----------------|
| `hk.unfranchise.com` | UFO back-office | **unfranchaise-MCP** live HTML for catalog, cart, Form 1000 |
| `hk.shop.com` / `hk.shop.com/<portal>` | PCs / public retail | **Do not scrape for RAG**; public prices promos belong on live shop or MCP parsers if ever added |
| `shopglobal.com` / Global | Cross-border | Training context only; volume rules still FINDINGS + MCP |
| `hkg-eng.documents.unfranchise.com` | Policy / manual | **Future source_add** to notebook or sidecar; operator training corpus |
| NLM notebook | Distributor education | **Knowledge plane v0** via `notebook_query` |

**NLM-confirmed relationships [relay: notebook_query]:**

- `hk.shop.com` — PC storefront, Cashback, exclusive brands + partner stores; orders feed BV/IBV upline (training narrative; numbers → MCP).
- `hk.unfranchise.com` — gated ERP: orders, BV/IBV, reports, training downloads.
- Shop Global — cross-border retail/personal consumption; BV/IBV to home account (policy detail → manual + FINDINGS).

**Key notebook sources for platform literacy:**

- `Market Hong Kong|HK.SHOP.COM Overview (8:16)`
- `LS2017 超連鎖事業帳戶與HK SHOP COM的優化功能…`
- `Market Hong Kong - UnFranchise® Business Presentation` / 建立超連鎖事業五步驟

## Agy web research

**Output:** [agy-shopcom-research-out.txt](./agy-shopcom-2026-11-14/shopcom-research-out.txt)

**Use:** URL/entity split for plan §13; **verify independently** any dated corporate claims (e.g. SHOP.COM ↔ Shopify 2026 — [unverified] in agy output).

**Official URLs to bookmark (not auto-scrape without rights):**

- https://hkg-eng.documents.unfranchise.com/
- https://hkg-chi.documents.unfranchise.com/
- https://hk.shop.com
- https://hk.unfranchise.com

## Implications for phased plan

1. **Phase 1.1 is done structurally** — notebook exists; narrow eval to **one product family** within 466 sources (e.g. Isotonix OPC), not a new empty notebook.
2. **Add Phase 0.4** — ingest manual chapters (Drive or URL) into same notebook or parallel “MHK Policy” notebook; keep training vs policy **labels** in eval `permitted_evidence`.
3. **Routing card:** `shop.com` / Global questions about **customer experience** → notebook; **SKU/BV/IBV/cart** → MCP; **comp plan / ethics** → documents host + FINDINGS.
4. **P1 canary:** query NLM with bait cookie string in host prompt — must not appear in notebook API payload (operator verifies in Cursor MCP logs).

## NotebookLM source limits (why own RAG)

| Fact | Detail |
|------|--------|
| Current notebook size | **466 sources** — mostly YouTube (one video ≈ one source) |
| Google limits | **~50–600 sources/notebook** depending on AI plan (Standard → Ultra); plus daily chat caps [unverified: exact tier for this account — check Gemini Notebook plan page] |
| Implication | Adding 6+ manual URLs + product PDFs + X posts **competes** with existing training library; may require second notebook or deletes |
| Plan decision | **Primary corpus = local `corpus/`**; NLM stays optional comparison, not production index |

## X (Twitter) — allowed (curated)

- **Policy:** [PLAN §6.2](./PLAN-product-kb-rag.md); allowlist in [PRODUCT-KB.md](../PRODUCT-KB.md).
- **Not in corpus today** — add per-post URLs after handles are listed.
- **Use case:** SHOP.COM → Shopify / MarketAmerica.com migration chatter; event links; **not** BV/price/order authority.
- **Cursor XSearch:** unavailable on operator account (2026-11-14); ingestion is manual URL paste, not live X search.