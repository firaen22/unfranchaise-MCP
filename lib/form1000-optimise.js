/**
 * Dry-run planner for two Form 1000 receipts.
 *
 * Site research (FINDINGS) describes at least 2 orders whose combined product
 * total is >= HKD 1500, excluding shipping, tax, and fees. This tool's default
 * objective is stricter: two receipts, each with product total >= HKD 1500.
 * It never assigns, submits, or places an order.
 */
import { centsToHkd, loadSheetFromCsv, loadSheetFromFile, normaliseSheetRow } from './form1000-sheet.js';

export const TARGET_HKD = 1500;
const TARGET = TARGET_HKD * 100;
const PERSONAL_FRACTION_NUM = 3;
const PERSONAL_FRACTION_DEN = 10;
const PERSONAL_ORDER_CAP = 450 * 100;
const EXACT_LIMIT = 14;
const PIECE_LIMIT = 24;

function money(hkd) {
  return Number(hkd).toFixed(2);
}

function lowerBound(values, target) {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function decodeAssign(mask, count) {
  const assign = new Array(count);
  let rest = mask;
  for (let i = 0; i < count; i++) {
    assign[i] = rest % 3;
    rest = Math.floor(rest / 3);
  }
  return assign;
}

function enumHalf(atoms) {
  const count = atoms.length;
  const limit = 3 ** count;
  const states = [];
  for (let mask = 0; mask < limit; mask++) {
    let s1 = 0;
    let s2 = 0;
    let rest = mask;
    for (let i = 0; i < count; i++) {
      const bucket = rest % 3;
      rest = Math.floor(rest / 3);
      if (bucket === 1) s1 += atoms[i].cents;
      else if (bucket === 2) s2 += atoms[i].cents;
    }
    states.push({ s1, s2, mask });
  }
  return states;
}

function betterRight(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  const sumA = a.s1 + a.s2;
  const sumB = b.s1 + b.s2;
  if (sumA !== sumB) return sumA < sumB ? a : b;
  const maxA = Math.max(a.s1, a.s2);
  const maxB = Math.max(b.s1, b.s2);
  if (maxA !== maxB) return maxA < maxB ? a : b;
  return a.mask < b.mask ? a : b;
}

function bestRights(rights, queries) {
  const s1s = [...new Set(rights.map((right) => right.s1))].sort((a, b) => a - b);
  const indexOf = new Map(s1s.map((value, index) => [value, index]));
  const width = s1s.length;
  const size = width === 0 ? 1 : 1 << Math.ceil(Math.log2(width));
  const tree = new Array(size * 2).fill(null);
  function insert(pos, value) {
    let index = pos + size;
    tree[index] = betterRight(tree[index], value);
    for (index >>= 1; index >= 1; index >>= 1) {
      tree[index] = betterRight(tree[index * 2], tree[index * 2 + 1]);
    }
  }
  function query(pos) {
    if (pos >= width) return null;
    let left = pos + size;
    let right = width + size;
    let acc = null;
    while (left < right) {
      if (left & 1) acc = betterRight(acc, tree[left++]);
      if (right & 1) acc = betterRight(acc, tree[--right]);
      left >>= 1;
      right >>= 1;
    }
    return acc;
  }
  const rightsSorted = [...rights].sort((a, b) => b.s2 - a.s2 || a.s1 - b.s1);
  const order = queries
    .map((query, index) => ({ ...query, index }))
    .sort((a, b) => b.need2 - a.need2 || b.need1 - a.need1);
  const answers = new Array(queries.length).fill(null);
  let pointer = 0;
  for (const item of order) {
    while (pointer < rightsSorted.length && rightsSorted[pointer].s2 >= item.need2) {
      const right = rightsSorted[pointer++];
      insert(indexOf.get(right.s1), right);
    }
    answers[item.index] = query(lowerBound(s1s, item.need1));
  }
  return answers;
}

function lineAppearances(assign, atoms) {
  const used = new Set();
  for (let i = 0; i < assign.length; i++) {
    if (assign[i] !== 0) used.add(`${atoms[i].lineId}:${assign[i]}`);
  }
  return used.size;
}

function betterFeasible(next, prev) {
  if (next.sum !== prev.sum) return next.sum < prev.sum;
  if (next.max !== prev.max) return next.max < prev.max;
  return next.lines < prev.lines;
}

function betterEffort(next, prev) {
  if (next.gap !== prev.gap) return next.gap < prev.gap;
  if (next.negMin !== prev.negMin) return next.negMin < prev.negMin;
  return next.over < prev.over;
}

function bruteSearch(atoms) {
  const count = atoms.length;
  const limit = 3 ** count;
  let bestFeasible = null;
  let bestEffort = null;
  for (let mask = 0; mask < limit; mask++) {
    let s1 = 0;
    let s2 = 0;
    let rest = mask;
    const assign = new Array(count);
    for (let i = 0; i < count; i++) {
      const bucket = rest % 3;
      rest = Math.floor(rest / 3);
      assign[i] = bucket;
      if (bucket === 1) s1 += atoms[i].cents;
      else if (bucket === 2) s2 += atoms[i].cents;
    }
    if (s1 >= TARGET && s2 >= TARGET) {
      const score = { sum: s1 + s2, max: Math.max(s1, s2), lines: lineAppearances(assign, atoms) };
      if (!bestFeasible || betterFeasible(score, bestFeasible.score)) bestFeasible = { assign, score };
    } else {
      const gap1 = Math.max(0, TARGET - s1);
      const gap2 = Math.max(0, TARGET - s2);
      const score = {
        gap: gap1 + gap2,
        negMin: -Math.min(s1, s2),
        over: Math.max(0, s1 - TARGET) + Math.max(0, s2 - TARGET),
      };
      if (!bestEffort || betterEffort(score, bestEffort.score)) bestEffort = { assign, score };
    }
  }
  if (bestFeasible) return { assign: bestFeasible.assign, feasible: true, assignment: 'exact' };
  return { assign: bestEffort.assign, feasible: false, assignment: 'exact-best-effort' };
}

const MIM_PAIR_CAP = 25_000_000;

function mimSearch(atoms) {
  const mid = Math.floor(atoms.length / 2);
  const leftAtoms = atoms.slice(0, mid);
  const rightAtoms = atoms.slice(mid);
  const leftStates = enumHalf(leftAtoms);
  const rightStates = enumHalf(rightAtoms);
  let best = null;
  const pairCount = leftStates.length * rightStates.length;
  const enumeratePairs = pairCount <= MIM_PAIR_CAP;
  if (enumeratePairs) {
    for (const left of leftStates) {
      for (const right of rightStates) {
        const s1 = left.s1 + right.s1;
        const s2 = left.s2 + right.s2;
        if (s1 < TARGET || s2 < TARGET) continue;
        const assign = decodeAssign(left.mask, leftAtoms.length).concat(decodeAssign(right.mask, rightAtoms.length));
        const score = { sum: s1 + s2, max: Math.max(s1, s2), lines: lineAppearances(assign, atoms) };
        if (!best || betterFeasible(score, best.score)) best = { score, assign };
      }
    }
    return best ? best.assign : null;
  }
  const answers = bestRights(
    rightStates,
    leftStates.map((state) => ({
      need1: Math.max(0, TARGET - state.s1),
      need2: Math.max(0, TARGET - state.s2),
    })),
  );
  for (let i = 0; i < leftStates.length; i++) {
    const right = answers[i];
    if (!right) continue;
    const s1 = leftStates[i].s1 + right.s1;
    const s2 = leftStates[i].s2 + right.s2;
    if (s1 < TARGET || s2 < TARGET) continue;
    const assign = decodeAssign(leftStates[i].mask, leftAtoms.length).concat(
      decodeAssign(right.mask, rightAtoms.length),
    );
    const score = { sum: s1 + s2, max: Math.max(s1, s2), lines: lineAppearances(assign, atoms) };
    if (!best || betterFeasible(score, best.score)) {
      best = { score, assign };
    }
  }
  return best ? best.assign : null;
}

function chooseSubset(atoms, target) {
  const total = atoms.reduce((sum, atom) => sum + atom.cents, 0);
  if (total > 5_000_000) {
    const order = atoms.map((atom, index) => ({ index, cents: atom.cents })).sort((a, b) => b.cents - a.cents);
    const indexes = [];
    let sum = 0;
    for (const item of order) {
      if (sum >= target) break;
      indexes.push(item.index);
      sum += item.cents;
    }
    return indexes;
  }
  const prevItem = new Int32Array(total + 1).fill(-2);
  const prevSum = new Int32Array(total + 1).fill(-1);
  prevItem[0] = -1;
  for (let i = 0; i < atoms.length; i++) {
    const cents = atoms[i].cents;
    if (cents <= 0) continue;
    for (let sum = total - cents; sum >= 0; sum--) {
      if (prevItem[sum] !== -2 && prevItem[sum + cents] === -2) {
        prevItem[sum + cents] = i;
        prevSum[sum + cents] = sum;
      }
    }
  }
  let best = -1;
  for (let sum = target; sum <= total; sum++) {
    if (prevItem[sum] !== -2) {
      best = sum;
      break;
    }
  }
  if (best < 0) {
    for (let sum = total; sum >= 0; sum--) {
      if (prevItem[sum] !== -2) {
        best = sum;
        break;
      }
    }
  }
  const indexes = [];
  let sum = best;
  while (sum > 0) {
    const item = prevItem[sum];
    if (item < 0) break;
    indexes.push(item);
    sum = prevSum[sum];
  }
  return indexes;
}

function sequentialBestEffort(atoms) {
  const assign = new Array(atoms.length).fill(0);
  const first = chooseSubset(atoms, TARGET);
  const used = new Set(first);
  for (const index of first) assign[index] = 1;
  const rest = [];
  const restIndex = [];
  atoms.forEach((atom, index) => {
    if (!used.has(index)) {
      rest.push(atom);
      restIndex.push(index);
    }
  });
  for (const local of chooseSubset(rest, TARGET)) assign[restIndex[local]] = 2;
  return assign;
}

function sumsOf(atoms, assign) {
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < atoms.length; i++) {
    if (assign[i] === 1) s1 += atoms[i].cents;
    else if (assign[i] === 2) s2 += atoms[i].cents;
  }
  return { s1, s2 };
}

function searchAssignment(atoms) {
  if (!atoms.length) return { assign: [], feasible: false, assignment: 'exact-best-effort' };
  if (atoms.length <= EXACT_LIMIT) return bruteSearch(atoms);
  if (atoms.length > PIECE_LIMIT) {
    throw new Error(
      `Too many unplaced pieces (${atoms.length}). Keep the sheet to ${PIECE_LIMIT} pieces or fewer, and leave allowSplit off unless a row's qty is at most 8.`,
    );
  }
  const feasibleAssign = mimSearch(atoms);
  if (feasibleAssign) return { assign: feasibleAssign, feasible: true, assignment: 'meet-in-the-middle' };
  const assign = sequentialBestEffort(atoms);
  const sums = sumsOf(atoms, assign);
  if (sums.s1 >= TARGET && sums.s2 >= TARGET) {
    throw new Error('internal: best-effort found a feasible pair the search missed');
  }
  return { assign, feasible: false, assignment: 'sequential-best-effort' };
}

function atomsFromLines(lines) {
  const atoms = [];
  for (const line of lines) {
    if (line.alreadyPlaced) continue;
    for (const piece of line.pieces) {
      atoms.push({
        lineId: line.lineId,
        orderDate: line.orderDate,
        orderNumber: line.orderNumber,
        sku: line.sku,
        productName: line.productName,
        qty: piece.qty,
        cents: piece.cents,
        personalUse: line.personalUse,
        unitProductAmountHkd: line.unitProductAmountHkd,
        costHkd: line.costHkd,
        retailHkd: line.retailHkd,
        ignoredCharges: line.ignoredCharges,
      });
    }
  }
  return atoms;
}

function collapseAtoms(atoms) {
  const grouped = new Map();
  for (const atom of atoms) {
    let group = grouped.get(atom.lineId);
    if (!group) {
      group = { ...atom, qty: 0, cents: 0 };
      grouped.set(atom.lineId, group);
    }
    group.qty += atom.qty;
    group.cents += atom.cents;
  }
  return [...grouped.values()].sort((a, b) => {
    const date = String(a.orderDate).localeCompare(String(b.orderDate));
    if (date) return date;
    const order = String(a.orderNumber).localeCompare(String(b.orderNumber));
    if (order) return order;
    return String(a.sku).localeCompare(String(b.sku));
  });
}

function toLine(group) {
  const line = {
    orderDate: group.orderDate,
    orderNumber: group.orderNumber,
    sku: group.sku,
    productName: group.productName,
    qty: group.qty,
    unitProductAmountHkd: group.unitProductAmountHkd,
    lineProductTotalHkd: centsToHkd(group.cents),
    personalUse: group.personalUse,
  };
  if (group.costHkd != null) line.costHkd = group.costHkd;
  if (group.retailHkd != null) line.retailHkd = group.retailHkd;
  if (group.ignoredCharges) line.ignoredCharges = group.ignoredCharges;
  return line;
}

function toBlock(atoms, { qualify }) {
  const collapsed = collapseAtoms(atoms);
  const cents = collapsed.reduce((sum, line) => sum + line.cents, 0);
  const personalCents = collapsed.reduce((sum, line) => sum + (line.personalUse ? line.cents : 0), 0);
  const block = {
    productTotalHkd: centsToHkd(cents),
    lines: collapsed.map(toLine),
    personalUseHkd: centsToHkd(personalCents),
  };
  if (qualify) {
    block.meetsMinimum = cents >= TARGET;
    block.shortfallHkd = centsToHkd(Math.max(0, TARGET - cents));
  }
  return { block, cents, personalCents };
}

function groupKey(atoms) {
  return collapseAtoms(atoms)
    .map((line) => `${line.orderNumber}|${line.sku}|${line.qty}`)
    .join(',');
}

function personalUseChecks(cents1, personal1, cents2, personal2) {
  const total = cents1 + cents2;
  const personal = personal1 + personal2;
  const withinQuarterlyCap = total === 0 || personal * PERSONAL_FRACTION_DEN <= total * PERSONAL_FRACTION_NUM;
  const perReceipt = [
    { receipt: 1, personalUseHkd: centsToHkd(personal1), withinPerOrderCap: personal1 <= PERSONAL_ORDER_CAP },
    { receipt: 2, personalUseHkd: centsToHkd(personal2), withinPerOrderCap: personal2 <= PERSONAL_ORDER_CAP },
  ];
  return {
    appliesTo: 'assembled receipts only, not a live quarterly balance',
    personalUseMaxFraction: 0.3,
    perOrderMaxHkd: 450,
    qualifyingProductTotalHkd: centsToHkd(total),
    personalUseHkd: centsToHkd(personal),
    personalUseFraction: total > 0 ? Math.round((personal / total) * 10000) / 10000 : null,
    withinQuarterlyCap,
    perReceipt,
    ok: withinQuarterlyCap && perReceipt.every((receipt) => receipt.withinPerOrderCap),
    advice: 'Checks only. This tool does not recommend personal purchases to fill a gap.',
  };
}

function shortfallMessage(totalUnplacedCents, gap1, gap2) {
  const totalShort = Math.max(0, TARGET * 2 - totalUnplacedCents);
  if (totalShort > 0) {
    return `No feasible pair: unplaced product total is HKD ${money(centsToHkd(totalUnplacedCents))}, short by HKD ${money(centsToHkd(totalShort))} of the HKD 3000.00 needed for two receipts at HKD 1500.00 each.`;
  }
  return `No feasible pair: unplaced product total can cover HKD 3000.00 in aggregate, but these lines cannot be partitioned into two receipts of HKD 1500.00 each without splitting a line. Best-effort receipt gaps are HKD ${money(centsToHkd(gap1))} and HKD ${money(centsToHkd(gap2))}.`;
}

export function formatForm1000Report(result) {
  const lines = [
    'Form 1000 receipt optimiser (dry-run)',
    'No Form 1000 assign, no Form 1000 submit, and no place-order.',
    '',
    `Feasible: ${result.feasible ? 'yes' : 'no'}`,
    `Both receipts meet >= HKD 1500.00: ${result.bothMeetMinimum ? 'yes' : 'no'}`,
    '',
  ];
  if (!result.feasible) lines.push('Best effort below is not a filing.');
  lines.push(formatBlock('Receipt 1', result.receipt1, true));
  lines.push('');
  lines.push(formatBlock('Receipt 2', result.receipt2, true));
  lines.push('');
  lines.push(formatBlock('Leftover unplaced', result.leftover, false));
  if (result.excludedAlreadyPlaced.length) {
    lines.push('');
    lines.push('Ignored already placed:');
    for (const line of result.excludedAlreadyPlaced) {
      lines.push(`  - ${line.orderNumber} ${line.sku} HKD ${money(line.lineProductTotalHkd)}`);
    }
  }
  if (result.shortfall) {
    lines.push('');
    lines.push(result.shortfall.message);
    lines.push(
      `Receipt shortfalls: HKD ${money(result.shortfall.receiptShortfallsHkd[0])} and HKD ${money(result.shortfall.receiptShortfallsHkd[1])}.`,
    );
  }
  lines.push('');
  const checks = result.personalUseChecks;
  const observed =
    checks.personalUseFraction == null ? 'n/a' : `${(checks.personalUseFraction * 100).toFixed(1)}%`;
  lines.push(`Personal-use checks: ${checks.ok ? 'ok' : 'review'}`);
  lines.push(
    `  personal use HKD ${money(checks.personalUseHkd)} of assembled product HKD ${money(checks.qualifyingProductTotalHkd)} (cap 30%, observed ${observed})`,
  );
  lines.push(
    `  per-receipt personal use <= HKD 450.00: ${checks.perReceipt.every((receipt) => receipt.withinPerOrderCap) ? 'yes' : 'no'}`,
  );
  lines.push(`  ${checks.advice}`);
  lines.push('');
  lines.push(
    'Unplaced Form 1000 orders are listed at forms.unf1000. On-hand stock for a new sales receipt is moe.unfMOEPCSelect then moe.unfMOEPCSelectU. This run did not open or submit either flow.',
  );
  if (result.note) lines.push(result.note);
  return lines.join('\n');
}

function formatBlock(title, block, qualify) {
  const head = `${title} — product total HKD ${money(block.productTotalHkd)}`;
  const status = qualify
    ? block.meetsMinimum
      ? 'meets >= HKD 1500.00'
      : `short by HKD ${money(block.shortfallHkd)}`
    : 'not a receipt';
  const body = block.lines.length
    ? block.lines
        .map((line) => {
          const date = line.orderDate ? `${line.orderDate} ` : '';
          const order = line.orderNumber ? `${line.orderNumber} ` : '';
          const name = line.productName ? ` ${line.productName}` : '';
          return `  - ${date}${order}${line.sku}${name} qty ${line.qty} HKD ${money(line.lineProductTotalHkd)}`;
        })
        .join('\n')
    : '  (none)';
  return `${head} (${status})\n${body}`;
}

function buildResult(lines, atoms, found) {
  const buckets = [[], [], []];
  for (let i = 0; i < atoms.length; i++) buckets[found.assign[i] ?? 0].push(atoms[i]);
  let first = 1;
  let second = 2;
  const sum1 = buckets[1].reduce((sum, atom) => sum + atom.cents, 0);
  const sum2 = buckets[2].reduce((sum, atom) => sum + atom.cents, 0);
  const key1 = groupKey(buckets[1]);
  const key2 = groupKey(buckets[2]);
  if (sum2 < sum1 || (sum2 === sum1 && key2 < key1)) {
    first = 2;
    second = 1;
  }
  const receipt1 = toBlock(buckets[first], { qualify: true });
  const receipt2 = toBlock(buckets[second], { qualify: true });
  const leftover = toBlock(buckets[0], { qualify: false });
  const totalUnplacedCents = lines.filter((line) => !line.alreadyPlaced).reduce((sum, line) => sum + line.productCents, 0);
  const gap1 = Math.max(0, TARGET - receipt1.cents);
  const gap2 = Math.max(0, TARGET - receipt2.cents);
  const feasible = found.feasible && gap1 === 0 && gap2 === 0;
  const result = {
    dryRun: true,
    submitted: false,
    assigned: false,
    placedOrder: false,
    network: false,
    objective: {
      receipts: 2,
      minProductTotalHkdEach: TARGET_HKD,
      excludes: 'shipping, tax, and fees',
      siteResearchRule:
        'Site research also describes a Form 1000 rule of at least 2 orders with a combined product total >= HKD 1500, excluding shipping, tax, and fees. This tool defaults to two receipts of >= HKD 1500 each.',
    },
    feasible,
    bothMeetMinimum: feasible,
    assignment: found.assignment,
    receipt1: receipt1.block,
    receipt2: receipt2.block,
    leftover: leftover.block,
    excludedAlreadyPlaced: lines
      .filter((line) => line.alreadyPlaced)
      .map((line) => ({
        orderNumber: line.orderNumber,
        sku: line.sku,
        productName: line.productName,
        lineProductTotalHkd: centsToHkd(line.productCents),
      })),
    personalUseChecks: personalUseChecks(receipt1.cents, receipt1.personalCents, receipt2.cents, receipt2.personalCents),
    shortfall: feasible
      ? null
      : {
          message: shortfallMessage(totalUnplacedCents, gap1, gap2),
          totalUnplacedProductHkd: centsToHkd(totalUnplacedCents),
          neededForTwoReceiptsHkd: TARGET_HKD * 2,
          totalShortfallHkd: centsToHkd(Math.max(0, TARGET * 2 - totalUnplacedCents)),
          receiptShortfallsHkd: [centsToHkd(gap1), centsToHkd(gap2)],
          bestEffortExact: found.assignment !== 'sequential-best-effort',
        },
    sources: {
      form1000UnplacedOrders: 'forms.unf1000',
      salesReceiptInventory: ['moe.unfMOEPCSelect', 'moe.unfMOEPCSelectU'],
      notOpened: 'moe.unfMOEFinalPreview',
      fetched: false,
    },
  };
  result.report = formatForm1000Report(result);
  return result;
}

export function optimiseForm1000(rows) {
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  const lines = rows.map((row, index) => normaliseSheetRow(row, index));
  const atoms = atomsFromLines(lines);
  const found = searchAssignment(atoms);
  return buildResult(lines, atoms, found);
}

export function optimiseForm1000Input({ fixturePath, csvText, rows, confirm } = {}) {
  const provided = [
    fixturePath != null && fixturePath !== '',
    csvText != null && csvText !== '',
    rows != null,
  ].filter(Boolean).length;
  if (provided !== 1) throw new Error('Provide exactly one of fixturePath, csvText, or rows');
  let sourceRows;
  if (fixturePath) {
    return finish(optimiseForm1000(loadFixture(fixturePath)), confirm);
  }
  if (csvText != null) {
    sourceRows = loadCsv(csvText);
    return finish(optimiseForm1000(sourceRows), confirm);
  }
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  return finish(optimiseForm1000(rows), confirm);
}

function finish(result, confirm) {
  if (confirm !== undefined) {
    result.note = 'confirm is ignored. This tool never submits, assigns, or places an order.';
    result.report = formatForm1000Report(result);
  }
  return result;
}

function loadFixture(filePath) {
  return loadSheetFromFile(filePath);
}

function loadCsv(csvText) {
  if (typeof csvText !== 'string') throw new Error('csvText must be a string');
  return loadSheetFromCsv(csvText);
}
