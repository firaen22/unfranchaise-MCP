/** Strip operational secrets from kb subprocess (plan §4.0 A5). */

import { haystackMatchesPattern } from './guard-normalize.js';

const DENY_PREFIXES = ['UNF_COOKIE', 'UNF_CANARY'];
const DENY_EXACT_KEYS = new Set([
  'HTTP_COOKIE',
  'COOKIE',
  'Cookie',
  'AUTHORIZATION',
  'Authorization',
  'AUTH_TOKEN',
  'auth_token',
]);

const ALLOWED_EXACT_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'NODE_OPTIONS',
  'NODE_EXTRA_CA_CERTS',
  'NODE_ENV',
  'PWD',
  'NODE_PATH',
  'UNF_KB_CORPUS',
  'UNF_KB_OP_CONTEXT',
  'UNF_OBSIDIAN_VAULT_SHOPCOM',
]);

const ALLOWED_KEY_PREFIXES = ['LC_', 'npm_'];

const DENY_VALUE_RE =
  /\bUNF_COOKIE\b|\bUNF_CANARY\b|CFID=|CFTOKEN=|JSESSIONID=|PHPSESSID=|auth_token=/i;

function isDeniedKey(key) {
  if (DENY_EXACT_KEYS.has(key)) return true;
  if (/^UNF_KB_/i.test(key) && !ALLOWED_EXACT_KEYS.has(key)) return true;
  return DENY_PREFIXES.some((p) => key === p || key.startsWith(`${p}_`));
}

function isAllowedKey(key) {
  if (isDeniedKey(key)) return false;
  if (ALLOWED_EXACT_KEYS.has(key)) return true;
  return ALLOWED_KEY_PREFIXES.some((p) => key.startsWith(p));
}

export function sanitizeKnowledgeEnv(env = process.env) {
  const next = {};
  for (const [key, value] of Object.entries(env)) {
    if (!isAllowedKey(key)) continue;
    if (
      key !== 'UNF_KB_OP_CONTEXT' &&
      typeof value === 'string' &&
      haystackMatchesPattern(value, DENY_VALUE_RE)
    ) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function applyKnowledgeEnvSanitize() {
  const sanitized = sanitizeKnowledgeEnv(process.env);
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, sanitized);
}