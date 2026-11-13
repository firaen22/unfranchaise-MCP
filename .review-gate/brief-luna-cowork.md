# Luna 5.6 — PR4 Form 1000 optimiser hardening

Branch: `cursor/form1000-receipt-optimiser-527f`. Cowork copy must stay dry-run only.

**Non-negotiable:** No Form 1000 assign/submit, no place-order, no network in optimiser/quarters tools. `confirm` on `unf_form1000_optimise` is ignored.

**Tasks:**

1. **`.review-gate/run-review-round.sh`** — Extend `FILES` to include: `test-form1000-optimise.mjs`, `FORM1000.md`, `lib/form1000-optimise.js`, `lib/form1000-sheet.js`, `lib/form1000-quarters.js`, `lib/form1000-cli.js`, `fixtures/form1000-sheet.example.csv`, `fixtures/form1000-quarters.example.json`.
2. **`lib/form1000-sheet.js` or `lib/tools.js`** — Reject path traversal for `fixturePath` (`..`, absolute paths outside repo root); clear errors.
3. **`lib/tools.js`** — Document/ensure `unf_form1000_optimise` never calls `unfFetch` regardless of `confirm`.
4. **`test-form1000-optimise.mjs` or `pure-smoke.mjs`** — One assertion that `confirm:true` on optimiser does not enable network (mock fetch if needed).
5. Run full **`npm test`** (pure-smoke + form1000 optimiser) — exit 0.

Surgical edits only. Do not weaken receipt pairing logic.
