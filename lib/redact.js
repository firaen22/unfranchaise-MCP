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

function freezeRegexTemplate(re) {
  return Object.freeze({ source: re.source, flags: re.flags });
}

const CAPTURE_HAS_EQ_TEMPLATE = freezeRegexTemplate(/[=%]/);
const CAPTURE_GRAMMAR_TEMPLATES = Object.freeze({
  re: freezeRegexTemplate(SENSITIVE_ASSIGNMENT.re),
  cookieTail: freezeRegexTemplate(SENSITIVE_ASSIGNMENT.cookieTail),
  queryTail: freezeRegexTemplate(SENSITIVE_ASSIGNMENT.queryTail),
});
const CAPTURE_UNTERMINATED_TEMPLATE = freezeRegexTemplate(UNTERMINATED_QUOTED_ASSIGNMENT);

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

function regexTests(re, value) {
  const saved = re.lastIndex;
  re.lastIndex = 0;
  const matched = reflectInvoke(INTRINSICS.regexpExec, re, [value]) !== null;
  re.lastIndex = saved;
  return matched;
}

function isHexDigit(ch) {
  return (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'F') || (ch >= 'a' && ch <= 'f');
}

function decodeLayerTolerant(value) {
  if (typeof value !== 'string') return value;
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '+') {
      out += ' ';
      continue;
    }
    if (ch === '%' && i + 2 < value.length && isHexDigit(value[i + 1]) && isHexDigit(value[i + 2])) {
      let j = i;
      let run = '';
      while (j < value.length && value[j] === '%' && j + 2 < value.length && isHexDigit(value[j + 1]) && isHexDigit(value[j + 2])) {
        run += reflectInvoke(INTRINSICS.stringCharAt, value, [j])
          + reflectInvoke(INTRINSICS.stringCharAt, value, [j + 1])
          + reflectInvoke(INTRINSICS.stringCharAt, value, [j + 2]);
        j += 3;
      }
      if (run) {
        try {
          out += INTRINSICS.decodeURIComponent(run);
        } catch {
          for (let k = 0; k < run.length; k += 3) {
            const hex = reflectInvoke(INTRINSICS.stringCharAt, run, [k + 1])
              + reflectInvoke(INTRINSICS.stringCharAt, run, [k + 2]);
            out += INTRINSICS.stringFromCharCode(INTRINSICS.numberParseInt(hex, 16));
          }
        }
        i = j - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function unescapeJsonQuotes(value) {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && value[i + 1] === '"') {
      out += '"';
      i++;
    } else {
      out += value[i];
    }
  }
  return out;
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
  if (!regexTests(/[=%]/, text)) return null; // no '=' and nothing that could decode to one
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

function scanAssignmentsCaptureList(text, templates = CAPTURE_GRAMMAR_TEMPLATES) {
  const out = captureList();
  const re = captureRegexFromTemplate(templates.re);
  const cookieTail = captureRegexFromTemplate(templates.cookieTail);
  const queryTail = captureRegexFromTemplate(templates.queryTail);
  let m;
  while ((m = reflectInvoke(INTRINSICS.regexpExec, re, [text]))) {
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
      if (regexTests(SESSION_PARAM, name)) {
        const tail = before === '?' || before === '&' ? queryTail : cookieTail;
        tail.lastIndex = valueStart + value.length;
        const tailMatch = reflectInvoke(INTRINSICS.regexpExec, tail, [text]);
        value += tailMatch?.[0] ?? '';
      }
      if (!value) { re.lastIndex = valueStart; continue; }
    }
    const end = valueStart + value.length + quote.length * 2;
    reflectInvoke(INTRINSICS.arrayPush, out, [{
      start: m.index, name, separator, quote, value, valueStart, end,
    }]);
    re.lastIndex = end;
  }
  return out;
}

function matchAllCapture(text, tpl = CAPTURE_UNTERMINATED_TEMPLATE) {
  const g = captureRegexFromTemplate(tpl);
  const hits = captureList();
  let m;
  while ((m = reflectInvoke(INTRINSICS.regexpExec, g, [text]))) {
    reflectInvoke(INTRINSICS.arrayPush, hits, [m]);
  }
  return hits;
}

function findSensitiveAssignmentCapture(text) {
  if (typeof text !== 'string') return null;
  const hasEq = captureRegexFromTemplate(CAPTURE_HAS_EQ_TEMPLATE);
  if (!regexTests(hasEq, text)) return null;
  let layer = text;
  for (let depth = 0; depth <= MAX_DECODE_DEPTH; depth++) {
    const hits = scanAssignmentsCaptureList(layer);
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (decodeRepeatedly(hit.value) !== PLACEHOLDER) return { name: hit.name, value: hit.value, layer: depth };
    }
    const unterminated = matchAllCapture(layer);
    for (let j = 0; j < unterminated.length; j++) {
      const hit = unterminated[j];
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

const JSON_OMIT = Symbol('jsonOmit');
// Capture walks must not consult live globals/prototypes a hostile toJSON can replace mid-walk.
const INTRINSICS = {
  arrayIsArray: Array.isArray,
  arrayBufferIsView: ArrayBuffer.isView,
  arrayPush: Array.prototype.push,
  arrayPop: Array.prototype.pop,
  arrayJoin: Array.prototype.join,
  objectKeys: Object.keys,
  objectEntries: Object.entries,
  objectToString: Object.prototype.toString,
  setHas: Set.prototype.has,
  setAdd: Set.prototype.add,
  setDelete: Set.prototype.delete,
  setSizeGet: Object.getOwnPropertyDescriptor(Set.prototype, 'size').get,
  booleanValueOf: Boolean.prototype.valueOf,
  numberValueOf: Number.prototype.valueOf,
  stringValueOf: String.prototype.valueOf,
  bigintValueOf: BigInt.prototype.valueOf,
  jsonParse: JSON.parse,
  jsonStringify: JSON.stringify,
  jsonIsRawJSON: typeof JSON.isRawJSON === 'function' ? JSON.isRawJSON : () => false,
  reflectApply: Reflect.apply,
  mathFloor: Math.floor,
  mathMin: Math.min,
  numberIsNaN: Number.isNaN,
  numberMaxSafeInteger: Number.MAX_SAFE_INTEGER,
  numberParseInt: Number.parseInt,
  globalString: String,
  globalNumber: Number,
  unaryPlus: (x) => +x,
  stringReplace: String.prototype.replace,
  stringFromCharCode: String.fromCharCode,
  decodeURIComponent: decodeURIComponent,
  regexpTest: RegExp.prototype.test,
  regexpExec: RegExp.prototype.exec,
  regexpSymbolReplace: RegExp.prototype[Symbol.replace],
  globalRegExp: RegExp,
  stringMatchAll: String.prototype.matchAll,
  stringSlice: String.prototype.slice,
  stringCharAt: String.prototype.charAt,
  objectSetPrototypeOf: Object.setPrototypeOf,
};

function reflectInvoke(fn, thisArg, args) {
  return INTRINSICS.reflectApply(fn, thisArg, args);
}

function captureList() {
  const list = [];
  reflectInvoke(INTRINSICS.objectSetPrototypeOf, null, [list, null]);
  return list;
}

function captureRegexFromTemplate(tpl) {
  return reflectInvoke(INTRINSICS.globalRegExp, null, [tpl.source, tpl.flags]);
}

const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const GEO_LOCATION = /Asia\/Hong_Kong|尖沙咀/i;
const PICKUP_LABEL =
  /pickUpLoc[\s\S]{0,400}"label"\s*:\s*"(?!\[REDACTED\])[^"]{1,}"/i;
const DELIVERY_ASSIGNMENT =
  /(specShipInstruction|shipInstruction|deliveryInstruction)\d*=(?!(\[REDACTED\]|"))[^"&\s]{3,}/i;
const DELIVERY_MENTION = /specShipInstruction|shipInstruction|deliveryInstruction/i;

function captureStackPush(stack, frame) {
  reflectInvoke(INTRINSICS.arrayPush, stack, [frame]);
}

function captureStackPop(stack) {
  return reflectInvoke(INTRINSICS.arrayPop, stack, []);
}

function captureStackLen(stack) {
  return stack.length;
}

function captureSetSize(set) {
  return reflectInvoke(INTRINSICS.setSizeGet, set, []);
}

function isRangeError(e) {
  return reflectInvoke(INTRINSICS.objectToString, e, []) === '[object RangeError]';
}

function eachCapturedString(strings, fn) {
  const n = strings.length;
  for (let i = 0; i < n; i++) fn(strings[i], i);
}

function capturedStringsSome(strings, pred) {
  const n = strings.length;
  for (let i = 0; i < n; i++) if (pred(strings[i], i)) return true;
  return false;
}

function gateStringsInclude(regex, values) {
  let hit = false;
  eachCapturedString(values, (value) => {
    if (hit || typeof value !== 'string') return;
    if (regexTests(regex, value)) hit = true;
    else {
      const decoded = decodeRepeatedly(value);
      if (decoded !== value && regexTests(regex, decoded)) hit = true;
    }
  });
  return hit;
}
// Anti-hang only: a toJSON that returns a fresh wrapper around itself would otherwise grow forever.
// Well above the 5000-level capture walk; ordinary nesting never gets near it.
const MAX_CAPTURE_JSON_DEPTH = 100000;

function isJsonObject(value) {
  return value !== null && typeof value === 'object';
}

// JSON.stringify uses array syntax only for ordinary arrays; ArrayBuffer views become {"0":…} objects.
function isJsonArraySyntax(value) {
  return INTRINSICS.arrayIsArray(value) && !INTRINSICS.arrayBufferIsView(value);
}

// Snapshot array length once (ToLength) so a mutating getter cannot hide elements.
function jsonArrayLength(arr) {
  const raw = arr.length;
  if (typeof raw === 'bigint') throw new TypeError('Cannot convert a BigInt value to a number');
  let n = +raw;
  if (INTRINSICS.numberIsNaN(n)) n = 0;
  else if (n === INTRINSICS.globalNumber.POSITIVE_INFINITY) n = INTRINSICS.numberMaxSafeInteger;
  else if (n < 0) n = 0;
  else n = INTRINSICS.mathFloor(n);
  return INTRINSICS.mathMin(n, INTRINSICS.numberMaxSafeInteger);
}

// Unbox only values with [[StringData]] / [[NumberData]] / [[BooleanData]] / [[BigIntData]] by
// calling the intrinsic .prototype.valueOf; conversion errors propagate like JSON.stringify.
function unboxJsonPrimitive(v) {
  if (!isJsonObject(v)) return v;
  try {
    const bi = reflectInvoke(INTRINSICS.bigintValueOf, v, []);
    if (typeof bi === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
  } catch (e) {
    if (e?.message === 'Do not know how to serialize a BigInt') throw e;
  }
  try {
    const b = reflectInvoke(INTRINSICS.booleanValueOf, v, []);
    if (typeof b === 'boolean') return b;
  } catch {}
  let isNumber = false;
  try {
    reflectInvoke(INTRINSICS.numberValueOf, v, []);
    isNumber = true;
  } catch {}
  if (isNumber) return INTRINSICS.unaryPlus(v);
  let isString = false;
  try {
    reflectInvoke(INTRINSICS.stringValueOf, v, []);
    isString = true;
  } catch {}
  if (isString) return INTRINSICS.globalString(v);
  return v;
}

// Same preparation JSON.stringify applies before emitting a value: one toJSON(key), then unbox.
// Values produced by toJSON must not run toJSON again before unboxing.
function prepareJsonValue(value, key, afterToJson = false) {
  let v = value;
  if (
    !afterToJson
    && (typeof v === 'bigint' || typeof v === 'function' || isJsonObject(v))
  ) {
    const toJSON = v.toJSON;
    if (typeof toJSON === 'function') {
      v = INTRINSICS.reflectApply(toJSON, v, [key]);
      return prepareJsonValue(v, key, true);
    }
  }
  if (typeof v === 'bigint') return v;
  if (isJsonObject(v)) v = unboxJsonPrimitive(v);
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return JSON_OMIT;
  return v;
}

// Explicit-stack stand-in for JSON.stringify. The native call recurses and overflows on a
// few thousand nested objects; captures are still checked against the persisted shape.
function persistedCapture(root) {
  const preparedRoot = prepareJsonValue(root, '');
  if (preparedRoot === JSON_OMIT) return { serialized: undefined, strings: captureList() };
  const chunks = captureList();
  const strings = captureList();
  const ancestors = new Set();
  const stack = captureList();
  reflectInvoke(INTRINSICS.arrayPush, stack, [{ kind: 'value', value: preparedRoot }]);
  while (captureStackLen(stack)) {
    const frame = captureStackPop(stack);
    if (frame.kind === 'value') {
      const v = frame.value;
      if (v === null || typeof v === 'boolean' || typeof v === 'number') {
        reflectInvoke(INTRINSICS.arrayPush, chunks, [INTRINSICS.jsonStringify(v)]);
        continue;
      }
      if (typeof v === 'string') {
        reflectInvoke(INTRINSICS.arrayPush, strings, [v]);
        reflectInvoke(INTRINSICS.arrayPush, chunks, [INTRINSICS.jsonStringify(v)]);
        continue;
      }
      if (INTRINSICS.jsonIsRawJSON(v)) {
        const rawText = v.rawJSON;
        reflectInvoke(INTRINSICS.arrayPush, chunks, [rawText]);
        reflectInvoke(INTRINSICS.arrayPush, strings, [rawText]);
        reflectInvoke(INTRINSICS.arrayPush, strings, [decodeRepeatedly(rawText)]);
        try {
          const decoded = INTRINSICS.jsonParse(rawText);
          if (typeof decoded === 'string') reflectInvoke(INTRINSICS.arrayPush, strings, [decoded]);
          else if (decoded !== null && typeof decoded === 'object') {
            const pending = captureList();
            reflectInvoke(INTRINSICS.arrayPush, pending, [decoded]);
            while (pending.length) {
              const item = reflectInvoke(INTRINSICS.arrayPop, pending, []);
              if (typeof item === 'string') reflectInvoke(INTRINSICS.arrayPush, strings, [item]);
              else if (INTRINSICS.arrayIsArray(item)) {
                const n = item.length;
                for (let i = 0; i < n; i++) reflectInvoke(INTRINSICS.arrayPush, pending, [item[i]]);
              } else if (item && typeof item === 'object') {
                const entries = INTRINSICS.objectEntries(item);
                const elen = entries.length;
                for (let j = 0; j < elen; j++) {
                  const pair = entries[j];
                  reflectInvoke(INTRINSICS.arrayPush, strings, [pair[0]]);
                  reflectInvoke(INTRINSICS.arrayPush, pending, [pair[1]]);
                }
              }
            }
          }
        } catch (e) {
          if (isRangeError(e)) throw e;
        }
        continue;
      }
      if (typeof v === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
      if (typeof v !== 'object') throw new TypeError('Value is not JSON serializable');
      if (reflectInvoke(INTRINSICS.setHas, ancestors, [v]) || captureSetSize(ancestors) >= MAX_CAPTURE_JSON_DEPTH) {
        throw new TypeError('Converting circular structure to JSON');
      }
      reflectInvoke(INTRINSICS.setAdd, ancestors, [v]);
      if (isJsonArraySyntax(v)) {
        reflectInvoke(INTRINSICS.arrayPush, chunks, ['[']);
        captureStackPush(stack, { kind: 'array', arr: v, index: 0, len: jsonArrayLength(v) });
      } else {
        reflectInvoke(INTRINSICS.arrayPush, chunks, ['{']);
        captureStackPush(stack, { kind: 'object', obj: v, keys: INTRINSICS.objectKeys(v), index: 0, emitted: false });
      }
      continue;
    }
    if (frame.kind === 'array') {
      if (frame.index >= frame.len) {
        reflectInvoke(INTRINSICS.arrayPush, chunks, [']']);
        reflectInvoke(INTRINSICS.setDelete, ancestors, [frame.arr]);
        continue;
      }
      if (frame.index > 0) reflectInvoke(INTRINSICS.arrayPush, chunks, [',']);
      const index = frame.index++;
      const prepared = prepareJsonValue(frame.arr[index], INTRINSICS.globalString(index));
      captureStackPush(stack, frame);
      captureStackPush(stack, { kind: 'value', value: prepared === JSON_OMIT ? null : prepared });
      continue;
    }
    let resumed = false;
    while (frame.index < frame.keys.length) {
      const key = frame.keys[frame.index++];
      const prepared = prepareJsonValue(frame.obj[key], key);
      if (prepared === JSON_OMIT) continue;
      if (frame.emitted) reflectInvoke(INTRINSICS.arrayPush, chunks, [',']);
      frame.emitted = true;
      reflectInvoke(INTRINSICS.arrayPush, strings, [key]);
      reflectInvoke(INTRINSICS.arrayPush, chunks, [INTRINSICS.jsonStringify(key) + ':']);
      captureStackPush(stack, frame);
      captureStackPush(stack, { kind: 'value', value: prepared });
      resumed = true;
      break;
    }
    if (!resumed) {
      reflectInvoke(INTRINSICS.arrayPush, chunks, ['}']);
      reflectInvoke(INTRINSICS.setDelete, ancestors, [frame.obj]);
    }
  }
  return { serialized: reflectInvoke(INTRINSICS.arrayJoin, chunks, ['']), strings };
}

/** @internal parity oracle for tests only */
export function captureSerializedForTest(obj) {
  return persistedCapture(obj).serialized;
}

export function assertCaptureJsonSafe(obj) {
  const persisted = persistedCapture(obj);
  const serialized = persisted.serialized;
  const strings = captureList();
  reflectInvoke(INTRINSICS.arrayPush, strings, [serialized]);
  eachCapturedString(persisted.strings, (s) => reflectInvoke(INTRINSICS.arrayPush, strings, [s]));
  // Iterative walk (deeply nested captures must not overflow the stack); object keys are inspected too.
  // Walk exactly what gets persisted (toJSON, boxed primitives and getters resolved by JSON.stringify).
  if (capturedStringsSome(strings, (value) => typeof value === 'string' && (regexTests(EMAIL_LIKE, value) || regexTests(EMAIL_LIKE, decodeRepeatedly(value))))) {
    throw new Error('capture payload still contains email-like text');
  }
  if (gateStringsInclude(GEO_LOCATION, strings)) throw new Error('capture payload still contains geographic location metadata');
  if (gateStringsInclude(PICKUP_LABEL, strings)) throw new Error('capture payload still contains pickup location labels');
  if (
    capturedStringsSome(strings, (value) => typeof value === 'string' && regexTests(DELIVERY_MENTION, value))
    && gateStringsInclude(DELIVERY_ASSIGNMENT, strings)
  ) {
    throw new Error('capture payload still contains delivery-instruction text');
  }
  // Assignments are checked per key/value string, not on the serialized JSON (whose closing '"' would read as a quote).
  for (let i = 1; i < strings.length; i++) {
    const value = strings[i];
    const hit = findSensitiveAssignmentCapture(unescapeJsonQuotes(value));
    if (hit) throw new Error('capture payload still contains ' + (regexTests(SESSION_PARAM, hit.name) ? 'session token pattern' : 'PII parameter'));
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
