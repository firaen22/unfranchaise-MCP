#!/usr/bin/env node
/** Re-run retrieval preflight on scored CSV without clearing host columns. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvalCsv, writeEvalCsv } from '../kb/lib/eval-csv.js';
import { runKbSearch } from '../kb/lib/kb-search-run.js';
import { supportedChapterHit } from '../kb/lib/eval-search.js';
import { kbHitsLeakCommercial } from '../kb/lib/trap-preflight.js';
import { getCorpusRoot } from '../kb/lib/paths.js';
import { runA5CanaryMatrix } from '../kb/lib/a5-preflight.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(repo, '.review-gate/eval-p1-week1-scored.csv');
const scoredAt = new Date().toISOString();

// Mirror shouldKbSearch from kb-score-eval.mjs
function shouldKbSearch(row) {
  const route = row.expected_route ?? '';
  const cat = row.category ?? '';
  if (cat === 'canary' || cat === 'empty-corpus') return false;
  if (/kb|mixed/i.test(route)) return true;
  if (cat === 'trap' || cat === 'wrong-family' || cat === 'alias') return true;
  if (cat === 'abstain' && route === 'kb') return true;
  return false;
}

async function preflightRetrieval(row, hits) {
  const { category, expected_route: route } = row;
  row.retrieved_chunk_ids = hits.map((h) => h.chunk_id).join('|');

  if (category === 'mixed') {
    const chapterOk = supportedChapterHit(hits, row);
    const cites = (row.cited_chunk_ids ?? '').split('|').filter(Boolean);
    const citeInHits =
      !cites.length || cites.every((id) => hits.some((h) => h.chunk_id === id));
    const ok = hits.length > 0 && chapterOk && citeInHits;
    row.preflight_retrieval = ok ? 'pass' : 'fail';
    row.preflight_notes = !hits.length
      ? 'no_retrieval'
      : !chapterOk
        ? 'missing_gold_chapter_in_hits'
        : !citeInHits
          ? `kb_half_pending_cite_not_in_retrieval_${hits.length}`
          : `kb_half_pending_mcp_host_hits_${hits.length}_chapter_ok`;
    if (!citeInHits && cites.length) {
      row.pass_fail = 'fail';
    } else if (ok) {
      row.pass_fail = 'pass';
      row.failure_class = '';
    }
    return;
  }

  if (category === 'trap' && /^mcp|findings$/i.test(route)) {
    const leaks = await kbHitsLeakCommercial(hits, { corpusRoot: getCorpusRoot() });
    row.preflight_retrieval = leaks ? 'fail' : 'pass';
    row.preflight_notes = leaks
      ? 'kb_hit_commercial_or_order'
      : hits.length
        ? `policy_hits_ok_${hits.length}_host_must_not_cite_for_trap`
        : 'kb_empty_as_required';
    return;
  }

  if (category === 'supported' && /kb|mixed/i.test(route)) {
    const chapterOk = supportedChapterHit(hits, row);
    const cites = (row.cited_chunk_ids ?? '').split('|').filter(Boolean);
    const citeInHits =
      !cites.length || cites.every((id) => hits.some((h) => h.chunk_id === id));
    const ok = hits.length > 0 && chapterOk && citeInHits;
    row.preflight_retrieval = ok ? 'pass' : 'fail';
    row.preflight_notes = !hits.length
      ? 'no_retrieval'
      : !chapterOk
        ? 'missing_gold_chapter_in_hits'
        : !citeInHits
          ? `hits_${hits.length}_cite_not_in_retrieval`
          : `hits_${hits.length}_chapter_ok`;
    if (!citeInHits && cites.length) {
      row.pass_fail = 'fail';
    } else if (ok) {
      row.pass_fail = 'pass';
      row.failure_class = '';
    }
    return;
  }

  if (category === 'abstain' && route === 'kb') {
    row.preflight_retrieval = hits.length === 0 ? 'pass' : 'fail';
    row.preflight_notes = hits.length === 0 ? 'kb_empty' : `unexpected_hits_${hits.length}`;
    return;
  }

  if (category === 'alias') {
    const ch15 = hits.some((h) => h.source_id.includes('manual_ch_15_'));
    const citeInHits =
      row.cited_chunk_ids &&
      row.cited_chunk_ids
        .split('|')
        .filter(Boolean)
        .every((id) => hits.some((h) => h.chunk_id === id));
    row.preflight_retrieval = ch15 && citeInHits ? 'pass' : hits.length ? 'fail' : 'n/a';
    row.preflight_notes = ch15
      ? citeInHits
        ? `alias_ch15_hits_${hits.length}_cite_in_retrieval`
        : `alias_ch15_hits_${hits.length}_cite_missing`
      : hits.length
        ? `alias_hits_${hits.length}_no_ch15`
        : 'alias_empty_no_bridge';
    return;
  }

  if (category === 'canary') {
    const a5 = runA5CanaryMatrix();
    row.preflight_retrieval = a5.pass ? 'pass' : 'fail';
    row.preflight_notes = `a5_matrix_pass=${a5.pass}`;
    row.pass_fail = a5.pass ? 'pass' : 'fail';
    row.observed_outcome = a5.pass
      ? 'A5 matrix green; cookie cart and op-context leaks blocked'
      : 'A5 matrix fail; see eval-p1-week1-a5-capture.json';
  }
}

const { headers, rows } = readEvalCsv(csvPath);

for (const row of rows) {
  if (!shouldKbSearch(row)) continue;
  const q = row.question ?? '';
  const limit = 8;
  const { hits } = await runKbSearch(q, { limit });
  await preflightRetrieval(row, hits);
  row.scored_at = scoredAt;
}

writeEvalCsv(csvPath, headers, rows);

const p17 = rows.find((r) => r.id === 'p1-017');
const p29 = rows.find((r) => r.id === 'p1-029');
console.log(
  JSON.stringify(
    {
      p1_017: { preflight: p17?.preflight_retrieval, notes: p17?.preflight_notes, retrieved: p17?.retrieved_chunk_ids },
      p1_029: { preflight: p29?.preflight_retrieval, notes: p29?.preflight_notes, retrieved: p29?.retrieved_chunk_ids },
    },
    null,
    2,
  ),
);