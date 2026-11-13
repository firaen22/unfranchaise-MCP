import { Actions, actionUrl, placementFormsUrls } from './urls.js';
import {
  getAction,
  parseCartSummary,
  parseForm1000Summary,
  parseProductPage,
  parseSearchResults,
  cookieStatus,
  loadSessionCookie,
  unfFetch,
} from './client.js';
import {
  volumeRulesMarkdown,
  form1000QualifyingOrders,
  sammQualificationSummary,
  ibvPercentApprox,
  skuVariant,
  ibvSkuFromBv,
} from './volume.js';
import { optimiseForm1000Input } from './form1000-optimise.js';
import {
  formatQuartersReport,
  quarterWindowFromQuarterDate,
  readQuartersDocument,
  recordQuarter,
} from './form1000-quarters.js';
import {
  parsePositiveIntQty,
  requireNonEmptyString,
  assertHttpOk,
  publicErrorMessage,
  parseFiniteNumber,
  parseBooleanStrict,
  parseFiniteNumberList,
} from './validate.js';
import { parseCheckoutPage, checkoutMapBlocker } from './parse-checkout.js';
import {
  NOT_LIVE_SYNTHETIC_FIELD_NAMES,
  fixtureDirFromMeta,
  loadLiveBillShip,
  loadLiveExpressPay,
  resolveOfflineBillShip,
} from './billship-fixtures.js';
import { redactSessionTokensInUrl, redactToolPayload } from './redact.js';
import {
  NAVIGATION_ACTIONS,
  XHR_PATTERNS,
  INFERRED_CHECKOUT_POSTS,
  CONFIRMED_LIVE_ACTIONS,
  UNVERIFIED_CHECKOUT_ACTIONS,
  networkPatternsMarkdown,
} from './network-patterns.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_DEFINITIONS = [
  {
    name: 'unf_session_status',
    description: 'Check whether UNF_COOKIE / UNF_COOKIE_FILE is configured (no network).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'unf_volume_explain',
    description: 'Return markdown summary of IBV/BV, SAMM, and Form 1000 calculation rules from site research.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'unf_volume_calculate',
    description: 'Pure helpers: form1000 check, SAMM summary, IBV%, SKU variant.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['form1000', 'samm', 'ibv_percent', 'sku_variant'],
        },
        productTotalsHkd: { type: 'array', items: { type: 'number' } },
        ibv: { type: 'number' },
        bvExclusive: { type: 'number' },
        hasHsl: { type: 'boolean' },
        ibvPoints: { type: 'number' },
        ucPriceHkd: { type: 'number' },
        sku: { type: 'string' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'unf_url_build',
    description: 'Build hk.unfranchise.com URLs for known actions (no network).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'e.g. shopping.unfOrdering, shopping.unfProduct&skuID=HK1410',
        },
        params: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['action'],
    },
  },
  {
    name: 'unf_report_url',
    description: 'Build the report criteria URL for a report name (no network).',
    inputSchema: {
      type: 'object',
      properties: {
        reportName: { type: 'string' },
      },
      required: ['reportName'],
    },
  },
  {
    name: 'unf_placement_forms_url',
    description: 'Build placement-related form URLs from FINDINGS (no network and no submit).',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['designated', 'auto', 'ibdc'],
          description: 'Optional placement form; omit to return all three URLs.',
        },
      },
    },
  },
  {
    name: 'unf_search_products',
    description: 'GET catalog search (requires session cookie).',
    inputSchema: {
      type: 'object',
      properties: { keyword: { type: 'string' } },
      required: ['keyword'],
    },
  },
  {
    name: 'unf_get_product',
    description: 'GET product detail page and parse BV/IBV/UC (requires session cookie).',
    inputSchema: {
      type: 'object',
      properties: { skuID: { type: 'string' } },
      required: ['skuID'],
    },
  },
  {
    name: 'unf_cart_view',
    description: 'GET cart and parse totals (requires session cookie).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'unf_cart_add',
    description:
      'Add product to cart. Default dry-run returns URL and params only; confirm:true performs POST (site uses JS forms — may need browser for some SKUs).',
    inputSchema: {
      type: 'object',
      properties: {
        skuID: { type: 'string' },
        qty: { type: 'number', minimum: 1, default: 1 },
        confirm: { type: 'boolean', default: false },
      },
      required: ['skuID'],
    },
  },
  {
    name: 'unf_cart_update',
    description:
      'Update or remove a cart line. Default dry-run returns the shopping.unfUpdateCart URL and params; confirm:true performs the POST.',
    inputSchema: {
      type: 'object',
      properties: {
        skuID: { type: 'string' },
        qty: {
          type: 'number',
          minimum: 1,
          default: 1,
          description: 'New quantity (1–999). Ignored when remove is true.',
        },
        remove: { type: 'boolean', default: false, description: 'Remove this line instead of updating its quantity.' },
        confirm: { type: 'boolean', default: false },
      },
      required: ['skuID'],
    },
  },
  {
    name: 'unf_form1000_status',
    description: 'GET Form 1000 page and parse quarter list + summary (read-only; requires session cookie).',
    inputSchema: {
      type: 'object',
      properties: { quarterDate: { type: 'string', description: 'Optional quarter option value' } },
    },
  },
  {
    name: 'unf_form1000_draft',
    description: 'Return a read-only markdown checklist for Form 1000 fields and rules (no network, no submit).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'unf_form1000_optimise',
    description:
      'Dry-run only: choose two receipts of at least HKD 1500 product total each from a local draft sheet of unplaced products. confirm is ignored; this tool never calls unfFetch, uses network, assigns or submits Form 1000, or places an order.',
    inputSchema: {
      type: 'object',
      properties: {
        fixturePath: { type: 'string', description: 'Local CSV draft sheet path' },
        csvText: { type: 'string', description: 'CSV draft sheet text' },
        rows: {
          type: 'array',
          items: { type: 'object' },
          description: 'Draft sheet rows. Product amounts exclude shipping, tax, and fees.',
        },
      },
    },
  },
  {
    name: 'unf_form1000_quarters',
    description:
      'Read or record Form 1000 quarter windows locally (start, end, and 11:59 pm US Eastern deadline). Example fixture only unless a file path is given. No network and no personal balances.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'parse', 'record'] },
        quarterDate: { type: 'string', description: 'DD/MM/YYYY-DD/MM/YYYY' },
        filePath: { type: 'string', description: 'Local quarter JSON path. Omit on read to show the example fixture.' },
        confirm: {
          type: 'boolean',
          default: false,
          description: 'Required true to write with action record',
        },
      },
    },
  },
  {
    name: 'unf_checkout_billship_map',
    description:
      'Bill/ship field map (read-only; does not place an order). Live GET orders.unfBillShip only when the response is a real checkout form. Login-wall and empty-cart HTML are not the map. Offline baseline is the redacted 13 Nov 2026 signed-in browser capture, not the synthetic fixture. The payload also includes that capture’s express-pay map.',
    inputSchema: {
      type: 'object',
      properties: {
        useFixture: {
          type: 'boolean',
          description: 'Skip the network and return the committed redacted live map',
        },
      },
    },
  },
  {
    name: 'unf_network_patterns',
    description: 'Documented navigation/XHR patterns and paths to captured logs (no network).',
    inputSchema: { type: 'object', properties: {} },
  },
];

const LIVE_BLOCKER_HINT = {
  login_required:
    'Network response was login-wall HTML (main.unfLogin&permissionViolation), not a checkout form. Cloudflare cf_clearance / __cf_bm is often bound to the browser TLS fingerprint, so a session cookie is not enough. The signed-in browser map is returned instead.',
  empty_cart:
    'Network response was an empty cart (你的購物車是空的) with the checkout form hidden. The signed-in non-empty-cart map is returned instead.',
  no_checkout_form:
    'Network response had no checkout fields. The signed-in browser map is returned instead.',
};

function textResult(obj) {
  const text =
    typeof obj === 'string' ? obj : JSON.stringify(redactToolPayload(obj), null, 2);
  return { content: [{ type: 'text', text }] };
}

function form1000DraftMarkdown() {
  return [
    '# Form 1000 draft checklist',
    '',
    'Read-only checklist from the available FINDINGS-derived rules. This tool does not fetch, update, assign, or submit anything.',
    '',
    '## Submit actions to review',
    '',
    '- `forms.unf1000Update` — update the Form 1000 draft/header fields.',
    '- `forms.unf1000Assign` — assign qualifying orders to the Form 1000 filing.',
    '',
    '## Fields and checks',
    '',
    '- [ ] `quarterDate` — select the applicable quarter.',
    '- [ ] `filingID` — preserve the filing identifier returned by the Form 1000 page.',
    '- [ ] Selected qualifying orders — at least 2 orders with product total of at least HK$1,500, excluding shipping, tax, and fees.',
    '- [ ] Product-use mix — personal consumption no more than 30%; retail sales at least 70%.',
    '- [ ] Per-order personal consumption — no more than HK$450.',
    '- [ ] Review all values before any operator-controlled submit or assignment step.',
    '',
    '## Safety boundary',
    '',
    'No network request, `forms.unf1000Update` call, or `forms.unf1000Assign` call is made by this draft tool.',
  ].join('\n');
}

export async function callTool(name, args) {
  try {
    switch (name) {
      case 'unf_session_status':
        return textResult(cookieStatus());
      case 'unf_volume_explain':
        return { content: [{ type: 'text', text: volumeRulesMarkdown() }] };
      case 'unf_volume_calculate': {
        const mode = args?.mode;
        if (mode === 'form1000') {
          const totals = parseFiniteNumberList(args?.productTotalsHkd ?? [], 'productTotalsHkd');
          return textResult(form1000QualifyingOrders(totals));
        }
        if (mode === 'samm') {
          return textResult(
            sammQualificationSummary({
              ibv: args?.ibv === undefined ? 0 : parseFiniteNumber(args.ibv, 'ibv', { min: 0 }),
              bvExclusive:
                args?.bvExclusive === undefined ? 0 : parseFiniteNumber(args.bvExclusive, 'bvExclusive', { min: 0 }),
              hasHsl: args?.hasHsl === undefined ? false : parseBooleanStrict(args.hasHsl, 'hasHsl'),
            }),
          );
        }
        if (mode === 'ibv_percent') {
          return textResult({
            percent: ibvPercentApprox(
              parseFiniteNumber(args?.ibvPoints ?? 0, 'ibvPoints', { min: 0 }),
              parseFiniteNumber(args?.ucPriceHkd ?? 0, 'ucPriceHkd', { min: 0 }),
            ),
          });
        }
        if (mode === 'sku_variant') {
          const sku = args?.sku ?? '';
          return textResult({ variant: skuVariant(sku), ibvSku: ibvSkuFromBv(sku) });
        }
        throw new Error(`Unknown mode: ${mode}`);
      }
      case 'unf_url_build': {
        const action = requireNonEmptyString(args?.action, 'action');
        const params = args?.params;
        if (params != null && (typeof params !== 'object' || Array.isArray(params))) {
          throw new Error('params must be a plain object');
        }
        return textResult({ url: actionUrl(action, params ?? {}) });
      }
      case 'unf_report_url': {
        const reportName = String(args?.reportName ?? '').trim();
        if (!reportName) throw new Error('reportName is required');
        return textResult({ url: actionUrl('reports.unfReportCriteria', { reportName }) });
      }
      case 'unf_placement_forms_url': {
        const target = args?.target;
        const urls = placementFormsUrls(target);
        return textResult(target === undefined ? { urls } : { target, url: urls[target] });
      }
      case 'unf_search_products': {
        const keyword = requireNonEmptyString(args?.keyword, 'keyword');
        const { $, status, url } = await getAction(Actions.search, { keyword });
        assertHttpOk(status, 'search');
        return textResult({ status, url, results: parseSearchResults($) });
      }
      case 'unf_get_product': {
        const skuID = requireNonEmptyString(args?.skuID, 'skuID');
        const { $, status, url } = await getAction(Actions.product(skuID));
        assertHttpOk(status, 'get_product');
        return textResult({ status, url, ...parseProductPage($) });
      }
      case 'unf_cart_view': {
        const { $, status, url } = await getAction(Actions.viewCart);
        assertHttpOk(status, 'cart_view');
        return textResult({ status, url, ...parseCartSummary($) });
      }
      case 'unf_cart_add': {
        const skuID = requireNonEmptyString(args?.skuID, 'skuID');
        const qty = parsePositiveIntQty(args?.qty);
        const preview = {
          action: 'add-to-cart',
          skuID,
          qty,
          productUrl: Actions.product(skuID),
          note: 'Live add often uses prodOrderForm POST via page JS; prefer browser automation if POST fails.',
        };
        if (args?.confirm !== true) {
          return textResult({
            dryRun: true,
            message: `Dry-run: cart_add sku=${skuID} qty=${qty}. Set confirm: true to execute (still your responsibility).`,
            preview: { ...preview, wouldMutate: true },
          });
        }
        const productUrl = Actions.product(skuID);
        const { html, status, url } = await unfFetch(productUrl);
        assertHttpOk(status, 'cart_add prefetch');
        const body = new URLSearchParams({
          prdCode: skuID,
          prdQty1: String(qty),
          autoShipSelected: '0',
        });
        const post = await unfFetch(productUrl, { method: 'POST', body });
        assertHttpOk(post.status, 'cart_add post');
        return textResult({ status, url, postStatus: post.status, preview, postUrl: post.url, htmlLength: html.length });
      }
      case 'unf_cart_update': {
        const skuID = requireNonEmptyString(args?.skuID, 'skuID');
        const remove = args?.remove === undefined ? false : parseBooleanStrict(args.remove, 'remove');
        const qty = remove ? 0 : parsePositiveIntQty(args?.qty ?? 1);
        const params = { skuID, qty, remove: remove ? '1' : '0' };
        const updateUrl = actionUrl(Actions.updateCart, params);
        const preview = {
          action: 'update-cart',
          skuID,
          qty,
          remove,
          method: 'POST',
          url: updateUrl,
          params,
          wouldMutate: true,
        };
        if (args?.confirm !== true) {
          return textResult({
            dryRun: true,
            message: `Dry-run: cart_update sku=${skuID} qty=${qty}${remove ? ' remove=true' : ''}. Set confirm: true to execute (still your responsibility).`,
            preview,
          });
        }
        const post = await unfFetch(updateUrl, {
          method: 'POST',
          body: new URLSearchParams(params),
        });
        assertHttpOk(post.status, 'cart_update post');
        return textResult({ status: post.status, url: post.url, preview, htmlLength: post.html.length });
      }
      case 'unf_form1000_draft':
        return { content: [{ type: 'text', text: form1000DraftMarkdown() }] };
      case 'unf_form1000_optimise':
        // Deliberately call the pure local planner directly. Do not add a confirm/network branch here.
        return textResult(optimiseForm1000Input(args ?? {}));
      case 'unf_form1000_quarters': {
        const action = args?.action ?? 'read';
        if (action === 'read') {
          const payload = readQuartersDocument(args?.filePath);
          return textResult({ ...payload, report: formatQuartersReport(payload), submitted: false, placedOrder: false });
        }
        if (action !== 'parse' && action !== 'record') {
          throw new Error('action must be read, parse, or record');
        }
        const quarterDate = requireNonEmptyString(args?.quarterDate, 'quarterDate');
        const record = quarterWindowFromQuarterDate(quarterDate);
        if (action === 'record' && args?.filePath) {
          if (args?.confirm !== true) {
            return textResult({
              dryRun: true,
              message: `Dry-run: form1000_quarters record quarterDate=${quarterDate}. Set confirm: true to write the quarter file.`,
              preview: {
                action: 'form1000_quarters record',
                filePath: args.filePath,
                quarterDate,
                wouldMutate: true,
              },
              network: false,
              submitted: false,
              placedOrder: false,
            });
          }
          const document = recordQuarter(args.filePath, quarterDate);
          return textResult({
            saved: true,
            network: false,
            submitted: false,
            placedOrder: false,
            personalBalances: null,
            document,
            report: formatQuartersReport({ document }),
          });
        }
        return textResult({
          saved: false,
          network: false,
          submitted: false,
          placedOrder: false,
          personalBalances: null,
          record,
          report: formatQuartersReport({ document: { example: false, quarters: [record] } }),
        });
      }
      case 'unf_form1000_status': {
        const extra = args?.quarterDate ? { quarterDate: args.quarterDate } : {};
        const { $, status, url } = await getAction(Actions.form1000, extra);
        assertHttpOk(status, 'form1000_status');
        return textResult({ status, url, ...parseForm1000Summary($) });
      }
      case 'unf_checkout_billship_map': {
        const metaUrl = fileURLToPath(import.meta.url);
        const fixtureDir = fixtureDirFromMeta(metaUrl);
        const capturedJson = path.join(fixtureDir, 'captured', 'bill_ship.json');
        if (args?.useFixture === true) {
          return textResult(loadLiveBillShip(fixtureDir));
        }
        if (!loadSessionCookie()) {
          let captured = null;
          if (fs.existsSync(capturedJson)) {
            try {
              captured = JSON.parse(fs.readFileSync(capturedJson, 'utf8'));
            } catch {
              captured = null;
            }
          }
          return textResult(resolveOfflineBillShip(fixtureDir, captured));
        }
        const { $, status, url, html } = await getAction(Actions.billShip);
        assertHttpOk(status, 'checkout_billship_map');
        const parsed = parseCheckoutPage($);
        const blocker = checkoutMapBlocker(parsed, url);
        if (blocker) {
          const offline = loadLiveBillShip(fixtureDir);
          return textResult({
            ...offline,
            networkBlocked: true,
            blocker,
            networkStatus: status,
            networkUrl: redactSessionTokensInUrl(url),
            hint: `${LIVE_BLOCKER_HINT[blocker]} ${offline.hint}`,
          });
        }
        return textResult({
          source: 'network',
          live: true,
          status,
          url: redactSessionTokensInUrl(url),
          htmlLength: html.length,
          ...parsed,
          expressPayFixture: loadLiveExpressPay(fixtureDir),
          notLiveSyntheticNames: [...NOT_LIVE_SYNTHETIC_FIELD_NAMES],
          hint: 'Live bill-ship parse. expressPayFixture is the committed redacted map, not a second fetch. Place-order is not automated.',
        });
      }
      case 'unf_network_patterns': {
        const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
        const captureLog = path.join(fixtureDir, 'captured', 'network-log.json');
        const xhrLog = path.join(fixtureDir, 'captured', 'xhr-log.json');
        const payload = {
          markdown: networkPatternsMarkdown(),
          navigation: NAVIGATION_ACTIONS,
          xhrClasses: XHR_PATTERNS,
          confirmedLiveActions: CONFIRMED_LIVE_ACTIONS,
          unverifiedCheckoutActions: UNVERIFIED_CHECKOUT_ACTIONS,
          inferredCheckoutPosts: INFERRED_CHECKOUT_POSTS,
          capturedNetworkLog: fs.existsSync(captureLog) ? 'fixtures/captured/network-log.json' : null,
          capturedXhrLog: fs.existsSync(xhrLog) ? 'fixtures/captured/xhr-log.json' : null,
        };
        return textResult(payload);
      }
      default:
        return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  } catch (e) {
    if (e.code === 'UNF_NO_COOKIE' || e.code === 'UNF_BAD_COOKIE') {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
    if (e.code === 'UNF_HTTP' || e.code === 'UNF_BAD_URL') {
      return { isError: true, content: [{ type: 'text', text: publicErrorMessage(e) }] };
    }
    return { isError: true, content: [{ type: 'text', text: publicErrorMessage(e) }] };
  }
}
