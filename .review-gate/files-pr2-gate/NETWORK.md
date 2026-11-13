# Network capture — hk.unfranchise.com

## Status

| Item | State |
|------|--------|
| Document navigation (`index.cfm?action=`) | **Confirmed** in [FINDINGS.md](./FINDINGS.md) |
| Checkout bill-ship field map | **Parser + synthetic fixture**; **live names** after successful `npm run capture` |
| Document GET log | `fixtures/captured/network-log.json` from `npm run capture` (gitignored) |
| Async XHR / fetch | **Class documented** below; **per-request log** in `fixtures/captured/xhr-log.json` via `npm run capture:xhr` |

## Primary transport

Almost all owner workflows are **full-page GET/POST** to:

```text
https://hk.unfranchise.com/index.cfm?action=<area>.<page>&<optional params>
```

Checkout entry (from cart):

- `GET orders.unfBillShip` — 帳單 / 送貨 (bill & ship)
- `GET express.unfExpressPay` — express pay shortcut

Cart mutation:

- `GET/POST shopping.unfUpdateCart`

## data-action / AJAX class

Elsewhere on the site, controls expose `data-action="<area>.<page>"`. In a logged-in browser, jQuery-style handlers typically request the **same** `index.cfm?action=…` URL and swap HTML fragments. The original browse could not record DevTools XHR; use:

```bash
export UNF_COOKIE_FILE=~/.secrets/unfranchaise.cookie
npm run capture
```

Outputs under `fixtures/captured/` (gitignored): token- and text-input-redacted HTML, parsed field JSON, `network-log.json`. XHR capture is separate (`xhr-log.json`).

## Inferred checkout POST targets (verify on capture)

| action | Confidence | Notes |
|--------|------------|-------|
| `orders.unfBillShip` | medium | Multi-step postback on same action |
| `orders.unfBillShipUpdate` | low | Common MA naming |
| `orders.unfOrderReview` | low | Review step |
| `orders.unfPayment` | low | Payment step |

## HK policy context (non-API)

Pickup orders: HK manual requires selecting pickup in the **Shipping Address** section ([Ch. 15](https://hkg-eng.documents.unfranchise.com/chapter-15-product-ordering-procedures-and-policies/)). Parser looks for pickup / 取貨 / pick-up copy and `pickUp*` field names.

## Programmatic access

- MCP: `unf_network_patterns`, `unf_checkout_billship_map`
- CLI: `node cli.js unf_network_patterns`
