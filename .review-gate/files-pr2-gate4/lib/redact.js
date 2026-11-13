/** Redact session tokens in URLs and HTML-ish strings (no cookie values). */

const TOKEN_IN_TEXT = /\b(CFID|CFTOKEN|JSESSIONID)=[^;\s"']+/gi;
const SESSION_PARAM = /^(CFID|CFTOKEN|JSESSIONID)$/i;

export function redactSessionTokensInText(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(TOKEN_IN_TEXT, '$1=[REDACTED]');
}

export function redactSessionTokensInUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      const decoded = decodeURIComponent(key.replace(/\+/g, ' '));
      if (SESSION_PARAM.test(decoded) || SESSION_PARAM.test(key)) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    return redactSessionTokensInText(u.toString());
  } catch {
    return redactSessionTokensInText(url);
  }
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
