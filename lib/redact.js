/** Redact session tokens in URLs and HTML-ish strings (no cookie values). */

const TOKEN_IN_TEXT = /\b(CFID|CFTOKEN|JSESSIONID)=[^;\s"']+/gi;
const SESSION_PARAM = /^(CFID|CFTOKEN|JSESSIONID)$/i;
const PII_QUERY_PARAM =
  /^(email|eMail|phone|distID|shipPhone|shipEmail|shipFirstName|shipLastName|shipAddress\d*|billFirstName|billLastName|billAddress\d*|contactPhone|filingID|pcid|shpfirstName|shplastName|shpAddr\d*|shpCity|shpState|shpPCode|shpArea|shpDistrict|firstName|lastName|maddr\d*|mcity|mstate|mPCode|marea|mdistrict|billingFirstName|billingLastName|billingAddress\d*|billingCity|billingPostalCode|ccNum|cvv|taxID|addrHash|ecEmail|apprenticeID|mtaID)$/i;

function decodeRepeatedly(value, maxDepth = 5) {
  let cur = value;
  for (let i = 0; i < maxDepth; i++) {
    try {
      const next = decodeURIComponent(cur.replace(/\+/g, ' '));
      if (next === cur) break;
      cur = next;
    } catch {
      break;
    }
  }
  return cur;
}

export function redactSessionTokensInText(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text.replace(TOKEN_IN_TEXT, '$1=[REDACTED]');
  out = out.replace(/(CFID|CFTOKEN|JSESSIONID)\s*=\s*['"][^'"]*['"]/gi, '$1="[REDACTED]"');
  out = out.replace(
    /(%43FID|%43FTOKEN|%4aSESSIONID|CFID|CFTOKEN|JSESSIONID)(?:=|%3D)[^&"'\s;]*/gi,
    (_match, name) => `${name}=[REDACTED]`,
  );
  return out;
}

function safeDecodeURIComponent(part) {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    return part;
  }
}

function isSessionParamKey(key) {
  const decoded = safeDecodeURIComponent(key);
  if (SESSION_PARAM.test(decoded) || SESSION_PARAM.test(key)) return true;
  if (/c%46(id|token)/i.test(key) || /^cf(id|token)$/i.test(decoded)) return true;
  return false;
}

function scrubNestedCredentialFragment(val) {
  if (!val || typeof val !== 'string') return val;
  const decoded = decodeRepeatedly(val);
  let v = decoded;
  if (v.includes('?')) {
    const qIdx = v.indexOf('?');
    const head = v.slice(0, qIdx + 1);
    const qs = v.slice(qIdx + 1).split('#')[0];
    v = head + redactQueryParams(qs);
    const hash = decoded.includes('#') ? decoded.slice(decoded.indexOf('#')) : '';
    if (hash) v += hash;
  } else if (v.includes('&') || v.includes('=')) {
    v = redactAmpersandPairs(v);
  }
  v = redactSessionTokensInText(v);
  if (/%46|%43|CFID|CFTOKEN/i.test(val) && v === decoded) {
    v = redactAmpersandPairs(decodeRepeatedly(val));
    v = redactSessionTokensInText(v);
  }
  return v;
}

function redactAmpersandPairs(fragment) {
  if (!fragment.includes('&') && !fragment.includes('=')) {
    return redactSessionTokensInText(fragment);
  }
  return fragment
    .split('&')
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return redactSessionTokensInText(part);
      const key = part.slice(0, eq);
      const decodedKey = safeDecodeURIComponent(key);
      if (isSessionParamKey(key) || PII_QUERY_PARAM.test(decodedKey)) return `${key}=[REDACTED]`;
      const val = part.slice(eq + 1);
      return `${key}=${scrubNestedCredentialFragment(val)}`;
    })
    .join('&');
}

function redactQueryParams(queryString) {
  if (!queryString) return queryString;
  const u = new URL(`https://hk.unfranchise.com/?${queryString.replace(/^\?/, '')}`);
  for (const key of [...u.searchParams.keys()]) {
    const decoded = safeDecodeURIComponent(key);
    if (isSessionParamKey(key)) {
      u.searchParams.set(key, '[REDACTED]');
      continue;
    }
    if (PII_QUERY_PARAM.test(decoded)) {
      u.searchParams.set(key, '[REDACTED]');
    }
    const val = u.searchParams.get(key);
    if (val) {
      const scrubbed = scrubNestedCredentialFragment(val);
      if (scrubbed !== val) u.searchParams.set(key, scrubbed);
    }
  }
  return u.searchParams.toString();
}

export function redactSessionTokensInUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let working = redactAmpersandPairs(url.includes('?') ? url : url);
  working = working.replace(
    /(%43FID|%43FTOKEN|%4aSESSIONID|CFID|CFTOKEN|JSESSIONID)(?:=|%3D)[^&"'\s]*/gi,
    (_match, name) => `${name}=[REDACTED]`,
  );
  try {
    const u = new URL(working.includes('://') ? working : `https://hk.unfranchise.com/${working.replace(/^\//, '')}`);
    for (const key of [...u.searchParams.keys()]) {
      const decoded = safeDecodeURIComponent(key);
      if (isSessionParamKey(key)) {
        u.searchParams.set(key, '[REDACTED]');
      } else if (PII_QUERY_PARAM.test(decoded)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    working = u.toString();
    if (!url.includes('://')) {
      const path = u.pathname.replace(/^\//, '');
      working = u.search ? `${path}${u.search}` : path;
    }
  } catch {
    /* keep regex-scrubbed working */
  }
  return redactSessionTokensInText(working);
}

export function redactActionString(action) {
  if (!action || typeof action !== 'string') return action;
  if (action.includes('://')) {
    return redactSessionTokensInUrl(action);
  }
  let out = redactSessionTokensInText(action);
  if (out.includes('?')) {
    const head = out.slice(0, out.indexOf('?'));
    const qs = redactQueryParams(out.slice(out.indexOf('?') + 1));
    out = qs ? `${head}?${qs}` : head;
  } else if (out.includes('&')) {
    out = redactAmpersandPairs(out);
  }
  return redactSessionTokensInText(out);
}

const URL_KEYS = new Set(['url', 'href', 'postUrl', 'productUrl', 'action']);

export function redactToolPayload(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactSessionTokensInText(value);
  if (Array.isArray(value)) return value.map((v) => redactToolPayload(v));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'title' && typeof v === 'string') {
        out[k] = '[REDACTED]';
      } else if (URL_KEYS.has(k) && typeof v === 'string') {
        out[k] = redactSessionTokensInUrl(v);
      } else {
        out[k] = redactToolPayload(v);
      }
    }
    return out;
  }
  return value;
}
