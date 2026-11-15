import { detectKbSearchBlockedQuery } from './classify.js';
import { kbSearch } from './retrieve.js';
import { enhanceKbSearchQuery, inferKbSearchOptions, chaptersInQuery } from './query-enhance.js';
import { buildFtsQuery, extractContentTokens } from './search-query.js';

function mergeHits(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const h of list) {
      if (seen.has(h.chunk_id)) continue;
      seen.add(h.chunk_id);
      out.push(h);
    }
  }
  return out;
}

const TOKEN_SKIP = new Set([
  'from',
  'operator',
  'vault',
  'without',
  'numbers',
  'what',
  'how',
  'does',
  'the',
  'for',
  'this',
  'today',
  'week',
  'named',
  'catalog',
  'sku',
  'key',
  'terms',
  'context',
  'hong',
  'kong',
]);

function supplementalQueryTokens(userQuery) {
  return extractContentTokens(userQuery, { dropStopwords: true })
    .filter((t) => !TOKEN_SKIP.has(t.toLowerCase()))
    .slice(0, 8)
    .join(' ');
}

const ZH_ORDERING_ALIAS = /(?:超連鎖訂貨程序|訂貨程序)/;
const EN_ORDERING_BRIDGE = 'product ordering procedures manual chapter 15';

function needsOrderingAliasBridge(userQuery, hits) {
  if (hits.length) return false;
  const q = String(userQuery ?? '');
  return (
    ZH_ORDERING_ALIAS.test(q) ||
    (/ch15/i.test(q) && /ordering policy|訂貨|equivalent/i.test(q))
  );
}

/** Shared kb_search execution (MCP + eval preflight). */
export async function runKbSearch(userQuery, { limit = 8 } = {}) {
  if (detectKbSearchBlockedQuery(userQuery)) {
    return { hits: [], aliasBridge: null };
  }
  const enhanced = enhanceKbSearchQuery(userQuery);
  const opts = inferKbSearchOptions(userQuery);
  const narrow = supplementalQueryTokens(userQuery);
  let hits = await kbSearch(enhanced, { limit, ...opts });
  if (narrow && narrow.toLowerCase() !== enhanced.toLowerCase()) {
    hits = mergeHits(
      await kbSearch(narrow, { limit: Math.max(limit, 8), ...opts }),
      hits,
    ).slice(0, Math.max(limit, 12));
  }
  if (opts.requireObsidian && /\bwithout numbers\b/i.test(userQuery)) {
    const andQ = buildFtsQuery(narrow || enhanced, { mode: 'and', dropStopwords: true });
    if (andQ) {
      hits = mergeHits(
        await kbSearch(andQ, { limit: 8, ...opts, ftsMode: 'and', dropStopwords: true }),
        hits,
      ).slice(0, Math.max(limit, 12));
    }
  }
  if (opts.requireObsidian && /template/i.test(userQuery) && /outreach/i.test(userQuery)) {
    hits = mergeHits(
      await kbSearch('獨特賣點 USP Shop.com 02-B2B restaurant', {
        limit: 8,
        ...opts,
        ftsMode: 'or',
        dropStopwords: false,
      }),
      await kbSearch('b2b-prospect outreach Templates', {
        limit: 8,
        ...opts,
        ftsMode: 'or',
        dropStopwords: false,
      }),
      hits,
    ).slice(0, Math.max(limit, 14));
    const andQ = buildFtsQuery(supplementalQueryTokens(userQuery), {
      mode: 'and',
      dropStopwords: true,
    });
    if (andQ) {
      hits = mergeHits(
        await kbSearch(andQ, { limit: 8, ...opts, ftsMode: 'and', dropStopwords: true }),
        hits,
      ).slice(0, Math.max(limit, 12));
    }
  }
  if (!hits.length && opts.requireChapter) {
    hits = await kbSearch(enhanced, {
      limit,
      ftsMode: opts.ftsMode,
      dropStopwords: opts.dropStopwords,
      chapter: opts.chapter,
      requireChapter: false,
    });
  }
  const chapters = chaptersInQuery(userQuery);
  if (chapters.length > 1) {
    let merged = [];
    for (const ch of chapters) {
      merged = mergeHits(
        merged,
        await kbSearch(userQuery, {
          limit: 6,
          ftsMode: 'or',
          chapter: ch,
          requireChapter: true,
        }),
      );
    }
    hits = mergeHits(merged, hits).slice(0, Math.max(limit, 12));
  }
  let aliasBridge = null;
  if (needsOrderingAliasBridge(userQuery, hits)) {
    aliasBridge = EN_ORDERING_BRIDGE;
    hits = await kbSearch(EN_ORDERING_BRIDGE, {
      limit: Math.max(limit, 8),
      ftsMode: 'or',
      dropStopwords: false,
      chapter: '15',
      requireChapter: true,
    });
  }
  return { query: userQuery, enhanced, options: opts, hits, ...(aliasBridge ? { aliasBridge } : {}) };
}