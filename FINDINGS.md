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

- 前往結帳 → `orders.unfBillShip`
- 快捷付款 → `express.unfExpressPay`

### Related order URLs

| Label | action |
|---|---|
| 再次訂購 | `orders.productReorder` |
| 訂單記錄 | `orders.unfInquirySummary` |
| 超連鎖事業自動購貨 | `autoship.unfAutoShip` |
| 購物年金自動購貨 | `autoship.saAutoShip` |
| 定期購貨優惠 | `orders.unfManageUniversalAuto` |

### BV / IBV placement & elections (do not submit)

#### BV/IBV放置 — `forms.unfBVIBVPlacement`

Path: 我的帳戶 → BV/IBV管理 → BV/IBV放置  
Page: BV及IBV指定的放置位置

**Designated placement** (changeable **once per calendar quarter**):

- May place volume on a personally sponsored qualified owner’s original BDCs (002 and 003, if qualified)
- That owner must: Unfranchise autoship status N, T, or W; practice monthly accumulation (UFMS in previous qualification month); as payer, place required personal volume on own 001:
  - 超連鎖店主 **50 BV**
  - 助理級 **100 BV**
  - 經理級或以上 **150 BV**
- Fields: 當前指定的放置位置ID; * 新指定的放置位置ID; button 主要指定的放置位置
- POST `forms.unfBVIBVPlacementUpdate` (form `designatedPlacement`)
- Second slot needs 卓越超連鎖™店主資格
- Invalid settings → points auto-place to **your BDC 001**

**Auto placement** (changeable anytime):

- Must choose **two** BDC slots each for BV and IBV for customer-direct company orders
- Unspecified orders **alternate** between the two BDCs in receipt order
- Checkbox `notifyFlag`: 選擇48小時手動放置
- Fields *: `bvPlaceID1`/`bvPlaceExt1`, `bvPlaceID2`/`bvPlaceExt2`, `ibvPlaceID1`/`ibvPlaceExt1`, `ibvPlaceID2`/`ibvPlaceExt2`
- POST `forms.unfBVIBVAutoPlacementUpdate` (form `bvPlacement`)

#### 手動BV/IBV放置 — `forms.unfManualIBV`

Idle: 「目前沒有未完成的訂單。」 (* implies form appears when unplaced orders exist)

#### IBDC指定 — `forms.unfIBVDesignation`

獎勵商業發展中心 (IBDC): designated IBDC opens left and right so **團體 IBV** can accumulate. **No changes after designation.**  
POST `forms.unfIBVDesignationU` (form `ibvDesignation`)

#### 現金回贈／IBV獎勵設定 — `profile.unfIBVCBSelect`

Changeable **once per calendar quarter**:

1. 現金回贈及IBV — split cashback + IBV  
2. 享有更高IBV — all partner-store rewards as IBV  

Form `ibvCashbackSelectForm` action `#`

### Reports (labels only)

Criteria: `reports.unfReportCriteria&reportName=…`  
Generate: POST/GET `reports.unfGetReport` with `distID`, `extension` (分中心 e.g. 001), `reportName`, etc.

| Report | reportName / action | Notes |
|---|---|---|
| SAMM 轉消費為收入 | `reports.sammQualificationUNF` | Quarterly: ≥**225 IBV** + **2000 BV** exclusive brands (payer ID) + 居家購物清單 in this or prior 3 quarters → one following quarter free shipping. Months are strict calendar months. Totals may be estimates |
| 合格報告 | `distQualification` | Monthly accumulation BV/IBV, autoship status, placement eligibility, Form 1000/925/1001 received dates, L/R averages, etc. |
| 個人點數報告 | `personalVolume` | Filter `volumeType` = BV \| IBV. Columns include 訂單編號, 訂單日期, 種類, 個人, BV/IBV 點數, 總計 |
| 待處理IBV報告 | `pendingIBV` | Unreleased org IBV + release date; filters 點數庫, 邊 |
| 每週責任完成 | `reports.unfWkAcctReq` | GBV (L)/(R), weekly BV; POST `reports.unfWkAcctRpt` |

---

## 2. Form 1000 (表格 1000) — quarterly

**Found.** Path: 我的帳戶 → 網上表格 → 1000表格  
**URL:** `https://hk.unfranchise.com/index.cfm?action=forms.unf1000`  
**Heading:** 合格商業發展中心表格1000

### Purpose

Submit Form 1000 so all personal BDCs first-qualify, and personal **BDC-001 re-qualifies every quarter**. Other BDCs on the same Unfranchise ID need the form **only once**. Non-local receipts converted to local currency. Notice can list BDCs still missing the one-time filing.

### Qualification rule (on-page instructions)

To qualify a BDC, assign at least **two (2) orders** whose **產品總額 ≥ HK$1500.00 HKD**, excluding shipping/handling, tax, and extra fees.

### Five steps (`#s-form__instructions-desktop`)

1. **檢視訂單** — pick 可供查看的季度; only preferred-customer orders credited that quarter  
2. **選擇一個 BDC** — first-time or quarterly re-qual (`availableBDC` / `#bdc`)  
3. **分派訂單** — check 分派 for ≥2 orders meeting HK$1,500 rule  
4. **Submit** — 指派所選 / 分派選定; deadline **last day of quarter, 11:59 pm US Eastern**  
5. **Terms** — check 我同意, then 我同意 - 提交申請 / 接受條款  

Notes:

- Totals exclude shipping/handling/tax/fees  
- If owner is also preferred customer, personal-consumption orders count at most **HK$450**  
- Each BDC needs its own terms agreement  
- **After submit, assigned orders cannot be changed or reused**  
- **Leaving before finish does not save assignments**

### Terms highlights (條款及細則)

- ≥2 retail sales to **non-Unfranchise owners** totaling **HK$1,500** (ex-shipping/tax) to sponsor / become 助理級 / accumulate points / earn commissions  
- Failure **clears PBV and PIBV** and **resets GBV and GIBV to 0**  
- Mentions purchasing **200 BV** for resale/display/samples/personal use  
- Personal use ≤ **30%** of that quarterly HK$1,500+ retail total  
- **70%** of product from company/upline must be retailed to end consumers  
- Suggest filing in first **45 days**  
- Mail deadline Friday **1:59 p.m. ET**; online Friday **11:59 p.m. ET** to count that week  

Vocabulary: **PBV / PIBV** (個人業績點數 / 個人獎勵業績點數), **GBV / GIBV** (團體業績點數 / 團體獎勵業績點數)

### Visible UI (not submitted)

| Element | Detail |
|---|---|
| Status table | 超連鎖店主編號, 姓名, 合格日, 狀態, 可供查看的季度 |
| `quarterDate` | select; `data-action=forms.unf1000`; options `DD/MM/YYYY-DD/MM/YYYY` |
| Summary | 訂單數量, 未放置的訂單, 產品總額, 符合資格的總額, 放置全部 |
| Order list | 訂單日期, 參考編號, 顧客姓名, 符合資格的總額, 指派的日期; checkbox `orderIDAssigning` |
| Agree form | POST `forms.unf1000Update`, name `frm1000Agree`, button `iAgreeSubmit` 接受條款 |
| Assign form | POST `forms.unf1000Assign`, name `frm1000`, `isAgree`, `orderIDAssigning`, 放置全部, 指派所選 |

Desktop + mobile duplicates exist. **None submitted.**

### Similar form — 925/1001合併表格

URL: `forms.unf9251001`  
When already on file: 「謝謝，無需重新提交，您的925/1001已存檔。」

續約選項: `profile.unfAnnualRenewal` (not a quarterly 1000 substitute).

---

## API / form URL patterns

No cookies, tokens, or credential headers. Network XHR panel was not available; patterns from forms / `data-action` / browser bar:

| Method | action | Notes |
|---|---|---|
| GET | `shopping.unfOrdering` | Catalog |
| GET | `shopping.unfSearch` | `keyword` |
| GET | `shopping.unfProduct&skuID=` | Also `prodID=` on some links |
| POST | `shopping.unfOrdering` | `shipCountry` |
| POST | `#` (`prodOrderForm`, `qoe`) | Add/quick-order via page JS |
| GET | `shopping.unfViewCart` | Cart |
| GET/POST | `shopping.unfUpdateCart` | Qty / remove |
| — | `orders.unfBillShip` | Checkout start (not opened) |
| — | `express.unfExpressPay` | Express pay (not opened) |
| GET | `forms.unf1000` | `quarterDate` reload |
| POST | `forms.unf1000Update` | Terms agree |
| POST | `forms.unf1000Assign` | `orderIDAssigning`, `availableBDC`, `isAgree`, `quarterDate` |
| POST | `forms.unfBVIBVPlacementUpdate` | Designated placement |
| POST | `forms.unfBVIBVAutoPlacementUpdate` | `notifyFlag`, `bvPlace*`, `ibvPlace*` |
| POST | `forms.unfIBVDesignationU` | IBDC |
| GET | `reports.unfReportCriteria&reportName=` | Criteria |
| GET/POST | `reports.unfGetReport` | `distID`, `extension`, `reportName`, `volumeType` (BV\|IBV), `volumeLocation`, `leftRightBoth`, `rows` |
| POST | `reports.sammQualificationUNF` | `rptType`, `reportDate`, `distIDRpt`, `viewReport` |

---

## IBV / BV calculation rules (summary)

1. **BV** and **IBV** are alternate product SKUs (`code` vs `code`+`IBV`, labels `(BV)` vs `(IBV)*`), not added on one line. Cart: IBV SKU → IBV總數; 業績點數總額 (BV) stays 0.  
2. Product page: BV = points only; IBV = points + % of UC price.  
3. Monthly cap: **500 IBV** from Market Hong Kong / Shopping Annuity brands per qualification period.  
4. Personal monthly accumulation for placement eligibility: **50 / 100 / 150 BV** by rank, plus UFMS + autoship N/T/W.  
5. SAMM quarterly: **225 IBV** (MA/SA/partner) + **2000 BV** exclusive brands (payer ID) + annual HSL.  
6. Form 1000 is **retail-receipt qualification** (2 orders, HK$1,500 product total), not a BV calculator; failure clears **PBV/PIBV** and resets **GBV/GIBV**.  
7. Auto-placement alternates two BDCs; invalid → BDC 001. Group IBV after IBDC designation.  
8. Partner-store reward split (cashback+IBV vs all IBV) is a quarterly election.  
9. Report/cart contribution totals may be estimates until commissions settle.

---

## Gaps

- Checkout (`orders.unfBillShip` / `express.unfExpressPay`) not mapped  
- Personal-volume report viewed for BV only, not IBV  
- No DevTools XHR capture  
- 925/1001 had no live form (already on file)  
- 手動BV/IBV放置 had no pending orders (assign fields not on screen)
