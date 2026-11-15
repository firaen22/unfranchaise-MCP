/** Heuristic claim_class for ingest (plan §6 A1). */

const ORDER_HOST =
  '(?:hk\\.unfranchise\\.com|shop\\.com|shopglobal\\.com|marketHongkong\\.com\\.hk|markethongkong\\.com\\.hk)';

const ORDER_URL = new RegExp(
  [
    `https?:\\/\\/[^\\s)\\]"']*${ORDER_HOST}[^\\s)\\]"']*(?:cart|checkout|order|Basket|addtocart)`,
    `(?:https?:\\/\\/)?${ORDER_HOST}[^\\s)\\]"']*(?:cart|checkout|order|Shopping)`,
    `https?:\\/\\/${ORDER_HOST}\\/?(?:\\s|$|[)"'\\]])`,
  ].join('|'),
  'i',
);

export function normalizeForDetection(text) {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/\*+/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMMERCIAL_PATTERNS = [
  /\b(?:BV|IBV|UC)\b\s*[=＝:：>]?\s*\d+(?:\.\d+)?/i,
  /\d+(?:\.\d+)?\s*(?:BV|IBV|UC)\b/i,
  /\b(?:BV|IBV|UC)\s+of\s+\d+/i,
  /<td>\s*(?:BV|IBV|UC)\s*<\/td>\s*<td>\s*[\d.]+/i,
  /\b(?:HK\$|HKD)\s*[\d,]+(?:\.\d{2})?/i,
  /(?:HK\$|HKD)[\s]*[\d,]+/i,
  /\$\s*[\d,]+(?:\.\d{2})?/,
  /(?:USD|US\$)\s*[\d,]+/i,
  /售價\s*[\d,]+/,
  /\bSRP\b\s*[:：=]?\s*[\d,]+/i,
  /\bForm\s*1000\b/i,
  /(?:promo|promotion|off)\b[^\n]{0,40}\d+/i,
  /(?:折扣|優惠)[^\n]{0,20}\d+/,
  /\d+\s*%\s*(?:off|折扣)/i,
  /\|\s*[^|\n]+\|\s*[\d,]+/,
  /\|\s*HK\$\s*\|/i,
  /\bPrice\s*:\s*\$/i,
  /\b(?:BV|IBV|UC)\s+is\s+[\d.]+/i,
  /\bSRP\s+is\s+[\d,]+/i,
  /\bPrice\s*:\s*[\d.]+/i,
  /\bPrice\s+is\s+[\d.]+/i,
  /\bPrice\s*=\s*[\d.]+/i,
  /(?:港幣|港元|人民幣|RMB)\s*[\d,]+/,
  /[\d,]+\s*(?:港幣|港元|人民幣)/,
  /\b(?:BV|IBV|UC)\d+(?:\.\d+)?\b/i,
  /\b\d+(?:\.\d+)?\s*(?:BV|IBV|UC)\d*\b/i,
  /售價\s*[:：]\s*[\d,]+/,
  /\bSRP\s+of\s+[\d,]+/i,
  /\d+\s*%\s*discount/i,
  /(?:^|[;\s])(?:BV|IBV|UC|HK\$|HKD|SRP|Price)\s*\|\s*[\d.,]+/i,
  /\bPrice\s+[\d,]+/i,
  /\bprice\s+[\d,]+/i,
  /discount\s+\d+\s*%?/i,
  /\d+\s+percent\s+off/i,
  /(?:零售價|價錢|會員價)\s*[\d,]+/,
];

export function detectOrderUrl(text) {
  const t = normalizeForDetection(text);
  return ORDER_URL.test(t);
}

export function detectCommercialNumeric(text) {
  const t = normalizeForDetection(text);
  return COMMERCIAL_PATTERNS.some((re) => re.test(t));
}

/** MCP/FINDINGS trap queries: skip kb_search (hosts must not cite KB for live commerce). */
export function detectKbSearchBlockedQuery(text) {
  if (detectCommercialNumeric(text) || detectOrderUrl(text)) return true;
  const low = String(text ?? '').toLowerCase();
  if (/\bmanual\b/.test(low) || /\bpolicy\b/.test(low) || /\bsocial ads\b/.test(low)) {
    return false;
  }
  if (/\bsrp\b/.test(low) && /\bpromo\b/.test(low)) return true;
  if (/\bcart\b/.test(low) && /\bsubtotal\b/.test(low)) return true;
  if (/\badd sku\b/.test(low) && /\bcart\b/.test(low)) return true;
  if (/\bform\s*1000\b/.test(low)) return true;
  if (/\bwholesale bv\b/.test(low) && /\bsku\b/.test(low)) return true;
  if (/\bibv\b/.test(low) && /\blive site\b/.test(low)) return true;
  if (/\bbv\b/.test(low) && /\bus\s+shop\.com\b/.test(low)) return true;
  if (/\bbv vs ibv\b/.test(low) || /\bhk1410ibv\b/.test(low)) return true;
  return false;
}

/**
 * @returns {'commercial_numeric'|'order_url'|'operator_synthesis'|'policy'|'unknown'}
 */
export function classifyChunkText(text, { defaultClass = 'operator_synthesis' } = {}) {
  if (detectOrderUrl(text)) return 'order_url';
  if (detectCommercialNumeric(text)) return 'commercial_numeric';
  return defaultClass;
}

const FORBIDDEN = new Set(['commercial_numeric', 'order_url']);

export const ALLOWED_CLAIM_CLASSES = new Set([
  'operator_synthesis',
  'policy',
  'manual_policy',
  'official_social',
  'commercial_numeric',
  'order_url',
]);

export function isSchemaValidClaimClass(claimClass) {
  return typeof claimClass === 'string' && ALLOWED_CLAIM_CLASSES.has(claimClass);
}

export function isForbiddenClaimClass(claimClass) {
  if (!isSchemaValidClaimClass(claimClass)) return true;
  return FORBIDDEN.has(claimClass);
}

export function chunkGuardText(chunk) {
  return [chunk?.doc_title, chunk?.doc_version, chunk?.text].filter(Boolean).join('\n');
}

/** Fail-closed: re-check stored text (+ title) even when label is wrong (A1). */
export function textFailsCommercialGuard(text) {
  if (!text) return false;
  return detectCommercialNumeric(text) || detectOrderUrl(text);
}

export function chunkFailsCommercialGuard(chunk) {
  return textFailsCommercialGuard(chunkGuardText(chunk));
}