# Fix plan — fox-fix-gate (Sol HOLD / Grok approve)

**Goal:** Close Sol **High** on read-only redirects; address Sol **Medium** capture gaps and agreed Grok lows. `npm test` must exit 0.

## P0 — Read-only redirect allowlist (Sol High / Grok Low)

Replace `READ_BLOCKED_REDIRECT_ACTIONS` denylist with **`assertSafeReadRedirect`** allowlist:

- Normalize `action` query to lowercase before compare.
- **Allow** only GET-safe actions used by read-only tools: `shopping.unfOrdering`, `shopping.unfSearch`, `shopping.unfProduct`, `shopping.unfViewCart`, `orders.unfBillShip`, `express.unfExpressPay`, `forms.unf1000`, `reports.unfReportCriteria`, `reports.sammQualificationUNF`, `main.unfLogin` (if ever returned), and static asset paths with no `action` param.
- **Reject** everything else on read-only redirect follow (includes `shopping.unfUpdateCart`, `orders.unfBillShipAJAX`, `orders.unfBillShipBags`, `moe.unfMOEPCSelectU`, all Form 1000 assign/update, express process, payment, placement updates).

Add `pure-smoke.mjs` probes: 302 to `shopping.unfUpdateCart` throws; uppercase `FORMS.UNF1000ASSIGN` still blocked.

## P1 — Capture redaction (Sol Medium)

- Add `shpPhone` (and `shipPhone` if missing) to `PII_QUERY_PARAM`.
- `assertCaptureJsonSafe`: loop all `(CFID|CFTOKEN|JSESSIONID|cf_clearance|__cf_bm)=` matches; reject if value ≠ `[REDACTED]`.
- `scripts/capture-session.mjs`: run `assertCaptureJsonSafe` on `network-log.json` payload before write (mirror xhr script).

## P2 — Quarter / path hardening (Grok Low)

- `recordQuarter` / `assertSafeFixturePath`: require `filePath` basename ends with `.json` and not equal to sensitive repo files (`package.json`, `server.js`, etc.).
- For dangling symlink: `fs.lstatSync` each component; if symlink, `realpath` must stay in repo.

## P3 — Tests (Sol Low)

- Fix `assertDisjoint` in `test-form1000-optimise.mjs` to assert no SKU/qty double-count across receipts.

## Out of scope

- Live capture, new MCP mutation tools, payment POST helpers.
