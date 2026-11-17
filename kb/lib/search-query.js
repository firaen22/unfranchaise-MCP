const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'what',
  'when',
  'where',
  'who',
  'how',
  'does',
  'do',
  'our',
  'your',
  'for',
  'to',
  'in',
  'on',
  'at',
  'of',
  'and',
  'or',
  'with',
  'this',
  'that',
  'today',
  'hk',
  'hong',
  'kong',
]);

export function extractContentTokens(query, { dropStopwords = false } = {}) {
  return query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((t) => t.length >= 2)
    .filter((t) => !dropStopwords || !STOPWORDS.has(t.toLowerCase()));
}

/** @param {'or'|'and'} mode */
export function buildFtsQuery(query, { mode = 'or', dropStopwords = false } = {}) {
  const tokens = extractContentTokens(query, { dropStopwords });
  if (!tokens.length) return '';
  const quoted = tokens.map((t) => `"${t.replace(/"/g, '""')}"`);
  return quoted.join(mode === 'and' ? ' AND ' : ' OR ');
}

export function chapterFromPermittedEvidence(text) {
  const all = chaptersFromPermittedEvidence(text);
  return all.length ? all[0] : null;
}

/** All manual chapter numbers named in permitted_evidence (e.g. ch22 + ch25). */
export function chaptersFromPermittedEvidence(text) {
  if (!text) return [];
  const re = /\b(?:manual\s+)?ch(?:apter)?\s*(\d{1,2})\b|\bch\s*(\d{1,2})\b/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(text))) {
    const n = parseInt(m[1] ?? m[2], 10);
    if (n) out.add(String(n));
  }
  return [...out];
}

export function evidenceWantsB2B(text) {
  return /02-b2b/i.test(text ?? '');
}

export function sourceMatchesChapter(sourceId, chapter) {
  if (!chapter) return true;
  const ch = String(chapter).replace(/^ch/i, '');
  return new RegExp(`manual_ch_${ch}_`, 'i').test(sourceId ?? '');
}

export function evidenceWantsObsidian(text) {
  return /obsidian|02-b2b|templates/i.test(text ?? '');
}