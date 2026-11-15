#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleKbTool } from './kb/lib/kb-handlers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

// Green: same path kb-server uses (no sentinel in args)
const green = await handleKbTool('kb_search', { query: 'advertising', limit: 3 });
assert.equal(green.isError, false, 'handler search green');

// Red: sentinel in query
const red = await handleKbTool('kb_search', { query: 'leak UNF_CANARY_COOKIE=1' });
assert.equal(red.isError, true, 'handler search red');
assert.match(red.text, /A5 isolation failed/);

// Red: cookie secret in query
const cookieRed = await handleKbTool('kb_search', { query: 'UNF_COOKIE=session_secret' });
assert.equal(cookieRed.isError, true, 'cookie in knowledge payload');

const cartRed = await handleKbTool('kb_search', {
  query: '<div class="cart"><span>Private cart contents</span></div>',
});
assert.equal(cartRed.isError, true, 'cart html in knowledge payload');

const acctRed = await handleKbTool('kb_search', {
  query: '{"accountId":"12345","email":"customer@example.invalid","orders":[]}',
});
assert.equal(acctRed.isError, true, 'account payload blocked');

const cartJsonRed = await handleKbTool(
  'kb_search',
  { query: 'advertising', limit: 3 },
  { operationalContext: '{"lineCount":1,"retailTotalHkd":181,"bvTotal":16}' },
);
assert.equal(cartJsonRed.isError, true, 'cart mcp json in generation context');

const genMsgRed = await handleKbTool(
  'kb_search',
  { query: 'advertising', limit: 3 },
  {
    generationMessages: [
      { role: 'assistant', content: 'unf_cart_view {"lineCount":1,"retailTotalHkd":181}' },
    ],
  },
);
assert.equal(genMsgRed.isError, true, 'cart json in generationMessages');

// Green again after red
const extraPoison = await handleKbTool('kb_search', {
  query: 'advertising',
  limit: 3,
  context: '{"accountId":"12345","email":"x@y.invalid","orders":[]}',
});
assert.equal(extraPoison.isError, true, 'extra MCP args with account json blocked');

const cartJsonQuery = await handleKbTool('kb_search', {
  query: '{"lineCount":1,"retailTotalHkd":181,"bvTotal":16}',
});
assert.equal(cartJsonQuery.isError, true, 'cart mcp json in query blocked');

const green2 = await handleKbTool('kb_get', { chunk_id: 'pol_1' });
assert.equal(green2.isError, false, 'handler get green');

// CLI subprocess strips UNF_COOKIE (same entry as bin kb)
const cli = path.join(repo, 'kb/cli.js');
const r = spawnSync(process.execPath, [cli, 'search', '__kb_env_test__'], {
  env: { ...process.env, UNF_COOKIE: 'CFID=1;CFTOKEN=2' },
  encoding: 'utf8',
});
assert.equal(r.status, 0, `cli exit 0: ${r.stderr}`);

const envCheck = spawnSync(
  process.execPath,
  [
    '-e',
    "import('./kb/lib/kb-env.js').then((m) => { m.applyKnowledgeEnvSanitize(); console.log(process.env.UNF_COOKIE ?? 'UNF_COOKIE_stripped'); })",
  ],
  {
    cwd: repo,
    env: { ...process.env, UNF_COOKIE: 'secret=1' },
    encoding: 'utf8',
  },
);
assert.match(envCheck.stdout, /UNF_COOKIE_stripped/, 'child env sanitized');

console.log('test-kb-mcp.mjs: all assertions passed');