# unfranchaise-MCP

https://github.com/firaen22/unfranchaise-MCP

**stdio MCP + CLI** for [Market Hong Kong 超連鎖](https://hk.unfranchise.com): catalog, cart (dry-run by default), IBV/BV rules, Form 1000 status, and report URLs.

Built from signed-in site research in [FINDINGS.md](./FINDINGS.md). No checkout, payment, or Form 1000 submit unless you explicitly pass `confirm: true` on mutating tools.

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

## Tools (v0)

| Tool | Network | Notes |
|------|---------|--------|
| `unf_session_status` | — | Cookie configured? |
| `unf_volume_explain` | — | Markdown rules from FINDINGS |
| `unf_volume_calculate` | — | form1000 / SAMM / IBV% / SKU variant |
| `unf_url_build` | — | Build `index.cfm?action=` URLs |
| `unf_report_url` | — | Report criteria URL |
| `unf_search_products` | GET | Requires cookie |
| `unf_get_product` | GET | Parse BV/IBV/UC |
| `unf_cart_view` | GET | Cart totals |
| `unf_cart_add` | POST if `confirm: true` | Default dry-run |
| `unf_form1000_status` | GET | Quarter list + summary |

## Safety defaults

- Live **cart add** only when `confirm === true` (JSON boolean, not `"true"`).
- Cookie validated for CR/LF; errors redacted; redirects limited to `https://hk.unfranchise.com`.
- FINDINGS and this repo contain **no** real account data.

## Site model

- Base: `https://hk.unfranchise.com`
- Auth: session cookie after `main.unfLogin`
- Routes: `index.cfm?action=<area>.<page>` (ColdFusion, not a public REST API)

## Roadmap

- [x] FINDINGS: orders, IBV/BV, Form 1000
- [x] MCP / CLI v0 (`npm test`, 10 tools)
- [ ] Checkout / bill-ship field map
- [ ] Network XHR capture
- [ ] Reports placement, `form1000_draft`, cart update

## Maintainer scripts

Optional review gates (medium effort only — see `.review-gate/dispatch-medium.sh`):

| Script | Purpose |
|--------|---------|
| `run-fable-precommit.sh` | Fable final pre-commit |
| `run-review-round.sh` | sol 6.1 + grok |
| `run-planners.sh` | Five-lens planning packet |

Local git hook (opt-in): `git config core.hooksPath .githooks` · skip with `UNF_SKIP_FABLE=1` / `UNF_SKIP_REVIEW=1`.
