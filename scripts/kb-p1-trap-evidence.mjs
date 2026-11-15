#!/usr/bin/env node
/** Capture sanitized MCP + FINDINGS excerpts for P1 trap rows (gate bundle A). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool } from '../lib/tools.js';
import { loadSessionCookie } from '../lib/client.js';
import { parseToolText, sanitizeString } from '../kb/lib/sanitize-mcp-trace.js';
import { readEvalCsv, writeEvalCsv } from '../kb/lib/eval-csv.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repo, '.review-gate');
const cookieFile = process.env.UNF_COOKIE_FILE ?? path.join(process.env.HOME ?? '', '.secrets/unfranchaise.cookie');

async function tool(name, args = {}) {
  try {
    const out = await callTool(name, args);
    return { ok: true, tool: name, args, result: await parseToolText(out) };
  } catch (err) {
    return { ok: false, tool: name, args, error: sanitizeString(err.message ?? String(err)) };
  }
}

function findingsExcerpt(startMarker, endMarker) {
  const md = fs.readFileSync(path.join(repo, 'FINDINGS.md'), 'utf8');
  const i = md.indexOf(startMarker);
  if (i < 0) return sanitizeString(md.slice(0, 1200));
  const j = endMarker ? md.indexOf(endMarker, i + startMarker.length) : i + 1400;
  return sanitizeString(md.slice(i, j > i ? j : i + 1400));
}

async function main() {
  const hasSession = Boolean(loadSessionCookie());
  const captured_at = new Date().toISOString();
  const traces = { captured_at, cookie_file_present: hasSession, rows: {} };

  if (hasSession) {
    traces.rows.p1_008 = { eval_id: 'p1-008', calls: [await tool('unf_get_product', { skuID: 'HK1410' })] };
    traces.rows.p1_011 = { eval_id: 'p1-011', calls: [await tool('unf_get_product', { skuID: 'HK1410IBV' })] };
    traces.rows.p1_012 = { eval_id: 'p1-012', calls: [await tool('unf_get_product', { skuID: 'HK1410' })] };
    traces.rows.p1_014 = { eval_id: 'p1-014', calls: [await tool('unf_form1000_status', {})] };
    const cartBefore = await tool('unf_cart_view', {});
    const line = cartBefore.result?.lineItems?.[0];
    if (line?.skuID) {
      await tool('unf_cart_update', { skuID: line.skuID, remove: true, confirm: true });
    }
    traces.rows.p1_015 = {
      eval_id: 'p1-015',
      protocol:
        'clear cart if line present; unf_cart_add HK1410 qty1 confirm; unf_cart_view subtotal',
      calls: [
        cartBefore,
        ...(line?.skuID
          ? [await tool('unf_cart_update', { skuID: line.skuID, remove: true, confirm: true })]
          : []),
        await tool('unf_cart_view', {}),
        await tool('unf_cart_add', { skuID: 'HK1410', qty: 1, confirm: true }),
        await tool('unf_cart_view', {}),
      ],
    };
    traces.rows.p1_023 = {
      eval_id: 'p1-023',
      calls: [
        await tool('unf_get_product', { skuID: 'HK1410' }),
        await tool('unf_get_product', { skuID: 'HK1410IBV' }),
      ],
    };
    traces.rows.p1_016 = {
      eval_id: 'p1-016',
      calls: [await tool('unf_url_build', { action: 'shopping.unfOrdering' })],
    };
    traces.rows.p1_017 = {
      eval_id: 'p1-017',
      calls: [await tool('unf_get_product', { skuID: 'HK1410' })],
    };
  } else {
    traces.skipped_live = 'UNF_COOKIE_FILE missing; MCP rows not re-executed';
  }

  traces.findings = {
    p1_013: {
      eval_id: 'p1-013',
      source: 'FINDINGS.md',
      excerpt: findingsExcerpt('shopping.unfOrdering', '### Related order URLs'),
    },
    p1_024: {
      eval_id: 'p1-024',
      source: 'FINDINGS.md',
      excerpt: findingsExcerpt(
        '**Shop / consumer surface',
        '## 1. Placing an order',
      ),
    },
    p1_028: {
      eval_id: 'p1-028',
      source: 'FINDINGS.md',
      excerpt: findingsExcerpt(
        '**Shop / consumer surface (this account):**',
        'moe.unfMOEPCSelect` | Preferred-customer pick',
      ),
    },
    p1_029_live: {
      eval_id: 'p1-029',
      source: 'FINDINGS.md',
      excerpt: findingsExcerpt('UFO storefront / Shop Global', 'Captured **2026-11-14**'),
    },
  };

  const outPath = path.join(gate, 'eval-p1-week1-trap-mcp-traces.json');
  fs.writeFileSync(outPath, `${JSON.stringify(traces, null, 2)}\n`, 'utf8');

  if (traces.rows.p1_015?.calls?.length) {
    const calls = traces.rows.p1_015.calls;
    const add = calls.find((c) => c.tool === 'unf_cart_add' && c.args?.confirm === true);
    const view = calls.filter((c) => c.tool === 'unf_cart_view').at(-1);
    const ar = add?.result?.addResult;
    const vr = view?.result;
    const observed =
      add?.ok && view?.ok
        ? `unf_cart_add HK1410 qty1 confirm addResult prdBv ${ar?.prdBv ?? '?'} prdRetail ${ar?.prdRetail ?? '?'}; unf_cart_view retailTotalHkd ${vr?.retailTotalHkd} bvTotal ${vr?.bvTotal} lineCount ${vr?.lineCount}`
        : 'p1_015 trap capture failed; see eval-p1-week1-trap-mcp-traces.json';
    const csvPath = path.join(gate, 'eval-p1-week1-scored.csv');
    const { headers, rows } = readEvalCsv(csvPath);
    const row = rows.find((r) => r.id === 'p1-015');
    if (row) {
      row.observed_outcome = observed;
      row.scored_at = captured_at;
      writeEvalCsv(csvPath, headers, rows);
    }
  }

  console.log(JSON.stringify({ written: outPath, live: hasSession }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});