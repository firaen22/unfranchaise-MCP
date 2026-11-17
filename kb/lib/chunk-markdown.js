/** `02-[[B2B]]/foo` → `02-B2B/foo` for FTS and host snippets. */
export function stripObsidianWikilinks(markdown) {
  return String(markdown ?? '').replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, target, alias) =>
    alias?.trim() ? alias.trim() : target.trim(),
  );
}

/**
 * Heading-based markdown chunks (## and ### boundaries).
 * Child sections inherit ancestor heading lines for classification guards (plan §6).
 */
export function chunkMarkdown(markdown, { docTitle = '' } = {}) {
  const lines = stripObsidianWikilinks(markdown).replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  const headingStack = [];
  let current = { heading: docTitle || '(root)', lines: [], ancestors: [] };

  for (const line of lines) {
    const hm = line.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = hm[1].length;
      if (current.lines.length > 0 || current.heading) {
        sections.push(current);
      }
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      const ancestors = headingStack.map((h) => h.line);
      headingStack.push({ level, line });
      current = { heading: hm[2].trim(), lines: [line], ancestors };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0) sections.push(current);

  return sections
    .map((s) => {
      const body = s.lines.join('\n').trim();
      const prefix = (s.ancestors ?? []).join('\n').trim();
      const text = prefix ? `${prefix}\n${body}` : body;
      return { heading: s.heading, text: text.trim() };
    })
    .filter((s) => s.text.length > 0);
}