const BASE = 'https://hk.unfranchise.com';

/** Build index.cfm URL for a ColdFusion action string (may include &query). */
export function actionUrl(action, extraParams = {}) {
  const u = new URL('/index.cfm', BASE);
  u.searchParams.set('action', action.split('&')[0]);
  const rest = action.includes('&') ? action.slice(action.indexOf('&') + 1) : '';
  if (rest) {
    for (const part of rest.split('&')) {
      const [k, v = ''] = part.split('=');
      if (k) u.searchParams.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export const Actions = {
  ordering: 'shopping.unfOrdering',
  search: 'shopping.unfSearch',
  product: (skuID) => actionUrl('shopping.unfProduct', { skuID }),
  viewCart: 'shopping.unfViewCart',
  updateCart: 'shopping.unfUpdateCart',
  form1000: 'forms.unf1000',
  billShip: 'orders.unfBillShip',
  billShipAjax: 'orders.unfBillShipAJAX',
  billShipBags: 'orders.unfBillShipBags',
  expressPay: 'express.unfExpressPay',
  processExpressOrder: 'express.unfProcessExpressOrder',
  expressPaySettings: 'services.unfExpressPaySettings',
  manageCreditCardsFrame: 'services.unfManageCreditCardsFrame',
  reportCriteria: (reportName) => actionUrl('reports.unfReportCriteria', { reportName }),
  personalVolume: 'personalVolume',
  samm: 'reports.sammQualificationUNF',
};

export { BASE };
