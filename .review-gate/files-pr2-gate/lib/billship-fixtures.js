import fs from 'node:fs';
import path from 'node:path';
import { load as loadCheerio } from 'cheerio';
import { parseCheckoutPage } from './parse-checkout.js';
import { Actions, actionUrl } from './urls.js';

export function fixtureDirFromMeta(metaUrl) {
  return path.join(path.dirname(metaUrl), '..', 'fixtures');
}

export function loadSyntheticBillShip(fixtureDir) {
  const htmlPath = path.join(fixtureDir, 'checkout-billship.synthetic.html');
  const baselinePath = path.join(fixtureDir, 'checkout-billship.parsed.json');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const parsed = parseCheckoutPage(loadCheerio(html));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return {
    source: 'synthetic_fixture',
    live: false,
    url: actionUrl(Actions.billShip),
    baseline,
    ...parsed,
    hint: 'Set UNF_COOKIE_FILE and retry for live HTML, or npm run capture',
  };
}

export const CAPTURED_BILL_SHIP_JSON = 'fixtures/captured/bill_ship.json';
