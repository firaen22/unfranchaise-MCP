import assert from 'node:assert/strict';
import { assertSafePostRedirect, assertSafeReadRedirect, publicErrorMessage } from './lib/validate.js';
import { unfFetch } from './lib/client.js';
import {
  assertCaptureJsonSafe,
  redactActionString,
  redactSessionTokensInText,
  redactSessionTokensInUrl,
} from './lib/redact.js';
import { parseHkdToCents } from './lib/form1000-sheet.js';
import { form1000QualifyingOrders } from './lib/volume.js';
import { optimiseForm1000 } from './lib/form1000-optimise.js';

const expectThrows = (fn, pattern) => assert.throws(fn, pattern);
const expectSafe = (fn) => assert.doesNotThrow(fn);

for (const url of [
  'https://hk.unfranchise.com/index.cfm?Action=express.unfProcessExpressOrder',
  'https://hk.unfranchise.com/index.cfm?action=shopping.unfViewCart&action=express.unfProcessExpressOrder',
  'https://hk.unfranchise.com/index.cfm?action=&action=express.unfProcessExpressOrder',
  'https://hk.unfranchise.com/index.cfm?action=shopping.unfViewCart,express.unfProcessExpressOrder',
  'https://hk.unfranchise.com/index.cfm',
]) expectThrows(() => assertSafePostRedirect(url), /POST redirect/);
for (const url of [
  'https://hk.unfranchise.com/index.cfm?action=shopping.unfViewCart',
  'https://hk.unfranchise.com/index.cfm?ACTION=shopping.unfViewCart',
]) assert.equal(assertSafePostRedirect(url), url);
assert.equal(assertSafeReadRedirect('https://hk.unfranchise.com/index.cfm'), 'https://hk.unfranchise.com/index.cfm');
expectThrows(() => assertSafeReadRedirect('https://hk.unfranchise.com/index.cfm?aCtIoN=forms.unf1000Assign'), /read-only redirect/);
assert.equal(
  assertSafeReadRedirect('https://hk.unfranchise.com/index.cfm?action=orders.unfBillShip'),
  'https://hk.unfranchise.com/index.cfm?action=orders.unfBillShip',
);

const realFetch = globalThis.fetch;
try {
  const calls = [];
  const redirectTargets = ['?action=orders.unfBillShip', '?action=orders.unfBillShip', '?action=shopping.unfViewCart'];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const target = redirectTargets.shift();
    return target ? new Response('', { status: 307, headers: { location: target } }) : new Response('ok', { status: 200 });
  };
  await assert.rejects(
    () => unfFetch('https://hk.unfranchise.com/index.cfm', { method: 'post', body: { secret: 'X' }, cookie: 'a=b' }),
    (err) => err.code === 'UNF_BAD_URL',
  );
  assert.equal(calls.length, 1);
  calls.length = 0;
  await assert.rejects(
    () => unfFetch('https://hk.unfranchise.com/index.cfm', { method: 'POST', cookie: 'a=b' }),
    (err) => err.code === 'UNF_BAD_URL',
  );
  assert.equal(calls.length, 1);
  calls.length = 0;
  const allowed = await unfFetch('https://hk.unfranchise.com/index.cfm', { method: 'post', cookie: 'a=b' });
  assert.equal(allowed.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.method, 'POST');
  assert.equal(calls[1].url, 'https://hk.unfranchise.com/index.cfm?action=shopping.unfViewCart');
} finally {
  globalThis.fetch = realFetch;
}

function assertNoSecret(output, ...secrets) {
  const decode = (value) => {
    try { return decodeURIComponent(value); } catch { return value; }
  };
  for (const secret of secrets) {
    assert.doesNotMatch(output, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(decode(output), new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(decode(decode(output)), new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}
const redacted = [];
redacted.push(redactActionString('orders.unfBillShip?next=safe&next=phone%3D91234567'));
redacted.push(redactSessionTokensInUrl('https://hk.unfranchise.com/?next=' + encodeURIComponent('https://hk.unfranchise.com/?a=ok&a=' + encodeURIComponent('cf_clearance=SESSION_CANARY'))));
redacted.push(redactActionString('orders.unfBillShip?next=' + encodeURIComponent('https://hk.unfranchise.com/?x=1#email=alice@example.com')));
redacted.push(redactSessionTokensInText('cf_clearance="secret_token"; __cf_bm="bm_secret"'));
redacted.push(publicErrorMessage(new Error('Fetch failed for https://hk.unfranchise.com/index.cfm?phone=91234567&email=user@example.com')));
redacted.push(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#?phone=91234567'));
redacted.push(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?%252543FID=SECRET'));
redacted.push(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?%252543FTOKEN=SECRET'));
redacted.push(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?%25254aSESSIONID=SECRET'));
redacted.push(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?action=orders.unfBillShip&shpCountry=HK-SECRET&mCountry=HK-SECRET'));
redacted.push(redactActionString('orders.unfBillShip?CFID=12345&step=review'));
for (const output of redacted) expectSafe(() => assertCaptureJsonSafe({ output }));
assertNoSecret(redacted[0], '91234567');
assert.match(redacted[0], /next=safe/);
assertNoSecret(redacted[1], 'SESSION_CANARY');
assertNoSecret(redacted[2], 'alice@example.com');
assertNoSecret(redacted[3], 'secret_token', 'bm_secret');
assertNoSecret(redacted[4], '91234567', 'user@example.com');
assert.match(redacted[4], /Fetch failed for/);
const embeddedText = publicErrorMessage(new Error('Fetch failed for index.cfm?phone=1&email=a@b.co'));
assert.match(embeddedText, /^Fetch failed for /);
assertNoSecret(embeddedText, '1', 'a@b.co');
assertNoSecret(redacted[5], '91234567');
assertNoSecret(redacted[6], 'SECRET');
assertNoSecret(redacted[7], 'SECRET');
assertNoSecret(redacted[8], 'SECRET');
assertNoSecret(redacted[9], 'HK-SECRET');
assertNoSecret(redacted[10], '12345');
assert.match(redacted[10], /step=review/);
assert.equal(
  redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?action=shopping.unfViewCart#top'),
  'https://hk.unfranchise.com/index.cfm?action=shopping.unfViewCart#top',
);
assert.equal(
  redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#?phone=1&x=2'),
  'https://hk.unfranchise.com/index.cfm#?phone=%5BREDACTED%5D&x=2',
);
assertNoSecret(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#email=a@b.co'), 'a@b.co');
assert.equal(
  redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#section-2'),
  'https://hk.unfranchise.com/index.cfm#section-2',
);
assert.equal(redactSessionTokensInUrl('orders.unfBillShip#step2'), 'orders.unfBillShip#step2');
const requiredRedactionInputs = [
  ['url', 'https://hk.unfranchise.com/index.cfm?cf_clearance%3DSESSION_CANARY'],
  ['url', 'https://hk.unfranchise.com/index.cfm?phone%3D91234567'],
  ['url', 'https://hk.unfranchise.com/index.cfm?phone%253D91234567'],
  ['url', 'https://hk.unfranchise.com/index.cfm?shpCountry%3DHK-SECRET'],
  ['url', 'https://hk.unfranchise.com/index.cfm?CFID+=SECRETVALUE'],
  ['text', 'cf_clearance%3DSESSION_CANARY'],
  ['action', 'orders.unfBillShip?phone=91234567&next=https://hk.unfranchise.com/?CFID=SECRET'],
  ['url', 'https://hk.unfranchise.com/?next=index.cfm%3Fx%3D1%23email%3Dalice%40example.com'],
  ['url', 'https://hk.unfranchise.com/?next=' + encodeURIComponent('page?x=1#phone=91234567')],
  ['url', 'https://hk.unfranchise.com/?next=' + encodeURIComponent('foo#bar?phone=91234567')],
  ['url', 'https://hk.unfranchise.com/?next=' + encodeURIComponent('page?x=1#cf_clearance%3DSESSION_CANARY')],
  ['url', 'https://hk.unfranchise.com/index.cfm#/checkout?phone=91234567&shpCountry=HK-SECRET'],
  ['url', 'phone=91234567 https://hk.unfranchise.com/?CFID=SECRET'],
];
for (const [kind, input] of requiredRedactionInputs) {
  const output = kind === 'url' ? redactSessionTokensInUrl(input) : kind === 'action' ? redactActionString(input) : redactSessionTokensInText(input);
  assertNoSecret(output, 'SESSION_CANARY', '91234567', 'HK-SECRET', 'SECRETVALUE', 'SECRET', 'alice@example.com');
  expectSafe(() => assertCaptureJsonSafe({ output }));
  expectThrows(() => assertCaptureJsonSafe({ input }));
}

let fuzzSeed = 0x61f00d;
const fuzzNames = ['CFID', 'cf_clearance', 'email', 'phone', 'shpCountry'];
const fuzzSeparators = ['=', '%3D', '+=', ' = '];
for (let i = 0; i < 300; i++) {
  fuzzSeed = (fuzzSeed * 1664525 + 1013904223) >>> 0;
  const name = fuzzNames[fuzzSeed % fuzzNames.length];
  fuzzSeed = (fuzzSeed * 1664525 + 1013904223) >>> 0;
  const separator = fuzzSeparators[fuzzSeed % fuzzSeparators.length];
  const secret = `FUZZ_SECRET_${i}`;
  let input = `${name}${separator}${secret}`;
  fuzzSeed = (fuzzSeed * 1664525 + 1013904223) >>> 0;
  const shape = fuzzSeed % 5;
  if (shape === 0) input = `https://hk.unfranchise.com/index.cfm?${input}`;
  else if (shape === 1) input = `https://hk.unfranchise.com/index.cfm#${input}`;
  else if (shape === 2) input = `https://hk.unfranchise.com/index.cfm#?${input}`;
  else if (shape === 3) input = `https://hk.unfranchise.com/index.cfm#/route?${input}`;
  else {
    let nested = input;
    for (let depth = 0; depth < 1 + (fuzzSeed % 3); depth++) nested = encodeURIComponent(nested);
    input = `https://hk.unfranchise.com/index.cfm?next=${nested}`;
  }
  const output = redactSessionTokensInUrl(input);
  assertNoSecret(output, secret);
  assertNoSecret(output, encodeURIComponent(secret));
  expectSafe(() => assertCaptureJsonSafe({ output }));
}
for (const raw of [
  'https://hk.unfranchise.com/?next=' + encodeURIComponent('https://hk.unfranchise.com/?x=1#cf_clearance=SESSION_RAW'),
  'https://hk.unfranchise.com/index.cfm?%252543FID=SECRET',
]) expectThrows(() => assertCaptureJsonSafe({ url: raw }));
expectThrows(() => assertCaptureJsonSafe({ url: 'user%40example.com' }), /email-like/);
expectThrows(() => assertCaptureJsonSafe({ text: 'cf_clearance%3DSESSION_CANARY' }), /session token pattern/);
expectThrows(() => assertCaptureJsonSafe({ text: 'phone%3D91234567' }), /PII parameter/);
expectSafe(() => assertCaptureJsonSafe({ text: 'cf_clearance%3D%5BREDACTED%5D%3B Path%3D%2F' }));
expectSafe(() => assertCaptureJsonSafe({ text: 'CFID=[REDACTED]; Path=/' }));

assert.equal(parseHkdToCents(1.015, 'x'), 102);
assert.equal(parseHkdToCents(10.075, 'x'), 1008);
assert.equal(parseHkdToCents(0.005, 'x'), 1);
assert.equal(parseHkdToCents(0.004, 'x'), 0);
assert.equal(parseHkdToCents(-1.015, 'x'), -102);
assert.equal(parseHkdToCents(1500, 'x'), 150000);
assert.equal(parseHkdToCents(1e12, 'x'), 1e14);
expectThrows(() => parseHkdToCents(1e12 + 1, 'x'), /within ±1e12/);
assert.equal(parseHkdToCents(1e-7, 'x'), 0);
assert.equal(parseHkdToCents(5e-7, 'x'), 0);
assert.equal(parseHkdToCents(1.00499999999, 'x'), 100);
for (let i = 0; i < 2000; i++) {
  const v = Math.round(Math.random() * 1e8) / 1000 * (Math.random() < 0.5 ? -1 : 1);
  assert.equal(parseHkdToCents(v, 'x'), parseHkdToCents(String(v), 'x'));
}
assert.equal(optimiseForm1000([
  { sku: 'A', qty: 1483, unitProductAmountHkd: 1.015 },
  { sku: 'B', qty: 1483, unitProductAmountHkd: 1.015 },
]).feasible, true);

assert.deepEqual(form1000QualifyingOrders([1499, ...Array(10).fill(0.1)]), {
  orderCount: 11,
  productTotalHkd: 1500,
  meetsRule: true,
  rule: '≥2 orders, product total ≥ HK$1500',
});
assert.equal(form1000QualifyingOrders([750, 749.99]).meetsRule, false);
assert.equal(form1000QualifyingOrders([]).productTotalHkd, 0);
assert.deepEqual(form1000QualifyingOrders([749.995, 749.995]), {
  orderCount: 2, productTotalHkd: 1499.99, meetsRule: false, rule: '≥2 orders, product total ≥ HK$1500',
});
assert.deepEqual(form1000QualifyingOrders([1499.999, 0.001]), {
  orderCount: 2, productTotalHkd: 1500, meetsRule: true, rule: '≥2 orders, product total ≥ HK$1500',
});
expectThrows(() => form1000QualifyingOrders([1e12 + 1]), /within ±1e12/);

// R4 regression cases: these assertions are intentionally added before the fixes.
const assertLeakFreeAndGated = (input, output, ...secrets) => {
  expectThrows(() => assertCaptureJsonSafe({ text: input }));
  expectSafe(() => assertCaptureJsonSafe({ text: output }));
  assertNoSecret(output, ...secrets);
};

for (const [input, secret] of [
  ['bad%zz %63f_clearance%3DSECRET', 'SECRET'],
  ['100% cf_clearance%253DSESSION_CANARY', 'SESSION_CANARY'],
  ['100% phone%253D91234567', '91234567'],
  ['%%phone%253D91234567', '91234567'],
]) {
  assertLeakFreeAndGated(input, redactSessionTokensInText(input), secret);
}
assert.equal(redactSessionTokensInText('100% sure, step=review'), '100% sure, step=review');
expectSafe(() => assertCaptureJsonSafe({ text: '100% off today' }));

for (const sep of ['%09', '%0A', '%0B', '%0C', '%20']) {
  const phoneUrl = `https://hk.unfranchise.com/index.cfm?phone${sep}=91234567`;
  const cfidUrl = `https://hk.unfranchise.com/index.cfm?CFID${sep}=SESSIONTOKEN`;
  assertLeakFreeAndGated(phoneUrl, redactSessionTokensInUrl(phoneUrl), '91234567');
  assertLeakFreeAndGated(cfidUrl, redactSessionTokensInUrl(cfidUrl), 'SESSIONTOKEN');
}
const clearanceUrl = 'https://hk.unfranchise.com/index.cfm?cf_clearance%0B=SESSION_CANARY';
assertLeakFreeAndGated(clearanceUrl, redactSessionTokensInUrl(clearanceUrl), 'SESSION_CANARY');
for (const sep of ['\t', '\n', '\v', '\f', ' ']) {
  const input = `phone${sep}=${sep}91234567`;
  assertLeakFreeAndGated(input, redactSessionTokensInText(input), '91234567');
}

for (const [input, secrets] of [
  ['shipAddress1="123 Main Street"', ['123', 'Main', 'Street']],
  ['phone="9123 4567"', ['9123', '4567']],
  ["phone='9123 4567' next=ok", ['9123', '4567']],
  ['cf_clearance="a b c"', ['a b', ' b c']],
  ['phone="unterminated secret', ['unterminated', 'secret']],
]) {
  const output = redactSessionTokensInText(input);
  assertLeakFreeAndGated(input, output, ...secrets);
}
assert.match(redactSessionTokensInText("phone='9123 4567' next=ok"), /next=ok/);

assert.equal(
  redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#/route?step=review'),
  'https://hk.unfranchise.com/index.cfm#/route?step=review',
);
const routeOutput = redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#/route?step=review&phone=91234567');
assertLeakFreeAndGated('https://hk.unfranchise.com/index.cfm#/route?step=review&phone=91234567', routeOutput, '91234567');
assert.match(routeOutput, /#\/route\?/);
assert.match(routeOutput, /step=review/);
assert.equal(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm#top'), 'https://hk.unfranchise.com/index.cfm#top');

for (const action of ['shopping.unfViewCart,cfid=123456789', 'phone=91234567', '<script>']) {
  let err;
  try { assertSafePostRedirect(`https://hk.unfranchise.com/index.cfm?action=${encodeURIComponent(action)}`); }
  catch (caught) { err = caught; }
  assert.ok(err);
  const message = publicErrorMessage(err);
  assert.match(message, /POST redirect/);
  assert.doesNotMatch(message, /123456789|91234567|script/);
}
let readErr;
try { assertSafeReadRedirect('https://hk.unfranchise.com/index.cfm?action=forms.unf1000Assign'); }
catch (caught) { readErr = caught; }
assert.ok(readErr);
assert.match(publicErrorMessage(readErr), /read-only redirect/);

assert.deepEqual(form1000QualifyingOrders([749.9999999, 749.9999999]), {
  orderCount: 2, productTotalHkd: 1499.9999998, meetsRule: false, rule: '≥2 orders, product total ≥ HK$1500',
});
assert.deepEqual(form1000QualifyingOrders([1e-7, 1]), {
  orderCount: 2, productTotalHkd: 1.0000001, meetsRule: false, rule: '≥2 orders, product total ≥ HK$1500',
});
assert.deepEqual(form1000QualifyingOrders([1499.9999999, 1e-7]), {
  orderCount: 2, productTotalHkd: 1500, meetsRule: true, rule: '≥2 orders, product total ≥ HK$1500',
});
assert.deepEqual(form1000QualifyingOrders([5e-324, 1500]), {
  orderCount: 2, productTotalHkd: 1500, meetsRule: true, rule: '≥2 orders, product total ≥ HK$1500',
});


// Benign input stays byte-identical (no gratuitous percent-decoding).
for (const [fn, input] of [
  [redactSessionTokensInText, '100%25 off'],
  [redactSessionTokensInUrl, 'https://hk.unfranchise.com/index.cfm?q=a%20b'],
  [redactSessionTokensInUrl, 'https://hk.unfranchise.com/index.cfm?action=shopping.unfProduct&skuID=A%26B'],
  [redactActionString, 'shopping.unfSearch?q=100%25+off&x=%26'],
]) assert.equal(fn(input), input);
assert.match(redactSessionTokensInUrl('https://hk.unfranchise.com/index.cfm?q=a%20b&phone=91234567'), /q=a%20b&phone=(%5B|\[)REDACTED/);

// Round-3 review: value boundaries, exact placeholder, adjacent assignments, action fragments, empty fragment.
{
  const gateOk = (x) => { try { assertCaptureJsonSafe({ text: x }); return true; } catch { return false; } };
  for (const [fn, input, secrets] of [
    [redactSessionTokensInText, 'cf_clearance=ABC%2BDEF', ['ABC', 'DEF']],
    [redactSessionTokensInText, 'phone=9123%204567', ['9123', '4567']],
    [redactSessionTokensInText, 'cf_clearance="[REDACTED] LIVE_SECRET"', ['LIVE_SECRET']],
    [redactSessionTokensInText, 'CFID="FIRST"CFTOKEN=SECRET', ['FIRST', 'SECRET']],
    [redactActionString, 'orders.unfBillShip?next=foo#phone=91234567', ['91234567']],
  ]) {
    assert.equal(gateOk(input), false, input);
    const out = fn(input);
    for (const secret of secrets) assert.ok(!out.includes(secret) && !decodeURIComponent(out).includes(secret), `${input} -> ${out}`);
    assert.equal(gateOk(out), true, out);
  }
  assert.equal(redactSessionTokensInUrl('https://hk.unfranchise.com/?x=1#'), 'https://hk.unfranchise.com/?x=1#');
}

// Round-3 grok review: encoded '+'/'%2B' tails, hidden '=' in one token, invisible separators, deep encodings.
{
  const gateOk = (x) => { try { assertCaptureJsonSafe({ text: x }); return true; } catch { return false; } };
  for (const [fn, input, secrets] of [
    [redactSessionTokensInText, '__cf_bm=AbC123+Def/Ghi==', ['Def', 'Ghi']],
    [redactSessionTokensInText, 'phone=9123%2B4567', ['4567']],
    [redactSessionTokensInUrl, 'https://hk.unfranchise.com/index.cfm?cf_clearance%3DAbC+Def', ['AbC', 'Def']],
    [redactSessionTokensInUrl, 'https://hk.unfranchise.com/index.cfm?phone%E2%80%8B=91234567', ['91234567']],
    [redactSessionTokensInUrl, 'https://hk.unfranchise.com/index.cfm?CFID%00=SESSIONTOKEN', ['SESSIONTOKEN']],
    [redactSessionTokensInText, 'phone%2525252525253D91234567', ['91234567']],
    [(x) => publicErrorMessage(new Error(x)), 'cf_clearance=AbC+Def/Ghi==', ['Def', 'Ghi']],
  ]) {
    assert.equal(gateOk(input), false, input);
    const out = fn(input);
    for (const secret of secrets) assert.ok(!out.includes(secret) && !decodeURIComponent(out).includes(secret), `${input} -> ${out}`);
    assert.equal(gateOk(out), true, out);
  }
  const mixed = publicErrorMessage(new Error('Fetch failed for https://hk.unfranchise.com/index.cfm?skuID=A%26B&phone=91234567'));
  assert.ok(mixed.includes('skuID=A%26B') && !mixed.includes('91234567'), mixed);
  assert.match(redactSessionTokensInText('note: phone%3D9123+4567 then more words'), / then more words$/);
}

// Frozen-scope fixes: the capture gate inspects object keys; string amounts get the same ±1e12 bound as numbers.
assert.throws(() => assertCaptureJsonSafe({ ['CFID\t=LIVE_SECRET']: 0 }));
assert.doesNotThrow(() => assertCaptureJsonSafe({ phone: '[REDACTED]', skuID: 'HK1' }));
for (const text of ['1000000000000.01', '90071992547409.93', '1' + '0'.repeat(309), '-1000000000001']) {
  expectThrows(() => parseHkdToCents(text, 'x'), /within ±1e12/);
}
assert.equal(parseHkdToCents('1000000000000', 'x'), 1e14);

// Final gate: '#' inside session cookie values, iterative capture walk, exact reported total.
assert.ok(!redactSessionTokensInText('cf_clearance=#SECRET').includes('SECRET'));
assert.throws(() => assertCaptureJsonSafe({ text: 'cf_clearance=#SECRET' }));
{ let deep = 'safe'; for (let i = 0; i < 5000; i++) deep = { x: deep }; assert.doesNotThrow(() => assertCaptureJsonSafe(deep)); }
expectThrows(() => assertCaptureJsonSafe((() => { const f = () => {}; f.toJSON = () => 'user@example.com'; return { f }; })()), /email-like/);
expectThrows(() => assertCaptureJsonSafe({ u: (() => { const s = new String('safe'); s.toString = () => 'CFID=SECRET'; return s; })() }), /session token/);
assert.equal(form1000QualifyingOrders([1, 0.009]).productTotalHkd, 1.009);
{ const q = form1000QualifyingOrders([1000, 499.99999999999994]); assert.equal(q.meetsRule, false); assert.ok(q.productTotalHkd < 1500); }

for (const x of [{ hint: 'pass distID=' }, { name: 'email=' }]) assert.doesNotThrow(() => assertCaptureJsonSafe(x));

assert.ok(!redactSessionTokensInText('Cookie: cf_clearance=ABC&SECRET').includes('SECRET'));
assert.match(redactActionString('orders.unfBillShip?CFID=12345&step=review'), /&step=review$/);
assert.doesNotThrow(() => assertCaptureJsonSafe({ items: Array(150000).fill('safe') }));

{
  const started = performance.now();
  redactSessionTokensInText('phone=' + ' '.repeat(100000));
  assertCaptureJsonSafe({ t: 'phone' + ' '.repeat(100000) + '=' + ' '.repeat(100000) });
  assert.ok(performance.now() - started < 500, 'long separator runs must stay linear');
}

assert.throws(() => assertCaptureJsonSafe({ u: new URL('https://hk.unfranchise.com/?CFID=123') }));

assert.throws(() => assertCaptureJsonSafe({ u: new String('CFID=SECRET') }));
assert.ok(!redactSessionTokensInText('Cookie: cf_clearance=+++').includes('+++'));
{
  const started = performance.now();
  redactSessionTokensInText('?' + Array(16000).fill('CFID=x').join('&'));
  assert.ok(performance.now() - started < 300, 'many query params must stay linear');
}

for (const unit of ['phone=#', 'phone=a#', 'phone%3D#']) {
  const started = performance.now();
  redactSessionTokensInText(unit.repeat(16000));
  assert.ok(performance.now() - started < 200, `${unit} repeated must stay linear`);
}

assert.doesNotThrow(() => redactSessionTokensInUrl('https://hk.unfranchise.com/x#?' + 'a=b#?'.repeat(5000)));
assert.ok(!redactSessionTokensInUrl('https://hk.unfranchise.com/x#?' + 'a=b#?'.repeat(100) + 'phone=91234567').includes('91234567'));

for (const depth of [33, 100]) {
  const out = redactSessionTokensInUrl('index.cfm?' + 'a=b?'.repeat(depth) + 'cf_clearance=SECRET1#SECRET2');
  assert.ok(!out.includes('SECRET1') && !out.includes('SECRET2'), out.slice(-60));
}

console.log('bugfix-safety-money: ok');
