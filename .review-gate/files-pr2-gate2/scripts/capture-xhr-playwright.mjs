#!/usr/bin/env node
/**
 * Log XHR/fetch/document requests while opening checkout pages (needs UNF_COOKIE* + playwright).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSessionCookie } from '../lib/client.js';
import { actionUrl } from '../lib/urls.js';
import { redactSessionTokensInUrl } from '../lib/redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'fixtures', 'captured');
const ALLOWED_HOST = 'hk.unfranchise.com';

function cookieHeaderToPlaywright(cookieStr) {
  return cookieStr.split(';').map((part) => {
    const idx = part.indexOf('=');
    if (idx < 1) return null;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) return null;
    return { name, value, domain: 'hk.unfranchise.com', path: '/' };
  }).filter(Boolean);
}

async function main() {
  const cookieStr = loadSessionCookie();
  if (!cookieStr) {
    console.error('Set UNF_COOKIE or UNF_COOKIE_FILE');
    process.exit(1);
  }
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Install Playwright: npm install -D playwright && npx playwright install chromium');
    process.exit(2);
  }
  const urls = [
    actionUrl('shopping.unfViewCart'),
    actionUrl('orders.unfBillShip'),
    actionUrl('express.unfExpressPay'),
  ];
  const log = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookieHeaderToPlaywright(cookieStr));
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') {
      route.abort();
      return;
    }
    let host;
    try {
      host = new URL(req.url()).hostname;
    } catch {
      route.abort();
      return;
    }
    if (host !== ALLOWED_HOST) {
      route.abort();
      return;
    }
    route.continue();
  });
  page.on('request', (req) => {
    const type = req.resourceType();
    if (!['xhr', 'fetch', 'document'].includes(type)) return;
    log.push({
      type,
      method: req.method(),
      url: redactSessionTokensInUrl(req.url()),
      postData: null,
    });
  });
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => page.goto(url, { waitUntil: 'load', timeout: 60_000 }));
    await page.waitForTimeout(1500);
  }
  await browser.close();
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'xhr-log.json');
  fs.writeFileSync(
    out,
    JSON.stringify({ capturedAt: new Date().toISOString(), requests: log }, null, 2),
  );
  console.log(`[capture:xhr] ${log.length} requests → ${out}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
