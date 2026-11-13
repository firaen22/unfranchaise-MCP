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
import { parseCheckoutPage } from './lib/parse-checkout.js';
import fs from 'node:fs';
import path from 'node:path';
import { redactActionString, redactSessionTokensInText, redactSessionTokensInUrl } from './lib/redact.js';
import { parseDataActionLinks } from './lib/parse-forms.js';

assert.match(actionUrl(Actions.ordering), /action=shopping\.unfOrdering/);
assert.match(Actions.product('HK1410IBV'), /skuID=HK1410IBV/);
assert.equal(new URL(Actions.product('X/Y')).searchParams.get('skuID'), 'X/Y');

assert.equal(cartLineTotals('IBV', { ibvPoints: 10 }).bvTotal, 0);
assert.equal(cartLineTotals('IBV', { ibvPoints: 10 }).ibvTotal, 10);
assert.equal(cartLineTotals('BV', { bvPoints: 5 }).bvTotal, 5);

assert.equal(form1000QualifyingOrders([800, 800]).meetsRule, true);
assert.equal(form1000QualifyingOrders([500]).meetsRule, false);
assert.throws(() => form1000QualifyingOrders(['100', '100']), /must be a finite number/);
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

const billMap = await callTool('unf_checkout_billship_map', { useFixture: true });
const billParsed = JSON.parse(billMap.content[0].text);
assert.equal(billParsed.source, 'synthetic_fixture');
assert.equal(billParsed.live, false);

const net = await callTool('unf_network_patterns', {});
const netParsed = JSON.parse(net.content[0].text);
assert.ok(netParsed.navigation.checkout_entry?.action === 'orders.unfBillShip');

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

console.log('pure-smoke: ok', TOOL_DEFINITIONS.length, 'tools');
