# Unfranchise HK MCP — planning packet

Read FINDINGS.md and README.md in repo root (attached or cwd).

**Goal:** Node.js stdio MCP + thin CLI for `hk.unfranchise.com` (ColdFusion `index.cfm?action=` routes).

**Constraints:**
- Auth: `UNF_COOKIE` or `UNF_COOKIE_FILE` (never commit secrets)
- Default dry-run on cart mutations, checkout, Form 1000 submit, BV/IBV placement updates
- Explicit `confirm: true` only for mutating live actions
- No payment, no Form 1000 final submit in v0 unless confirm

**Deliverable from you:** ONE markdown file in your outdir named `PLAN.md` with:
1. Recommended file/module layout (≤12 files)
2. Tool list with input JSON Schema sketches (names prefixed `unf_`)
3. Pure functions vs HTTP-bound tools
4. Smoke test oracle (no live cookie required)
5. Top 3 implementation risks

Do NOT write implementation code. Planning only.
