#!/usr/bin/env node
/** A5: generation message boundary after operational MCP turn. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleKbTool } from '../kb/lib/kb-handlers.js';
import { callTool } from '../lib/tools.js';
import { loadSessionCookie } from '../lib/client.js';
import { parseToolText } from '../kb/lib/sanitize-mcp-trace.js';
import { getLastKnowledgeToolCapture } from '../kb/lib/kb-tool-capture.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

async function main() {
  const live = Boolean(loadSessionCookie());
  let cartSummary = null;
  if (live) {
    try {
      const out = await callTool('unf_cart_view', {});
      cartSummary = await parseToolText(out);
    } catch {
      cartSummary = null;
    }
  }

  const priorToolMessage = cartSummary
    ? [
        {
          role: 'assistant',
          content: `Tool unf_cart_view returned: ${JSON.stringify({
            lineCount: cartSummary.lineCount,
            retailTotalHkd: cartSummary.retailTotalHkd,
            bvTotal: cartSummary.bvTotal,
          })}`,
        },
      ]
    : [
        {
          role: 'assistant',
          content:
            'Tool unf_cart_view returned: {"lineCount":1,"retailTotalHkd":181,"bvTotal":16,"lineItems":[{"skuID":"HK1410"}]}',
        },
      ];

  const clean = await handleKbTool(
    'kb_search',
    { query: 'manual chapter 19 social advertising', limit: 4 },
    { operationalContext: '', generationMessages: [] },
  );

  const leaked = await handleKbTool(
    'kb_search',
    { query: 'manual chapter 19 social advertising', limit: 4 },
    { operationalContext: '', generationMessages: priorToolMessage },
  );

  const body = {
    generated_at: new Date().toISOString(),
    live,
    protocol:
      'Simulated host chat: prior assistant message contains unf_cart_view JSON; kb_search must reject when generationMessages include cart MCP blob',
    prior_tool_message: priorToolMessage[0].content.slice(0, 200),
    clean_generation_messages: {
      isError: clean.isError,
      capture: getLastKnowledgeToolCapture()?.args ?? null,
    },
    leaked_generation_messages: {
      isError: leaked.isError,
      reason_prefix: String(leaked.text ?? '').slice(0, 120),
    },
    pass: !clean.isError && leaked.isError,
  };

  fs.writeFileSync(
    path.join(gate, 'eval-p1-week1-a5-generation-context.json'),
    `${JSON.stringify(body, null, 2)}\n`,
  );
  console.log(JSON.stringify({ pass: body.pass }, null, 2));
  process.exit(body.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});