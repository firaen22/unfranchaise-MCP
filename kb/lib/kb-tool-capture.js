import {
  assertKnowledgeIsolation,
  scanGenerationMessagesToolResultExtras,
  scanPayloadForLeaks,
  userControlledKnowledgePayload,
} from './canary.js';
import { A5_UNINSPECTABLE_MARKER, flattenMessageContent } from './message-content.js';

function serializeGenerationMessage(m) {
  try {
    return JSON.stringify(m, (_, v) => (typeof v === 'bigint' ? String(v) : v));
  } catch {
    return A5_UNINSPECTABLE_MARKER;
  }
}

/** Last outbound kb tool invocation (for A5 harness + tests). */
let lastCapture = null;

export function captureKnowledgeToolCall(
  name,
  args,
  { operationalContext = '', generationMessages = [] } = {},
) {
  const payload = JSON.stringify({ tool: name, arguments: args });
  const generationText = generationMessages.map((m) => serializeGenerationMessage(m)).join('\n');
  const generationFlatten = generationMessages
    .map((m) => flattenMessageContent(m?.content))
    .filter(Boolean)
    .join('\n');
  const generationBoundary = [operationalContext, generationText, generationFlatten]
    .filter(Boolean)
    .join('\n');
  lastCapture = {
    name,
    args,
    payload,
    operationalContext,
    generationMessages,
    generationBoundary,
    at: Date.now(),
  };
  const msgExtras = scanGenerationMessagesToolResultExtras(generationMessages);
  const leak = scanPayloadForLeaks(payload, args);
  const check =
    msgExtras ??
    leak ??
    assertKnowledgeIsolation({
      operationalContext: generationBoundary,
      knowledgePayload: payload,
      knowledgeUserPayload: userControlledKnowledgePayload(payload, args),
      knowledgeArguments: args,
      isolationEnabled: true,
    });
  return { capture: lastCapture, isolation: check };
}

export function getLastKnowledgeToolCapture() {
  return lastCapture;
}