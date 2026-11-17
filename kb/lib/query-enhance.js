/** Query-only flags for kb_search (no injected search phrases). */

export function enhanceKbSearchQuery(query) {
  return String(query ?? '').trim();
}

export function inferKbSearchOptions(query) {
  const low = String(query ?? '').toLowerCase();
  if (/q4 corporate revenue|revenue target|cure diabetes|opc-3 cure/i.test(low)) {
    return { ftsMode: 'and', dropStopwords: true, requireChapter: false };
  }
  if (/obsidian|02-b2b|templates\/\*\*/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, requireObsidian: true, requireChapter: false };
  }
  if (/template/i.test(low) && /outreach|b2b/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, requireObsidian: true, requireChapter: false };
  }
  if (/webcenter|internet.*policies/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '20', requireChapter: true };
  }
  if (/70%\s*rule|70 percent|seventy percent/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '16', requireChapter: true };
  }
  if (
    /definition of business volume|business volume.*definition|manual definition of business volume/i.test(
      low,
    )
  ) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '25', requireChapter: true };
  }
  if (/\bpreferred customer\b/i.test(low) && /\b(ufo|unfranchise owner)\b/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '22', requireChapter: true };
  }
  if (/social ads|social media.*advertising|advertising claims on social/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '19', requireChapter: true };
  }
  if (/preferred customer|pc program/i.test(low)) {
    return {
      ftsMode: 'or',
      dropStopwords: false,
      chapter: '22',
      requireChapter: true,
    };
  }
  const chapters = [...low.matchAll(/\bchapter\s*(\d{1,2})\b|\bch\s*(\d{1,2})\b/g)].map(
    (m) => m[1] ?? m[2],
  );
  const unique = [...new Set(chapters)];
  if (unique.length === 1) {
    return {
      ftsMode: 'or',
      dropStopwords: false,
      chapter: unique[0],
      requireChapter: true,
    };
  }
  if (unique.length > 1) {
    return { ftsMode: 'or', dropStopwords: false, chapter: unique[0], requireChapter: false };
  }
  if (/訂貨程序|超連鎖訂貨/.test(query)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '15', requireChapter: true };
  }
  if (/ordering procedures|product ordering/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '15', requireChapter: true };
  }
  if (/retail vs wholesale/i.test(low) && /order/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '15', requireChapter: false };
  }
  if (/manual ch\s*19|\bch19\b/i.test(low)) {
    return { ftsMode: 'or', dropStopwords: false, chapter: '19', requireChapter: true };
  }
  return { ftsMode: 'or', dropStopwords: false };
}

export function chaptersInQuery(query) {
  const low = String(query ?? '').toLowerCase();
  const chapters = [...low.matchAll(/\bchapter\s*(\d{1,2})\b|\bch\s*(\d{1,2})\b/g)].map(
    (m) => m[1] ?? m[2],
  );
  if (/\bpreferred customer\b/i.test(query) && /\b(ufo|unfranchise owner)\b/i.test(low)) {
    return ['22', '25'];
  }
  return [...new Set(chapters)];
}