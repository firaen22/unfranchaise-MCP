#!/usr/bin/env node
/** Rate review-finding severities with TypeSafe Jev (score rubric). */
import fs from 'node:fs';

const key = process.env.TYPESAFE_API_KEY?.trim();
if (!key) {
  console.error('TYPESAFE_API_KEY not set');
  process.exit(1);
}

const findings = [
  {
    id: 'fox-gate-sol-H1',
    reviewer: 'Sol 6.1',
    round: 'fox-fix-gate',
    claimed: 'High',
    text: 'Read-only redirects could reach shopping.unfUpdateCart without confirm; uppercase action bypassed denylist.',
    codeContext:
      'assertSafeReadRedirect used a partial denylist; unfFetch follows same-host GET redirects with session cookie.',
  },
  {
    id: 'fox-gate-grok-L1',
    reviewer: 'Grok 4.7',
    round: 'fox-fix-gate',
    claimed: 'Low',
    text: 'Same redirect gap as Sol but rated Low not High.',
    codeContext: 'Identical mechanism; Grok classified as Low.',
  },
  {
    id: 'fox-gate2-sol-M1',
    reviewer: 'Sol 6.1',
    round: 'fox-fix-gate2',
    claimed: 'Medium',
    text: 'POST redirects 307/308 converted to GET may drop cart update body.',
    codeContext: 'client.js redirect loop sets method GET on 307/308.',
  },
  {
    id: 'fox-gate2-sol-L1',
    reviewer: 'Sol 6.1',
    round: 'fox-fix-gate2',
    claimed: 'Low',
    text: 'assertCaptureJsonSafe still checks only first session token match.',
    codeContext: 'redact.js assertCaptureJsonSafe after Luna P1 changes.',
  },
];

const state = { findings, rubric: 'MCP security review for hk.unfranchise.com cookie auth and dry-run tools.' };

const questions = {};
for (const f of findings) {
  questions[`severity_${f.id}`] = {
    type: 'score',
    instructions: `For finding ${f.id}, rate the **appropriate security severity** for shipping this MCP, given the code context and claimed severity "${f.claimed}".`,
    criteria: [
      'Informational only — no material risk',
      'Low — minor hardening; fail-closed elsewhere',
      'Medium — plausible abuse with session cookie; needs fix before wide use',
      'High — likely unauthorized mutation or secret leak on common path',
      'Critical — certain data breach or unconfirmed order/payment',
    ],
  };
}

const body = { model: 'jev-latest', state, questions };
const res = await fetch('https://api.typesafe.ai/v1/systemone', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const text = await res.text();
if (!res.ok) {
  console.error('TypeSafe HTTP', res.status, text.slice(0, 500));
  process.exit(1);
}
const out = JSON.parse(text);
const report = { ratedAt: new Date().toISOString(), model: out.model, answers: out.answers, usage: out.usage };
const outPath = '.review-gate/typesafe-finding-ratings.json';
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
for (const f of findings) {
  const a = out.answers?.[`severity_${f.id}`];
  if (!a) continue;
  console.log(
    `${f.id} claimed=${f.claimed} typesafe_score=${a.score?.toFixed?.(2) ?? a.score} confidence=${a.confidence?.toFixed?.(2) ?? a.confidence}`,
  );
}
