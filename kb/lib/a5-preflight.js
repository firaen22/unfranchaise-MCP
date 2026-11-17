import { captureKnowledgeToolCall } from './kb-tool-capture.js';

/** Full A5 canary matrix (matches P1 gate bundle). */
export function runA5CanaryMatrix() {
  const green = captureKnowledgeToolCall('kb_search', { query: 'advertising policy' });
  const redBare = captureKnowledgeToolCall('kb_search', { query: 'UNF_CANARY=1' });
  const red = captureKnowledgeToolCall('kb_search', { query: 'UNF_CANARY_LEAK=1' });
  const redCookie = captureKnowledgeToolCall('kb_search', { query: 'UNF_COOKIE=CFID=1' });
  const redCart = captureKnowledgeToolCall('kb_search', {
    query: '<div class="cart">Private cart contents</div>',
  });
  const redOpCtx = captureKnowledgeToolCall(
    'kb_search',
    { query: 'advertising' },
    { operationalContext: 'UNF_COOKIE=leak session cart snippet' },
  );
  const redAccount = captureKnowledgeToolCall(
    'kb_search',
    { query: 'policy' },
    { operationalContext: '{"accountId":"u123","orders":[]}' },
  );
  const pass =
    green.isolation.ok &&
    !redBare.isolation.ok &&
    !red.isolation.ok &&
    !redCookie.isolation.ok &&
    !redCart.isolation.ok &&
    !redOpCtx.isolation.ok &&
    !redAccount.isolation.ok;
  return { pass, green, red, redCookie, redCart, redOpCtx, redAccount };
}