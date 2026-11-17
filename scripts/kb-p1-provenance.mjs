#!/usr/bin/env node
/** Write eval generation provenance note for gate reviewers. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvalCsv } from '../kb/lib/eval-csv.js';
import { runKbSearch } from '../kb/lib/kb-search-run.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

function shouldKbSearch(row) {
  const route = row.expected_route ?? '';
  const cat = row.category ?? '';
  if (cat === 'canary' || cat === 'empty-corpus') return false;
  if (/kb|mixed/i.test(route)) return true;
  if (cat === 'trap' || cat === 'wrong-family' || cat === 'alias') return true;
  if (cat === 'abstain' && route === 'kb') return true;
  return false;
}

const { rows } = readEvalCsv(path.join(gate, 'eval-p1-week1-scored.csv'));
const fullTraces = [];
let allCiteSubsetOk = true;
let allRetrievalColumnsMatch = true;
let allLimitOk = true;

for (const row of rows) {
  if (!shouldKbSearch(row)) continue;
  const { hits, aliasBridge } = await runKbSearch(row.question, { limit: 8 });
  const cites = (row.cited_chunk_ids ?? '').split('|').filter(Boolean);
  const retrieved = (row.retrieved_chunk_ids ?? '').split('|').filter(Boolean);
  const citeInHits = !cites.length || cites.every((c) => hits.some((h) => h.chunk_id === c));
  const citeInRetrieved =
    !cites.length || cites.every((c) => retrieved.includes(c));
  const retrievalMatchesRun =
    retrieved.length === hits.length &&
    retrieved.every((id, i) => id === hits[i]?.chunk_id);
  if (!citeInHits || !citeInRetrieved) allCiteSubsetOk = false;
  if (hits.length > 8 || retrieved.length > 8) allLimitOk = false;
  if (!retrievalMatchesRun) allRetrievalColumnsMatch = false;

  fullTraces.push({
    eval_id: row.id,
    question: row.question,
    runKbSearch_limit: 8,
    hit_count: hits.length,
    retrieval_first: hits.map((h) => h.chunk_id),
    frozen_retrieved: retrieved,
    retrieval_column_matches_run: retrievalMatchesRun,
    aliasBridge: aliasBridge ?? null,
    cited: cites,
    cite_in_run_hits: citeInHits,
    cite_in_frozen_retrieval: citeInRetrieved,
    observed_outcome: row.observed_outcome,
  });
}

const sampleIds = ['p1-005', 'p1-022', 'p1-027', 'p1-030'];
const samples = fullTraces.filter((t) => sampleIds.includes(t.eval_id));

const zhOnlyOrdering = await runKbSearch('超連鎖訂貨程序', { limit: 8 });
const zhOnlyBridge = {
  query: '超連鎖訂貨程序',
  aliasBridge: zhOnlyOrdering.aliasBridge ?? null,
  hit_ids: zhOnlyOrdering.hits.map((h) => h.chunk_id),
  ch15_present: zhOnlyOrdering.hits.some((h) => h.source_id?.includes('manual_ch_15_')),
};

const md = `# P1 host scoring provenance

Generated: ${new Date().toISOString()}

## Pipeline (frozen corpus)

1. \`npm run kb:p1-rescore-retrieval\` — \`runKbSearch(row.question, { limit: 8 })\` on each kb row → \`retrieved_chunk_ids\` (≤8 ids, run order).
2. \`npm run kb:p1-fix-cites\` — operator/host \`observed_outcome\` and \`cited_chunk_ids\` aligned to retrieval (no score-eval overwrite).
3. \`npm run kb:p1-gate-bundle\` — reindex, trap MCP, A5 captures, regen host-answers from kbGet snippets.

Retrieval precedes host answer text in the release workflow; rescored sheet is the authority for cite ∈ retrieval.

## Full-row retrieval audit (\`limit: 8\`)

- rows_with_kb_retrieval: ${fullTraces.length}
- all_cite_subset_of_frozen_retrieval: ${allCiteSubsetOk}
- all_retrieved_columns_match_fresh_runKbSearch: ${allRetrievalColumnsMatch}
- all_hit_counts_within_limit: ${allLimitOk}

## Sample trace (production runKbSearch path)

\`\`\`json
${JSON.stringify(samples, null, 2)}
\`\`\`

## Chinese-only ordering alias bridge (p1-022 zh-only control)

\`\`\`json
${JSON.stringify(zhOnlyBridge, null, 2)}
\`\`\`

## Full trace matrix

\`\`\`json
${JSON.stringify(fullTraces, null, 2)}
\`\`\`
`;

fs.writeFileSync(path.join(gate, 'eval-p1-week1-provenance.md'), md, 'utf8');
fs.writeFileSync(
  path.join(gate, 'eval-p2-retrieval-live-traces.json'),
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      limit: 8,
      rows: fullTraces.length,
      all_cite_ok: allCiteSubsetOk,
      all_retrieval_columns_match_run: allRetrievalColumnsMatch,
      traces: fullTraces,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify(
    {
      written: ['eval-p1-week1-provenance.md', 'eval-p2-retrieval-live-traces.json'],
      rows: fullTraces.length,
      all_cite_ok: allCiteSubsetOk,
      all_retrieval_columns_match_run: allRetrievalColumnsMatch,
    },
    null,
    2,
  ),
);