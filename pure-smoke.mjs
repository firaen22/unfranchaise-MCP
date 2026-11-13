import assert from 'node:assert';
import { actionUrl, Actions } from './lib/urls.js';
import {
  form1000QualifyingOrders,
  sammQualificationSummary,
  cartLineTotals,
  ibvPercentApprox,
  skuVariant,
  MONTHLY_IBV_CAP_MA_SA,
} from './lib/volume.js';
import { DryRunError, requireConfirm } from './lib/confirm.js';
import { assertValidCookie, parseLocaleNumber, parsePositiveIntQty } from './lib/validate.js';
import { parseCartSummary } from './lib/client.js';
import { load as loadCheerio } from 'cheerio';
import { callTool, TOOL_DEFINITIONS } from './lib/tools.js';
import { cookieStatus } from './lib/client.js';
import { parseCheckoutPage, checkoutMapBlocker } from './lib/parse-checkout.js';
import {
  NOT_LIVE_SYNTHETIC_FIELD_NAMES,
  capturedBillShipUsable,
  fieldNamesFromParsed,
  loadLiveBillShip,
  loadLiveExpressPay,
  loadSyntheticBillShip,
  resolveOfflineBillShip,
} from './lib/billship-fixtures.js';
import fs from 'node:fs';
import path from 'node:path';
import { redactActionString, redactSessionTokensInText, redactSessionTokensInUrl } from './lib/redact.js';
import { parseDataActionLinks } from './lib/parse-forms.js';
import { assertSafeFixturePath } from './lib/form1000-sheet.js';

assert.match(actionUrl(Actions.ordering), /action=shopping\.unfOrdering/);
assert.match(Actions.product('HK1410IBV'), /skuID=HK1410IBV/);
assert.equal(new URL(Actions.product('X/Y')).searchParams.get('skuID'), 'X/Y');

assert.equal(cartLineTotals('IBV', { ibvPoints: 10 }).bvTotal, 0);
assert.equal(cartLineTotals('IBV', { ibvPoints: 10 }).ibvTotal, 10);
assert.equal(cartLineTotals('BV', { bvPoints: 5 }).bvTotal, 5);

assert.equal(form1000QualifyingOrders([800, 800]).meetsRule, true);
assert.equal(form1000QualifyingOrders([500]).meetsRule, false);
assert.throws(() => form1000QualifyingOrders(['100', '100']), /must be a finite number/);
assert.throws(() => assertSafeFixturePath('../fixtures/form1000-sheet.example.csv'), /must not contain/);
assert.throws(() => assertSafeFixturePath('/tmp/form1000-sheet.csv'), /within the repository root/);
assert.throws(() => sammQualificationSummary({ ibv: 0, bvExclusive: 0, hasHsl: 'false' }));

const samm = sammQualificationSummary({ ibv: 300, bvExclusive: 2500, hasHsl: true });
assert.equal(samm.likelyQualified, true);

assert.ok(Math.abs(ibvPercentApprox(50, 200) - 25) < 0.01);
assert.equal(skuVariant('HK1410IBV'), 'IBV');
assert.equal(MONTHLY_IBV_CAP_MA_SA, 500);

assert.throws(() => requireConfirm({ confirm: false }, 'test'), DryRunError);
assert.doesNotThrow(() => requireConfirm({ confirm: true }, 'test'));

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error('dry-run must not fetch network');
};
const dry = await callTool('unf_cart_add', { skuID: 'X', qty: 1 });
globalThis.fetch = originalFetch;
const dryParsed = JSON.parse(dry.content[0].text);
assert.ok(dryParsed.dryRun);
assert.match(dryParsed.preview?.productUrl ?? '', /action=shopping\.unfProduct&skuID=/);

let unexpectedCartUpdateFetch = false;
const savedCartUpdateFetch = globalThis.fetch;
globalThis.fetch = async () => {
  unexpectedCartUpdateFetch = true;
  throw new Error('cart_update dry-run must not fetch network');
};
const cartUpdateDry = await callTool('unf_cart_update', { skuID: 'X', qty: 2 });
globalThis.fetch = savedCartUpdateFetch;
assert.equal(unexpectedCartUpdateFetch, false);
const cartUpdateParsed = JSON.parse(cartUpdateDry.content[0].text);
assert.equal(cartUpdateParsed.dryRun, true);
assert.equal(cartUpdateParsed.preview.qty, 2);
assert.equal(cartUpdateParsed.preview.remove, false);
assert.match(cartUpdateParsed.preview.url, /action=shopping\.unfUpdateCart/);

const cartRemove = JSON.parse((await callTool('unf_cart_update', { skuID: 'X', remove: true })).content[0].text);
assert.equal(cartRemove.preview.qty, 0);
assert.equal(cartRemove.preview.remove, true);
assert.throws(() => parsePositiveIntQty(0));

const form1000Draft = await callTool('unf_form1000_draft', {});
const form1000DraftText = form1000Draft.content[0].text;
assert.match(form1000DraftText, /forms\.unf1000Update/);
assert.match(form1000DraftText, /forms\.unf1000Assign/);
assert.match(form1000DraftText, /HK\$1,500/);
assert.match(form1000DraftText, /No network request/);

let form1000OptimiserFetched = false;
const savedForm1000Fetch = globalThis.fetch;
globalThis.fetch = async () => {
  form1000OptimiserFetched = true;
  throw new Error('form1000 optimiser must not fetch network');
};
try {
  const form1000Optimised = await callTool('unf_form1000_optimise', {
    rows: [
      { sku: 'SMOKE-1', qty: 1, lineProductTotalHkd: 1600, alreadyPlaced: false },
      { sku: 'SMOKE-2', qty: 1, lineProductTotalHkd: 1600, alreadyPlaced: false },
    ],
    confirm: true,
  });
  assert.equal(form1000OptimiserFetched, false);
  assert.equal(form1000Optimised.isError, undefined);
  assert.equal(JSON.parse(form1000Optimised.content[0].text).submitted, false);
} finally {
  globalThis.fetch = savedForm1000Fetch;
}

const report = await callTool('unf_report_url', { reportName: 'personalVolume' });
assert.match(JSON.parse(report.content[0].text).url, /reports\.unfReportCriteria/);
assert.match(JSON.parse(report.content[0].text).url, /reportName=personalVolume/);
const missingReport = await callTool('unf_report_url', {});
assert.equal(missingReport.isError, true);

const session = await callTool('unf_session_status', {});
const parsed = JSON.parse(session.content[0].text);
assert.equal(typeof parsed.configured, 'boolean');

assert.ok(TOOL_DEFINITIONS.length >= 8);
assert.ok(TOOL_DEFINITIONS.every((t) => t.name.startsWith('unf_')));

const status = cookieStatus();
assert.equal(status.configured, Boolean(process.env.UNF_COOKIE || process.env.UNF_COOKIE_FILE));

assert.throws(() => assertValidCookie('a\nb'), /invalid characters/);
assert.equal(parseLocaleNumber('1,234.50'), 1234.5);
const cart = parseCartSummary(loadCheerio('<html>IBV總數 1,234.50 業績點數總額 0</html>'));
assert.equal(cart.ibvTotal, 1234.5);
assert.throws(() => parsePositiveIntQty(-1));

const syntheticHtml = fs.readFileSync(
  path.join('fixtures', 'checkout-billship.synthetic.html'),
  'utf8',
);
const checkout = parseCheckoutPage(loadCheerio(syntheticHtml));
assert.ok(checkout.stepHints.includes('pickup'));
assert.ok(checkout.formCount >= 1);
assert.ok(checkout.forms[0].fields.some((f) => f.name === 'pickUpOrder'));
assert.ok(parseCheckoutPage(loadCheerio('<p>親自提貨</p>')).stepHints.includes('pickup'));
assert.ok(parseCheckoutPage(loadCheerio('<p>提貨</p>')).stepHints.includes('pickup'));

const fixtureDir = path.join('fixtures');
const syntheticOnly = loadSyntheticBillShip(fixtureDir);
assert.equal(syntheticOnly.source, 'synthetic_fixture');
assert.ok(fieldNamesFromParsed(syntheticOnly).includes('pickUpOrder'));

const live = loadLiveBillShip(fixtureDir);
assert.equal(live.source, 'live_redacted_fixture');
assert.equal(live.live, false);
assert.equal(live.pageTitle, '送貨與付款資訊 | 超連鎖');
assert.equal(live.baseline.form.name, 'billShip');
assert.equal(live.baseline.form.action, 'index.cfm?action=orders.unfBillShip');
assert.equal(live.baseline.submit.clicked, false);
assert.equal(live.baseline.submit.name, null);
assert.equal(live.baseline.submit.id, 'btnSubmit');
const liveNames = live.baseline.fields.map((field) => field.name);
for (const syntheticName of NOT_LIVE_SYNTHETIC_FIELD_NAMES) {
  assert.ok(!liveNames.includes(syntheticName), syntheticName);
}
for (const requiredName of ['shipType', 'pcid', 'contactPhone', 'shipEmail', 'pickUp', 'shpfirstName', 'shpPCode', 'mCountry']) {
  assert.ok(liveNames.includes(requiredName), requiredName);
}
assert.deepEqual(
  live.baseline.fields.find((field) => field.name === 'shipType').options.map((option) => option.value),
  ['1', '3', '2'],
);
assert.equal(live.baseline.fields.find((field) => field.name === 'orderDirective').observedValue, 'SO');
assert.ok(live.stepHints.includes('pickup'));
assert.ok(!live.stepHints.includes('empty_cart'));
assert.ok(!live.stepHints.includes('login_required'));
const parsedLiveNames = new Set(fieldNamesFromParsed(live));
for (const name of liveNames) {
  assert.ok(parsedLiveNames.has(name), `html missing ${name}`);
}
assert.ok(parsedLiveNames.has('btnSubmit'));
const orderDirective = live.forms[0].fields.find((field) => field.name === 'orderDirective');
assert.equal(orderDirective.redacted, true);
assert.equal(JSON.stringify(orderDirective).includes('SO'), false);
assert.equal(live.forms[0].fields.find((field) => field.name === 'shpPCode').id, 'postal');

const express = loadLiveExpressPay(fixtureDir);
assert.equal(express.pageTitle, '超連鎖事業帳戶 | 超連鎖');
assert.equal(express.baseline.form.name, 'finalPreview');
assert.equal(express.baseline.form.action, 'index.cfm?action=express.unfProcessExpressOrder');
assert.equal(express.baseline.submit.clicked, false);
assert.equal(express.baseline.pickupControls, false);
assert.ok(!express.stepHints.includes('pickup'));
assert.ok(express.stepHints.includes('shipping'));
const expressNames = express.baseline.fields.map((field) => field.name);
for (const requiredName of ['shippingSelection1', 'paymentType', 'ccNum', 'cvv', 'empty1', 'empty2', 'deliveryTime6', 'vendorCode']) {
  assert.ok(expressNames.includes(requiredName), requiredName);
}
assert.equal(express.baseline.fields.find((field) => field.name === 'cvv').filled, false);
assert.deepEqual(
  express.baseline.fields.find((field) => field.name === 'shippingSelection1').options.map((option) => option.value),
  ['44', '45'],
);
const parsedExpressNames = new Set(fieldNamesFromParsed(express));
for (const name of expressNames) {
  assert.ok(parsedExpressNames.has(name), `express html missing ${name}`);
}
assert.equal(express.forms[0].dataAction, 'express.unfProcessExpressOrder');
for (const file of [
  'fixtures/checkout-billship.live.redacted.html',
  'fixtures/checkout-express-pay.live.redacted.html',
  'fixtures/checkout-billship.live.redacted.json',
  'fixtures/checkout-express-pay.live.redacted.json',
]) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /@|CFID|CFTOKEN|cf_clearance|__cf_bm=|\/workspace|\/home\/box/);
  assert.doesNotMatch(text, /name="pickUpOrder"|name="continueCheckout"|name="shipFirstName"/);
}
assert.doesNotMatch(fs.readFileSync('fixtures/checkout-express-pay.live.redacted.html', 'utf8'), /提貨|取貨|HK\$/);

assert.equal(checkoutMapBlocker(parseCheckoutPage(loadCheerio('<html><body>main.unfLogin permissionViolation</body></html>'))), 'login_required');
assert.equal(checkoutMapBlocker(parseCheckoutPage(loadCheerio('<html><body>你的購物車是空的</body></html>'))), 'empty_cart');
assert.equal(capturedBillShipUsable({ stepHints: ['login_required'], fieldCount: 3, forms: [] }), false);
assert.equal(
  capturedBillShipUsable({
    stepHints: [],
    fieldCount: 2,
    forms: [{ fields: [{ name: 'shipType' }, { name: 'pickUpOrder' }] }],
  }),
  false,
);
const ignoredSyntheticCapture = resolveOfflineBillShip(fixtureDir, {
  stepHints: ['shipping'],
  fieldCount: 1,
  forms: [{ fields: [{ name: 'pickUpOrder' }] }],
});
assert.equal(ignoredSyntheticCapture.source, 'live_redacted_fixture');
const usableCapture = resolveOfflineBillShip(fixtureDir, {
  stepHints: ['shipping', 'pickup'],
  fieldCount: 3,
  forms: [{ name: 'billShip', fields: [{ name: 'shipType' }, { name: 'contactPhone' }, { name: 'pickUp' }] }],
});
assert.equal(usableCapture.source, 'captured_fixture');
assert.equal(usableCapture.live, false);
assert.ok(usableCapture.baseline.fields.some((field) => field.name === 'shpfirstName'));

const billMap = await callTool('unf_checkout_billship_map', { useFixture: true });
const billParsed = JSON.parse(billMap.content[0].text);
assert.equal(billParsed.source, 'live_redacted_fixture');
assert.equal(billParsed.live, false);
assert.notEqual(billParsed.source, 'synthetic_fixture');
assert.ok(billParsed.baseline.fields.some((field) => field.name === 'shipType'));
assert.ok(!billParsed.baseline.fields.some((field) => field.name === 'pickUpOrder'));
assert.equal(billParsed.expressPayFixture.baseline.form.action, 'index.cfm?action=express.unfProcessExpressOrder');
assert.equal(billParsed.pageTitle, '送貨與付款資訊 | 超連鎖');

const net = await callTool('unf_network_patterns', {});
const netParsed = JSON.parse(net.content[0].text);
assert.ok(netParsed.navigation.checkout_entry?.action === 'orders.unfBillShip');
assert.ok(netParsed.confirmedLiveActions.some((row) => row.action === 'orders.unfBillShip' && row.method === 'POST'));
assert.ok(netParsed.confirmedLiveActions.some((row) => row.action === 'express.unfProcessExpressOrder'));
assert.ok(netParsed.confirmedLiveActions.some((row) => row.action === 'orders.unfBillShipAJAX'));
const unverifiedNames = netParsed.unverifiedCheckoutActions.map((row) => row.action);
assert.deepEqual(unverifiedNames, ['orders.unfBillShipUpdate', 'orders.unfOrderReview', 'orders.unfPayment']);
assert.ok(unverifiedNames.every((action) => !netParsed.confirmedLiveActions.some((row) => row.action === action)));
assert.match(netParsed.markdown, /Not observed — unverified/);
assert.match(netParsed.markdown, /cf_clearance/);

const checkoutMd = fs.readFileSync('CHECKOUT.md', 'utf8');
const networkMd = fs.readFileSync('NETWORK.md', 'utf8');
assert.match(checkoutMd, /shipType/);
assert.match(checkoutMd, /shpfirstName/);
assert.match(checkoutMd, /親自提貨/);
assert.match(checkoutMd, /not live/i);
const unverifiedSection = networkMd.split('## Not observed')[1].split('## ')[0];
assert.match(unverifiedSection, /orders\.unfBillShipUpdate/);
assert.match(unverifiedSection, /orders\.unfOrderReview/);
assert.match(unverifiedSection, /orders\.unfPayment/);
assert.doesNotMatch(unverifiedSection, /orders\.unfBillShipAJAX/);
const confirmedSection = networkMd.split('## Confirmed live')[1].split('## ')[0];
assert.match(confirmedSection, /orders\.unfBillShipAJAX/);
assert.match(confirmedSection, /express\.unfProcessExpressOrder/);
assert.doesNotMatch(confirmedSection, /unfBillShipUpdate/);

assert.match(
  redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?CFID=secret&action=x'),
  /CFID=\[REDACTED\]/,
);
assert.doesNotMatch(redactSessionTokensInUrl('https://hk.unfranchise.com/?CFID=secret'), /secret/);
assert.doesNotMatch(
  redactSessionTokensInUrl('https://hk.unfranchise.com/?%43FID=enc&%43FTOKEN=tok2'),
  /enc|tok2/,
);
assert.doesNotMatch(
  redactSessionTokensInUrl('https://hk.unfranchaise.com/?%25=x&%43FID=TOKEN_SENTINEL'),
  /TOKEN_SENTINEL/,
);
assert.doesNotMatch(
  redactActionString('orders.unfBillShip&CFID=SYNTHETIC_TOKEN'),
  /SYNTHETIC_TOKEN/,
);
assert.doesNotMatch(
  redactActionString('index.cfm?action=orders.unfBillShip&C%46ID=COOKIE_CANARY'),
  /COOKIE_CANARY/,
);
assert.doesNotMatch(
  redactActionString('orders.unfBillShip&C%46TOKEN=TOKEN2_CANARY'),
  /TOKEN2_CANARY/,
);
assert.doesNotMatch(
  redactActionString('orders.unfBillShip&email=EMAIL_CANARY'),
  /EMAIL_CANARY/,
);
assert.doesNotMatch(
  redactActionString('orders.unfBillShip&contactPhone=PHONE_CANARY&cvv=CVV_CANARY&shpAddr1=ADDR_CANARY'),
  /PHONE_CANARY|CVV_CANARY|ADDR_CANARY/,
);
assert.doesNotMatch(
  redactSessionTokensInUrl(
    'https://hk.unfranchise.com/index.cfm?next=index.cfm?C%46ID=TOKEN_CANARY&C%46TOKEN=TOKEN2_CANARY',
  ),
  /TOKEN_CANARY|TOKEN2_CANARY/,
);
assert.doesNotMatch(
  redactSessionTokensInUrl(
    'https://hk.unfranchise.com/index.cfm?action=orders.unfBillShip&next=index.cfm%3FC%2546ID%3DCFID_CANARY%26C%2546TOKEN%3DCFTOKEN_CANARY',
  ),
  /CFID_CANARY|CFTOKEN_CANARY/,
);
assert.doesNotMatch(redactSessionTokensInText('var CFID = "SESSION_SENTINEL";'), /SESSION_SENTINEL/);

const dataActions = parseDataActionLinks(
  loadCheerio('<a data-action="orders.unfBillShip&CFID=leak">Continue</a>'),
);
assert.doesNotMatch(dataActions[0].action, /leak/);
assert.equal(dataActions[0].text, '[REDACTED]');

const savedCookie = process.env.UNF_COOKIE;
const savedCookieFile = process.env.UNF_COOKIE_FILE;
const savedFetch = globalThis.fetch;
process.env.UNF_COOKIE = 'CFID=stub-session; CFTOKEN=stub-session';
delete process.env.UNF_COOKIE_FILE;
try {
  globalThis.fetch = async () => ({
    status: 200,
    headers: { get: () => null },
    text: async () => '<html><title>Login</title><body>main.unfLogin permissionViolation</body></html>',
  });
  const blocked = JSON.parse((await callTool('unf_checkout_billship_map', {})).content[0].text);
  assert.equal(blocked.networkBlocked, true);
  assert.equal(blocked.blocker, 'login_required');
  assert.equal(blocked.live, false);
  assert.equal(blocked.source, 'live_redacted_fixture');
  assert.ok(blocked.baseline.fields.some((field) => field.name === 'shipType'));
  assert.ok(!blocked.baseline.fields.some((field) => field.name === 'pickUpOrder'));
  assert.doesNotMatch(JSON.stringify(blocked), /stub-session/);

  globalThis.fetch = async () => ({
    status: 200,
    headers: { get: () => null },
    text: async () => '<html><body>你的購物車是空的</body></html>',
  });
  const emptyCart = JSON.parse((await callTool('unf_checkout_billship_map', {})).content[0].text);
  assert.equal(emptyCart.blocker, 'empty_cart');
  assert.equal(emptyCart.live, false);
  assert.equal(emptyCart.source, 'live_redacted_fixture');

  const liveHtml = fs.readFileSync('fixtures/checkout-billship.live.redacted.html', 'utf8');
  globalThis.fetch = async () => ({
    status: 200,
    headers: { get: () => null },
    text: async () => liveHtml,
  });
  const liveNet = JSON.parse((await callTool('unf_checkout_billship_map', {})).content[0].text);
  assert.equal(liveNet.source, 'network');
  assert.equal(liveNet.live, true);
  assert.equal(liveNet.networkBlocked, undefined);
  assert.ok(liveNet.forms[0].fields.some((field) => field.name === 'shipType'));
  assert.ok(!liveNet.forms[0].fields.some((field) => field.name === 'pickUpOrder'));
  assert.equal(liveNet.expressPayFixture.live, false);
} finally {
  globalThis.fetch = savedFetch;
  if (savedCookie === undefined) delete process.env.UNF_COOKIE;
  else process.env.UNF_COOKIE = savedCookie;
  if (savedCookieFile === undefined) delete process.env.UNF_COOKIE_FILE;
  else process.env.UNF_COOKIE_FILE = savedCookieFile;
}

console.log('pure-smoke: ok', TOOL_DEFINITIONS.length, 'tools');
