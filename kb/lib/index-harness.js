/**
 * Test-only indexer: loads every chunk into FTS (including mis-labeled commercial).
 * Production CLI/MCP must not import this module (plan §7.1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { indexDbPath, manifestPath, chunksPath } from './paths.js';
import { readJsonl } from './jsonl.js';
import { initSchema } from './index-db.js';

export async function rebuildIndexHarness(corpusRoot) {
  const manifestRows = await readJsonl(manifestPath(corpusRoot));
  const manifestById = new Map(manifestRows.map((r) => [r.source_id, r]));
  const chunks = await readJsonl(chunksPath(corpusRoot));

  const dbPath = indexDbPath(corpusRoot);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new DatabaseSync(dbPath);
  initSchema(db);
  const insert = db.prepare(
    `INSERT INTO chunks (chunk_id, source_id, doc_title, doc_version, claim_class, text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertFts = db.prepare(`INSERT INTO chunks_fts (chunk_id, text) VALUES (?, ?)`);

  for (const chunk of chunks) {
    const manifest = manifestById.get(chunk.source_id);
    insert.run(
      chunk.chunk_id,
      chunk.source_id,
      chunk.doc_title ?? manifest?.title ?? '',
      chunk.doc_version ?? manifest?.doc_version ?? '',
      chunk.claim_class,
      chunk.text,
    );
    const ftsText = [chunk.doc_title, chunk.text].filter(Boolean).join('\n');
    insertFts.run(chunk.chunk_id, ftsText);
  }
  db.close();
  return { indexed: chunks.length, total: chunks.length };
}