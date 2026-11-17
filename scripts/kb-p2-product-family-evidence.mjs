#!/usr/bin/env node
/** A6 wrong-product-family evidence (plan §6 / eval p1-019). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonl } from '../kb/lib/jsonl.js';
import { chunksPath, manifestPath } from '../kb/lib/paths.js';
import { assertManifestRow } from '../kb/lib/manifest-schema.js';
import { rebuildIndex } from '../kb/lib/index-db.js';
import { kbSearch, kbGet } from '../kb/lib/retrieve.js';
import { detectKbSearchBlockedQuery } from '../kb/lib/classify.js';
import { runKbSearch } from '../kb/lib/kb-search-run.js';
import { readEvalCsv } from '../kb/lib/eval-csv.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-family-'));
const prev = process.env.UNF_KB_CORPUS;
process.env.UNF_KB_CORPUS = tmp;
const us = assertManifestRow({
  source_id: 'harness_isotonix_us',
  source_type: 'harness',
  title: 'Isotonix US consumer',
  locale: 'en',
  product_family: 'isotonix_us_consumer',
  sku_ids: [],
  canonical_for_topic: null,
  duplicate_of_source_id: null,
  claim_class: 'operator_synthesis',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'harness-v1',
});
const hk = assertManifestRow({
  source_id: 'harness_hk_manual',
  source_type: 'harness',
  title: 'HK UFO policy',
  locale: 'en',
  product_family: 'hk_unfranchise',
  sku_ids: [],
  canonical_for_topic: null,
  duplicate_of_source_id: null,
  claim_class: 'policy',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'harness-v1',
});
const usChunk = {
  chunk_id: 'us_iso#0',
  source_id: us.source_id,
  text: 'Isotonix OPC-3 US shop.com consumer storefront scope; wrong product family for HK MCP numeric answers.',
  claim_class: 'operator_synthesis',
  doc_title: 'US storefront',
  doc_version: 'harness-v1',
};
const hkChunk = {
  chunk_id: 'hk_pol#0',
  source_id: hk.source_id,
  text: 'Hong Kong UnFranchise manual policy: do not cite US consumer storefront numbers for HK MCP.',
  claim_class: 'policy',
  doc_title: 'HK scope',
  doc_version: 'harness-v1',
};
writeJsonl(manifestPath(tmp), [us, hk]);
writeJsonl(chunksPath(tmp), [usChunk, hkChunk]);
await rebuildIndex(tmp);

const query = 'What is the BV of Isotonix on the US shop.com consumer site?';
const trapBlocked = detectKbSearchBlockedQuery(query);
const trapHits = await kbSearch(query, { corpusRoot: tmp, limit: 8 });
const runKbTrap = await runKbSearch(query, { limit: 8, corpusRoot: tmp });
const ftsProbeHits = await kbSearch('Isotonix shop.com BV', { corpusRoot: tmp, limit: 8 });
const usGet = await kbGet('us_iso#0', { corpusRoot: tmp });
const hkGet = await kbGet('hk_pol#0', { corpusRoot: tmp });

const { rows } = readEvalCsv(path.join(gate, 'eval-p1-week1-scored.csv'));
const p19 = rows.find((r) => r.id === 'p1-019');

if (prev === undefined) delete process.env.UNF_KB_CORPUS;
else process.env.UNF_KB_CORPUS = prev;

const out = {
  generated_at: new Date().toISOString(),
  method:
    'p1-019 trap query blocked by detectKbSearchBlockedQuery; direct kb_get still returns labeled non-commercial harness text',
  harness_corpus: tmp,
  p1_019_trap_query: query,
  detectKbSearchBlockedQuery: trapBlocked,
  kb_search_trap_hits: trapHits.map((h) => h.chunk_id),
  runKbSearch_trap: {
    hits: runKbTrap.hits?.map((h) => h.chunk_id) ?? [],
    empty: !runKbTrap.hits?.length,
  },
  fts_probe_query: 'Isotonix shop.com BV',
  fts_probe_hits: ftsProbeHits.map((h) => h.chunk_id),
  us_chunk: {
    chunk_id: usChunk.chunk_id,
    claim_class: usChunk.claim_class,
    text_prefix: usChunk.text.slice(0, 120),
    kb_get_ok: usGet !== null,
  },
  hk_family_chunk_retrievable: hkGet !== null,
  host_rule:
    'wrong-family rows must not cite KB numeric/commercial evidence; use MCP scope abstain (p1-019)',
  p1_019: {
    category: p19?.category,
    pass_fail: p19?.pass_fail,
    cited_chunk_ids: p19?.cited_chunk_ids ?? '',
    observed_outcome: p19?.observed_outcome,
    kb_cite_empty: !(p19?.cited_chunk_ids ?? '').trim(),
    abstains_out_of_family: /out of HK MCP family|scope abstain/i.test(p19?.observed_outcome ?? ''),
  },
  pass:
    trapBlocked &&
    trapHits.length === 0 &&
    !(runKbTrap.hits?.length) &&
    p19?.pass_fail === 'pass' &&
    !(p19?.cited_chunk_ids ?? '').trim() &&
    /out of HK MCP family|scope abstain/i.test(p19?.observed_outcome ?? ''),
};

fs.writeFileSync(
  path.join(gate, 'eval-p2-product-family-wrong-family.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ written: 'eval-p2-product-family-wrong-family.json', pass: out.pass }, null, 2));
if (!out.pass) process.exit(1);