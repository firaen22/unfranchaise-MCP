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
import { applyKnowledgeEnvSanitize } from './kb/lib/kb-env.js';
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
const misSearch = await kbSearch('BV is 99 for this SKU');
assert.equal(misSearch.length, 0);

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
assert.ok(chunkFailsCommercialGuard(titleOnly), 'commercial in title blocked');
assert.equal(classifyChunkText('本月折扣20'), 'commercial_numeric');

const html = fs.readFileSync('kb/fixtures/mixed-manual.html', 'utf8');
assert.ok(detectCommercialNumeric(html));
assert.ok(detectOrderUrl(html));

// A5 MCP path capture (kb-server uses same helpers)
const op = 'session UNF_CANARY_COOKIE=1 cart snippet';
let cap = captureKnowledgeToolCall('kb_search', { query: 'advertising' }, { operationalContext: op });
assert.equal(cap.isolation.ok, true, 'green: clean tool args');

cap = captureKnowledgeToolCall(
  'kb_search',
  { query: 'leak UNF_CANARY_COOKIE=1' },
  { operationalContext: op },
);
assert.equal(cap.isolation.ok, false, 'red: sentinel in tool args');

cap = captureKnowledgeToolCall(
  'kb_search',
  { query: 'advertising' },
  { operationalContext: 'UNF_COOKIE=leak session cart snippet' },
);
assert.equal(cap.isolation.ok, false, 'red: cookie in generation context');

process.env.UNF_COOKIE = 'secret=1';
applyKnowledgeEnvSanitize();
assert.equal(process.env.UNF_COOKIE, undefined, 'UNF_COOKIE stripped');

console.log('test-kb.mjs: all assertions passed');
fs.rmSync(tmpRoot, { recursive: true, force: true });