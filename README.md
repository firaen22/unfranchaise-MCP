# Unfranchise HK (hk.unfranchise.com) — scrape findings for MCP / CLI

Repo: https://github.com/firaen22/unfranchaise-MCP (private).

Private research notes from a signed-in session on Market America / Market Hong Kong **超連鎖** (Unfranchise) Hong Kong.

**Goal:** give Cursor enough site structure to build a local MCP server or CLI that:

1. Places (or stages) product orders and calculates **IBV / BV**
2. Fills **Form 1000** (表格 1000) each quarter

**Out of scope for this repo so far:** live checkout, payment, form submit, and any personal account values.

**Privacy:** no cookies, tokens, passwords, names, addresses, emails, phones, order numbers, or real volume/cash balances. Official rule thresholds are kept; account-specific figures use `[amount]` / `[n]`.

## Target site

- Base: `https://hk.unfranchise.com`
- Auth: session cookie after login at `index.cfm?action=main.unfLogin` → home `main.unfHome`
- Stack: ColdFusion-style `index.cfm?action=<area>.<page>` routes (not a public REST API)

## Suggested build (for Cursor)

- **Private** MCP + thin CLI
- Auth: reuse browser session cookie jar / vault login (never commit secrets)
- Tools (draft):
  - `search_products` / `get_product`
  - `cart_view` / `cart_add` / `cart_update`
  - `volume_explain` (IBV vs BV SKU rules + caps)
  - `report_personal_volume` / `report_qualification` / `report_samm`
  - `form1000_status` / `form1000_draft` (stop before final submit unless user confirms)
- Always dry-run by default; require explicit confirm for checkout and Form 1000 submit
- Do not auto-submit Form 1000 or place orders unless the user explicitly asks; planning and calculation only until then

See [FINDINGS.md](./FINDINGS.md) for URLs, fields, and calculation rules.

## Status

- [x] Signed-in site map (order + IBV/BV + Form 1000)
- [ ] Checkout / bill-ship field map
- [ ] Network XHR capture (browser tool could not intercept)
- [ ] MCP / CLI implementation
