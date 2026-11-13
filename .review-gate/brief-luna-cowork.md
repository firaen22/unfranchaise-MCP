# Luna 5.6 — PR3 follow-on (roadmap v0.2 tools)

You are in an isolated cowork copy with the same files as branch `cursor/live-billship-map-10c5`.

**Context:** Live bill-ship baseline is in `fixtures/checkout-billship.live.redacted.json` — do not weaken `unf_checkout_billship_map` or `billship-fixtures.js` live detection.

**Tasks (surgical, ≤3 files beyond tools/pure-smoke if needed):**

1. **`unf_cart_update`** — MCP tool: default `dryRun: true`, describes `shopping.unfUpdateCart` params (`skuID`, `qty`, remove line); only GET/POST when `confirm === true` (same boolean discipline as `unf_cart_add`). No checkout/payment.
2. **`unf_form1000_draft`** — read-only markdown checklist for Form 1000 submit fields (`forms.unf1000Update`, `forms.unf1000Assign`) from FINDINGS — **no network**, no submit.
3. **`unf_placement_forms_status`** (optional if time): GET `forms.unfBVIBVPlacement` or document URL-only if no cookie — prefer dry URL builder if form needs pending orders.

4. Update `pure-smoke.mjs` for new tools (offline, no cookie).
5. `node pure-smoke.mjs` must exit 0.

Do not add dependencies. Match existing `lib/tools.js` patterns and `redactToolPayload`.
