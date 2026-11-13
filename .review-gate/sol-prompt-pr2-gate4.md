# Unfranchise MCP review (pr2-gate4)

Read-only security + correctness review of the Unfranchise HK MCP (Node stdio, cookie auth).

Scope: server.js, cli.js, lib/*.js, capture scripts, pure-smoke.mjs — session cookie handling, dry-run gates, checkout read-only tools, no credential logging in fixtures/capture output.

Threat focus: cookie leakage in logs/errors, accidental live mutations without confirm, SSRF via user-controlled URLs, PII in captured HTML/logs.

Consensus: **PROCEED** or **approve with nits** with zero High/Critical in scope.

Output: Verdict, Findings (Critical→Nits), Suggested tests.

## FINDINGS.md excerpt (rules)
# Unfranchise HK — site map (orders, IBV/BV, Form 1000)

Captured from a signed-in browse of `hk.unfranchise.com`. No checkout, pay, or Form 1000 submit. Personal values redacted.

## Top navigation

`訂購` · `事業` · `資源` · `我的帳戶`

| Job | Path |
|---|---|
| Order entry | 訂購 → 訂購產品 / 再次訂購 / 超連鎖事業自動購貨 / 購物車 |
| Volume admin | 我的帳戶 → BV/IBV管理 → BV/IBV放置, 手動BV放置, IBDC指定, 現金回贈/IBV獎勵設定 |
| Form 1000 | 我的帳戶 → 網上表格 → 1000表格 (also 925/1001合併表格, 續約選項) |
| Volume reports | 事業 → 報告 → report picker |

---

## 1. Placing an order & IBV / BV display

### Catalog — 訂購產品

- **URL:** `https://hk.unfranchise.com/index.cfm?action=shopping.unfOrdering`
- **Title:** 訂購產品 | 超連鎖
- **Purpose:** browse/add products, quick-order by code, set ship-to country, open cart

**Fields / actions**

| Control | Detail |
|---|---|
| Search | GET `shopping.unfSearch`, field `keyword` |
| Quick order `qoe` | POST `#`: `productCode`, `qty`, button 添加 |
| Ship-to `shopShip` | POST `shopping.unfOrdering`, select `shipCountry`: 香港, 台灣, 澳洲, 新加坡, 印尼, 馬來西亞. Changing country warns that the cart will be cleared |
| Per product | checkbox named with SKU, qty `prdQtyN`, 「+ 加入購物車」 |

**Listing labels:** `UC HK$[amount] HKD`, `BV [n]`; IBV variants also `IBV [n]` or `IBV [n] ([p]%)`, sometimes `HK$節省額`, names ending `(IBV)*`.

Promo: 「選購精選獨家產品賺取更多IBV」  
Cart: `shopping.unfViewCart`

### Product detail — BV vs IBV SKU

Same product can have two SKUs:

| | BV SKU | IBV SKU |
|---|---|---|
| Example URL | `shopping.unfProduct&skuID=HK1410` | `shopping.unfProduct&skuID=HK1410IBV` |
| Label pattern | `… (BV)` | `… (IBV)*` |
| Volume line | `BV [n]` (points only) | `IBV [n] ([p]%)` |

Shared price labels: `UC HK$[amount] HKD` (often two figures), `SRP HK$[amount] HKD`.

**Observed:** on IBV SKUs, displayed percent ≈ IBV points ÷ lower UC price.

**Free shipping (product pages):** orders from Market Hong Kong of **HK$1000+** get free shipping.

**Purchase options** (`purchase-options-radio`):

- 單次購物 (default)
- 超連鎖事業自動購貨計劃 (auto monthly accumulation)

Qty `prdQty1`; control 加入購物車.  
Form `prodOrderForm` POST `#` (JS add-to-cart), hidden `prdCode`, `autoShipSelected`.

Also: GET `shopping.unfProduct` (`skuIDForm`); POST `shopping.unfMyList`.

### Cart

- **URL:** `shopping.unfViewCart` (title 購物車 | 超連鎖)
- Empty: 「你的購物車是空的」, 繼續購物 → `shopping.unfOrdering`
- Update/remove: `shopping.unfUpdateCart`

**With an IBV line item (then removed for safety):**

- Notice: **每月合格日期間，美安香港 / Shopping Annuity 品牌所產生之 IBV 上限為 500.00**
- Line shows `IBV [n]` (points only in cart)
- 訂單摘要: `業績點數總額` (BV total), `IBV總數`, `零售總額`, `超連鎖成本價`, product count, HKD
- On IBV-only SKU: **業績點數總額 = 0**, **IBV總數 = line IBV** → BV and IBV are **SKU-exclusive**, not stacked on one item

**Next steps (not opened):**


## FINDINGS.md Gaps
## Gaps

- Checkout **documented** ([CHECKOUT.md](./CHECKOUT.md)); **live** field names: `UNF_COOKIE_FILE=… npm run capture`  
- Personal-volume report viewed for BV only, not IBV  
- **XHR**: class + capture scripts ([NETWORK.md](./NETWORK.md)); live `xhr-log.json` via `npm run capture:xhr` (Playwright)  
- 925/1001 had no live form (already on file)  
- 手動BV/IBV放置 had no pending orders (assign fields not on screen)
