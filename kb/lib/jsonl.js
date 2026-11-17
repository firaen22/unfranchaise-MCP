import fs from 'node:fs';
import readline from 'node:readline';

export async function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const rows = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    rows.push(JSON.parse(t));
  }
  return rows;
}

export function writeJsonl(filePath, rows) {
  const body = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
  fs.writeFileSync(filePath, body, 'utf8');
}

export function appendJsonl(filePath, rows) {
  const body = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
  fs.appendFileSync(filePath, body, 'utf8');
}