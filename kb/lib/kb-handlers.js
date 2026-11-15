import { kbGet } from './retrieve.js';
import { runKbSearch } from './kb-search-run.js';
import { captureKnowledgeToolCall } from './kb-tool-capture.js';

/**
 * Shared MCP + integration test entry (plan A5 capture on real tool path).
 */
export async function handleKbTool(
  name,
  args = {},
  { operationalContext = '', generationMessages = [] } = {},
) {
  if (name === 'kb_search') {
    const q = args.query;
    if (typeof q !== 'string' || !q.trim()) {
      return { isError: true, text: 'query must be a non-empty string' };
    }
    let limit = Number(args.limit ?? 8);
    if (!Number.isFinite(limit)) limit = 8;
    limit = Math.min(20, Math.max(1, Math.trunc(limit)));
    const iso = captureKnowledgeToolCall(
      'kb_search',
      { query: q, limit },
      { operationalContext, generationMessages },
    );
    if (!iso.isolation.ok) {
      return { isError: true, text: `A5 isolation failed: ${iso.isolation.reason}` };
    }
    const { hits } = await runKbSearch(q, { limit });
    return { isError: false, text: JSON.stringify(hits, null, 2) };
  }
  if (name === 'kb_get') {
    const id = args.chunk_id;
    if (typeof id !== 'string' || !id.trim()) {
      return { isError: true, text: 'chunk_id must be a non-empty string' };
    }
    const iso = captureKnowledgeToolCall('kb_get', { chunk_id: id }, {
      operationalContext,
      generationMessages,
    });
    if (!iso.isolation.ok) {
      return { isError: true, text: `A5 isolation failed: ${iso.isolation.reason}` };
    }
    const row = await kbGet(id);
    return { isError: false, text: JSON.stringify(row, null, 2) };
  }
  return { isError: true, text: `Unknown tool: ${name}` };
}