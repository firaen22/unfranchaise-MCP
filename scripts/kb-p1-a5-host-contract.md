# A5 host / knowledge-plane contract (P1 evidence)

`handleKbTool` (`kb/lib/kb-handlers.js`) is the production kb MCP entry.

## After an operational MCP turn

1. Operational tools (`unf_*`) return cart/account HTML or JSON to the **host orchestrator** only.
2. The host calls `kb_search` / `kb_get` with **args = { query, limit } or { chunk_id }** only.
3. `captureKnowledgeToolCall` serializes **tool args** into `knowledgePayload`; cart SKUs and totals must not appear there.
4. `operationalContext` plus optional `generationMessages` form the generation boundary. Cookie tokens, cart HTML, cart MCP JSON, and account JSON there are **rejected before** `runKbSearch`.

## Evidence in this gate bundle

| Artifact | Proves |
|----------|--------|
| `eval-p1-week1-a5-capture.json` | Matrix: green args + red cookie/cart/sentinel/account in args |
| `eval-p1-week1-a5-host-boundary.txt` | Handler rejects cookie in args or in `operationalContext` |
| `eval-p1-week1-a5-mixed-turn.json` | Live `unf_cart_view` then `kb_search` with empty `operationalContext`; `dispatched_payload` has no cart fields |
| `eval-p1-week1-a5-generation-context.json` | Prior assistant tool message with cart JSON rejected via `generationMessages` |
| `test-kb-mcp.mjs` | Same handler path in `npm test` |

Redacted cart JSON in `operationalContext` is rejected (`cart_mcp_json_in_generation_context`). **Host policy:** do not attach MCP blobs to `operationalContext`; use FINDINGS/MCP only in the labeled `live` section of mixed answers.