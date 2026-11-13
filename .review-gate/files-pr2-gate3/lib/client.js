import fs from 'node:fs';
import { load as loadCheerio } from 'cheerio';
import { actionUrl } from './urls.js';
import { assertValidCookie, assertUnfUrl, parseLocaleNumber } from './validate.js';

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
  let method = opts.method ?? 'GET';
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
      if (res.status === 303 || (res.status === 301 || res.status === 302) && method === 'POST') {
        method = 'GET';
        body = undefined;
        delete headers['Content-Type'];
      }
      currentUrl = assertUnfUrl(new URL(loc, currentUrl).toString());
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
  const empty = /購物車是空的/.test(text);
  const ibvCap = text.match(/IBV 上限為\s*([\d.]+)/);
  const ibvTotal = text.match(/IBV總數\s*([\d,.]+)/);
  const bvTotal = text.match(/業績點數總額\s*([\d,.]+)/);
  return {
    empty,
    ibvCapNotice: ibvCap ? parseLocaleNumber(ibvCap[1]) : null,
    ibvTotal: ibvTotal ? parseLocaleNumber(ibvTotal[1]) : null,
    bvTotal: bvTotal ? parseLocaleNumber(bvTotal[1]) : null,
    title: $('title').text().trim(),
  };
}

export function parseProductPage($) {
  const title = $('title').text().trim();
  const body = $.text();
  const bv = body.match(/\bBV\s*([\d.]+)/);
  const ibv = body.match(/\bIBV\s*([\d.]+)/);
  const pct = body.match(/IBV\s*[\d.]+\s*\(([\d.]+)%\)/);
  const uc = body.match(/UC HK\$\s*([\d,]+\.?\d*)/);
  return {
    title,
    bvPoints: bv ? Number(bv[1]) : null,
    ibvPoints: ibv ? Number(ibv[1]) : null,
    ibvPercent: pct ? Number(pct[1]) : null,
    ucHkd: uc ? Number(uc[1].replace(/,/g, '')) : null,
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
    if (m && name) items.push({ skuID: decodeURIComponent(m[1]), name, href });
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
