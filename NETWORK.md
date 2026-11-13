# Network capture — hk.unfranchise.com

No cookies, tokens, personal values, or geographic location data. Checkout field names are the 13 Nov 2026 signed-in browser map in [CHECKOUT.md](./CHECKOUT.md).

## Confirmed live (13 Nov 2026)

Non-empty cart. Form POST targets were observed. **繼續結帳** and **提交你的訂單** were not clicked.

| Action | How it showed up |
|--------|------------------|
| `orders.unfBillShip` | GET page and POST form `billShip` |
| `orders.unfBillShipAJAX` | `data-action` on `#pcSelect`, and page JS. HTTP method not separately recorded |
| `orders.unfBillShipBags` | Bill-ship page JS. HTTP method not separately recorded |
| `express.unfExpressPay` | GET. No pickup controls |
| `express.unfProcessExpressOrder` | POST form `finalPreview`. Not submitted |
| `shopping.unfViewCart` | GET |
| `shopping.unfUpdateCart` | After 移除 |
| `shopping.unfOrdering` | GET |
| `services.unfExpressPaySettings` | Header 快捷付款 **settings**, not checkout |

`services.unfManageCreditCardsFrame&callback=ccCallback` is the manage-cards link (添加/管理信用卡/扣帳卡). The frame was not opened.

## Not observed — unverified

Not live form targets in that session. Do not treat them as confirmed.

| Action | State |
|--------|--------|
| `orders.unfBillShipUpdate` | unverified — not observed |
| `orders.unfOrderReview` | unverified — not observed |
| `orders.unfPayment` | unverified — not observed |

## Primary transport

Almost all owner workflows are full-page GET/POST to:

```text
https://hk.unfranchise.com/index.cfm?action=<area>.<page>&<optional params>
```

`data-action` controls request that same `index.cfm?action=` URL. Bill-ship page JS references `orders.unfBillShipAJAX` and `orders.unfBillShipBags`.

## Capture caveats

- **Empty cart.** Bill-ship and express-pay URLs still return a page, show 你的購物車是空的, and hide the checkout forms. Do not build the live map from an empty cart. `npm run capture` does not write those checkout JSON files when the cart is empty.
- **Cloudflare login wall.** `npm run capture` and live `unf_checkout_billship_map` can return **HTTP 200** HTML for `main.unfLogin&permissionViolation` even when `UNF_COOKIE` / `UNF_COOKIE_FILE` is set. `cf_clearance` / `__cf_bm` is often bound to the browser TLS fingerprint. Never overwrite fixtures from that HTML. The signed-in browser is the reliable live path. This repo does not implement a Cloudflare bypass.
- **Local logs.** `fixtures/captured/` is gitignored (`network-log.json`, `xhr-log.json`, `bill_ship.json`). A blocked capture must not replace the committed redacted map.

```bash
export UNF_COOKIE_FILE=~/.secrets/unfranchaise.cookie
npm run capture
npm run capture:xhr
```

`capture:xhr` aborts non-GET requests and does not submit bill-ship or express pay. It can still stop on the login wall for the same Cloudflare reason.

## HK pickup copy

On the live bill-ship page the pickup copy is **親自提貨 / 提貨**. The synthetic fixture’s 自行提取 / 取貨 wording is not the live UI. Express pay has no pickup controls.

## Programmatic access

- MCP: `unf_network_patterns`, `unf_checkout_billship_map`
- CLI: `node cli.js unf_network_patterns`

## Optional artifact

`fixtures/captured/` is gitignored. After a successful signed-in session (non-empty cart, no login wall), you may save a redacted XHR summary as `fixtures/captured/xhr-log.json` for offline reference. The repo does not ship one — empty or Cloudflare-blocked captures must not be committed.
