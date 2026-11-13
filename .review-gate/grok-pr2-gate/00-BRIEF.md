# Unfranchise MCP review (pr2-gate)

Read-only security + correctness review of the Unfranchise HK MCP (Node stdio, cookie auth).

Scope: server.js, cli.js, lib/*.js, capture scripts, pure-smoke.mjs — session cookie handling, dry-run gates, checkout read-only tools, no credential logging in fixtures/capture output.

Threat focus: cookie leakage in logs/errors, accidental live mutations without confirm, SSRF via user-controlled URLs, PII in captured HTML/logs.

Consensus: **PROCEED** or **approve with nits** with zero High/Critical in scope.

Output: Verdict, Findings (Critical→Nits), Suggested tests.
