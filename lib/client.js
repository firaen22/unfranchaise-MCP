import fs from 'node:fs';
import { load as loadCheerio } from 'cheerio';
import { actionUrl } from './urls.js';
import {
  assertSafePostRedirect,
  assertSafeReadRedirect,
  assertValidCookie,
  assertUnfUrl,
  parseLocaleNumber,
} from './validate.js';

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function loadSessionCookie() {
  const direct = process.env.UNF_COOKIE?.trim();
  if (direct) return assertValidCookie(direct);
  const file = process.env.UNF_COOKIE_FILE?.trim();
  if (file && fs.existsSync(file)) {
    return assertValidCookie(fs.readFileSync(file, 'utf8').trim());
  }
  return null;
}

export function cookieStatus() {
  const c = loadSessionCookie();
  if (!c) {
    return {
      configured: false,
      hint: 'Set UNF_COOKIE or UNF_COOKIE_FILE to a session cookie string after logging in at hk.unfranchise.com',
    };
  }
  return { configured: true, length: c.length };
}

/**
 * @param {string} url
 * @param {{ method?: string, body?: URLSearchParams|FormData, cookie?: string }} opts
 */
export async function unfFetch(url, opts = {}) {
  const cookie = opts.cookie ?? loadSessionCookie();
  if (!cookie) {
    const err = new Error('No session cookie. Set UNF_COOKIE or UNF_COOKIE_FILE.');
    err.code = 'UNF_NO_COOKIE';
    throw err;
  }
  const headers = {
    'User-Agent': DEFAULT_UA,
    Cookie: cookie,
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  };
  let method = String(opts.method ?? 'GET').toUpperCase();
  let body = opts.body;
  if (body) {
    if (body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  let currentUrl = assertUnfUrl(url);
  let res;
  const maxHops = 8;
  for (let hop = 0; hop < maxHops; hop++) {
    const init = { method, headers, redirect: 'manual' };
    if (body != null && method !== 'GET' && method !== 'HEAD') init.body = body;
    res = await fetch(currentUrl, init);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        throw Object.assign(new Error(`Redirect without Location (HTTP ${res.status}).`), {
          code: 'UNF_HTTP',
          status: res.status,
        });
      }
      if (method === 'POST' && (res.status === 303 || res.status === 301 || res.status === 302)) {
        method = 'GET';
        body = undefined;
        delete headers['Content-Type'];
      }
      const nextUrl = assertUnfUrl(new URL(loc, currentUrl).toString());
      currentUrl = method === 'POST' ? assertSafePostRedirect(nextUrl) : assertSafeReadRedirect(nextUrl);
      continue;
    }
    break;
  }
  if (res.status >= 300 && res.status < 400) {
    throw Object.assign(new Error('Too many redirects.'), { code: 'UNF_HTTP' });
  }
  const finalUrl = assertUnfUrl(currentUrl);
  const text = await res.text();
  return { status: res.status, url: finalUrl, html: text, $: loadCheerio(text) };
}

export async function getAction(action, extraParams = {}) {
  const url =
    typeof action === 'string' && action.startsWith('https://')
      ? assertUnfUrl(action)
      : actionUrl(action, extraParams);
  return unfFetch(url);
}

export function parseCartSummary($) {
  const text = $.text();
  const ibvCap = text.match(/IBV 上限為\s*([\d.]+)/);
  const ibvTotal = text.match(/IBV總數\s*([\d,.]+)/);
  const bvMatch = text.match(/業績點數總額[:：\s]*([\d,.]+)/);
  const retailMatch = text.match(/零售總額[:：\s]*HK\$?\s*([\d,]+\.?\d*)/);
  const wholesaleMatch = text.match(/超連鎖成本價[:：\s]*HK\$?\s*([\d,]+\.?\d*)/);
  const retailTotalHkd = retailMatch ? parseLocaleNumber(retailMatch[1]) : null;
  const wholesaleTotalHkd = wholesaleMatch ? parseLocaleNumber(wholesaleMatch[1]) : null;
  const bvTotal = bvMatch ? parseLocaleNumber(bvMatch[1]) : null;
  const hasSubtotal =
    (retailTotalHkd != null && retailTotalHkd > 0) ||
    (wholesaleTotalHkd != null && wholesaleTotalHkd > 0) ||
    (bvTotal != null && bvTotal > 0);
  const empty = !hasSubtotal && /你的購物車是空的/.test(text);

  const lineItems = [];
  const root$ = $;
  root$('a[href*="skuID="]').each((_, el) => {
    const href = root$(el).attr('href') ?? '';
    const m = href.match(/skuID=([^&]+)/);
    if (!m) return;
    let skuID = m[1];
    try {
      skuID = decodeURIComponent(m[1]);
    } catch {
      /* keep */
    }
    const name = root$(el).text().trim();
    if (!name) return;
    if (lineItems.some((x) => x.skuID === skuID)) return;
    lineItems.push({ skuID, name });
  });

  return {
    empty,
    ibvCapNotice: ibvCap ? parseLocaleNumber(ibvCap[1]) : null,
    ibvTotal: ibvTotal ? parseLocaleNumber(ibvTotal[1]) : null,
    bvTotal,
    retailTotalHkd,
    wholesaleTotalHkd,
    lineCount: lineItems.length,
    lineItems,
    title: $('title').text().trim(),
  };
}

/** Live add uses orders.unfAddCartAJAX (product page POST to unfProduct does not add lines). */
export async function unfAddToCartAjax(skuID, qty, { formReferer = 'shopping.unfProduct' } = {}) {
  const cookie = loadSessionCookie();
  if (!cookie) {
    const err = new Error('No session cookie. Set UNF_COOKIE or UNF_COOKIE_FILE.');
    err.code = 'UNF_NO_COOKIE';
    throw err;
  }
  const url = actionUrl('orders.unfAddCartAJAX', {
    contentPrefix: 'orders-',
    formReferer,
  });
  const body = new URLSearchParams({
    prdCode: String(skuID),
    prdCnt: '1',
    prdQty1: String(qty),
  });
  const headers = {
    'User-Agent': DEFAULT_UA,
    Cookie: cookie,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const res = await fetch(url, { method: 'POST', headers, body: body.toString(), redirect: 'manual' });
  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Cart add returned non-JSON.'), {
      code: 'UNF_CART_ADD',
      status: res.status,
      preview: raw.slice(0, 200),
    });
  }
  return { status: res.status, url, json };
}

export function parseProductPage($) {
  const title = $('title').text().trim();
  const body = $.text();
  const formEl = $('form[name=prodOrderForm]');
  const html = $.html();
  const formIdx = html.indexOf('name="prodOrderForm"');
  const productHtml =
    formIdx >= 0 ? html.slice(formIdx, formIdx + 6000) : html.slice(0, 12000);
  const formText = formEl.text();
  const formBlock =
    productHtml ||
    formText ||
    formEl.parent().text() ||
    formEl.closest('section, .product, .c-product').text() ||
    '';
  const volScopes = [...new Set([productHtml, formText, formBlock].filter((t) => t.trim()))];
  const matchVol = (re) => {
    for (const scope of volScopes) {
      const m = scope.match(re);
      if (m) return m;
    }
    return null;
  };
  let bv = matchVol(/\bBV\s*([\d.]+)/);
  let ibv = matchVol(/\bIBV\s*([\d.]+)/);
  if (!bv) {
    const nearSrp = body.match(/SRP[\s\S]{0,200}?\bBV\s*([\d.]+)/i);
    if (nearSrp) bv = nearSrp;
  }
  if (!ibv) {
    const nearSrpI = body.match(/SRP[\s\S]{0,200}?\bIBV\s*([\d.]+)/i);
    if (nearSrpI) ibv = nearSrpI;
  }
  const pct = matchVol(/IBV\s*[\d.]+\s*\(([\d.]+)%\)/) ?? body.match(/IBV\s*[\d.]+\s*\(([\d.]+)%\)/);
  const uc = matchVol(/UC HK\$\s*([\d,]+\.?\d*)/);
  const srpNear = body.match(/SRP[\s\S]{0,48}?HK\$\s*([\d,]+\.?\d*)/);
  const srpHkd = srpNear ? parseLocaleNumber(srpNear[1]) : null;
  const hkdInForm = [...(formBlock.trim() ? formBlock : body).matchAll(/HK\$\s*([\d,]+\.?\d*)/g)].map((m) =>
    parseLocaleNumber(m[1]),
  );
  const uniquePrices = [...new Set(hkdInForm.filter((n) => n != null && !Number.isNaN(n)))];
  let promoPriceHkd = null;
  if (uniquePrices.length >= 2) {
    const sorted = [...uniquePrices].sort((a, b) => a - b);
    promoPriceHkd = sorted[0];
  }
  const retailHkd = uniquePrices.length ? Math.max(...uniquePrices) : srpHkd;
  return {
    title,
    bvPoints: bv ? Number(bv[1]) : null,
    ibvPoints: ibv ? Number(ibv[1]) : null,
    ibvPercent: pct ? Number(pct[1]) : null,
    ucHkd: uc ? Number(uc[1].replace(/,/g, '')) : null,
    srpHkd: srpHkd ?? retailHkd,
    promoPriceHkd,
    promoActive: promoPriceHkd != null && retailHkd != null && promoPriceHkd < retailHkd,
    isIbvSku: /\(IBV\)/.test(body) || /IBV\*/.test(body),
  };
}

export function parseSearchResults($) {
  const items = [];
  const root$ = $;
  root$('a[href*="shopping.unfProduct"]').each((_, el) => {
    const href = root$(el).attr('href') ?? '';
    const m = href.match(/skuID=([^&]+)/);
    const name = root$(el).text().trim();
    if (m && name) {
      let skuID = m[1];
      try {
        skuID = decodeURIComponent(m[1]);
      } catch (err) {
        if (!(err instanceof URIError)) throw err;
      }
      items.push({ skuID, name, href });
    }
  });
  return items;
}

export function parseForm1000Summary($) {
  const text = $.text();
  const quarterSel = $('select[name="quarterDate"], select#quarterDate').first();
  const quarters = [];
  quarterSel.find('option').each((_, o) => {
    const v = $(o).attr('value');
    if (v) quarters.push(v);
  });
  const orderCount = text.match(/訂單數量\s*(\d+)/);
  const unplaced = text.match(/未放置的訂單\s*(\d+)/);
  return {
    title: $('title').text().trim(),
    quarters,
    orderCount: orderCount ? Number(orderCount[1]) : null,
    unplacedOrders: unplaced ? Number(unplaced[1]) : null,
    rule: '≥2 orders with product total ≥ HK$1500 (ex shipping/tax/fees)',
  };
}
