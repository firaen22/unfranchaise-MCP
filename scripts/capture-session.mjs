#!/usr/bin/env node
/**
 * Capture checkout field maps (requires UNF_COOKIE or UNF_COOKIE_FILE).
 * GET only. Writes structural JSON only (no HTML on disk).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Actions } from '../lib/urls.js';
import { getAction } from '../lib/client.js';
import { parseCheckoutPage } from '../lib/parse-checkout.js';
import { redactSessionTokensInUrl, redactToolPayload } from '../lib/redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'fixtures', 'captured');

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
  const parsed = redactToolPayload(parseCheckoutPage(result.$));
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
  const jsonPath = path.join(outDir, `${step.label}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2));
  console.log(`[capture] ${step.label}: HTTP ${result.status} → ${jsonPath} (${parsed.fieldCount} fields)`);
}

async function main() {
  for (const step of steps) {
    await captureStep(step);
  }
  const logPath = path.join(outDir, 'network-log.json');
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      redactToolPayload({
        capturedAt: new Date().toISOString(),
        steps: networkLog,
        xhrNote: 'Document GET fetches only; async XHR via npm run capture:xhr → xhr-log.json',
      }),
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
