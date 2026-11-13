/** Redact session tokens in URLs and HTML-ish strings (no cookie values). */
const SESSION_PARAM = /^(CFID|CFTOKEN|JSESSIONID|cf_clearance|__cf_bm)$/i;
const PII_QUERY_PARAM = /^(email|eMail|phone|distID|shipPhone|shpPhone|shipEmail|shipFirstName|shipLastName|shipAddress\d*|billFirstName|billLastName|billAddress\d*|contactPhone|filingID|pcid|shpfirstName|shplastName|shpAddr\d*|shpCity|shpState|shpPCode|shpArea|shpDistrict|firstName|lastName|maddr\d*|mcity|mstate|mPCode|marea|mdistrict|billingFirstName|billingLastName|billingAddress\d*|billingCity|billingPostalCode|ccNum|cvv|taxID|addrHash|ecEmail|apprenticeID|mtaID|pickUpLoc|specShipInstruction\d*|shipInstruction\d*|deliveryInstruction\d*|billShipInstruction\d*|shpCountry|mCountry)$/i;
const SENSITIVE_NAME = '(?:CFID|CFTOKEN|JSESSIONID|cf_clearance|__cf_bm|email|eMail|phone|distID|shipPhone|shpPhone|shipEmail|shipFirstName|shipLastName|shipAddress\\d*|billFirstName|billLastName|billAddress\\d*|contactPhone|filingID|pcid|shpfirstName|shplastName|shpAddr\\d*|shpCity|shpState|shpPCode|shpArea|shpDistrict|firstName|lastName|maddr\\d*|mcity|mstate|mPCode|marea|mdistrict|billingFirstName|billingLastName|billingAddress\\d*|billingCity|billingPostalCode|ccNum|cvv|taxID|addrHash|ecEmail|apprenticeID|mtaID|pickUpLoc|specShipInstruction\\d*|shipInstruction\\d*|deliveryInstruction\\d*|billShipInstruction\\d*|shpCountry|mCountry)';
// Separator run between name, '=' and value: whitespace, '+', and invisible/control characters (NUL, ZWSP, BOM, bidi marks).
const SEP = "[\\s+\\u0000-\\u001F\\u007F\\u00AD\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]*";
const INVISIBLE = new RegExp(SEP.slice(0, -1), 'g');
// Each separator run is matched once ((?=(x*))\N emulates an atomic group), so a long run of spaces after '='
// cannot backtrack quadratically. The widest bare value is matched; scanAssignments then trims it by context:
// session cookie values may contain '#' and, outside a query string, '&' (cookie headers, as main treated them);
// after '?' or '&' a session param value stops at '&' so later query params survive; PII values stop at '&' and '#'.
// After '=' a '+' is part of the value (e.g. `cf_clearance=+++`, `phone=+852…`), not a separator.
const SEP_AFTER = SEP.replace('[\\s+', '[\\s');
// Bare values stop at '&' and '#' (and may be empty) so every match is local; scanAssignments extends session
// values with a sticky tail: past '#' in a query string, past '&' and '#' elsewhere (cookies). Linear in input length.
const assignmentRe = (bare) => new RegExp("(?<![A-Za-z0-9_])(" + SENSITIVE_NAME + ")(?=(" + SEP + "))\\2=(?=(" + SEP_AFTER + "))\\3(?:\"([^\"]*)\"|'([^']*)'|(" + bare + "))", 'gi');
const SENSITIVE_ASSIGNMENT = { re: assignmentRe("[^&#;\\s\"']*"), cookieTail: /[^;\s"']*/y, queryTail: /[^&;\s"']*/y };
// Inside one raw token every decoded space came from an encoding, so the value runs to the next delimiter.
const SENSITIVE_ASSIGNMENT_IN_TOKEN = { re: assignmentRe("[^&#;\"']*"), cookieTail: /[^;"']*/y, queryTail: /[^&;"']*/y };
const UNTERMINATED_QUOTED_ASSIGNMENT = new RegExp("(?<![A-Za-z0-9_])(" + SENSITIVE_NAME + ")(?=(" + SEP + "))\\2=(?=(" + SEP_AFTER + "))\\3([\"'])((?:(?!\\4)[\\s\\S])*)$", 'gi');

function* scanAssignments(text, grammar = SENSITIVE_ASSIGNMENT) {
  const re = new RegExp(grammar.re.source, grammar.re.flags);
  const cookieTail = new RegExp(grammar.cookieTail.source, grammar.cookieTail.flags);
  const queryTail = new RegExp(grammar.queryTail.source, grammar.queryTail.flags);
  let m;
  while ((m = re.exec(text))) {
    const name = m[1];
    const separator = m[2] + '=' + m[3];
    const valueStart = m.index + name.length + separator.length;
    let quote = '';
    let value;
    if (m[4] !== undefined) { quote = '"'; value = m[4]; }
    else if (m[5] !== undefined) { quote = "'"; value = m[5]; }
    else {
      value = m[6];
      const before = text[m.index - 1];
      if (SESSION_PARAM.test(name)) {
        const tail = before === '?' || before === '&' ? queryTail : cookieTail;
        tail.lastIndex = valueStart + value.length;
        value += tail.exec(text)?.[0] ?? '';
      }
      if (!value) { re.lastIndex = valueStart; continue; }
    }
    const end = valueStart + value.length + quote.length * 2;
    yield { start: m.index, name, separator, quote, value, valueStart, end };
    re.lastIndex = end;
  }
}
const MAX_DECODE_DEPTH = 64;
const PLACEHOLDER = '[REDACTED]';

function decodeLayerTolerant(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try { return decodeURIComponent(run); }
    catch { return run.replace(/%([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(Number.parseInt(hex, 16))); }
  }).replace(/\+/g, ' ');
}

function decodeRepeatedly(value, maxDepth = MAX_DECODE_DEPTH) {
  let current = value;
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = decodeLayerTolerant(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function findSensitiveAssignment(text) {
  if (typeof text !== 'string') return null;
  if (!/[=%]/.test(text)) return null; // no '=' and nothing that could decode to one
  let layer = text;
  for (let depth = 0; depth <= MAX_DECODE_DEPTH; depth++) {
    for (const hit of scanAssignments(layer)) {
      if (decodeRepeatedly(hit.value) !== PLACEHOLDER) return { name: hit.name, value: hit.value, layer: depth };
    }
    for (const hit of layer.matchAll(UNTERMINATED_QUOTED_ASSIGNMENT)) {
      if (hit[5] && decodeRepeatedly(hit[5]) !== PLACEHOLDER) return { name: hit[1], value: hit[5], layer: depth };
    }
    const next = decodeLayerTolerant(layer);
    if (next === layer) break;
    layer = next;
  }
  return null;
}

function assertNoSensitiveAssignment(result) {
  return findSensitiveAssignment(result) ? redactSessionTokensInText(result) : result;
}

function redactLayer(text, grammar = SENSITIVE_ASSIGNMENT) {
  let out = '';
  let last = 0;
  for (const hit of scanAssignments(text, grammar)) {
    out += text.slice(last, hit.valueStart) + hit.quote + PLACEHOLDER + hit.quote;
    last = hit.end;
  }
  out += text.slice(last);
  return out.replace(UNTERMINATED_QUOTED_ASSIGNMENT, (_m, name, sepBefore, sepAfter, quote) => name + sepBefore + '=' + sepAfter + quote + PLACEHOLDER + quote);
}

export function redactSessionTokensInText(text) {
  if (!text || typeof text !== 'string') return text;
  if (!findSensitiveAssignment(text)) return text;
  let current = redactLayer(text);
  if (!findSensitiveAssignment(current)) return current;
  // An assignment hidden by encoding: rewrite only the raw token that hides it, decoded, with its whole value redacted.
  current = current.replace(/\S+/g, (token) => {
    if (!findSensitiveAssignment(token)) return token;
    const rewritten = redactLayer(decodeRepeatedly(token), SENSITIVE_ASSIGNMENT_IN_TOKEN);
    return findSensitiveAssignment(rewritten) ? PLACEHOLDER : rewritten;
  });
  if (!findSensitiveAssignment(current)) return current;
  for (let depth = 0; depth <= MAX_DECODE_DEPTH; depth++) {
    current = redactLayer(current);
    if (!findSensitiveAssignment(current)) return current;
    const next = decodeLayerTolerant(current);
    if (next === current) break;
    current = next;
  }
  return PLACEHOLDER;
}

const normalizeKey = (key) => decodeRepeatedly(key).replace(INVISIBLE, '');
function isSessionParamKey(key) { return SESSION_PARAM.test(normalizeKey(key)); }

// Nested URLs/queries inside values recurse; past this depth the value gets the flat (non-recursive) text
// redactor, which keeps names visible so the final backstop still sees e.g. a session value running past '#'.
const MAX_NESTED_DEPTH = 32;
let nestedDepth = 0;
function scrubNestedCredentialFragment(value) {
  if (nestedDepth >= MAX_NESTED_DEPTH) return redactSessionTokensInText(value);
  nestedDepth++;
  try { return scrubNestedValue(value); } finally { nestedDepth--; }
}

function scrubNestedValue(value) {
  if (!value || typeof value !== 'string') return value;
  const decoded = decodeRepeatedly(value);
  let scrubbed;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(decoded)) scrubbed = redactSessionTokensInUrl(decoded);
  else if (decoded.includes('?')) {
    const question = decoded.indexOf('?');
    scrubbed = decoded.slice(0, question + 1) + redactQueryParams(decoded.slice(question + 1));
  } else scrubbed = decoded.includes('&') || decoded.includes('=') ? redactAmpersandPairs(decoded) : redactSessionTokensInText(decoded);
  return scrubbed === decoded ? value : scrubbed;
}

function redactAmpersandPairs(fragment, encodeRedacted = false) {
  return fragment.split('&').map((part) => {
    const equals = part.indexOf('=');
    if (equals < 0) return redactSessionTokensInText(part);
    const key = part.slice(0, equals);
    if (isSessionParamKey(key) || PII_QUERY_PARAM.test(normalizeKey(key))) return key + (encodeRedacted ? '=%5BREDACTED%5D' : '=[REDACTED]');
    const value = part.slice(equals + 1);
    const scrubbed = scrubNestedCredentialFragment(value);
    return scrubbed === value ? part : key + '=' + scrubbed;
  }).join('&');
}

function redactQueryParams(queryString, encodeRedacted = false) {
  return queryString ? redactAmpersandPairs(queryString.replace(/^\?/, ''), encodeRedacted) : queryString;
}

export function redactSessionTokensInUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const isFullUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(url);
  if (!isFullUrl) {
    const embedded = url.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => redactSessionTokensInUrl(match));
    if (embedded !== url) return assertNoSensitiveAssignment(redactSessionTokensInText(embedded));
    if (/\s/.test(url)) return assertNoSensitiveAssignment(redactSessionTokensInText(url));
  }
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : url.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  let output = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex + 1) + redactQueryParams(beforeHash.slice(queryIndex + 1));
  if (hashIndex >= 0) {
    const fragmentQuestion = hash.indexOf('?');
    const prefix = fragmentQuestion < 0 ? '' : hash.slice(0, fragmentQuestion + 1);
    const fragmentQuery = fragmentQuestion < 0 ? hash : hash.slice(fragmentQuestion + 1);
    output += '#' + (fragmentQuestion >= 0 || fragmentQuery.includes('=') ? prefix + redactQueryParams(fragmentQuery, true) : hash);
  }
  return findSensitiveAssignment(output) ? assertNoSensitiveAssignment(redactSessionTokensInText(output)) : assertNoSensitiveAssignment(output);
}

export function assertCaptureJsonSafe(obj) {
  const serialized = JSON.stringify(obj);
  const strings = [serialized];
  // Iterative walk (deeply nested captures must not overflow the stack); object keys are inspected too.
  // Walk exactly what gets persisted (toJSON, boxed primitives and getters resolved by JSON.stringify).
  const pending = serialized === undefined ? [] : [JSON.parse(serialized)];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) { for (const item of value) pending.push(item); }
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) { strings.push(key); pending.push(item); }
    }
  }
  if (strings.some((value) => /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(decodeRepeatedly(value)))) throw new Error('capture payload still contains email-like text');
  if (/Asia\/Hong_Kong|尖沙咀/i.test(serialized)) throw new Error('capture payload still contains geographic location metadata');
  if (/pickUpLoc[\s\S]{0,400}"label"\s*:\s*"(?!\[REDACTED\])[^"]{1,}"/i.test(serialized)) throw new Error('capture payload still contains pickup location labels');
  if (/specShipInstruction|shipInstruction|deliveryInstruction/i.test(serialized) && /(specShipInstruction|shipInstruction|deliveryInstruction)\d*=(?!(\[REDACTED\]|"))[^"&\s]{3,}/i.test(serialized)) throw new Error('capture payload still contains delivery-instruction text');
  // Assignments are checked per key/value string, not on the serialized JSON (whose closing '"' would read as a quote).
  for (const value of strings.slice(1)) {
    const hit = findSensitiveAssignment(value.replace(/\\"/g, '"'));
    if (hit) throw new Error('capture payload still contains ' + (SESSION_PARAM.test(hit.name) ? 'session token pattern' : 'PII parameter'));
  }
}

export function redactActionString(action) {
  if (!action || typeof action !== 'string') return action;
  if (action.includes('://') || action.includes('#')) return redactSessionTokensInUrl(action);
  if (action.includes('?')) {
    const question = action.indexOf('?');
    return assertNoSensitiveAssignment(action.slice(0, question + 1) + redactQueryParams(action.slice(question + 1)));
  }
  return assertNoSensitiveAssignment(action.includes('&') ? redactAmpersandPairs(action) : redactSessionTokensInText(action));
}

const URL_KEYS = new Set(['url', 'href', 'postUrl', 'productUrl']);
export function redactToolPayload(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactSessionTokensInText(value);
  if (Array.isArray(value)) return value.map((item) => redactToolPayload(item));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'action' && typeof item === 'string') output[key] = redactActionString(item);
      else if (URL_KEYS.has(key) && typeof item === 'string') output[key] = redactSessionTokensInUrl(item);
      else output[key] = redactToolPayload(item);
    }
    return output;
  }
  return value;
}
