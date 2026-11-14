# PR #8 — Sol 6.1 fix plan (agreed 2026-11-14)

**Reviewer:** gpt-6.1-sol (medium, astra pack)  
**Verdict:** `PLAN OK`

## Root cause (Sol)

1. Manual `Symbol.toPrimitive` / double slot probing could observe mutable state twice vs `JSON.stringify`.
2. Array `length` was read more than once inside `jsonArrayLength` (`typeof arr.length` then `+arr.length`).
3. `toJSON` results were re-processed with `toJSON`, letting nested wrapper hooks hide persisted secrets.

## Implemented steps

| Step | Change |
|------|--------|
| 1 | `prepareJsonValue(..., afterToJson)` — one `toJSON` per logical property |
| 2 | `unboxJsonPrimitive` — intrinsic brands, then `+v` / `String(v)` (no manual `Symbol.toPrimitive`) |
| 3 | `jsonArrayLength` — single `raw = arr.length`, ToLength via `+raw` |
| 4 | `captureSerializedForTest` + differential fixtures in `test-bugfix-safety-money.mjs` |

**Implementer note:** Luna 5.6 asked to verify; core edits landed on branch before Luna verify pass.

## PROCEED evidence (target)

- `npm test` exit 0 [verified: local]
- Differential `captureSerializedForTest` vs `JSON.stringify` on safe fixtures [verified: local]
- Sol + Grok post-fix review pending