#!/usr/bin/env node
import { callTool, TOOL_DEFINITIONS } from './lib/tools.js';

const [cmd, ...rest] = process.argv.slice(2);

function usage() {
  const names = TOOL_DEFINITIONS.map((t) => t.name).join('\n  ');
  console.error(`Usage: unfranchaise <tool> [json-args]\n\nTools:\n  ${names}`);
  process.exit(2);
}

if (!cmd || cmd === '-h' || cmd === '--help') usage();

let args = {};
if (rest[0]) {
  try {
    args = JSON.parse(rest.join(' '));
  } catch {
    console.error('Second argument must be JSON object, e.g. \'{"keyword":"omega"}\'');
    process.exit(2);
  }
}

const out = await callTool(cmd, args);
const text = out.content?.map((c) => c.text).join('\n') ?? JSON.stringify(out);
console.log(text);
if (out.isError) process.exit(1);
