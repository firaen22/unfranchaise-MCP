/**
 * Documented hk.unfranchise.com request patterns.
 * Confirmed rows are from the 13 Nov 2026 (Asia/Hong_Kong) signed-in browser session.
 * Document GET log: `npm run capture` → fixtures/captured/network-log.json (often a Cloudflare login wall).
 * Async XHR log: `npm run capture:xhr` → fixtures/captured/xhr-log.json (see NETWORK.md).
 */

export const NAVIGATION_ACTIONS = {
  checkout_entry: {
    method: 'GET',
    action: 'orders.unfBillShip',
    note: '前往結帳. Confirmed 13 Nov 2026. Form POST target is the same action; 繼續結帳 was not clicked.',
  },
  express_pay: {
    method: 'GET',
    action: 'express.unfExpressPay',
    note: '快捷付款. Confirmed 13 Nov 2026. No pickup controls on this page.',
  },
  cart: { method: 'GET', action: 'shopping.unfViewCart', note: 'Confirmed 13 Nov 2026.' },
  cart_update: {
    method: 'GET/POST',
    action: 'shopping.unfUpdateCart',
    note: 'Confirmed after 移除 on 13 Nov 2026.',
  },
  ordering: { method: 'GET', action: 'shopping.unfOrdering', note: 'Confirmed 13 Nov 2026.' },
  express_pay_settings: {
    method: 'GET',
    action: 'services.unfExpressPaySettings',
    note: 'Header 快捷付款 settings. Settings, not checkout.',
  },
};

/** Observed in the 13 Nov 2026 signed-in browser session. Submit buttons were not clicked. */
export const CONFIRMED_LIVE_ACTIONS = [
  { method: 'GET', action: 'orders.unfBillShip', note: 'Bill-ship page, non-empty cart' },
  {
    method: 'POST',
    action: 'orders.unfBillShip',
    note: 'Form billShip action. 繼續結帳 was not clicked.',
  },
  {
    method: 'referenced',
    action: 'orders.unfBillShipAJAX',
    note: 'data-action on #pcSelect and page JS. HTTP method was not separately recorded.',
  },
  {
    method: 'referenced',
    action: 'orders.unfBillShipBags',
    note: 'Referenced by bill-ship page JS. HTTP method was not separately recorded.',
  },
  { method: 'GET', action: 'express.unfExpressPay', note: 'Express pay page, non-empty cart' },
  {
    method: 'POST',
    action: 'express.unfProcessExpressOrder',
    note: 'Form finalPreview action. 提交你的訂單 was not clicked. Do not automate place-order.',
  },
  { method: 'GET', action: 'shopping.unfViewCart', note: 'Cart' },
  { method: 'GET/POST', action: 'shopping.unfUpdateCart', note: 'Confirmed after 移除' },
  { method: 'GET', action: 'shopping.unfOrdering', note: 'Catalog' },
  {
    method: 'GET',
    action: 'services.unfExpressPaySettings',
    note: 'Header settings. Not a checkout form target.',
  },
];

/**
 * Not observed as live form targets on 13 Nov 2026.
 * Kept so callers do not promote them to confirmed.
 */
export const UNVERIFIED_CHECKOUT_ACTIONS = [
  {
    action: 'orders.unfBillShipUpdate',
    method: 'unknown',
    confidence: 'unverified',
    note: 'Not observed as a live form target on 13 Nov 2026. Do not treat as confirmed.',
  },
  {
    action: 'orders.unfOrderReview',
    method: 'unknown',
    confidence: 'unverified',
    note: 'Not observed as a live form target on 13 Nov 2026. Do not treat as confirmed.',
  },
  {
    action: 'orders.unfPayment',
    method: 'unknown',
    confidence: 'unverified',
    note: 'Not observed as a live form target on 13 Nov 2026. Do not treat as confirmed.',
  },
];

/** Same rows as UNVERIFIED_CHECKOUT_ACTIONS. The old "inferred, likely next" reading is withdrawn. */
export const INFERRED_CHECKOUT_POSTS = UNVERIFIED_CHECKOUT_ACTIONS;

/** Typical XHR/fetch shapes on ColdFusion unf stacks. */
export const XHR_PATTERNS = [
  {
    id: 'full_page',
    transport: 'document',
    urlShape: 'https://hk.unfranchise.com/index.cfm?action=<area>.<page>[&params]',
    description: 'Primary: full HTML navigation and form POST back to index.cfm',
  },
  {
    id: 'jquery_ajax_action',
    transport: 'xhr',
    urlShape: 'index.cfm?action=<same as data-action attribute>',
    description: 'Elements with data-action. Bill-ship page JS also references orders.unfBillShipAJAX and orders.unfBillShipBags.',
    observedOn: ['shopping.*', 'forms.*', 'reports.*', 'orders.unfBillShipAJAX', 'orders.unfBillShipBags'],
  },
  {
    id: 'inline_form_hash',
    transport: 'document',
    urlShape: 'POST to # with prodOrderForm / qoe (page JS)',
    description: 'Add-to-cart quick order; not checkout but same JS stack',
  },
];

export function networkPatternsMarkdown() {
  return [
    '# Network patterns (hk.unfranchise.com)',
    '',
    '## Confirmed in the 13 Nov 2026 signed-in browser session',
    ...CONFIRMED_LIVE_ACTIONS.map(
      (v) => `- \`${v.action}\` (${v.method}) — ${v.note}`,
    ),
    '',
    '## Not observed — unverified',
    'These were not live form targets in that session. Do not treat them as confirmed.',
    ...UNVERIFIED_CHECKOUT_ACTIONS.map(
      (p) => `- \`${p.action}\` (${p.method}, ${p.confidence}) — ${p.note}`,
    ),
    '',
    '## Navigation shortcuts',
    ...Object.entries(NAVIGATION_ACTIONS).map(
      ([k, v]) => `- **${k}**: ${v.method} \`${v.action}\`${v.note ? ` — ${v.note}` : ''}`,
    ),
    '',
    '## XHR / fetch classes',
    ...XHR_PATTERNS.map((p) => `- **${p.id}**: ${p.description} (\`${p.urlShape}\`)`),
    '',
    '## Capture caveats',
    '- Empty cart: bill-ship and express-pay URLs still load but show 你的購物車是空的 and hide the checkout forms. Do not build the live map from an empty cart.',
    '- `npm run capture` and a Node `unf_checkout_billship_map` GET can return HTTP 200 login-wall HTML at `main.unfLogin&permissionViolation` even with a session cookie, because Cloudflare (`cf_clearance` / `__cf_bm`) is often bound to the browser TLS fingerprint. Never overwrite fixtures from that HTML. The signed-in browser is the reliable live path.',
    '- Manage-cards frame `services.unfManageCreditCardsFrame&callback=ccCallback` was linked and not opened.',
    '',
    'Document log: `UNF_COOKIE_FILE=… npm run capture` → `fixtures/captured/network-log.json`',
    'XHR log: `npm run capture:xhr` → `fixtures/captured/xhr-log.json`',
  ].join('\n');
}
