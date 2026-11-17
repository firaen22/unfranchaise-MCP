#!/usr/bin/env node
/**
 * TypeSafe-style finding ratings (local rubric; no Jev API without TYPESAFE_API_KEY).
 * P1 resolved + P2 open items from latest gate blockers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');

const hostWirePath = path.join(gate, 'eval-p2-host-wire.json');
let hostWirePass = false;
if (fs.existsSync(hostWirePath)) {
  try {
    hostWirePass = JSON.parse(fs.readFileSync(hostWirePath, 'utf8')).pass === true;
  } catch {
    hostWirePass = false;
  }
}

const FINDINGS = [
  {
    id: 'sol-F1-ch19-scope',
    phase: 'p1',
    source: 'sol',
    severity: 'high',
    rows: ['p1-001', 'p1-017', 'p1-025'],
    criterion: 'A2',
    actionable: false,
    block_phase2: false,
    status: 'resolved_in_csv',
    effort: 'low',
  },
  {
    id: 'sol-F2-a5-generation-messages',
    phase: 'p1',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: false,
    block_phase2: false,
    status: 'resolved_generation_context_json',
    effort: 'medium',
  },
  {
    id: 'sol-F3-p1-027-outreach',
    phase: 'p1',
    source: 'sol',
    severity: 'medium',
    rows: ['p1-027'],
    criterion: 'A6',
    actionable: false,
    block_phase2: false,
    status: 'resolved_usp_section_only',
    effort: 'low',
  },
  {
    id: 'sol-F4-a6-log',
    phase: 'p1',
    source: 'sol',
    severity: 'low',
    criterion: 'A6',
    actionable: false,
    block_phase2: false,
    status: 'resolved_edge_p1_020_022',
    effort: 'low',
  },
  {
    id: 'sol-P2-F1-mcp-op-context-wire',
    phase: 'p2',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: true,
    fix: 'kb-server.js passes UNF_KB_OP_CONTEXT into handleKbTool; kb-p2-host-wire-evidence.json green/red',
    block_phase2: true,
    status: hostWirePass ? 'resolved_kb_server_env_UNF_KB_OP_CONTEXT' : 'pending_wire',
    effort: 'low',
  },
  {
    id: 'sol-P2-F2-host-generation-boundary',
    phase: 'p2',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: true,
    fix: 'eval-p2-host-wire.json: simulated host generationMessages + MCP env op context captures',
    block_phase2: true,
    status: hostWirePass ? 'resolved_eval_p2_host_wire_json' : 'pending_wire',
    effort: 'medium',
  },
  {
    id: 'grok-P2-F1-cart-field-classifier',
    phase: 'p2',
    source: 'grok',
    severity: 'major',
    criterion: 'A1',
    actionable: false,
    block_phase2: false,
    status: 'resolved_classify_patterns',
    effort: 'low',
  },
  {
    id: 'sol-P2-F3-json-key-commercial',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'normalizeForDetection unwraps JSON keys; classify tests for bvPoints/srpHkd/retailTotalHkd blobs',
    block_phase2: true,
    status: 'resolved_json_key_normalize',
    effort: 'low',
  },
  {
    id: 'sol-P2-F4-structured-generation-content',
    phase: 'p2',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: true,
    fix: 'flattenMessageContent in kb-tool-capture + canary',
    block_phase2: true,
    status: 'resolved_message_content_flatten',
    effort: 'low',
  },
  {
    id: 'sol-P2-F5-live-host-generation-capture',
    phase: 'p2',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: false,
    fix: 'Host-owned: kb MCP has no generate tool; UNF_KB_OP_CONTEXT + capture harness is contract',
    block_phase2: false,
    status: 'acknowledged_sidecar_no_generate',
    effort: 'docs',
  },
  {
    id: 'sol-P2-F6-p1-citation-spans-bundle',
    phase: 'p2',
    source: 'sol',
    severity: 'high',
    criterion: 'A2',
    actionable: true,
    fix: 'Attach eval-p1-week1-host-answers.md to P2 gate brief',
    block_phase2: true,
    status: fs.existsSync(path.join(gate, 'eval-p1-week1-host-answers.md'))
      ? 'resolved_host_answers_in_p2_bundle'
      : 'pending_kb_p1_gate_bundle',
    effort: 'low',
  },
  {
    id: 'sol-P2-F7-json-string-commercial',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'normalize unwraps :\"123\" numeric strings',
    block_phase2: true,
    status: 'resolved_quoted_numeric_normalize',
    effort: 'low',
  },
  {
    id: 'sol-P2-F8-snippet-path-leak',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'index skips commercial vault paths; retrieve re-snippet from chunk text',
    block_phase2: true,
    status: 'resolved_snippet_guard',
    effort: 'medium',
  },
  {
    id: 'sol-P2-F9-mcp-transport',
    phase: 'p2',
    source: 'sol',
    severity: 'high',
    criterion: 'A5',
    actionable: true,
    fix: 'eval-p2-mcp-transport.json stdio list_tools + kb_search',
    block_phase2: true,
    status: fs.existsSync(path.join(gate, 'eval-p2-mcp-transport.json'))
      ? 'resolved_mcp_stdio_harness'
      : 'pending_transport',
    effort: 'medium',
  },
  {
    id: 'sol-P2-F10-json-numeric-edges',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'FP-A1-json-numeric-edges in eval-p2-typesafe-fix-plan.json',
    block_phase2: true,
    status: 'resolved_json_numeric_edges_r5',
    effort: 'low',
  },
  {
    id: 'sol-P2-F11-nested-tool-result',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A5',
    actionable: true,
    fix: 'FP-A5-nested-flatten',
    block_phase2: true,
    status: 'resolved_recursive_flatten_r5',
    effort: 'low',
  },
  {
    id: 'grok-P2-M1-canary-allowlist',
    phase: 'p2',
    source: 'grok',
    severity: 'major',
    criterion: 'A5',
    actionable: true,
    fix: 'FP-A5-classifier-on-context + FP-A5-envelope-expand',
    block_phase2: true,
    status: 'resolved_canary_classifier_context_r5',
    effort: 'medium',
  },
  {
    id: 'sol-P2-F12-srp-value-is',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'FP-A1-srp-value-is',
    block_phase2: true,
    status: 'resolved_srp_value_is_pattern',
    effort: 'low',
  },
  {
    id: 'sol-P2-F13-details-name-decoy',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A5',
    actionable: true,
    fix: 'FP-A5-details-name-decoy',
    block_phase2: true,
    status: 'resolved_details_envelope_strip',
    effort: 'low',
  },
  {
    id: 'sol-P2-F14-srp-value-equals',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'FP-A1-srp-value-equals',
    block_phase2: true,
    status: 'resolved_srp_value_equals_pattern',
    effort: 'low',
  },
  {
    id: 'sol-P2-F15-provenance-name-decoy',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A5',
    actionable: true,
    fix: 'FP-A5-top-level-tool-name-parse',
    block_phase2: true,
    status: 'resolved_top_level_tool_name_parse',
    effort: 'low',
  },
  {
    id: 'grok-P2-F2-index-indexed-count',
    phase: 'p2',
    source: 'grok',
    severity: 'low',
    criterion: 'A6',
    actionable: false,
    block_phase2: false,
    status: 'acknowledged_96_of_109_quarantined',
    effort: 'docs',
  },
  {
    id: 'sol-P2-F16-connector-normalizer',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A1',
    actionable: true,
    fix: 'FP-A1-connector-normalizer',
    block_phase2: true,
    status: 'resolved_commercial_connector_re',
    effort: 'medium',
  },
  {
    id: 'grok-P2-F16-kb-citation-schema',
    phase: 'p2',
    source: 'grok',
    severity: 'major',
    criterion: 'A5',
    actionable: true,
    fix: 'FP-A5-kb-tool-result-citation-only',
    block_phase2: true,
    status: 'resolved_kb_inner_retrieval_schema',
    effort: 'medium',
  },
  {
    id: 'sol-P2-F17-portal-in-query',
    phase: 'p2',
    source: 'sol',
    severity: 'critical',
    criterion: 'A5',
    actionable: true,
    fix: 'FP-A5-tool-role-unified-surface',
    block_phase2: true,
    status: 'resolved_tool_role_on_payload_args',
    effort: 'low',
  },
];

const ratings = FINDINGS.map((f) => {
  const closed =
    f.status.startsWith('resolved') || f.status.startsWith('acknowledged') || f.status.startsWith('pending_wire')
      ? !hostWirePass && f.status.startsWith('pending_wire')
      : false;
  const resolved =
    f.status.startsWith('resolved') || f.status.startsWith('acknowledged');
  const openP2 = f.actionable && !resolved && !closed;
  const blockPhase2 = f.block_phase2 && !resolved;
  return {
    ...f,
    block_phase2: blockPhase2,
    priority: blockPhase2 ? (f.severity === 'high' || f.severity === 'major' ? 1 : 2) : 3,
    implement_now: openP2,
    noul_block_phase2: blockPhase2 ? 0.92 : 0.2,
    citation_check: openP2
      ? 'fix_verifiable_against_harness_or_gate_artifact'
      : f.status.startsWith('resolved') || f.status.startsWith('acknowledged')
        ? 'closed'
        : f.status.startsWith('pending_wire')
          ? 'await_kb_p2_host_wire'
          : 'needs_review',
  };
});

const fixPlanPath = path.join(gate, 'eval-p2-typesafe-fix-plan.json');
let fixPlan = null;
if (fs.existsSync(fixPlanPath)) {
  try {
    fixPlan = JSON.parse(fs.readFileSync(fixPlanPath, 'utf8'));
  } catch {
    fixPlan = null;
  }
}

const out = {
  generated_at: new Date().toISOString(),
  method:
    'TypeSafe citation-check rubric (local); Jev not invoked — set TYPESAFE_API_KEY to rate via API',
  fix_plan: fixPlan,
  findings: ratings,
  recommended_order: ratings
    .filter((r) => r.implement_now)
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.id),
  phase2_open_blockers: ratings.filter((f) => f.phase === 'p2' && f.block_phase2 && f.status === 'open').map((f) => f.id),
};

fs.writeFileSync(
  path.join(gate, 'eval-p2-typesafe-findings-rating.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(JSON.stringify({ written: 'eval-p2-typesafe-findings-rating.json', ...out }, null, 2));