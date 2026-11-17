/** Heuristic claim_class for ingest (plan §6 A1). */

import {
  commercialDetectionLayers,
  decodePercentEncoding,
} from './guard-normalize.js';
import { detectSpelledEnglishCommercial } from './spelled-commercial-en.js';

export { decodePercentEncoding } from './guard-normalize.js';

const ORDER_HOST =
  '(?:hk\\.unfranchise\\.com|(?:hk\\.)?shop\\.com|shopglobal\\.com|marketHongkong\\.com\\.hk|markethongkong\\.com\\.hk)';

/** CFM order actions — single source for ORDER_URL and canary text scans. */
export const ORDER_CFM_ACTION_PATTERN =
  '(?:shopping\\.unf(?:Cart|ViewCart|UpdateCart|Ordering|Product)|orders\\.(?:unfBillShip|productReorder|unfAddCartAJAX|unfManageUniversalAuto)|express\\.(?:unfExpressPay|unfProcessExpressOrder)|autoship\\.(?:unfAutoShip|saAutoShip))';

const ORDER_URL = new RegExp(
  [
    `https?:\\/\\/[^\\s)\\]"']*${ORDER_HOST}[^\\s)\\]"']*(?:cart|checkout|order|Basket|addtocart)`,
    `(?:https?:\\/\\/)?${ORDER_HOST}[^\\s)\\]"']*(?:cart|checkout|order|Shopping)`,
    `https?:\\/\\/(?:www\\.)?marketHongkong\\.com\\.hk\\/[^\\s)\\]"']+`,
    `(?:https?:\\/\\/)?(?:www\\.)?marketHongkong\\.com\\.hk\\/[^\\s)\\]"']+`,
    `https?:\\/\\/(?:www\\.|hk\\.)?shop\\.com\\/[^\\s)\\]"']*`,
    `(?:https?:\\/\\/)?(?:www\\.|hk\\.)?shop\\.com\\/[^\\s)\\]"']*`,
    `https?:\\/\\/(?:www\\.)?shopglobal\\.com\\/[^\\s)\\]"']+`,
    `(?:https?:\\/\\/)?(?:www\\.)?shopglobal\\.com\\/[^\\s)\\]"']+`,
    `https?:\\/\\/(?:www\\.)?marketamerica\\.com\\/[^\\s)\\]"']*(?:checkout|cart|order)`,
    `(?:https?:\\/\\/)?(?:www\\.)?marketamerica\\.com\\/[^\\s)\\]"']*(?:checkout|cart|order)`,
    `https?:\\/\\/${ORDER_HOST}[^\\s)\\]"']*action=${ORDER_CFM_ACTION_PATTERN}`,
    `(?:https?:\\/\\/)?${ORDER_HOST}[^\\s)\\]"']*action=${ORDER_CFM_ACTION_PATTERN}`,
    `https?:\\/\\/${ORDER_HOST}\\/?(?:\\s|$|[)"'\\]])`,
    `(?:\\?|&)action=${ORDER_CFM_ACTION_PATTERN}`,
    `\\b${ORDER_CFM_ACTION_PATTERN}\\b`,
    `index\\.cfm\\?[^\\s"'<>]+(?:\\?|&)action=${ORDER_CFM_ACTION_PATTERN}`,
    `(?:^|[\\s"'<(])\\/?index\\.cfm\\?action=${ORDER_CFM_ACTION_PATTERN}`,
    `index\\.cfm\\?action=${ORDER_CFM_ACTION_PATTERN}`,
  ].join('|'),
  'i',
);

export function normalizeForDetection(text) {
  if (!text) return '';
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/"([^"]+)"\s*:/g, '$1:')
    .replace(
      /:\s*"(\s*[+-]?[\d.,]+(?:e[+-]?\d+)?\s*)"/gi,
      (_, n) => `:${n.trim().replace(/,/g, '').replace(/\s+/g, '')}`,
    )
    .replace(/:\s*"(\s*[\d.,\-]+\s*)"/g, (_, n) => `:${n.trim().replace(/,/g, '').replace(/\s+/g, '')}`)
    .replace(/:\s*"(\s*\d[\d\s]*\s*)"/g, (_, n) => `:${n.replace(/\s+/g, '')}`)
    .replace(/\*+/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMMERCIAL_PATTERNS = [
  /\b(?:BV|IBV|UC)\b\s*[=＝:：>]?\s*\+?-?\s*(?:\.\d+|\d+(?:\.\d+)?)/i,
  /\d+(?:\.\d+)?\s*(?:BV|IBV|UC)\b/i,
  /\b(?:BV|IBV|UC)\s+of\s+\d+/i,
  /<td>\s*(?:BV|IBV|UC)\s*<\/td>\s*<td>\s*[\d.]+/i,
  /\b(?:HK\$|HKD)\s*\+?-?\s*[\d,]+(?:\.\d{2})?/i,
  /(?:HK\$|HKD)[\s]*\+?-?\s*[\d,]+/i,
  /\$\s*-?\s*[\d,]+(?:\.\d{2})?/,
  /(?:USD|US\$)\s*[\d,]+/i,
  /售價\s*[\d,]+/,
  /(?:售價){2,}[０-９\d,]+/,
  /\bSRP\b\s*[:：=]?\s*\+?-?\s*[\d,]+/i,
  /\bForm\s*1000\b/i,
  /(?:promo|promotion|off)\b[^\n]{0,40}\d+/i,
  /(?:折扣|優惠)[^\n]{0,20}\d+/,
  /\d+\s*%\s*(?:off|折扣)/i,
  /\|\s*[^|\n]+\|\s*[\d,]+/,
  /\|\s*HK\$\s*\|/i,
  /\bPrice\s*:\s*\$/i,
  /\b(?:BV|IBV|UC)\s+is\s+\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+equals\s+\+?-?\s*[\d.]+/i,
  /\bSRP\s+is\s+\+?-?\s*[\d,]+/i,
  /\bPrice\s*:\s*(?:EUR|USD|HKD|GBP|CNY|RMB)\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s*:\s*€\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s*:\s*£\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s*:\s*[¥￥]\s*[\d.,]+/i,
  /\b(?:BV|IBV|UC|SRP)\b\s*[:：]\s*\+?\s*\.?\d+(?:\.\d+)?/i,
  /\bPrice\b\s*[:：]\s*\.?\d+(?:\.\d+)?/i,
  /\bPrice\s*:\s*\+?-?\s*[\d.]+/i,
  /\bPrice\s+is\s+\+?-?\s*[\d.]+/i,
  /\bPrice\s*=\s*\+?-?\s*[\d.]+/i,
  /(?:港幣|港元|人民幣|RMB)\s*[\d,]+/,
  /[\d,]+\s*(?:港幣|港元|人民幣)/,
  /\b(?:BV|IBV|UC)\d+(?:\.\d+)?\b/i,
  /\b\d+(?:\.\d+)?\s*(?:BV|IBV|UC)\d*\b/i,
  /售價\s*[:：]\s*\+?-?\s*[\d,]+/,
  /售價\s*[:：]\s*[\u4e00-\u9fa5〇零一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+(?:港元|港币|元)?/,
  /售價[\u4e00-\u9fa5]{0,12}?\d+(?:[.,]\d+)?元/,
  /售價\s*為\s*\+?-?\s*[\d,]+/,
  /售價為[\u4e00-\u9fa5〇零一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+元/,
  /\bSRP\s+of\s+\+?-?\s*[\d,]+/i,
  /\d+\s*%\s*discount/i,
  /(?:^|[;\s])(?:BV|IBV|UC|HK\$|HKD|SRP|Price)\s*\|\s*[\d.,]+/i,
  /\bPrice\s+[\d,]+/i,
  /\bprice\s+[\d,]+/i,
  /discount\s+\d+\s*%?/i,
  /\d+\s+percent\s+off/i,
  /(?:零售價|價錢|會員價|批發價|超連鎖成本價)\s*[:：=]?\s*\+?-?\s*[\d,]+/,
  /(?:零售價|價錢|會員價|批發價|售價|超連鎖成本價)\s*(?:為|是)\s*\+?-?\s*[\d,]+/,
  /(?:零售價|價錢|會員價|批發價|售價|超連鎖成本價)\s*=\s*\+?-?\s*[\d,]+/,
  /[\d,]+(?:\.\d+)?\s*HKD\b/i,
  /\d+\s+off\b/i,
  /save\s+\d+\s+off\b/i,
  /\d+折/,
  /Business\s+Volume\s*:\s*\+?\s*-?\s*[\d.]+/i,
  /\bBusiness\s+Volume\s*=\s*\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s*=\s*\+?\s*\.?\d+(?:\.\d+)?/i,
  /IBV\s+points?\s*:\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+points?\s*[:：=]\s*\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV)\s*\(\s*points\s*\)\s*[:：=]?\s*\+?-?\s*[\d.]+/i,
  /Business\s+Volume\s*\(\s*BV\s*\)\s*[:：=]\s*\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC|SRP)\s+(?:value|percentage)\s*[:：=]\s*\+?-?\s*[\d.]+%?/i,
  /\b(?:BV|IBV|UC)\s+value\s+is\s+\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+value\s+equals\s+\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+value\s+of\s+\+?-?\s*[\d.]+/i,
  /\bPrice\s*=\s*(?:€|£)\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s+is\s+(?:€|£)\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s+is\s+(?:EUR|USD|HKD|GBP|CNY|RMB)\s+[\d.,]+/i,
  /\b(?:BV|IBV|UC)\s+points?\s+are\s+\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+percentage\s+is\s+\+?-?\s*[\d.]+%?/i,
  /\bIBV\s+percentage\s+equals\s+\+?-?\s*[\d.]+%?/i,
  /\bSRP\s*=\s*(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bSRP\s*:\s*(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bSRP\s+equals\s+\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s*:\s*(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bSRP\s+is\s+(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s+is\s+\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s+is\s+(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s+equals\s+\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s+equals\s+(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s+of\s+\+?-?\s*[\d.,]+/i,
  /\bSRP\s+value\s+of\s+(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s+equals\s+\+?-?\s*[\d.,]+/i,
  /\bPrice\s+equals\s+(?:€|£|\$|[¥￥])\s*\+?-?\s*[\d.,]+/i,
  /\b(?:BV|IBV|UC)\s+points?\s+is\s+\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+points?\s+equals?\s+\+?-?\s*[\d.]+/i,
  /\b(?:BV|IBV|UC)\s+points?\s+of\s+\+?-?\s*[\d.]+/i,
  /\bThe\s+(?:BV|IBV|UC)\s+points?\s+are\s+\+?-?\s*[\d.]+/i,
  /\bThe\s+(?:BV|IBV|UC)\s+percentage\s+is\s+\+?-?\s*[\d.]+%?/i,
  /\b(?:UC|SRP)\s*\(\s*HKD\s*\)\s*[:：=]\s*\+?-?\s*[\d.,]+/i,
  /\b(?:UC|SRP)\s*\(\s*HK\$\s*\)\s*[:：=]\s*\+?-?\s*[\d.,]+/i,
  /\b(?:BV|IBV|UC)\s*:\s*(?:€|£|\$)\s*[\d.,]+/i,
  /\b(?:BV|IBV|UC)\s*:\s*(?:EUR|USD|HKD|GBP)\s+[\d.,]+/i,
  /\bSRP\s*\(\s*HK\$\s*\)\s*[:：]?\s*\+?-?\s*[\d.,]+/i,
  /\bPrice\s*\(\s*HKD\s*\)\s*[:：]?\s*-?[\d.,]+/i,
  /\bPrice\s*\(\s*(?:USD|EUR|HKD|GBP|CNY|RMB)\s*\)\s*[:：]?\s*[\d.,]+/i,
  /\bSRP\s*\(\s*USD\s*\)\s*[:：=]\s*\+?-?\s*[\d.,]+/i,
  /Retail\s+price\s*\(HKD\)\s*:\s*[\d.,]+/i,
  /\bbvPoints\s*[:=]?\s*-?[\d.]+/i,
  /\bprdBv\s*[:=]?\s*[\d.]+/i,
  /\bbvTotal\s*[:=]?\s*[\d.]+/i,
  /\bibvPoints\s*[:=]?\s*[\d.]+/i,
  /\bucPoints\s*[:=]?\s*[\d.]+/i,
  /\bsrpHkd\s*[:=]?\s*-?[\d.]+/i,
  /\bucHkd\s*[:=]?\s*-?[\d.]+/i,
  /\bpromoPriceHkd\s*[:=]?\s*[\d.]+/i,
  /Business\s+Volume\s+is\s+\+?-?\s*[\d.]+/i,
  /\bretailTotalHkd\s*[:=]?\s*[\d.]+/i,
  /\bwholesaleTotalHkd\s*[:=]?\s*[\d.]+/i,
  /\bprdRetail\s*[:=]?\s*[\d.]+/i,
  /\bibvTotal\s*[:=]?\s*-?[\d.]+/i,
  /\bibvPercent\s*[:=]?\s*\+?-?[\d.]+/i,
  /\b(?:bvPoints|ibvPoints|ucPoints|ucHkd|prdRetail|prdBv|bvTotal|ibvTotal|ibvPercent|srpHkd|retailTotalHkd|wholesaleTotalHkd|promoPriceHkd)\s*:\s*\+?-?[\d.,]+(?:e[+-]?\d+)?/i,
  /"(?:bvPoints|ibvPoints|ucPoints|ucHkd|prdBv|srpHkd|retailTotalHkd)"\s*:\s*"(?:-?[\d.,]+(?:e[+-]?\d+)?)"/i,
];

/** Composed label + connector + optional currency + number (A1 root guard). */
const COMMERCIAL_LABEL =
  '(?:SRP|Price|BV|IBV|UC|PBV|GBV|PIBV|Business\\s+Volume|Retail\\s+price|Wholesale\\s+price|Wholesale\\s+cost)';
const COMMERCIAL_CURRENCY =
  '(?:€|£|\\$|[¥￥]|EUR|USD|HKD|GBP|CNY|RMB|HK\\$)';
const COMMERCIAL_CONNECTOR =
  '(?:[:=＝：]|\\b(?:is|was|were|equals|totals)\\b|amounts\\s+to\\b|comes\\s+to\\b|amount\\s*[:：]|amount\\s+is|value\\s*[:=]|value\\s+is|value\\s+equals|value\\s+of|points?\\s+is|points?\\s+equals|points?\\s+of|percentage\\s+is|percentage\\s+equals|percentage\\s+of|percent\\s+of|percent\\s*[:：])';
const COMMERCIAL_TOKEN_RE = new RegExp(
  `\\b${COMMERCIAL_LABEL}\\b|[\\p{L}\\p{N}]+(?:[.,][\\p{L}\\p{N}]+)*`,
  'giu',
);
const COMMERCIAL_LABEL_TOKEN_RE = new RegExp(`^${COMMERCIAL_LABEL}$`, 'i');

function detectCommercialLabelNearNumber(text) {
  // Chinese has no word separators. Canonicalize volume labels, then count
  // individual Han characters; alphanumeric SKUs remain whole, nonnumeric tokens.
  const t = normalizeForDetection(text)
    .replace(/(?:獎勵)?業績點數/g, ' BV ')
    .replace(/\p{Script=Han}/gu, ' $& ');
  let lastLabel = -Infinity;
  let lastNumber = -Infinity;
  let index = 0;
  for (const [token] of t.matchAll(COMMERCIAL_TOKEN_RE)) {
    if (COMMERCIAL_LABEL_TOKEN_RE.test(token)) {
      if (index - lastNumber <= 7) return true;
      lastLabel = index;
    } else if (/^\d+(?:[.,]\d+)*(?:e\d+)?$/i.test(token)) {
      if (index - lastLabel <= 7) return true;
      lastNumber = index;
    }
    index += 1;
  }
  return false;
}
const COMMERCIAL_NUMBER = '\\+?-?\\s*[\\d.,]+(?:%)?';
const COMMERCIAL_CONNECTOR_RE = new RegExp(
  `\\b${COMMERCIAL_LABEL}(?:\\s*\\(\\s*(?:USD|EUR|HKD|GBP|HK\\$|CNY|RMB)\\s*\\))?\\s*${COMMERCIAL_CONNECTOR}\\s*(?:${COMMERCIAL_CURRENCY}\\s*)?${COMMERCIAL_NUMBER}`,
  'i',
);

function detectCommercialConnectorPhrase(text) {
  const t = normalizeForDetection(text);
  return COMMERCIAL_CONNECTOR_RE.test(t);
}

export function detectOrderUrl(text) {
  const raw = String(text ?? '');
  return commercialDetectionLayers(raw).some((layer) => ORDER_URL.test(normalizeForDetection(layer)));
}

const CITATION_JSON_CHUNK_RE = /"chunk_id"\s*:/i;

/** Citation-shaped JSON blobs embedded in generation / host context haystacks. */
function findCitationJsonBlocks(text) {
  const raw = String(text ?? '');
  const blocks = [];
  const re = /\{[^{}]{0,24000}\}/g;
  for (const match of raw.matchAll(re)) {
    const block = match[0];
    if (!CITATION_JSON_CHUNK_RE.test(block)) continue;
    try {
      JSON.parse(block);
      blocks.push(block);
    } catch {
      /* not a complete JSON object */
    }
  }
  return blocks;
}

function layerCommercialOrOrder(layer) {
  if (!layer) return false;
  return detectCommercialNumeric(layer) || detectOrderUrl(layer);
}

/**
 * A1/A5: scan citation-shaped JSON on evidence fields only — not serialized metadata
 * (e.g. doc_version `manual-0.4` must not proximity-bind to BV in `text`).
 */
export function knowledgePayloadCommercialOrOrderLeak(payload) {
  const raw = String(payload ?? '').trim();
  if (!raw) return false;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (CITATION_JSON_CHUNK_RE.test(raw)) {
      const blocks = findCitationJsonBlocks(raw);
      if (blocks.length) {
        return blocks.some((block) => knowledgePayloadCommercialOrOrderLeak(block));
      }
    }
    return layerCommercialOrOrder(raw);
  }
  if (parsed == null) return false;
  if (Array.isArray(parsed)) {
    return parsed.some((row) => {
      if (!row || typeof row !== 'object') return layerCommercialOrOrder(String(row));
      return ['text', 'snippet', 'chunk_id'].some((k) => {
        const v = row[k];
        return typeof v === 'string' && v.trim() && layerCommercialOrOrder(v);
      });
    });
  }
  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.hits)) {
      return parsed.hits.some((h) => {
        const body = h?.text ?? h?.snippet;
        return typeof body === 'string' && body.trim() && layerCommercialOrOrder(body);
      });
    }
    for (const field of ['text', 'snippet']) {
      const body = parsed[field];
      if (typeof body === 'string' && body.trim() && layerCommercialOrOrder(body)) return true;
    }
    if (typeof parsed.chunk_id === 'string' && parsed.chunk_id.trim()) {
      return layerCommercialOrOrder(parsed.chunk_id);
    }
    return false;
  }
  return layerCommercialOrOrder(raw);
}

/**
 * A5 generation boundary: field-scoped citation scan; never proximity-bind metadata
 * (e.g. doc_version `manual-0.4`) to BV in a sibling JSON field.
 */
export function textCommercialOrOrderLeak(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return false;
  const blocks = findCitationJsonBlocks(raw);
  let remainder = raw;
  for (const block of blocks) {
    if (knowledgePayloadCommercialOrOrderLeak(block)) return true;
    remainder = remainder.split(block).join(' ');
  }
  if (blocks.length) {
    const tail = remainder.trim();
    if (tail && (detectCommercialNumeric(tail) || detectOrderUrl(tail))) return true;
    return false;
  }
  return detectCommercialNumeric(raw) || detectOrderUrl(raw);
}

/** Padding words between volume label and amount (A1 oracle escape). */
const VOLUME_LABEL_WORD_PADDING_NUMBER_RE =
  /\b(?:PIBV|PBV|GBV|BV|IBV|UC)\b(?:\s+\S+){5,6}\s+\d+(?:\.\d+)?(?:\s*%)?\b/i;

const SPELLED_CHINESE_VOLUME_RE =
  /\b(?:BV|IBV|UC)\s*[:：]\s*[\u4e00-\u9fa5〇零一二三四五六七八九十百千万]+/;

const SPELLED_CHINESE_VOLUME_COPULA_RE =
  /\b(?:BV|IBV|UC)\s*(?:是|為|等于)\s*[\u4e00-\u9fa5〇零一二三四五六七八九十百千万]+/;

const SPELLED_CHINESE_WHOLESALE_PRICE_RE =
  /批發價\s*[:：]\s*[\u4e00-\u9fa5〇零一二三四五六七八九十百千万]+(?:元|港元)?/;

const SPELLED_CHINESE_RETAIL_PRICE_SENTENCE_RE =
  /零售價(?:是|為)[\u4e00-\u9fa5〇零一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+元/;

function commercialNumericOnLayer(layer) {
  const t = normalizeForDetection(layer);
  if (COMMERCIAL_PATTERNS.some((re) => re.test(t))) return true;
  if (detectCommercialConnectorPhrase(t)) return true;
  if (VOLUME_LABEL_WORD_PADDING_NUMBER_RE.test(t)) return true;
  if (detectSpelledEnglishCommercial(t)) return true;
  if (SPELLED_CHINESE_VOLUME_RE.test(t)) return true;
  if (SPELLED_CHINESE_VOLUME_COPULA_RE.test(t)) return true;
  if (SPELLED_CHINESE_WHOLESALE_PRICE_RE.test(t)) return true;
  if (SPELLED_CHINESE_RETAIL_PRICE_SENTENCE_RE.test(t)) return true;
  if (detectCommercialLabelNearNumber(t)) return true;
  return false;
}

export function detectCommercialNumeric(text) {
  const raw = String(text ?? '');
  if (commercialDetectionLayers(raw).some((layer) => commercialNumericOnLayer(layer))) return true;
  if (/獎勵業績點數\s*[：:]\s*\+?-?\s*[\d.,]+/.test(raw)) return true;
  if (/業績點數\s*[：:]\s*\+?-?\s*[\d.,]+/.test(raw)) return true;
  const t = normalizeForDetection(raw);
  if (
    /\b(?:BV|IBV|UC)\b/i.test(t) &&
    /(?:^|\n)\s*(?:\+|-)?\d+(?:\.\d+)?\s*$/m.test(raw)
  ) {
    return true;
  }
  return false;
}

/** MCP/FINDINGS trap queries: skip kb_search (hosts must not cite KB for live commerce). */
export function detectKbSearchBlockedQuery(text) {
  if (detectCommercialNumeric(text) || detectOrderUrl(text)) return true;
  const low = String(text ?? '').toLowerCase();
  if (/\bsrp\b/.test(low) && /\bpromo\b/.test(low)) return true;
  if (/\bcart\b/.test(low) && /\bsubtotal\b/.test(low)) return true;
  if (/\badd sku\b/.test(low) && /\bcart\b/.test(low)) return true;
  if (/\bform\s*1000\b/.test(low)) return true;
  if (/\bwholesale bv\b/.test(low) && /\bsku\b/.test(low)) return true;
  if (/\bibv\b/.test(low) && /\blive site\b/.test(low)) return true;
  if (/\bbv\b/.test(low) && /\bus\s+shop\.com\b/.test(low)) return true;
  if (/\bbv vs ibv\b/.test(low) || /\bhk1410ibv\b/.test(low)) return true;
  if (/\bmanual\b/.test(low) || /\bpolicy\b/.test(low) || /\bsocial ads\b/.test(low)) {
    return false;
  }
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

/** Ingest doc_version stamps (manual-0.4, vault-0.8) are not commercial amounts. */
export function isBenignKnowledgeDocVersion(version) {
  return typeof version === 'string' && /^(?:manual|vault)-\d+(?:\.\d+)*$/.test(version.trim());
}

export function chunkGuardText(chunk) {
  const version = isBenignKnowledgeDocVersion(chunk?.doc_version) ? '' : chunk?.doc_version;
  return [chunk?.doc_title, version, chunk?.text].filter(Boolean).join('\n');
}

/** Fail-closed: re-check stored text (+ title) even when label is wrong (A1). */
export function textFailsCommercialGuard(text) {
  if (!text) return false;
  return detectCommercialNumeric(text) || detectOrderUrl(text);
}

export function identifierFailsKnowledgeGuard(id) {
  const s = String(id ?? '').trim();
  if (!s) return false;
  return detectCommercialNumeric(s) || detectOrderUrl(s);
}

export function chunkFailsCommercialGuard(chunk, manifestRow) {
  if (identifierFailsKnowledgeGuard(chunk?.chunk_id)) return true;
  if (identifierFailsKnowledgeGuard(manifestRow?.source_id)) return true;
  if (textFailsCommercialGuard(chunk?.text ?? '')) return true;
  for (const title of [chunk?.doc_title, manifestRow?.title].filter(Boolean)) {
    if (textFailsCommercialGuard(title)) return true;
  }
  const version = chunk?.doc_version ?? manifestRow?.doc_version;
  if (version && !isBenignKnowledgeDocVersion(version) && textFailsCommercialGuard(version)) {
    return true;
  }
  return false;
}
