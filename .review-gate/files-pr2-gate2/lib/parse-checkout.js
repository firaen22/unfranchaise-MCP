import { parseFormFields, parseDataActionLinks } from './parse-forms.js';

/** Classify checkout-related actions in page links / data-action. */
const CHECKOUT_ACTION_RE =
  /^(orders\.|express\.|shopping\.unfViewCart|shopping\.unfUpdateCart)/;

export function parseCheckoutPage($) {
  const title = $('title').text().trim();
  const body = $.text();
  const forms = parseFormFields($);
  const dataActions = parseDataActionLinks($).filter((l) => CHECKOUT_ACTION_RE.test(l.action));
  const stepHints = [];
  if (/帳單|賬單|billing/i.test(body)) stepHints.push('billing');
  if (/送貨|運送|shipping|地址/i.test(body)) stepHints.push('shipping');
  if (/取貨|pick\s*up|pickup/i.test(body)) stepHints.push('pickup');
  if (/付款|payment|信用卡|credit/i.test(body)) stepHints.push('payment');
  if (/檢閱|review|確認/i.test(body)) stepHints.push('review');
  if (/購物車是空的|cart is empty/i.test(body)) stepHints.push('empty_cart');
  if (/permissionViolation|unfLogin/i.test(body)) stepHints.push('login_required');
  return {
    title,
    stepHints,
    forms,
    dataActions,
    formCount: forms.length,
    fieldCount: forms.reduce((n, f) => n + f.fields.length, 0),
  };
}
