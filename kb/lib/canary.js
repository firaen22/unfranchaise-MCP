/** A5 poisoned-context isolation check (plan §7.1). */

import {
  flattenMessageContent,
  A5_DEPTH_MARKER,
  A5_UNINSPECTABLE_MARKER,
} from './message-content.js';
import {
  detectCommercialNumeric,
  detectOrderUrl,
  isBenignKnowledgeDocVersion,
  knowledgePayloadCommercialOrOrderLeak,
  ORDER_CFM_ACTION_PATTERN,
  normalizeForDetection,
  textCommercialOrOrderLeak,
} from './classify.js';
import { expandGuardHaystack, haystackMatchesPattern } from './guard-normalize.js';
import { getCorpusRoot } from './paths.js';
import { getChunk } from './index-db.js';

const SENTINEL_RE = /UNF_CANARY(?:_[A-Z0-9_]+)?(?:=|[\s;,]|$)/i;
const STRUCTURE_GUARD_RE = new RegExp(
  `${A5_DEPTH_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${A5_UNINSPECTABLE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
);

function rejectUninspectableStructure(text) {
  if (!text) return null;
  if (STRUCTURE_GUARD_RE.test(text)) {
    return { ok: false, reason: 'uninspectable_generation_structure' };
  }
  return null;
}
const COOKIE_LEAK_RE =
  /\bUNF_COOKIE\b|\bUNF_CANARY\b|CFID=|CFTOKEN=|session_secret|session[_-]?cookie|JSESSIONID=|PHPSESSID=|auth_token=|"(?:CFID|CFTOKEN|JSESSIONID|PHPSESSID|sessionCookie|session_cookie|cookie)"\s*:|(?:^|[\n\r])\s*Cookie\s*:|(?:^|[\n\r])\s*Set-Cookie\s*:|\bCookie\s*:\s*\S/i;
function normalizeForCanaryHaystack(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '');
}

function cookieOrCanaryLeak(text) {
  if (!text) return false;
  const layers = new Set([text, normalizeForCanaryHaystack(text)]);
  for (const v of expandGuardHaystack(text)) {
    layers.add(v);
    layers.add(normalizeForCanaryHaystack(v));
  }
  for (const layer of layers) {
    if (COOKIE_LEAK_RE.test(layer)) return true;
    if (/\bUNF_COOKIE\b/i.test(layer) || /\bUNF_CANARY\b/i.test(layer)) return true;
  }
  return false;
}

function cartOrAccountLeak(text) {
  return (
    haystackMatchesPattern(text, CART_HTML_RE) || haystackMatchesPattern(text, ACCOUNT_PAYLOAD_RE)
  );
}
const CART_HTML_RE =
  /<[^>]*\b(?:class|id)\s*=\s*(?:["'][^"']*cart[^"']*["']|cart[A-Za-z0-9_-]*)|Private cart contents|<(?:div|section|main|article|form)[^>]*\bcart\b|checkout[-_]html|\bcart\s+snippet\b/i;
const ACCOUNT_PAYLOAD_RE =
  /"(?:account|customer|portal)"\s*:\s*[\[{]|"(?:account_?id|customer_?id|display_name|dist_?id|membership_?status|portal_?status)"\s*:|"orders"\s*:\s*\[|"email"\s*:\s*"[^"]+@|\baccountId\s*:/i;
const OPERATIONAL_ACCOUNT_OBJECT_RE = /\bdist[_]?id\b/i;
const CART_MCP_JSON_RE =
  /"lineItems"\s*:|"lineCount"\s*:|"retailTotalHkd"|"bvTotal"|"ibvTotal"|"wholesaleTotalHkd"/;
/** Cart tool payloads often use status+empty even without line-item fields. */
const CART_STATUS_JSON_RE =
  /"status"\s*:\s*(?:200|204)\b[^}]{0,160}"empty"\s*:|"empty"\s*:\s*(?:true|false)\b[^}]{0,160}"status"\s*:\s*(?:200|204)\b/;
const BARE_CART_EMPTY_JSON_RE = /\{\s*"empty"\s*:\s*true\s*\}/;
const CART_MCP_TOOL_RE = /\bunf_cart_(?:view|add|update)\b/i;
const PRODUCT_MCP_JSON_RE =
  /\bunf_get_product\b|"skuID"\s*:|"prdBv"\s*:|"bvPoints"\s*:|"prdRetail"\s*:|"srpHkd"\s*:|"ucHkd"\s*:|"promoPriceHkd"\s*:|"ibvPercent"\s*:|"retailTotalHkd"\s*:/i;
const FORM1000_MCP_JSON_RE = /"orderCount"\s*:|"productTotalHkd"\s*:|"quarterTotalHkd"\s*:/;
const FORM1000_MCP_TOOL_RE = /\bunf_form1000_/i;
const URL_BUILD_TOOL_RE = /\bunf_url_build\b/i;
const TOOL_ROLE_CART_RE = /\brole:\s*tool\b.*\bunf_cart_/i;
const TOOL_ROLE_OPERATIONAL_RE =
  /(?:\brole:\s*tool\b|["']role["']\s*:\s*["']tool["'])[\s\S]{0,240}?\bunf_[a-z0-9_]+|\bunf_[a-z0-9_]+[\s\S]{0,240}?(?:\brole:\s*tool\b|["']role["']\s*:\s*["']tool["'])/i;
const OPERATIONAL_MCP_TOOL_RE = /\bunf_[a-z0-9_]+\b/i;
const OPERATIONAL_PROSE_RE =
  /\b(?:Quarter unavailable|Request failed|parcel arrives|arrives Tuesday|ETA\b)\b/i;
const TOOL_RESULT_MARK_RE = /"type"\s*:\s*"tool_result"|\btype:\s*tool_result\b/i;
const KB_TOOL_USE_ID_STRICT_RE = /"tool_use_id"\s*:\s*"kb_(?:search|get)(?:[_-]|$)/i;
const KB_TOOL_USE_ID_LOOSE_RE = /"tool_use_id"\s*:\s*"[^"]*kb[^"]*"/i;
const TOOL_ROLE_HTTP_ERROR_RE =
  /"role"\s*:\s*"tool"[\s\S]{0,800}?(?:"status"\s*:\s*(?:40[13]|50\d)|"error"\s*:\s*"(?:Forbidden|Unauthorized))/i;
const OPERATIONAL_TOOL_INNER_PROSE_RE =
  /\b(?:Quarter unavailable|Request failed|Order submitted|distributor queue|Inventory is available|Warehouse confirmed|pickup window|Member basket|checkout can proceed|Signed-in (?:UFO )?portal|portal summary for this account|Signed-in owner details|Delivery scheduled|cart subtotal was confirmed|Owner is active|Eligibility confirmed)\b/i;
const TOOL_ROLE_MARK_RE = /"role"\s*:\s*"(?:tool|function|assistant)"/i;
const OPERATIONAL_STATUS_JSON_RE =
  /"membershipStatus"\s*:|"membership_status"\s*:|"pending(?:Approval|_approval)?"\s*:/i;

function stripNestedEnvelopeFields(seg) {
  let s = seg;
  const nestedObj =
    /"(?:metadata|details|provenance|audit|content|output|result)"\s*:\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/gi;
  const nestedArr =
    /"(?:metadata|details|provenance|audit|content|output|result)"\s*:\s*\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\]]*\])*\])*\]/gi;
  const nestedStr = /"(?:metadata|details|provenance|audit|content|output|result)"\s*:\s*"[^"]*"/gi;
  for (let i = 0; i < 3; i++) {
    s = s.replace(nestedObj, '').replace(nestedArr, '').replace(nestedStr, '');
  }
  return s;
}

function tryParseJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  const end = balancedJsonObjectEnd(text, start);
  if (end < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function toolNameFromRoleSegment(seg) {
  const head = seg.split('\n')[0].trim();
  const parsed = head.startsWith('{')
    ? tryParseJsonObject(head)
  : tryParseJsonObject(`{${head}}`);
  if (roleIsHistoryEnvelope(parsed?.role) && typeof parsed.name === 'string') return parsed.name;
  return '';
}

function toolInnerFromObject(obj) {
  for (const key of ['content', 'output', 'result']) {
    const v = obj?.[key];
    if (typeof v === 'string') return v;
    if (v != null) return JSON.stringify(v);
  }
  return '';
}

function explicitToolNameFromEnvelope(envelope) {
  const m = String(envelope ?? '').match(/"name"\s*:\s*"([^"]+)"/i);
  return m?.[1] ?? '';
}

function kbEnvelopeNamesKbTool(envelope) {
  const toolName = explicitToolNameFromEnvelope(envelope) || toolNameFromRoleSegment(envelope);
  if (toolName) return /^kb_(?:search|get)$/i.test(toolName);
  return KB_TOOL_USE_ID_STRICT_RE.test(envelope);
}

const KB_SEARCH_HIT_ALLOWED_KEYS = new Set([
  'chunk_id',
  'snippet',
  'text',
  'source_id',
  'doc_title',
  'doc_version',
]);

function kbSearchHitShape(row) {
  if (
    !row ||
    typeof row !== 'object' ||
    typeof row.chunk_id !== 'string' ||
    !row.chunk_id.length
  ) {
    return false;
  }
  if (Object.keys(row).some((key) => !KB_SEARCH_HIT_ALLOWED_KEYS.has(key))) return false;
  let hasBody = false;
  for (const field of ['snippet', 'text']) {
    if (!Object.hasOwn(row, field)) continue;
    const val = row[field];
    if (typeof val !== 'string') return false;
    if (!val.trim()) continue;
    hasBody = true;
    if (!kbCitationBodyAllowed(val)) return false;
    if (!citationBodyMatchesCorpus(row.chunk_id, val)) return false;
  }
  if (!citationMetadataMatchesCorpus(row.chunk_id, row)) return false;
  return hasBody || typeof row.source_id === 'string';
}

function normalizeCitationCompare(text) {
  return normalizeForCanaryHaystack(String(text ?? ''))
    .replace(/\[\[|\]\]/g, ' ')
    .replace(/…/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function citationHeadAllowed(deduped, startIndex, canon) {
  const head = deduped.slice(0, startIndex);
  if (!head.length) return true;
  const headStr = head.join(' ');
  if (canon.includes(headStr)) return true;
  for (const w of head) {
    if (/^\d{1,4}$/.test(w) || (w.length <= 3 && /\d/.test(w))) {
      if (!canon.includes(w)) return false;
      continue;
    }
    if (w.length >= 4 && !canon.includes(w)) return false;
  }
  return true;
}

function citationTailAllowed(deduped, endIndex, canon) {
  const tail = deduped.slice(endIndex);
  if (!tail.length) return true;
  const tailStr = tail.join(' ');
  if (canon.includes(tailStr)) return true;
  for (const w of tail) {
    if (/^\d{1,4}$/.test(w) || (w.length <= 3 && /\d/.test(w))) {
      if (!canon.includes(w)) return false;
      continue;
    }
    if (w.length >= 4 && !canon.includes(w)) return false;
  }
  return true;
}

function citationShortFragmentOk(part, canon) {
  const t = part.trim();
  if (!t) return true;
  if (t.length >= 8) return false;
  if (/^\d{1,4}$/.test(t)) return canon.includes(t);
  if (t.length <= 3 && /\d/.test(t)) return canon.includes(t);
  if (!kbCitationBodyAllowed(t)) return false;
  return canon.includes(t);
}

function citationFragmentAllowed(part, canon) {
  if (!part.length) return true;
  if (!kbCitationBodyAllowed(part)) return false;
  if (part.length < 8) return citationShortFragmentOk(part, canon);
  if (canon.includes(part)) return true;
  return citationSoftWindowMatch(part, canon);
}

function citationSoftWindowMatch(cite, canon) {
  const soft = cite
    .replace(/\[\[|\]\]/g, '')
    .replace(/…/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const deduped = [];
  for (const w of soft.split(' ')) {
    if (!w) continue;
    if (deduped[deduped.length - 1] !== w) deduped.push(w);
  }
  if (deduped.length < 4) return false;
  for (let n = Math.min(10, deduped.length); n >= 4; n -= 1) {
    for (let start = 0; start <= deduped.length - n; start += 1) {
      const probe = deduped.slice(start, start + n).join(' ');
      if (
        probe.length >= 12 &&
        canon.includes(probe) &&
        citationHeadAllowed(deduped, start, canon) &&
        citationTailAllowed(deduped, start + n, canon)
      ) {
        return true;
      }
    }
  }
  return false;
}

function citationBodyMatchesCorpus(chunkId, body) {
  const row = getChunk(getCorpusRoot(), chunkId);
  if (!row?.text) return false;
  const canon = normalizeCitationCompare(row.text);
  const cite = normalizeCitationCompare(body);
  if (!cite.length) return false;
  if (canon.includes(cite)) return true;
  const ellipsisParts = String(body)
    .split(/…+/u)
    .map((p) => normalizeCitationCompare(p))
    .filter((p) => p.length > 0);
  if (ellipsisParts.length > 1) {
    return ellipsisParts.every((part) => citationFragmentAllowed(part, canon));
  }
  const ftsMarkers = /\[\[|…/.test(body);
  if (!ftsMarkers) return false;
  const citeTrim = cite.replace(/…+/gu, '').trim();
  if (citeTrim.length >= 12 && canon.includes(citeTrim)) return true;
  return citationSoftWindowMatch(cite, canon);
}

const CITATION_METADATA_FIELDS = ['doc_title', 'doc_version', 'source_id'];

function citationMetadataMatchesCorpus(chunkId, hit) {
  const row = getChunk(getCorpusRoot(), chunkId);
  if (!row) return false;
  for (const field of CITATION_METADATA_FIELDS) {
    const val = hit[field];
    if (val == null || val === '') continue;
    if (typeof val !== 'string') return false;
    if (!kbCitationBodyAllowed(val)) return false;
    const canon = normalizeCitationCompare(row[field] ?? '');
    const cite = normalizeCitationCompare(val);
    if (!canon || canon !== cite) return false;
  }
  return true;
}

function kbCitationBodyAllowed(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  if (isBenignKnowledgeDocVersion(text)) return true;
  if (OPERATIONAL_TOOL_INNER_PROSE_RE.test(text) || OPERATIONAL_PROSE_RE.test(text)) return false;
  if (cookieOrCanaryLeak(text)) return false;
  if (detectCommercialNumeric(text) || detectOrderUrl(text)) return false;
  return true;
}

const KB_GET_ALLOWED_KEYS = new Set([
  'chunk_id',
  'text',
  'snippet',
  'source_id',
  'doc_title',
  'doc_version',
]);

function kbGetChunkShape(obj) {
  if (
    !obj ||
    typeof obj !== 'object' ||
    typeof obj.chunk_id !== 'string' ||
    !obj.chunk_id.length
  ) {
    return false;
  }
  if (Object.keys(obj).some((key) => !KB_GET_ALLOWED_KEYS.has(key))) return false;
  let hasBody = false;
  for (const field of ['text', 'snippet']) {
    if (!Object.hasOwn(obj, field)) continue;
    const val = obj[field];
    if (typeof val !== 'string') return false;
    if (!val.trim()) continue;
    hasBody = true;
    if (!kbCitationBodyAllowed(val)) return false;
    if (!citationBodyMatchesCorpus(obj.chunk_id, val)) return false;
  }
  if (!hasBody) return false;
  return citationMetadataMatchesCorpus(obj.chunk_id, obj);
}

function kbHitsWrapperAllowed(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.hits)) {
    return false;
  }
  // A citation-shaped hit cannot authorize unrelated sibling output.
  if (Object.keys(obj).some((key) => key !== 'hits')) return false;
  if (obj.hits.length === 0) return true;
  return obj.hits.every((h) => kbSearchHitShape(h) && kbCitationBodyAllowed(h.snippet ?? h.text ?? ''));
}

function kbInnerLooksLikeRetrievalCitation(innerPayload) {
  if (innerPayload == null) return false;
  const t = String(innerPayload).trim();
  if (!t) return false;
  try {
    const parsed = JSON.parse(t);
    if (parsed === null) return true;
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return true;
      return (
        parsed.every(
          (row) =>
            kbGetChunkShape(row) ||
            (kbSearchHitShape(row) && kbCitationBodyAllowed(row.snippet ?? row.text ?? '')),
        )
      );
    }
    if (parsed && typeof parsed === 'object') {
      if (Object.hasOwn(parsed, 'hits')) return kbHitsWrapperAllowed(parsed);
      if (kbGetChunkShape(parsed)) return true;
      if (kbSearchHitShape(parsed) && kbCitationBodyAllowed(parsed.snippet ?? parsed.text ?? '')) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function rejectOperationalToolProseInPlainText(text) {
  if (!text) return null;
  if (OPERATIONAL_STATUS_JSON_RE.test(text)) {
    return { ok: false, reason: 'operational_status_json_in_generation_context' };
  }
  if (OPERATIONAL_TOOL_INNER_PROSE_RE.test(text)) {
    return { ok: false, reason: 'operational_prose_in_generation_context' };
  }
  return null;
}

function kbToolInnerPayloadAllowed(envelope, innerPayload) {
  if (KB_TOOL_USE_ID_LOOSE_RE.test(envelope) && !KB_TOOL_USE_ID_STRICT_RE.test(envelope)) {
    return false;
  }
  if (!kbEnvelopeNamesKbTool(envelope)) return false;
  const innerHay = poisonHaystack(innerPayload);
  if (cookieOrCanaryLeak(innerHay)) return false;
  if (cartOrAccountLeak(innerHay)) return false;
  if (OPERATIONAL_MCP_TOOL_RE.test(innerHay)) return false;
  if (OPERATIONAL_TOOL_INNER_PROSE_RE.test(innerPayload)) return false;
  if (knowledgePayloadCommercialOrOrderLeak(innerPayload)) return false;
  return kbInnerLooksLikeRetrievalCitation(innerPayload);
}

function roleIsTool(role) {
  return typeof role === 'string' && /^(?:tool|function)$/i.test(role);
}

function roleIsHistoryEnvelope(role) {
  const r = typeof role === 'string' ? role.toLowerCase() : '';
  return r === 'tool' || r === 'function' || r === 'assistant';
}

function validateKbHistoryEnvelope(obj) {
  if (!roleIsHistoryEnvelope(obj?.role)) return null;
  const toolName = typeof obj.name === 'string' ? obj.name : '';
  if (!toolName) return roleIsTool(obj.role)
    ? { ok: false, reason: 'non_kb_tool_role_in_generation_context' } : null;
  if (!/^kb_(?:search|get)$/i.test(toolName)) {
    return { ok: false, reason: 'non_kb_tool_role_in_generation_context' };
  }
  for (const key of ['output', 'result']) {
    if (Object.hasOwn(obj, key) && obj[key] != null) {
      return { ok: false, reason: 'kb_tool_role_extra_output_field_in_generation_context' };
    }
  }
  if (typeof obj.note === 'string' && obj.note.trim() && obj.note !== '{') {
    return { ok: false, reason: 'kb_tool_role_note_in_generation_context' };
  }
  const allowedEnvelopeKeys = new Set([
    'role',
    'name',
    'content',
    'tool_call_id',
    'tool_use_id',
    'note',
    'type',
    'id',
  ]);
  for (const key of Object.keys(obj)) {
    if (allowedEnvelopeKeys.has(key)) continue;
    if (obj[key] != null && obj[key] !== '') {
      return { ok: false, reason: 'kb_tool_role_extra_field_in_generation_context' };
    }
  }
  const inner = toolInnerFromObject(obj);
  if (inner && !kbToolInnerPayloadAllowed(JSON.stringify(obj), inner)) {
    return { ok: false, reason: 'kb_tool_role_poisoned_payload_in_generation_context' };
  }
  return null;
}

const MAX_NESTED_JSON_STRING_DEPTH = 8;

function jsonStringMayHoldToolRole(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  return TOOL_ROLE_MARK_RE.test(t);
}

function walkToolRolesInValue(value, depth = 0) {
  if (value == null) return null;
  if (depth > MAX_NESTED_JSON_STRING_DEPTH) {
    return { ok: false, reason: 'unparseable_tool_role_in_generation_context' };
  }
  if (typeof value === 'string') {
    if (!jsonStringMayHoldToolRole(value)) return null;
    let parsed;
    try {
      parsed = JSON.parse(value.trim());
    } catch {
      return rejectEmbeddedJsonToolRoles(value);
    }
    return walkToolRolesInValue(parsed, depth + 1);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = walkToolRolesInValue(item, depth);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === 'object') {
    const direct = validateKbHistoryEnvelope(value);
    if (direct) return direct;
    for (const v of Object.values(value)) {
      if (v != null && (typeof v === 'object' || Array.isArray(v) || typeof v === 'string')) {
        const hit = walkToolRolesInValue(v, depth);
        if (hit) return hit;
      }
    }
    return null;
  }
  return null;
}

function jsonStringStateAt(text, pos) {
  let inString = false;
  let escape = false;
  for (let i = 0; i < pos; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
  }
  return inString;
}

function balancedJsonObjectEnd(text, start) {
  if (text[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function rejectEmbeddedJsonToolRoles(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' || jsonStringStateAt(text, i)) continue;
    const end = balancedJsonObjectEnd(text, i);
    if (end < 0) continue;
    try {
      const hit = walkToolRolesInValue(JSON.parse(text.slice(i, end + 1)));
      if (hit) return hit;
    } catch {
      /* ignore non-JSON brace runs */
    }
    i = end;
  }
  return null;
}

function rejectTruncatedHistoryToolRoles(text) {
  const trimmed = String(text ?? '').trim();
  if (!TOOL_ROLE_MARK_RE.test(trimmed)) return null;
  if (!/"role"\s*:\s*"(?:tool|function)"/i.test(trimmed)) return null;
  if (!trimmed.startsWith('{')) return null;
  const end = balancedJsonObjectEnd(trimmed, 0);
  if (end < 0) {
    return { ok: false, reason: 'unparseable_tool_role_in_generation_context' };
  }
  return null;
}

function rejectNonKbToolRolesOnText(text) {
  if (!text) return null;
  if (!TOOL_ROLE_MARK_RE.test(text)) return null;
  const truncated = rejectTruncatedHistoryToolRoles(text);
  if (truncated) return truncated;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const hit = walkToolRolesInValue(JSON.parse(trimmed));
      if (hit) return hit;
    } catch {
      /* multi-document or fragment; line/segment scanners below */
    }
  }
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || !TOOL_ROLE_MARK_RE.test(t)) continue;
    const braceAt = t.indexOf('{');
    if (braceAt >= 0) {
      const truncated = rejectTruncatedHistoryToolRoles(t.slice(braceAt));
      if (truncated) return truncated;
    }
    if (!t.startsWith('{') && !t.startsWith('[')) continue;
    let parsed;
    try {
      parsed = JSON.parse(t);
    } catch {
      const embedded = rejectEmbeddedJsonToolRoles(t);
      if (embedded) return embedded;
      continue;
    }
    const walked = walkToolRolesInValue(parsed);
    if (walked) return walked;
  }
  const segments =
    text.match(
      /"role"\s*:\s*"(?:tool|function)"[\s\S]{0,1600}?(?="role"\s*:\s*"(?:tool|function|assistant|user|system)"|$)/gi,
    ) ?? [];
  for (const seg of segments) {
    if (!/"role"\s*:\s*"(?:tool|function)"/i.test(seg)) continue;
    const wrapped = seg.trim().startsWith('{') ? seg.trim() : `{${seg.trim()}}`;
    let obj;
    try {
      obj = JSON.parse(wrapped);
    } catch {
      const oneLine = !/\n/.test(seg.trim());
      if (oneLine && seg.trim().startsWith('{')) {
        return { ok: false, reason: 'unparseable_tool_role_in_generation_context' };
      }
      continue;
    }
    if (!roleIsHistoryEnvelope(obj?.role)) continue;
    const hit = validateKbHistoryEnvelope(obj);
    if (hit) return hit;
  }
  return rejectEmbeddedJsonToolRoles(text);
}

function rejectNonKbToolRoles(text) {
  const trimmed = text?.trim() ?? '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const walked = walkToolRolesInValue(JSON.parse(trimmed));
      if (walked) return walked;
    } catch {
      /* fragment; layered scan below */
    }
  }
  const layers = new Set([text, normalizeForCanaryHaystack(text)]);
  for (const v of expandGuardHaystack(text)) {
    layers.add(v);
    layers.add(normalizeForCanaryHaystack(v));
  }
  for (const layer of layers) {
    if (!TOOL_ROLE_MARK_RE.test(layer)) continue;
    const hit = rejectNonKbToolRolesOnText(layer);
    if (hit) return hit;
  }
  return null;
}

const TOOL_RESULT_ALLOWED_KEYS = new Set([
  'type',
  'tool_use_id',
  'tool_call_id',
  'name',
  'content',
  'is_error',
]);

function walkToolResultExtras(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = walkToolResultExtras(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    if (value.type === 'tool_result') {
      for (const key of Object.keys(value)) {
        if (!TOOL_RESULT_ALLOWED_KEYS.has(key)) {
          return { ok: false, reason: 'tool_result_extra_field_in_generation_context' };
        }
      }
    }
    for (const v of Object.values(value)) {
      const hit = walkToolResultExtras(v);
      if (hit) return hit;
    }
  }
  return null;
}

const FUNCTION_CALL_OUTPUT_MARK_RE =
  /"type"\s*:\s*"(?:function_call_output|custom_tool_call_output)"/i;

function rejectUnresolvedGenerationOutputs(message) {
  if (!message || typeof message !== 'object') return null;
  if (message.type === 'function_call_output' || message.type === 'custom_tool_call_output') {
    return { ok: false, reason: 'function_call_output_in_generation_context' };
  }
  const role = message.role;
  const namedKb = typeof message.name === 'string' && /^kb_(?:search|get)$/i.test(message.name);
  if (!roleIsHistoryEnvelope(role) && !namedKb) {
    if (message.output != null && message.output !== '') {
      return { ok: false, reason: 'unresolved_generation_output_in_context' };
    }
    if (message.result != null && message.result !== '') {
      return { ok: false, reason: 'unresolved_generation_output_in_context' };
    }
  }
  return null;
}

function rejectUnresolvedGenerationOutputsInText(text) {
  if (!text || !FUNCTION_CALL_OUTPUT_MARK_RE.test(text)) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const hit = rejectUnresolvedGenerationOutputs(item);
          if (hit) return hit;
        }
      } else {
        const hit = rejectUnresolvedGenerationOutputs(parsed);
        if (hit) return hit;
      }
    } catch {
      /* fragment scan below */
    }
  }
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{') || !FUNCTION_CALL_OUTPUT_MARK_RE.test(t)) continue;
    try {
      const hit = rejectUnresolvedGenerationOutputs(JSON.parse(t));
      if (hit) return hit;
    } catch {
      return { ok: false, reason: 'function_call_output_in_generation_context' };
    }
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' || jsonStringStateAt(text, i)) continue;
    const end = balancedJsonObjectEnd(text, i);
    if (end < 0) continue;
    try {
      const hit = rejectUnresolvedGenerationOutputs(JSON.parse(text.slice(i, end + 1)));
      if (hit) return hit;
    } catch {
      /* ignore */
    }
    i = end;
  }
  if (FUNCTION_CALL_OUTPUT_MARK_RE.test(text)) {
    return { ok: false, reason: 'function_call_output_in_generation_context' };
  }
  return null;
}

export function scanGenerationMessagesToolResultExtras(generationMessages = []) {
  for (const message of generationMessages) {
    const unresolved = rejectUnresolvedGenerationOutputs(message);
    if (unresolved) return unresolved;
    const hit = walkToolResultExtras(message);
    if (hit) return hit;
  }
  return null;
}

function rejectToolResultEnvelopeExtras(text) {
  if (!text || !TOOL_RESULT_MARK_RE.test(text)) return null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      const hit = walkToolResultExtras(parsed);
      if (hit) return hit;
    } catch {
      /* fall through to block scan */
    }
  }
  for (const block of text.match(/\{[^{}]{0,4000}\}/g) ?? []) {
    if (!/"type"\s*:\s*"tool_result"/i.test(block)) continue;
    let obj;
    try {
      obj = JSON.parse(block);
    } catch {
      continue;
    }
    if (obj?.type !== 'tool_result') continue;
    for (const key of Object.keys(obj)) {
      if (!TOOL_RESULT_ALLOWED_KEYS.has(key)) {
        return { ok: false, reason: 'tool_result_extra_field_in_generation_context' };
      }
    }
  }
  return null;
}

function rejectUnresolvedToolResults(text) {
  if (!text || !TOOL_RESULT_MARK_RE.test(text)) return null;
  const extra = rejectToolResultEnvelopeExtras(text);
  if (extra) return extra;
  const envelopeRe =
    /"type"\s*:\s*"tool_result"[\s\S]{0,3000}?"content"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
  let saw = false;
  for (const m of text.matchAll(envelopeRe)) {
    saw = true;
    const inner = m[1].replace(/\\"/g, '"');
    const idMatch = m[0].match(/"(?:tool_use_id|tool_call_id)"\s*:\s*"([^"]+)"/i);
    const envelope = idMatch ? `"tool_use_id":"${idMatch[1]}" ${m[0]}` : m[0];
    if (!kbToolInnerPayloadAllowed(envelope, inner)) {
      return { ok: false, reason: 'unresolved_tool_result_in_generation_context' };
    }
  }
  if (!saw) {
    for (const block of text.match(/\{[^{}]{0,3000}\}/g) ?? []) {
      if (!TOOL_RESULT_MARK_RE.test(block)) continue;
      saw = true;
      const contentM = block.match(/"content"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const inner = contentM?.[1]?.replace(/\\"/g, '"') ?? block;
      const idMatch = block.match(/"(?:tool_use_id|tool_call_id)"\s*:\s*"([^"]+)"/i);
      const envelope = idMatch ? `"tool_use_id":"${idMatch[1]}" ${block}` : block;
      if (!kbToolInnerPayloadAllowed(envelope, inner)) {
        return { ok: false, reason: 'unresolved_tool_result_in_generation_context' };
      }
    }
  }
  if (TOOL_RESULT_MARK_RE.test(text) && !saw) {
    return { ok: false, reason: 'unresolved_tool_result_in_generation_context' };
  }
  return null;
}
const UNTRUSTED_GEN_BLOCK_RE =
  /"type"\s*:\s*"(?:embedded_resource|image|resource)"/;
const ORDER_ACTION_URL_RE = new RegExp(`(?:action=)?${ORDER_CFM_ACTION_PATTERN}`, 'i');

/** JSON.stringify double-escapes nested JSON in string fields; scan both layers. */
function tryUnescapeJsonString(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

function embeddedJsonSubstrings(text) {
  const out = [];
  const re = /\{[^{}]{0,2048}\}/g;
  let m;
  while ((m = re.exec(text))) {
    const decoded = tryUnescapeJsonString(m[0]);
    if (decoded) out.push(decoded);
  }
  return out;
}

function poisonHaystack(text) {
  if (!text) return '';
  const layers = [text];
  if (/\\"/.test(text)) layers.push(text.replace(/\\"/g, '"'));
  if (/\\u[0-9a-fA-F]{4}/.test(text)) {
    layers.push(text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
  }
  const decoded = tryUnescapeJsonString(text);
  if (decoded) layers.push(decoded);
  for (const sub of embeddedJsonSubstrings(text)) layers.push(sub);
  const out = new Set();
  for (const layer of layers) {
    out.add(layer);
    const norm = normalizeForCanaryHaystack(layer);
    if (norm) out.add(norm);
    for (const v of expandGuardHaystack(layer)) {
      out.add(v);
      const vn = normalizeForCanaryHaystack(v);
      if (vn) out.add(vn);
    }
  }
  return [...out].join('\n');
}

function rejectCommercialInContext(text) {
  if (!text) return null;
  if (textCommercialOrOrderLeak(text)) {
    return { ok: false, reason: 'operational_commercial_in_generation_context' };
  }
  return null;
}

function rejectOperationalEnvelope(joined) {
  const prose = rejectOperationalToolProseInPlainText(joined);
  if (prose) return { ok: false, reason: 'operational_prose_in_knowledge_payload' };
  if (BARE_CART_EMPTY_JSON_RE.test(joined)) return { ok: false, reason: 'cart_empty_json_in_knowledge_payload' };
  if (CART_STATUS_JSON_RE.test(joined)) return { ok: false, reason: 'cart_status_json_in_knowledge_payload' };
  if (CART_MCP_JSON_RE.test(joined)) return { ok: false, reason: 'cart_mcp_json_in_knowledge_payload' };
  if (CART_MCP_TOOL_RE.test(joined)) return { ok: false, reason: 'cart_mcp_tool_in_knowledge_payload' };
  if (PRODUCT_MCP_JSON_RE.test(joined)) return { ok: false, reason: 'product_mcp_json_in_knowledge_payload' };
  if (FORM1000_MCP_JSON_RE.test(joined)) return { ok: false, reason: 'form1000_mcp_json_in_knowledge_payload' };
  if (FORM1000_MCP_TOOL_RE.test(joined)) return { ok: false, reason: 'form1000_mcp_tool_in_knowledge_payload' };
  if (URL_BUILD_TOOL_RE.test(joined)) return { ok: false, reason: 'url_build_mcp_tool_in_knowledge_payload' };
  if (ORDER_ACTION_URL_RE.test(joined)) return { ok: false, reason: 'order_action_url_in_knowledge_payload' };
  if (TOOL_ROLE_CART_RE.test(joined)) return { ok: false, reason: 'tool_role_cart_in_knowledge_payload' };
  if (TOOL_ROLE_OPERATIONAL_RE.test(joined)) return { ok: false, reason: 'tool_role_operational_in_knowledge_payload' };
  if (TOOL_ROLE_HTTP_ERROR_RE.test(joined)) return { ok: false, reason: 'tool_role_http_error_in_knowledge_payload' };
  if (OPERATIONAL_MCP_TOOL_RE.test(joined)) return { ok: false, reason: 'operational_mcp_tool_in_knowledge_payload' };
  if (OPERATIONAL_PROSE_RE.test(joined)) return { ok: false, reason: 'operational_prose_in_knowledge_payload' };
  const unresolvedTool = rejectUnresolvedToolResults(joined);
  if (unresolvedTool) return unresolvedTool;
  if (UNTRUSTED_GEN_BLOCK_RE.test(joined)) return { ok: false, reason: 'untrusted_generation_block' };
  return null;
}

function rejectOperationalContextEnvelope(ctx) {
  const prose = rejectOperationalToolProseInPlainText(ctx);
  if (prose) return prose;
  if (BARE_CART_EMPTY_JSON_RE.test(ctx)) return { ok: false, reason: 'cart_empty_json_in_generation_context' };
  if (CART_STATUS_JSON_RE.test(ctx)) return { ok: false, reason: 'cart_status_json_in_generation_context' };
  if (CART_MCP_JSON_RE.test(ctx)) return { ok: false, reason: 'cart_mcp_json_in_generation_context' };
  if (CART_MCP_TOOL_RE.test(ctx)) return { ok: false, reason: 'cart_mcp_tool_in_generation_context' };
  if (PRODUCT_MCP_JSON_RE.test(ctx)) return { ok: false, reason: 'product_mcp_json_in_generation_context' };
  if (FORM1000_MCP_JSON_RE.test(ctx)) return { ok: false, reason: 'form1000_mcp_json_in_generation_context' };
  if (FORM1000_MCP_TOOL_RE.test(ctx)) return { ok: false, reason: 'form1000_mcp_tool_in_generation_context' };
  if (URL_BUILD_TOOL_RE.test(ctx)) return { ok: false, reason: 'url_build_mcp_tool_in_generation_context' };
  if (ORDER_ACTION_URL_RE.test(ctx)) return { ok: false, reason: 'order_action_url_in_generation_context' };
  if (TOOL_ROLE_CART_RE.test(ctx)) return { ok: false, reason: 'tool_role_cart_in_generation_context' };
  if (TOOL_ROLE_OPERATIONAL_RE.test(ctx)) return { ok: false, reason: 'tool_role_operational_in_generation_context' };
  if (TOOL_ROLE_HTTP_ERROR_RE.test(ctx)) return { ok: false, reason: 'tool_role_http_error_in_generation_context' };
  if (OPERATIONAL_MCP_TOOL_RE.test(ctx)) return { ok: false, reason: 'operational_mcp_tool_in_generation_context' };
  if (OPERATIONAL_PROSE_RE.test(ctx)) return { ok: false, reason: 'operational_prose_in_generation_context' };
  if (UNTRUSTED_GEN_BLOCK_RE.test(ctx)) return { ok: false, reason: 'untrusted_generation_block' };
  return null;
}

function operationalContextEncodedBypassRisk(raw) {
  const text = String(raw ?? '');
  const obfuscated =
    /%[0-9a-fA-F]{2}/.test(text) ||
    /&(?:quot|#0*34|#x0*22|amp|lt|gt|apos|#0*39);/i.test(text);
  if (!obfuscated) return false;
  return (
    !TOOL_RESULT_MARK_RE.test(text) &&
    !FUNCTION_CALL_OUTPUT_MARK_RE.test(text)
  );
}

export function extractKnowledgePayload(toolArgs, generationMessages = []) {
  const parts = [];
  if (toolArgs) parts.push(JSON.stringify(toolArgs));
  for (const m of generationMessages) {
    const flat = flattenMessageContent(m?.content);
    if (flat) parts.push(flat);
  }
  return parts.join('\n');
}

/**
 * @param {object} opts
 * @param {boolean} [opts.isolationEnabled=true]
 * @param {boolean} [opts.deliberateBypass=false] test-only negative control
 */
/** Test/diagnostic: corpus binding for kb_get / kb_search history bodies. */
export function citationMatchesCorpus(chunkId, body) {
  return citationBodyMatchesCorpus(chunkId, body);
}

/** User-authored tool args only — excludes schema fields like limit that collide with proximity guards. */
export function userControlledKnowledgePayload(serializedPayload = '', rawArgs = {}) {
  const parts = [];
  if (rawArgs && typeof rawArgs === 'object') {
    if (typeof rawArgs.query === 'string') parts.push(rawArgs.query);
    if (typeof rawArgs.chunk_id === 'string') parts.push(rawArgs.chunk_id);
    if (parts.length) return parts.join('\n');
  }
  const raw = String(serializedPayload ?? '').trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const a = parsed?.arguments ?? {};
      if (typeof a.query === 'string') parts.push(a.query);
      if (typeof a.chunk_id === 'string') parts.push(a.chunk_id);
    } catch {
      /* fall through */
    }
  }
  return parts.join('\n');
}

export function scanPayloadForLeaks(serializedPayload, rawArgs = {}) {
  const parts = [serializedPayload];
  if (rawArgs && typeof rawArgs === 'object') {
    for (const v of Object.values(rawArgs)) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  const rawJoined = parts.join('\n');
  const payloadToolRoles = rejectNonKbToolRoles(rawJoined);
  if (payloadToolRoles) {
    return { ok: false, reason: 'non_kb_tool_role_in_knowledge_payload' };
  }
  const payloadFuncCallOutput = rejectUnresolvedGenerationOutputsInText(rawJoined);
  if (payloadFuncCallOutput) {
    const reason = payloadFuncCallOutput.reason.includes('knowledge')
      ? payloadFuncCallOutput.reason
      : payloadFuncCallOutput.reason.replace(/generation_context/g, 'knowledge_payload');
    return { ok: false, reason };
  }
  const plainProse = rejectOperationalToolProseInPlainText(rawJoined);
  if (plainProse) return { ok: false, reason: 'operational_prose_in_knowledge_payload' };
  const joined = poisonHaystack(rawJoined);
  if (SENTINEL_RE.test(joined)) return { ok: false, reason: 'unexpected_sentinel_in_knowledge_payload' };
  if (cookieOrCanaryLeak(joined)) return { ok: false, reason: 'operational_secret_in_knowledge_payload' };
  if (cartOrAccountLeak(joined)) {
    if (haystackMatchesPattern(joined, CART_HTML_RE)) {
      return { ok: false, reason: 'cart_html_in_knowledge_payload' };
    }
    return { ok: false, reason: 'account_payload_in_knowledge_payload' };
  }
  const op = rejectOperationalEnvelope(joined);
  if (op) return op;
  return null;
}

export function assertKnowledgeIsolation(opts) {
  const {
    operationalContext = '',
    knowledgePayload = '',
    knowledgeUserPayload,
    isolationEnabled = true,
    deliberateBypass = false,
  } = opts;

  const userPayload =
    knowledgeUserPayload ??
    userControlledKnowledgePayload(knowledgePayload, opts.knowledgeArguments);
  const ctxHay = poisonHaystack(operationalContext);
  const payloadHay = poisonHaystack(knowledgePayload);
  const payloadUserHay = poisonHaystack(userPayload);
  const ctxToolRoles = rejectNonKbToolRoles(operationalContext);
  if (ctxToolRoles) return ctxToolRoles;
  const ctxFuncCallOutput = rejectUnresolvedGenerationOutputsInText(operationalContext);
  if (ctxFuncCallOutput) return ctxFuncCallOutput;
  const ctxToolResultExtras = rejectToolResultEnvelopeExtras(operationalContext);
  if (ctxToolResultExtras) return ctxToolResultExtras;
  const ctxUnresolvedTools = rejectUnresolvedToolResults(operationalContext);
  if (ctxUnresolvedTools) return ctxUnresolvedTools;
  if (operationalContextEncodedBypassRisk(operationalContext)) {
    const ctxHayEarly = poisonHaystack(operationalContext);
    const ctxFuncCallDecoded = rejectUnresolvedGenerationOutputsInText(ctxHayEarly);
    if (ctxFuncCallDecoded) return ctxFuncCallDecoded;
    const ctxUnresolvedDecoded = rejectUnresolvedToolResults(ctxHayEarly);
    if (ctxUnresolvedDecoded) return ctxUnresolvedDecoded;
  }
  const ctxPlainProse = rejectOperationalToolProseInPlainText(operationalContext);
  if (ctxPlainProse) return ctxPlainProse;
  const payloadFuncCallOutput = rejectUnresolvedGenerationOutputsInText(knowledgePayload);
  if (payloadFuncCallOutput) {
    const reason = payloadFuncCallOutput.reason.includes('knowledge')
      ? payloadFuncCallOutput.reason
      : payloadFuncCallOutput.reason.replace(/generation_context/g, 'knowledge_payload');
    return { ok: false, reason };
  }
  const payloadToolRoles = rejectNonKbToolRoles(knowledgePayload);
  if (payloadToolRoles) {
    const reason = payloadToolRoles.reason.includes('knowledge')
      ? payloadToolRoles.reason
      : payloadToolRoles.reason.replace(/generation_context/g, 'knowledge_payload');
    return { ok: false, reason };
  }
  const payloadPlainProse = rejectOperationalToolProseInPlainText(knowledgePayload);
  if (payloadPlainProse) {
    return {
      ok: false,
      reason: payloadPlainProse.reason.replace(/generation_context/g, 'knowledge_payload'),
    };
  }

  if (deliberateBypass || !isolationEnabled) {
    if (SENTINEL_RE.test(ctxHay) && SENTINEL_RE.test(payloadHay)) {
      return { ok: false, reason: 'operational_sentinel_leaked_into_knowledge_payload' };
    }
    return { ok: false, reason: 'isolation_disabled_or_bypassed' };
  }

  if (SENTINEL_RE.test(ctxHay) && SENTINEL_RE.test(payloadHay)) {
    return { ok: false, reason: 'operational_sentinel_leaked_into_knowledge_payload' };
  }
  if (SENTINEL_RE.test(ctxHay)) {
    return { ok: false, reason: 'operational_sentinel_in_generation_context' };
  }
  if (cookieOrCanaryLeak(ctxHay)) {
    return { ok: false, reason: 'operational_secret_in_generation_context' };
  }
  if (cartOrAccountLeak(ctxHay)) {
    if (haystackMatchesPattern(ctxHay, CART_HTML_RE)) {
      return { ok: false, reason: 'cart_html_in_generation_context' };
    }
    return { ok: false, reason: 'account_payload_in_generation_context' };
  }
  if (OPERATIONAL_ACCOUNT_OBJECT_RE.test(ctxHay)) {
    return { ok: false, reason: 'operational_account_object_in_generation_context' };
  }
  let ctxOp = rejectOperationalContextEnvelope(ctxHay);
  if (ctxOp) return ctxOp;
  if (operationalContextEncodedBypassRisk(operationalContext)) {
    ctxOp = rejectUnresolvedGenerationOutputsInText(ctxHay);
    if (ctxOp) return ctxOp;
    ctxOp = rejectUnresolvedToolResults(ctxHay);
    if (ctxOp) return ctxOp;
  }
  const ctxCommercial = rejectCommercialInContext(ctxHay);
  if (ctxCommercial) return ctxCommercial;
  const ctxStruct = rejectUninspectableStructure(ctxHay);
  if (ctxStruct) return ctxStruct;
  if (SENTINEL_RE.test(payloadHay)) {
    return { ok: false, reason: 'unexpected_sentinel_in_knowledge_payload' };
  }
  if (cookieOrCanaryLeak(payloadHay)) {
    return { ok: false, reason: 'operational_secret_in_knowledge_payload' };
  }
  if (cartOrAccountLeak(payloadHay)) {
    if (haystackMatchesPattern(payloadHay, CART_HTML_RE)) {
      return { ok: false, reason: 'cart_html_in_knowledge_payload' };
    }
    return { ok: false, reason: 'account_payload_in_knowledge_payload' };
  }
  if (OPERATIONAL_ACCOUNT_OBJECT_RE.test(payloadHay)) {
    return { ok: false, reason: 'operational_account_object_in_knowledge_payload' };
  }
  const payloadOp = rejectOperationalEnvelope(payloadHay);
  if (payloadOp) return payloadOp;
  const payloadCommercial = rejectCommercialInContext(payloadUserHay);
  if (payloadCommercial) {
    return { ok: false, reason: 'operational_commercial_in_knowledge_payload' };
  }
  const payloadStruct = rejectUninspectableStructure(payloadHay);
  if (payloadStruct) return payloadStruct;
  return { ok: true };
}
