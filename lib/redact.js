/** Redact session tokens in URLs and HTML-ish strings (no cookie values). */

const TOKEN_IN_TEXT = /\b(CFID|CFTOKEN|JSESSIONID)=[^;\s"']+/gi;
const SESSION_PARAM = /^(CFID|CFTOKEN|JSESSIONID)$/i;

export function redactSessionTokensInText(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(TOKEN_IN_TEXT, '$1=[REDACTED]');
}

function safeDecodeURIComponent(part) {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    return part;
  }
}

export function redactSessionTokensInUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let working = url;
  working = working.replace(
    /(%43FID|%43FTOKEN|%4aSESSIONID|CFID|CFTOKEN|JSESSIONID)(?:=|%3D)[^&"'\s]*/gi,
    (match, name) => `${name}=[REDACTED]`,
  );
  try {
    const u = new URL(working);
    for (const key of [...u.searchParams.keys()]) {
      const decoded = safeDecodeURIComponent(key);
      if (SESSION_PARAM.test(decoded) || SESSION_PARAM.test(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    working = u.toString();
  } catch {
    /* keep regex-scrubbed working */
  }
  return redactSessionTokensInText(working);
}

const URL_KEYS = new Set(['url', 'href', 'postUrl', 'productUrl', 'action']);

export function redactToolPayload(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactSessionTokensInText(value);
  if (Array.isArray(value)) return value.map((v) => redactToolPayload(v));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (URL_KEYS.has(k) && typeof v === 'string') {
        out[k] = redactSessionTokensInUrl(v);
      } else {
        out[k] = redactToolPayload(v);
      }
    }
    return out;
  }
  return value;
}
