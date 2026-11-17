import fs from 'node:fs';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).filter(Boolean).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

export function serializeCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

export function readEvalCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

export function writeEvalCsv(filePath, headers, rows) {
  fs.writeFileSync(filePath, serializeCsv(headers, rows), 'utf8');
}