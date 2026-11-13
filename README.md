# unfranchaise-MCP

stdio **MCP server** and **CLI** for [Market Hong Kong 超連鎖](https://hk.unfranchise.com) — **17 tools**, cookie session auth, dry-run by default.

| Area | What you get |
|------|----------------|
| Catalog & cart | Search, product BV/IBV, cart view/add/update (`confirm: true` to POST) |
| Volume & Form 1000 | Rules explain/calculate, quarter file, status, local **two-receipt optimiser** (≥ HKD 1,500 product each; no assign/submit) |
| Checkout research | Bill/ship field map ([CHECKOUT.md](./CHECKOUT.md)), XHR patterns + capture scripts ([NETWORK.md](./NETWORK.md)) |
| Reports & placement | Report criteria URLs, placement form URLs (read-only; no submit) |

Behavior and action names come from signed-in site research in [FINDINGS.md](./FINDINGS.md). This repo has **no** real account data. Checkout, payment, cart mutations, and Form 1000 assign/submit are blocked unless you explicitly opt in (`confirm: true` on the tools that support it).

## Quick start

```bash
npm install
npm test
```

After logging in in a browser, point the tools at your session (never commit this):

```bash
export UNF_COOKIE_FILE=~/.secrets/unfranchaise.cookie
# or: export UNF_COOKIE='CFID=…; CFTOKEN=…'
```

**MCP** (Cursor / Claude `mcp.json`):

```json
{
  "mcpServers": {
    "unfranchaise-hk": {
      "command": "node",
      "args": ["<repo>/server.js"]
    }
  }
}
```

**CLI:** `node cli.js unf_volume_explain` · `node cli.js unf_search_products '{"keyword":"omega"}'`

**Form 1000 receipts (dry-run, no submit):**

```bash
npm run form1000:optimise -- fixtures/form1000-sheet.example.csv
node cli.js form1000-optimise fixtures/form1000-sheet.example.csv
node cli.js form1000-quarters read
```

See [FORM1000.md](./FORM1000.md). Two receipts of at least HKD 1,500 product total each. Shipping, tax, and fees are not counted.

**Placement URLs (no network):** `node cli.js unf_placement_forms_url '{"target":"auto"}'`

## Documentation

| Doc | Contents |
|-----|----------|
| [FINDINGS.md](./FINDINGS.md) | Site actions, forms, volume rules (source of truth) |
| [FORM1000.md](./FORM1000.md) | Receipt optimiser inputs, quarters, deadlines |
| [CHECKOUT.md](./CHECKOUT.md) | Bill/ship field map (redacted live baseline) |
| [NETWORK.md](./NETWORK.md) | Navigation/XHR notes, `npm run capture` / `capture:xhr` |

## Tools (17)

| Tool | Network | Notes |
|------|---------|--------|
| `unf_session_status` | — | Cookie configured? |
| `unf_volume_explain` | — | Markdown rules from FINDINGS |
| `unf_volume_calculate` | — | form1000 / SAMM / IBV% / SKU variant |
| `unf_url_build` | — | Build `index.cfm?action=` URLs |
| `unf_report_url` | — | Report criteria URL |
| `unf_placement_forms_url` | — | Placement form URLs from FINDINGS (designated, auto, IBDC); no network |
| `unf_search_products` | GET | Requires cookie |
| `unf_get_product` | GET | Parse BV/IBV/UC |
| `unf_cart_view` | GET | Cart totals |
| `unf_cart_add` | POST if `confirm: true` | Default dry-run |
| `unf_cart_update` | POST if `confirm: true` | Qty or remove line; default dry-run |
| `unf_form1000_draft` | — | Markdown checklist (no network) |
| `unf_form1000_optimise` | — | Two local receipts ≥ HKD 1,500 product each. No assign, submit, or place-order |
| `unf_form1000_quarters` | — | Read/record quarter windows and the US Eastern deadline. Example fixture has no personal balances |
| `unf_form1000_status` | GET | Quarter list + summary |
| `unf_checkout_billship_map` | GET* | Bill/ship map. Offline baseline is the 13 Nov 2026 redacted browser capture, not the synthetic fixture. Login-wall and empty-cart HTML are not the map |
| `unf_network_patterns` | — | Navigation / XHR pattern doc + capture paths |

## Safety defaults

- Live **cart add** only when `confirm === true` (JSON boolean, not `"true"`).
- The Form 1000 receipt optimiser has no confirm path. It never assigns, submits, or places an order. `confirm` on that tool is ignored.
- Cookie validated for CR/LF; errors redacted; redirects limited to `https://hk.unfranchise.com`.
- FINDINGS and this repo contain **no** real account data.

## Site model

- Base: `https://hk.unfranchise.com`
- Auth: session cookie after `main.unfLogin`
- Routes: `index.cfm?action=<area>.<page>` (ColdFusion, not a public REST API)

## Roadmap

- [x] FINDINGS: orders, IBV/BV, Form 1000
- [x] MCP / CLI v0 (`npm test`, 17 tools)
- [x] Checkout / bill-ship field map ([CHECKOUT.md](./CHECKOUT.md); live names are the 13 Nov 2026 redacted browser map; synthetic HTML is parser-test only)
- [x] Network XHR capture ([NETWORK.md](./NETWORK.md); document log + optional Playwright `capture:xhr`)
- [x] `form1000_draft`, cart update (dry-run tools)
- [x] Form 1000 dry-run receipt optimiser (two receipts ≥ HKD 1,500) and quarter-window file
- [x] Reports placement — URL helpers only (`unf_placement_forms_url`; no submit)

**Not in v0 (see [FINDINGS.md § Gaps](./FINDINGS.md)):** payment/submit/checkout POST helpers, live placement assign, committed XHR log artifact.

## Maintainer scripts

Optional review gates (medium effort only — see `.review-gate/dispatch-medium.sh`):

| Script | Purpose |
|--------|---------|
| `run-fable-precommit.sh` | Fable final pre-commit |
| `run-review-round.sh` | sol 6.1 + grok |
| `run-planners.sh` | Five-lens planning packet |

Local git hook (opt-in): `git config core.hooksPath .githooks` · skip with `UNF_SKIP_FABLE=1` / `UNF_SKIP_REVIEW=1`.
