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
import { parseCheckoutPage, checkoutMapBlocker } from '../lib/parse-checkout.js';
import { redactSessionTokensInUrl, redactToolPayload } from '../lib/redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'fixtures', 'captured');

const steps = [
  { label: 'cart', action: Actions.viewCart },
  { label: 'bill_ship', action: Actions.billShip, requireCheckout: true },
  { label: 'express_pay', action: Actions.expressPay, requireCheckout: true },
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
  const blocker = checkoutMapBlocker(parsed, result.url);
  const refuse = blocker === 'login_required' || (step.requireCheckout && blocker);
  if (refuse) {
    const extra =
      blocker === 'login_required'
        ? ' HTTP 200 can still be the login wall: Cloudflare cf_clearance / __cf_bm is often bound to the browser TLS fingerprint, so a session cookie is not enough. Do not overwrite fixtures from this HTML.'
        : blocker === 'empty_cart'
          ? ' Empty cart hides checkout forms. Do not build the map from this response.'
          : ' No checkout fields.';
    console.error(`[capture] ${step.label} blocked (${blocker}).${extra}`);
    exitCode = 1;
    return;
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
