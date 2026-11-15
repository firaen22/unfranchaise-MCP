#!/usr/bin/env node
/** Apply live MCP host scores to eval-p1-week1-scored.csv (post sol checklist). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvalCsv, writeEvalCsv } from '../kb/lib/eval-csv.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(repo, '.review-gate/eval-p1-week1-scored.csv');
const scoredAt = new Date().toISOString();

const patches = {
  'p1-008': {
    cited_chunk_ids: '',
    observed_outcome:
      'Live unf_get_product HK1410 bvPoints 16 srpHkd 181; no KB citation; FINDINGS BV/IBV plane; see trap trace',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-011': {
    cited_chunk_ids: '',
    observed_outcome: 'Live unf_get_product HK1410IBV IBV 16; no KB numeric cite',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-012': {
    cited_chunk_ids: '',
    observed_outcome:
      'unf_get_product SKU HK1410 SRP HK$181 no active promo price below SRP on live page 2026-11-14; no KB cite',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-014': {
    cited_chunk_ids: '',
    observed_outcome:
      'unf_form1000_status rule 2 orders product total ge HK$1500 ex fees; live quarter options HTTP 200',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-015': {
    cited_chunk_ids: '',
    observed_outcome:
      'unf_cart_add HK1410 qty1 via orders.unfAddCartAJAX then unf_cart_view retailTotalHkd and bvTotal; no KB cite',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-016': {
    cited_chunk_ids: 'manual_ch_15_d742c815#2',
    observed_outcome:
      'training: ch15 ordering policy cite manual_ch_15_d742c815#2 | live: wholesale click shopping.unfOrdering URL via unf_url_build',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-017': {
    cited_chunk_ids: 'manual_ch_19_147887cf#2',
    observed_outcome:
      'training: ch19 UFO advertising manual_ch_19_147887cf#2 | live: HK1410 BV 16 unf_get_product only',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-023': {
    cited_chunk_ids: '',
    observed_outcome:
      'HK1410 BV 16 vs HK1410IBV IBV 16; distinct SKUs; no KB numeric',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-026': {
    cited_chunk_ids: '',
    observed_outcome:
      'No MCP proves exhaustive 2026 spring bundle membership; abstain list; no KB',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-029': {
    cited_chunk_ids: 'manual_ch_22_ba05b35d#2',
    observed_outcome:
      'training: ch22 PC rules manual_ch_22_ba05b35d#2 | live: FINDINGS portal unfSummary no hk.shop for UFO orders',
    pass_fail: 'pass',
    failure_class: '',
  },
  'p1-028': {
    cited_chunk_ids: '',
    observed_outcome:
      'FINDINGS UFO checkout orders.unfBillShip; PC inventory moe.unfMOEPCSelect; not kb order_url',
    pass_fail: 'pass',
    failure_class: '',
  },
};

const { headers, rows } = readEvalCsv(csvPath);
for (const row of rows) {
  const p = patches[row.id];
  if (!p) continue;
  Object.assign(row, p);
  row.scored_at = scoredAt;
}
writeEvalCsv(csvPath, headers, rows);

const counts = rows.reduce((a, r) => {
  a[r.pass_fail] = (a[r.pass_fail] ?? 0) + 1;
  return a;
}, {});
console.log(JSON.stringify({ pass_fail: counts, scored_at: scoredAt }, null, 2));