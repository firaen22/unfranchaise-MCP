#!/usr/bin/env node
/**
 * Structured finding ratings (TypeSafe citation-check pattern: code-owned rubric + evidence ids).
 * No API key required; mirrors Choice/Noul gates for prioritization.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

const FINDINGS = [
  {
    id: 'sol-F1-ch19-scope',
    source: 'sol',
    severity: 'high',
    rows: ['p1-001', 'p1-017', 'p1-025'],
    criterion: 'A2',
    actionable: true,
    fix: 'observed_outcome must quote MH/comp-plan/business-opportunity scope from manual_ch_19#3',
    effort: 'low',
    block_phase2: false,
    status: 'resolved_in_csv_2026-11-14',
  },
  {
    id: 'sol-F2-a5-generation-messages',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: true,
    fix: 'Block prior tool/cart content in generationMessages before kb_search; capture in gate bundle',
    effort: 'medium',
    block_phase2: false,
    status: 'resolved_generation_context_json',
  },
  {
    id: 'sol-F3-p1-027-outreach',
    source: 'sol',
    severity: 'medium',
    rows: ['p1-027'],
    criterion: 'A6',
    actionable: true,
    fix: 'Cite substantive 02-B2B USP section only; b2b-prospect headings are scaffold not outreach copy',
    effort: 'low',
    block_phase2: false,
    status: 'resolved_usp_section_only',
  },
  {
    id: 'sol-F4-a6-log',
    source: 'sol',
    severity: 'low',
    criterion: 'A6',
    actionable: true,
    fix: 'Failure log: obsolete query may rank cur_1; obs_1 get null',
    effort: 'low',
    block_phase2: false,
  },
];

const ratings = FINDINGS.map((f) => ({
  ...f,
  priority: f.block_phase2 ? (f.severity === 'high' ? 1 : 2) : 3,
  implement_now: f.actionable && f.effort !== 'high',
  noul_block_phase2: f.block_phase2 ? 0.92 : 0.35,
  citation_check: f.actionable
    ? 'fix_verifiable_against_corpus_or_harness'
    : 'needs_new_capture',
}));

const out = {
  generated_at: new Date().toISOString(),
  method:
    'TypeSafe citation-check rubric (local); Jev API not invoked — no TYPESAFE_API_KEY in environment',
  findings: ratings,
  recommended_order: ratings
    .filter((r) => r.implement_now)
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.id),
};

fs.writeFileSync(
  path.join(gate, 'eval-p1-week1-typesafe-findings-rating.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(JSON.stringify({ written: 'eval-p1-week1-typesafe-findings-rating.json', order: out.recommended_order }, null, 2));