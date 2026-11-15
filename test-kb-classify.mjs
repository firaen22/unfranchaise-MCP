#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  classifyChunkText,
  detectCommercialNumeric,
  detectKbSearchBlockedQuery,
} from './kb/lib/classify.js';
import { stripObsidianWikilinks } from './kb/lib/chunk-markdown.js';

const commercial = [
  'Price 1288',
  'price 1288',
  'discount 20%',
  'discount 20',
  '50 percent off',
  '零售價1288',
  '價錢1288',
  '會員價 1,288',
  '售價售價１２８８',
  'BV：９９',
  'BV: **99**',
  'Starter kit pitch. Price 1288.',
];

for (const s of commercial) {
  assert.ok(detectCommercialNumeric(s), `commercial: ${s}`);
  assert.equal(classifyChunkText(s, { defaultClass: 'operator_synthesis' }), 'commercial_numeric');
}

const benign = ['Advertising guidelines for Hong Kong UFO posts.'];
for (const s of benign) {
  assert.equal(detectCommercialNumeric(s), false, `benign: ${s}`);
}

assert.ok(
  detectKbSearchBlockedQuery('SRP and promo price for a named catalog SKU this week?'),
  'SRP promo trap blocked',
);
assert.ok(
  !detectKbSearchBlockedQuery(
    'UFO social ads: policy from manual plus current promo BV for one SKU?',
  ),
  'mixed manual+BV not blocked',
);
assert.equal(stripObsidianWikilinks('02-[[B2B]]/restaurant/plan.md'), '02-B2B/restaurant/plan.md');

console.log('test-kb-classify.mjs: ok');