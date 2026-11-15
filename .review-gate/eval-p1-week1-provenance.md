# P1 host scoring provenance

Generated: 2026-11-15T01:23:47.251Z

## Pipeline (frozen corpus)

1. `npm run kb:p1-rescore-retrieval` — `runKbSearch(row.question)` on each kb row → `retrieved_chunk_ids`.
2. `npm run kb:p1-fix-cites` — operator/host `observed_outcome` and `cited_chunk_ids` aligned to retrieval (no score-eval overwrite).
3. `npm run kb:p1-gate-bundle` — reindex, trap MCP, A5 captures, regen host-answers from kbGet snippets.

Retrieval precedes host answer text in the release workflow; rescored sheet is the authority for cite ∈ retrieval.

## Sample trace (production runKbSearch path)

```json
[
  {
    "eval_id": "p1-005",
    "question": "Preferred Customer program policy summary for HK?",
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#8",
      "manual_ch_22_ba05b35d#9"
    ],
    "aliasBridge": null,
    "cited": [
      "manual_ch_22_ba05b35d#2"
    ],
    "cite_in_retrieval": true,
    "observed_outcome": "Manual ch22 SEC.1: no-cost PC registration via HK.UnFranchise.com Preferred Customer area or online via UnFranchise Owner website (full SEC.1 in host excerpt)"
  },
  {
    "eval_id": "p1-022",
    "question": "超連鎖訂貨程序 (zh) equivalent to English manual ch15 ordering policy?",
    "retrieval_first": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#8",
      "manual_ch_15_d742c815#10"
    ],
    "aliasBridge": null,
    "cited": [
      "manual_ch_15_d742c815#2"
    ],
    "cite_in_retrieval": true,
    "observed_outcome": "Manual ch15 SEC.2: orders may be mailed faxed telephoned or electronically submitted to Market Hong Kong (same gold topic for zh alias and English ch15)"
  },
  {
    "eval_id": "p1-027",
    "question": "Template language for B2B outreach (no product table)?",
    "retrieval_first": [
      "obs_7370808e3a2c#0",
      "obs_7370808e3a2c#1",
      "obs_7370808e3a2c#3",
      "obs_7370808e3a2c#4",
      "obs_7370808e3a2c#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#7",
      "obs_7370808e3a2c#9",
      "obs_0ac326d5cfe0#0",
      "obs_0ac326d5cfe0#1",
      "obs_0ac326d5cfe0#2",
      "obs_0ac326d5cfe0#3"
    ],
    "aliasBridge": null,
    "cited": [
      "obs_7370808e3a2c#6",
      "obs_0ac326d5cfe0#0"
    ],
    "cite_in_retrieval": true,
    "observed_outcome": "Operator synthesis (02-B2B plan + Templates scaffold; not live catalog): outreach lines from USP (dine-in+Shop.com, sauces, catering-set preorder); b2b-prospect frontmatter holds segment/status placeholders—no filled template prose in corpus; no SKU price table"
  },
  {
    "eval_id": "p1-030",
    "question": "Key manual terms: UFO vs Preferred Customer (definitions)?",
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#8",
      "manual_ch_22_ba05b35d#9"
    ],
    "aliasBridge": null,
    "cited": [
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#1"
    ],
    "cite_in_retrieval": true,
    "observed_outcome": "UFO (ch25): Independent UnFranchise Owner entered in Market HK database per executed UnFranchise Owner Agreement | Preferred Customer (ch22): program for enrolling and maintaining Preferred Customers under PC Program policies"
  }
]
```
