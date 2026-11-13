import { redactSessionTokensInText, redactSessionTokensInUrl } from './redact.js';

const HK_HOST = 'hk.unfranchise.com';

export function assertValidCookie(cookie) {
  const c = String(cookie ?? '');
  if (!c.trim()) throw Object.assign(new Error('Session cookie is empty.'), { code: 'UNF_BAD_COOKIE' });
  if (/[\r\n\0]/.test(c)) {
    throw Object.assign(new Error('Session cookie contains invalid characters (CR/LF).'), { code: 'UNF_BAD_COOKIE' });
  }
  if (c.length > 16_384) {
    throw Object.assign(new Error('Session cookie exceeds maximum length.'), { code: 'UNF_BAD_COOKIE' });
  }
  return c;
}

export function parsePositiveIntQty(qty, { defaultQty = 1, max = 999 } = {}) {
  if (qty === undefined || qty === null) return defaultQty;
  if (typeof qty !== 'number' || !Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1 || qty > max) {
    throw new Error(`qty must be a positive integer between 1 and ${max}`);
  }
  return qty;
}

export function requireNonEmptyString(value, field) {
  const s = String(value ?? '').trim();
  if (!s) throw new Error(`${field} is required`);
  if (s.length > 512) throw new Error(`${field} is too long`);
  return s;
}

const GET_REDIRECT_ALLOWED_ACTIONS = new Set([
  'shopping.unfordering',
  'shopping.unfsearch',
  'shopping.unfproduct',
  'shopping.unfviewcart',
  'orders.unfbillship',
  'express.unfexpresspay',
  'forms.unf1000',
  'reports.unfreportcriteria',
  'reports.sammqualificationunf',
  'main.unflogin',
]);

/** POST redirect follow (307/308): exclude checkout form POST targets. */
const POST_REDIRECT_ALLOWED_ACTIONS = new Set([
  'shopping.unfordering',
  'shopping.unfsearch',
  'shopping.unfproduct',
  'shopping.unfviewcart',
  'forms.unf1000',
  'reports.unfreportcriteria',
  'reports.sammqualificationunf',
  'main.unflogin',
]);

export function assertUnfUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    throw Object.assign(new Error('Invalid URL.'), { code: 'UNF_BAD_URL' });
  }
  if (u.protocol !== 'https:' || u.hostname !== HK_HOST) {
    throw Object.assign(new Error('Refusing request outside hk.unfranchise.com.'), { code: 'UNF_BAD_URL' });
  }
  if (u.port && u.port !== '443') {
    throw Object.assign(new Error('Refusing non-standard HTTPS port.'), { code: 'UNF_BAD_URL' });
  }
  if (u.username || u.password) {
    u.username = '';
    u.password = '';
  }
  return u.toString();
}

function assertSafeRedirect(urlString, { forPost = false } = {}) {
  const u = new URL(assertUnfUrl(urlString));
  const action = (u.searchParams.get('action') || '').split('&')[0].toLowerCase();
  if (!action) return u.toString();
  const allow = forPost ? POST_REDIRECT_ALLOWED_ACTIONS : GET_REDIRECT_ALLOWED_ACTIONS;
  if (!allow.has(action)) {
    const ctx = forPost ? 'POST redirect' : 'read-only redirect';
    throw Object.assign(new Error(`Refusing ${ctx} to ${action}.`), { code: 'UNF_BAD_URL' });
  }
  return u.toString();
}

/** Allow GET hops only onto known read-only actions (includes bill-ship GET map). */
export function assertSafeReadRedirect(urlString) {
  return assertSafeRedirect(urlString, { forPost: false });
}

/** Stricter allowlist when a POST body may be replayed onto redirect Location. */
export function assertSafePostRedirect(urlString) {
  return assertSafeRedirect(urlString, { forPost: true });
}

export function assertHttpOk(status, context) {
  if (status < 200 || status >= 300) {
    const err = new Error(`${context} failed with HTTP ${status}`);
    err.code = 'UNF_HTTP';
    err.status = status;
    throw err;
  }
}

/** Strip secrets from error text shown to MCP/CLI consumers. */
export function publicErrorMessage(err) {
  const code = err?.code;
  if (code === 'UNF_BAD_COOKIE' || code === 'UNF_NO_COOKIE') {
    return err.message;
  }
  if (code === 'UNF_BAD_URL' || code === 'UNF_HTTP') {
    return err.message;
  }
  let raw = String(err?.message ?? err ?? 'Unknown error');
  if (code === 'UNF_BAD_PATH') {
    return err.message;
  }
  if (/invalid header value/i.test(raw)) {
    return 'Request failed: invalid session cookie or headers (details redacted).';
  }
  raw = /:\/\/|[?&=]/.test(raw)
    ? redactSessionTokensInUrl(redactSessionTokensInText(raw))
    : redactSessionTokensInText(raw);
  return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
}

export function parseLocaleNumber(text) {
  if (text == null) return null;
  const n = Number(String(text).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Reject coerced strings like `"100"` concatenating in sums — numbers must be typeof number and finite. */
export function parseFiniteNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  if (value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

export function parseBooleanStrict(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

export function parseFiniteNumberList(values, field) {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  return values.map((v, i) => parseFiniteNumber(v, `${field}[${i}]`, { min: 0 }));
}
