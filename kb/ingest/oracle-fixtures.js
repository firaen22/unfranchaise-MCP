import fs from 'node:fs';
import path from 'node:path';
import { chunkMarkdown } from '../lib/chunk-markdown.js';
import { classifyChunkText } from '../lib/classify.js';
import { chunkManualHtml } from './manual-html.js';
import { writeJsonl } from '../lib/jsonl.js';
import { rebuildIndex } from '../lib/index-db.js';
import { manifestPath, chunksPath } from '../lib/paths.js';
import { assertManifestRow } from '../lib/manifest-schema.js';
import { kbSearch, kbGet } from '../lib/retrieve.js';
import { isForbiddenClaimClass, chunkFailsCommercialGuard, detectCommercialNumeric } from '../lib/classify.js';

/**
 * Run plan §7.1 (A) md + (B) html fixtures through ingest → index → search/get.
 */
export async function runClassifierOracleFixtures(corpusRoot, repoRoot) {
  const mdPath = path.join(repoRoot, 'kb/fixtures/mixed-policy.md');
  const htmlPath = path.join(repoRoot, 'kb/fixtures/mixed-manual.html');
  const md = fs.readFileSync(mdPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const manifest = [];
  const chunks = [];

  const mdSource = 'oracle_mixed_md';
  manifest.push(
    assertManifestRow({
      source_id: mdSource,
      source_type: 'obsidian_md',
      vault_rel_path: 'fixtures/mixed-policy.md',
      title: 'mixed-policy',
      locale: 'en',
      product_family: null,
      sku_ids: [],
      canonical_for_topic: null,
      duplicate_of_source_id: null,
      claim_class: 'operator_synthesis',
      status: 'active',
      ingest_allowed: true,
      doc_version: 'oracle',
    }),
  );

  chunkMarkdown(md, { docTitle: 'mixed-policy' }).forEach((sec, i) => {
    const claimClass = classifyChunkText(sec.text, { defaultClass: 'operator_synthesis' });
    chunks.push({
      chunk_id: `${mdSource}#${i}`,
      source_id: mdSource,
      text: sec.text,
      claim_class: claimClass,
      doc_title: sec.heading,
      doc_version: 'oracle',
    });
  });

  const htmlSource = 'oracle_mixed_html';
  manifest.push(
    assertManifestRow({
      source_id: htmlSource,
      source_type: 'manual_html',
      url: 'file://fixtures/mixed-manual.html',
      title: 'mixed-manual',
      locale: 'en',
      product_family: null,
      sku_ids: [],
      canonical_for_topic: null,
      duplicate_of_source_id: null,
      claim_class: 'policy',
      status: 'active',
      ingest_allowed: true,
      doc_version: 'oracle',
    }),
  );

  chunkManualHtml(html, { docTitle: 'mixed-manual' }).forEach((sec, i) => {
    chunks.push({
      chunk_id: `${htmlSource}#${i}`,
      source_id: htmlSource,
      text: sec.text,
      claim_class: sec.claim_class,
      doc_title: sec.heading,
      doc_version: 'oracle',
    });
  });

  writeJsonl(manifestPath(corpusRoot), manifest);
  writeJsonl(chunksPath(corpusRoot), chunks);
  const stats = await rebuildIndex(corpusRoot);

  const forbiddenChunks = chunks.filter(
    (c) => isForbiddenClaimClass(c.claim_class) || chunkFailsCommercialGuard(c),
  );
  const pitchHit = await kbSearch('advertising guidelines', { corpusRoot, limit: 5 });
  const priceHit = await kbSearch('DEMO 1288', { corpusRoot, limit: 5 });
  const bvHit = await kbSearch('Wholesale members shipping', { corpusRoot, limit: 5 });

  const flattenedRows = chunkManualHtml(html).map((r) => r.text);
  const flattenedBvClassified = flattenedRows.some(
    (t) => t.includes('BV') && detectCommercialNumeric(t),
  );

  const forbiddenGets = [];
  const forbiddenSearchBlocked = [];
  for (const c of forbiddenChunks) {
    forbiddenGets.push((await kbGet(c.chunk_id, { corpusRoot })) !== null);
    const token = c.text.split(/\s+/).slice(0, 4).join(' ').slice(0, 32);
    if (token) {
      const hits = await kbSearch(token, { corpusRoot, limit: 10 });
      forbiddenSearchBlocked.push(
        hits.some((h) => h.chunk_id === c.chunk_id),
      );
    }
  }

  return {
    stats,
    forbiddenChunkCount: forbiddenChunks.length,
    pitchRetrieved: pitchHit.length > 0,
    commercialSearchEmpty: priceHit.length === 0,
    policyHtmlRetrieved: bvHit.length > 0,
    flattenedBvClassified,
    forbiddenGetBlocked: forbiddenGets.every((x) => x === false),
    forbiddenSearchBlocked: forbiddenSearchBlocked.every((x) => x === false),
    productionIndexExcludesForbidden: stats.indexed <= chunks.length - forbiddenChunks.length,
  };
}