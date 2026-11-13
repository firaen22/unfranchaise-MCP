import { Actions, actionUrl } from './urls.js';
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
import {
  parsePositiveIntQty,
  requireNonEmptyString,
  assertHttpOk,
  publicErrorMessage,
  parseFiniteNumber,
  parseBooleanStrict,
  parseFiniteNumberList,
} from './validate.js';
import { parseCheckoutPage } from './parse-checkout.js';
import {
  CAPTURED_BILL_SHIP_JSON,
  fixtureDirFromMeta,
  loadSyntheticBillShip,
} from './billship-fixtures.js';
import {
  NAVIGATION_ACTIONS,
  XHR_PATTERNS,
  INFERRED_CHECKOUT_POSTS,
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
    name: 'unf_form1000_status',
    description: 'GET Form 1000 page and parse quarter list + summary (read-only; requires session cookie).',
    inputSchema: {
      type: 'object',
      properties: { quarterDate: { type: 'string', description: 'Optional quarter option value' } },
    },
  },
  {
    name: 'unf_checkout_billship_map',
    description:
      'GET orders.unfBillShip and return parsed forms/fields (read-only). Without cookie, returns synthetic baseline from fixtures.',
    inputSchema: {
      type: 'object',
      properties: {
        useFixture: { type: 'boolean', description: 'Force synthetic fixture instead of network' },
      },
    },
  },
  {
    name: 'unf_network_patterns',
    description: 'Documented navigation/XHR patterns and paths to captured logs (no network).',
    inputSchema: { type: 'object', properties: {} },
  },
];

function textResult(obj) {
  return { content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] };
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
      case 'unf_url_build':
        return textResult({ url: actionUrl(args.action, args.params ?? {}) });
      case 'unf_report_url': {
        const reportName = String(args?.reportName ?? '').trim();
        if (!reportName) throw new Error('reportName is required');
        return textResult({ url: actionUrl('reports.unfReportCriteria', { reportName }) });
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
          return textResult(loadSyntheticBillShip(fixtureDir));
        }
        if (!loadSessionCookie()) {
          if (fs.existsSync(capturedJson)) {
            const parsed = JSON.parse(fs.readFileSync(capturedJson, 'utf8'));
            return textResult({
              source: 'captured_fixture',
              live: false,
              capturedPath: CAPTURED_BILL_SHIP_JSON,
              ...parsed,
              hint: 'From local capture; set UNF_COOKIE_FILE for live refresh',
            });
          }
          return textResult(loadSyntheticBillShip(fixtureDir));
        }
        const { $, status, url, html } = await getAction(Actions.billShip);
        const parsed = parseCheckoutPage($);
        if (parsed.stepHints.includes('login_required')) {
          return textResult({
            source: 'network',
            live: true,
            status,
            url,
            loginRequired: true,
            ...parsed,
            hint: 'Session expired — refresh cookie',
          });
        }
        assertHttpOk(status, 'checkout_billship_map');
        return textResult({
          source: 'network',
          live: true,
          status,
          url,
          htmlLength: html.length,
          ...parsed,
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
