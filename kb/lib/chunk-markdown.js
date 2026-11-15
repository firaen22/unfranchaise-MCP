/** `02-[[B2B]]/foo` → `02-B2B/foo` for FTS and host snippets. */
export function stripObsidianWikilinks(markdown) {
  return String(markdown ?? '').replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, target, alias) =>
    alias?.trim() ? alias.trim() : target.trim(),
  );
}

/**
 * Heading-based markdown chunks (## and ### boundaries).
 */
export function chunkMarkdown(markdown, { docTitle = '' } = {}) {
  const lines = stripObsidianWikilinks(markdown).replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = { heading: docTitle || '(root)', lines: [] };

  for (const line of lines) {
    const hm = line.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      if (current.lines.length > 0 || current.heading) {
        sections.push(current);
      }
      current = { heading: hm[2].trim(), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0) sections.push(current);

  return sections
    .map((s) => ({
      heading: s.heading,
      text: s.lines.join('\n').trim(),
    }))
    .filter((s) => s.text.length > 0);
}