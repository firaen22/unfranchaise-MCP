# PR2 continuation — checkout capture + review scope

Repo: unfranchaise-MCP on branch `feat/checkout-network-capture`.

Already shipped: CHECKOUT.md, NETWORK.md, parse-forms/checkout, `unf_checkout_billship_map`, `unf_network_patterns`, `npm run capture`, optional Playwright XHR.

**Your job (planning only):** Write `PLAN.md` in your outdir with:

1. Gaps to close before merge (max 5 bullets): dead code, review scope, live-capture workflow, docs accuracy vs synthetic fixture
2. Concrete file-level changes (paths) — no more than 8 files touched
3. Whether `fixtures/captured/bill_ship.json` should be committed redacted vs stay gitignored
4. Pre-commit gates: what `npm test` + sol/grok must see in FILE list
5. Grokbot live-capture checklist (cookie, cart non-empty, commands)

Do NOT write code. One markdown file `PLAN.md` only.
