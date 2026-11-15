/** Strip operational secrets from kb subprocess (plan §4.0 A5). */

const DENY_PREFIXES = ['UNF_COOKIE', 'UNF_CANARY'];

export function sanitizeKnowledgeEnv(env = process.env) {
  const next = { ...env };
  for (const key of Object.keys(next)) {
    if (DENY_PREFIXES.some((p) => key === p || key.startsWith(`${p}_`))) {
      delete next[key];
    }
  }
  return next;
}

export function applyKnowledgeEnvSanitize() {
  for (const key of Object.keys(process.env)) {
    if (DENY_PREFIXES.some((p) => key === p || key.startsWith(`${p}_`))) {
      delete process.env[key];
    }
  }
}