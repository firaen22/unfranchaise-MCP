PROCEED

# Fable final pre-commit review — unfranchaise-mcp @ working tree, 2026-11-13 20:40 HKT

Reviewer: Claude Fable 5.1 (Cursor agent). Single-lens, same family as prior Fable gates; cross-family (sol/grok) still required by `.githooks/pre-commit` for the load-bearing merge.

## Verdict

**PROCEED.** Zero Critical / High findings on the live MCP path (`server.js` → `lib/tools.js` → `lib/client.js` / `lib/validate.js` / `lib/redact.js`). All five threat-focus areas held under adversarial input executed against the real `callTool` / `unfFetch` with a mocked `fetch` (122 probes, 117 behaviourally correct; the 5 "FAIL" rows were a probe-script assertion bug, see Tests). One Low correctness bug on the live path (string `"undefined "` prefix in a hint), two Medium hygiene/gate-integrity findings outside the MCP path, and several Low notes. Nothing modified in source.

## Evidence summary (tagged)

- `npm test` → exit 0, `pure-smoke: ok 17 tools`, `form1000-optimise: ok` `[verified: ran twice, second run captured `$?`=0]`
- Cookie never leaves `hk.unfranchise.com`: every hop re-validated by `assertUnfUrl` (https only, exact hostname, no non-443 port, userinfo stripped); mocked redirects to `evil.example`, `//evil.example`, `http://` downgrade, `:8443`, `evil.hk.unfranchise.com`, `hk.unfranchise.com@evil.example`, `hk.unfranchise.com.` all refused with `UNF_BAD_URL` after exactly one fetch `[verified: probe C]`
- Redirect allowlists: GET hop onto `forms.unf1000Assign` / `shopping.unfUpdateCart` (any case) refused; POST 307/308 onto `orders.unfBillShip`, `express.unfProcessExpressOrder`, `shopping.unfUpdateCart` refused; POST 301/302/303 drops body + `Content-Type` and continues as GET; loop capped at 8 hops `[verified: probe C]`
- `confirm` gate: `"true"`, `"TRUE"`, `1`, `"yes"`, `{}`, `[]`, `null`, `undefined` all yield `dryRun:true` with no `fetch` and (for quarters `record`) no file write; only JSON `true` mutates `[verified: probe A, fetch stub throws on call, fs.existsSync checked]`
- Numeric/boolean: `qty` of `"2"`, `1.5`, `NaN`, `Infinity`, `0`, `1000`, `-1`, `"1e3"`, `true`, `[]`, `{}` all rejected; `999` accepted; `remove:"true"` rejected; `ibv:"300"`, `NaN`, `-1`, `hasHsl:"true"`, `productTotalsHkd:"x"/[NaN]/["100"]/[-1]` rejected; optimiser rejects `1e308`, negatives, `"abc"`, `qty 1.5`, `splitQty>qty`, `allowSplit` qty 9, 25 pieces; 24-piece MITM case returns both receipts ≥ 1500 in ~200 ms `[verified: probe B]`
- Error redaction: thrown `Error` containing `CFID=…`/raw cookie → `[REDACTED]`; `TypeError: fetch failed` with cookie in `.cause` → only `fetch failed` surfaces; HTTP 500 body containing cookie → `cart_view failed with HTTP 500`; final URL carrying `CFID`/`CFTOKEN` after a redirect → redacted in payload `url`; search-result `href` and anchor text with token → redacted; CR/LF cookie error message carries no cookie value `[verified: probe D]`
- Path safety (`form1000_quarters`, `form1000_optimise`): `/tmp/x.json`, `../x.json`, `*.cookie`, `*.txt`, `package.json`, example fixture overwrite, `/etc/passwd`, `/etc/hosts` all refused `[verified: probes A/B]`
- Secret sweep of tracked + untracked tree (excl. `node_modules`): no `CFID|CFTOKEN|cf_clearance|__cf_bm=<12+ chars>` other than test canaries in `pure-smoke.mjs`; no email literals outside `*.md` `[verified: rg --pcre2]`
- Capture scripts: `capture-session.mjs` writes structural JSON only, double `assertCaptureJsonSafe`, refuses login-wall / empty-cart / no-form; `capture-xhr-playwright.mjs` aborts all non-GET, non-host, non-allowlisted-action requests, logs `postData:null` `[verified: read]`

## Findings (Critical → Low)

### Critical
None.

### High
None.

### Medium

**M1 — Stale `verdict.md` can pass the Fable gate** (`.review-gate/run-fable-precommit.sh`, not MCP path)
The script never removes a previous `fable-precommit/verdict.md`. It only copies `verdict-stream.txt` into place when `verdict.md` is *absent*. If `cursor-agent` exits 0 but produces no file (observed state on disk at review start: `verdict.md` dated 18:02 with first line `PROCEED`, `verdict-stream.txt` dated 19:39 and **0 bytes**), the `head -1 | grep -qx PROCEED` check passes on the stale verdict. `[verified: ls -la + head -1]`
Fix (≤5 lines): `rm -f "$OUT/verdict.md" "$OUT/verdict-stream.txt"` before invoking `cursor-agent`, and fail if `verdict-stream.txt` is empty. Not applied — not Critical, and the brief restricts edits to Critical.

**M2 — Stray untracked `redact.js` and `validate.js` at repo root**
Both are older copies of the `lib/` versions: root `validate.js` lacks `assertSafePostRedirect` / the POST allowlist, root `redact.js` has the pre-`CAPTURE_TOKEN_VALUE` scanner. Nothing imports them (`rg` confirmed only root `validate.js` → root `redact.js`), so no live-path impact, but a `git add -A` would commit the weaker duplicates and invite a future wrong import. `[verified: diff + rg]`
Fix: delete both before commit.

### Low

**L1 — `hint` starts with `"undefined "` for `not_checkout_form` blocker** (`lib/tools.js` ~L255–262, L516) — live MCP path, cosmetic
`LIVE_BLOCKER_HINT` has keys `login_required`, `empty_cart`, `no_checkout_form`, but `checkoutMapBlocker` also returns `'not_checkout_form'` (parse-checkout.js L65). Probe: 200 HTML `<form><input name="keyword"></form>` with cookie set → `blocker:"not_checkout_form"`, `hint:"undefined Baseline field names…"`. `[verified: probe D.billship]` Fix: add a `not_checkout_form` entry (or alias to `no_checkout_form`). One line. Not applied per brief.

**L2 — No fetch timeout / response-size cap** (`lib/client.js` `unfFetch`)
`fetch(currentUrl, init)` has no `AbortSignal`; `res.text()` is unbounded. A stalled upstream hangs the MCP call indefinitely. Robustness only; no security impact given host pinning. `[verified: rg 'AbortSignal|signal:|timeout' → none]`

**L3 — Same-host redirect with no `action` param is allowed** (`lib/validate.js` `assertSafeRedirect` L80)
`302 → /some/other/path` on `hk.unfranchise.com` is followed with the cookie. Host is pinned so this is by design, but the allowlist only constrains `index.cfm?action=` targets; a non-`action` route cannot be a known mutating ColdFusion action, so impact is negligible. `[verified: probe C "same-host no action param"]` Note only.

**L4 — `unf_form1000_status.quarterDate` has no type/length validation** (`lib/tools.js` L481)
A 100 kB string produces a 100 kB GET URL; an object becomes `%5Bobject+Object%5D`. Read-only GET to the pinned host; worst case is an upstream 4xx. `[verified: probe D.form1000_status]` Suggest `requireNonEmptyString` when present.

**L5 — `.githooks/pre-commit` double-runs `npm test`** (hook L7 and `run-fable-precommit.sh` L12). Harmless, ~10 s wasted. Note only.

**L6 — Repo hook is not active**: `git config core.hooksPath` is the global `~/.config/git/hooks`, so `.githooks/pre-commit` runs only if the operator opts in (README documents this). Not a defect; stated so the "gate" is understood as opt-in. `[verified: git config core.hooksPath]`

## Docs / fixtures consistency (read-only check)

- `README.md` tool table (17 rows) matches `TOOL_DEFINITIONS.length === 17` and `package.json` description. `[verified: read + smoke output]`
- `CHECKOUT.md` / `NETWORK.md` precedence and caveat text matches `tools.js` `unf_checkout_billship_map` branch order (network → captured → live_redacted; synthetic never returned) and `billship-fixtures.js`. `[verified: read]`
- `fixtures/checkout-billship.synthetic.html` field names exactly equal `NOT_LIVE_SYNTHETIC_FIELD_NAMES` and `checkout-billship.parsed.json.fields`; both files carry a "NOT live" notice. `[verified: read]`
- `.review-gate/dispatch-medium.sh` enforces `--effort medium` only. `[verified: read]`

## Tests I ran

1. `cd /Users/yauch/Documents/unfranchaise && npm test` — exit 0 (`pure-smoke: ok 17 tools`, `form1000-optimise: ok`). Run twice; second run's `$?` captured as 0.
2. `/tmp/fable-probe.mjs` (122 probes against real `callTool` / `unfFetch`, `globalThis.fetch` mocked, cookie `CFID=COOKIE_SECRET_1; CFTOKEN=COOKIE_SECRET_2` as canary). Result: 116 PASS / 6 FAIL. Of the 6:
   - 5 (`B.optimise rows=[]`, `24 pieces infeasible`, `24 pieces feasible`, `B.quarters parse dst edge`, `valid Q4`) are probe-script bugs — I asserted `isError === false` but successful `callTool` results omit `isError` (`undefined`). Payloads printed in the log are correct dry-run results (`dryRun:true`, `submitted:false`, `network:false`; quarters `saved:false`). Behaviour is correct.
   - 1 real: `D.billship not_checkout_form hint defined` → finding L1.
   - Red-test sanity: the probe set includes known-bad inputs that must FAIL closed (e.g. evil-host redirects) and they were observed being refused, so the harness is not vacuously green.
3. `git status --short` — tree state as reported in the brief context; `fixtures/captured/` contains only a `quarters-test/` dir (gitignored).
4. `rg --pcre2` secret sweep over tracked + untracked (excluding `node_modules`, `.git`): only `pure-smoke.mjs` canaries.
5. `diff redact.js lib/redact.js`, `diff validate.js lib/validate.js`, `rg` for importers of root copies → finding M2.
6. Probe script was written to `/tmp` and nothing was added to the repo except this verdict file.

## Source modifications
None. (L1 is a one-line fix but is Low, not Critical; brief permits edits only for Critical.)

## Recommended before commit (operator's call)
1. Delete root `redact.js` and `validate.js` (M2).
2. Harden `run-fable-precommit.sh` against stale verdicts (M1).
3. Add `not_checkout_form` to `LIVE_BLOCKER_HINT` (L1).
4. Run the sol/grok cross-family round — this verdict is single-lens.
