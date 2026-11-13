PROCEED

# Fable final pre-commit review — unfranchaise-MCP

Reviewer: Claude Fable 5.1 (Cursor agent). Date: 2026-11-13. Tree: `main`, uncommitted diff of 7 files (`lib/tools.js`, `lib/urls.js`, `pure-smoke.mjs`, `package.json`, `README.md`, `.review-gate/brief-luna-cowork.md`, `.review-gate/run-luna-cowork.sh`). Single-lens (Claude family); this is not a cross-family gate.

## Verdict

**PROCEED.** Zero Critical, zero High on the live MCP path. One pre-existing **Medium** (error messages are percent-encoded on the way out; no leak, user-visible, not pinned by a test) and a handful of Low/Info items. The diff being committed (`unf_placement_forms_url` + `placementFormsUrls`) is network-free, enum-validated, and does not expose the `*Update` mutation action. The five threat-focus areas held under 90 adversarial probes plus a real stdio MCP round-trip.

Oracle: `npm test` → exit 0 (`pure-smoke: ok 17 tools`, `form1000-optimise: ok`) `[verified: ran in repo root]`.

## Threat-focus summary (all `[verified: /tmp/unf-probe/probe.mjs`, 90 probes, mocked `globalThis.fetch`, real repo modules])

| Area | Result |
|---|---|
| Cookie leakage | Cookie header is sent only to `https://hk.unfranchise.com:443`; never appears in any tool output, dry-run preview, error text, `unf_session_status` (`{configured, length}` only), or `redactToolPayload`-ed live bill-ship map (phone, PC option value/label, hidden `orderDirective`, form `action` CFID, `data-action` CFTOKEN all absent). CJK and CR/LF cookie values are rejected without echo. |
| Redirect / SSRF | 9 hostile `Location` variants (`https://evil.com/`, `//evil.com/x`, `http://` downgrade, `:8443`, `hk.unfranchise.com.evil.com`, `hk.unfranchise.com@evil.com`, trailing-dot host, `ftp://`, `file://`) each refused after exactly 1 fetch; no outbound request left the host. Redirect loop stops at 8 hops ("Too many redirects."). POST→302 is followed as GET with body and `Content-Type` dropped. Token in a redirect `Location` is `[REDACTED]` in the returned `url`. |
| `confirm !== true` | `unf_cart_add` / `unf_cart_update` stay dry-run with 0 fetches for `confirm` ∈ {`"true"`, `1`, `"yes"`, `{}`, `[]`, `null`}; `confirm: true` performs GET prefetch + POST (`prdCode=X&prdQty1=3&autoShipSelected=0`). `unf_form1000_quarters record` with `filePath` writes nothing for missing/`"true"` confirm, writes for `true`. Same result via `node cli.js unf_cart_add '{"skuID":"X","confirm":"true"}'` (dry-run, exit 0) and via stdio `tools/call`. |
| Bad numeric/boolean | `qty` ∈ {0, −1, 1.5, NaN, `"2"`, 1000, ±Infinity, `true`, `""`, `[]`, `{}`} → `isError`; 999 accepted. `remove:"true"` rejected. `unf_volume_calculate` rejects string/NaN/negative/non-array/Infinity. Optimiser rejects 1e300, ≤0, NaN, qty 0/1.5, 25 pieces, `allowSplit` qty 9, `rows:"x"`; 24 pieces completes in 337 ms. `fixturePath` outside repo or containing `..` refused. `quarterDate` 31/02, reversed range, ISO, empty, non-zero-padded all rejected; no stray file written. `unf_url_build` with `args` = `null`/string/number/array → `isError`, never a crash. |
| Error redaction | Error containing `Cookie:`+value → generic "details redacted" message. Error containing `CFID=…`/`CFTOKEN=…` → `[REDACTED]`. HTTP 500 → `"search failed with HTTP 500"` (no URL). 2000-char error → truncated to 501. No stack traces in any output. |

## Findings (Critical → Low)

### Critical
None.

### High
None.

### Medium

**F1 — Generic error messages are percent-encoded on the live MCP path.** `[verified: probe + stdio]`
`publicErrorMessage()` (`lib/validate.js:70`) runs every non-coded error through `redactSessionTokensInUrl()`. For text with no `://`, `redact.js:117` wraps it in `new URL('https://hk.unfranchise.com/' + text)` and returns `u.pathname`, which URL-encodes it. Observed over real stdio: `{"text":"qty%20must%20be%20a%20positive%20integer%20between%201%20and%20999","isError":true}`; also `sheet%20row%201:%20...`, `Unknown%20mode:%20undefined`, and CJK → `%E4%B8%AD...`. Affects every validation error from every tool and the CLI (`node cli.js unf_url_build null` prints `Cannot%20read%20properties%20of%20null...`).
Not a leak (over-redaction), so not a blocker under the contract, but it is user-visible on the live path and no test asserts a readable generic error. Pre-existing: `lib/validate.js` and `lib/redact.js` are unchanged vs HEAD.
Suggested fix (1 line, tested in isolation against the current `pure-smoke` redaction cases — all still redact, all plain messages become readable):
```js
// lib/validate.js, replace line 70
raw = /:\/\/|[?&=]/.test(raw) ? redactSessionTokensInUrl(redactSessionTokensInText(raw)) : redactSessionTokensInText(raw);
```
Suggested regression test (fails RED on current code): `assert.equal(publicErrorMessage(new Error('qty must be 1')), 'qty must be 1');`
Not applied: brief permits source edits only for Critical.

### Low

**F2 — `.githooks/pre-commit` sol/grok heuristic is both fail-closed-noisy and leaky.** `[verified: bash probe]`
(a) `SOL_OUT=$(ls … | head -1)` under `set -euo pipefail` exits 1 before the `Missing reviewer output` diagnostic prints when no file exists (fail-closed, silent). (b) `grep -qiE 'Critical|High.*finding|…'` blocks a clean output containing "No Critical or High findings" and passes a `FIX` first-line verdict that only lists Medium items. The Fable gate itself is checked correctly (`run-fable-precommit.sh`: `head -1 | grep -qx 'PROCEED'`), so this verdict file is consumed properly; the weakness is only in the sol/grok branch. Not on the MCP path.

**F3 — `unf_form1000_quarters` `filePath` is not confined to the repo root** (unlike `fixturePath`). `[verified: probe E4–E7]`
`read` on an arbitrary JSON file echoes its first unsupported top-level key name (`quarter file has unsupported field "secretKeyName"`) and distinguishes not-found / not-JSON (existence oracle). `record` with `confirm:true` can create a new fixed-schema JSON file at any writable path (`mkdirSync recursive`); existing non-quarter files are refused unchanged. Values are never echoed; `.cookie`/`cookie` basenames refused. Local-only, confirm-gated.

**F4 — `unf_cart_update` schema/validation mismatch.** `inputSchema.qty.minimum: 0`, but `parsePositiveIntQty` rejects 0 unless `remove: true`. Fail-closed; confusing to clients that trust the schema.

**F5 — Misleading error for cookie-named data paths.** `assertSafeDataPath` throws "Refusing to use a cookie file as quarter file"; `publicErrorMessage`'s `/cookie/i` catch rewrites it to "Request failed: invalid session cookie or headers (details redacted)." Fail-closed, wrong diagnosis.

### Info

- `unf_url_build` has no input validation on `action`: missing → `Cannot read properties of undefined (reading 'split')`; `params:"str"` → `?0=s&1=t&2=r`. No leak; consider `requireNonEmptyString(args?.action, 'action')`.
- `unf_form1000_quarters record` without confirm returns `isError:true` (DryRunError through the generic catch) whereas cart tools return a non-error `dryRun:true` payload. Inconsistent surface; safe.
- `pure-smoke.mjs:316,354` use `hk.unfranchaise.com` (typo, extra "a") in three redaction test URLs. The regex path is still exercised; the host-specific `new URL` path is not for those three.
- `PlacementActions.designatedUpdate` (`forms.unfBVIBVPlacementUpdate`) is exported but deliberately not reachable from `placementFormsUrls` — correct; it is a mutation target.
- `redactToolPayload` treats any `action`-keyed string as a URL; all current values are bare action names or hyphenated labels and survive unchanged, but a future `action` value containing spaces would be percent-encoded (same mechanism as F1).
- `.gitignore` confirms `fixtures/captured/` is ignored (`git check-ignore` matched all three capture files), so NETWORK.md's gitignore claim is accurate. `README.md` "17 tools" matches the runtime count.

## Diff-specific review (what this commit adds)

- `lib/urls.js` `placementFormsUrls(target)`: allow-list `['designated','auto','ibdc']`, throws on anything else (echoes the user-supplied target — fine), builds via `actionUrl` so the host is fixed. No network. `[verified: read + pure-smoke `target:'auto'` + probe]`
- `lib/tools.js` `unf_placement_forms_url`: returns `{urls}` or `{target,url}`; routed through `textResult` → redaction. `[verified: read]`
- `pure-smoke.mjs`: adds a fetch-trap around the placement call so a regression to a network call would fail. `[verified: read]`
- `package.json` description change only. `README.md` adds tool row + roadmap tick.

## Tests run

1. `npm test` in repo root — exit 0. `[verified]`
2. `/tmp/unf-probe/probe.mjs` — 90 probes against the real `lib/` modules with mocked fetch; 89 PASS, 1 "FAIL" which was the harness regex not matching the percent-encoded message (i.e. it surfaced F1, not a defect in the repo's guard). `[verified: output above]`
3. CLI: `unf_cart_add` with `confirm:"true"` → dry-run exit 0; bad JSON → exit 2; unknown tool → exit 1; `null` args → exit 1, encoded message (F1). `[verified]`
4. Real stdio MCP: `initialize` → `tools/call unf_cart_update {qty:"2", confirm:true}` → `isError:true`, no network, no cookie in response, encoded message (F1). `[verified]`
5. Hook shell behaviour (`set -e` + `ls`, grep heuristic) reproduced in `/tmp`. `[verified]`
6. Suggested F1 fix evaluated in isolation against six inputs including the three `pure-smoke` redaction shapes — all redactions preserved, plain messages readable. `[verified]` Not applied to the tree.

No repo files were modified by this review other than this verdict. Probe artefacts live under `/tmp/unf-probe/` only.
