#!/usr/bin/env node
/** Stdio MCP transport smoke for kb-server (A5 wire). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');
const serverJs = path.join(repo, 'kb-server.js');

async function runSession(envExtra = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverJs],
    cwd: repo,
    env: { ...process.env, ...envExtra },
  });
  const client = new Client({ name: 'kb-p2-transport-test', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const search = await client.callTool({
    name: 'kb_search',
    arguments: { query: 'chapter 19 advertising policy', limit: 3 },
  });
  const get = await client.callTool({
    name: 'kb_get',
    arguments: { chunk_id: 'manual_ch_19_147887cf#2' },
  });
  await client.close();
  return { names, search, get };
}

const clean = await runSession({ UNF_KB_OP_CONTEXT: 'prior summary only' });
const red = await runSession({
  UNF_KB_OP_CONTEXT: 'UNF_COOKIE=1; Private cart contents',
});

const cleanText = clean.search.content?.[0]?.text ?? '';
const redText = red.search.content?.[0]?.text ?? '';
const redIsError = red.search.isError === true || /A5 isolation failed/i.test(redText);

const getCleanText = clean.get.content?.[0]?.text ?? '';
const getRed = await runSession({
  UNF_KB_OP_CONTEXT: 'UNF_COOKIE=1',
});
const getRedText = getRed.get.content?.[0]?.text ?? '';
const getRedIsError = getRed.get.isError === true || /A5 isolation failed/i.test(getRedText);

const body = {
  generated_at: new Date().toISOString(),
  protocol: 'Spawn kb-server.js over MCP stdio; list_tools + kb_search clean/red UNF_KB_OP_CONTEXT',
  tool_names: clean.names,
  inventory_ok: clean.names.length === 2 && clean.names.includes('kb_search') && clean.names.includes('kb_get'),
  clean_search: {
    isError: clean.search.isError ?? false,
    text_prefix: String(cleanText).slice(0, 80),
  },
  red_search: {
    isError: red.search.isError ?? false,
    text_prefix: String(redText).slice(0, 120),
    blocked: redIsError,
  },
  clean_get: {
    isError: clean.get.isError ?? false,
    text_prefix: String(getCleanText).slice(0, 80),
  },
  red_get: {
    isError: getRed.get.isError ?? false,
    text_prefix: String(getRedText).slice(0, 120),
    blocked: getRedIsError,
  },
  pass:
    clean.names.length === 2 &&
    !clean.search.isError &&
    String(cleanText).length > 0 &&
    redIsError &&
    !clean.get.isError &&
    String(getCleanText).includes('manual_ch_19_147887cf#2') &&
    getRedIsError,
};

fs.writeFileSync(path.join(gate, 'eval-p2-mcp-transport.json'), `${JSON.stringify(body, null, 2)}\n`);
console.log(JSON.stringify({ pass: body.pass, written: 'eval-p2-mcp-transport.json' }, null, 2));
process.exit(body.pass ? 0 : 1);