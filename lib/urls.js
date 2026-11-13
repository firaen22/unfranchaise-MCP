const BASE = 'https://hk.unfranchise.com';

/** Build index.cfm URL for a ColdFusion action string (may include &query). */
export function actionUrl(action, extraParams = {}) {
  const u = new URL('/index.cfm', BASE);
  u.searchParams.set('action', action.split('&')[0]);
  const rest = action.includes('&') ? action.slice(action.indexOf('&') + 1) : '';
  if (rest) {
    for (const part of rest.split('&')) {
      const eq = part.indexOf('=');
      if (eq === -1) {
        if (part) u.searchParams.set(part, '');
      } else {
        const k = part.slice(0, eq);
        const v = part.slice(eq + 1);
        if (k) u.searchParams.set(k, v);
      }
    }
  }
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export const PlacementActions = Object.freeze({
  designated: 'forms.unfBVIBVPlacement',
  designatedUpdate: 'forms.unfBVIBVPlacementUpdate',
  auto: 'forms.unfBVIBVAutoPlacementUpdate',
  ibdc: 'forms.unfIBVDesignationU',
});

export function placementFormsUrls(target) {
  const allowed = ['designated', 'auto', 'ibdc'];
  if (target !== undefined) {
    if (!allowed.includes(target)) throw new Error(`Unknown placement target: ${target}`);
    const action =
      target === 'designated'
        ? PlacementActions.designated
        : target === 'auto'
          ? PlacementActions.auto
          : PlacementActions.ibdc;
    return { [target]: actionUrl(action) };
  }
  return {
    designated: actionUrl(PlacementActions.designated),
    auto: actionUrl(PlacementActions.auto),
    ibdc: actionUrl(PlacementActions.ibdc),
  };
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
