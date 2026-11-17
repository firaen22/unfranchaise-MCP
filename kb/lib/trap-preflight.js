import { kbGet } from './retrieve.js';
import { chunkFailsCommercialGuard } from './classify.js';

/** Trap rows: kb may return policy prose; fail only if any hit looks commercial/order. */
export async function kbHitsLeakCommercial(hits, { corpusRoot } = {}) {
  for (const h of hits) {
    const row = await kbGet(h.chunk_id, { corpusRoot });
    if (!row) continue;
    if (chunkFailsCommercialGuard(row)) return true;
  }
  return false;
}