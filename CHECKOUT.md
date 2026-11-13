# Checkout — bill & ship (`orders.unfBillShip`)

## Entry

| Step | Method | `action` | From |
|------|--------|----------|------|
| Cart | GET | `shopping.unfViewCart` | Main menu / catalog |
| Checkout | GET | `orders.unfBillShip` | Cart **前往結帳** |
| Express pay | GET | `express.unfExpressPay` | Cart express link |

See [NETWORK.md](./NETWORK.md) for transport notes and capture commands.

## Field map (synthetic baseline)

Live field names should match after `npm run capture` with a valid cookie. HK pickup policy: select pickup in **Shipping Address** (manual Ch. 15).

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
