import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getCorpusRoot,
  getVaultRoot,
  ensureCorpusDirs,
  manifestPath,
  chunksPath,
  obsidianAllowlistRel,
} from '../lib/paths.js';
import { chunkMarkdown } from '../lib/chunk-markdown.js';
import { classifyChunkText } from '../lib/classify.js';
import { readJsonl, writeJsonl } from '../lib/jsonl.js';
import { mergeObsidianIntoCorpus } from '../lib/merge-corpus.js';
import { rebuildIndex } from '../lib/index-db.js';
import { assertManifestRow } from '../lib/manifest-schema.js';

function stableId(prefix, key) {
  const h = crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
  return `${prefix}_${h}`;
}

function listMarkdownFiles(vaultRoot, relDirs) {
  const files = [];
  for (const rel of relDirs) {
    const base = path.join(vaultRoot, rel);
    if (!fs.existsSync(base)) continue;
    walk(base, rel, files);
  }
  return files.sort();
}

function walk(absDir, relFromVault, acc) {
  for (const name of fs.readdirSync(absDir)) {
    if (name.startsWith('.') || name.includes('conflict')) continue;
    const abs = path.join(absDir, name);
    const rel = path.join(relFromVault, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, rel, acc);
    else if (name.endsWith('.md')) acc.push({ abs, rel: rel.replace(/\\/g, '/') });
  }
}

export async function ingestObsidianAllowlist({
  vaultRoot = getVaultRoot(),
  corpusRoot = getCorpusRoot(),
  docVersion = 'vault-0.8',
} = {}) {
  ensureCorpusDirs(corpusRoot);
  const priorManifest = await readJsonl(manifestPath(corpusRoot));
  const priorChunks = await readJsonl(chunksPath(corpusRoot));
  const allowRel = obsidianAllowlistRel();
  const mdFiles = listMarkdownFiles(vaultRoot, allowRel);

  const manifest = [];
  const chunks = [];

  for (const { abs, rel } of mdFiles) {
    const base = path.basename(rel);
    if (/product-catalog/i.test(base)) {
      manifest.push(
        assertManifestRow({
          source_id: stableId('obs', rel),
          source_type: 'obsidian_md',
          vault_rel_path: rel,
          title: base.replace(/\.md$/, ''),
          locale: 'zh',
          product_family: null,
          sku_ids: [],
          canonical_for_topic: null,
          duplicate_of_source_id: null,
          claim_class: 'operator_synthesis',
          status: 'quarantine',
          ingest_allowed: false,
          doc_version: docVersion,
        }),
      );
      continue;
    }

    const md = fs.readFileSync(abs, 'utf8');
    const sourceId = stableId('obs', rel);
    manifest.push(
      assertManifestRow({
        source_id: sourceId,
        source_type: 'obsidian_md',
        vault_rel_path: rel,
        title: base.replace(/\.md$/, ''),
        locale: 'zh',
        product_family: null,
        sku_ids: [],
        canonical_for_topic: null,
        duplicate_of_source_id: null,
        claim_class: 'operator_synthesis',
        status: 'active',
        ingest_allowed: true,
        doc_version: docVersion,
      }),
    );

    const sections = chunkMarkdown(md, { docTitle: base });
    sections.forEach((sec, i) => {
      const blob = `${sec.heading}\n${sec.text}`;
      const claimClass = classifyChunkText(blob, { defaultClass: 'operator_synthesis' });
      chunks.push({
        chunk_id: `${sourceId}#${i}`,
        source_id: sourceId,
        text: sec.text,
        claim_class: claimClass,
        doc_type: 'obsidian_md',
        doc_title: sec.heading,
        doc_version: docVersion,
      });
    });
  }

  const merged = mergeObsidianIntoCorpus(priorManifest, priorChunks, manifest, chunks);
  writeJsonl(manifestPath(corpusRoot), merged.manifest);
  writeJsonl(chunksPath(corpusRoot), merged.chunks);
  const indexStats = await rebuildIndex(corpusRoot);

  return {
    manifestCount: merged.manifest.length,
    chunkCount: merged.chunks.length,
    obsidianManifest: manifest.length,
    obsidianChunks: chunks.length,
    filesScanned: mdFiles.length,
    indexStats,
  };
}