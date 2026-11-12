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
- [x] MCP / CLI v0 (`npm test`, 10 tools; review **r3**: sol PROCEED + grok PROCEED, medium effort)
- [ ] Checkout / bill-ship field map
- [ ] Network XHR capture (browser tool could not intercept)

## MCP setup

```bash
cd /Users/yauch/Documents/unfranchaise
npm install
npm test
```

**Session cookie (never commit):** after logging in at hk.unfranchise.com, set either:

- `export UNF_COOKIE='CFID=…; CFTOKEN=…; …'`, or
- `export UNF_COOKIE_FILE=~/.secrets/unfranchaise.cookie`

**Cursor / Claude MCP** (`mcp.json`):

```json
{
  "mcpServers": {
    "unfranchaise-hk": {
      "command": "node",
      "args": ["/Users/yauch/Documents/unfranchaise/server.js"]
    }
  }
}
```

**CLI:** `node cli.js unf_volume_explain` or `node cli.js unf_search_products '{"keyword":"omega"}'`

**Model effort:** all `dispatch.py` / codex / grok / agy runs in this repo use **medium** only (see `.review-gate/dispatch-medium.sh`).

**Review gate (sol 6.1 + grok):** `.review-gate/run-review-round.sh r1`

**Planners (5 subs):** `.review-gate/run-planners.sh` · **Luna cowork:** `.review-gate/run-luna-cowork.sh r1`

**Pre-commit (optional, local only — does not change your global git config):**

```bash
git config core.hooksPath .githooks   # you run this once if you want hooks
UNF_SKIP_REVIEW=1 git commit …        # skip slow sol/grok dispatch
UNF_SKIP_FABLE=1 git commit …         # skip Fable final gate (emergency only)
```

Default hook runs `npm test` then dispatches **gpt-6.1-sol** and **grok-4.7** on MCP sources unless `UNF_SKIP_REVIEW=1`.
