# Checkout — bill & ship (`orders.unfBillShip`)

## Entry

| Step | Method | `action` | From |
|------|--------|----------|------|
| Cart | GET | `shopping.unfViewCart` | Main menu / catalog |
| Checkout | GET | `orders.unfBillShip` | Cart **前往結帳** |
| Express pay | GET | `express.unfExpressPay` | Cart express link |

See [NETWORK.md](./NETWORK.md) for transport notes and capture commands.

## Data source precedence (`unf_checkout_billship_map`)

1. **live** — GET `orders.unfBillShip` when `UNF_COOKIE` / `UNF_COOKIE_FILE` is set  
2. **captured_fixture** — `fixtures/captured/bill_ship.json` (local only, gitignored)  
3. **synthetic_fixture** — `fixtures/checkout-billship.synthetic.html` + `.parsed.json` (CI / offline)

Capture requires a **non-empty cart**; otherwise ColdFusion returns cart/empty state and `npm run capture` exits before writing `bill_ship.json`.

## Field map — synthetic baseline (not a live capture)

Illustrative names from `fixtures/checkout-billship.synthetic.html`. Replace the table only after a capture whose `stepHints` omit `login_required` and `empty_cart`. HK pickup policy: select pickup in **Shipping Address** (manual Ch. 15).

| Field / control | Type | Role |
|-----------------|------|------|
| `pickUpOrder` | checkbox | Self pick-up (自行提取) |
| `billSameAsShip` | checkbox | Bill same as ship |
| `shipFirstName`, `shipLastName` | text | Recipient |
| `shipAddress1`, `shipAddress2` | text | Address |
| `shipCity` | text | City |
| `shipRegion` | select | HK regions (香港 / 九龍 / …) |
| `shipPostalCode` | text | Postal (if applicable) |
| `shipPhone` | tel | Phone |
| `shipCountry` | select | Ship country (cart may pre-select from catalog) |
| `payMethod` | select | Card on file / new card / account credit |
| `orderStep` | hidden | Step discriminator (typical CF pattern) |
| `continueCheckout` | submit | Continue |

Parser output shape (MCP `unf_checkout_billship_map`):

```json
{
  "stepHints": ["shipping", "pickup", "payment"],
  "forms": [{ "name": "...", "dataAction": "orders.unfBillShip", "fields": [...] }],
  "dataActions": [{ "action": "shopping.unfViewCart", "text": "返回購物車" }]
}
```

## MCP / CLI

```bash
node cli.js unf_checkout_billship_map '{}'
node cli.js unf_network_patterns '{}'
export UNF_COOKIE_FILE=~/.secrets/unfranchaise.cookie
npm run capture          # HTML + network-log.json
npm run capture:xhr      # Playwright XHR log (optional)
```
