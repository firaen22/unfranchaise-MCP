#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mergeObsidianIntoCorpus } from './kb/lib/merge-corpus.js';

const manual = {
  source_id: 'manual_ch15',
  source_type: 'manual_html',
  title: 'ch15',
  locale: 'en',
  sku_ids: [],
  claim_class: 'policy',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'v1',
  url: 'https://example.com/15',
};
const obs = {
  source_id: 'obs_abc',
  source_type: 'obsidian_md',
  vault_rel_path: '02-B2B/x.md',
  title: 'x',
  locale: 'zh',
  sku_ids: [],
  claim_class: 'operator_synthesis',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'vault',
};

const merged = mergeObsidianIntoCorpus(
  [manual, { ...obs, source_id: 'obs_old' }],
  [
    { chunk_id: 'manual#0', source_id: 'manual_ch15', text: 'policy', claim_class: 'policy' },
    { chunk_id: 'obs_old#0', source_id: 'obs_old', text: 'old', claim_class: 'operator_synthesis' },
  ],
  [obs],
  [{ chunk_id: 'obs_abc#0', source_id: 'obs_abc', text: 'new', claim_class: 'operator_synthesis' }],
);

assert.equal(merged.manifest.length, 2);
assert.ok(merged.manifest.some((m) => m.source_id === 'manual_ch15'));
assert.ok(merged.manifest.some((m) => m.source_id === 'obs_abc'));
assert.equal(merged.chunks.length, 2);

console.log('test-kb-merge.mjs: ok');