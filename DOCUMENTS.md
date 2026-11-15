# Market Hong Kong — UnFranchise Manual (documents host)

Captured **2026-11-14** from public index pages. No session cookie required to read chapters. This is **policy / training corpus** material for product-KB RAG — **not** live SKU, BV, IBV, or price (use `unf_get_product` + FINDINGS).

## Hosts

| Locale | Base URL |
|--------|----------|
| English | https://hkg-eng.documents.unfranchise.com/ |
| 中文 | https://hkg-chi.documents.unfranchise.com/ |

English chapters use **slug paths** (stable for NotebookLM MCP `source_add` with `url=`; `nlm` CLI optional). Chinese index uses internal UUID paths; prefer **ENG URLs** for ingestion unless you need 正式中文.

## Part 1 — Business development system

| Ch | ENG path | Title |
|----|----------|-------|
| — | `/part-1-the-unfranchise-business-development-system/` | Part 1 |
| 1 | `/chapter-1-the-company/` | The Company |
| 2 | `/chapter-2-the-right-ingredients/` | The Right Ingredients |
| 3 | `/chapter-3-beginning-your-unfranchise-business/` | Beginning Your UnFranchise Business |
| 4 | `/chapter-4-establishing-your-unfranchise-business/` | Establishing Your UnFranchise Business |
| 5 | `/chapter-5-the-global-meeting-training-and-seminar-system/` | GMTSS |
| 6 | `/chapter-6-preferred-customer-program/` | Preferred Customer Program |
| 7 | `/chapter-7-market-hong-kong-mall-without-walls/` | Mall Without Walls |

## Part 2 — Policies, procedures, rules

| Ch | ENG path | Title | Product-KB priority |
|----|----------|-------|---------------------|
| — | `/part-2-policies-procedures-rules-and-regulations/` | Part 2 | — |
| 8 | `/chapter-8-management-performance-compensation-plan-mpcp/` | MPCP | plan / ethics (not product claims) |
| 9 | `/chapter-9-international-health-professional-program/` | IHPP | compliance |
| 10 | `/chapter-10-unfranchise-owner-application-renewal-and-status/` | Application / renewal | ops |
| 11 | `/chapter-11-ownership-and-transfer-of-unfranchise-business/` | Ownership / transfer | ops |
| 12 | `/chapter-12-marketing-plan-and-promotional-activities/` | Marketing / promos | stale-risk vs live site |
| 13 | `/chapter-13-miscellaneous-unfranchise-owner-rights-and-obligations/` | UFO rights | compliance |
| 14 | `/chapter-14-market-hong-kong-rights-and-obligations/` | MAHK rights | compliance |
| **15** | `/chapter-15-product-ordering-procedures-and-policies/` | **Product ordering** | **high** — cites HK.UnFranchise.com online ordering |
| **16** | `/chapter-16-product-sales-and-distribution/` | **Sales & distribution** | **high** — retail / 70% rule context |
| 17 | `/chapter-17-freight-and-shipping/` | Freight | shipping (compare FINDINGS free-ship) |
| 18 | `/chapter-18-return-of-merchandise-for-refund/` | Returns | ops |
| **19** | `/chapter-19-advertising-and-promotion/` | **Advertising** | **high** — claim boundaries |
| **20** | `/chapter-20-internet-and-webcenter-policies/` | **Internet / WebCenter** | **high** — shop / social |
| 21 | `/chapter-21-gmtss-policies-and-procedures/` | GMTSS policies | events |
| **22** | `/chapter-22-preferred-customer-program-policies-and-procedures/` | **PC program** | **high** — hk.shop / PC orders (stale URL risk) |
| 23 | `/chapter-23-corporate-and-field-communications/` | Communications | ops |
| 24 | `/chapter-24-forms-and-administration/` | Forms | cross-ref Form 1000 |
| 25 | `/chapter-25-key-definitions-and-terminology/` | Definitions | BV/IBV terms (numbers still MCP) |

Also on index: **Notice — Manual Updates**, **Limited Time Jump Start Promotion**.

Full URL: `https://hkg-eng.documents.unfranchise.com` + path (e.g. chapter 15: [Product Ordering](https://hkg-eng.documents.unfranchise.com/chapter-15-product-ordering-procedures-and-policies/)).

## Relation to `hk.unfranchise.com`

| Surface | Role |
|---------|------|
| `hk.unfranchise.com` | ColdFusion back-office (catalog, cart, forms) — [FINDINGS.md](./FINDINGS.md) |
| `hkg-*.documents.unfranchise.com` | Static manual (Mura CMS) — **separate origin**, not in MCP v0 |
| Top nav **資源 → 超連鎖手冊** | **`http://hkg-chi.documents.unfranchise.com/`** [verified: signed-in nav 2026-11-14] — [FINDINGS.md § 資源](./FINDINGS.md) |
| **事業 → 服務 → 網站管理** | `action=portal.unfSummary` — `www.marketHongkong.com.hk/<slug>`, `www.shopglobal.com/<slug>` |

Chapter 15 explicitly references ordering via **HK.UnFranchise.com** (electronic ordering), consistent with this repo’s MCP target.

## NotebookLM ingest (Phase 0.4)

**Canonical:** `user-notebooklm-mcp` → `source_add` (`notebook_id`, `source_type=url`, chapter URLs from table above). See plan [§6.3](./.review-gate/PLAN-product-kb-rag.md).

**Optional (operator shell):** `nlm source add --notebook 784c829c-ea44-4d19-b040-cc6edca5ae19 --url 'https://hkg-eng.documents.unfranchise.com/<chapter>/'`

## Gaps

- Which **資源** menu links on `hk.unfranchise.com` point here vs PDFs vs video — needs signed-in browse
- Chinese chapter URL ↔ English chapter mapping (UUID vs slug)
- Manual revision date on **Notice** page vs training video dates in NLM notebook