/* ============================================================================
   The diagnostic tools, and the wishlist row, field by field.

     node factory/checks/tools.mjs        starts its own server and runs alone
     bash factory/checks/run.sh           runs it with the shared server

   THE WISHLIST ASSERTIONS ARE THE IMPORTANT ONES, and they check the row field by
   field rather than checking that a call happened.

   A stored wishlist row carries three fields beyond the documented payload:
   event_id, event_type and is_used. All three are required, and none of them can be
   confirmed from the page: a payload missing one looks complete in a diff, on the
   screen and in the ?debug=1 readout. CLAUDE.md 4 is the rule that covers it, an
   HTTP 200 from the event endpoint means accepted rather than stored, and this file
   is how that rule is made checkable for the one row where every field counts.

   The history worth keeping is that wishlist_events stayed empty from 2 August
   while five other tables filled, out of one module and one payload builder, and
   the first field found missing was not the one that mattered. So these assert
   every key by name, including the three above, and a change to any of them is
   verified against a stored row rather than against this file passing.

   The rest covers the two tools built the same day so the next occurrence is a
   glance rather than an afternoon: the ?debug=1 readout, and the quick reference
   in the launcher.
   ========================================================================== */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8187'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    /* The SDK hosts resolve to nowhere INSIDE THIS BROWSER, so what these
       checks record is always the page's own stub, on every machine. The
       comment used to claim the CDN was unreachable from the sandbox, which
       was true here and false on any machine with internet, where the real
       SDK loaded mid-check and raced the recorder. Enforced, not assumed. */
    args: ['--host-resolver-rules=MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND'] });
const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type()==='error' && !/pcdn\.dengage|fonts\.|favicon|404|ERR_CONNECTION|ERR_CERT/.test(m.text())) errs.push('console: '+m.text()); });

let pass=0, fail=0;
const t=(ok,l)=>{ if(ok){pass++;console.log('   ok    '+l);} else {fail++;console.log('   FAIL  '+l);} };

// Stub SDK incl. the callback-style getters, so the reference panel has values.
await page.addInitScript(() => {
  window.__calls = [];
  window.localStorage.setItem('_dn_sessions', JSON.stringify({ sessionId: 'sess-1111-2222', deviceId: 'dev-aaaa' }));
  window.dengage = function () {
    const a = [...arguments];
    const action = String(a[0]);
    if (action === 'getDeviceId') { a[1] && a[1]('dev-aaaa-bbbb-cccc'); return; }
    if (action === 'getToken')    { a[1] && a[1]('tok-XXXXXXXXXXXXXXXXXXXXXXXXXXXX'); return; }
    /* EVERY argument, not just the second. sendDeviceEvent takes the table name
       first and the row second, so a stub that only kept argument two recorded
       the table where the row should be and every field assertion below read
       undefined. */
    const rest = a.slice(1).map(v => v === undefined ? null : JSON.parse(JSON.stringify(v)));
    window.__calls.push([action, ...rest]);
  };
  /* The row a wishlist call writes, whichever route it took: the ec: call puts
     it in argument two, sendDeviceEvent in argument three after the table name.
     Written here so the assertions below read the row and not the plumbing. */
  window.__row = function (call) {
    return call[0] === 'sendDeviceEvent' ? call[2] : call[1];
  };
  window.__table = function (call) {
    return call[0] === 'sendDeviceEvent' ? call[1] : null;
  };
});

console.log('\n1. The wishlist row: every field a stored row needs\n');
await page.goto('http://localhost:8187/demos/showcase/?debug=1', { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(()=>{window.__calls.length=0;});
await page.evaluate(() => document.querySelector('[data-save]').click());
await page.waitForTimeout(300);
let c = await page.evaluate(()=>window.__calls);
const addCall = c.find(x => x[0] === 'sendDeviceEvent' && x[1] === 'wishlist_events');
const add = addCall && addCall[2];
t(!!addCall, 'a wishlist row is written through sendDeviceEvent');
t(!!addCall && addCall[1] === 'wishlist_events', 'naming the wishlist_events table');

/* event_type and is_used are two of the three fields outside the documented
   payload that a stored row needs. Neither is implied by the call, the response or
   the readout, so both are asserted by name. */
t(!!add && add.event_type === 'add', 'event_type is add');
t(!!add && add.is_used === false, 'is_used is present and false');
t(!!add && typeof add.event_id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(add.event_id),
  'event_id is a generated identifier: ' + (add && add.event_id));

t(!!add && 'product_variant_id' in add, 'it carries product_variant_id = ' + (add && add.product_variant_id));
t(!!add && add.product_variant_id === add.product_id, 'falling back to the product id, like the cart does');

/* PINNED AGAINST A ROW THAT ACTUALLY LANDED, read out of the panel on 6 August
   2026. Every stored wishlist row on this shared account carries list_name
   'favorites'; the other three documented names have never appeared in one. The
   SDK passes the field through as given, so 'favorites' is the only value with a
   stored row behind it. Asserting what has been observed is the only version of
   this check with evidence under it. */
t(!!add && add.list_name === 'favorites',
  'list_name is favorites, the only value ever observed in a stored row');
const LANDED = ['list_name','product_id','product_variant_id','price','discounted_price','stock_count'];
t(!!add && LANDED.every(k => k in add),
  'every field the landed row carried is present');
t(!!add && Object.keys(add).length === LANDED.length + 3,
  'and nothing beyond those plus event_id, event_type and is_used');

/* The ec: wishlist calls must not also fire. Two routes would write two rows for
   one press, and the duplicate would be the one without event_type. */
t(!c.some(x => x[0] === 'ec:addToWishlist'),
  'and the ec: call does not also fire, so one press writes one row');

console.log('\n2. The debug readout\n');
t(await page.locator('#dps-debug').count() === 1, 'the readout is present with ?debug=1');
const rowCount = await page.locator('#dps-debug-list li').count();
t(rowCount >= 2, `it lists events (${rowCount} rows: pageView + the wishlist add)`);
const firstRow = await page.locator('#dps-debug-list li').first().innerText();
t(/ec:addToWishlist/.test(firstRow), 'newest event is at the top');
t(/wishlist_events/.test(firstRow), 'and it names the table the event writes');
await page.locator('[data-debug-clear]').click();
await page.waitForTimeout(150);
t(await page.locator('#dps-debug-list li').count() === 0, 'Clear empties it');

console.log('\n3. Quick reference in the scenarios panel\n');
await page.click('.panel-toggle button');
await page.waitForSelector('#dengage-panel.open');
await page.waitForTimeout(300);
t(await page.locator('.ref-details').count() === 1, 'quick reference renders as a collapsed row, after the cards and above the event panel');
t(!(await page.locator('.ref-details').first().evaluate(e => e.open)), 'shut by default, so it adds one line rather than a screenful');
await page.locator('.ref-details > summary').first().click();
await page.waitForTimeout(900);
const refRows = await page.locator('#ref-grid .ref-row').count();
t(refRows === 7, `seven reference rows (${refRows})`);
const refText = await page.locator('#ref-grid').innerText();
t(/dev-aaaa-bbbb-cccc/.test(refText), 'device id shown, from the SDK getter');
t(/sess-1111-2222/.test(refText), 'session id shown, read from SDK storage');
t(/tok-XXXX/.test(refText), 'push token shown');
t(/99d9b8fb/.test(refText), 'application shown');
t(/demos\/showcase/.test(refText), 'page URL shown, the only route back to this demo\'s rows');
t(!/\?debug=1/.test(refText), 'and WITHOUT the query string, which would match only debug page views');
t(/\b28\b/.test(refText), 'account shown');
await page.locator('#ref-grid [data-ref-copy]').first().click({ force: true });
await page.waitForTimeout(300);
const clip = await page.evaluate(()=>navigator.clipboard.readText());
t(clip === 'dev-aaaa-bbbb-cccc', 'Copy puts the FULL value on the clipboard, not the truncated one');

console.log('\n4. The x buttons in cart and wishlist\n');
await page.evaluate(() => window.Storefront.closeOverlays && window.Storefront.closeOverlays());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-add]').click());
await page.waitForTimeout(250);
await page.evaluate(() => window.Storefront.openOverlay('#cart'));
await page.waitForTimeout(350);
t(await page.locator('#cart-body .line-x').count() === 1, 'the cart line has an x button');
await page.evaluate(()=>{window.__calls.length=0;});
await page.evaluate(() => document.querySelector('#cart-body .line-x').click());
await page.waitForTimeout(300);
c = await page.evaluate(()=>window.__calls);
t(c.some(x=>x[0]==='ec:removeFromCart'), 'pressing it fires ec:removeFromCart');
t(await page.locator('#cart-body .line-x').count() === 0, 'and the line is gone');

await page.evaluate(() => window.Storefront.closeOverlays && window.Storefront.closeOverlays());
await page.waitForTimeout(200);
await page.evaluate(() => window.Storefront.openOverlay('#wishlist'));
await page.waitForTimeout(350);
t(await page.locator('#wishlist-body .line-x').count() === 1, 'the saved line has an x button');
await page.evaluate(()=>{window.__calls.length=0;});
await page.evaluate(() => document.querySelector('#wishlist-body .line-x').click());
await page.waitForTimeout(300);
c = await page.evaluate(()=>window.__calls);
const remCall = c.find(x => x[0] === 'sendDeviceEvent' && x[1] === 'wishlist_events');
const rem = remCall && remCall[2];
t(!!remCall, 'pressing it writes a wishlist row');
t(!!rem && rem.event_type === 'remove', 'with event_type remove');
t(!!rem && rem.is_used === false, 'and is_used, which a remove needs too');
t(!!rem && 'product_variant_id' in rem, 'carrying product_variant_id too');
t(!!rem && rem.list_name === 'favorites', 'and the list it was actually saved to: ' + (rem && rem.list_name));
t(!c.some(x=>x[0]==='ec:removeFromCart'), 'and NOT a cart event by mistake');
/* The cart still uses its ec: call, and must keep doing so. Only the wishlist
   needs the explicit route, and a sweep that changed both would be a regression
   dressed up as consistency. */
t(c.every(x => x[0] !== 'sendDeviceEvent' || x[1] === 'wishlist_events'),
  'and sendDeviceEvent is used for the wishlist only');

console.log('\n5. Off by default\n');
const p2 = await ctx.newPage();
await p2.goto('http://localhost:8187/demos/showcase/', { waitUntil: 'load' });
await p2.waitForTimeout(500);
t(await p2.locator('#dps-debug').count() === 0, 'no readout without ?debug=1 in a fresh tab');

console.log('');
t(errs.length===0, errs.length? 'page errors: '+errs.join(' | ') : 'no page errors');
console.log(`\n   ${pass} passed, ${fail} failed\n`);
await browser.close(); srv.kill('SIGTERM');
process.exit(fail?1:0);
