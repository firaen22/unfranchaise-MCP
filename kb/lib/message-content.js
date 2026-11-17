/** Flatten MCP / chat message content for A5 isolation scans. */

export const A5_DEPTH_MARKER = '<<UNF_A5_DEPTH_EXCEEDED>>';
export const A5_UNINSPECTABLE_MARKER = '<<UNF_A5_UNINSPECTABLE_BLOCK>>';

const MAX_FLATTEN_DEPTH = 12;

function flattenToolUse(part) {
  const name = String(part.name ?? '');
  const input = part.input != null ? JSON.stringify(part.input) : '';
  return `${name} ${input}`.trim();
}

function flattenPlainObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  try {
    return JSON.stringify(obj);
  } catch {
    return A5_UNINSPECTABLE_MARKER;
  }
}

export function flattenMessageContent(content, depth = 0) {
  if (content == null || content === '') return '';
  if (depth > MAX_FLATTEN_DEPTH) return A5_DEPTH_MARKER;
  if (typeof content === 'string') return content;
  if (typeof content === 'number' || typeof content === 'boolean') return String(content);
  if (Array.isArray(content)) {
    const parts = content.map((part) => {
      if (part != null && typeof part === 'object' && !Array.isArray(part) && part.type == null) {
        return flattenPlainObject(part);
      }
      return flattenMessageContent(part, depth + 1);
    });
    if (parts.some((p) => p === A5_DEPTH_MARKER)) return A5_DEPTH_MARKER;
    if (parts.some((p) => p === A5_UNINSPECTABLE_MARKER)) return A5_UNINSPECTABLE_MARKER;
    return parts.filter(Boolean).join('\n');
  }
  if (typeof content === 'object') {
    if (content.type === 'text') {
      if (typeof content.text === 'string') return flattenMessageContent(content.text, depth + 1);
      if (content.text != null) return flattenPlainObject(content.text);
      return A5_UNINSPECTABLE_MARKER;
    }
    if (content.type === 'tool_use') {
      return flattenToolUse(content);
    }
    if (content.type === 'tool_result') {
      const fromContent = flattenMessageContent(content.content, depth + 1);
      const fromOutput = flattenMessageContent(content.output, depth + 1);
      return [fromContent, fromOutput].filter(Boolean).join('\n');
    }
    if (typeof content.content === 'string') {
      return flattenMessageContent(content.content, depth + 1);
    }
    if (Array.isArray(content.content)) {
      return flattenMessageContent(content.content, depth + 1);
    }
    if (
      content.type === 'image' ||
      content.type === 'resource' ||
      content.type === 'embedded_resource'
    ) {
      return A5_UNINSPECTABLE_MARKER;
    }
    if (content.type == null) {
      return flattenPlainObject(content);
    }
    if (content.type && content.type !== 'text') {
      return A5_UNINSPECTABLE_MARKER;
    }
    return '';
  }
  return String(content);
}