#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildFtsQuery, chapterFromPermittedEvidence } from './kb/lib/search-query.js';
import { kbSearch } from './kb/lib/retrieve.js';
import { supportedChapterHit } from './kb/lib/eval-search.js';
import { runKbSearch } from './kb/lib/kb-search-run.js';

assert.match(buildFtsQuery('Q4 corporate revenue target', { mode: 'and', dropStopwords: true }), /AND/);
assert.ok(!buildFtsQuery('what is our', { mode: 'and', dropStopwords: true }).includes('what'));

assert.equal(chapterFromPermittedEvidence('manual ch19'), '19');

const q9 = await kbSearch('Q4 corporate revenue target Market Hong Kong', {
  ftsMode: 'and',
  dropStopwords: true,
  limit: 5,
});
assert.equal(q9.length, 0, 'abstain-style AND should return empty on hallucinated topic');

const mixed19 = {
  category: 'mixed',
  permitted_evidence: 'kb ch19 + mcp for BV',
  question: 'UFO social ads policy plus BV',
  expected_route: 'mixed',
};
const { hits: h17 } = await runKbSearch(mixed19.question, { limit: 8 });
assert.ok(supportedChapterHit(h17, mixed19), 'mixed ch19 retrieval includes manual ch19');
assert.ok(h17.some((h) => h.source_id.includes('manual_ch_19_')));

const mixed22 = {
  category: 'mixed',
  permitted_evidence: 'kb ch22 + FINDINGS for URL',
  question: 'PC program rules hk.shop orders',
  expected_route: 'mixed',
};
const { hits: h29 } = await runKbSearch(mixed22.question, { limit: 8 });
assert.ok(supportedChapterHit(h29, mixed22), 'mixed ch22 retrieval includes manual ch22');
assert.ok(h29.some((h) => h.source_id.includes('manual_ch_22_')));

const { hits: h22full } = await runKbSearch(
  '超連鎖訂貨程序 (zh) equivalent to English manual ch15 ordering policy?',
  { limit: 8 },
);
assert.ok(
  h22full.some((h) => h.chunk_id === 'manual_ch_15_d742c815#2'),
  'full alias eval question retrieves ch15#2',
);

const { hits: h22zh, aliasBridge } = await runKbSearch('超連鎖訂貨程序', { limit: 8 });
assert.equal(aliasBridge, 'product ordering procedures manual chapter 15');
assert.ok(h22zh.some((h) => h.source_id.includes('manual_ch_15_')), 'zh-only alias bridge hits ch15');

const { hits: h27 } = await runKbSearch('Template language for B2B outreach (no product table)?', {
  limit: 8,
});
assert.ok(
  h27.some((h) => h.source_id === 'obs_0ac326d5cfe0'),
  'template outreach retrieves Templates/b2b-prospect',
);
assert.ok(
  h27.some((h) => h.chunk_id === 'obs_7370808e3a2c#6'),
  'template outreach retrieves 02-B2B USP chunk',
);
assert.ok(
  (await runKbSearch('SRP and promo price for a named catalog SKU this week?', { limit: 8 })).hits
    .length === 0,
  'commercial trap query returns no kb hits',
);
assert.ok(
  (await runKbSearch('What is the BV of Isotonix on the US shop.com consumer site?', { limit: 8 }))
    .hits.length === 0,
  'wrong-family US shop BV returns no kb hits',
);

console.log('test-kb-search-query.mjs: ok');