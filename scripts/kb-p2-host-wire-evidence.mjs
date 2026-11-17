#!/usr/bin/env node
/** P2 A5: MCP wire + host generation boundary evidence for sol gate. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handleKbTool } from '../kb/lib/kb-handlers.js';
import { getLastKnowledgeToolCapture } from '../kb/lib/kb-tool-capture.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');
const cli = path.join(repo, 'kb/cli.js');

const priorToolMessage = [
  {
    role: 'assistant',
    content:
      'Tool unf_cart_view returned: {"lineCount":1,"retailTotalHkd":181,"bvTotal":16,"lineItems":[{"skuID":"HK1410"}]}',
  },
];

const cleanGen = await handleKbTool(
  'kb_search',
  { query: 'manual chapter 19 social advertising', limit: 4 },
  { operationalContext: '', generationMessages: [] },
);
const redGen = await handleKbTool(
  'kb_search',
  { query: 'manual chapter 19 social advertising', limit: 4 },
  { operationalContext: '', generationMessages: priorToolMessage },
);

const redHostCtx = await handleKbTool(
  'kb_search',
  { query: 'advertising policy' },
  { operationalContext: 'session UNF_CANARY_COOKIE=1 cart snippet' },
);

const cartItemsHtmlRed = await handleKbTool(
  'kb_search',
  { query: 'advertising policy' },
  { operationalContext: '<div id="cartItems"><p>HK1410 × 1</p></div>' },
);

const mcpEnvGreen = spawnSync(
  process.execPath,
  [cli, 'search', 'ch19 advertising policy'],
  {
    env: { ...process.env, UNF_KB_OP_CONTEXT: 'prior turn: policy summary only' },
    encoding: 'utf8',
  },
);

const mcpEnvRed = spawnSync(
  process.execPath,
  [cli, 'search', 'ch19 advertising policy'],
  {
    env: {
      ...process.env,
      UNF_KB_OP_CONTEXT: 'UNF_COOKIE=CFID=1; cart snippet Private cart contents',
    },
    encoding: 'utf8',
  },
);

const body = {
  generated_at: new Date().toISOString(),
  protocol:
    'kb-server passes UNF_KB_OP_CONTEXT (same as kb/cli.js); generationMessages only on embedded handleKbTool host path',
  handler_generation_messages: {
    clean_isError: cleanGen.isError,
    red_cart_json_isError: redGen.isError,
    pass: !cleanGen.isError && redGen.isError,
  },
  handler_op_context: {
    red_sentinel_cart_snippet_isError: redHostCtx.isError,
    red_cart_items_div_isError: cartItemsHtmlRed.isError,
    pass: redHostCtx.isError && cartItemsHtmlRed.isError,
  },
  mcp_cli_env_op_context: {
    green_exit: mcpEnvGreen.status,
    green_stdout_prefix: (mcpEnvGreen.stdout ?? '').slice(0, 80),
    red_exit: mcpEnvRed.status,
    red_stderr_prefix: (mcpEnvRed.stderr ?? '').slice(0, 120),
    pass: mcpEnvGreen.status === 0 && mcpEnvRed.status !== 0,
  },
  last_capture_args: getLastKnowledgeToolCapture()?.args ?? null,
  pass:
    !cleanGen.isError &&
    redGen.isError &&
    redHostCtx.isError &&
    cartItemsHtmlRed.isError &&
    mcpEnvGreen.status === 0 &&
    mcpEnvRed.status !== 0,
};

fs.writeFileSync(path.join(gate, 'eval-p2-host-wire.json'), `${JSON.stringify(body, null, 2)}\n`);
console.log(JSON.stringify({ pass: body.pass, written: 'eval-p2-host-wire.json' }, null, 2));
process.exit(body.pass ? 0 : 1);