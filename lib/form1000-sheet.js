import fs from 'node:fs';
import path from 'node:path';

const CHARGE_COLUMNS = ['shippingHkd', 'shipping', 'taxHkd', 'tax', 'feeHkd', 'fee', 'feesHkd', 'fees'];
const MAX_LINE_HKD = 1_000_000;
const MAX_SPLIT_QTY = 8;

export function centsToHkd(cents) {
  return cents / 100;
}

/** Parse an HKD amount to integer cents. Blank is null. */
export function parseHkdToCents(value, field) {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
    if (Object.is(value, -0)) return 0;
    return Math.round(value * 100);
  }
  const raw = String(value).trim().replace(/HK\$/gi, '').replace(/,/g, '').replace(/\s/g, '');
  if (!raw) return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error(`${field} must be an HKD amount`);
  const sign = match[1] === '-' ? -1 : 1;
  const whole = Number(match[2]);
  const frac = match[3] ?? '';
  const millis = Number((frac + '000').slice(0, 3));
  let cents = whole * 100 + Math.floor(millis / 10);
  if (millis % 10 >= 5) cents += 1;
  return sign * cents;
}

function parseBoolCell(value, field, defaultValue = false) {
  if (value == null || String(value).trim() === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === 'yes' || text === 'y' || text === '1') return true;
  if (text === 'false' || text === 'no' || text === 'n' || text === '0') return false;
  throw new Error(`${field} must be true or false`);
}

function parsePositiveQty(value, field, { allowEmpty = true } = {}) {
  if (value == null || String(value).trim() === '') {
    if (allowEmpty) return null;
    throw new Error(`${field} is required`);
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || value > 9999) {
      throw new Error(`${field} must be a positive integer`);
    }
    return value;
  }
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error(`${field} must be a positive integer`);
  const qty = Number(text);
  if (qty < 1 || qty > 9999) throw new Error(`${field} must be a positive integer`);
  return qty;
}

function cellText(value, field) {
  const text = String(value ?? '').trim();
  if (text.length > 200) throw new Error(`${field} is too long`);
  return text;
}

function splitCents(totalCents, parts) {
  const base = Math.floor(totalCents / parts);
  const extra = totalCents - base * parts;
  const out = [];
  for (let i = 0; i < parts; i++) out.push(base + (i < extra ? 1 : 0));
  return out;
}

/**
 * @param {Record<string, unknown>} raw
 * @param {number} index data-row index starting at 0
 */
export function normaliseSheetRow(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`sheet row ${index + 1} must be an object`);
  }
  const where = `sheet row ${index + 1}`;
  const orderDate = cellText(raw.orderDate, `${where} orderDate`);
  const orderNumber = cellText(raw.orderNumber, `${where} orderNumber`);
  const sku = cellText(raw.sku, `${where} sku`);
  const productName = cellText(raw.productName, `${where} productName`);
  if (!orderNumber && !sku && !productName) {
    throw new Error(`${where}: sku, productName, or orderNumber is required`);
  }
  const qty = parsePositiveQty(raw.qty, `${where} qty`);
  const unitCents = parseHkdToCents(raw.unitProductAmountHkd, `${where} unitProductAmountHkd`);
  const lineCents = parseHkdToCents(raw.lineProductTotalHkd, `${where} lineProductTotalHkd`);
  let productCents = lineCents;
  if (productCents == null && unitCents != null && qty != null) productCents = unitCents * qty;
  if (productCents == null) throw new Error(`${where}: lineProductTotalHkd is required`);
  if (productCents <= 0) throw new Error(`${where}: lineProductTotalHkd must be greater than 0`);
  if (productCents > MAX_LINE_HKD * 100) throw new Error(`${where}: lineProductTotalHkd is too large`);
  if (unitCents != null && unitCents < 0) throw new Error(`${where}: unitProductAmountHkd must be >= 0`);
  if (unitCents != null && qty != null && lineCents != null && unitCents * qty !== lineCents) {
    throw new Error(`${where}: unitProductAmountHkd * qty does not match lineProductTotalHkd`);
  }

  const alreadyPlaced = parseBoolCell(raw.alreadyPlaced, `${where} alreadyPlaced`, false);
  const allowSplit = parseBoolCell(raw.allowSplit, `${where} allowSplit`, false);
  const personalUse = parseBoolCell(raw.personalUse, `${where} personalUse`, false);

  let separable = 0;
  if (raw.splitQty != null && String(raw.splitQty).trim() !== '') {
    const splitQty = Number(String(raw.splitQty).trim());
    if (!Number.isInteger(splitQty) || splitQty < 0) {
      throw new Error(`${where}: splitQty must be a whole number`);
    }
    if (qty == null) throw new Error(`${where}: splitQty requires qty`);
    if (splitQty > qty) throw new Error(`${where}: splitQty cannot exceed qty`);
    separable = splitQty;
  } else if (allowSplit) {
    if (qty == null) throw new Error(`${where}: allowSplit requires qty`);
    separable = qty;
  }
  if (separable > MAX_SPLIT_QTY) {
    throw new Error(`${where}: allowSplit supports qty up to ${MAX_SPLIT_QTY}`);
  }

  const pieces = [];
  if (separable > 0) {
    const units = splitCents(productCents, qty);
    for (let i = 0; i < separable; i++) pieces.push({ qty: 1, cents: units[i] });
    if (separable < qty) {
      const restCents = units.slice(separable).reduce((sum, cents) => sum + cents, 0);
      pieces.push({ qty: qty - separable, cents: restCents });
    }
  } else {
    pieces.push({ qty: qty ?? 1, cents: productCents });
  }

  const ignoredCharges = {};
  for (const column of CHARGE_COLUMNS) {
    if (raw[column] == null || String(raw[column]).trim() === '') continue;
    const cents = parseHkdToCents(raw[column], `${where} ${column}`);
    if (cents == null) continue;
    if (cents < 0) throw new Error(`${where}: ${column} must be >= 0`);
    ignoredCharges[column] = centsToHkd(cents);
  }
  const costCents = parseHkdToCents(raw.costHkd, `${where} costHkd`);
  const retailCents = parseHkdToCents(raw.retailHkd, `${where} retailHkd`);
  if (costCents != null && costCents < 0) throw new Error(`${where}: costHkd must be >= 0`);
  if (retailCents != null && retailCents < 0) throw new Error(`${where}: retailHkd must be >= 0`);

  return {
    lineId: index,
    orderDate,
    orderNumber,
    sku,
    productName,
    qty,
    unitProductAmountHkd: unitCents == null ? null : centsToHkd(unitCents),
    productCents,
    alreadyPlaced,
    allowSplit: separable > 0,
    personalUse,
    pieces,
    costHkd: costCents == null ? null : centsToHkd(costCents),
    retailHkd: retailCents == null ? null : centsToHkd(retailCents),
    ignoredCharges: Object.keys(ignoredCharges).length ? ignoredCharges : null,
  };
}

export function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}

export function loadSheetFromCsv(text) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const header = table[0].map((cell) => cell.trim());
  if (!header.includes('lineProductTotalHkd') && !header.includes('unitProductAmountHkd')) {
    throw new Error('sheet is missing lineProductTotalHkd or unitProductAmountHkd');
  }
  return table.slice(1).map((cells) => {
    const row = {};
    header.forEach((name, index) => {
      if (name) row[name] = cells[index] ?? '';
    });
    return row;
  });
}

export function assertSafeDataPath(filePath, label) {
  if (!filePath || typeof filePath !== 'string') throw new Error(`${label} path is required`);
  if (filePath.includes('\0')) throw new Error(`${label} path is invalid`);
  const base = path.basename(filePath);
  if (/\.cookie$/i.test(base) || /cookie/i.test(base)) {
    throw new Error(`Refusing to use a cookie file as ${label}`);
  }
}

export function loadSheetFromFile(filePath) {
  assertSafeDataPath(filePath, 'sheet');
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`sheet not found: ${filePath}`);
  }
  return loadSheetFromCsv(fs.readFileSync(resolved, 'utf8'));
}
