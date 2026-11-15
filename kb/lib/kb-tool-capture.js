import { assertKnowledgeIsolation, scanPayloadForLeaks } from './canary.js';

/** Last outbound kb tool invocation (for A5 harness + tests). */
let lastCapture = null;

export function captureKnowledgeToolCall(
  name,
  args,
  { operationalContext = '', generationMessages = [] } = {},
) {
  const payload = JSON.stringify({ tool: name, arguments: args });
  const generationText = generationMessages
    .map((m) => String(m?.content ?? ''))
    .filter(Boolean)
    .join('\n');
  const generationBoundary = [operationalContext, generationText].filter(Boolean).join('\n');
  lastCapture = {
    name,
    args,
    payload,
    operationalContext,
    generationMessages,
    generationBoundary,
    at: Date.now(),
  };
  const leak = scanPayloadForLeaks(payload, args);
  const check =
    leak ??
    assertKnowledgeIsolation({
      operationalContext: generationBoundary,
      knowledgePayload: payload,
      isolationEnabled: true,
    });
  return { capture: lastCapture, isolation: check };
}

export function getLastKnowledgeToolCapture() {
  return lastCapture;
}