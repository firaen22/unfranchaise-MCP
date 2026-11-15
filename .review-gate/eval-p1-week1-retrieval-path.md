# Retrieval path equivalence (preflight vs MCP kb_search)

- **Production MCP** (`kb/lib/kb-handlers.js`): `kb_search` → `runKbSearch(userQuery, { limit })` in `kb/lib/kb-search-run.js`.
- **Heuristics** (`kb/lib/query-enhance.js`): `enhanceKbSearchQuery` is identity (verbatim question). `inferKbSearchOptions` sets FTS mode / chapter filters when the **question text** names the topic (e.g. `social ads`, `Obsidian`, `70% rule`, zh `訂貨程序`). **Alias bridge** (`kb/lib/kb-search-run.js`): if zh ordering alias returns zero hits on English-only manuals, `runKbSearch` retries `product ordering procedures manual chapter 15` and sets `aliasBridge` on the result (p1-022).
- **Index** (`kb/lib/index-db.js`): FTS includes `vault_rel_path` so paths like `02-B2B/` match user tokens; Obsidian B2B rows boost when query contains `B2B`.
- **Preflight** (`scripts/kb-p1-rescore-retrieval.mjs`): calls the same `runKbSearch(row.question)`.
- **Host scoring** (`observed_outcome` in CSV): independent of preflight; cites must appear in `retrieved_chunk_ids` after rescore.

Sample trace (p1-007, production path):
```json
{
  "query": "B2B pitch tone from operator vault (Obsidian) without numbers?",
  "enhanced": "B2B pitch tone from operator vault (Obsidian) without numbers?",
  "options": {
    "ftsMode": "or",
    "dropStopwords": false,
    "requireObsidian": true,
    "requireChapter": false
  },
  "hits": [
    {
      "chunk_id": "obs_7370808e3a2c#0",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "日韓料理全服務餐廳 — 商業計劃書",
      "doc_version": "vault-0.8",
      "snippet": "日韓料理全服務餐廳 — 商業計劃書\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n# 日韓料理全服務餐廳 — 商業計劃書\n\n> **餐廳名稱：** 待定  \n> **目標地區：** 待定  \n> **版本日期：** 2026年4月  \n\n---"
    },
    {
      "chunk_id": "obs_7370808e3a2c#1",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "目錄",
      "doc_version": "vault-0.8",
      "snippet": "目錄\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n## 目錄\n\n1. [執行摘要](#1-執行摘要)\n2. [業務概念](#2-業務概念)\n3. [市場分析](#3-市場分析)\n4. [與 Shop.com 的合作策略](#4-與-shopcom-的合作策略)\n5. [菜單與產品策略…"
    },
    {
      "chunk_id": "obs_7370808e3a2c#3",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "2. 業務概念",
      "doc_version": "vault-0.8",
      "snippet": "2. 業務概念\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n## 2. 業務概念"
    },
    {
      "chunk_id": "obs_7370808e3a2c#4",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "2.1 品牌定位",
      "doc_version": "vault-0.8",
      "snippet": "2.1 品牌定位\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n### 2.1 品牌定位\n\n以「**日韓兩地風味、一桌融合體驗**」為核心，提供：\n- 精選日式刺身、壽司、拉麵\n- 韓式烤肉、部隊鍋、炸雞系列\n- 特色日韓融合創意菜"
    },
    {
      "chunk_id": "obs_7370808e3a2c#5",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "2.2 餐廳形式",
      "doc_version": "vault-0.8",
      "snippet": "2.2 餐廳形式\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n### 2.2 餐廳形式\n\n- **座位數：** 建議 40–60 個（中型全服務餐廳）\n- **用餐風格：** 點餐制 + 部分桌邊烤肉服務\n- **服務時段：** 午市（12:00–15:00）+ 晚市（18:00–22…"
    },
    {
      "chunk_id": "obs_7370808e3a2c#6",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "2.3 獨特賣點（USP）",
      "doc_version": "vault-0.8",
      "snippet": "2.3 獨特賣點（USP）\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n### 2.3 獨特賣點（USP）\n\n1. 堂食體驗與 Shop.com 線上售賣產品同步運營\n2. 自家製醬料、調味包作為副業產品銷售\n3. 顧客可於 Shop.com 購買「到會套裝」預訂\n\n---"
    },
    {
      "chunk_id": "obs_7370808e3a2c#7",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "3. 市場分析",
      "doc_version": "vault-0.8",
      "snippet": "3. 市場分析\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n## 3. 市場分析"
    },
    {
      "chunk_id": "obs_7370808e3a2c#9",
      "source_id": "obs_7370808e3a2c",
      "doc_title": "3.2 競爭分析",
      "doc_version": "vault-0.8",
      "snippet": "3.2 競爭分析\n02-[[B2B]]/restaurant/restaurant-business-plan.md\n### 3.2 競爭分析\n\n| 競爭對手類型 | 優勢 | 弱點 |\n|-------------|------|------|\n| 連鎖日料（如壽司郎、一蘭） | 品牌認知度高 | 個人化體驗不足 |\n| 獨立韓式烤肉店 | 氣氛熱鬧 | 缺乏線上零售渠道 |\n| 外賣平台餐廳 | 覆蓋面廣 | 無法建立品牌忠誠度 |\n\n**本店優勢：** 實體餐廳 + Shop.com 電商雙渠道…"
    }
  ]
}
```

Reindex during bundle: exit=0 {
  "indexed": 96,
  "total": 109
}
Trap MCP capture: exit=0 {
  "written": "/Users/yauch/Documents/unfranchaise/.review-gate/eval-p1-week1-trap-mcp-traces.json",
  "live": true
}
A5 mixed turn: exit=0 {
  "written": "/Users/yauch/Documents/unfranchaise/.review-gate/eval-p1-week1-a5-mixed-turn.json",
  "pass": true,
  "live": true
}
A1/A6 sol harnesses: exit=0 {
  "a1_pass": true,
  "a6_pass": true
}
A5 generation context: exit=0 {
  "pass": true
}
