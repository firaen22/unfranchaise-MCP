/** Pure volume / qualification rules from FINDINGS.md (no account data). */

export const MONTHLY_IBV_CAP_MA_SA = 500;

export const PERSONAL_BV_ACCUMULATION = {
  超連鎖店主: 50,
  助理級: 100,
  經理級或以上: 150,
};

export const SAMM_QUARTERLY = {
  ibvMin: 225,
  bvExclusiveMin: 2000,
};

export const FORM1000 = {
  minOrders: 2,
  minProductTotalHkd: 1500,
  maxPersonalConsumptionPerOrderHkd: 450,
  personalUseMaxFraction: 0.3,
  retailMinFraction: 0.7,
};

/**
 * SKU variant: BV and IBV are alternate SKUs, not stacked on one line.
 * @param {'BV'|'IBV'} lineType
 * @param {{ bvPoints?: number, ibvPoints?: number }} line
 */
export function cartLineTotals(lineType, line) {
  if (lineType === 'IBV') {
    return { bvTotal: 0, ibvTotal: line.ibvPoints ?? 0 };
  }
  return { bvTotal: line.bvPoints ?? 0, ibvTotal: 0 };
}

/**
 * Estimate IBV display percent ≈ ibvPoints / lower UC price (from findings).
 */
export function ibvPercentApprox(ibvPoints, ucPriceHkd) {
  if (!ucPriceHkd || ucPriceHkd <= 0) return null;
  return Math.round((ibvPoints / ucPriceHkd) * 1000) / 10;
}

/** Map product name / sku to variant. */
export function skuVariant(skuOrName) {
  const s = String(skuOrName ?? '');
  if (/IBV/i.test(s) || /\(IBV\)/i.test(s)) return 'IBV';
  return 'BV';
}

export function ibvSkuFromBv(sku) {
  const base = String(sku).replace(/IBV$/i, '');
  return `${base}IBV`;
}

export function bvSkuFromIbv(sku) {
  return String(sku).replace(/IBV$/i, '');
}

/**
 * Check Form 1000 eligibility on order product totals (excluding ship/tax).
 * @param {number[]} productTotalsHkd
 */
export function form1000QualifyingOrders(productTotalsHkd) {
  if (!Array.isArray(productTotalsHkd)) {
    throw new Error('productTotalsHkd must be an array');
  }
  for (let i = 0; i < productTotalsHkd.length; i++) {
    const t = productTotalsHkd[i];
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) {
      throw new Error(`productTotalsHkd[${i}] must be a finite number >= 0`);
    }
  }
  function toDecimal(value, index) {
    if (value > 1e12) throw new Error(`productTotalsHkd[${index}] must be an HKD amount within ±1e12`);
    const match = /^([0-9]+)(?:\.([0-9]+))?(?:e([+-]?[0-9]+))?$/i.exec(String(value));
    if (!match) throw new Error(`productTotalsHkd[${index}] must be a finite number >= 0`);
    const digits = BigInt(match[1] + (match[2] ?? ''));
    const scale = (match[2]?.length ?? 0) - Number(match[3] ?? 0);
    return scale >= 0
      ? { numerator: digits, scale }
      : { numerator: digits * 10n ** BigInt(-scale), scale: 0 };
  }
  const decimals = productTotalsHkd.map(toDecimal);
  const commonScale = decimals.reduce((max, item) => Math.max(max, item.scale), 0);
  const totalNumerator = decimals.reduce(
    (sum, item) => sum + item.numerator * 10n ** BigInt(commonScale - item.scale),
    0n,
  );
  const count = productTotalsHkd.filter((t) => t > 0).length;
  const meets =
    count >= FORM1000.minOrders &&
    totalNumerator >= BigInt(FORM1000.minProductTotalHkd) * 10n ** BigInt(commonScale);
  const digits = totalNumerator.toString().padStart(commonScale + 1, '0');
  let productTotalHkd = Number(
    commonScale ? `${digits.slice(0, digits.length - commonScale)}.${digits.slice(digits.length - commonScale)}` : digits,
  );
  // Never report a total at/above the threshold when the exact sum is below it (binary rounding of 17+ digits).
  if (!meets && productTotalHkd >= FORM1000.minProductTotalHkd && count >= FORM1000.minOrders) {
    productTotalHkd = FORM1000.minProductTotalHkd - Number.EPSILON * FORM1000.minProductTotalHkd;
  }
  return {
    orderCount: count,
    productTotalHkd,
    meetsRule: meets,
    rule: `≥${FORM1000.minOrders} orders, product total ≥ HK$${FORM1000.minProductTotalHkd}`,
  };
}

/**
 * SAMM quarterly thresholds (estimate flag per site copy).
 */
export function sammQualificationSummary({ ibv = 0, bvExclusive = 0, hasHsl = false }) {
  if (typeof ibv !== 'number' || !Number.isFinite(ibv) || ibv < 0) {
    throw new Error('ibv must be a finite number >= 0');
  }
  if (typeof bvExclusive !== 'number' || !Number.isFinite(bvExclusive) || bvExclusive < 0) {
    throw new Error('bvExclusive must be a finite number >= 0');
  }
  if (typeof hasHsl !== 'boolean') {
    throw new Error('hasHsl must be a boolean');
  }
  return {
    ibv,
    bvExclusive,
    hasHsl,
    ibvMet: ibv >= SAMM_QUARTERLY.ibvMin,
    bvMet: bvExclusive >= SAMM_QUARTERLY.bvExclusiveMin,
    hslMet: hasHsl,
    likelyQualified: ibv >= SAMM_QUARTERLY.ibvMin && bvExclusive >= SAMM_QUARTERLY.bvExclusiveMin && hasHsl,
    note: 'Totals may be estimates until commissions settle.',
  };
}

export function volumeRulesMarkdown() {
  return [
    '# IBV / BV rules (summary)',
    '1. BV and IBV are alternate SKUs; cart IBV lines do not add BV.',
    `2. Monthly IBV cap (MA/SA brands): ${MONTHLY_IBV_CAP_MA_SA}.`,
    `3. Personal monthly BV for placement: ${JSON.stringify(PERSONAL_BV_ACCUMULATION)}.`,
    `4. SAMM quarterly: ${SAMM_QUARTERLY.ibvMin} IBV + ${SAMM_QUARTERLY.bvExclusiveMin} BV exclusive + HSL.`,
    `5. Form 1000: ${FORM1000.minOrders} orders, ≥ HK$${FORM1000.minProductTotalHkd} product total (ex ship/tax).`,
  ].join('\n');
}
