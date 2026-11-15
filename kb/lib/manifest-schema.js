const REQUIRED_STRING = ['source_id', 'source_type', 'title', 'locale', 'claim_class', 'status', 'doc_version'];

export function validateManifestRow(row) {
  const errors = [];
  if (!row || typeof row !== 'object') return { ok: false, errors: ['row_not_object'] };
  for (const k of REQUIRED_STRING) {
    if (typeof row[k] !== 'string' || !row[k].trim()) errors.push(`missing_${k}`);
  }
  if (typeof row.ingest_allowed !== 'boolean') errors.push('ingest_allowed_must_be_boolean');
  if (!Array.isArray(row.sku_ids)) errors.push('sku_ids_must_be_array');
  if (row.source_type === 'obsidian_md' && typeof row.vault_rel_path !== 'string') {
    errors.push('vault_rel_path_required');
  }
  if (row.source_type === 'manual_html' && typeof row.url !== 'string') {
    errors.push('url_required_for_manual_html');
  }
  if (!('product_family' in row)) errors.push('missing_product_family');
  if (!('canonical_for_topic' in row)) errors.push('missing_canonical_for_topic');
  if (!('duplicate_of_source_id' in row)) errors.push('missing_duplicate_of_source_id');
  return { ok: errors.length === 0, errors };
}

export function assertManifestRow(row) {
  const v = validateManifestRow(row);
  if (!v.ok) throw new Error(`invalid_manifest: ${v.errors.join(',')}`);
  return row;
}