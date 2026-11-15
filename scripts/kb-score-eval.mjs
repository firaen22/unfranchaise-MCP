#!/usr/bin/env node
/**
 * Phase 1.3 retrieval preflight — fills retrieved_chunk_ids and auto pass_fail where mechanical.
 * Full P1 still requires host generation + cited_chunk_ids (A2/A3/A4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvalCsv, writeEvalCsv } from '../kb/lib/eval-csv.js';
import { kbSearch } from '../kb/lib/retrieve.js';
import { kbHitsLeakCommercial } from '../kb/lib/trap-preflight.js';
import { getCorpusRoot } from '../kb/lib/paths.js';
import { captureKnowledgeToolCall } from '../kb/lib/kb-tool-capture.js';
import { evalSearchOptions, evalSearchQuery, supportedChapterHit } from '../kb/lib/eval-search.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inPath = process.env.EVAL_CSV_IN ?? path.join(repo, '.review-gate/eval-p1-week1.csv');
const outPath =
  process.env.EVAL_CSV_OUT ?? path.join(repo, '.review-gate/eval-p1-week1-scored.csv');
const reportPath = process.env.EVAL_REPORT_OUT ?? path.join(repo, '.review-gate/eval-p1-week1-preflight.md');

const { headers, rows } = readEvalCsv(inPath);
const extra = ['preflight_retrieval', 'preflight_notes', 'scored_at'];
const outHeaders = [...new Set([...headers, ...extra])];

const scoredAt = new Date().toISOString();
const report = [];

function routeUsesKb(route) {
  return /kb|mixed/i.test(route);
}

function shouldKbSearch(row) {
  const route = row.expected_route ?? '';
  const cat = row.category ?? '';
  if (cat === 'canary' || cat === 'empty-corpus') return false;
  if (routeUsesKb(route)) return true;
  if (cat === 'trap' || cat === 'wrong-family' || cat === 'alias') return true;
  if (cat === 'abstain' && route === 'kb') return true;
  return false;
}

async function autoPreflight(row, hits) {
  const { category, expected_route: route } = row;
  const ids = hits.map((h) => h.chunk_id);
  row.retrieved_chunk_ids = ids.join('|');

  if (category === 'canary') {
    const green = captureKnowledgeToolCall('kb_search', { query: 'advertising policy' });
    const red = captureKnowledgeToolCall('kb_search', {
      query: 'UNF_CANARY_LEAK=1',
    });
    const ok = green.isolation.ok && !red.isolation.ok;
    row.preflight_retrieval = ok ? 'pass' : 'fail';
    row.preflight_notes = `green=${green.isolation.ok} red=${!red.isolation.ok}`;
    row.pass_fail = ok ? 'pass' : 'fail';
    return ok ? 'pass' : 'fail';
  }

  if (category === 'trap' && /^mcp|findings$/i.test(route)) {
    const corpusRoot = getCorpusRoot();
    const leaks = await kbHitsLeakCommercial(hits, { corpusRoot });
    row.preflight_retrieval = leaks ? 'fail' : 'pass';
    row.preflight_notes = leaks
      ? 'kb_hit_commercial_or_order'
      : hits.length
        ? `policy_hits_ok_${hits.length}_host_must_not_cite_for_trap`
        : 'kb_empty_as_required';
    row.pass_fail = leaks ? 'fail' : 'pending';
    return row.preflight_retrieval;
  }

  if (category === 'abstain' && route === 'kb') {
    const empty = hits.length === 0;
    row.preflight_retrieval = empty ? 'pass' : 'fail';
    row.preflight_notes = empty ? 'kb_empty' : `unexpected_hits_${hits.length}`;
    row.pass_fail = 'pending';
    return row.preflight_retrieval;
  }

  if (category === 'supported' && routeUsesKb(route)) {
    const chapterOk = supportedChapterHit(hits, row);
    const ok = hits.length > 0 && chapterOk;
    row.preflight_retrieval = ok ? 'pass' : 'fail';
    row.preflight_notes = !hits.length
      ? 'no_retrieval'
      : !chapterOk
        ? row._search_fallback
          ? 'fallback_hits_missing_gold_chapter'
          : 'missing_gold_chapter_in_hits'
        : `hits_${hits.length}_chapter_ok${row._search_fallback ? '_fallback' : ''}`;
    row.pass_fail = 'pending';
    return row.preflight_retrieval;
  }

  if (category === 'mixed') {
    const chapterOk = supportedChapterHit(hits, row);
    const ok = hits.length > 0 && chapterOk;
    row.preflight_retrieval = ok ? 'pass' : 'fail';
    row.preflight_notes = !hits.length
      ? 'no_retrieval'
      : !chapterOk
        ? 'missing_gold_chapter_in_hits'
        : `kb_half_pending_mcp_host_hits_${hits.length}_chapter_ok`;
    row.pass_fail = 'pending';
    return row.preflight_retrieval;
  }

  row.preflight_retrieval = 'pending';
  row.preflight_notes = 'host_route_required';
  row.pass_fail = 'pending';
  return 'pending';
}

for (const row of rows) {
  let hits = [];
  if (shouldKbSearch(row)) {
    const q = evalSearchQuery(row);
    const opts = evalSearchOptions(row);
    hits = await kbSearch(q, { limit: 8, ...opts });
    if (!hits.length && opts.requireChapter) {
      hits = await kbSearch(q, {
        limit: 8,
        ftsMode: opts.ftsMode,
        dropStopwords: opts.dropStopwords,
      });
      row._search_fallback = true;
    }
  }
  const verdict = await autoPreflight(row, hits);
  row.scored_at = scoredAt;
  report.push(`| ${row.id} | ${row.category} | ${verdict} | ${row.preflight_notes} | ${row.retrieved_chunk_ids || '—'} |`);
}

for (const row of rows.filter((r) => r.category === 'empty-corpus')) {
  row.preflight_notes = 'run with empty harness corpus via UNF_KB_CORPUS';
  row.preflight_retrieval = 'pending';
}

writeEvalCsv(outPath, outHeaders, rows);

const md = `# P1 eval preflight (${scoredAt})

Mechanical checks only — **not** P1 gate. Still need host answers, citations, mixed labels, MCP/FINDINGS traps.

| id | category | preflight | notes | retrieved_chunk_ids |
|----|----------|-----------|-------|---------------------|
${report.join('\n')}

Output CSV: \`${path.relative(repo, outPath)}\`
`;

fs.writeFileSync(reportPath, md, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`Wrote ${reportPath}`);

const fails = rows.filter((r) => r.preflight_retrieval === 'fail').length;
const passes = rows.filter((r) => r.preflight_retrieval === 'pass').length;
console.log(
  JSON.stringify(
    {
      rows: rows.length,
      preflight_pass: passes,
      preflight_fail: fails,
      pending: rows.length - passes - fails,
    },
    null,
    2,
  ),
);