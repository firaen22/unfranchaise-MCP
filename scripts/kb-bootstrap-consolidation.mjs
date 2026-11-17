#!/usr/bin/env node
/** 0.7-lite: write corpus/consolidation.md §1 if missing. */
import fs from 'node:fs';
import path from 'node:path';
import { getCorpusRoot, ensureCorpusDirs } from '../kb/lib/paths.js';

const corpus = ensureCorpusDirs(getCorpusRoot());
const target = path.join(corpus, 'consolidation.md');

const body = `# consolidation.md — product knowledge (operator)

## 1. Authority stack

1. unfranchaise-MCP + live HTML
2. FINDINGS.md
3. Manual chapters (hkg-*.documents.unfranchise.com)
4. Obsidian operator synthesis (02-B2B, Templates only for P1)
5. Training transcript (post-P1)
6. Curated X / social

Live SKU/BV/price/order → MCP only. Vault product-catalog → never indexed.

## 2–6

(Fill during 0.7b / 0.4 dedupe — see plan §6.4.)
`;

if (fs.existsSync(target)) {
  console.log(`exists: ${target}`);
} else {
  fs.writeFileSync(target, body, 'utf8');
  console.log(`wrote: ${target}`);
}