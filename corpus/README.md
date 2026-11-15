# corpus/ — product knowledge store (local, gitignored)

This directory is **not committed**. See [`.review-gate/PLAN-product-kb-rag.md`](../.review-gate/PLAN-product-kb-rag.md) §4.2.

| File / dir | Purpose |
|------------|---------|
| `consolidation.md` | Authority map, dedupe, scope (Phase 0.7) |
| `manifest.jsonl` | Approved sources before ingest |
| `chunks.jsonl` | Chunk text + metadata for `kb_search` |
| `index/` | Rebuildable search index |
| `raw/` | Optional cached fetches |
| `raw/obsidian/` | Optional export copy from Drive vault before chunk |

**Obsidian source:** `UNF_OBSIDIAN_VAULT_SHOPCOM` → `…/secondbrain/SHOPCOM` (see [PRODUCT-KB.md](../PRODUCT-KB.md)). Do not index vault product-catalog tables for live BV/price.

Live BV/price/order truth stays on **unfranchise-MCP**, not here.