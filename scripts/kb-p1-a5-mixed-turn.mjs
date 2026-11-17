#!/usr/bin/env node
/**
 * Sanitized mixed-turn A5 capture: operational MCP result must not enter kb args;
 * generation operationalContext with leaks is blocked before runKbSearch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleKbTool } from '../kb/lib/kb-handlers.js';
import { getLastKnowledgeToolCapture } from '../kb/lib/kb-tool-capture.js';
import { callTool } from '../lib/tools.js';
import { loadSessionCookie } from '../lib/client.js';
import { parseToolText, sanitizeString } from '../kb/lib/sanitize-mcp-trace.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

function redactCartSummary(result) {
  if (!result || typeof result !== 'object') return '(no cart result)';
  const keys = ['lineCount', 'retailTotalHkd', 'bvTotal', 'ibvTotal', 'status'];
  const pick = {};
  for (const k of keys) {
    if (result[k] != null) pick[k] = result[k];
  }
  if (Array.isArray(result.lineItems)) {
    pick.lineItems = result.lineItems.map((l) => ({
      skuID: l.skuID,
      qty: l.qty,
      prdRetail: l.prdRetail,
      prdBv: l.prdBv,
    }));
  }
  return sanitizeString(JSON.stringify(pick));
}

async function main() {
  const hasSession = Boolean(loadSessionCookie());
  let operational = { live: hasSession, cart_summary: null, error: null };
  if (hasSession) {
    try {
      const out = await callTool('unf_cart_view', {});
      operational.cart_summary = await parseToolText(out);
    } catch (err) {
      operational.error = sanitizeString(err.message ?? String(err));
    }
  }

  const redacted = redactCartSummary(operational.cart_summary);

  const knowledgeAfterOpTurn = await handleKbTool('kb_search', {
    query: 'UFO social ads policy manual chapter 19',
    limit: 4,
  });
  const capture = getLastKnowledgeToolCapture();

  const blockedCartJsonInContext = await handleKbTool(
    'kb_search',
    { query: 'Preferred Customer registration', limit: 3 },
    { operationalContext: redacted },
  );

  const blockedCartContext = await handleKbTool(
    'kb_search',
    { query: 'Preferred Customer registration', limit: 3 },
    {
      operationalContext: `<div class="cart">${redacted} Private cart contents</div>`,
    },
  );

  const blockedCookieInContext = await handleKbTool(
    'kb_search',
    { query: 'product ordering procedures', limit: 3 },
    { operationalContext: 'UNF_COOKIE=CFID=redacted; CFTOKEN=redacted' },
  );

  const body = {
    generated_at: new Date().toISOString(),
    protocol:
      '1) operational unf_cart_view (sanitized summary) 2) kb_search with clean args and empty operationalContext 3) negative controls block cart HTML or cookie in operationalContext',
    operational_turn: operational,
    redacted_cart_summary: redacted,
    knowledge_request_after_operational_turn: {
      args: { query: 'UFO social ads policy manual chapter 19', limit: 4 },
      operationalContext: '',
      isError: knowledgeAfterOpTurn.isError,
      hit_count: knowledgeAfterOpTurn.isError
        ? 0
        : (JSON.parse(knowledgeAfterOpTurn.text).length ?? 0),
      dispatched_payload: capture?.payload ?? null,
      payload_contains_cart_sku: JSON.stringify(capture?.args ?? {}).includes('HK1410'),
      host_contract:
        'MCP cart result stays in operational_turn only; kb_search args contain query+limit only (no cart fields)',
    },
    redacted_json_in_generation_context: {
      operationalContext_sample: redacted,
      isError: blockedCartJsonInContext.isError,
      text_prefix: String(blockedCartJsonInContext.text ?? '').slice(0, 120),
      note: 'Redacted unf_cart_view JSON in operationalContext must be rejected before kb_search',
    },
    negative_cart_html_in_generation_context: {
      isError: blockedCartContext.isError,
      text_prefix: String(blockedCartContext.text ?? '').slice(0, 120),
    },
    negative_cookie_in_generation_context: {
      isError: blockedCookieInContext.isError,
      text_prefix: String(blockedCookieInContext.text ?? '').slice(0, 120),
    },
    pass_rule:
      'knowledge_after_op green; cart html cookie or cart MCP JSON in operationalContext rejected before dispatch',
    pass:
      !knowledgeAfterOpTurn.isError &&
      blockedCartContext.isError &&
      blockedCookieInContext.isError &&
      blockedCartJsonInContext.isError,
  };

  const outPath = path.join(gate, 'eval-p1-week1-a5-mixed-turn.json');
  fs.writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ written: outPath, pass: body.pass, live: hasSession }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});