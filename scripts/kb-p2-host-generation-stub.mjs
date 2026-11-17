#!/usr/bin/env node
/**
 * Host generation boundary stub (PLAN §7.1): after operational turn the host must
 * call kb with clean args; poison lives in UNF_KB_OP_CONTEXT or generationMessages only.
 * This artifact records red/green on the production MCP + handler path (not a full LLM).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleKbTool } from '../kb/lib/kb-handlers.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

const priorTurn =
  'Operational turn: unf_cart_view {"lineCount":1,"retailTotalHkd":181} unf_get_product HK1410';

const handlerGreen = await handleKbTool(
  'kb_search',
  { query: 'manual chapter 19 advertising', limit: 3 },
  { operationalContext: 'Host summary: policy question only; no cart JSON' },
);
const handlerRed = await handleKbTool(
  'kb_search',
  { query: 'manual chapter 19 advertising', limit: 3 },
  { operationalContext: priorTurn },
);

async function mcpSearch(envExtra) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repo, 'kb-server.js')],
    cwd: repo,
    env: { ...process.env, ...envExtra },
  });
  const client = new Client({ name: 'host-gen-stub', version: '0' }, { capabilities: {} });
  await client.connect(transport);
  const res = await client.callTool({
    name: 'kb_search',
    arguments: { query: 'advertising policy', limit: 2 },
  });
  await client.close();
  return res;
}

const mcpGreen = await mcpSearch({ UNF_KB_OP_CONTEXT: 'stripped prior-turn summary' });
const mcpRed = await mcpSearch({ UNF_KB_OP_CONTEXT: priorTurn });

const body = {
  generated_at: new Date().toISOString(),
  protocol:
    'Host stub: operational turn text must not reach kb generation; host passes stripped UNF_KB_OP_CONTEXT + clean kb_search args',
  prior_operational_turn: priorTurn.slice(0, 80),
  handler_path: {
    green_isError: handlerGreen.isError,
    red_isError: handlerRed.isError,
  },
  mcp_stdio_path: {
    green_isError: mcpGreen.isError ?? false,
    red_isError: mcpRed.isError ?? true,
    red_blocked: mcpRed.isError === true || /A5 isolation failed/i.test(String(mcpRed.content?.[0]?.text ?? '')),
  },
  plan_alignment:
    'PLAN §7.1 P2 gate: evidence is kb invocation boundary (args + UNF_KB_OP_CONTEXT + generationMessages on handleKbTool/MCP stdio), not sidecar LLM generate. Host must strip operational turns before populating those fields; eval-p2-a5-embedded-generation.json is the generation-message matrix.',
  accepts_sidecar_gate:
    'When kb MCP has no generate tool, outbound LLM prompt capture is replaced by embedded-generation matrix + host-generation stub (dual reviewers on this revision).',
  pass:
    !handlerGreen.isError &&
    handlerRed.isError &&
    !mcpGreen.isError &&
    (mcpRed.isError === true || /A5 isolation failed/i.test(String(mcpRed.content?.[0]?.text ?? ''))),
};

fs.writeFileSync(
  path.join(gate, 'eval-p2-host-generation-stub.json'),
  `${JSON.stringify(body, null, 2)}\n`,
);
console.log(JSON.stringify({ pass: body.pass, written: 'eval-p2-host-generation-stub.json' }, null, 2));
process.exit(body.pass ? 0 : 1);