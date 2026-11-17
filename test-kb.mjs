#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyChunkText, detectCommercialNumeric, detectOrderUrl } from './kb/lib/classify.js';
import { writeJsonl } from './kb/lib/jsonl.js';
import { rebuildIndex } from './kb/lib/index-db.js';
import { rebuildIndexHarness } from './kb/lib/index-harness.js';
import { kbSearch, kbGet } from './kb/lib/retrieve.js';
import { assertKnowledgeIsolation } from './kb/lib/canary.js';
import { captureKnowledgeToolCall } from './kb/lib/kb-tool-capture.js';
import { applyKnowledgeEnvSanitize, sanitizeKnowledgeEnv } from './kb/lib/kb-env.js';
import { runClassifierOracleFixtures } from './kb/ingest/oracle-fixtures.js';
import { getRepoRoot } from './kb/lib/paths.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-test-'));
process.env.UNF_KB_CORPUS = tmpRoot;
fs.mkdirSync(path.join(tmpRoot, 'index'), { recursive: true });

const commercialSource = 'fix_commercial_red';
const policySource = 'fix_policy_ok';

const manifest = [
  {
    source_id: commercialSource,
    source_type: 'harness',
    title: 'commercial-red',
    locale: 'en',
    sku_ids: [],
    claim_class: 'operator_synthesis',
    status: 'active',
    ingest_allowed: true,
    doc_version: 'test',
    product_family: null,
    canonical_for_topic: null,
    duplicate_of_source_id: null,
  },
  {
    source_id: policySource,
    source_type: 'harness',
    title: 'policy',
    locale: 'en',
    sku_ids: [],
    claim_class: 'operator_synthesis',
    status: 'active',
    ingest_allowed: true,
    doc_version: 'test',
    product_family: null,
    canonical_for_topic: null,
    duplicate_of_source_id: null,
  },
  {
    source_id: 'stale_current',
    source_type: 'harness',
    title: 'current',
    locale: 'en',
    sku_ids: [],
    claim_class: 'operator_synthesis',
    status: 'active',
    ingest_allowed: true,
    doc_version: 'v2',
    superseded_by: null,
    product_family: null,
    canonical_for_topic: null,
    duplicate_of_source_id: null,
  },
  {
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
    product_family: null,
    canonical_for_topic: null,
    duplicate_of_source_id: null,
  },
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
    chunk_id: 'mislabel_zh_1',
    source_id: commercialSource,
    text: 'Outlet pitch. 會員價：181',
    claim_class: 'operator_synthesis',
    doc_title: 'mislabeled zh price',
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
    chunk_id: 'ver_bad',
    source_id: policySource,
    text: 'Version mismatch policy note.',
    claim_class: 'operator_synthesis',
    doc_title: 'ver',
    doc_version: 'stale-ver',
  },
  {
    chunk_id: 'unk_1',
    source_id: policySource,
    text: 'Unknown class row',
    claim_class: 'unknown',
    doc_title: 'unk',
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
assert.equal(stats.indexed, 2, 'only policy + current stale indexed');

assert.equal(await kbGet('obs_1'), null, 'superseded manifest rejected');

const obsoleteOnlySearch = await kbSearch('obsolete shipping v1');
assert.equal(obsoleteOnlySearch.length, 0, 'obsolete-only query abstains');
const currentVersionSearch = await kbSearch('current shipping policy version two');
assert.ok(
  currentVersionSearch.some((h) => h.chunk_id === 'cur_1'),
  'dual-version query returns current chunk',
);

const commercialHits = await kbSearch('BV 1288');
assert.equal(commercialHits.length, 0, 'commercial not searchable');

const policyHits = await kbSearch('advertising guidelines');
assert.ok(policyHits.length >= 1, 'policy searchable');

assert.equal(await kbGet('comm_1'), null);
assert.equal(await kbGet('order_1'), null);
assert.equal(await kbGet('mislabel_1'), null, 'mis-tagged commercial blocked at retrieve');
assert.equal(await kbGet('unk_1'), null);
assert.equal(await kbGet('ver_bad'), null, 'doc_version mismatch rejected');
const got = await kbGet('pol_1');
assert.ok(got?.text.includes('advertising'));

// Harness: deliberately index forbidden rows; retrieval still blocks (§7.1)
await rebuildIndexHarness(tmpRoot);
assert.equal(await kbGet('mislabel_1'), null, 'mislabel in DB but retrieve blocks');
assert.equal(await kbGet('mislabel_zh_1'), null, 'mislabel zh colon price blocked at retrieve');
const misSearch = await kbSearch('BV is 99 for this SKU');
assert.equal(misSearch.length, 0);
const misZhSearch = await kbSearch('會員價');
assert.equal(misZhSearch.length, 0, 'mislabel zh price not searchable');

// Classifier oracle through real ingest
const oracleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-oracle-'));
const oracle = await runClassifierOracleFixtures(oracleRoot, getRepoRoot());
assert.ok(oracle.pitchRetrieved, 'md policy pitch retrievable');
assert.ok(oracle.commercialSearchEmpty, 'price table not searchable');
assert.ok(oracle.policyHtmlRetrieved, 'html policy retrievable');
assert.ok(oracle.forbiddenGetBlocked, 'forbidden chunks blocked on get');
assert.ok(oracle.forbiddenSearchBlocked, 'forbidden chunks blocked on search');
assert.ok(oracle.flattenedBvClassified, 'flattened manual table rows classified commercial');
assert.ok(oracle.productionIndexExcludesForbidden, 'production index skips forbidden set');
assert.ok(oracle.independentOraclePass, `independent oracle: ${oracle.independentOracleFailures?.join(', ')}`);
fs.rmSync(oracleRoot, { recursive: true, force: true });

// Defense-in-depth classification (sol P2)
assert.equal(classifyChunkText('Price: $29.99 only'), 'commercial_numeric');
assert.equal(classifyChunkText('Price: 29.99 only'), 'commercial_numeric');
assert.equal(classifyChunkText('BV = 99'), 'commercial_numeric');
assert.equal(classifyChunkText('BV is 99'), 'commercial_numeric');
assert.equal(classifyChunkText('SRP is 1288'), 'commercial_numeric');
assert.equal(classifyChunkText('Price is 29.99'), 'commercial_numeric');
assert.equal(classifyChunkText('BV99'), 'commercial_numeric');
assert.ok(detectOrderUrl('https://marketHongkong.com.hk/checkout'));
assert.equal(classifyChunkText('Price = 29.99'), 'commercial_numeric');
assert.ok(detectOrderUrl('Order here: https://hk.unfranchise.com/'));
assert.ok(detectOrderUrl('hk.unfranchise.com/Shopping/Cart'));
assert.equal(classifyChunkText('產品 港元 1288'), 'commercial_numeric');
assert.equal(classifyChunkText('售價：1288'), 'commercial_numeric');
assert.equal(classifyChunkText('SRP of 1288'), 'commercial_numeric');
assert.ok(detectCommercialNumeric('20% discount today'));
assert.ok(detectCommercialNumeric('BV | 12.5'));

const titleOnly = { doc_title: 'BV 99 wholesale', text: 'Pitch only.' };
const { chunkFailsCommercialGuard } = await import('./kb/lib/classify.js');
const { chunkRetrievalEligible } = await import('./kb/lib/eligibility.js');
assert.ok(chunkFailsCommercialGuard(titleOnly), 'commercial in title blocked');

import { validateManifestRow } from './kb/lib/manifest-schema.js';
const poisonedManifest = validateManifestRow({
  source_id: 'https://hk.unfranchise.com/index.cfm?action=shopping.unfOrdering',
  source_type: 'harness',
  title: 'policy',
  locale: 'en',
  sku_ids: [],
  product_family: null,
  canonical_for_topic: null,
  duplicate_of_source_id: null,
  claim_class: 'policy',
  status: 'active',
  ingest_allowed: true,
  doc_version: 't',
});
assert.equal(poisonedManifest.ok, false, 'order URL in source_id rejected');
assert.ok(
  chunkFailsCommercialGuard(
    { chunk_id: 'benign_1', text: 'Advertising policy summary.', claim_class: 'policy', doc_version: 't' },
    { source_id: 'https://hk.unfranchise.com/index.cfm?action=shopping.unfOrdering', title: 'policy' },
  ),
  'poisoned source_id blocks retrieval',
);
assert.ok(
  chunkFailsCommercialGuard(
    { text: 'Pitch only.', claim_class: 'operator_synthesis' },
    { title: 'BV 99' },
  ),
  'manifest title commercial when chunk doc_title empty',
);
assert.equal(
  chunkRetrievalEligible(
    {
      source_id: policySource,
      ingest_allowed: true,
      status: 'active',
      title: 'BV 99',
      claim_class: 'operator_synthesis',
      doc_version: 'test',
    },
    {
      chunk_id: 'manifest_title_bad',
      source_id: policySource,
      text: 'Pitch only.',
      claim_class: 'operator_synthesis',
      doc_version: 'test',
    },
  ),
  false,
  'eligibility rejects manifest title commercial fallback',
);
assert.ok(
  chunkFailsCommercialGuard(
    { doc_title: 'Retail note', text: 'Harmless policy prose.', claim_class: 'operator_synthesis' },
    { title: 'SRP: +181' },
  ),
  'commercial manifest title blocked even when chunk doc_title is benign',
);
assert.equal(classifyChunkText('Price: -29.99 only'), 'commercial_numeric');
assert.ok(detectCommercialNumeric('{"ibvPoints":"1e2"}'));
assert.equal(classifyChunkText('本月折扣20'), 'commercial_numeric');
assert.equal(classifyChunkText('Retail price (HKD): 181'), 'commercial_numeric');
assert.equal(classifyChunkText('bvPoints 16 ibvPoints null'), 'commercial_numeric');
assert.equal(classifyChunkText('retailTotalHkd: 181'), 'commercial_numeric');
assert.equal(classifyChunkText('Business Volume is 16'), 'commercial_numeric');
assert.equal(
  classifyChunkText('PC link http://www.marketHongkong.com.hk/alice'),
  'order_url',
);

const html = fs.readFileSync('kb/fixtures/mixed-manual.html', 'utf8');
assert.ok(detectCommercialNumeric(html));
assert.ok(detectOrderUrl(html));

// A5 MCP path capture (kb-server uses same helpers)
let cap = captureKnowledgeToolCall(
  'kb_search',
  { query: 'advertising' },
  { operationalContext: 'prior turn: advertising policy only' },
);
assert.equal(cap.isolation.ok, true, 'green: clean host context');

const op = 'session UNF_CANARY_COOKIE=1 cart snippet';
cap = captureKnowledgeToolCall('kb_search', { query: 'advertising' }, { operationalContext: op });
assert.equal(cap.isolation.ok, false, 'red: §7.1 poisoned host context');

cap = captureKnowledgeToolCall(
  'kb_search',
  { query: 'leak UNF_CANARY_COOKIE=1' },
  { operationalContext: 'prior turn: advertising policy only' },
);
assert.equal(cap.isolation.ok, false, 'red: sentinel in tool args');

cap = captureKnowledgeToolCall(
  'kb_search',
  { query: 'advertising' },
  { operationalContext: 'UNF_COOKIE=leak session cart snippet' },
);
assert.equal(cap.isolation.ok, false, 'red: cookie in generation context');

const bvCitationJson = JSON.stringify({
  chunk_id: 'manual_ch_25_8a3fd765#1',
  doc_title: 'Definitions',
  doc_version: 'manual-0.4',
  text: 'Business Volume (BV): The numeric value assigned to products and services, which accumulates toward the pay out of commission.',
});
const bvHistoryGreen = assertKnowledgeIsolation({
  operationalContext: `prior kb_get citation: ${bvCitationJson}`,
  knowledgePayload: JSON.stringify({ tool: 'kb_search', arguments: { query: 'advertising', limit: 3 } }),
  knowledgeUserPayload: 'advertising',
});
assert.equal(
  bvHistoryGreen.ok,
  true,
  'green: BV citation + manual-0.4 metadata not proximity-flagged in generation context',
);
const proseCommercialRed = assertKnowledgeIsolation({
  operationalContext: 'user asked: retail SRP is 181 today',
  knowledgePayload: JSON.stringify({ tool: 'kb_search', arguments: { query: 'policy', limit: 3 } }),
  knowledgeUserPayload: 'policy',
});
assert.equal(proseCommercialRed.ok, false, 'red: commercial prose in generation context still blocked');

process.env.UNF_COOKIE = 'secret=1';
applyKnowledgeEnvSanitize();
assert.equal(process.env.UNF_COOKIE, undefined, 'UNF_COOKIE stripped');

const allowlisted = sanitizeKnowledgeEnv({
  PATH: '/bin',
  HTTP_COOKIE: 'CFID=1',
  UNF_KB_OP_CONTEXT: 'summary',
  SECRET_API_KEY: 'nope',
});
assert.equal(allowlisted.HTTP_COOKIE, undefined, 'HTTP_COOKIE not in kb allowlist');
assert.equal(allowlisted.SECRET_API_KEY, undefined, 'unknown secret keys stripped');
assert.equal(allowlisted.UNF_KB_OP_CONTEXT, 'summary', 'UNF_KB_OP_CONTEXT retained');
assert.equal(
  sanitizeKnowledgeEnv({ UNF_KB_COOKIE: 'CFID=1', UNF_KB_OP_CONTEXT: 'ok' }).UNF_KB_COOKIE,
  undefined,
  'UNF_KB_COOKIE not allowlisted',
);

console.log('test-kb.mjs: all assertions passed');
fs.rmSync(tmpRoot, { recursive: true, force: true });