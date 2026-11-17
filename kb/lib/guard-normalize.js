/** Bounded decode layers for A1/A5 guards (percent + HTML entities). */

const NAMED_HTML_ENTITIES = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodePercentEncoding(text) {
  return String(text ?? '').replace(/%([0-9a-fA-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
}

export function decodeHtmlEntities(text) {
  return String(text ?? '')
    .replace(/&#(\d+);?/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(
      /&([a-z]+);?/gi,
      (full, name) => NAMED_HTML_ENTITIES[name.toLowerCase()] ?? full,
    );
}

const TRANSFORMS = [
  (s) => decodePercentEncoding(s),
  (s) => decodeHtmlEntities(s),
  (s) => s.normalize('NFKC'),
];

/** ModSecurity-style convergence: percent → entities, max 3 rounds per branch. */
export function expandGuardHaystack(text) {
  const raw = String(text ?? '');
  if (!raw) return [''];
  const out = new Set([raw]);
  const queue = [raw];
  let depth = 0;
  while (queue.length && depth < 9) {
    const batch = queue.splice(0, queue.length);
    depth += 1;
    for (const cur of batch) {
      for (const fn of TRANSFORMS) {
        const next = fn(cur);
        if (next !== cur && !out.has(next)) {
          out.add(next);
          queue.push(next);
        }
      }
    }
  }
  return [...out];
}

export function haystackMatchesPattern(text, pattern) {
  if (!text) return false;
  for (const variant of expandGuardHaystack(text)) {
    if (pattern.test(variant)) return true;
  }
  return false;
}

export function commercialDetectionLayers(raw) {
  return expandGuardHaystack(raw);
}