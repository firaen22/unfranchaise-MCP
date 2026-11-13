# PR2 Continuation Plan — Checkout Capture & Review Scope

Branch: `feat/checkout-network-capture`  
Status: Planning only (no code modifications)

---

## 1. Gaps to Close Before Merge

- **Dead Code & Duplication in `lib/tools.js`**: Deduplicate synthetic fixture loading in `unf_checkout_billship_map` (lines 264–279 and 291–304 duplicate synthetic HTML reading and baseline loading); remove dead URL branches in `scripts/capture-session.mjs` (`step.url.startsWith('https://')` / `step.action`).
- **Review Scope & Gate Parity**: `.review-gate/run-review-round.sh` must include all new PR2 files (`lib/parse-forms.js`, `lib/parse-checkout.js`, `lib/network-patterns.js`, `scripts/capture-session.mjs`, `scripts/capture-xhr-playwright.mjs`) in `FILES` and enforce security checks (no credential/cookie logging, strictly read-only GET requests, zero mutation risks).
- **Live-Capture Empty-Cart Redirect**: Unfranchise ColdFusion redirects `orders.unfBillShip` back to `shopping.unfViewCart` (or renders empty cart message with 0 form fields) if cart is empty. Capture script must detect empty cart / redirect status and fail fast with an actionable message.
- **Docs Accuracy vs. Synthetic Fixtures**: `CHECKOUT.md` and `NETWORK.md` must clearly distinguish between synthetic mock fields (`shipFirstName`, `pickUpOrder`) and live CF DOM observations; document the 3-tier fallback precedence (`live` via cookie -> `captured_fixture` via local JSON -> `synthetic_fixture`).
- **PII / Token Sanitization Boundary**: Live capture currently scrubs only session IDs (`CFID`, `CFTOKEN`, `JSESSIONID`), leaving distributor name/address/phone in raw HTML; enforce strict local-only isolation by keeping `fixtures/captured/` gitignored.

---

## 2. Concrete File-Level Changes (7 Paths)

1. `lib/tools.js` — Deduplicate fallback logic in `unf_checkout_billship_map` into a single helper (`useFixture` -> live GET -> captured JSON -> synthetic HTML fallback).
2. `scripts/capture-session.mjs` — Add check/warning for empty-cart redirects, clean up redundant URL/action branch checks, ensure proper exit codes.
3. `.review-gate/run-review-round.sh` — Add PR2 files (`lib/parse-forms.js`, `lib/parse-checkout.js`, `lib/network-patterns.js`, `scripts/capture-*.mjs`) to `FILES` and update review brief scope/threat model.
4. `pure-smoke.mjs` — Add regression assertions covering captured vs synthetic fixture fallback paths in `unf_checkout_billship_map` and structure validation for `network-patterns`.
5. `CHECKOUT.md` — Document resolution hierarchy (`live` -> `captured` -> `synthetic`), note empty-cart redirect constraint, and differentiate synthetic vs live field maps.
6. `NETWORK.md` — Detail capture prerequisites (active session + non-empty cart) and clarify that captured artifacts remain gitignored.
7. `.gitignore` — Verify `fixtures/captured/` remains ignored to prevent accidental leaks of captured personal or session data.

---

## 3. Fixture Commitment Decision (`fixtures/captured/bill_ship.json`)

**Decision: Stay gitignored.**

- **PII Leakage Risk**: Real Unfranchise HK checkout pages contain distributor names, delivery addresses, telephone numbers, and delivery instructions. Regex token redaction (`CFID|CFTOKEN|JSESSIONID`) does not sanitize personal identity data.
- **Flakiness & Churn**: Live responses depend on individual account states (different saved addresses, HK district options, pickup preferences), introducing unnecessary git diff churn and non-deterministic baselines.
- **Separation of Concerns**: `fixtures/checkout-billship.synthetic.html` and `fixtures/checkout-billship.parsed.json` already provide deterministic, committed test fixtures for offline development and CI. `fixtures/captured/` is strictly for local operator inspection and offline debugging.

---

## 4. Pre-Commit Gates: Test & Review Scope

### `npm test` (`pure-smoke.mjs`)
- **Offline isolation**: Enforces network ban via mocked `globalThis.fetch` throwing on calls.
- **Parser validation**: Verifies `parseCheckoutPage` extracts `stepHints`, pickup fields (`pickUpOrder`), and form actions from `checkout-billship.synthetic.html`.
- **Tool contract**: Asserts `unf_checkout_billship_map` returns valid JSON with `synthetic_fixture` source when `useFixture: true`, and verifies `unf_network_patterns` structure.

### Reviewer Gate (`sol-r*` / `grok-r*` in `.review-gate/run-review-round.sh`)
- **`FILES` list must include**:
  - `package.json`
  - `server.js`
  - `cli.js`
  - `pure-smoke.mjs`
  - `lib/urls.js`
  - `lib/volume.js`
  - `lib/client.js`
  - `lib/tools.js`
  - `lib/confirm.js`
  - `lib/validate.js`
  - `lib/parse-forms.js`
  - `lib/parse-checkout.js`
  - `lib/network-patterns.js`
  - `scripts/capture-session.mjs`
  - `scripts/capture-xhr-playwright.mjs`
- **Security & correctness threats to verify**:
  - Zero credential/cookie leakage in logs, console output, or fixtures.
  - Zero accidental mutations: capture scripts must use strictly read-only GET (`unfFetch`/`getAction`) and NEVER invoke cart/checkout mutation actions or submit forms.
  - Path traversal prevention when loading fixture files.
  - Strict local-only handling of captured HTML/JSON (`fixtures/captured/` excluded from git).

---

## 5. Grokbot Live-Capture Checklist

1. **Cookie Configuration**:
   - Obtain session cookie from browser DevTools after logging into `hk.unfranchise.com`.
   - Set cookie via environment:
     ```bash
     export UNF_COOKIE='CFID=...; CFTOKEN=...; JSESSIONID=...'
     # OR
     echo 'CFID=...; CFTOKEN=...; JSESSIONID=...' > ~/.secrets/unfranchaise.cookie
     export UNF_COOKIE_FILE=~/.secrets/unfranchaise.cookie
     ```
   - Validate session: `node cli.js unf_session_status` (must report `configured: true`, `authenticated: true`).

2. **Cart Non-Empty Precondition**:
   - Inspect cart status: `node cli.js unf_cart_summary` (verify items present or `ibvTotal` / `bvTotal` > 0).
   - If cart is empty, add at least 1 item in browser or via ordering flow (empty cart causes ColdFusion `orders.unfBillShip` to redirect back to cart).

3. **Capture Execution & Validation**:
   - Run document capture:
     ```bash
     npm run capture
     ```
   - Verify artifacts in `fixtures/captured/`:
     ```bash
     ls -la fixtures/captured/ # bill_ship.html, bill_ship.json, network-log.json
     ```
   - Test MCP tool with captured fixture:
     ```bash
     node cli.js unf_checkout_billship_map
     ```
   - *(Optional)* Capture browser XHR trace:
     ```bash
     npm run capture:xhr
     ```
