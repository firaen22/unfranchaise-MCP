/**
 * Documented hk.unfranchise.com request patterns.
 * Live XHR names confirmed via `npm run capture` with UNF_COOKIE_FILE (see NETWORK.md).
 */

export const NAVIGATION_ACTIONS = {
  checkout_entry: { method: 'GET', action: 'orders.unfBillShip', note: 'From cart 前往結帳' },
  express_pay: { method: 'GET', action: 'express.unfExpressPay', note: '快捷付款 from cart' },
  cart: { method: 'GET', action: 'shopping.unfViewCart' },
  cart_update: { method: 'GET/POST', action: 'shopping.unfUpdateCart' },
};

/** Inferred next-step POST targets (validate with capture-session). */
export const INFERRED_CHECKOUT_POSTS = [
  { action: 'orders.unfBillShip', method: 'POST', confidence: 'medium', note: 'Same action multi-step ColdFusion postback' },
  { action: 'orders.unfBillShipUpdate', method: 'POST', confidence: 'low', note: 'Common MA naming; not verified on HK' },
  { action: 'orders.unfOrderReview', method: 'GET', confidence: 'low' },
  { action: 'orders.unfPayment', method: 'GET/POST', confidence: 'low' },
];

/** Typical XHR/fetch shapes on ColdFusion unf stacks (validate per capture). */
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
    description: 'Elements with data-action; seen on catalog/cart elsewhere in FINDINGS',
    observedOn: ['shopping.*', 'forms.*', 'reports.*'],
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
    '## Navigation (confirmed in FINDINGS)',
    ...Object.entries(NAVIGATION_ACTIONS).map(
      ([k, v]) => `- **${k}**: ${v.method} \`${v.action}\`${v.note ? ` — ${v.note}` : ''}`,
    ),
    '',
    '## Inferred checkout POST actions (run capture to confirm)',
    ...INFERRED_CHECKOUT_POSTS.map((p) => `- \`${p.action}\` (${p.method}, ${p.confidence}) — ${p.note || ''}`),
    '',
    '## XHR / fetch classes',
    ...XHR_PATTERNS.map((p) => `- **${p.id}**: ${p.description} (\`${p.urlShape}\`)`),
    '',
    'Regenerate live log: `UNF_COOKIE_FILE=… npm run capture` → `fixtures/captured/network-log.json`',
  ].join('\n');
}
