#!/usr/bin/env node
/**
 * Capture checkout HTML + navigation log (requires UNF_COOKIE or UNF_COOKIE_FILE).
 * Does not submit payment. Redacts cookie-like substrings in saved HTML.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Actions } from '../lib/urls.js';
import { getAction, unfFetch } from '../lib/client.js';
import { parseCheckoutPage } from '../lib/parse-checkout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'fixtures', 'captured');
const REDACT = /\b(CFID|CFTOKEN|JSESSIONID)=[^;\s"']+/gi;

function redactHtml(html) {
  return html.replace(REDACT, '$1=[REDACTED]');
}

const steps = [
  { label: 'cart', url: Actions.viewCart },
  { label: 'bill_ship', url: Actions.billShip },
  { label: 'express_pay', url: Actions.expressPay },
];

const networkLog = [];

async function captureStep(step) {
  const started = Date.now();
  let result;
  if (typeof step.url === 'string' && step.url.startsWith('https://')) {
    result = await unfFetch(step.url);
  } else if (step.url) {
    result = await getAction(step.url);
  } else {
    result = await getAction(step.action);
  }
  networkLog.push({
    label: step.label,
    url: result.url,
    status: result.status,
    ms: Date.now() - started,
    transport: 'document',
  });
  const parsed = parseCheckoutPage(result.$);
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, `${step.label}.html`);
  const jsonPath = path.join(outDir, `${step.label}.json`);
  fs.writeFileSync(htmlPath, redactHtml(result.html));
  fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2));
  console.log(`[capture] ${step.label}: HTTP ${result.status} → ${htmlPath} (${parsed.fieldCount} fields)`);
}

async function main() {
  for (const step of steps) {
    await captureStep(step);
  }
  const logPath = path.join(outDir, 'network-log.json');
  fs.writeFileSync(
    logPath,
    JSON.stringify({ capturedAt: new Date().toISOString(), steps: networkLog, xhrNote: 'Document fetches only; use DevTools or Playwright for async XHR in browser' }, null, 2),
  );
  console.log(`[capture] network log → ${logPath}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
