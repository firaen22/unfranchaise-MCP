# Luna 5.6 — Unfranchise MCP hardening

You are in an isolated cowork copy. Read FINDINGS.md (parent repo) via 00-BRIEF if present.

**Tasks (surgical):**
1. Fix `lib/client.js` `parseSearchResults` if cheerio `$` reference is wrong (must use root `$`).
2. Harden `unf_cart_add`: dry-run must not fetch network; only `confirm:true` may call unfFetch.
3. Add `unf_report_url` tool (pure) for reportName → criteria URL.
4. Run `node pure-smoke.mjs` — must exit 0.

Edit only files under this cowork dir. Do not add dependencies unless necessary.
