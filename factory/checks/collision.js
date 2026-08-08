/* ============================================================================
   The namespace collision assertions, on their own, so they can be pointed at a
   known-bad tree. Handoff 9.1, 11.1, 12.11.

   factory/checks/account.js runs these as its section 11, against the real
   template, where they must pass. factory/checks/test.sh runs THIS file against
   a copy with the bug reintroduced, where it must fail. A check that has only
   ever been run against correct code is not evidence of anything.

   Two demos, two slugs, ONE origin. Two ports would be two origins, and
   localStorage is scoped per origin, so a two-port version would pass no matter
   how broken the namespacing was.
   ========================================================================== */
const { chromium } = require('playwright');

const BASE = process.env.BAD_URL || process.env.TWO_DEMOS_URL || 'http://localhost:8102/';
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '')); }
}

const shim = () => {
  window.__calls = [];
  window.dengage = function () { window.__calls.push(Array.prototype.slice.call(arguments)); };
};

async function openAccount(pg) {
  await pg.click('#account-btn');
  await pg.waitForFunction(() => {
    const body = document.querySelector('#account-body');
    return !!body && (body.querySelector('#account-key') || body.querySelector('#account-signout'));
  }, null, { timeout: 15000 });
  await pg.waitForTimeout(220);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  const a = await browser.newPage();
  await a.addInitScript(shim);
  await a.goto(BASE + 'alpha/', { waitUntil: 'domcontentloaded' });
  await a.waitForFunction(() => !!window.DEMO_CONFIG, null, { timeout: 15000 });

  const b = await browser.newPage();
  await b.addInitScript(shim);
  await b.goto(BASE + 'beta/', { waitUntil: 'domcontentloaded' });
  await b.waitForFunction(() => !!window.DEMO_CONFIG, null, { timeout: 15000 });

  const read = pg => pg.evaluate(() => ({
    slug: window.DEMO_SLUG,
    ck: window.DemoIdentity.storageKey,
    cart: window.Store.keys.cart,
    wishlist: window.Store.keys.wishlist,
    prefix: window.Storefront.keyPrefix()
  }));
  const A = await read(a), B = await read(b);

  ok('each demo resolves its own slug, synchronously',
    A.slug === 'alpha' && B.slug === 'beta', { A: A.slug, B: B.slug });
  ok('no storage namespace is shared',
    A.ck !== B.ck && A.cart !== B.cart && A.wishlist !== B.wishlist, { A, B });
  /* CONTACT KEY PREFIXES ARE NOW THE SAME ON PURPOSE, and this assertion says so
     rather than being deleted. Salil dropped the slug from the contact key so it is
     short enough to type on a call, which means DPS-1 is one shared contact across
     demos. That is intended.

     What must still differ is STORAGE, because that is the collision that actually
     hurt: a second demo adopting the first one's identity, cart and wishlist. The
     assertions above and the same-tab walk below are what cover it. */
  ok('contact key prefix is deliberately shared and slug free',
    A.prefix === B.prefix && A.prefix === 'DPS-', { A: A.prefix, B: B.prefix });
  ok('neither fell back to the shared default',
    !A.cart.includes(':demo:') && !B.cart.includes(':demo:'), { A: A.cart, B: B.cart });

  await a.close();

  await b.close();

  /* ------------------------------------------------------------------------ */
  /* And now the behaviour those keys exist to protect, exercised rather than
     inferred, IN ONE TAB.

     ONE TAB, NOT TWO, and that distinction is the whole assertion. An earlier
     version of this check used the two tabs above and asserted that tab B saw no
     cart and no contact. Those assertions passed on a tree with the bug fully
     present, because sessionStorage is scoped per TAB: two tabs never share a
     contact key however broken the namespacing is. They were incapable of
     failing for the reason they were written, which is the fail-open shape
     CLAUDE.md warns about, caught here only because this file gets run against a
     known-bad tree.

     One tab navigating from demo A to demo B is also the real scenario: it is
     what a pre-sales person does when they paste the next demo's URL over the
     last one. Within a tab, sessionStorage IS shared, so an unnamespaced key
     means demo B silently adopts demo A's contact. */

  const one = await browser.newPage();
  await one.addInitScript(shim);
  await one.goto(BASE + 'alpha/', { waitUntil: 'domcontentloaded' });
  await one.waitForFunction(() => !!window.DEMO_CONFIG, null, { timeout: 15000 });

  await openAccount(one);
  await one.fill('#account-key', '1');
  await one.click('#account-signin');
  await one.waitForTimeout(250);
  await one.keyboard.press('Escape');
  await one.waitForSelector('#product-grid [data-add]', { timeout: 15000 });
  await one.click('#product-grid [data-add]');
  await one.waitForTimeout(250);

  const alpha = await one.evaluate(() => ({
    cart: window.Store.cartCount(),
    ck: window.DemoIdentity.contactKey
  }));
  ok('demo A has a cart and an identity',
    alpha.cart > 0 && alpha.ck === 'DPS-1', alpha);

  /* Same tab, next demo. */
  await one.goto(BASE + 'beta/', { waitUntil: 'domcontentloaded' });
  await one.waitForFunction(() => !!window.DEMO_CONFIG, null, { timeout: 15000 });
  const beta = await one.evaluate(() => ({
    slug: window.DEMO_SLUG,
    cart: window.Store.cartCount(),
    ck: window.DemoIdentity.contactKey,
    init: window.__calls[0]
  }));
  ok('demo B, same tab, sees an empty cart', beta.cart === 0, beta);
  /* Still true, and now it is storage doing the work rather than the key shape. */
  ok('demo B, same tab, did not adopt A\'s contact', beta.ck === null, beta);
  ok('demo B, same tab, initializes anonymously',
    beta.init && beta.init.length === 1, beta.init);
  await one.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
