import { chapterFromPermittedEvidence, evidenceWantsObsidian } from './search-query.js';
import { enhanceKbSearchQuery, inferKbSearchOptions, chaptersInQuery } from './query-enhance.js';

/** Row-aware search options for Phase 1 preflight (uses same path as production kb_search). */
export function evalSearchOptions(row) {
  // Formerly branched on abstain+kb; identical to default — collapsed after 150-case equivalence (Sol/Grok A3).
  return inferKbSearchOptions(row.question ?? '');
}

export function evalSearchQuery(row) {
  return enhanceKbSearchQuery(row.question ?? '');
}

/** Gold manual chapter (or obsidian) present in retrieval hits. */
export function supportedChapterHit(hits, row) {
  const chapters = chaptersInQuery(row.question ?? '');
  if (!chapters.length) {
    const chapter = chapterFromPermittedEvidence(row.permitted_evidence ?? '');
    if (!chapter) return true;
    if (evidenceWantsObsidian(row.permitted_evidence)) {
      return hits.some((h) => String(h.source_id).startsWith('obs_'));
    }
    return hits.some(
      (h) => /manual_ch_/.test(h.source_id) && h.source_id.includes(`manual_ch_${chapter}_`),
    );
  }
  if (evidenceWantsObsidian(row.permitted_evidence) || /obsidian|02-b2b|templates/i.test(row.question ?? '')) {
    return hits.some((h) => String(h.source_id).startsWith('obs_'));
  }
  return chapters.every((ch) =>
    hits.some(
      (h) => /manual_ch_/.test(h.source_id) && h.source_id.includes(`manual_ch_${ch}_`),
    ),
  );
}