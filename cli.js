#!/usr/bin/env node
import { callTool, TOOL_DEFINITIONS } from './lib/tools.js';
import { runForm1000OptimiseCli, runForm1000QuartersCli } from './lib/form1000-cli.js';

const [cmd, ...rest] = process.argv.slice(2);

function usage() {
  const names = TOOL_DEFINITIONS.map((t) => t.name).join('\n  ');
  console.error(`Usage:
  unfranchaise form1000-optimise <sheet.csv>
  unfranchaise form1000-quarters read [quarters.json]
  unfranchaise form1000-quarters record <DD/MM/YYYY-DD/MM/YYYY> [--out quarters.json]
  unfranchaise <tool> [json-args]

Tools:
  ${names}`);
  process.exit(2);
}

if (cmd === 'form1000-optimise') {
  process.exit(await runForm1000OptimiseCli(rest));
}
if (cmd === 'form1000-quarters') {
  process.exit(await runForm1000QuartersCli(rest));
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
