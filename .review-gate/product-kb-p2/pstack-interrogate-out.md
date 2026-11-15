# Pstack interrogate — Phase 2 kb sidecar (findings-only)

Generated: 2026-11-15 (Composer panel, post-P1 commit `3dcbde5`)

## Intent

Ship `kb_search` / `kb_get` on stdio MCP + `kb` CLI with A1 commercial guard and A5 isolation; P1 eval 30/30 attached.

## Verified findings (addressed in follow-up commit)

| ID | Issue | Fix |
|----|--------|-----|
| F1 | Extra CallTool fields bypassed A5 scan | `rejectExtraOrLeakyArgs` on full args before dispatch |
| F3 | Bare `UNF_CANARY=1` green | Broadened `SENTINEL_RE` |
| F4 | `JSESSIONID=` not in cookie regex | Extended `COOKIE_LEAK_RE` |

## Open / host contract

| ID | Issue | Owner |
|----|--------|-------|
| F2 | Stdio MCP does not pass `generationMessages` (host embeds boundary) | Documented in `scripts/kb-p1-a5-host-contract.md` |
| F5 | Sanitize only on kb entrypoints | By design; consumers must import `kb-env` first |

## Green probes

- `npm test`, `npm run test:kb` exit 0
- `runA5CanaryMatrix()` pass after F3
- Commercial trap queries → `[]`