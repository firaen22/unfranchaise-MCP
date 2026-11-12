PROCEED

# Fable pre-commit review — unfranchaise-mcp 0.1.0

Reviewer: Claude Fable 5.1 (single-lens; same family as any Claude author — not a cross-family gate).
Date: 2026-11-12. Tree: working tree at review time (`git status --short`: all MCP sources untracked/new; no secrets found by scan).

## Verdict

**PROCEED.** Zero Critical, zero High on the live MCP path. Threat-focus areas (cookie leakage, redirect/SSRF, `confirm !== true`, numeric/boolean input, error redaction) all held under an adversarial harness that ran the real `callTool` with a mocked `fetch` (61 checks) plus a live stdio MCP round-trip and CLI runs. Two Medium and several Low findings below — none blocks commit; the Medium ones are cheap to fix in a follow-up.

## Tests run (all `[verified: executed, output observed]`)

1. `npm test` → exit 0, `pure-smoke: ok 10 tools`.
2. Adversarial harness `/tmp/unf-adv/adv.mjs` (outside repo; real `lib/tools.js` + `lib/client.js`, mocked `globalThis.fetch` recording url/method/Cookie/body). 57/61 PASS. The 4 "FAIL" lines were deliberate probes of hypothetical gaps, discussed in Findings M1/M2 — none is a security hole on the real path.
3. Live stdio: spawned `server.js` via `@modelcontextprotocol/sdk` client (no cookie env): `listTools` → 10 tools; `unf_session_status` → `configured:false`; `unf_cart_add {confirm:"true"}` → `dryRun:true`; `unf_cart_view` → `isError:true, "No session cookie…"`; `unf_cart_add {qty:"3"}` → `isError:true, "qty must be a positive integer…"`.
4. CLI: `node cli.js unf_volume_calculate '{"mode":"form1000","productTotalsHkd":[800,800]}'` → `meetsRule:true`, exit 0; `node cli.js unf_cart_add '{"skuID":"X","qty":0}'` → error text, exit 1.
5. Secret scan: `rg -i 'CFID=|CFTOKEN=|UNF_COOKIE=…'` over repo (excl. node_modules) → only the README placeholder. `FINDINGS.md` referenced by README exists on disk.

### Harness results by threat area

| Area | Checks | Result |
|---|---|---|
| Redirect → external host (`evil.example`), lookalike host (`hk.unfranchise.com.evil.example`), `http://` downgrade, `ftp:`, port 8443 | 6 | all refused with `UNF_BAD_URL`; Cookie header never sent off-host; only 1 fetch made before refusal |
| Redirect loop | 1 | bounded at 8 hops → "Too many redirects." |
| Redirect without Location | 1 | clean `UNF_HTTP` error |
| `confirm` ∈ {`"true"`, `1`, `"yes"`, `{}`, `[]`, `null`, `undefined`, `0`} | 8 | all dry-run, **zero** fetches |
| `confirm:true` | 4 | GET prefetch → POST `prdCode=HK1&prdQty1=2&autoShipSelected=0` → 302 → GET without body; Cookie only to `hk.unfranchise.com`; response contains no cookie |
| `qty` ∈ {0, -1, 1.5, `"2"`, 1000, NaN, Infinity} reject; {999, 1, undefined, null} accept | 11 | as expected |
| `skuID` empty / missing / 513 chars / URL-shaped | 4 | rejected / rejected / rejected / stays a query param on hk host |
| `unf_volume_calculate` — string numbers, negatives, non-array, empty array, string boolean, `/0`, unknown/missing mode, missing sku | 12 | all strict rejects or safe values; no crash |
| `unf_url_build` — missing/numeric action, `__proto__` param, object param, external-looking param | 5 | always hk host; `isError` on bad action (see L1) |
| Unknown tool, `null` args, blank keyword | 3 | `isError`, no crash |
| Error redaction — undici "invalid header value" containing cookie | 1 | redacted |
| HTTP 500 with cookie-bearing body | 1 | error carries status only, no body |
| Cookie validation — CRLF, 20 000 chars, empty/unset | 3 | rejected / rejected / clean "No session cookie", no fetch |
| `unf_session_status` | 2 | leaks only `length` |

## Findings

### Critical — none
### High — none

### Medium

**M1 — Session identifiers in echoed URLs are not scrubbed** (`lib/tools.js` every network tool returns `url`; `parseSearchResults` returns raw `href`). ColdFusion `cflocation`/`addtoken` can append `CFID`/`CFTOKEN` to redirect targets and links. If the site does this, the session credential lands in the MCP client's context/transcript. `[verified: harness — redirect Location with `CFTOKEN=…` was echoed verbatim in `url`; search `href` with `CFTOKEN=…` echoed verbatim]`. Whether the real site emits tokens in URLs is `[unverified]` (no live session in review). Impact is bounded: recipient is the operator's own agent and host is trusted. Fix (~6 lines): a `scrubUrl(u)` in `validate.js` that deletes `CFID`, `CFTOKEN`, `jsessionid`, `JSESSIONID` search params, applied to `url`, `postUrl`, and `href` before `textResult`.

**M2 — Generic error redaction is substring-based** (`validate.js publicErrorMessage`). Only `/invalid header value|cookie/i` triggers redaction; any other error whose message happens to embed the cookie string would pass through (`[verified: harness — synthetic `Error("fetch failed <cookie>")` echoed]`). No real code path today constructs such a message (Node's `fetch failed` does not include request headers; all `UNF_*` messages are fixed strings), so this is defence-in-depth, not a live leak. Fix: replace occurrences of the loaded cookie value in `raw` with `[redacted]` before returning.

### Low

**L1 — `unf_url_build` with missing/non-string `action` surfaces a raw TypeError** ("Cannot read properties of undefined (reading 'split')"). Harmless but unpolished; `requireNonEmptyString(args?.action, 'action')` would match sibling tools.

**L2 — `lib/confirm.js` (`requireConfirm`, `DryRunError`) is dead on the MCP path**; `unf_cart_add` duplicates the gate inline (`args?.confirm !== true`). Both are correct; two sources of truth invite drift. Either use `requireConfirm` in `tools.js` or delete the module (it is still exercised by `pure-smoke.mjs`).

**L3 — No fetch timeout** in `unfFetch`. A stalled upstream hangs the tool call indefinitely. `AbortSignal.timeout(30_000)` in `init` is a one-liner.

**L4 — `urls.js actionUrl` splits inline params on the first `=` only**, so `action: 'x&k=a=b'` yields `k=a`. Cosmetic; `unf_url_build` is no-network.

**L5 — `.githooks/pre-commit` sol/grok heuristic** `grep -qiE 'Critical|High.*finding|…'` blocks on text like "No Critical findings". Fails closed, so safe, but expect false blocks; `UNF_SKIP_REVIEW=1` documented. The Fable gate itself (`run-fable-precommit.sh`) checks `head -1 == PROCEED`, which this file satisfies. Note the fallback `cp verdict-stream.txt verdict.md` will almost never start with `PROCEED` (stream output has preamble), so a missing `verdict.md` correctly fails closed.

**L6 — `run-fable-precommit.sh` exits 1 when `cursor-agent` is absent**, blocking every commit on machines without Cursor CLI unless `UNF_SKIP_FABLE=1`. Intentional fail-closed; just noting it is undocumented in README (README documents `UNF_SKIP_REVIEW` only).

**L7 — Hook tests the working tree, not the staged index.** Standard caveat; a partially staged commit can pass `npm test` on unstaged code.

**L8 — `server.js` uses the low-level `Server` class, which does not validate `arguments` against `inputSchema`.** All validation therefore lives in `tools.js` — which it does, strictly (verified above). Keep that invariant when adding tools.

## Scope notes

- Files read on disk: `server.js`, `cli.js`, `pure-smoke.mjs`, `package.json`, `lib/{client,confirm,tools,urls,validate,volume}.js`, `.githooks/pre-commit`, `.review-gate/dispatch-medium.sh`, `.review-gate/run-fable-precommit.sh`, `README.md`, `.gitignore`.
- No source files were modified (no Critical found). Harness lives in `/tmp/unf-adv/`, not in the repo.
- Not verified: behaviour against the live `hk.unfranchise.com` (no session cookie available to the reviewer); the real site's form field names for cart add (`prdCode`/`prdQty1`/`autoShipSelected`) are taken from the code and `[unverified]`.
