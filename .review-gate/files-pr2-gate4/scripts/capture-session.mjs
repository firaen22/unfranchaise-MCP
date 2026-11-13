#!/usr/bin/env node
/**
 * Capture checkout HTML + navigation log (requires UNF_COOKIE or UNF_COOKIE_FILE).
 * GET only — does not submit payment. Redacts session tokens and text input values in saved HTML.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Actions } from '../lib/urls.js';
import { getAction } from '../lib/client.js';
import { parseCheckoutPage } from '../lib/parse-checkout.js';
import { redactSessionTokensInText, redactSessionTokensInUrl } from '../lib/redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'fixtures', 'captured');

function redactInputTag(tag) {
  if (!/<input\b/i.test(tag)) return tag;
  const sensitive =
    /type\s*=\s*['"]?(?:hidden|text|tel|email|password|search)['"]?/i.test(tag) ||
    !/\btype\s*=/i.test(tag);
  if (!sensitive) return tag;
  let t = tag.replace(/\svalue\s*=\s*(['"])[^'"]*\1/i, ' value=$1[REDACTED]$1');
  t = t.replace(/\svalue\s*=\s*[^\s>]+/i, ' value="[REDACTED]"');
  return t;
}

function redactHtml(html) {
  let h = redactSessionTokensInText(html);
  h = h.replace(/<input\b[^>]*>/gi, redactInputTag);
  h = h.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, '<textarea>[REDACTED]</textarea>');
  h = h.replace(/(<option\b[^>]*>)[\s\S]*?(<\/option>)/gi, '$1[REDACTED]$2');
  h = h.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
  h = h.replace(/\b\+?\d[\d\s\-()]{7,}\d\b/g, '[REDACTED_PHONE]');
  return h;
}

const steps = [
  { label: 'cart', action: Actions.viewCart },
  { label: 'bill_ship', action: Actions.billShip, requireCheckout: true },
  { label: 'express_pay', action: Actions.expressPay },
];

const networkLog = [];
let exitCode = 0;

async function captureStep(step) {
  const started = Date.now();
  const result = await getAction(step.action);
  networkLog.push({
    label: step.label,
    url: redactSessionTokensInUrl(result.url),
    status: result.status,
    ms: Date.now() - started,
    transport: 'document',
  });
  const parsed = parseCheckoutPage(result.$);
  if (step.requireCheckout) {
    const blockers = ['login_required', 'empty_cart'].filter((h) => parsed.stepHints.includes(h));
    if (blockers.length) {
      console.error(`[capture] bill_ship blocked (${blockers.join(', ')}). Non-empty cart + valid cookie required.`);
      exitCode = 1;
      return;
    }
    if (parsed.fieldCount === 0) {
      console.error('[capture] bill_ship blocked (zero form fields).');
      exitCode = 1;
      return;
    }
  }
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
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        steps: networkLog,
        xhrNote: 'Document GET fetches only; async XHR via npm run capture:xhr → xhr-log.json',
      },
      null,
      2,
    ),
  );
  console.log(`[capture] network log → ${logPath}`);
  if (exitCode) process.exit(exitCode);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
