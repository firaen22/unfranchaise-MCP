# Checkout — bill & ship and express pay

Signed-in browser capture on **13 Nov 2026** with a **non-empty cart**. No personal or location values. **繼續結帳** and **提交你的訂單** were not clicked. This repo does not place orders.

Machine baseline:

- `fixtures/checkout-billship.live.redacted.json` (+ `.html`)
- `fixtures/checkout-express-pay.live.redacted.json` (+ `.html`)

`fixtures/checkout-billship.synthetic.html` is a **parser unit-test fixture**. Its field names are **not live**. None of them matched this capture.

## Data source precedence (`unf_checkout_billship_map`)

1. **network** — GET `orders.unfBillShip` only when a cookie is set **and** the HTML is a real checkout form (not a login wall, not an empty cart, and it has fields).
2. **captured_fixture** — `fixtures/captured/bill_ship.json` (gitignored) only when that file passes the same checks and does not contain the synthetic names below.
3. **live_redacted_fixture** — the committed 13 Nov browser map. This is the offline baseline for live field names, including when the network response is blocked.
4. **synthetic_fixture** — parser tests only. The tool does not return it.

The offline payload also includes `expressPayFixture` from the same capture. That object is not a second live fetch.

## Capture caveats

- **Empty cart.** `orders.unfBillShip` and `express.unfExpressPay` still load, show 你的購物車是空的, and hide the checkout forms. Do not build the live map from an empty cart.
- **Node vs browser.** `npm run capture` and a live `unf_checkout_billship_map` GET can return **HTTP 200** login-wall HTML at `main.unfLogin&permissionViolation` even with a session cookie. Cloudflare (`cf_clearance` / `__cf_bm`) is often bound to the browser TLS fingerprint. Never overwrite fixtures from that HTML. The signed-in browser is the reliable live path.
- **Not submitted.** There is no place-order automation.

## Bill-ship (`orders.unfBillShip`)

| | |
|---|---|
| Title | 送貨與付款資訊 \| 超連鎖 |
| Form | `name` / `id` `billShip` |
| Method | POST `index.cfm?action=orders.unfBillShip` |
| Page JS | `orders.unfBillShipAJAX`, `orders.unfBillShipBags` |
| Submit | label 繼續結帳, `id` `btnSubmit`, **no field name**, not clicked |

Pickup UI copy is **親自提貨 / 提貨**. **自行提取 / 取貨** is the old synthetic copy, not this page.

### Visible controls

| Name | Type | Detail |
|------|------|--------|
| `shipType` | radio | `1` id `shipTypeDefault` (saved address; Chinese label not recorded); `3` id `shipTypeFreeEntry` 輸入送貨地址; `2` id `shipTypePC` 選擇優惠顧客 |
| `pcid` | select | id `pcSelect`, required, `data-action` `orders.unfBillShipAJAX`. Options are account-specific and omitted |
| `filingID` | (type not recorded) | |
| `getFileID` | button | 獲取超連鎖店主編號 |
| `contactPhone` | (type not recorded) | required |
| `shipEmail` | (type not recorded) | required |
| `packSlip` | radio | `1` 裝貨單不顯示價格; `0` 裝貨單或裝箱單顯示超連鎖成本價 |
| `pickUp` | checkbox | value `1` |
| `pickUpLoc` | select | Options are account-specific and omitted |
| `billtype` | radio | value `1`. Label was not recorded |

### Hidden names only

Values are omitted except `orderDirective`, observed as `SO` on this capture.

`mustProvideShip`, `isShipVerified`, `specialCartProcess`, `displayFlyout`, `kiala`, `usedKiala`, `taxID`, `apprenticeID`, `mtaID`, `prodSel`, `gc`, `addrHash`, `ecEmail`.

Other hidden names matching `kiala*` were present. Only `kiala` and `usedKiala` were listed, so no further names are invented.

Shipping: `shpfirstName`, `shplastName`, `shpAddr1`–`shpAddr7`, `shpCity`, `shpState`, `shpPCode` (id `postal`), `shpArea`, `shpDistrict`, `shpCountry`, `email`, `phone`.

Billing: `firstName`, `lastName`, `maddr1`–`maddr7`, `mcity`, `mstate`, `mPCode`, `marea`, `mdistrict`, `mCountry`.

## Express pay (`express.unfExpressPay`)

| | |
|---|---|
| Title | 超連鎖事業帳戶 \| 超連鎖 |
| Steps | 快捷付款 / 送貨與付款資訊 / BV/IBV放置 / 提交你的訂單 |
| Pickup | none on this page |
| Form | `name` / `id` `finalPreview` |
| Method | POST `index.cfm?action=express.unfProcessExpressOrder` (not submitted) |
| Submit | label 提交你的訂單, `data-action` `express.unfProcessExpressOrder`, not clicked |

Header **快捷付款** settings is `services.unfExpressPaySettings` (settings, not checkout).

**添加/管理信用卡/扣帳卡** links to `services.unfManageCreditCardsFrame&callback=ccCallback`. The frame was not opened.

### Fields (names only; values omitted)

`vendorCode`, `vendorCnt`, `isDebit`, `validateBVIBV`, `checkExistingbvIBV`, `backupPayMethReq`, `ibvOverage` (control types not recorded).

Hidden: `contactPhone`, `shipEmail`, `billingFirstName`, `billingLastName`, `billingAddress1`, `billingAddress2`, `billingCity`, `billingPostalCode`.

Honeypots: `empty1`, `empty2`.

`shippingSelection1` radios observed on this test (may change): `44` 任何時段; `45` 指定時段. Shipping prices are not fixtures.

Also present: `deliveryDate` (select; options not enumerated), `deliveryTime`, `deliveryTime1`–`deliveryTime6`, `specShipInstruction1` (types not recorded except `deliveryDate`).

`paymentType` value `cc`, label 以信用卡/金融卡付款. The control type was not recorded. `ccNum` is a saved-card select; option text is omitted. `cvv` is required and was not filled.

`bv*` / `ibv*` / `sabv*` placement fields and `gc*` fields were present. Exact names were not listed, so they are omitted. 3DS/CCA token fields may exist; names were not enumerated. Record names only on a later capture, never values.

## Synthetic names that are not live

`pickUpOrder`, `billSameAsShip`, `shipFirstName`, `shipLastName`, `shipAddress1`, `shipAddress2`, `shipCity`, `shipRegion`, `shipPostalCode`, `shipPhone`, `shipCountry`, `payMethod`, `orderStep`, `continueCheckout`.

## Not observed (unverified)

Not live form targets in this session. Do not treat them as confirmed: `orders.unfBillShipUpdate`, `orders.unfOrderReview`, `orders.unfPayment`. See [NETWORK.md](./NETWORK.md).

## MCP / CLI

```bash
node cli.js unf_checkout_billship_map '{"useFixture":true}'
node cli.js unf_network_patterns '{}'
```
