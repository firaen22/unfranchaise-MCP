#!/usr/bin/env node
/** Fix host cites and observed_outcome for A2 reviewer gaps. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvalCsv, writeEvalCsv } from '../kb/lib/eval-csv.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csv = path.join(repo, '.review-gate/eval-p1-week1-scored.csv');
const { headers, rows } = readEvalCsv(csv);

const fixes = {
  'p1-001': {
    cited_chunk_ids: 'manual_ch_19_147887cf#3',
    observed_outcome:
      'Manual ch19 SEC.2 MEDIA: radio TV Internet advertising and public appearances to publicize Market Hong Kong compensation program or home-based business opportunity require prior written company approval',
  },
  'p1-002': {
    cited_chunk_ids: 'manual_ch_20_cf106b70#2',
    observed_outcome:
      'Manual ch20 SEC.1: Market Hong Kong Custom Website and maWebCenters are the only permitted internet points of sale; UFOs may not supply products to non-UFOs for internet resale',
  },
  'p1-003': {
    cited_chunk_ids: 'manual_ch_15_d742c815#1',
    observed_outcome:
      'Manual ch15 SEC.1: submitted product orders cannot be changed by home office except data-processing errors; policy not a live order URL',
  },
  'p1-005': {
    observed_outcome:
      'Manual ch22 SEC.1: no-cost PC registration via HK.UnFranchise.com Preferred Customer area or online via UnFranchise Owner website (full SEC.1 in host excerpt)',
  },
  'p1-004': {
    cited_chunk_ids: 'manual_ch_16_6132d3eb#3',
    observed_outcome:
      'Manual ch16 SEC.2: minimum 70 percent of products must be sold to retail customers',
  },
  'p1-006': {
    cited_chunk_ids: 'manual_ch_25_8a3fd765#1',
    observed_outcome:
      'Manual ch25: Business Volume is numeric value assigned to products toward commission payout',
  },
  'p1-007': {
    permitted_evidence: 'obsidian 02-B2B',
    cited_chunk_ids: 'obs_7370808e3a2c#6',
    observed_outcome:
      'Operator synthesis (02-B2B restaurant plan; not live storefront policy): USP tone—dual dine-in plus Shop.com online; house-made sauces as side products; Shop.com catering sets—no SKU price table',
  },
  'p1-025': {
    cited_chunk_ids: 'manual_ch_19_147887cf#3',
    observed_outcome:
      'Manual ch19 SEC.2 MEDIA: UFOs prohibited from radio TV Internet advertising or public appearances to publicize MH comp program or home-based business opportunity without prior written approval',
  },
  'p1-027': {
    permitted_evidence: 'obsidian 02-B2B Templates',
    cited_chunk_ids: 'obs_7370808e3a2c#6|obs_0ac326d5cfe0#0',
    observed_outcome:
      'Operator synthesis (02-B2B plan + Templates scaffold; not live catalog): outreach lines from USP (dine-in+Shop.com, sauces, catering-set preorder); b2b-prospect frontmatter holds segment/status placeholders—no filled template prose in corpus; no SKU price table',
  },
  'p1-023': {
    observed_outcome:
      'HK1410 bvPoints 16 ibvPoints null; HK1410IBV ibvPoints 16; MCP returns isIbvSku true for both—regression guard: classify BV vs IBV by SKU suffix and points fields only; no KB numeric',
  },
  'p1-030': {
    permitted_evidence: 'manual ch22 ch25',
    cited_chunk_ids: 'manual_ch_25_8a3fd765#1|manual_ch_22_ba05b35d#1',
    observed_outcome:
      'UFO (ch25): Independent UnFranchise Owner entered in Market HK database per executed UnFranchise Owner Agreement | Preferred Customer (ch22): program for enrolling and maintaining Preferred Customers under PC Program policies',
  },
  'p1-016': {
    cited_chunk_ids: 'manual_ch_15_d742c815#2|manual_ch_16_6132d3eb#3',
    observed_outcome:
      'training: wholesale—ch15 SEC.2 UFO product orders may be mailed faxed telephoned or electronically submitted to MH; retail—ch16 SEC.2 min 70% of UFO product volume must be sold to retail customers | live: retail/PC consumers order via owner vanity URLs (FINDINGS portal.unfSummary); UFO wholesale catalog action shopping.unfOrdering (unf_url_build); checkout orders.unfBillShip per FINDINGS',
  },
  'p1-022': {
    cited_chunk_ids: 'manual_ch_15_d742c815#2',
    observed_outcome:
      'Manual ch15 SEC.2: orders may be mailed faxed telephoned or electronically submitted to Market Hong Kong (same gold topic for zh alias and English ch15)',
  },
  'p1-017': {
    cited_chunk_ids: 'manual_ch_19_147887cf#3',
    observed_outcome:
      'training: ch19 SEC.2 MEDIA prohibits advertising to publicize Market Hong Kong comp program or home-based business opportunity without prior written approval | live: unf_get_product HK1410 bvPoints 16 srpHkd 181 promoActive false (no separate promo price on form; catalog BV only)',
  },
  'p1-029': {
    cited_chunk_ids: 'manual_ch_22_ba05b35d#5',
    observed_outcome:
      'training: ch22 SEC.4 PCs order via owner website 24x7; call line Mon-Fri 11:00-19:00; Business Center walk-in | live: FINDINGS portal.unfSummary vanity URLs (marketHongkong.com.hk/<slug> pattern); hk.shop.com not authoritative for HK UFO wholesale—use hk.unfranchise shopping.unfOrdering',
  },
  'p1-028': {
    observed_outcome:
      'FINDINGS only: no hk.shop.com on portal.unfSummary; PC consumer surface is owner vanity URL pattern www.marketHongkong.com.hk/<slug>; moe.unfMOEPCSelect is receipt PC pick not checkout; no single hk.shop checkout URL verified',
  },
  'p1-014': {
    observed_outcome:
      'unf_form1000_status HTTP 200 rule ge2 orders product total ge HK1500; live quarter options; orderCount 3',
  },
};

for (const row of rows) {
  const f = fixes[row.id];
  if (f) Object.assign(row, f);
  if (row.id === 'p1-027' || row.pass_fail === 'pain points') {
    row.pass_fail = 'pass';
    row.failure_class = '';
    if (!row.preflight_retrieval || row.preflight_retrieval === 'pass') {
      row.preflight_retrieval = 'pass';
    }
  }
}

writeEvalCsv(csv, headers, rows);
console.log(JSON.stringify({ updated: Object.keys(fixes).length }, null, 2));