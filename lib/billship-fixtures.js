import fs from 'node:fs';
import path from 'node:path';
import { load as loadCheerio } from 'cheerio';
import { parseCheckoutPage, checkoutMapBlocker } from './parse-checkout.js';
import { Actions, actionUrl } from './urls.js';

export const NOT_LIVE_SYNTHETIC_FIELD_NAMES = Object.freeze([
  'pickUpOrder',
  'billSameAsShip',
  'shipFirstName',
  'shipLastName',
  'shipAddress1',
  'shipAddress2',
  'shipCity',
  'shipRegion',
  'shipPostalCode',
  'shipPhone',
  'shipCountry',
  'payMethod',
  'orderStep',
  'continueCheckout',
]);

export const LIVE_MAP_HINT =
  'Baseline field names are the redacted 13 Nov 2026 (Asia/Hong_Kong) signed-in browser map with a non-empty cart. Synthetic fixture names are not live. A Node GET can return HTTP 200 login-wall HTML at main.unfLogin&permissionViolation because Cloudflare cf_clearance / __cf_bm is often bound to the browser TLS fingerprint; that HTML is not a field map. An empty cart still loads the checkout URLs but shows 你的購物車是空的 and hides the forms.';

export function fixtureDirFromMeta(metaUrl) {
  return path.join(path.dirname(metaUrl), '..', 'fixtures');
}

export function fieldNamesFromParsed(parsed) {
  const names = [];
  for (const form of parsed?.forms ?? []) {
    for (const field of form.fields ?? []) {
      if (field?.name) names.push(field.name);
    }
  }
  return names;
}

export function capturedBillShipUsable(parsed) {
  if (checkoutMapBlocker(parsed)) return false;
  const names = fieldNamesFromParsed(parsed);
  if (names.some((name) => NOT_LIVE_SYNTHETIC_FIELD_NAMES.includes(name))) return false;
  if (!names.includes('shipType') || !names.includes('contactPhone') || !names.includes('pickUp')) return false;
  return true;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadLiveExpressPay(fixtureDir) {
  const htmlPath = path.join(fixtureDir, 'checkout-express-pay.live.redacted.html');
  const baselinePath = path.join(fixtureDir, 'checkout-express-pay.live.redacted.json');
  const parsed = parseCheckoutPage(loadCheerio(fs.readFileSync(htmlPath, 'utf8')));
  const baseline = readJson(baselinePath);
  return {
    source: 'live_redacted_fixture',
    live: false,
    observedOn: baseline.observedOn,
    timezone: baseline.timezone,
    url: actionUrl(Actions.expressPay),
    ...parsed,
    pageTitle: baseline.pageTitle,
    baseline,
    hint: 'Express-pay map from the same 13 Nov 2026 browser capture. The place-order control was not clicked. This is not a live fetch.',
  };
}

export function loadLiveBillShip(fixtureDir) {
  const htmlPath = path.join(fixtureDir, 'checkout-billship.live.redacted.html');
  const baselinePath = path.join(fixtureDir, 'checkout-billship.live.redacted.json');
  const parsed = parseCheckoutPage(loadCheerio(fs.readFileSync(htmlPath, 'utf8')));
  const baseline = readJson(baselinePath);
  return {
    source: 'live_redacted_fixture',
    live: false,
    observedOn: baseline.observedOn,
    timezone: baseline.timezone,
    url: actionUrl(Actions.billShip),
    ...parsed,
    pageTitle: baseline.pageTitle,
    baseline,
    expressPayFixture: loadLiveExpressPay(fixtureDir),
    notLiveSyntheticNames: [...NOT_LIVE_SYNTHETIC_FIELD_NAMES],
    hint: LIVE_MAP_HINT,
  };
}

export function resolveOfflineBillShip(fixtureDir, capturedParsed) {
  const live = loadLiveBillShip(fixtureDir);
  if (capturedParsed && capturedBillShipUsable(capturedParsed)) {
    return {
      ...capturedParsed,
      source: 'captured_fixture',
      live: false,
      capturedPath: CAPTURED_BILL_SHIP_JSON,
      baseline: live.baseline,
      expressPayFixture: live.expressPayFixture,
      notLiveSyntheticNames: live.notLiveSyntheticNames,
      pageTitle: live.pageTitle,
      hint: 'Local capture passed the non-empty, non-login, non-synthetic checks. The committed baseline remains the 13 Nov 2026 redacted browser map.',
    };
  }
  return live;
}

/** Parser unit-test fixture. Not the live field-name baseline. */
export function loadSyntheticBillShip(fixtureDir) {
  const htmlPath = path.join(fixtureDir, 'checkout-billship.synthetic.html');
  const baselinePath = path.join(fixtureDir, 'checkout-billship.parsed.json');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const parsed = parseCheckoutPage(loadCheerio(html));
  const baseline = readJson(baselinePath);
  return {
    source: 'synthetic_fixture',
    live: false,
    url: actionUrl(Actions.billShip),
    baseline,
    ...parsed,
    hint: 'Synthetic parser fixture only. These names are not the live site. Use the redacted 13 Nov 2026 map.',
  };
}

export const CAPTURED_BILL_SHIP_JSON = 'fixtures/captured/bill_ship.json';
