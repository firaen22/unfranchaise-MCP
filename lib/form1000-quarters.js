import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeQuarterPath } from './form1000-sheet.js';

export const QUARTER_SCHEMA = 'unf-form1000-quarters-v1';
export const DEADLINE_RULE = 'last day of the quarter, 11:59 pm US Eastern';
const TIME_ZONE = 'America/New_York';
const DOC_KEYS = new Set(['schema', 'example', 'deadlineRule', 'note', 'quarters']);
const QUARTER_KEYS = new Set(['quarterDate', 'start', 'end', 'deadline', 'deadlineLabel']);
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function exampleQuartersPath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'form1000-quarters.example.json');
}

function zoneParts(utcMs) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

/** UTC instant for a wall-clock time in America/New_York. */
export function zonedTimeToUtc(year, month, day, hour, minute) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    const parts = zoneParts(utc);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    const diff = desired - asUtc;
    utc += diff;
    if (diff === 0) break;
  }
  return new Date(utc);
}

function offsetLabel(utcDate) {
  const parts = zoneParts(utcDate.getTime());
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMin = Math.round((asUtc - utcDate.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function isoDateParts(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error('invalid date');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseDmy(dayText, monthText, yearText) {
  if (!/^\d{2}$/.test(dayText) || !/^\d{2}$/.test(monthText) || !/^\d{4}$/.test(yearText)) {
    throw new Error('quarterDate must be DD/MM/YYYY-DD/MM/YYYY');
  }
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error('quarterDate contains a calendar date that does not exist');
  }
  return `${yearText}-${monthText}-${dayText}`;
}

export function quarterWindowFromQuarterDate(quarterDate) {
  const text = String(quarterDate ?? '').trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})-(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) throw new Error('quarterDate must be DD/MM/YYYY-DD/MM/YYYY');
  const start = parseDmy(match[1], match[2], match[3]);
  const end = parseDmy(match[4], match[5], match[6]);
  if (start > end) throw new Error('quarter start is after quarter end');
  const endParts = isoDateParts(end);
  const instant = zonedTimeToUtc(endParts.year, endParts.month, endParts.day, 23, 59);
  const offset = offsetLabel(instant);
  const deadline = `${end}T23:59:00${offset}`;
  return {
    quarterDate: `${match[1]}/${match[2]}/${match[3]}-${match[4]}/${match[5]}/${match[6]}`,
    start,
    end,
    deadline,
    deadlineLabel: `${endParts.day} ${MONTHS[endParts.month - 1]} ${endParts.year}, 11:59 pm US Eastern`,
  };
}

function assertNote(note) {
  if (note == null) return;
  if (typeof note !== 'string' || note.length > 240) throw new Error('quarter note must be a short string');
  if (note.includes('@') || /\d{12,}/.test(note)) {
    throw new Error('quarter note must not contain an email address or a long number');
  }
}

function assertDocument(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('quarter file must be a JSON object');
  for (const key of Object.keys(doc)) {
    if (!DOC_KEYS.has(key)) throw new Error(`quarter file has unsupported field "${key}"`);
  }
  if (doc.schema !== QUARTER_SCHEMA) throw new Error(`quarter file schema must be ${QUARTER_SCHEMA}`);
  if (typeof doc.example !== 'boolean') throw new Error('quarter file example must be a boolean');
  if (doc.deadlineRule !== DEADLINE_RULE) throw new Error('quarter file deadlineRule does not match the recorded rule');
  assertNote(doc.note);
  if (!Array.isArray(doc.quarters)) throw new Error('quarter file quarters must be an array');
  for (const quarter of doc.quarters) {
    if (!quarter || typeof quarter !== 'object' || Array.isArray(quarter)) {
      throw new Error('quarter entry must be an object');
    }
    for (const key of Object.keys(quarter)) {
      if (!QUARTER_KEYS.has(key)) throw new Error(`quarter entry has unsupported field "${key}"`);
    }
    const expected = quarterWindowFromQuarterDate(quarter.quarterDate);
    for (const key of QUARTER_KEYS) {
      if (quarter[key] !== expected[key]) {
        throw new Error(`quarter entry ${quarter.quarterDate} does not match ${key}`);
      }
    }
  }
  return doc;
}

export function loadQuarters(filePath) {
  assertSafeQuarterPath(filePath);
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`quarter file not found: ${filePath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    throw new Error('quarter file is not valid JSON');
  }
  return assertDocument(parsed);
}

export function loadExampleQuarters() {
  return loadQuarters(exampleQuartersPath());
}

export function emptyQuarterDocument() {
  return {
    schema: QUARTER_SCHEMA,
    example: false,
    deadlineRule: DEADLINE_RULE,
    note: 'Recorded quarter windows only. No personal balances.',
    quarters: [],
  };
}

export function recordQuarter(filePath, quarterDate) {
  assertSafeQuarterPath(filePath);
  const window = quarterWindowFromQuarterDate(quarterDate);
  const resolved = path.resolve(filePath);
  let doc = emptyQuarterDocument();
  if (fs.existsSync(resolved)) {
    doc = loadQuarters(resolved);
    if (doc.example) throw new Error('Refusing to write over an example quarter fixture');
  }
  const next = doc.quarters.filter((quarter) => quarter.quarterDate !== window.quarterDate);
  next.push(window);
  next.sort((a, b) => a.start.localeCompare(b.start));
  const saved = {
    schema: QUARTER_SCHEMA,
    example: false,
    deadlineRule: DEADLINE_RULE,
    note: doc.note || emptyQuarterDocument().note,
    quarters: next,
  };
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(saved, null, 2)}\n`);
  return saved;
}

export function readQuartersDocument(filePath) {
  if (filePath) {
    return {
      source: 'file',
      live: false,
      personalBalances: null,
      network: false,
      document: loadQuarters(filePath),
    };
  }
  return {
    source: 'example_fixture',
    live: false,
    personalBalances: null,
    network: false,
    document: loadExampleQuarters(),
  };
}

export function formatQuartersReport(payload) {
  const doc = payload.document ?? payload;
  const lines = [
    'Form 1000 quarter windows',
    DEADLINE_RULE,
    doc.example ? 'Example fixture only. Not a live account and not a personal balance.' : 'Local record. No personal balances.',
    '',
  ];
  if (!doc.quarters.length) {
    lines.push('(no quarters recorded)');
    return lines.join('\n');
  }
  for (const quarter of doc.quarters) {
    lines.push(`${quarter.quarterDate}`);
    lines.push(`  start ${quarter.start}  end ${quarter.end}`);
    lines.push(`  deadline ${quarter.deadlineLabel}`);
    lines.push(`  instant ${quarter.deadline}`);
  }
  return lines.join('\n');
}
