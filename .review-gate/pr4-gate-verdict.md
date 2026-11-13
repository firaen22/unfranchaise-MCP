# PR4 gate (2026-11-13)

**PR:** #4 Form 1000 two-receipt optimiser

| Round | Sol 6.1 | Grok |
|-------|---------|------|
| pr4-gate | approve with nits | approve with nits |
| **pr4-gate2** (post-fix) | **PROCEED** — zero High/Critical | **PROCEED** |

**Nit fixes in gate2:** capture HTTP 2xx only, URL hash PII, CSV unclosed quotes, error URL redaction, 307/308 POST→GET, quarters `record` needs `confirm`, `assertCaptureJsonSafe`, product `title` no longer wiped.

**Tests:** `npm test` → 16 tools + form1000-optimise ok

Re-run: `UNF_SKIP_FABLE=1 bash .review-gate/run-review-round.sh pr4-gate2`
