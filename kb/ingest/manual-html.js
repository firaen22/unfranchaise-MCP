import * as cheerio from 'cheerio';
import { classifyChunkText } from '../lib/classify.js';

/** Minimal manual HTML chunker (Phase 0.4 / oracle fixture path). */
export function chunkManualHtml(html, { docTitle = 'manual' } = {}) {
  const $ = cheerio.load(html);
  const chunks = [];
  $('p').each((i, el) => {
    let text = $(el).text().replace(/\s+/g, ' ').trim();
    const href = $(el).find('a[href]').first().attr('href');
    if (href) text = `${text} ${href}`.trim();
    if (!text) return;
    const claimClass = classifyChunkText(text, { defaultClass: 'policy' });
    chunks.push({
      heading: `${docTitle}#p${i}`,
      text,
      claim_class: claimClass,
    });
  });
  $('table').each((i, el) => {
    const rows = [];
    $(el)
      .find('tr')
      .each((_, row) => {
        const cells = [];
        $(row)
          .find('td, th')
          .each((__, cell) => cells.push($(cell).text().trim()));
        if (cells.length) rows.push(cells.join(' | '));
      });
    const text = rows.join(' ; ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const claimClass = classifyChunkText(text, { defaultClass: 'policy' });
    chunks.push({
      heading: `${docTitle}#${i}`,
      text,
      claim_class: claimClass,
    });
  });
  if (chunks.length === 0) {
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text) {
      chunks.push({
        heading: docTitle,
        text,
        claim_class: classifyChunkText(text, { defaultClass: 'policy' }),
      });
    }
  }
  return chunks;
}