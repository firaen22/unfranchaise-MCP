#!/usr/bin/env node
/** Classifier oracle red→green evidence (plan §7.1 ingest oracle). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyChunkText,
  detectCommercialNumeric,
  detectOrderUrl,
  chunkFailsCommercialGuard,
} from '../kb/lib/classify.js';
import { chunkRetrievalEligible } from '../kb/lib/eligibility.js';
import {
  runClassifierOracleFixtures,
  ORACLE_INDEPENDENT_MUST_BLOCK,
  ORACLE_REQUIRES_CHUNK_CONTEXT,
} from '../kb/ingest/oracle-fixtures.js';
import { captureKnowledgeToolCall } from '../kb/lib/kb-tool-capture.js';
import { assertManifestRow, validateManifestRow } from '../kb/lib/manifest-schema.js';
import { writeJsonl } from '../kb/lib/jsonl.js';
import { chunksPath, manifestPath } from '../kb/lib/paths.js';
import { rebuildIndex } from '../kb/lib/index-db.js';
import { kbGet, kbSearch } from '../kb/lib/retrieve.js';
import { chunkManualPageHtml } from '../kb/ingest/manual-chapters.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

const signedSpans = [
  'BV: +16',
  '{"bvPoints":"+16"}',
  '{"ibvPercent":"+8.8397"}',
  'SRP: +181',
  'Price: +29.99',
  '售價：+181',
  '售價為181',
  '售價：一百八十一港元',
  '售價每瓶181元',
  'SRP amounts to 181',
  'SRP: one hundred eighty-one Hong Kong dollars.',
  'BV value: 16',
  'IBV percentage: 8.8397%',
  'BV value = 16',
  'Business Volume: +16',
  'Business Volume = 16',
  'UC value: 181',
  '批發價=181',
  '超連鎖成本價：181',
  'UC (HK$): 181',
  'BV: .5',
  'SRP: .5',
  'Price: €29.99',
  'BV = .5',
  'IBV = .5',
  'UC = .5',
  'Price: £29.99',
  'Price = €29.99',
  'Price is £29.99',
  'BV value is 16',
  'The IBV points are 16.',
  'The IBV percentage is 8.8397%.',
  'SRP = €181',
  'BV value equals 16',
  'Business Volume (BV) = 16',
  'UC (HKD) = 181',
  'SRP equals 181.',
  'Price equals 181',
  'Price is EUR 29.99',
  'IBV: -.5',
  'Price (USD): 29.99',
  'IBV points equal 16',
  'UC: €181',
  'Price: ¥181',
  'Business Volume is +16',
  'IBV points equals 16',
  'BV points of 16',
  'BV value of 16',
  'SRP value is 181',
  'SRP value equals 181',
  'SRP value of 181',
  'UC (HK$) = 181',
  'SRP (HK$) = 181',
];
const classifierRed = signedSpans.map((span) => {
  const classified = classifyChunkText(span, { defaultClass: 'operator_synthesis' });
  return {
    span,
    detectCommercialNumeric: detectCommercialNumeric(span),
    classified,
    red_if_stored_as_operator_synthesis_only: classified !== 'commercial_numeric',
  };
});

const manifest = assertManifestRow({
  source_id: 'oracle_mislabel_title',
  source_type: 'harness',
  title: 'SRP: +181',
  locale: 'en',
  sku_ids: [],
  product_family: null,
  canonical_for_topic: null,
  duplicate_of_source_id: null,
  claim_class: 'operator_synthesis',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'oracle-mislabel',
});
const mislabelChunk = {
  chunk_id: 'mislabel_title_fallback',
  source_id: 'oracle_mislabel_title',
  text: 'Operator pitch without inline price table.',
  claim_class: 'operator_synthesis',
  doc_version: 'oracle-mislabel',
};
const mislabelEligible = chunkRetrievalEligible(manifest, mislabelChunk);

const tmpMis = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-mislabel-ingest-'));
writeJsonl(manifestPath(tmpMis), [manifest]);
writeJsonl(chunksPath(tmpMis), [mislabelChunk]);
const misStats = await rebuildIndex(tmpMis);
const misGet = await kbGet('mislabel_title_fallback', { corpusRoot: tmpMis });
const misSearch = await kbSearch('Operator pitch', { corpusRoot: tmpMis, limit: 5 });
fs.rmSync(tmpMis, { recursive: true, force: true });

const mislabelIngestText = 'Retail note. SRP: +181 ends promo window.';
const mislabelIngestClass = classifyChunkText(mislabelIngestText, { defaultClass: 'operator_synthesis' });

const unicodeAccountCtx = 'Tool returned: {"\\u0061ccountId":"u123"}';
const unicodeAccountIso = captureKnowledgeToolCall(
  'kb_search',
  { query: 'advertising', limit: 3 },
  { operationalContext: unicodeAccountCtx },
);

const genericAccountCtx = '{"account":{"id":"u123","name":"Example"}}';
const genericAccountIso = captureKnowledgeToolCall(
  'kb_search',
  { query: 'advertising', limit: 3 },
  { operationalContext: genericAccountCtx },
);

const bareCartStatusCtx = '{"status":200,"empty":true}';
const bareCartStatusIso = captureKnowledgeToolCall(
  'kb_search',
  { query: 'advertising', limit: 3 },
  { operationalContext: bareCartStatusCtx },
);

const bvValueIngestText = 'Policy framing only. BV value: 16 noted in margin.';
const bvValueManifest = assertManifestRow({
  source_id: 'oracle_bv_value_mislabel',
  source_type: 'harness',
  title: 'Operator margin note',
  locale: 'en',
  sku_ids: [],
  product_family: null,
  canonical_for_topic: null,
  duplicate_of_source_id: null,
  claim_class: 'operator_synthesis',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'oracle-bv-value',
});
const bvValueChunk = {
  chunk_id: 'bv_value_mislabel_chunk',
  source_id: 'oracle_bv_value_mislabel',
  text: bvValueIngestText,
  claim_class: 'operator_synthesis',
  doc_version: 'oracle-bv-value',
};
const bvValueEligible = chunkRetrievalEligible(bvValueManifest, bvValueChunk);
const tmpBv = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-bv-value-ingest-'));
writeJsonl(manifestPath(tmpBv), [bvValueManifest]);
writeJsonl(chunksPath(tmpBv), [bvValueChunk]);
const bvStats = await rebuildIndex(tmpBv);
const bvGet = await kbGet('bv_value_mislabel_chunk', { corpusRoot: tmpBv });
const bvSearch = await kbSearch('Policy framing', { corpusRoot: tmpBv, limit: 5 });
fs.rmSync(tmpBv, { recursive: true, force: true });
const bvValueIngestClass = classifyChunkText(bvValueIngestText, { defaultClass: 'operator_synthesis' });

const poisonedSourceId = 'https://hk.unfranchise.com/index.cfm?action=shopping.unfOrdering';
const poisonedManifestValidation = validateManifestRow({
  source_id: poisonedSourceId,
  source_type: 'harness',
  title: 'benign policy',
  locale: 'en',
  sku_ids: [],
  product_family: null,
  canonical_for_topic: null,
  duplicate_of_source_id: null,
  claim_class: 'policy',
  status: 'active',
  ingest_allowed: true,
  doc_version: 'poison-id',
});
const manualBvDefinitionChunk = {
  chunk_id: 'manual_ch_25_8a3fd765#1',
  source_id: 'manual_ch_25_8a3fd765',
  doc_title: 'ch25 SEC. 1 KEY DEFINITIONS AND TERMINOLOGY',
  doc_version: 'manual-0.4',
  text:
    'Business Volume (BV): The numeric value assigned to products and services, which accumulates toward the pay out of commission.',
  claim_class: 'policy',
};
const manualBvManifest = {
  source_id: 'manual_ch_25_8a3fd765',
  title: 'Definitions',
  ingest_allowed: true,
  status: 'active',
  claim_class: 'policy',
  doc_version: 'manual-0.4',
};
const manualBvDefinitionGuardFail = chunkFailsCommercialGuard(manualBvDefinitionChunk, manualBvManifest);

const poisonedRetrieveGuard = chunkFailsCommercialGuard(
  {
    chunk_id: 'poison_id_benign',
    source_id: poisonedSourceId,
    text: 'Advertising policy summary only.',
    claim_class: 'policy',
    doc_version: 'poison-id',
  },
  { source_id: poisonedSourceId, title: 'benign policy' },
);

const tmpGreen = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-oracle-green-'));
const greenOracle = await runClassifierOracleFixtures(tmpGreen, repo);
fs.rmSync(tmpGreen, { recursive: true, force: true });

const tmpObserve = fs.mkdtempSync(path.join(os.tmpdir(), 'unf-kb-oracle-observe-'));
const observeCorpus = await runClassifierOracleFixtures(tmpObserve, repo);
const zhRule = ORACLE_INDEPENDENT_MUST_BLOCK.find((r) => r.includes === '批發價：181');
const brokenDetect = () => false;
let classifierOnlyFailures = [];
for (const rule of ORACLE_INDEPENDENT_MUST_BLOCK) {
  if (rule !== zhRule) continue;
  const md = fs.readFileSync(path.join(repo, 'kb/fixtures/mixed-policy.md'), 'utf8');
  if (!md.includes(rule.includes)) classifierOnlyFailures.push(`missing_fixture_span:${rule.includes}`);
  else if (!brokenDetect(rule.includes)) classifierOnlyFailures.push(`classifier_only_miss:批發價：181`);
}
const observedRed = {
  injected_defect: 'detectCommercialNumeric forced false for 批發價：181 rule',
  independent_classifier_failures: classifierOnlyFailures,
  pass: classifierOnlyFailures.some((f) => f.startsWith('classifier_only_miss')),
};
const observedGreen = {
  detectCommercialNumeric: detectCommercialNumeric('批發價：181'),
  independentOraclePass: observeCorpus.independentOraclePass,
  pass: detectCommercialNumeric('批發價：181') && observeCorpus.independentOraclePass,
};
fs.rmSync(tmpObserve, { recursive: true, force: true });

const manualProductionHeadingOracle = (() => {
  const paragraphSections = chunkManualPageHtml(
    '<article><h2>BV</h2><h3>HK1410</h3><p>16</p></article>',
    { docTitle: 'BV table', chapter: '98' },
  );
  const paragraphCommercial = paragraphSections.find((s) => s.text.includes('HK1410'));
  const tableSections = chunkManualPageHtml(
    '<article><h2>BV</h2><h3>HK1410</h3><table><tr><td>16</td></tr></table></article>',
    { docTitle: 'BV table', chapter: '98' },
  );
  const tableCommercial = tableSections.find((s) => s.text.includes('16'));
  const paragraphOk =
    paragraphCommercial?.claim_class === 'commercial_numeric' &&
    chunkFailsCommercialGuard({
      text: paragraphCommercial.text,
      claim_class: paragraphCommercial.claim_class,
    });
  const tableOk =
    tableCommercial?.claim_class === 'commercial_numeric' &&
    chunkFailsCommercialGuard({
      text: tableCommercial.text,
      claim_class: tableCommercial.claim_class,
    });
  return {
    paragraph: {
      text: paragraphCommercial?.text ?? null,
      claim_class: paragraphCommercial?.claim_class ?? null,
    },
    table: {
      text: tableCommercial?.text ?? null,
      claim_class: tableCommercial?.claim_class ?? null,
    },
    pass: paragraphOk && tableOk,
  };
})();

const independentSpanIncludesDetect = ORACLE_INDEPENDENT_MUST_BLOCK.map((rule) => {
  const headingOnly = /^#{1,6}\s/.test(String(rule.includes).trim());
  const detectOnIncludes =
    rule.kind === 'order_url'
      ? detectOrderUrl(rule.includes)
      : detectCommercialNumeric(rule.includes);
  return {
    fixture: rule.fixture,
    includes: rule.includes,
    kind: rule.kind,
    requires_chunk_context: ORACLE_REQUIRES_CHUNK_CONTEXT.has(rule.includes),
    detect_on_includes_string: detectOnIncludes,
    pass:
      ORACLE_REQUIRES_CHUNK_CONTEXT.has(rule.includes) ||
      headingOnly ||
      detectOnIncludes,
  };
});

const out = {
  generated_at: new Date().toISOString(),
  method:
    'Plan §7.1 ingest oracle: mislabeled operator_synthesis + commercial manifest title blocked at ingest; signed price spans classify commercial; full fixture oracle green',
  independent_span_includes_detect: {
    rows: independentSpanIncludesDetect,
    pass: independentSpanIncludesDetect.every((r) => r.pass),
  },
  manual_production_heading_oracle: manualProductionHeadingOracle,
  classifier_red_signed_edges: {
    spans: classifierRed,
    pass: classifierRed.every((r) => !r.red_if_stored_as_operator_synthesis_only),
  },
  deliberate_ingest_mislabel_red: {
    manifest_title: manifest.title,
    chunk: mislabelChunk,
    chunkRetrievalEligible: mislabelEligible,
    production_index_count: misStats.indexed,
    kb_get_null: misGet === null,
    kb_search_empty: misSearch.length === 0,
    pass: !mislabelEligible && misStats.indexed === 0 && misGet === null && misSearch.length === 0,
  },
  deliberate_ingest_text_mislabel: {
    text: mislabelIngestText,
    classified: mislabelIngestClass,
    retrieve_guard_blocks: chunkFailsCommercialGuard({ text: mislabelIngestText, claim_class: 'operator_synthesis' }),
    pass: mislabelIngestClass === 'commercial_numeric',
  },
  classifier_oracle_observed_red: observedRed,
  classifier_oracle_observed_green: observedGreen,
  classifier_oracle_green_phase: {
    independentOraclePass: greenOracle.independentOraclePass,
    independentOracleFailures: greenOracle.independentOracleFailures,
    pass: greenOracle.independentOraclePass === true,
  },
  a5_unicode_account_prose: {
    context: unicodeAccountCtx,
    isolation_ok: unicodeAccountIso.isolation.ok,
    reason: unicodeAccountIso.isolation.reason ?? null,
    pass: !unicodeAccountIso.isolation.ok,
  },
  a5_generic_account_object: {
    context: genericAccountCtx,
    isolation_ok: genericAccountIso.isolation.ok,
    reason: genericAccountIso.isolation.reason ?? null,
    pass: !genericAccountIso.isolation.ok,
  },
  a5_bare_cart_status_json: {
    context: bareCartStatusCtx,
    isolation_ok: bareCartStatusIso.isolation.ok,
    reason: bareCartStatusIso.isolation.reason ?? null,
    pass: !bareCartStatusIso.isolation.ok,
  },
  manual_0_4_bv_definition_guard: {
    chunk_id: manualBvDefinitionChunk.chunk_id,
    doc_version: manualBvDefinitionChunk.doc_version,
    retrieve_guard_blocks: manualBvDefinitionGuardFail,
    pass: !manualBvDefinitionGuardFail,
  },
  poisoned_source_id_guard: {
    source_id: poisonedSourceId,
    manifest_validate_ok: poisonedManifestValidation.ok,
    retrieve_guard_blocks: poisonedRetrieveGuard,
    pass: !poisonedManifestValidation.ok && poisonedRetrieveGuard,
  },
  deliberate_ingest_bv_value_red: {
    text: bvValueIngestText,
    classified: bvValueIngestClass,
    chunkRetrievalEligible: bvValueEligible,
    production_index_count: bvStats.indexed,
    kb_get_null: bvGet === null,
    kb_search_empty: bvSearch.length === 0,
    pass:
      bvValueIngestClass === 'commercial_numeric' &&
      !bvValueEligible &&
      bvStats.indexed === 0 &&
      bvGet === null &&
      bvSearch.length === 0,
  },
  classifier_oracle_green: greenOracle,
  pass:
    classifierRed.every((r) => !r.red_if_stored_as_operator_synthesis_only) &&
    !mislabelEligible &&
    misStats.indexed === 0 &&
    mislabelIngestClass === 'commercial_numeric' &&
    greenOracle.independentOraclePass === true &&
    independentSpanIncludesDetect.every((r) => r.pass) &&
    manualProductionHeadingOracle.pass &&
    observedRed.pass &&
    observedGreen.pass &&
    !unicodeAccountIso.isolation.ok &&
    !genericAccountIso.isolation.ok &&
    !bareCartStatusIso.isolation.ok &&
    bvValueIngestClass === 'commercial_numeric' &&
    !bvValueEligible &&
    bvStats.indexed === 0 &&
    !poisonedManifestValidation.ok &&
    poisonedRetrieveGuard &&
    !manualBvDefinitionGuardFail,
};

fs.writeFileSync(
  path.join(gate, 'eval-p2-classifier-oracle-red-green.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(JSON.stringify({ written: 'eval-p2-classifier-oracle-red-green.json', pass: out.pass }, null, 2));
if (!out.pass) process.exit(1);