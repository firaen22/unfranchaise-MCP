#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  classifyChunkText,
  detectCommercialNumeric,
  detectKbSearchBlockedQuery,
  detectOrderUrl,
  knowledgePayloadCommercialOrOrderLeak,
  textCommercialOrOrderLeak,
} from './kb/lib/classify.js';
import { runKbSearch } from './kb/lib/kb-search-run.js';
import { stripObsidianWikilinks, chunkMarkdown } from './kb/lib/chunk-markdown.js';
import { chunkManualPageHtml } from './kb/ingest/manual-chapters.js';

const commercial = [
  'Price 1288',
  'price 1288',
  'discount 20%',
  'discount 20',
  '50 percent off',
  '零售價1288',
  '價錢1288',
  '批發價：181',
  '超連鎖成本價：181',
  '超連鎖成本價: 181',
  '超連鎖成本價=181',
  '售價：+181',
  '售價為181',
  '會員價 1,288',
  '會員價：181',
  '零售價：1,288',
  '售價售價１２８８',
  'BV：９９',
  'BV: **99**',
  'Starter kit pitch. Price 1288.',
  'SRP: -181',
  'SRP: 181',
  'Price: -29.99',
  '{"ibvPoints":"1e2"}',
  'BV: +16',
  '{"bvPoints":"+16"}',
  '{"ibvPercent":"+8.8397"}',
  'SRP: +181',
  'Price: +29.99',
  '批發價為181',
  'HK$ +181',
  'IBV (points): 16',
  'Business Volume (BV): 16',
  'UC (HKD): 181',
  'SRP (HKD): 181',
  'Price: EUR 29.99',
  'SRP (HK$): 181',
  'BV equals 16',
  '售價是181',
  '售價：一百八十一港元',
  '售價每瓶181元',
  'SRP: one hundred eighty-one Hong Kong dollars.',
  '售價為一百八十一元',
  'HK%24181',
  'SRP is one hundred eighty-one Hong Kong dollars.',
  'IBV points = 16',
  'BV: + 16',
  'BV value: 16',
  'IBV percentage: 8.8397%',
  'IBV percentage equals 8.8397%',
  'SRP (USD): 181',
  'BV value = 16',
  'Business Volume: +16',
  'Business Volume = 16',
  'UC value: 181',
  '批發價=181',
  'UC (HK$): 181',
  'BV (points) = 16',
  'IBV (points) = 16',
  'BV: .5',
  'SRP: .5',
  'Price: €29.99',
  'BV: +.5',
  'SRP: +.5',
  'BV = .5',
  'IBV = .5',
  'UC = .5',
  'Price: £29.99',
  'Price = €29.99',
  'Price is £29.99',
  'BV value is 16',
  'The IBV points are 16.',
  'The IBV percentage is 8.8397%.',
  'SRP = €181',
  'SRP value: 181',
  'SRP value: €181',
  'SRP: €181',
  'IBV points is 16',
  'BV value equals 16',
  'Business Volume (BV) = 16',
  'UC (HKD) = 181',
  'SRP equals 181.',
  'Price equals 181',
  'Price equals €29.99',
  'Price is EUR 29.99',
  'IBV: -.5',
  'Price (USD): 29.99',
  'IBV points equal 16',
  'UC: €181',
  'Price: ¥181',
  'SRP: ¥181',
  'SRP = ¥181',
  'Business Volume is +16',
  'IBV points equals 16',
  'BV points of 16',
  'BV value of 16',
  'SRP value is 181',
  'SRP value is €181',
  'SRP is €181',
  'SRP value equals 181',
  'SRP value of 181',
  'UC (HK$) = 181',
  'SRP (HK$) = 181',
  'BV: sixteen',
  'IBV：十六',
  'IBV is sixteen.',
  'SRP: sixteen',
  'SRP = sixteen',
  'Price = sixteen',
  'Business Volume: sixteen',
  'Business Volume is sixteen',
  'Price: zero',
  'BV: zero',
  'SRP: zero',
  'SRP is sixteen.',
  'SRP is a hundred.',
  'SRP will be sixteen.',
  'SRP is HKD minus sixteen',
  'SRP sixteen',
  'Price sixteen',
  'BV sixteen',
  'SRP amounts to a hundred.',
  'SRP = HKD a hundred',
  'SRP equals £sixteen',
  'SRP:\u200Bsixteen',
  'SRP has been set to sixteen.',
  'The retail price has been reduced to sixteen Hong Kong dollars.',
  'BV points = sixteen',
  'SRP value = sixteen',
  'SRP is a million',
  'SRP is now sixteen.',
  'The price is currently sixteen.',
  'SRP is at least sixteen.',
  'Wholesale price is sixteen.',
  'Wholesale cost: sixteen',
  'Wholesale cost of HKD sixteen.',
  'Discount: twenty percent.',
  'Discount is twenty percent.',
  'Discount is 20%',
  'Sixteen IBV per bottle.',
  'Sixteen IBV.',
  'SRP is listed as sixteen.',
  'The bottle is priced at sixteen Hong Kong dollars.',
  'The bottle is priced at 181 Hong Kong dollars.',
  'This item earns sixteen IBV.',
  'This SKU has sixteen IBV.',
  'This product costs 181 Hong Kong dollars per bottle.',
  'Discount: 20%',
  'Discount: 20 percent.',
  'The bottle costs £16.',
  'The bottle costs sixteen pounds.',
  'The bottle costs 16 pounds.',
  'The bottle sells for sixteen pounds.',
  'SRP ranges from sixteen to twenty.',
  'Save twenty percent on this product.',
  'Get twenty percent off today.',
  'twenty percent off selected SKUs.',
  'The kit offered at sixteen pounds.',
  'The recommended retail price per bottle for customers in Hong Kong is sixteen.',
  'This product sells for sixteen.',
  'This product costs sixteen.',
  'SRP of a hundred',
  'SRP costs sixteen.',
  'This product costs sixteen Hong Kong dollars per bottle.',
  'This product costs twenty-one Hong Kong dollars per unit.',
  'This item earns twenty-one IBV.',
  'Price is zero.',
  'SRP equals one hundred eighty-one',
  'IBV points are sixteen',
  'SRP amounts to sixteen',
  'BV points: sixteen',
  'SRP value equals sixteen',
  'SRP: HKD sixteen',
  'Price: minus sixteen',
  'Price: £sixteen',
  'IBV points equal sixteen',
  'SRP: negative sixteen',
  'BV is negative sixteen',
  'BV = HKD sixteen',
  'SRP: a hundred and eighty-one',
  'SRP of sixteen',
  'BV has a value of sixteen',
  'Price: HKD minus sixteen',
  'SRP value: sixteen',
  'SRP: a thousand',
  'Price = HKD minus sixteen',
  'SRP totals sixteen.',
  'Price amounts to minus sixteen.',
  'BV equals a hundred',
  'SRP value is HKD sixteen',
  'SRP amounts to HKD sixteen',
  'Price = a hundred',
  'BV = a hundred',
  '批發價：一百八十一元',
  '零售價是一百八十一元。',
];

for (const s of commercial) {
  assert.ok(detectCommercialNumeric(s), `commercial: ${s}`);
  assert.equal(classifyChunkText(s, { defaultClass: 'operator_synthesis' }), 'commercial_numeric');
}

const connectorCommercial = [
  'SRP is €181',
  'Price is EUR 29.99',
  'BV value equals 16',
  'IBV percentage equals 8.8397%',
  'Product allocation note. BV amount: 16.',
  'IBV percentage of 8.8397',
  'IBV percent: 8.8397',
  'Price amount is 181',
  'PBV: 50',
  'PBV is 50',
  'HK1410 業績點數：16。',
  '獎勵業績點數：16。',
  'SRP amounts to 181',
  'SRP totals 181',
  'Price comes to 29.99',
  'BV points 16',
];
for (const s of connectorCommercial) {
  assert.ok(detectCommercialNumeric(s), `connector commercial: ${s}`);
}

// Structural cases: every label/verb pair, either proximity direction, and edges.
for (const label of ['SRP', 'Price', 'BV', 'IBV', 'UC', 'PBV', 'GBV', 'PIBV']) {
  for (const verb of ['amounts to', 'totals', 'comes to', 'was', 'were']) {
    assert.equal(classifyChunkText(`${label} ${verb} -0.5`), 'commercial_numeric');
  }
  for (const number of ['0', '1', '-16', '+.5', '１，２８８']) {
    for (const s of [
      `${label} allocation on the current official schedule ${number}`,
      `${number} allocated units contribute toward ${label}`,
    ]) assert.equal(classifyChunkText(s), 'commercial_numeric', s);
  }
}
for (const s of [
  '業績點數為１６',
  '獎勵業績點數本次為0',
  '16 是本次業績點數',
  'PIBV allocation\u200b on the current official schedule 16',
  'PIBV one two three four five six 16',
  '16 one two three four five six GBV',
  `PIBV ${'longword'.repeat(1000)} 16`,
]) assert.equal(classifyChunkText(s), 'commercial_numeric', s);

const benign = [
  'Advertising guidelines for Hong Kong UFO posts.',
  'The SRP field in the compensation plan is defined without quoting live amounts.',
  '', null, undefined, NaN,
  'PBV allocation for SKU HK1410 is described without amounts.',
  '16 one two three four five six seven GBV',
  'PIBV one two three four five six seven 16',
  'The GBV value is null; the PIBV value is undefined; SRP is NaN.',
];
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

const nestedBvMd = '## BV\n### HK1410\n16\n';
const nestedSec = chunkMarkdown(nestedBvMd, { docTitle: 'bv-nested' }).find((s) => s.heading === 'HK1410');
assert.ok(nestedSec?.text.includes('## BV'), 'subsection inherits parent BV heading');
assert.equal(classifyChunkText(nestedSec.text, { defaultClass: 'operator_synthesis' }), 'commercial_numeric');

for (const s of [
  'Starter kit 181 HKD',
  '本週85折',
  'Business Volume: 16',
  'bvPoints 16',
  '{"bvPoints":16}',
  '{"srpHkd":181}',
  '{"retailTotalHkd":181}',
  '{"bvPoints":"16"}',
  '{"srpHkd":"181"}',
  '{"srpHkd":"1,288.00"}',
  'BV points: 16',
  'UC points: 16',
  '{"ucPoints":16}',
  '{"ucHkd":181}',
  '{"promoPriceHkd":150}',
  '{"ibvPercent":8.8397}',
  '{"srpHkd":-181}',
  '{"bvPoints":" 16 "}',
  'BV: -16',
  '{"bvPoints":"-16"}',
  '{"ucHkd":"-181"}',
  '{"ibvPoints":"-16"}',
  'BV (points): 16',
  'Price (HKD): 181',
]) {
  assert.ok(detectCommercialNumeric(s), `commercial: ${s}`);
}

assert.ok(
  detectOrderUrl('https://hk.unfranchise.com/index.cfm?action=express.unfExpressPay'),
  'express checkout URL blocked',
);
assert.ok(
  detectOrderUrl('https://hk.unfranchise.com/index.cfm?action=express%2EunfExpressPay'),
  'percent-encoded express checkout URL blocked',
);
assert.ok(detectOrderUrl('https://www.shopglobal.com/alice'), 'shopglobal slug storefront blocked');
assert.ok(detectOrderUrl('Order here: https://hk.shop.com/'), 'hk.shop.com root blocked');
assert.ok(detectOrderUrl('Buy here: https://www.shop.com/alice'), 'www.shop.com slug blocked');
assert.ok(detectOrderUrl('/index.cfm?action=orders.unfBillShip'), 'relative checkout action blocked');
assert.ok(detectOrderUrl('index.cfm?action=orders.unfBillShip'), 'path-relative checkout action blocked');
assert.equal(
  classifyChunkText('Checkout /index.cfm?action=orders.unfBillShip here', { defaultClass: 'policy' }),
  'order_url',
);
assert.ok(detectOrderUrl('Cart: /index.cfm?action=shopping.unfViewCart'));
assert.equal(classifyChunkText('BV is +16', { defaultClass: 'operator_synthesis' }), 'commercial_numeric');
assert.ok(detectOrderUrl('index.cfm?skuID=HK1410&action=shopping.unfProduct'));
assert.ok(detectOrderUrl('https://www.marketamerica.com/checkout'));
assert.ok(detectOrderUrl('index.cfm?action=orders.productReorder'));
assert.ok(detectOrderUrl('https://hk.unfranchise.com/index.cfm?action=autoship.unfAutoShip'));
assert.ok(detectOrderUrl('https://hk.unfranchise.com/index.cfm?action=autoship.saAutoShip'));
assert.ok(detectOrderUrl('index.cfm?action=shopping.unfUpdateCart'));
assert.ok(detectOrderUrl('orders.unfAddCartAJAX'));
assert.ok(detectOrderUrl('action=express.unfProcessExpressOrder'));
assert.ok(detectOrderUrl('shopping.unfOrdering'));
assert.ok(detectOrderUrl('shopping.unfViewCart'));
assert.ok(detectOrderUrl('orders.unfBillShip'));
assert.ok(
  detectOrderUrl('Manage recurring orders: /index.cfm?action=orders.unfManageUniversalAuto'),
);
assert.ok(detectOrderUrl('orders.productReorder'));
assert.ok(detectOrderUrl('autoship.unfAutoShip'));
assert.equal(
  classifyChunkText('through your HK.UnFranchise.com account', { defaultClass: 'policy' }),
  'policy',
);
assert.equal(classifyChunkText('Shop.com 線上', { defaultClass: 'operator_synthesis' }), 'operator_synthesis');
assert.ok(detectCommercialNumeric('BV points: +16'));
assert.ok(detectCommercialNumeric('BV:\u200b16'), 'ZWSP inside BV colon span');
assert.ok(detectCommercialNumeric('SRP:\u200b181'), 'ZWSP inside SRP price');
assert.ok(detectCommercialNumeric('{"\\u0062vPoints":16}'));
assert.ok(
  detectKbSearchBlockedQuery('SRP and promo price for a named catalog SKU this week?'),
  'SRP promo trap',
);
assert.ok(
  !(await runKbSearch('policy SRP and promo price for SKU', { limit: 8 })).hits.length &&
    detectKbSearchBlockedQuery('policy SRP and promo price for SKU'),
  'policy does not unblock SRP+promo commerce query',
);

const manualNestedBv = chunkManualPageHtml(
  '<article><h2>BV</h2><h3>HK1410</h3><p>16</p></article>',
  { docTitle: 'manual', chapter: '98' },
);
assert.equal(
  manualNestedBv[0]?.claim_class,
  'commercial_numeric',
  'production manual ingest preserves ancestor BV heading for HK1410',
);
assert.ok(
  detectCommercialNumeric(manualNestedBv[0]?.text ?? ''),
  'manual nested BV/HK1410 text detectable',
);

const manualNestedBvTable = chunkManualPageHtml(
  '<article><h2>BV</h2><h3>HK1410</h3><table><tr><td>16</td></tr></table></article>',
  { docTitle: 'manual', chapter: '98' },
);
assert.equal(
  manualNestedBvTable.find((c) => c.text.includes('16'))?.claim_class,
  'commercial_numeric',
  'production manual table chunk keeps ancestor BV for HK1410',
);

const bvCitationPayload = JSON.stringify({
  chunk_id: 'manual_ch_25_8a3fd765#1',
  doc_title: 'Definitions',
  doc_version: 'manual-0.4',
  text: 'Business Volume (BV): The numeric value assigned to products and services, which accumulates toward the pay out of commission.',
});
assert.equal(
  knowledgePayloadCommercialOrOrderLeak(bvCitationPayload),
  false,
  'citation JSON: metadata doc_version must not bind to BV text',
);
assert.equal(
  textCommercialOrOrderLeak(`history citation ${bvCitationPayload} end`),
  false,
  'generation haystack: embedded citation JSON field-scoped scan',
);
assert.ok(
  textCommercialOrOrderLeak('prior turn quoted retail SRP is 181 for SKU X'),
  'generation haystack: prose commercial still detected',
);

console.log('test-kb-classify.mjs: ok');
