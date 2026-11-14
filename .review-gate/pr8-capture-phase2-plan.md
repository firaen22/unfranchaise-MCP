# PR #8 — Phase 2 capture hardening plan (post dual-7)

**HEAD at plan time:** `05912f9`  
**Oracle:** `npm test` → exit 0 (all four runners)  
**Scope:** `lib/redact.js`, `test-bugfix-safety-money.mjs` only  
**Out of bounds:** merge, cookies/PII in repo, unrelated refactors  

## Problem statement

`assertCaptureJsonSafe` uses `persistedCapture` instead of `JSON.stringify` so deep nests do not stack-overflow. Adversarial `toJSON` hooks that replace builtins or `Array.prototype` during serialization must not let secrets pass the gate while native `JSON.stringify` would persist them.

Dual review round 7 (`ba6e35e`) — still **FIX**:

| ID | Source | Issue | Status on `05912f9` |
|----|--------|-------|---------------------|
| G1 | Grok | Multiple reads of `v.rawJSON` | **Fixed** — single `rawText` snapshot |
| S1 | Sol | Live `Object.setPrototypeOf` during walk | **Likely fixed** — `INTRINSICS.objectSetPrototypeOf` + `reflectInvoke(..., null, [arr, null])` |
| S2 | Sol | Gate `strings` list poisoned via `Array.prototype[1]` accessors when collecting scan results | **Partial** — gate `strings` null-proto; scanner `out`/`hits` still ordinary arrays |

Earlier rounds (still in scope if regressions fail): intrinsics for exec/push/Reflect.apply, manual percent-decode (no `RegExp[Symbol.replace]` in decode), frozen regex templates, indexed gate loops (no `.some` / `for..of` on captured lists).

## Acceptance

1. `npm test` exit 0.
2. `assertCaptureJsonSafe` rejects (throws) on reproduced Sol/Grok payloads:
   - `{ text: 'CFID=SECRET' }` with sustained `Object.setPrototypeOf = () => null` **outside** `toJSON` (walk must still use snapshotted setter).
   - `{ text: 'CFID=SECRET' }` with sustained `Array.prototype[1]` / `[2]` accessor poison during full `assertCaptureJsonSafe` (gate list must not lose slots).
   - `JSON.rawJSON` with getter: first read secret, later read benign (must still throw email/session).
   - Existing 5k nest, parity fixtures, prior intrinsic-poison tests still pass.
3. No live `Object.setPrototypeOf` in capture path (only `INTRINSICS.objectSetPrototypeOf`).

## Implementation steps (Luna)

### Step A — `captureList()` helper

Add after `reflectInvoke`:

```javascript
function captureList() {
  const list = [];
  reflectInvoke(INTRINSICS.objectSetPrototypeOf, null, [list, null]);
  return list;
}
```

Use for: `chunks`, `strings`, `stack`, `pending`, `out` (assignment scan), `hits` (matchAll capture), and `assertCaptureJsonSafe` gate `strings` (replace `[]` + separate setPrototypeOf).

### Step B — RawJSON regression

In `test-bugfix-safety-money.mjs` (skip if no `JSON.rawJSON`):

- Object with `rawJSON` getter: first call returns `'"user\\u0040example.com"'`, second returns `'"safe"'`.
- Pass through `assertCaptureJsonSafe` via `toJSON` returning that wrapper; expect `/email-like/`.

### Step C — Sol S1/S2 regressions (sustained poison **outside** `toJSON`)

Pattern: poison → `expectThrows(assertCaptureJsonSafe, ...)` → restore in `finally`.

- `Object.setPrototypeOf = () => null` + `{ text: 'CFID=SECRET' }` → `/session token/`.
- Define `Array.prototype[1]` (and optionally `[2]`) with no-op setter + getter returning `"safe"` + `{ text: 'CFID=SECRET' }` → `/session token/`.

Restore descriptors in `finally`; do not rely on `toJSON` finally (Sol F4 lesson).

### Step D — Audit

- Grep: no bare `Object.setPrototypeOf(`, no `strings.slice`, no spread on gate string lists.
- Confirm `reflectInvoke(fn, null, args)` for `Object.setPrototypeOf`, `globalRegExp`, `decodeURIComponent`, etc.

### Step E — Verify

Run `npm test`; report exit code.

## Risks / non-goals

- **Non-goal:** Proof against every possible prototype attack on the entire JS VM; goal is closing **reproduced** dual-review holes and keeping parity oracles green.
- **Risk:** `captureList()` on every small list adds negligible overhead; acceptable.

## After Luna

- Operator may re-run Sol + Grok dual sign-off on new HEAD (not part of Luna task unless green tests fail).