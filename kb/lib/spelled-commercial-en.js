/**
 * English spelled commercial amounts (A1) — composed label / connector / amount grammar.
 * Digit patterns and Chinese spelled prices stay in classify.js.
 */

const SPELLED_VOLUME_WORD =
  '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)';

const SPELLED_HYPHEN_TEENS =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';

/** Single spelled amount token (e.g. sixteen, twenty-one). */
const SPELLED_AMOUNT_UNIT = `(?:${SPELLED_HYPHEN_TEENS}-${SPELLED_HYPHEN_TEENS}|${SPELLED_VOLUME_WORD})`;

/** Digits or spelled amount (optional article). */
const SPELLED_AMOUNT = `(?:\\+?-?[\\d.,]+|(?:a\\s+)?${SPELLED_AMOUNT_UNIT})`;

const SPELLED_CURRENCY_NAME =
  '(?:dollars?|pounds?|euros?|yen|yuan|renminbi|francs?|hong\\s+kong\\s+dollars?)';

const SPELLED_ENGLISH_COPULA =
  '(?:is|was|are|were|equals?|costs?|will\\s+be|has\\s+been\\s+(?:set\\s+to|updated\\s+to|reduced\\s+to|increased\\s+to|changed\\s+to))';

const SPELLED_COPULA_MODIFIER =
  '(?:\\s+(?:now|currently|still|today|at\\s+least|at\\s+most|approximately|roughly|about|up\\s+to|no\\s+more\\s+than)){0,3}';

const SPELLED_LISTING_COPULA =
  '(?:listed|quoted|shown|advertised|marked|tagged|printed|rated)\\s+as';

const SPELLED_COMMERCIAL_LABEL =
  '(?:SRP|Price|Retail\\s+price|Wholesale\\s+price|Wholesale\\s+cost|BV|IBV|UC|PBV|GBV|PIBV|Business\\s+Volume(?:\\s*\\(BV\\))?)';

const SPELLED_VOLUME_LABEL =
  '(?:BV|IBV|UC|PBV|GBV|PIBV|Business\\s+Volume(?:\\s*\\(BV\\))?)';

const SPELLED_PRICE_LABEL = '(?:SRP|Price|Retail\\s+price|Wholesale\\s+price|Wholesale\\s+cost)';

const SPELLED_EQUALS_QUALIFIER_WORD_RE =
  '(?:(?:HKD|USD|EUR|GBP|CNY|RMB|HK\\$)(?:\\s+(?:minus|negative))?|minus|negative|[€£$¥￥])\\s*';

const SPELLED_COPULA_QUALIFIER_WORD_RE =
  '(?:(?:HKD|USD|EUR|GBP|CNY|RMB|HK\\$)(?:\\s+(?:minus|negative))?|minus|negative|[€£$¥￥])\\s+';

/** Spelled amount tail after optional article + currency qualifiers. */
const SPELLED_AMOUNT_TAIL = `(?:${SPELLED_AMOUNT_UNIT})(?:\\s+(?:and\\s+)?(?:${SPELLED_AMOUNT_UNIT}))*\\.?`;

const SPELLED_AMOUNT_PHRASE = `(?:a\\s+)?(?:${SPELLED_EQUALS_QUALIFIER_WORD_RE})?(?:a\\s+)?${SPELLED_AMOUNT_TAIL}`;

const SPELLED_AMOUNT_PHRASE_COPULA = `(?:a\\s+)?(?:${SPELLED_COPULA_QUALIFIER_WORD_RE})?${SPELLED_AMOUNT_UNIT}\\.?`;

/** Unlabeled price verbs (product prose without SRP:/Price:). */
const UNLABELED_PRICE_VERB =
  '(?:costs?|sells?\\s+for|sold\\s+for|retails?\\s+for|retail\\s+for|offered\\s+at|priced\\s+at|goes\\s+for|lists?\\s+at|starts?\\s+at)';

/** Volume amount before label (with verb) or bare amount + label + per. */
const REVERSE_VOLUME_VERB =
  '(?:earns|pays|yields|has|carries|offers|with|includes|provides|awards|grants|delivers)';

/** Promo / discount lead words (not only “Discount:”). */
const PROMO_LEAD = '(?:Discount|Save|Get|Enjoy|Receive)';

function buildUnlabeledPricePatterns() {
  const pad = `(?:\\s+\\w+){0,8}`;
  const padShort = `(?:\\s+\\w+){0,6}`;
  return [
    new RegExp(
      `\\b(?:sells?|sold)\\s+for\\s+${SPELLED_AMOUNT}(?:\\s+${SPELLED_CURRENCY_NAME})?\\.?\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:costs?|prices?\\s+at)\\s+${SPELLED_AMOUNT}(?:\\s+${SPELLED_CURRENCY_NAME})?\\.?\\b`,
      'i',
    ),
    new RegExp(
      `\\b${UNLABELED_PRICE_VERB}\\s+${SPELLED_AMOUNT}${pad}\\s+${SPELLED_CURRENCY_NAME}(?:\\s+per\\s+\\w+)?\\.?\\b`,
      'i',
    ),
    new RegExp(`\\b${UNLABELED_PRICE_VERB}\\s+(?:€|£|\\$|[¥￥])\\s*\\+?-?\\s*[\\d.,]+\\.?\\b`, 'i'),
    new RegExp(
      `\\b${UNLABELED_PRICE_VERB}\\s+${SPELLED_AMOUNT}${padShort}\\s+(?:hong\\s+kong\\s+)?dollars(?:\\s+per\\s+\\w+)?\\.?\\b`,
      'i',
    ),
  ];
}

function buildPromoPercentPatterns(copula) {
  return [
    new RegExp(
      `\\b${PROMO_LEAD}\\s*(?:[:：]|\\b${SPELLED_ENGLISH_COPULA}\\b)${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT}\\s+percent\\.?\\b`,
      'i',
    ),
    new RegExp(`\\b${PROMO_LEAD}\\s*[:：]\\s*\\d+(?:\\.\\d+)?%`, 'i'),
    new RegExp(`\\b${PROMO_LEAD}\\s*[:：]\\s*\\d+(?:\\.\\d+)?\\s+percent\\.?\\b`, 'i'),
    new RegExp(
      `\\bDiscount\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s*\\d+(?:\\.\\d+)?%`,
      'i',
    ),
    new RegExp(
      `\\b(?:Save|Get)\\s+${SPELLED_AMOUNT}\\s+percent(?:\\s+on\\s+(?:this\\s+)?(?:product|sku|item|order))?\\.?\\b`,
      'i',
    ),
    new RegExp(`\\b${SPELLED_AMOUNT}\\s+percent\\s+off\\b`, 'i'),
    new RegExp(`\\b(?:up\\s+to\\s+)?${SPELLED_AMOUNT}\\s+percent\\s+(?:off|discount)\\b`, 'i'),
  ];
}

const VOLUME_LABEL_ALT = '(?:BV|IBV|UC|PBV|GBV|PIBV)';

/** Amount + volume label: verb-led, `per` unit, period tag, or bare amount+label. */
function buildVolumeAmountPatterns() {
  const amountBeforeLabel = (tail) =>
    new RegExp(
      `\\b${SPELLED_AMOUNT_UNIT}\\s+${VOLUME_LABEL_ALT}(?:\\s+points?)?${tail}`,
      'i',
    );
  return [
    new RegExp(
      `\\b${REVERSE_VOLUME_VERB}\\s+(?:a\\s+)?${SPELLED_AMOUNT}(?:\\s+\\w+){0,4}\\s+${VOLUME_LABEL_ALT}\\b`,
      'i',
    ),
    amountBeforeLabel(`\\s+per\\s+\\w+\\.?\\b`),
    amountBeforeLabel(`\\.(?=\\s|$)`),
    // Mirror digit path `\d+\s*(?:BV|IBV|UC)\b` — bare spelled amount + label (no period).
    amountBeforeLabel(`\\b`),
  ];
}

function buildEnglishSpelledCommercialPatterns() {
  const labelPad = `(?:\\s+[A-Za-z]+){0,6}`;
  /** Intervening prose between “retail price” and copula (e.g. per market / per bottle). */
  const priceProsePad = `(?:\\s+[A-Za-z]+){0,24}`;
  const colonEquals = `(?:[:：]|=)`;
  const copula = `\\b${SPELLED_ENGLISH_COPULA}\\b`;

  return [
    ...buildUnlabeledPricePatterns(),
    ...buildPromoPercentPatterns(copula),
    ...buildVolumeAmountPatterns(),
    // Label + colon/equals (+ optional pad) + amount
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}${labelPad}\\s*${colonEquals}\\s*${SPELLED_AMOUNT_PHRASE}\\b`,
      'i',
    ),
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}${labelPad}\\s*${colonEquals}\\s*a\\s+(?:and\\s+)*(?:${SPELLED_VOLUME_WORD}\\s+)+(?:and\\s+(?:${SPELLED_VOLUME_WORD}|${SPELLED_HYPHEN_TEENS}-${SPELLED_HYPHEN_TEENS}))*\\b`,
      'i',
    ),
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}(?:\\s+[A-Za-z]+){0,4}\\s*[:：]\\s*a\\s+${SPELLED_VOLUME_WORD}\\b`,
      'i',
    ),
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}${labelPad}\\s*[:：]\\s*(?:(?:HKD|USD|EUR|GBP|CNY|RMB|HK\\$)(?:\\s+(?:minus|negative))?|minus|negative|[€£$¥￥])\\s*${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    // Label + copula (+ modifiers) + amount
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}${labelPad}\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT_PHRASE_COPULA}\\b`,
      'i',
    ),
    new RegExp(
      `\\bThe\\s+price\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT_PHRASE_COPULA}\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:The\\s+)?(?:recommended\\s+)?(?:${SPELLED_PRICE_LABEL}|price)${priceProsePad}\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT_PHRASE_COPULA}\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:${SPELLED_PRICE_LABEL})${labelPad}\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT_PHRASE_COPULA}\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:SRP|Price|Retail\\s+price)\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+(?:a\\s+)?${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}${labelPad}\\s+(?:is|was|are|were)\\s+${SPELLED_LISTING_COPULA}\\s+(?:a\\s+)?(?:${SPELLED_EQUALS_QUALIFIER_WORD_RE})?${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
  new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}${labelPad}\\s+ranges\\s+(?:from|between)\\s+${SPELLED_AMOUNT_UNIT}\\s+(?:to|and)\\s+${SPELLED_AMOUNT_UNIT}\\.?\\b`,
      'i',
    ),
    // amounts to / comes to / totals
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}\\s+(?:amounts\\s+to|comes\\s+to|totals)\\s+(?:a\\s+)?(?:(?:${SPELLED_EQUALS_QUALIFIER_WORD_RE})|(?:(?:minus|negative)\\s+))?${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    // Volume labels + copula
    new RegExp(
      `\\b${SPELLED_VOLUME_LABEL}\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT_PHRASE_COPULA}\\b`,
      'i',
    ),
    new RegExp(
      `\\b${SPELLED_VOLUME_LABEL}${labelPad}\\s+${copula}${SPELLED_COPULA_MODIFIER}\\s+${SPELLED_AMOUNT_PHRASE_COPULA}\\b`,
      'i',
    ),
    // BV points
    new RegExp(
      `\\b(?:BV|IBV|UC|PBV|GBV|PIBV)\\s+points?\\s*[:：]\\s*${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:BV|IBV|UC|PBV|GBV|PIBV)\\s+points?\\s+${copula}\\s+${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:BV|IBV|UC|PBV|GBV|PIBV)\\s+points?\\s*=\\s*${SPELLED_AMOUNT_PHRASE}\\b`,
      'i',
    ),
    // Bare label + single spelled amount (incl. hyphen compounds)
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}\\s+${SPELLED_AMOUNT_UNIT}(?!\\s+(?:and\\s+)?(?:${SPELLED_VOLUME_WORD}|\\d))\\.?\\b`,
      'i',
    ),
    // Glued currency after copula or =
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}\\s+(?:${SPELLED_ENGLISH_COPULA}|=)\\s*[€£$¥￥]${SPELLED_AMOUNT_UNIT}\\.?\\b`,
      'i',
    ),
    // of / has a value of
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}\\s+of\\s+(?:a\\s+)?(?:${SPELLED_EQUALS_QUALIFIER_WORD_RE})?${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    new RegExp(
      `\\b${SPELLED_COMMERCIAL_LABEL}\\s+has\\s+(?:a\\s+)?value\\s+of\\s+${SPELLED_AMOUNT_TAIL}\\b`,
      'i',
    ),
    // Long “dollars” phrase after label
    new RegExp(
      `\\b(?:SRP|Price|BV|IBV|UC|PBV|GBV|PIBV|Business\\s+Volume|Retail\\s+price|Wholesale\\s+price|Wholesale\\s+cost)\\s*(?:[:：]|\\b${SPELLED_ENGLISH_COPULA}\\s+)\\s*(?![\\d])(?:[a-z][\\w-]*\\s+){2,24}(?:hong\\s+kong\\s+)?dollars\\.?\\b`,
      'i',
    ),
  ];
}

const ENGLISH_SPELLED_COMMERCIAL_PATTERNS = buildEnglishSpelledCommercialPatterns();

/** @param {string} normalizedText output of normalizeForDetection */
export function detectSpelledEnglishCommercial(normalizedText) {
  const t = String(normalizedText ?? '');
  if (!t) return false;
  return ENGLISH_SPELLED_COMMERCIAL_PATTERNS.some((re) => re.test(t));
}