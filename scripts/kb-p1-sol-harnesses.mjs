#!/usr/bin/env node
/**
 * Gate artifacts for sol A1 (claim-class exclusion) and A6 (version edge).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonl } from '../kb/lib/jsonl.js';
import { rebuildIndex } from '../kb/lib/index-db.js';
import { rebuildIndexHarness } from '../kb/lib/index-harness.js';
import { kbSearch, kbGet } from '../kb/lib/retrieve.js';
import { isForbiddenClaimClass } from '../kb/lib/classify.js';
import { runClassifierOracleFixtures } from '../kb/ingest/oracle-fixtures.js';
import { readJsonl } from '../kb/lib/jsonl.js';
import { getCorpusRoot, getRepoRoot, manifestPath } from '../kb/lib/paths.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

async function isolationFixture() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-p1-a1-'));
  const prev = process.env.UNF_KB_CORPUS;
  process.env.UNF_KB_CORPUS = tmpRoot;
  fs.mkdirSync(path.join(tmpRoot, 'index'), { recursive: true });

  const commercialSource = 'fix_commercial_red';
  const policySource = 'fix_policy_ok';
  const manifestRow = (row) => ({
    product_family: null,
    canonical_for_topic: null,
    duplicate_of_source_id: null,
    ...row,
  });
  const manifest = [
    manifestRow({
      source_id: commercialSource,
      source_type: 'harness',
      title: 'commercial-red',
      locale: 'en',
      sku_ids: [],
      claim_class: 'operator_synthesis',
      status: 'active',
      ingest_allowed: true,
      doc_version: 'test',
    }),
    manifestRow({
      source_id: policySource,
      source_type: 'harness',
      title: 'policy',
      locale: 'en',
      sku_ids: [],
      claim_class: 'operator_synthesis',
      status: 'active',
      ingest_allowed: true,
      doc_version: 'test',
    }),
    manifestRow({
      source_id: 'stale_current',
      source_type: 'harness',
      title: 'current',
      locale: 'en',
      sku_ids: [],
      claim_class: 'operator_synthesis',
      status: 'active',
      ingest_allowed: true,
      doc_version: 'v2',
    }),
    manifestRow({
      source_id: 'stale_obsolete',
      source_type: 'harness',
      title: 'obsolete',
      locale: 'en',
      sku_ids: [],
      claim_class: 'operator_synthesis',
      status: 'active',
      ingest_allowed: true,
      doc_version: 'v1',
      superseded_by: 'stale_current',
    }),
  ];

  const chunks = [
    {
      chunk_id: 'comm_1',
      source_id: commercialSource,
      text: 'BV: 99.0 and HK$ 1,288 promo',
      claim_class: 'commercial_numeric',
      doc_title: 'bad',
      doc_version: 'test',
    },
    {
      chunk_id: 'mislabel_1',
      source_id: commercialSource,
      text: 'BV is 99 for this SKU pitch',
      claim_class: 'operator_synthesis',
      doc_title: 'mislabeled',
      doc_version: 'test',
    },
    {
      chunk_id: 'order_1',
      source_id: commercialSource,
      text: 'Click https://hk.unfranchise.com/Shopping/Cart now',
      claim_class: 'order_url',
      doc_title: 'order',
      doc_version: 'test',
    },
    {
      chunk_id: 'pol_1',
      source_id: policySource,
      text: 'UFO advertising must follow manual chapter 19 guidelines for Hong Kong.',
      claim_class: 'operator_synthesis',
      doc_title: 'ads',
      doc_version: 'test',
    },
    {
      chunk_id: 'cur_1',
      source_id: 'stale_current',
      text: 'Current shipping policy version two applies.',
      claim_class: 'operator_synthesis',
      doc_title: 'cur',
      doc_version: 'v2',
    },
    {
      chunk_id: 'obs_1',
      source_id: 'stale_obsolete',
      text: 'Obsolete shipping policy version one.',
      claim_class: 'operator_synthesis',
      doc_title: 'obs',
      doc_version: 'v1',
    },
  ];

  writeJsonl(path.join(tmpRoot, 'manifest.jsonl'), manifest);
  writeJsonl(path.join(tmpRoot, 'chunks.jsonl'), chunks);
  const stats = await rebuildIndex(tmpRoot);

  const commercialHits = await kbSearch('BV 1288', { corpusRoot: tmpRoot });
  const policyHits = await kbSearch('advertising guidelines', { corpusRoot: tmpRoot });
  const getComm = await kbGet('comm_1', { corpusRoot: tmpRoot });
  const getOrder = await kbGet('order_1', { corpusRoot: tmpRoot });
  const getMis = await kbGet('mislabel_1', { corpusRoot: tmpRoot });
  const getPol = await kbGet('pol_1', { corpusRoot: tmpRoot });
  const getObs = await kbGet('obs_1', { corpusRoot: tmpRoot });
  const getCur = await kbGet('cur_1', { corpusRoot: tmpRoot });
  const obsoleteSearch = await kbSearch('obsolete shipping v1', { corpusRoot: tmpRoot });
  const currentSearch = await kbSearch('shipping policy version two', { corpusRoot: tmpRoot });

  await rebuildIndexHarness(tmpRoot);
  const misSearch = await kbSearch('BV is 99 for this SKU', { corpusRoot: tmpRoot });
  const getMisHarness = await kbGet('mislabel_1', { corpusRoot: tmpRoot });

  if (prev === undefined) delete process.env.UNF_KB_CORPUS;
  else process.env.UNF_KB_CORPUS = prev;
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  return {
    indexed_eligible_only: stats.indexed,
    kb_search_commercial_empty: commercialHits.length === 0,
    kb_search_policy_hits: policyHits.map((h) => h.chunk_id),
    kb_get_comm_null: getComm === null,
    kb_get_order_null: getOrder === null,
    kb_get_mislabel_null: getMis === null,
    kb_get_policy_ok: Boolean(getPol?.text),
    harness_mislabel_in_db_get_blocked: getMisHarness === null,
    harness_mislabel_search_empty: misSearch.length === 0,
    a6_kb_get_obsolete_null: getObs === null,
    a6_kb_get_current_ok: Boolean(getCur?.text),
    a6_search_obsolete_ids: obsoleteSearch.map((h) => h.chunk_id),
    a6_search_current_ids: currentSearch.map((h) => h.chunk_id),
    pass_a1:
      commercialHits.length === 0 &&
      getComm === null &&
      getOrder === null &&
      getMis === null &&
      policyHits.length >= 1,
    a6_search_obsolete_abstain: obsoleteSearch.length === 0,
    pass_a6:
      getObs === null &&
      Boolean(getCur) &&
      obsoleteSearch.length === 0 &&
      !obsoleteSearch.some((h) => h.chunk_id === 'obs_1') &&
      currentSearch.some((h) => h.chunk_id === 'cur_1'),
  };
}

async function oracleFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-oracle-p1-'));
  const prev = process.env.UNF_KB_CORPUS;
  process.env.UNF_KB_CORPUS = tmp;
  fs.mkdirSync(path.join(tmp, 'index'), { recursive: true });
  const oracle = await runClassifierOracleFixtures(tmp, getRepoRoot());
  if (prev === undefined) delete process.env.UNF_KB_CORPUS;
  else process.env.UNF_KB_CORPUS = prev;
  fs.rmSync(tmp, { recursive: true, force: true });
  return oracle;
}

async function productionFreezeScan() {
  const manifest = await readJsonl(manifestPath(getCorpusRoot()));
  const activeForbidden = manifest.filter(
    (r) =>
      r.ingest_allowed === true &&
      r.status === 'active' &&
      isForbiddenClaimClass(r.claim_class),
  );
  const bvProbe = await kbSearch('BV 181 SRP 1288 HK1410 promo price', { limit: 8 });
  return {
    manifest_rows: manifest.length,
    active_forbidden_claim_class_count: activeForbidden.length,
    active_forbidden_source_ids: activeForbidden.map((r) => r.source_id),
    production_search_bv_probe_ids: bvProbe.map((h) => h.chunk_id),
    production_search_bv_probe_empty: bvProbe.length === 0,
  };
}

async function main() {
  const generated_at = new Date().toISOString();
  const isolation = await isolationFixture();
  const oracle = await oracleFixture();
  const production = await productionFreezeScan();

  const a1 = {
    generated_at,
    production_freeze: production,
    classifier_oracle: {
      forbiddenChunkCount: oracle.forbiddenChunkCount,
      pitchRetrieved: oracle.pitchRetrieved,
      commercialSearchEmpty: oracle.commercialSearchEmpty,
      policyHtmlRetrieved: oracle.policyHtmlRetrieved,
      forbiddenGetBlocked: oracle.forbiddenGetBlocked,
      forbiddenSearchBlocked: oracle.forbiddenSearchBlocked,
      flattenedBvClassified: oracle.flattenedBvClassified,
      productionIndexExcludesForbidden: oracle.productionIndexExcludesForbidden,
      independentOraclePass: oracle.independentOraclePass,
      independentOracleFailures: oracle.independentOracleFailures,
    },
    retrieve_guard_fixture: isolation,
    pass:
      isolation.pass_a1 &&
      oracle.forbiddenGetBlocked &&
      oracle.forbiddenSearchBlocked &&
      oracle.commercialSearchEmpty &&
      oracle.independentOraclePass &&
      production.active_forbidden_claim_class_count === 0,
  };

  const a6 = {
    generated_at,
    p1_020_eval_row: 'obsolete shipping v1',
    fixture: {
      kb_get_obsolete_null: isolation.a6_kb_get_obsolete_null,
      kb_get_current_ok: isolation.a6_kb_get_current_ok,
      search_obsolete: isolation.a6_search_obsolete_ids,
      search_obsolete_abstain: isolation.a6_search_obsolete_abstain,
      search_current: isolation.a6_search_current_ids,
      p1_020_dual_version_query: 'current shipping policy version two',
      pass: isolation.pass_a6,
    },
    note: 'Same temp corpus as A1 retrieve guard; obs_1 superseded_by stale_current in manifest',
  };

  fs.writeFileSync(path.join(gate, 'eval-p1-week1-a1-claim-class-harness.json'), `${JSON.stringify(a1, null, 2)}\n`);
  fs.writeFileSync(path.join(gate, 'eval-p1-week1-a6-version-harness.json'), `${JSON.stringify(a6, null, 2)}\n`);
  console.log(JSON.stringify({ a1_pass: a1.pass, a6_pass: a6.fixture.pass }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});