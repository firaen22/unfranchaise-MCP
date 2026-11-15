## 2. Acceptance (testable)

| ID | Criterion |
|----|-----------|
| A1 | Price, BV, IBV, UC, SRP, promos, Form 1000 math, checkout, **actionable order URLs** → **only** `unfranchaise-MCP` or `FINDINGS.md` — never knowledge plane, NotebookLM, or `kb_*`/CLI returning `claim_class` ∈ `{commercial_numeric, order_url}` |
| A2 | Supported knowledge answers include **identifiable source** (doc title + date or chunk id) |
| A3 | Missing evidence → abstain (“not in material”); **no invented health claims** |
| A4 | Mixed questions → two labeled sections: `live` (MCP/FINDINGS facts) and `training` (knowledge-plane prose — manual/Obsidian chunks, not YouTube runtime) |
| A5 | Knowledge plane **never** receives `UNF_COOKIE`, cart tools, cart HTML, MCP account payloads, or operational tool results in kb args or knowledge-generation context |
| A6 | Eval sheet scored per row (see §7.1); performance targets below are **not** substitutes for hard blockers |

**Hard blockers (any single failure fails the gate):**

- Commercial numeric or order URL from knowledge plane, NotebookLM, **or** retrieval returning `commercial_numeric` (A1)
- **Supported** row (`category=supported`) that abstains or fails to cite (A3/A6)
- Supported answer **without** correct source identifier, or cited text that does not support the claim (A2)
- Supported answer **without** evidence in retrieved chunks (unsupported factual claim) (A3 scope)
- **Invented** health claim on abstain or supported rows (A3)
- Trap row (`expected_route` mcp \| findings) answered from knowledge plane (A1); **numeric/order traps** pass only on MCP/FINDINGS evidence, not abstain
- Mixed answer **without** `live` / `training` labels (A4)
- **Credential canary** positive: cookie, cart HTML, or MCP account payload in knowledge request (A5)
- **`category=abstain`** row that asserts unsupported **non-health** facts (must abstain cleanly) (A3)

**Performance targets (monitoring only — never excuse a hard-blocker miss):**

- Supported rows: ≥80% cite the operator-chosen gold doc among rows that already pass A2

**Eval coverage (mandatory for P1):** 30 rows covering every §2 edge + ≥1 mixed + canary (A5). **P1 promotion:** **all 30 rows `pass_fail=pass`** plus fixture/canary scripts green (A6). No row category is exempt. Gold-doc % is diagnostic only.

**Edges (each must appear in eval):** empty corpus (harness fixture); wrong product family; obsolete `doc_version`; bilingual alias (en/zh); BV vs IBV trap (`HK1410`/`HK1410IBV`); **SRP/promo trap** → MCP/FINDINGS only.

