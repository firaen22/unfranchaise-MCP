import { parseFormFields, parseDataActionLinks } from './parse-forms.js';

/** Classify checkout-related actions in page links / data-action. */
const CHECKOUT_ACTION_RE =
  /^(orders\.|express\.|shopping\.unfViewCart|shopping\.unfUpdateCart)/;

export function parseCheckoutPage($) {
  const body = $.text();
  const forms = parseFormFields($);
  const dataActions = parseDataActionLinks($).filter((l) => CHECKOUT_ACTION_RE.test(l.action));
  const stepHints = [];
  if (/帳單|賬單|billing/i.test(body)) stepHints.push('billing');
  if (/送貨|運送|shipping|地址/i.test(body)) stepHints.push('shipping');
  if (/親自提貨|提貨|取貨|pick\s*up|pickup/i.test(body)) stepHints.push('pickup');
  if (/付款|payment|信用卡|credit/i.test(body)) stepHints.push('payment');
  if (/檢閱|review|確認/i.test(body)) stepHints.push('review');
  if (/購物車是空的|cart is empty/i.test(body)) stepHints.push('empty_cart');
  if (/permissionViolation|unfLogin/i.test(body)) stepHints.push('login_required');
  const title =
    stepHints.length > 0
      ? `checkout:${[...new Set(stepHints)].sort().join('+')}`
      : 'checkout:page';
  return {
    title,
    stepHints,
    forms,
    dataActions,
    formCount: forms.length,
    fieldCount: forms.reduce((n, f) => n + f.fields.length, 0),
  };
}

export function isCheckoutShape(parsed) {
  const forms = parsed?.forms ?? [];
  const names = forms.flatMap((form) => (form.fields ?? []).map((field) => field.name).filter(Boolean));
  const hasBillShip = forms.some(
    (form) =>
      form.name === 'billShip' ||
      form.name === 'billShipForm' ||
      String(form.dataAction ?? '').includes('orders.unfBillShip'),
  );
  const liveMarkers =
    names.includes('shipType') && names.includes('contactPhone') && names.includes('pickUp');
  const hasCheckoutAction = (parsed?.dataActions ?? []).some((link) =>
    /^(orders\.unfBillShip|express\.unfExpressPay)/.test(link.action),
  );
  const hasExpressPay = forms.some(
    (form) =>
      form.name === 'finalPreview' ||
      /express\.unf(ExpressPay|ProcessExpressOrder)/.test(
        `${form.dataAction ?? ''} ${form.action ?? ''}`,
      ),
  );
  return hasBillShip || liveMarkers || hasCheckoutAction || hasExpressPay;
}

/** Why a parsed checkout page must not become the field map. */
export function checkoutMapBlocker(parsed, url = '') {
  if (!parsed) return 'no_checkout_form';
  if (parsed.stepHints?.includes('login_required') || /permissionViolation|unfLogin/i.test(String(url))) {
    return 'login_required';
  }
  if (parsed.stepHints?.includes('empty_cart')) return 'empty_cart';
  if (!parsed.fieldCount) return 'no_checkout_form';
  if (!isCheckoutShape(parsed)) return 'not_checkout_form';
  return null;
}
