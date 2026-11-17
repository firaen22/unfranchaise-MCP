import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEFAULT_VAULT =
  '/Users/yauch/Library/CloudStorage/GoogleDrive-ilovegemini31@gmail.com/My Drive/secondbrain/SHOPCOM';

export function getRepoRoot() {
  return REPO_ROOT;
}

export function getCorpusRoot() {
  const root = process.env.UNF_KB_CORPUS ?? path.join(REPO_ROOT, 'corpus');
  return path.resolve(root);
}

export function getVaultRoot() {
  const root = process.env.UNF_OBSIDIAN_VAULT_SHOPCOM ?? DEFAULT_VAULT;
  return path.resolve(root);
}

export function ensureCorpusDirs(corpusRoot = getCorpusRoot()) {
  fs.mkdirSync(path.join(corpusRoot, 'index'), { recursive: true });
  fs.mkdirSync(path.join(corpusRoot, 'raw'), { recursive: true });
  return corpusRoot;
}

export function manifestPath(corpusRoot = getCorpusRoot()) {
  return path.join(corpusRoot, 'manifest.jsonl');
}

export function chunksPath(corpusRoot = getCorpusRoot()) {
  return path.join(corpusRoot, 'chunks.jsonl');
}

export function indexDbPath(corpusRoot = getCorpusRoot()) {
  return path.join(corpusRoot, 'index', 'kb.sqlite');
}

export function obsidianAllowlistRel() {
  return ['02-B2B', 'Templates'];
}