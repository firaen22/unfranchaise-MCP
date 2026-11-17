# P1 eval failure log (week 1)

Generated: 2026-11-15T01:23:47.158Z

| id | failure_class | resolution | verified |
|----|---------------|------------|----------|
| p1-009 | unexpected_hits_or | FTS mixed OR → evalSearch AND+abstain tokens; kb_empty | kb:score-eval |
| p1-010 | unexpected_hits_or | FTS AND+abstain tokens; kb_empty | kb:score-eval |
| p1-012 | mcp_missing_srp_promo | parseProductPage srpHkd; no promo below SRP on HK1410 | unf_get_product live |
| p1-015 | cart_mcp_gap | unfAddToCartAJAX + parseCartSummary retailTotalHkd | live CLI |
| p1-017 | cite_not_in_retrieval | evalSearchQuery UFO advertising ch19 + requireChapter | rescore-retrieval |
| p1-029 | cite_not_in_retrieval | evalSearchQuery PC ch22 + requireChapter | rescore-retrieval |
| p1-007 | cite_not_in_retrieval | 02-B2B query rewrite + requireObsidian | rescore-retrieval |
| p1-027 | cite_not_in_retrieval | USP-only cite obs_7370808e3a2c#6 at default limit 8 | fix-cites + rescore |
| p1-030 | cite_not_in_retrieval | dual ch22+ch25 permitted + multi-chapter hit rule | rescore-retrieval |
| p1-018 | a5_operational_context | canary blocks UNF_COOKIE in generation context | a5-preflight + canary.js |
| p1-022 | alias_zh_empty | runKbSearch on full question hits ch15; aliasBridge only when zh-only FTS empty | kb-search-run + rescore |
| p1-016 | mixed_incomplete_distinction | ch15 wholesale + ch16 70% retail + live URL split | fix-cites |
| p1-028 | consumer_checkout_trap | FINDINGS vanity PC storefront; no hk.shop URL; MOE not checkout | fix-cites + FINDINGS excerpt |
| p1-029 | stale_hk_shop | explicit hk.shop not authoritative; portal vanity + wholesale split | fix-cites |
| A1 | claim_class_exclusion | sol harness: oracle + retrieve guard + freeze manifest scan | kb-p1-sol-harnesses.mjs |
| A6 | version_edge | obs_1 kb_get null; obsolete FTS may rank cur_1 only | kb-p1-sol-harnesses.mjs |
| A5 | mixed_turn | cart MCP then kb_search empty operationalContext; cart JSON in op context blocked | canary.js + kb-p1-a5-mixed-turn.mjs |

Final sheet: 30/30 pass_fail=pass after cite/retrieval aligned via runKbSearch (not legacy evalSearchQuery).
