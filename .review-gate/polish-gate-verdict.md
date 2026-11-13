# Polish gate (2026-11-13)

**Change:** Luna 5.6 polish — `unf_placement_forms_url` (17 tools), roadmap placement URLs-only.

| Lens | Verdict |
|------|---------|
| Sol 6.1 (`polish-gate`) | **PROCEED** |
| Grok 4.7 (`polish-gate`) | **PROCEED** |
| Fable 5.1 precommit | **PROCEED** |

**Tests:** `npm test` → 17 tools + form1000-optimise ok

Re-run: `UNF_SKIP_FABLE=1 bash .review-gate/run-review-round.sh polish-gate` then `bash .review-gate/run-fable-precommit.sh`
