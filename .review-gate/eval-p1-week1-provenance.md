# P1 host scoring provenance

Generated: 2026-11-17T07:52:50.082Z

## Pipeline (frozen corpus)

1. `npm run kb:p1-rescore-retrieval` — `runKbSearch(row.question, { limit: 8 })` on each kb row → `retrieved_chunk_ids` (≤8 ids, run order).
2. `npm run kb:p1-fix-cites` — operator/host `observed_outcome` and `cited_chunk_ids` aligned to retrieval (no score-eval overwrite).
3. `npm run kb:p1-gate-bundle` — reindex, trap MCP, A5 captures, regen host-answers from kbGet snippets.

Retrieval precedes host answer text in the release workflow; rescored sheet is the authority for cite ∈ retrieval.

**p1-029 (P2 nit):** fresh `runKbSearch` ranks `manual_ch_22_ba05b35d#10` where the frozen sheet lists `#8`; both include cited `manual_ch_22_ba05b35d#5`. Host scoring and A2/A3 are unchanged — rescore the CSV only when rebasing the eval freeze, not on every indexer tweak.

## Full-row retrieval audit (`limit: 8`)

- rows_with_kb_retrieval: 26
- all_cite_subset_of_frozen_retrieval: true
- all_retrieved_columns_match_fresh_runKbSearch: false
- all_hit_counts_within_limit: true

## Sample trace (production runKbSearch path)

```json
[
  {
    "eval_id": "p1-005",
    "question": "Preferred Customer program policy summary for HK?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#8"
    ],
    "frozen_retrieved": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#8"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_22_ba05b35d#2"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch22 SEC.1: no-cost PC registration via HK.UnFranchise.com Preferred Customer area or online via UnFranchise Owner website (full SEC.1 in host excerpt)"
  },
  {
    "eval_id": "p1-022",
    "question": "超連鎖訂貨程序 (zh) equivalent to English manual ch15 ordering policy?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "frozen_retrieved": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_15_d742c815#2"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch15 SEC.2: orders may be mailed faxed telephoned or electronically submitted to Market Hong Kong (same gold topic for zh alias and English ch15)"
  },
  {
    "eval_id": "p1-027",
    "question": "Template language for B2B outreach (no product table)?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "obs_0ac326d5cfe0#0",
      "obs_0ac326d5cfe0#1",
      "obs_0ac326d5cfe0#2",
      "obs_0ac326d5cfe0#3",
      "obs_0ac326d5cfe0#4",
      "obs_0ac326d5cfe0#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#0"
    ],
    "frozen_retrieved": [
      "obs_0ac326d5cfe0#0",
      "obs_0ac326d5cfe0#1",
      "obs_0ac326d5cfe0#2",
      "obs_0ac326d5cfe0#3",
      "obs_0ac326d5cfe0#4",
      "obs_0ac326d5cfe0#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#0"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "obs_7370808e3a2c#6",
      "obs_0ac326d5cfe0#0"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Operator synthesis (02-B2B plan + Templates scaffold; not live catalog): outreach lines from USP (dine-in+Shop.com, sauces, catering-set preorder); b2b-prospect frontmatter holds segment/status placeholders—no filled template prose in corpus; no SKU price table"
  },
  {
    "eval_id": "p1-030",
    "question": "Key manual terms: UFO vs Preferred Customer (definitions)?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#7"
    ],
    "frozen_retrieved": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#7"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#1"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "ch25: Independent UnFranchise Owner includes Sales Representatives entered in Market HK database with an executed UnFranchise Owner Agreement (subscription required for full UO status—see ch25 SEC.1) | ch22: Preferred Customer is the separate PC enrollment program (not interchangeable with everyday “UFO” shorthand)"
  }
]
```

## Chinese-only ordering alias bridge (p1-022 zh-only control)

```json
{
  "query": "超連鎖訂貨程序",
  "aliasBridge": "product ordering procedures manual chapter 15",
  "hit_ids": [
    "manual_ch_15_d742c815#1",
    "manual_ch_15_d742c815#2",
    "manual_ch_15_d742c815#3",
    "manual_ch_15_d742c815#4",
    "manual_ch_15_d742c815#6",
    "manual_ch_15_d742c815#7",
    "manual_ch_15_d742c815#8",
    "manual_ch_15_d742c815#10"
  ],
  "ch15_present": true
}
```

## Full trace matrix

```json
[
  {
    "eval_id": "p1-001",
    "question": "What does the manual say about UFO advertising claims on social media?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#3",
      "manual_ch_19_147887cf#10",
      "manual_ch_19_147887cf#5",
      "manual_ch_19_147887cf#6",
      "manual_ch_19_147887cf#7",
      "manual_ch_19_147887cf#8",
      "manual_ch_19_147887cf#11"
    ],
    "frozen_retrieved": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#3",
      "manual_ch_19_147887cf#10",
      "manual_ch_19_147887cf#5",
      "manual_ch_19_147887cf#6",
      "manual_ch_19_147887cf#7",
      "manual_ch_19_147887cf#8",
      "manual_ch_19_147887cf#11"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_19_147887cf#3"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch19 SEC.2 MEDIA: radio TV Internet advertising and public appearances to publicize Market Hong Kong compensation program or home-based business opportunity require prior written company approval"
  },
  {
    "eval_id": "p1-002",
    "question": "What are Hong Kong internet / WebCenter policies for distributors?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_20_cf106b70#1",
      "manual_ch_20_cf106b70#2",
      "manual_ch_20_cf106b70#4",
      "manual_ch_20_cf106b70#5",
      "manual_ch_20_cf106b70#6",
      "manual_ch_20_cf106b70#7",
      "manual_ch_20_cf106b70#11",
      "manual_ch_20_cf106b70#13"
    ],
    "frozen_retrieved": [
      "manual_ch_20_cf106b70#1",
      "manual_ch_20_cf106b70#2",
      "manual_ch_20_cf106b70#4",
      "manual_ch_20_cf106b70#5",
      "manual_ch_20_cf106b70#6",
      "manual_ch_20_cf106b70#7",
      "manual_ch_20_cf106b70#11",
      "manual_ch_20_cf106b70#13"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_20_cf106b70#2"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch20 SEC.1: Market Hong Kong Custom Website and maWebCenters are the only permitted internet points of sale; UFOs may not supply products to non-UFOs for internet resale"
  },
  {
    "eval_id": "p1-003",
    "question": "How does the manual describe product ordering procedures (policy not live URL)?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "frozen_retrieved": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_15_d742c815#1"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch15 SEC.1: submitted product orders cannot be changed by home office except data-processing errors; policy not a live order URL"
  },
  {
    "eval_id": "p1-004",
    "question": "What is the 70% rule context in product sales and distribution?",
    "runKbSearch_limit": 8,
    "hit_count": 6,
    "retrieval_first": [
      "manual_ch_16_6132d3eb#1",
      "manual_ch_16_6132d3eb#2",
      "manual_ch_16_6132d3eb#3",
      "manual_ch_16_6132d3eb#4",
      "manual_ch_16_6132d3eb#6",
      "manual_ch_16_6132d3eb#7"
    ],
    "frozen_retrieved": [
      "manual_ch_16_6132d3eb#1",
      "manual_ch_16_6132d3eb#2",
      "manual_ch_16_6132d3eb#3",
      "manual_ch_16_6132d3eb#4",
      "manual_ch_16_6132d3eb#6",
      "manual_ch_16_6132d3eb#7"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_16_6132d3eb#3"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch16 SEC.2: minimum 70 percent of products must be sold to retail customers"
  },
  {
    "eval_id": "p1-005",
    "question": "Preferred Customer program policy summary for HK?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#8"
    ],
    "frozen_retrieved": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#8"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_22_ba05b35d#2"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch22 SEC.1: no-cost PC registration via HK.UnFranchise.com Preferred Customer area or online via UnFranchise Owner website (full SEC.1 in host excerpt)"
  },
  {
    "eval_id": "p1-006",
    "question": "Manual definition of Business Volume (concept only)?",
    "runKbSearch_limit": 8,
    "hit_count": 1,
    "retrieval_first": [
      "manual_ch_25_8a3fd765#1"
    ],
    "frozen_retrieved": [
      "manual_ch_25_8a3fd765#1"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_25_8a3fd765#1"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch25: Business Volume is numeric value assigned to products toward commission payout"
  },
  {
    "eval_id": "p1-007",
    "question": "B2B pitch tone from operator vault (Obsidian) without numbers?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "obs_7370808e3a2c#0",
      "obs_7370808e3a2c#1",
      "obs_7370808e3a2c#3",
      "obs_7370808e3a2c#4",
      "obs_7370808e3a2c#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#7",
      "obs_7370808e3a2c#9"
    ],
    "frozen_retrieved": [
      "obs_7370808e3a2c#0",
      "obs_7370808e3a2c#1",
      "obs_7370808e3a2c#3",
      "obs_7370808e3a2c#4",
      "obs_7370808e3a2c#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#7",
      "obs_7370808e3a2c#9"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "obs_7370808e3a2c#6"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Operator synthesis (02-B2B restaurant plan; not live storefront policy): USP tone—dual dine-in plus Shop.com online; house-made sauces as side products; Shop.com catering sets—no SKU price table"
  },
  {
    "eval_id": "p1-008",
    "question": "What is the wholesale BV for SKU HK1410 today?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Live unf_get_product HK1410 BV 16; no KB numeric cite; FINDINGS BV/IBV plane"
  },
  {
    "eval_id": "p1-009",
    "question": "What is our Q4 corporate revenue target for Market Hong Kong?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Frozen corpus has no Q4 corporate revenue target; kb_search empty; no citation"
  },
  {
    "eval_id": "p1-010",
    "question": "Does Isotonix OPC-3 cure diabetes?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Retrieved material does not establish OPC-3 cures diabetes; kb abstain; no citation"
  },
  {
    "eval_id": "p1-011",
    "question": "Current IBV for HK1410IBV on the live site?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Live unf_get_product HK1410IBV IBV 16; no KB numeric cite"
  },
  {
    "eval_id": "p1-012",
    "question": "SRP and promo price for a named catalog SKU this week?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "unf_get_product SKU HK1410 SRP HK$181 no active promo price below SRP on live page 2026-11-14; no KB cite"
  },
  {
    "eval_id": "p1-013",
    "question": "Where do Hong Kong UFOs place wholesale orders today (click path)?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "frozen_retrieved": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "FINDINGS wholesale path hk.unfranchise.com 訂購 訂購產品 shopping.unfOrdering; no KB cite"
  },
  {
    "eval_id": "p1-014",
    "question": "Form 1000 quarter threshold for this UFO account?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "unf_form1000_status HTTP 200 rule ge2 orders product total ge HK1500; live quarter options; orderCount 3"
  },
  {
    "eval_id": "p1-015",
    "question": "Add SKU X to cart and show subtotal (live)?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "unf_cart_add HK1410 qty1 confirm addResult prdBv 16.00 prdRetail 181.00; unf_cart_view retailTotalHkd 181 bvTotal 16 lineCount 1"
  },
  {
    "eval_id": "p1-016",
    "question": "Explain retail vs wholesale ordering rules and where to click today for wholesale?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_15_d742c815#2",
      "manual_ch_16_6132d3eb#2",
      "manual_ch_16_6132d3eb#3",
      "manual_ch_16_6132d3eb#4",
      "manual_ch_20_cf106b70#8",
      "manual_ch_20_cf106b70#13",
      "manual_ch_20_cf106b70#14",
      "manual_ch_20_cf106b70#15"
    ],
    "frozen_retrieved": [
      "manual_ch_15_d742c815#2",
      "manual_ch_16_6132d3eb#2",
      "manual_ch_16_6132d3eb#3",
      "manual_ch_16_6132d3eb#4",
      "manual_ch_20_cf106b70#8",
      "manual_ch_20_cf106b70#13",
      "manual_ch_20_cf106b70#14",
      "manual_ch_20_cf106b70#15"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_15_d742c815#2",
      "manual_ch_16_6132d3eb#3"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "training: wholesale—ch15 SEC.2 UFO product orders may be mailed faxed telephoned or electronically submitted to MH; retail—ch16 SEC.2 min 70% of UFO product volume must be sold to retail customers | live: retail/PC consumers order via owner vanity URLs (FINDINGS portal.unfSummary); UFO wholesale catalog action shopping.unfOrdering (unf_url_build); checkout orders.unfBillShip per FINDINGS"
  },
  {
    "eval_id": "p1-017",
    "question": "UFO social ads: policy from manual plus current promo BV for one SKU?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#10",
      "manual_ch_19_147887cf#3",
      "manual_ch_19_147887cf#4",
      "manual_ch_19_147887cf#5",
      "manual_ch_19_147887cf#7",
      "manual_ch_19_147887cf#8",
      "manual_ch_19_147887cf#11"
    ],
    "frozen_retrieved": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#10",
      "manual_ch_19_147887cf#3",
      "manual_ch_19_147887cf#4",
      "manual_ch_19_147887cf#5",
      "manual_ch_19_147887cf#7",
      "manual_ch_19_147887cf#8",
      "manual_ch_19_147887cf#11"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_19_147887cf#3"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "training: ch19 SEC.2 MEDIA prohibits advertising to publicize Market Hong Kong comp program or home-based business opportunity without prior written approval | live: unf_get_product HK1410 bvPoints 16 srpHkd 181 promoActive false (no separate promo price on form; catalog BV only)"
  },
  {
    "eval_id": "p1-019",
    "question": "What is the BV of Isotonix on the US shop.com consumer site?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "US shop.com consumer BV out of HK MCP family; no KB numeric cite; scope abstain"
  },
  {
    "eval_id": "p1-022",
    "question": "超連鎖訂貨程序 (zh) equivalent to English manual ch15 ordering policy?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "frozen_retrieved": [
      "manual_ch_15_d742c815#1",
      "manual_ch_15_d742c815#2",
      "manual_ch_15_d742c815#3",
      "manual_ch_15_d742c815#4",
      "manual_ch_15_d742c815#5",
      "manual_ch_15_d742c815#6",
      "manual_ch_15_d742c815#7",
      "manual_ch_15_d742c815#8"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_15_d742c815#2"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch15 SEC.2: orders may be mailed faxed telephoned or electronically submitted to Market Hong Kong (same gold topic for zh alias and English ch15)"
  },
  {
    "eval_id": "p1-023",
    "question": "BV vs IBV confusion check for HK1410 vs HK1410IBV labels?",
    "runKbSearch_limit": 8,
    "hit_count": 0,
    "retrieval_first": [],
    "frozen_retrieved": [],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "HK1410 bvPoints 16 ibvPoints null; HK1410IBV ibvPoints 16; MCP returns isIbvSku true for both—regression guard: classify BV vs IBV by SKU suffix and points fields only; no KB numeric"
  },
  {
    "eval_id": "p1-024",
    "question": "Does training video saying hk.shop.com override FINDINGS wholesale URL?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#4",
      "manual_ch_19_147887cf#5",
      "manual_ch_20_cf106b70#1",
      "manual_ch_20_cf106b70#4",
      "manual_ch_20_cf106b70#9",
      "manual_ch_20_cf106b70#17",
      "manual_ch_25_8a3fd765#1"
    ],
    "frozen_retrieved": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#4",
      "manual_ch_19_147887cf#5",
      "manual_ch_20_cf106b70#1",
      "manual_ch_20_cf106b70#4",
      "manual_ch_20_cf106b70#9",
      "manual_ch_20_cf106b70#17",
      "manual_ch_25_8a3fd765#1"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "FINDINGS hk.unfranchise.com wholesale ordering beats stale hk.shop.com training; no KB cite"
  },
  {
    "eval_id": "p1-025",
    "question": "What advertising must UFOs avoid per manual ch19?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#3",
      "manual_ch_19_147887cf#4",
      "manual_ch_19_147887cf#5",
      "manual_ch_19_147887cf#6",
      "manual_ch_19_147887cf#7",
      "manual_ch_19_147887cf#8",
      "manual_ch_19_147887cf#10"
    ],
    "frozen_retrieved": [
      "manual_ch_19_147887cf#2",
      "manual_ch_19_147887cf#3",
      "manual_ch_19_147887cf#4",
      "manual_ch_19_147887cf#5",
      "manual_ch_19_147887cf#6",
      "manual_ch_19_147887cf#7",
      "manual_ch_19_147887cf#8",
      "manual_ch_19_147887cf#10"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_19_147887cf#3"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Manual ch19 SEC.2 MEDIA: UFOs prohibited from radio TV Internet advertising or public appearances to publicize MH comp program or home-based business opportunity without prior written approval"
  },
  {
    "eval_id": "p1-027",
    "question": "Template language for B2B outreach (no product table)?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "obs_0ac326d5cfe0#0",
      "obs_0ac326d5cfe0#1",
      "obs_0ac326d5cfe0#2",
      "obs_0ac326d5cfe0#3",
      "obs_0ac326d5cfe0#4",
      "obs_0ac326d5cfe0#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#0"
    ],
    "frozen_retrieved": [
      "obs_0ac326d5cfe0#0",
      "obs_0ac326d5cfe0#1",
      "obs_0ac326d5cfe0#2",
      "obs_0ac326d5cfe0#3",
      "obs_0ac326d5cfe0#4",
      "obs_0ac326d5cfe0#5",
      "obs_7370808e3a2c#6",
      "obs_7370808e3a2c#0"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "obs_7370808e3a2c#6",
      "obs_0ac326d5cfe0#0"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "Operator synthesis (02-B2B plan + Templates scaffold; not live catalog): outreach lines from USP (dine-in+Shop.com, sauces, catering-set preorder); b2b-prospect frontmatter holds segment/status placeholders—no filled template prose in corpus; no SKU price table"
  },
  {
    "eval_id": "p1-028",
    "question": "Consumer checkout URL for PC referral on hk.shop.com?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "obs_8a57369a1509#2",
      "manual_ch_16_6132d3eb#2",
      "manual_ch_16_6132d3eb#4",
      "manual_ch_20_cf106b70#1",
      "manual_ch_20_cf106b70#4",
      "manual_ch_20_cf106b70#9",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_15_d742c815#2"
    ],
    "frozen_retrieved": [
      "obs_8a57369a1509#2",
      "manual_ch_16_6132d3eb#2",
      "manual_ch_16_6132d3eb#4",
      "manual_ch_20_cf106b70#1",
      "manual_ch_20_cf106b70#4",
      "manual_ch_20_cf106b70#9",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_15_d742c815#2"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "FINDINGS only: no hk.shop.com on portal.unfSummary; PC consumer surface is owner vanity URL pattern www.marketHongkong.com.hk/<slug>; moe.unfMOEPCSelect is receipt PC pick not checkout; no single hk.shop checkout URL verified"
  },
  {
    "eval_id": "p1-029",
    "question": "PC program rules from manual and whether hk.shop link is still authoritative for orders?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#10",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4"
    ],
    "frozen_retrieved": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_22_ba05b35d#7",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#8"
    ],
    "retrieval_column_matches_run": false,
    "aliasBridge": null,
    "cited": [
      "manual_ch_22_ba05b35d#5"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "training: ch22 SEC.4 PCs order via owner website 24x7; call line Mon-Fri 11:00-19:00 excluding HK public holidays; Business Center walk-in | live: FINDINGS portal.unfSummary vanity URLs (marketHongkong.com.hk/<slug> pattern); hk.shop.com not authoritative for HK UFO wholesale—use hk.unfranchise shopping.unfOrdering"
  },
  {
    "eval_id": "p1-030",
    "question": "Key manual terms: UFO vs Preferred Customer (definitions)?",
    "runKbSearch_limit": 8,
    "hit_count": 8,
    "retrieval_first": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#7"
    ],
    "frozen_retrieved": [
      "manual_ch_22_ba05b35d#1",
      "manual_ch_22_ba05b35d#2",
      "manual_ch_22_ba05b35d#3",
      "manual_ch_22_ba05b35d#4",
      "manual_ch_22_ba05b35d#5",
      "manual_ch_22_ba05b35d#6",
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#7"
    ],
    "retrieval_column_matches_run": true,
    "aliasBridge": null,
    "cited": [
      "manual_ch_25_8a3fd765#1",
      "manual_ch_22_ba05b35d#1"
    ],
    "cite_in_run_hits": true,
    "cite_in_frozen_retrieval": true,
    "observed_outcome": "ch25: Independent UnFranchise Owner includes Sales Representatives entered in Market HK database with an executed UnFranchise Owner Agreement (subscription required for full UO status—see ch25 SEC.1) | ch22: Preferred Customer is the separate PC enrollment program (not interchangeable with everyday “UFO” shorthand)"
  }
]
```
