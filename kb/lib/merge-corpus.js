/**
 * Merge ingest output without wiping other source types (0.8 Obsidian + 0.4 manuals).
 */
export function mergeBySourceType(existingManifest, existingChunks, nextManifest, nextChunks, sourceType) {
  const keptManifest = (existingManifest ?? []).filter((m) => m.source_type !== sourceType);
  const keptSourceIds = new Set(keptManifest.map((m) => m.source_id));
  const keptChunks = (existingChunks ?? []).filter((c) => keptSourceIds.has(c.source_id));
  return {
    manifest: [...keptManifest, ...nextManifest],
    chunks: [...keptChunks, ...nextChunks],
  };
}

export function mergeObsidianIntoCorpus(existingManifest, existingChunks, nextManifest, nextChunks) {
  return mergeBySourceType(existingManifest, existingChunks, nextManifest, nextChunks, 'obsidian_md');
}

export function mergeManualIntoCorpus(existingManifest, existingChunks, nextManifest, nextChunks) {
  return mergeBySourceType(existingManifest, existingChunks, nextManifest, nextChunks, 'manual_html');
}