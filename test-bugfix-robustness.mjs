import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { parseCheckoutPage, checkoutMapBlocker } from './lib/parse-checkout.js';
import { liveBlockerHint } from './lib/tools.js';
import { parseSearchResults } from './lib/client.js';
import { actionUrl } from './lib/urls.js';
import { runForm1000QuartersCli } from './lib/form1000-cli.js';

const billShipUrl = 'https://hk.unfranchise.com/index.cfm?action=orders.unfBillShip';

function assertBlockerNull(html) {
  const parsed = parseCheckoutPage(load(html));
  assert.equal(
    checkoutMapBlocker(parsed, billShipUrl),
    null,
    `expected null blocker for embedded-only marker in: ${html.slice(0, 80)}...`,
  );
}

// F6 — login / empty-cart detection ignores script/style/noscript/template text
{
  const base =
    '<form name="billShip" action="index.cfm?action=orders.unfBillShip"><input name="shipType"><input name="contactPhone"><input name="pickUp">';
  const end = '</form>';
  assertBlockerNull(`${base}<script>var a = "main.unfLogin";</script>${end}`);
  assertBlockerNull(`${base}<script>你的購物車是空的</script>${end}`);
  assertBlockerNull(`${base}<style>main.unfLogin</style>${end}`);
  assertBlockerNull(`${base}<style>你的購物車是空的</style>${end}`);
  assertBlockerNull(`${base}<noscript>main.unfLogin</noscript>${end}`);
  assertBlockerNull(`${base}<noscript>你的購物車是空的</noscript>${end}`);
  assertBlockerNull(`${base}<template>main.unfLogin</template>${end}`);
  assertBlockerNull(`${base}<template>你的購物車是空的</template>${end}`);

  assert.equal(
    checkoutMapBlocker(parseCheckoutPage(load('<html><body>你的購物車是空的</body></html>'))),
    'empty_cart',
  );
}

// F7 — LIVE_BLOCKER_HINT covers all blockers and unknown keys
{
  const known = ['login_required', 'empty_cart', 'no_checkout_form', 'not_checkout_form'];
  for (const key of known) {
    const hint = liveBlockerHint(key);
    assert.ok(typeof hint === 'string' && hint.length > 0, `hint for ${key}`);
    assert.ok(!hint.includes('undefined'), `hint must not contain undefined for ${key}`);
  }
  const unknown = liveBlockerHint('totally_unknown_blocker');
  assert.ok(unknown.length > 0);
  assert.ok(!unknown.includes('undefined'));
}

// F8 — malformed skuID does not abort search
{
  const variants = [
    '<a href="index.cfm?action=shopping.unfProduct&skuID=100%">Good</a><a href="index.cfm?action=shopping.unfProduct&skuID=HK1">Other</a>',
    '<a href="index.cfm?action=shopping.unfProduct&skuID=%E0%A4%A">A</a><a href="index.cfm?action=shopping.unfProduct&skuID=HK1">Other</a>',
    '<a href="index.cfm?action=shopping.unfProduct&skuID=%%">B</a><a href="index.cfm?action=shopping.unfProduct&skuID=HK1">Other</a>',
    '<a href="index.cfm?action=shopping.unfProduct&skuID=%zz">C</a><a href="index.cfm?action=shopping.unfProduct&skuID=HK1">Other</a>',
  ];
  for (const html of variants) {
    const items = parseSearchResults(load(html));
    assert.ok(items.some((it) => it.skuID === 'HK1'), 'HK1 present');
    assert.ok(items.length >= 2, 'at least two items');
  }
  const primary = parseSearchResults(
    load(
      '<a href="index.cfm?action=shopping.unfProduct&skuID=100%">Good</a><a href="index.cfm?action=shopping.unfProduct&skuID=HK1">Other</a>',
    ),
  );
  assert.ok(primary.some((it) => it.skuID === '100%'));
  assert.ok(primary.some((it) => it.skuID === 'HK1'));
}

// F9 — actionUrl splits query pairs at first '=' only
{
  assert.equal(
    new URL(actionUrl('shopping.unfProduct&skuID=A=B')).searchParams.get('skuID'),
    'A=B',
  );
  assert.equal(new URL(actionUrl('shopping.unfProduct&k=')).searchParams.get('k'), '');
  assert.equal(new URL(actionUrl('shopping.unfProduct&k')).searchParams.get('k'), '');
  assert.equal(new URL(actionUrl('shopping.unfProduct&k==')).searchParams.get('k'), '=');
  assert.equal(
    new URL(actionUrl('shopping.unfProduct&skuID=HK1')).searchParams.get('skuID'),
    'HK1',
  );
}

// F10 — trailing --out without path is a usage error
{
  const origErr = console.error;
  const origLog = console.log;
  try {
    const chunks = [];
    console.error = (...args) => chunks.push(args.join(' '));
    console.log = () => {};
    assert.equal(runForm1000QuartersCli(['record', '01/01/2026-31/03/2026', '--out']), 2);
    assert.ok(chunks.some((c) => /usage/i.test(c)), '--out alone should print usage');
    chunks.length = 0;
    assert.equal(
      runForm1000QuartersCli(['record', '01/01/2026-31/03/2026', '--out', '--x']),
      2,
    );
    chunks.length = 0;
    console.log = (...args) => chunks.push(args.join(' '));
    assert.equal(runForm1000QuartersCli(['record', '01/01/2026-31/03/2026']), 0);
    assert.ok(chunks.some((c) => c.includes('Not saved')), 'preview without --out');
  } finally {
    console.error = origErr;
    console.log = origLog;
  }
}

console.log('bugfix-robustness: ok');
