#!/usr/bin/env node
/** Write eval generation provenance note for gate reviewers. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvalCsv } from '../kb/lib/eval-csv.js';
import { runKbSearch } from '../kb/lib/kb-search-run.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');
const { rows } = readEvalCsv(path.join(gate, 'eval-p1-week1-scored.csv'));

const samples = [];
for (const id of ['p1-005', 'p1-022', 'p1-027', 'p1-030']) {
  const row = rows.find((r) => r.id === id);
  if (!row) continue;
  const { hits, aliasBridge } = await runKbSearch(row.question, { limit: 8 });
  const cites = (row.cited_chunk_ids ?? '').split('|').filter(Boolean);
  samples.push({
    eval_id: id,
    question: row.question,
    retrieval_first: hits.map((h) => h.chunk_id),
    aliasBridge: aliasBridge ?? null,
    cited: cites,
    cite_in_retrieval: cites.every((c) => hits.some((h) => h.chunk_id === c)),
    observed_outcome: row.observed_outcome,
  });
}

const md = `# P1 host scoring provenance

Generated: ${new Date().toISOString()}

## Pipeline (frozen corpus)

1. \`npm run kb:p1-rescore-retrieval\` — \`runKbSearch(row.question)\` on each kb row → \`retrieved_chunk_ids\`.
2. \`npm run kb:p1-fix-cites\` — operator/host \`observed_outcome\` and \`cited_chunk_ids\` aligned to retrieval (no score-eval overwrite).
3. \`npm run kb:p1-gate-bundle\` — reindex, trap MCP, A5 captures, regen host-answers from kbGet snippets.

Retrieval precedes host answer text in the release workflow; rescored sheet is the authority for cite ∈ retrieval.

## Sample trace (production runKbSearch path)

\`\`\`json
${JSON.stringify(samples, null, 2)}
\`\`\`
`;

fs.writeFileSync(path.join(gate, 'eval-p1-week1-provenance.md'), md, 'utf8');
console.log(JSON.stringify({ written: 'eval-p1-week1-provenance.md', samples: samples.length }, null, 2));