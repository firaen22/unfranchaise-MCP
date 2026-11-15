/** A5 poisoned-context isolation check (plan §7.1). */

const SENTINEL_RE = /UNF_CANARY_[A-Z0-9_]+/;
const COOKIE_LEAK_RE = /\bUNF_COOKIE\b|CFID=|CFTOKEN=|session_secret/i;
const CART_HTML_RE =
  /<[^>]*\bclass=["'][^"']*cart|Private cart contents|<div[^>]*cart|checkout[-_]html/i;
const ACCOUNT_PAYLOAD_RE =
  /"accountId"\s*:|"customerId"\s*:|"orders"\s*:\s*\[|"email"\s*:\s*"[^"]+@/;
const CART_MCP_JSON_RE = /"lineItems"\s*:|"retailTotalHkd"|"bvTotal"|"wholesaleTotalHkd"/;

export function extractKnowledgePayload(toolArgs, generationMessages = []) {
  const parts = [];
  if (toolArgs) parts.push(JSON.stringify(toolArgs));
  for (const m of generationMessages) {
    if (m?.content) parts.push(String(m.content));
  }
  return parts.join('\n');
}

/**
 * @param {object} opts
 * @param {boolean} [opts.isolationEnabled=true]
 * @param {boolean} [opts.deliberateBypass=false] test-only negative control
 */
export function scanPayloadForLeaks(serializedPayload, rawArgs = {}) {
  const parts = [serializedPayload];
  if (rawArgs && typeof rawArgs === 'object') {
    for (const v of Object.values(rawArgs)) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  const joined = parts.join('\n');
  if (SENTINEL_RE.test(joined)) return { ok: false, reason: 'unexpected_sentinel_in_knowledge_payload' };
  if (COOKIE_LEAK_RE.test(joined)) return { ok: false, reason: 'operational_secret_in_knowledge_payload' };
  if (CART_HTML_RE.test(joined)) return { ok: false, reason: 'cart_html_in_knowledge_payload' };
  if (ACCOUNT_PAYLOAD_RE.test(joined)) return { ok: false, reason: 'account_payload_in_knowledge_payload' };
  return null;
}

export function assertKnowledgeIsolation(opts) {
  const {
    operationalContext = '',
    knowledgePayload = '',
    isolationEnabled = true,
    deliberateBypass = false,
  } = opts;

  if (deliberateBypass || !isolationEnabled) {
    if (SENTINEL_RE.test(operationalContext) && SENTINEL_RE.test(knowledgePayload)) {
      return { ok: false, reason: 'operational_sentinel_leaked_into_knowledge_payload' };
    }
    return { ok: false, reason: 'isolation_disabled_or_bypassed' };
  }

  if (SENTINEL_RE.test(operationalContext) && SENTINEL_RE.test(knowledgePayload)) {
    return { ok: false, reason: 'operational_sentinel_leaked_into_knowledge_payload' };
  }
  if (COOKIE_LEAK_RE.test(operationalContext)) {
    return { ok: false, reason: 'operational_secret_in_generation_context' };
  }
  if (CART_HTML_RE.test(operationalContext)) {
    return { ok: false, reason: 'cart_html_in_generation_context' };
  }
  if (ACCOUNT_PAYLOAD_RE.test(operationalContext)) {
    return { ok: false, reason: 'account_payload_in_generation_context' };
  }
  if (CART_MCP_JSON_RE.test(operationalContext)) {
    return { ok: false, reason: 'cart_mcp_json_in_generation_context' };
  }
  if (SENTINEL_RE.test(knowledgePayload)) {
    return { ok: false, reason: 'unexpected_sentinel_in_knowledge_payload' };
  }
  if (COOKIE_LEAK_RE.test(knowledgePayload)) {
    return { ok: false, reason: 'operational_secret_in_knowledge_payload' };
  }
  if (CART_HTML_RE.test(knowledgePayload)) {
    return { ok: false, reason: 'cart_html_in_knowledge_payload' };
  }
  if (ACCOUNT_PAYLOAD_RE.test(knowledgePayload)) {
    return { ok: false, reason: 'account_payload_in_knowledge_payload' };
  }
  return { ok: true };
}