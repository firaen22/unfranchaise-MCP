import { getCorpusRoot } from './paths.js';
import { searchIndex, getChunk as getChunkRow } from './index-db.js';
import { readJsonl } from './jsonl.js';
import { manifestPath } from './paths.js';
import { chunkRetrievalEligible } from './eligibility.js';
import { detectCommercialNumeric, detectOrderUrl, detectKbSearchBlockedQuery } from './classify.js';
import { sourceMatchesChapter } from './search-query.js';

export async function kbSearch(
  query,
  {
    limit = 8,
    corpusRoot = getCorpusRoot(),
    ftsMode = 'or',
    dropStopwords = false,
    chapter,
    requireChapter = false,
    requireObsidian = false,
    sourceIdPrefix = null,
  } = {},
) {
  const q = query.trim();
  if (!q) return [];
  if (detectKbSearchBlockedQuery(q)) return [];
  const prefix =
    sourceIdPrefix ?? (chapter && requireChapter ? `manual_ch_${chapter}_` : null);
  const hits = searchIndex(corpusRoot, q, {
    limit: limit * 3,
    ftsMode,
    dropStopwords,
    sourceIdPrefix: prefix,
  });
  const manifestRows = await readJsonl(manifestPath(corpusRoot));
  const manifestById = new Map(manifestRows.map((r) => [r.source_id, r]));
  const out = [];
  for (const hit of hits) {
    const manifest = manifestById.get(hit.source_id);
    const full = getChunkRow(corpusRoot, hit.chunk_id);
    if (!full) continue;
    if (!chunkRetrievalEligible(manifest, full)) continue;
    if (chapter && requireChapter && !sourceMatchesChapter(hit.source_id, chapter)) continue;
    if (requireObsidian && !String(hit.source_id).startsWith('obs_')) continue;
    out.push({
      chunk_id: hit.chunk_id,
      source_id: hit.source_id,
      doc_title: hit.doc_title,
      doc_version: hit.doc_version,
      snippet: hit.snippet,
    });
    if (out.length >= limit) break;
  }
  if (requireObsidian && out.length > 1) {
    const boostPath = (sourceId) => {
      const rel = manifestById.get(sourceId)?.vault_rel_path ?? '';
      let score = 0;
      if (/\bb2b\b/i.test(q) && /02-b2b/i.test(rel)) score += 2;
      if (/template/i.test(q) && /(templates|02-b2b)/i.test(rel)) score += 1;
      if (/template/i.test(q) && /templates\//i.test(rel)) score += 3;
      if (/pitch/i.test(q) && /shopcom-pitch/i.test(rel)) score += 4;
      if (/pitch/i.test(q) && /tone/i.test(q) && /02-b2b/i.test(rel)) score += 2;
      if (/template/i.test(q) && /outreach/i.test(q) && /shopcom-pitch/i.test(rel)) score += 3;
      return score;
    };
    out.sort((a, b) => boostPath(b.source_id) - boostPath(a.source_id));
  }
  return out;
}

export async function kbGet(chunkId, { corpusRoot = getCorpusRoot() } = {}) {
  const row = getChunkRow(corpusRoot, chunkId);
  if (!row) return null;
  const manifestRows = await readJsonl(manifestPath(corpusRoot));
  const manifest = manifestRows.find((r) => r.source_id === row.source_id);
  if (!chunkRetrievalEligible(manifest, row)) return null;
  return {
    chunk_id: row.chunk_id,
    doc_title: row.doc_title,
    doc_version: row.doc_version,
    text: row.text,
  };
}