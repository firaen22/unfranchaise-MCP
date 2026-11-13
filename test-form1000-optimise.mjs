import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { optimiseForm1000 } from './lib/form1000-optimise.js';
import { loadSheetFromFile, parseCsv } from './lib/form1000-sheet.js';
import {
  loadQuarters,
  quarterWindowFromQuarterDate,
  recordQuarter,
} from './lib/form1000-quarters.js';
import { callTool, TOOL_DEFINITIONS } from './lib/tools.js';

function skusOf(lines) {
  return lines.map((line) => line.sku);
}

function assertDisjoint(result, sourceRows) {
  const expected = new Map();
  for (const row of sourceRows) {
    if (String(row.alreadyPlaced ?? '').trim().toLowerCase() === 'true') continue;
    const key = `${row.orderNumber ?? ''}|${row.sku ?? ''}`;
    expected.set(key, (expected.get(key) ?? 0) + Number(row.qty ?? 0));
  }
  const actual = new Map();
  for (const [name, block] of [
    ['receipt1', result.receipt1],
    ['receipt2', result.receipt2],
    ['leftover', result.leftover],
  ]) {
    for (const line of block.lines) {
      const key = `${line.orderNumber}|${line.sku}`;
      actual.set(key, (actual.get(key) ?? 0) + line.qty);
      assert.ok(name);
    }
  }
  assert.deepEqual(actual, expected);
}

assert.throws(() => parseCsv('line,"1500'), /unclosed quoted field/i);

const example = optimiseForm1000(loadSheetFromFile('fixtures/form1000-sheet.example.csv'));
assert.equal(example.feasible, true);
assert.equal(example.submitted, false);
assert.equal(example.placedOrder, false);
assert.equal(example.network, false);
assert.equal(example.receipt1.productTotalHkd, 1500);
assert.equal(example.receipt2.productTotalHkd, 1500);
assert.equal(example.leftover.productTotalHkd, 620);
const receiptSkus = new Set([...skusOf(example.receipt1.lines), ...skusOf(example.receipt2.lines)]);
assert.deepEqual(receiptSkus, new Set(['HK-SYN-SERUM', 'HK-SYN-OIL', 'HK-SYN-TONER', 'HK-SYN-MIST']));
assert.deepEqual(new Set(skusOf(example.leftover.lines)), new Set(['HK-SYN-CREAM', 'HK-SYN-SOAP']));
assert.deepEqual(example.excludedAlreadyPlaced.map((line) => line.sku), ['HK-SYN-OLD']);
assert.ok(!receiptSkus.has('HK-SYN-OLD'));
const serum = [...example.receipt1.lines, ...example.receipt2.lines].find((line) => line.sku === 'HK-SYN-SERUM');
assert.equal(serum.lineProductTotalHkd, 800);
assert.equal(serum.retailHkd, 999);
assert.equal(serum.ignoredCharges.shippingHkd, 40);
assert.match(example.report, /Feasible: yes/);
assert.match(example.report, /No Form 1000 assign, no Form 1000 submit, and no place-order/);
assert.equal(example.personalUseChecks.ok, true);

const placed = optimiseForm1000([
  { sku: 'U1', qty: 1, lineProductTotalHkd: 1600, alreadyPlaced: false },
  { sku: 'U2', qty: 1, lineProductTotalHkd: 1600, alreadyPlaced: false },
  { sku: 'PLACED', qty: 1, lineProductTotalHkd: 1500, alreadyPlaced: true },
]);
assert.equal(placed.feasible, true);
assert.deepEqual(new Set([...skusOf(placed.receipt1.lines), ...skusOf(placed.receipt2.lines)]), new Set(['U1', 'U2']));
assert.equal(placed.receipt1.lines.length, 1);
assert.equal(placed.receipt2.lines.length, 1);

const short = optimiseForm1000([
  { sku: 'A', qty: 1, lineProductTotalHkd: 400, alreadyPlaced: false },
  { sku: 'B', qty: 1, lineProductTotalHkd: 400, alreadyPlaced: false },
]);
assert.equal(short.feasible, false);
assert.equal(short.bothMeetMinimum, false);
assert.equal(short.shortfall.totalShortfallHkd, 2200);
assert.match(short.shortfall.message, /short by HKD 2200\.00/);
assert.match(short.report, /Receipt shortfalls/);

const once = optimiseForm1000([{ sku: 'ONLY', qty: 1, lineProductTotalHkd: 4000, alreadyPlaced: false }]);
assert.equal(once.feasible, false);
assert.match(once.shortfall.message, /cannot be partitioned/);
const onlyCount =
  skusOf(once.receipt1.lines).filter((sku) => sku === 'ONLY').length +
  skusOf(once.receipt2.lines).filter((sku) => sku === 'ONLY').length;
assert.equal(onlyCount, 1);
assert.equal(once.receipt1.lines.length + once.receipt2.lines.length, 1);

const shipped = optimiseForm1000([
  { sku: 'A', qty: 1, lineProductTotalHkd: 800, shippingHkd: 1000, retailHkd: 5000, costHkd: 100, alreadyPlaced: false },
  { sku: 'B', qty: 1, lineProductTotalHkd: 800, shippingHkd: 1000, alreadyPlaced: false },
]);
assert.equal(shipped.feasible, false);
const shippedSum =
  shipped.receipt1.productTotalHkd + shipped.receipt2.productTotalHkd + shipped.leftover.productTotalHkd;
assert.equal(shippedSum, 1600);
for (const total of [shipped.receipt1.productTotalHkd, shipped.receipt2.productTotalHkd, shipped.leftover.productTotalHkd]) {
  assert.ok(total === 0 || total === 800 || total === 1600);
  assert.notEqual(total, 1800);
  assert.notEqual(total, 5800);
}

const tieRows = [
  ...Array.from({ length: 6 }, (_, i) => ({
    sku: `H${i}`,
    qty: 1,
    lineProductTotalHkd: 4000,
    alreadyPlaced: false,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    sku: `M${i}`,
    qty: 1,
    lineProductTotalHkd: 500,
    alreadyPlaced: false,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    sku: `L${i}`,
    qty: 1,
    lineProductTotalHkd: 1500,
    alreadyPlaced: false,
  })),
];
const tieBreak = optimiseForm1000(tieRows);
assert.equal(tieBreak.feasible, true);
assert.equal(tieBreak.receipt1.lines.length + tieBreak.receipt2.lines.length, 2);
assert.deepEqual(
  new Set([...tieBreak.receipt1.lines, ...tieBreak.receipt2.lines].map((line) => line.sku)),
  new Set(['L0', 'L1']),
);

const solTie15 = [
  10_000,
  10_000,
  10_000,
  10_000,
  10_000,
  10_000,
  10_000,
  500,
  500,
  1500,
  1500,
  700,
  900,
  1100,
];
const solTie15Result = optimiseForm1000(
  solTie15.map((amount, index) => ({
    sku: `T${index}`,
    qty: 1,
    lineProductTotalHkd: amount,
    alreadyPlaced: false,
  })),
);
assert.equal(solTie15Result.feasible, true);
assert.equal(solTie15Result.receipt1.lines.length + solTie15Result.receipt2.lines.length, 2);

const sol14 = [700, 450, 850, 150, 650, 350, 450, 500, 200, 100, 450, 850, 100, 650];
const sol14Result = optimiseForm1000(
  sol14.map((amount, index) => ({
    sku: `P${index}`,
    qty: 1,
    lineProductTotalHkd: amount,
    alreadyPlaced: false,
  })),
);
assert.equal(sol14Result.feasible, true);
assert.equal(sol14Result.assignment, 'exact');
assert.equal(sol14Result.receipt1.lines.length + sol14Result.receipt2.lines.length, 4);

const exact = optimiseForm1000(
  [1100, 1000, 900, 600, 500, 400, 300].map((amount, index) => ({
    sku: `N${index}`,
    qty: 1,
    lineProductTotalHkd: amount,
    alreadyPlaced: false,
  })),
);
assert.equal(exact.feasible, true);
assert.equal(exact.receipt1.productTotalHkd, 1500);
assert.equal(exact.receipt2.productTotalHkd, 1500);
const exactSkus = [];
for (const line of [...exact.receipt1.lines, ...exact.receipt2.lines, ...exact.leftover.lines]) {
  assert.equal(exactSkus.includes(line.sku), false);
  exactSkus.push(line.sku);
}

const split = optimiseForm1000([
  {
    sku: 'PACK',
    qty: 8,
    unitProductAmountHkd: 400,
    lineProductTotalHkd: 3200,
    allowSplit: true,
    alreadyPlaced: false,
  },
]);
assert.equal(split.feasible, true);
assert.equal(split.receipt1.productTotalHkd, 1600);
assert.equal(split.receipt2.productTotalHkd, 1600);
assert.equal(split.receipt1.lines[0].qty + split.receipt2.lines[0].qty, 8);
const whole = optimiseForm1000([
  {
    sku: 'PACK',
    qty: 8,
    unitProductAmountHkd: 400,
    lineProductTotalHkd: 3200,
    allowSplit: false,
    alreadyPlaced: false,
  },
]);
assert.equal(whole.feasible, false);
assert.equal(skusOf(whole.receipt1.lines).length + skusOf(whole.receipt2.lines).length, 1);

const personal = optimiseForm1000([
  { sku: 'P', qty: 1, lineProductTotalHkd: 1600, personalUse: true, alreadyPlaced: false },
  { sku: 'R', qty: 1, lineProductTotalHkd: 1600, personalUse: false, alreadyPlaced: false },
]);
assert.equal(personal.feasible, true);
assert.equal(personal.personalUseChecks.ok, false);
assert.equal(personal.personalUseChecks.withinQuarterlyCap, false);
assert.ok(personal.personalUseChecks.perReceipt.some((receipt) => receipt.withinPerOrderCap === false));
assert.match(personal.personalUseChecks.advice, /does not recommend personal purchases/);

assert.throws(
  () =>
    optimiseForm1000([
      { sku: 'Z', qty: 2, unitProductAmountHkd: 10, lineProductTotalHkd: 800, alreadyPlaced: false },
    ]),
  /does not match/,
);

function independentBestSum(amounts) {
  const count = amounts.length;
  const limit = 3 ** count;
  let best = null;
  for (let mask = 0; mask < limit; mask++) {
    let s1 = 0;
    let s2 = 0;
    let rest = mask;
    for (let i = 0; i < count; i++) {
      const bucket = rest % 3;
      rest = Math.floor(rest / 3);
      if (bucket === 1) s1 += amounts[i];
      else if (bucket === 2) s2 += amounts[i];
    }
    if (s1 >= 1500 && s2 >= 1500) {
      const sum = s1 + s2;
      if (best == null || sum < best) best = sum;
    }
  }
  return best;
}

const wideAmounts = Array.from({ length: 15 }, (_, index) => 100 + index * 50);
const wide = optimiseForm1000(
  wideAmounts.map((amount, index) => ({
    sku: `S${index}`,
    qty: 1,
    lineProductTotalHkd: amount,
    alreadyPlaced: false,
  })),
);
assert.equal(wide.assignment, 'meet-in-the-middle');
assert.equal(wide.feasible, true);
assert.equal(wide.receipt1.productTotalHkd + wide.receipt2.productTotalHkd, independentBestSum(wideAmounts));
const wideSkus = [...skusOf(wide.receipt1.lines), ...skusOf(wide.receipt2.lines), ...skusOf(wide.leftover.lines)];
assert.equal(new Set(wideSkus).size, wideSkus.length);

function nyClock(iso) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

for (const [quarterDate, day, month, offset] of [
  ['01/01/2026-31/03/2026', '31', '03', '-04:00'],
  ['01/04/2026-30/06/2026', '30', '06', '-04:00'],
  ['01/10/2026-31/12/2026', '31', '12', '-05:00'],
]) {
  const window = quarterWindowFromQuarterDate(quarterDate);
  assert.equal(window.deadline.endsWith(`T23:59:00${offset}`), true);
  const clock = nyClock(window.deadline);
  assert.equal(clock.hour, '23');
  assert.equal(clock.minute, '59');
  assert.equal(clock.day, day);
  assert.equal(clock.month, month);
  assert.match(window.deadlineLabel, /11:59 pm US Eastern/);
}

const exampleQuarters = loadQuarters('fixtures/form1000-quarters.example.json');
assert.equal(exampleQuarters.example, true);
assert.match(exampleQuarters.deadlineRule, /11:59 pm US Eastern/);
assert.equal(exampleQuarters.quarters.length >= 2, true);
assert.doesNotMatch(JSON.stringify(exampleQuarters), /@/);
assert.throws(() => recordQuarter('fixtures/form1000-quarters.example.json', '01/01/2026-31/03/2026'), /example/);

const quarterDir = path.join('fixtures', 'captured', 'quarters-test');
fs.mkdirSync(quarterDir, { recursive: true });
const quarterFile = path.join(quarterDir, 'quarters.json');
try {
  recordQuarter(quarterFile, '01/01/2026-31/03/2026');
  recordQuarter(quarterFile, '01/01/2026-31/03/2026');
  const savedQuarters = loadQuarters(quarterFile);
  assert.equal(savedQuarters.example, false);
  assert.equal(savedQuarters.quarters.length, 1);
  assert.equal(savedQuarters.quarters[0].quarterDate, '01/01/2026-31/03/2026');
  fs.writeFileSync(
    path.join(quarterDir, 'bad.json'),
    JSON.stringify({ ...savedQuarters, customerName: 'hidden' }),
  );
  assert.throws(() => loadQuarters(path.join(quarterDir, 'bad.json')), /unsupported field/);
  assert.throws(() => recordQuarter('/tmp/quarters.json', '01/01/2026-31/03/2026'), /repository root/);
  assert.throws(() => recordQuarter('fixtures/server.js', '01/01/2026-31/03/2026'), /\.json/);
} finally {
  fs.rmSync(quarterDir, { recursive: true, force: true });
}

let fetched = false;
const previousFetch = globalThis.fetch;
globalThis.fetch = async () => {
  fetched = true;
  throw new Error('optimiser must not fetch');
};
try {
  const tool = await callTool('unf_form1000_optimise', {
    rows: [
      { sku: 'U1', qty: 1, lineProductTotalHkd: 1600, alreadyPlaced: false },
      { sku: 'U2', qty: 1, lineProductTotalHkd: 1600, alreadyPlaced: false },
    ],
    confirm: true,
  });
  assert.equal(fetched, false);
  assert.equal(tool.isError, undefined);
  const body = JSON.parse(tool.content[0].text);
  assert.equal(body.feasible, true);
  assert.equal(body.submitted, false);
  assert.equal(body.assigned, false);
  assert.equal(body.placedOrder, false);
  assert.match(body.note, /never submits/);
  const quarters = JSON.parse((await callTool('unf_form1000_quarters', {})).content[0].text);
  assert.equal(fetched, false);
  assert.equal(quarters.source, 'example_fixture');
  assert.equal(quarters.live, false);
  assert.equal(quarters.personalBalances, null);
  assert.equal(quarters.submitted, false);
} finally {
  globalThis.fetch = previousFetch;
}

const missing = await callTool('unf_form1000_optimise', {});
assert.equal(missing.isError, true);
assert.ok(TOOL_DEFINITIONS.some((tool) => tool.name === 'unf_form1000_optimise'));
assert.ok(TOOL_DEFINITIONS.some((tool) => tool.name === 'unf_form1000_quarters'));

for (const file of [
  'lib/form1000-optimise.js',
  'lib/form1000-cli.js',
  'lib/form1000-sheet.js',
  'lib/form1000-quarters.js',
]) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /unf1000Assign|unf1000Update|unfFetch|fetch\(/);
  assert.doesNotMatch(source, /002|003/);
}

const cli = spawnSync(process.execPath, ['cli.js', 'form1000-optimise', 'fixtures/form1000-sheet.example.csv'], {
  encoding: 'utf8',
});
assert.equal(cli.status, 0, cli.stderr);
assert.match(cli.stdout, /Feasible: yes/);
assert.match(cli.stdout, /Receipt 1/);
assert.match(cli.stdout, /Receipt 2/);
assert.match(cli.stdout, /Leftover unplaced/);
assert.match(cli.stdout, /1500\.00/);
assert.match(cli.stdout, /No Form 1000 assign/);
assert.doesNotMatch(cli.stdout, /unf1000Assign|unf1000Update/);

const npmRun = spawnSync('npm', ['run', 'form1000:optimise', '--', 'fixtures/form1000-sheet.example.csv'], {
  encoding: 'utf8',
});
assert.equal(npmRun.status, 0, npmRun.stderr);
assert.match(npmRun.stdout, /Feasible: yes/);

const quarterCli = spawnSync(process.execPath, ['cli.js', 'form1000-quarters', 'read'], { encoding: 'utf8' });
assert.equal(quarterCli.status, 0, quarterCli.stderr);
assert.match(quarterCli.stdout, /Example fixture only/);
assert.match(quarterCli.stdout, /11:59 pm US Eastern/);
assert.doesNotMatch(quarterCli.stdout, /@|CFID|cookie/i);

const recordCli = spawnSync(
  process.execPath,
  ['cli.js', 'form1000-quarters', 'record', '01/04/2026-30/06/2026', '--out', path.join(quarterDir, 'cli.json')],
  { encoding: 'utf8' },
);
assert.equal(recordCli.status, 0, recordCli.stderr);
assert.match(recordCli.stdout, /30 June 2026, 11:59 pm US Eastern/);
assert.equal(loadQuarters(path.join(quarterDir, 'cli.json')).quarters[0].end, '2026-06-30');

assertDisjoint(example, loadSheetFromFile('fixtures/form1000-sheet.example.csv'));
assert.doesNotMatch(fs.readFileSync('FORM1000.md', 'utf8'), /002|003/);
assert.match(fs.readFileSync('FORM1000.md', 'utf8'), /銷售收據輸入/);
assert.match(fs.readFileSync('FORM1000.md', 'utf8'), /moe\.unfMOEPCSelectU/);
assert.match(fs.readFileSync('FINDINGS.md', 'utf8'), /moe\.unfMOEPCSelectU/);

console.log('form1000-optimise: ok');
