import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { indexDbPath, manifestPath, chunksPath } from './paths.js';
import { readJsonl } from './jsonl.js';
import { chunkRetrievalEligible } from './eligibility.js';
import { buildFtsQuery } from './search-query.js';

export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      chunk_id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      doc_title TEXT,
      doc_version TEXT,
      claim_class TEXT,
      text TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      chunk_id UNINDEXED,
      text,
      tokenize = 'unicode61'
    );
  `);
}

/** Production indexer — never indexes ineligible chunks (§7.1). */
export async function rebuildIndex(corpusRoot) {
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

  let indexed = 0;
  for (const chunk of chunks) {
    const manifest = manifestById.get(chunk.source_id);
    if (!chunkRetrievalEligible(manifest, chunk)) continue;
    insert.run(
      chunk.chunk_id,
      chunk.source_id,
      chunk.doc_title ?? manifest?.title ?? '',
      chunk.doc_version ?? manifest?.doc_version ?? '',
      chunk.claim_class,
      chunk.text,
    );
    const pathHint =
      manifest?.vault_rel_path ?? manifest?.rel_path ?? manifest?.source_path ?? '';
    const ftsText = [chunk.doc_title, pathHint, chunk.text].filter(Boolean).join('\n');
    insertFts.run(chunk.chunk_id, ftsText);
    indexed += 1;
  }
  db.close();
  return { indexed, total: chunks.length };
}

export function searchIndex(
  corpusRoot,
  query,
  { limit = 8, ftsMode = 'or', dropStopwords = false, sourceIdPrefix = null } = {},
) {
  const dbPath = indexDbPath(corpusRoot);
  if (!fs.existsSync(dbPath)) return [];
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const q = query.trim();
  if (!q) {
    db.close();
    return [];
  }
  const ftsQuery = buildFtsQuery(q, { mode: ftsMode, dropStopwords });
  if (!ftsQuery) {
    db.close();
    return [];
  }
  const sql = sourceIdPrefix
    ? `
    SELECT c.chunk_id, c.source_id, c.doc_title, c.doc_version, c.claim_class,
           snippet(chunks_fts, 1, '[[', ']]', '…', 32) AS snippet
    FROM chunks_fts
    JOIN chunks c ON c.chunk_id = chunks_fts.chunk_id
    WHERE chunks_fts MATCH ? AND c.source_id LIKE ?
    LIMIT ?`
    : `
    SELECT c.chunk_id, c.source_id, c.doc_title, c.doc_version, c.claim_class,
           snippet(chunks_fts, 1, '[[', ']]', '…', 32) AS snippet
    FROM chunks_fts
    JOIN chunks c ON c.chunk_id = chunks_fts.chunk_id
    WHERE chunks_fts MATCH ?
    LIMIT ?`;
  const stmt = db.prepare(sql);
  const rows = sourceIdPrefix
    ? stmt.all(ftsQuery, `${sourceIdPrefix}%`, limit)
    : stmt.all(ftsQuery, limit);
  db.close();
  return rows;
}

export function getChunk(corpusRoot, chunkId) {
  const dbPath = indexDbPath(corpusRoot);
  if (!fs.existsSync(dbPath)) return null;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db
    .prepare(
      `SELECT chunk_id, source_id, doc_title, doc_version, claim_class, text FROM chunks WHERE chunk_id = ?`,
    )
    .get(chunkId);
  db.close();
  return row ?? null;
}