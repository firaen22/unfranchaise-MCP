#!/usr/bin/env node
/** Refresh P2 gate attachments: frozen manifest + p1-026 rationale. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonl } from '../kb/lib/jsonl.js';
import { getCorpusRoot, manifestPath } from '../kb/lib/paths.js';
import { validateManifestRow } from '../kb/lib/manifest-schema.js';
import { spawnSync } from 'node:child_process';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

const manifest = await readJsonl(manifestPath(getCorpusRoot()));
const validation = manifest.map((r) => ({
  source_id: r.source_id,
  ...validateManifestRow(r),
}));

fs.writeFileSync(
  path.join(gate, 'eval-p1-week1-manifest-freeze.json'),
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      row_count: manifest.length,
      rows: manifest,
      validateManifestRow: validation,
      all_valid: validation.every((v) => v.ok),
    },
    null,
    2,
  )}\n`,
);

const rationale = `# p1-026 scoring rationale (A6)

Generated: ${new Date().toISOString()}

**Row:** p1-026 — \`category=abstain\`, question asks for exhaustive 2026 spring promo bundle SKU list with IBV.

**Plan rule (PLAN-product-kb-rag.md §2):**
- Hard blocker: \`category=trap\` with \`expected_route\` mcp|findings must not pass on abstain alone.
- Hard blocker: \`category=abstain\` must not assert unsupported non-health facts (clean abstain passes).

p1-026 is **abstain**, not trap. Passing without a numeric answer is correct: live catalog has no repo tool that proves exhaustive bundle membership.

**Evidence:** \`eval-p1-week1-trap-mcp-traces.json\` → \`findings.p1_026\`; host answer documents abstain without KB cites.

**expected_route=mcp** on this row means live plane if an answer existed — not that MCP must return a full SKU list for an abstain row.
`;

fs.writeFileSync(path.join(gate, 'eval-p1-week1-p1-026-rationale.md'), rationale);

const contract = {
  generated_at: new Date().toISOString(),
  sidecar_tools: ['kb_search', 'kb_get'],
  no_generate_tool: true,
  host_generation_boundary:
    'Host supplies UNF_KB_OP_CONTEXT on MCP stdio and generationMessages on embedded handleKbTool; fresh outbound LLM capture is host-owned (PLAN §4 dual plane).',
  artifacts: [
    'eval-p2-host-wire.json',
    'eval-p2-mcp-transport.json',
    'eval-p1-week1-a5-generation-context.json',
    'eval-p1-week1-a5-host-boundary.txt',
  ],
};

fs.writeFileSync(
  path.join(gate, 'eval-p2-a5-sidecar-contract.json'),
  `${JSON.stringify(contract, null, 2)}\n`,
);

const empty = spawnSync(process.execPath, ['scripts/kb-empty-corpus-preflight.mjs'], {
  cwd: repo,
  encoding: 'utf8',
});
fs.writeFileSync(
  path.join(gate, 'eval-p1-week1-harness-empty-corpus.txt'),
  `exit=${empty.status}\n${empty.stdout}\n${empty.stderr}`,
);

spawnSync(process.execPath, ['scripts/kb-p1-provenance.mjs'], { cwd: repo, encoding: 'utf8' });

console.log(
  JSON.stringify(
    {
      manifest_rows: manifest.length,
      all_valid: validation.every((v) => v.ok),
      written: [
        'eval-p1-week1-manifest-freeze.json',
        'eval-p1-week1-p1-026-rationale.md',
        'eval-p2-a5-sidecar-contract.json',
      ],
    },
    null,
    2,
  ),
);