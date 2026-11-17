/** Redact secrets before gate bundle / reviewer attachments. */

const REDACT_PATTERNS = [
  [/\bCFID=\d+/gi, 'CFID=REDACTED'],
  [/\bCFTOKEN=[^\s"']+/gi, 'CFTOKEN=REDACTED'],
  [/\bUNF_COOKIE=[^\s"']+/gi, 'UNF_COOKIE=REDACTED'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'email@redacted'],
  [/\b\d{6,}\b/g, 'ID_REDACTED'],
];

export function sanitizeString(s) {
  let out = String(s ?? '');
  for (const [re, rep] of REDACT_PATTERNS) out = out.replace(re, rep);
  return out;
}

export function sanitizeJson(value) {
  return JSON.parse(sanitizeString(JSON.stringify(value)));
}

export async function parseToolText(result) {
  const text = result?.content?.[0]?.text;
  if (!text) return { error: 'empty_tool_result' };
  try {
    return sanitizeJson(JSON.parse(text));
  } catch {
    return { raw: sanitizeString(text) };
  }
}