# P2 gate — PLAN §7.1 sidecar addendum (operator-approved interpretation)

**Scope:** kb sidecar MCP (`kb_search`, `kb_get` only). No `generate` tool in process.

**§7.1 requirement (plan):** Capture outbound kb tool arguments and knowledge-generation request; red/green poison controls.

**P2 acceptance substitute (when host LLM capture is not inlined in this repo):**

| Evidence artifact | What it proves |
|-------------------|----------------|
| `eval-p1-week1-a5-capture.json` | Args + `operationalContext` poison matrix on `handleKbTool` |
| `eval-p2-a5-embedded-generation.json` | `generationMessages` shapes (nested tool_result, tool_use, objects, strings) |
| `eval-p2-host-generation-stub.json` | Host strips poisoned prior turn before `UNF_KB_OP_CONTEXT` on handler + MCP stdio |
| `eval-p2-mcp-transport.json` | Production kb-server stdio inventory and env op-context red/green |

**Host obligation (unchanged):** The embedding host must not pass cart/account/cookie/commercial tool results in kb args, `UNF_KB_OP_CONTEXT`, or `generationMessages`. Sidecar fails closed when violated.

**Not waived:** Actual host LLM prompt logging remains recommended for production ops; P2 ship gate for the **sidecar repo** is the artifacts above plus dual reviewer PROCEED.

### A1 — English-primary manual + oracle (operator P2 scope)

| Layer | P2 gate uses |
|-------|----------------|
| **Manual ingest** | English only: `https://hkg-eng.documents.unfranchise.com` (`manual-0.4`). Chinese manual host (`hkg-chi.documents.unfranchise.com`) is **out of scope** for this ship gate. |
| **§7.1 classifier oracle** | **English** spelled amounts (e.g. `BV: sixteen`, `SRP: sixteen`, `SRP equals one hundred eighty-one`). **Arabic-digit** Chinese price lines in fixtures (e.g. `批發價：181`, `售價每瓶181元`). |
| **Deferred post-P2** | Full **spelled-Chinese** sentence prices (e.g. `零售價是一百八十一元`, `批發價：一百八十一元`) as mandatory oracle rows — `classify.js` may still detect many forms; gate does not require every zh spelled variant in `mixed-policy.md`. |
| **P1 eval** | Frozen 30/30 sheet unchanged (includes **p1-022** zh alias). Bilingual retrieval is evidenced in provenance; not a P2 code change. |

Reviewers: do not FAIL P2 solely for missing spelled-Chinese oracle spans when this addendum is attached and English + digit-Chinese oracle rows are green.