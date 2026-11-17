#!/usr/bin/env node
/** Operator P2 ship smoke — plan §2.1–2.2 without reviewer dispatch. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = process.env.UNF_KB_CORPUS || path.join(repo, 'corpus');

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`[kb:ship-smoke] FAIL ${label} exit=${r.status}`);
    if (r.stderr) console.error(r.stderr.slice(0, 4000));
    process.exit(r.status ?? 1);
  }
  console.log(`[kb:ship-smoke] ok ${label}`);
}

const manifest = path.join(corpus, 'manifest.jsonl');
const chunks = path.join(corpus, 'chunks.jsonl');
if (!fs.existsSync(manifest) || !fs.existsSync(chunks)) {
  console.error(
    `[kb:ship-smoke] missing corpus at ${corpus}\n  Run: npm run kb:p1-prep   (or set UNF_KB_CORPUS)`,
  );
  process.exit(2);
}

run('test:kb', 'npm', ['run', 'test:kb']);
run('mcp-transport', process.execPath, ['scripts/kb-p2-mcp-transport.mjs']);
run('host-wire', process.execPath, ['scripts/kb-p2-host-wire-evidence.mjs']);
run('classifier-oracle', process.execPath, ['scripts/kb-p2-classifier-oracle-red.mjs']);
console.log('[kb:ship-smoke] all green — add unfranchaise-kb to MCP config (README)');