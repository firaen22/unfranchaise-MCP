/** Redact session tokens in URLs and HTML-ish strings (no cookie values). */

const TOKEN_IN_URL = /([?&;])(CFID|CFTOKEN|JSESSIONID)=([^&;"'\s]+)/gi;
const TOKEN_IN_TEXT = /\b(CFID|CFTOKEN|JSESSIONID)=[^;\s"']+/gi;

export function redactSessionTokensInUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(TOKEN_IN_URL, '$1$2=[REDACTED]');
}

export function redactSessionTokensInText(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(TOKEN_IN_TEXT, '$1=[REDACTED]');
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
        out[k] = redactSessionTokensInUrl(redactSessionTokensInText(v));
      } else {
        out[k] = redactToolPayload(v);
      }
    }
    return out;
  }
  return value;
}
