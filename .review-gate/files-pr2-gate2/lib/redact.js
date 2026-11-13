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
