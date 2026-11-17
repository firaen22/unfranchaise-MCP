#!/usr/bin/env node
/**
 * Phase 1 prep: 0.7-lite consolidation + 0.8 Obsidian + 0.4 manuals.
 */
import { ingestObsidianAllowlist } from '../kb/ingest/obsidian.js';
import { ingestManualChapters04 } from '../kb/ingest/manual-chapters.js';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('[p1-prep] consolidation 0.7-lite');
spawnSync(process.execPath, [path.join(repo, 'scripts/kb-bootstrap-consolidation.mjs')], {
  stdio: 'inherit',
});

console.log('[p1-prep] ingest obsidian 0.8');
const o = await ingestObsidianAllowlist();
console.log(JSON.stringify(o, null, 2));

console.log('[p1-prep] ingest manuals 0.4');
const m = await ingestManualChapters04({ cacheRaw: true });
console.log(JSON.stringify(m, null, 2));

console.log('[p1-prep] frozen P1 corpus ready (Obsidian allowlist + six manuals)');