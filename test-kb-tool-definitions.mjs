#!/usr/bin/env node
/** A5: listTools inventory equals exported KB_TOOL_DEFINITIONS (and rejects schema drift). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { KB_TOOL_DEFINITIONS } from './kb/lib/kb-tool-defs.js';

const repo = path.dirname(fileURLToPath(import.meta.url));

async function listToolsLive() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repo, 'kb-server.js')],
    cwd: repo,
    env: { ...process.env, UNF_KB_OP_CONTEXT: 'prior summary only' },
  });
  const client = new Client({ name: 'kb-tool-defs-test', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);
  const { tools } = await client.listTools();
  await client.close();
  return tools;
}

function normalize(tools) {
  return JSON.parse(JSON.stringify(tools));
}

const live = normalize(await listToolsLive());
const exported = normalize(KB_TOOL_DEFINITIONS);
assert.deepEqual(live, exported, 'live listTools must equal KB_TOOL_DEFINITIONS');

const fixturePath = path.join(repo, 'kb/fixtures/kb-list-tools.json');
const fixture = normalize(JSON.parse(fs.readFileSync(fixturePath, 'utf8')));
assert.deepEqual(live, fixture, 'live listTools must match frozen kb/fixtures/kb-list-tools.json');

const drifted = normalize(KB_TOOL_DEFINITIONS);
drifted[0].inputSchema.properties.query.type = 'integer';
assert.notDeepEqual(live, drifted, 'altered schema must fail equality (red check)');

const serverSrc = fs.readFileSync(path.join(repo, 'kb-server.js'), 'utf8');
assert.match(serverSrc, /KB_TOOL_DEFINITIONS/, 'kb-server imports shared defs');
assert.doesNotMatch(serverSrc, /name:\s*'kb_search'/, 'kb-server must not inline tool schemas');

console.log('test-kb-tool-definitions.mjs: ok');
