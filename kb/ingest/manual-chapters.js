import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import {
  getCorpusRoot,
  ensureCorpusDirs,
  manifestPath,
  chunksPath,
} from '../lib/paths.js';
import { readJsonl, writeJsonl } from '../lib/jsonl.js';
import { classifyChunkText, detectCommercialNumeric } from '../lib/classify.js';
import { assertManifestRow } from '../lib/manifest-schema.js';
import { mergeManualIntoCorpus } from '../lib/merge-corpus.js';
import { rebuildIndex } from '../lib/index-db.js';
import { chunkManualHtml } from './manual-html.js';

const MANUAL_BASE = 'https://hkg-eng.documents.unfranchise.com';

/** Plan 0.4 starter set — DOCUMENTS.md */
export const MANUAL_CHAPTERS_04 = [
  { chapter: '15', slug: '/chapter-15-product-ordering-procedures-and-policies/', title: 'Product ordering' },
  { chapter: '16', slug: '/chapter-16-product-sales-and-distribution/', title: 'Sales & distribution' },
  { chapter: '19', slug: '/chapter-19-advertising-and-promotion/', title: 'Advertising' },
  { chapter: '20', slug: '/chapter-20-internet-and-webcenter-policies/', title: 'Internet / WebCenter' },
  { chapter: '22', slug: '/chapter-22-preferred-customer-program-policies-and-procedures/', title: 'PC program' },
  { chapter: '25', slug: '/chapter-25-key-definitions-and-terminology/', title: 'Definitions' },
];

function sanitizeDefinitionText(text) {
  const lines = text.split('\n').filter((line) => !detectCommercialNumeric(line));
  return lines.join('\n').trim();
}

function stableManualId(chapter, slug) {
  return `manual_ch_${chapter}_${crypto.createHash('sha256').update(slug).digest('hex').slice(0, 8)}`;
}

export function chunkManualPageHtml(html, { docTitle = 'manual', chapter = '' } = {}) {
  const $ = cheerio.load(html);
  const main = $('article, main, .content, #content, body').first();
  const scope = main.length ? main : $('body');
  const chunks = [];
  let buf = [];
  let heading = docTitle;

  const flush = () => {
    const text = buf.join('\n').trim();
    if (!text) return;
    const blob = `${heading}\n${text}`;
    const claimClass = classifyChunkText(blob, { defaultClass: 'policy' });
    chunks.push({
      heading: `${chapter ? `ch${chapter} ` : ''}${heading}`,
      text: blob,
      claim_class: claimClass,
    });
    buf = [];
  };

  scope.find('h1, h2, h3, h4, p, table, li').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const piece = $(el).text().replace(/\s+/g, ' ').trim();
    if (!piece) return;
    if (tag?.startsWith('h')) {
      flush();
      heading = piece;
    } else if (tag === 'table') {
      flush();
      const tableChunks = chunkManualHtml(`<table>${$(el).html()}</table>`, { docTitle: heading });
      chunks.push(...tableChunks);
    } else {
      buf.push(piece);
    }
  });
  flush();

  if (chunks.length === 0) {
    return chunkManualHtml(html, { docTitle });
  }
  return chunks;
}

export async function fetchManualChapter(url, { timeoutMs = 60_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'unfranchaise-kb-ingest/0.4 (operator local)' },
    });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function ingestManualChapters04({
  corpusRoot = getCorpusRoot(),
  docVersion = 'manual-0.4',
  cacheRaw = true,
} = {}) {
  ensureCorpusDirs(corpusRoot);
  const priorManifest = await readJsonl(manifestPath(corpusRoot));
  const priorChunks = await readJsonl(chunksPath(corpusRoot));
  const rawDir = path.join(corpusRoot, 'raw', 'manual');

  const manifest = [];
  const chunks = [];

  for (const ch of MANUAL_CHAPTERS_04) {
    const url = `${MANUAL_BASE}${ch.slug}`;
    const sourceId = stableManualId(ch.chapter, ch.slug);
    const html = await fetchManualChapter(url);

    if (cacheRaw) {
      fs.mkdirSync(rawDir, { recursive: true });
      fs.writeFileSync(path.join(rawDir, `ch-${ch.chapter}.html`), html, 'utf8');
    }

    manifest.push(
      assertManifestRow({
        source_id: sourceId,
        source_type: 'manual_html',
        url,
        chapter: ch.chapter,
        title: ch.title,
        locale: 'en',
        product_family: null,
        sku_ids: [],
        canonical_for_topic: `manual_ch_${ch.chapter}`,
        duplicate_of_source_id: null,
        claim_class: 'policy',
        status: 'active',
        ingest_allowed: true,
        doc_version: docVersion,
      }),
    );

    const sections = chunkManualPageHtml(html, { docTitle: ch.title, chapter: ch.chapter });
    const isDefinitionsChapter = ch.chapter === '25';
    sections.forEach((sec, i) => {
      let claimClass = sec.claim_class;
      if (isDefinitionsChapter) {
        claimClass = claimClass === 'order_url' ? 'order_url' : 'policy';
      }
      if (claimClass === 'order_url') return;
      let text = sec.text;
      if (isDefinitionsChapter) {
        text = sanitizeDefinitionText(text);
        if (!text) return;
        claimClass = 'policy';
      } else if (claimClass === 'commercial_numeric') return;
      chunks.push({
        chunk_id: `${sourceId}#${i}`,
        source_id: sourceId,
        text,
        claim_class: claimClass,
        doc_type: 'manual_html',
        doc_title: sec.heading,
        doc_version: docVersion,
      });
    });
  }

  const merged = mergeManualIntoCorpus(priorManifest, priorChunks, manifest, chunks);
  writeJsonl(manifestPath(corpusRoot), merged.manifest);
  writeJsonl(chunksPath(corpusRoot), merged.chunks);
  const indexStats = await rebuildIndex(corpusRoot);

  return {
    chapters: MANUAL_CHAPTERS_04.length,
    manifestCount: merged.manifest.length,
    chunkCount: merged.chunks.length,
    manualChunks: chunks.length,
    indexStats,
  };
}