# Luna 5.6 — fox-fix-gate implementation

Read `.review-gate/PLAN-fox-fix.md` in repo root (copied as `00-PLAN.md` if present).

Implement P0–P3 only. No new MCP tools. Match existing code style.

**P0** `lib/validate.js` + `lib/client.js`: read-only redirect **allowlist** (lowercase `action`), block `shopping.unfUpdateCart` and AJAX/mutation actions.

**P1** `lib/redact.js`, `scripts/capture-session.mjs`: `shpPhone` in PII list; scan all session token params in `assertCaptureJsonSafe`; `assertCaptureJsonSafe` on network-log write.

**P2** `lib/form1000-sheet.js` / `form1000-quarters.js`: quarter paths must end with `.json`; reject basenames `server.js`, `package.json`, `cli.js`; symlink `lstat` + `realpath` per path component.

**P3** `test-form1000-optimise.mjs`: make `assertDisjoint` verify quantities conserved.

**Tests:** `pure-smoke.mjs` — redirect block cases; `npm test` exit 0.

Do not change unrelated files.
