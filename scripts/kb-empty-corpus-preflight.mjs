#!/usr/bin/env node
/** Score p1-021 only against an empty temp corpus. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { kbSearch } from '../kb/lib/retrieve.js';
import { writeJsonl } from '../kb/lib/jsonl.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-empty-'));
process.env.UNF_KB_CORPUS = tmp;
fs.mkdirSync(path.join(tmp, 'index'), { recursive: true });
writeJsonl(path.join(tmp, 'manifest.jsonl'), []);
writeJsonl(path.join(tmp, 'chunks.jsonl'), []);

const q = 'What is UFO advertising policy when corpus path is empty harness?';
const hits = await kbSearch(q);
const ok = hits.length === 0;
console.log(JSON.stringify({ id: 'p1-021', empty_corpus: ok, hits: hits.length }, null, 2));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(ok ? 0 : 1);