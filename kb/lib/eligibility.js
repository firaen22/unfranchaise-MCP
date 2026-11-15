import { isForbiddenClaimClass, chunkFailsCommercialGuard } from './classify.js';
import { validateManifestRow } from './manifest-schema.js';

/**
 * Retrieval eligibility (plan §6): manifest + chunk filters for search/get.
 */
export function manifestRetrievalEligible(row) {
  if (!row || row.ingest_allowed !== true) return false;
  if (row.status !== 'active') return false;
  if (row.superseded_by) return false;
  if (isForbiddenClaimClass(row.claim_class)) return false;
  const v = validateManifestRow(row);
  if (!v.ok) return false;
  return true;
}

export function chunkRetrievalEligible(manifestRow, chunk) {
  if (!manifestRetrievalEligible(manifestRow)) return false;
  if (!chunk?.chunk_id || !chunk?.text) return false;
  if (isForbiddenClaimClass(chunk.claim_class)) return false;
  if (chunkFailsCommercialGuard(chunk)) return false;
  if (
    manifestRow.doc_version &&
    chunk.doc_version &&
    manifestRow.doc_version !== chunk.doc_version
  ) {
    return false;
  }
  return true;
}