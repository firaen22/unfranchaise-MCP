import fs from 'node:fs';
import path from 'node:path';
import { chunkMarkdown } from '../lib/chunk-markdown.js';
import { classifyChunkText } from '../lib/classify.js';
import { chunkManualHtml } from './manual-html.js';
import { writeJsonl } from '../lib/jsonl.js';
import { rebuildIndex, listIndexedChunkIds } from '../lib/index-db.js';
import { manifestPath, chunksPath } from '../lib/paths.js';
import { assertManifestRow } from '../lib/manifest-schema.js';
import { kbSearch, kbGet } from '../lib/retrieve.js';
import {
  isForbiddenClaimClass,
  chunkFailsCommercialGuard,
  detectCommercialNumeric,
  detectOrderUrl,
} from '../lib/classify.js';

/** Pre-labeled spans — oracle must block even if classifier self-filter would shrink the set. */
export const ORACLE_INDEPENDENT_MUST_BLOCK = [
  { fixture: 'mixed-policy.md', includes: '1,288', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: '批發價：181', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: '超連鎖成本價：181', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV equals 16', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: '業績點數：16', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'IBV percentage of 8.8397', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'PBV: 50', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV: sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'IBV is sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP equals one hundred eighty-one', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP: sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP = sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price = sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Business Volume: sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Business Volume is sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP amounts to sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV points: sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value equals sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP: HKD sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price: minus sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price: £sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'IBV points equal sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP: negative sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV is negative sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV = HKD sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP: a hundred and eighty-one', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP of sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV has a value of sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price: HKD minus sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value: sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP: a thousand', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price = HKD minus sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP totals sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price amounts to minus sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV equals a hundred', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value is HKD sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP amounts to HKD sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price = a hundred', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV = a hundred', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: '售價售價１２８８', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'IBV points are sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price: zero', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV: zero', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP: zero', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP is sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP is a hundred.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP will be sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP is HKD minus sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'BV sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP amounts to a hundred.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP = HKD a hundred', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP equals £sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP:\u200Bsixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP has been set to sixteen.', kind: 'commercial_numeric' },
  {
    fixture: 'mixed-policy.md',
    includes: 'The retail price has been reduced to sixteen Hong Kong dollars.',
    kind: 'commercial_numeric',
  },
  { fixture: 'mixed-policy.md', includes: 'BV points = sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value = sixteen', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP is at least sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Wholesale price is sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Wholesale cost: sixteen', kind: 'commercial_numeric' },
  {
    fixture: 'mixed-policy.md',
    includes: 'Wholesale cost of HKD sixteen.',
    kind: 'commercial_numeric',
  },
  { fixture: 'mixed-policy.md', includes: 'Discount: twenty percent.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Discount is twenty percent.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Discount is 20%', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Sixteen IBV per bottle.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP is listed as sixteen.', kind: 'commercial_numeric' },
  {
    fixture: 'mixed-policy.md',
    includes: 'The bottle is priced at sixteen Hong Kong dollars.',
    kind: 'commercial_numeric',
  },
  {
    fixture: 'mixed-policy.md',
    includes: 'The bottle is priced at 181 Hong Kong dollars.',
    kind: 'commercial_numeric',
  },
  { fixture: 'mixed-policy.md', includes: 'This item earns sixteen IBV.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'This SKU has sixteen IBV.', kind: 'commercial_numeric' },
  {
    fixture: 'mixed-policy.md',
    includes: 'This product costs 181 Hong Kong dollars per bottle.',
    kind: 'commercial_numeric',
  },
  { fixture: 'mixed-policy.md', includes: 'Discount: 20%', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Discount: 20 percent.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'The bottle costs £16.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'The bottle costs sixteen pounds.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'The bottle costs 16 pounds.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'The bottle sells for sixteen pounds.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP ranges from sixteen to twenty.', kind: 'commercial_numeric' },
  {
    fixture: 'mixed-policy.md',
    includes: 'Save twenty percent on this product.',
    kind: 'commercial_numeric',
  },
  {
    fixture: 'mixed-policy.md',
    includes: 'The recommended retail price per bottle for customers in Hong Kong is sixteen.',
    kind: 'commercial_numeric',
  },
  {
    fixture: 'mixed-policy.md',
    includes: 'Manage recurring orders: /index.cfm?action=orders.unfManageUniversalAuto',
    kind: 'order_url',
  },
  { fixture: 'mixed-policy.md', includes: 'This product sells for sixteen.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP of a hundred', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP costs sixteen.', kind: 'commercial_numeric' },
  {
    fixture: 'mixed-policy.md',
    includes: 'This product costs sixteen Hong Kong dollars per bottle.',
    kind: 'commercial_numeric',
  },
  {
    fixture: 'mixed-policy.md',
    includes: 'This product costs twenty-one Hong Kong dollars per unit.',
    kind: 'commercial_numeric',
  },
  { fixture: 'mixed-policy.md', includes: 'This item earns twenty-one IBV.', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price is zero.', kind: 'commercial_numeric' },
  ...[
    'SRP amounts to 181', 'Price totals -29.99', 'BV comes to 0', '售價每瓶181元',
    'SRP: one hundred eighty-one Hong Kong dollars.',
    'IBV was 16', 'UC were -0.5',
    'PBV allocation on the current official schedule 50',
    '0 allocated units contribute toward GBV',
    'PIBV one two three four five six 16',
    '業績點數為１６', '獎勵業績點數本次為0', '16 是本次業績點數',
  ].map((includes) => ({ fixture: 'mixed-policy.md', includes, kind: 'commercial_numeric' })),
  { fixture: 'mixed-policy.md', includes: 'Price equals 181', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value is 181', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value equals 181', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'SRP value of 181', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'Price (USD): 29.99', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'IBV points equal 16', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: '### HK1410', kind: 'commercial_numeric' },
  { fixture: 'mixed-policy.md', includes: 'shopglobal.com/alice', kind: 'order_url' },
  { fixture: 'mixed-manual.html', includes: 'Shopping/Cart', kind: 'order_url' },
  { fixture: 'mixed-manual.html', includes: 'orders.unfBillShip', kind: 'order_url' },
  { fixture: 'mixed-manual.html', includes: 'orders.productReorder', kind: 'order_url' },
  { fixture: 'mixed-manual.html', includes: 'autoship.unfAutoShip', kind: 'order_url' },
  { fixture: 'mixed-manual.html', includes: 'BV | 12.5', kind: 'commercial_numeric' },
];

function oracleSpanDetectionHaystack(chunkText, includes) {
  const lines = chunkText.split('\n');
  const idx = lines.findIndex((ln) => ln.includes(includes));
  if (idx < 0) return includes;
  const block = [];
  for (let j = Math.max(0, idx - 3); j < idx; j++) {
    const t = lines[j].trim();
    if (/^#{1,6}\s/.test(t)) block.push(lines[j]);
  }
  block.push(lines[idx]);
  for (let j = idx + 1; j < Math.min(lines.length, idx + 6); j++) {
    const t = lines[j].trim();
    if (t.startsWith('##')) break;
    if (t) block.push(lines[j]);
  }
  return block.join('\n');
}

function independentSpanDetects(rule, chunkText) {
  const includes = rule.includes;
  if (rule.kind === 'order_url') {
    if (detectOrderUrl(includes)) return true;
    const line = chunkText.split('\n').find((ln) => ln.includes(includes)) ?? '';
    if (line && detectOrderUrl(line)) return true;
    if (line && /^#{1,6}\s/.test(line.trim())) {
      return detectOrderUrl(oracleSpanDetectionHaystack(chunkText, includes));
    }
    return false;
  }
  if (detectCommercialNumeric(includes)) return true;
  const line = chunkText.split('\n').find((ln) => ln.includes(includes)) ?? '';
  if (line && detectCommercialNumeric(line)) return true;
  if (line && /^#{1,6}\s/.test(line.trim())) {
    return detectCommercialNumeric(oracleSpanDetectionHaystack(chunkText, includes));
  }
  return false;
}

/** Labeled spans that only trigger inside fixture line/table/heading context (not on bare `includes`). */
export const ORACLE_REQUIRES_CHUNK_CONTEXT = new Set([
  '1,288',
  '### HK1410',
  'Shopping/Cart',
]);

const ORACLE_INDEPENDENT_MUST_ALLOW = [
  'Glossary: the SRP field in the compensation plan is defined without quoting live amounts.',
  'Appendix: PIBV one two three four five six seven 16.',
];

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

  const independentFailures = [];
  for (const rule of ORACLE_INDEPENDENT_MUST_BLOCK) {
    const matching = chunks.filter((c) => c.text.includes(rule.includes));
    if (!matching.length) {
      independentFailures.push(`missing_span:${rule.fixture}:${rule.includes}`);
      continue;
    }
    const spanBlocked = matching.some((c) => independentSpanDetects(rule, c.text));
    if (!spanBlocked) {
      independentFailures.push(`span_detector_miss:${rule.fixture}:${rule.includes}`);
    }
    for (const c of matching) {
      const classified =
        rule.kind === 'order_url'
          ? detectOrderUrl(c.text) || c.claim_class === 'order_url'
          : detectCommercialNumeric(c.text) ||
            c.claim_class === 'commercial_numeric' ||
            chunkFailsCommercialGuard(c);
      const getBlocked = (await kbGet(c.chunk_id, { corpusRoot })) === null;
      const searchTok = rule.includes.replace(/[<>,]/g, ' ').split(/\s+/).find((t) => t.length > 3) ?? rule.includes;
      const hits = await kbSearch(searchTok, { corpusRoot, limit: 12 });
      const searchBlocked = !hits.some((h) => h.chunk_id === c.chunk_id);
      if (!classified) independentFailures.push(`classifier_miss:${c.chunk_id}:${rule.kind}`);
      if (!getBlocked) independentFailures.push(`get_leak:${c.chunk_id}`);
      if (!searchBlocked) independentFailures.push(`search_leak:${c.chunk_id}`);
    }
  }

  const indexedIds = new Set(listIndexedChunkIds(corpusRoot));
  for (const span of ORACLE_INDEPENDENT_MUST_ALLOW) {
    const matching = chunks.filter((c) => c.text.includes(span));
    if (!matching.length) independentFailures.push(`missing_benign_span:${span}`);
    for (const c of matching) {
      const hits = await kbSearch(span.split(':')[0], { corpusRoot, limit: 12 });
      if (detectCommercialNumeric(c.text) || !indexedIds.has(c.chunk_id) ||
          (await kbGet(c.chunk_id, { corpusRoot })) === null ||
          !hits.some((hit) => hit.chunk_id === c.chunk_id)) {
        independentFailures.push(`benign_span_blocked:${c.chunk_id}`);
      }
    }
  }
  const indexedForbidden = [];
  for (const c of forbiddenChunks) {
    if (indexedIds.has(c.chunk_id)) {
      indexedForbidden.push(c.chunk_id);
      independentFailures.push(`indexed_forbidden:${c.chunk_id}`);
    }
  }
  const productionIndexExcludesForbidden =
    indexedForbidden.length === 0 && forbiddenChunks.length > 0;

  return {
    stats,
    forbiddenChunkCount: forbiddenChunks.length,
    pitchRetrieved: pitchHit.length > 0,
    commercialSearchEmpty: priceHit.length === 0,
    policyHtmlRetrieved: bvHit.length > 0,
    flattenedBvClassified,
    forbiddenGetBlocked: forbiddenGets.every((x) => x === false),
    forbiddenSearchBlocked: forbiddenSearchBlocked.every((x) => x === false),
    indexedForbiddenChunkIds: indexedForbidden,
    productionIndexExcludesForbidden,
    independentOraclePass: independentFailures.length === 0,
    independentOracleFailures: independentFailures,
  };
}
