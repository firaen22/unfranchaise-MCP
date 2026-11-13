# Fable final pre-commit review

Repository: `/Users/yauch/Documents/unfranchaise` (Unfranchise HK MCP, Node ESM stdio).

**Run first:** `npm test` in repo root (must exit 0).

**Review scope (read files on disk):**
`server.js`, `cli.js`, `pure-smoke.mjs`, `package.json`, `lib/*.js`, `scripts/capture-session.mjs`, `scripts/capture-xhr-playwright.mjs`, `CHECKOUT.md`, `NETWORK.md`, `fixtures/checkout-billship.synthetic.html`, `fixtures/checkout-billship.parsed.json`, `.githooks/pre-commit`, `.review-gate/dispatch-medium.sh`, `README.md`.

**Threat focus:** cookie leakage, redirect/SSRF, `confirm !== true` mutations, bad numeric/boolean input, error redaction.

**Output contract:**
1. First line exactly: `PROCEED` or `FIX`
2. Verdict + Findings (Critical → Low) + tests you ran
3. PROCEED only if zero Critical/High on the live MCP path

Do not modify source unless you find Critical and fix is ≤10 lines (then re-run `npm test`).
