/* ============================================================================
   BROWSER CHECK: the template's account modal, and the namespacing it depends on.

   Handoff 9.1, 6.2a, 12.11, 12.12. Run it from the repository root:

       bash factory/checks/run.sh

   This is NOT the smoke test in handoff 9. That one is thirty seconds against a
   generated demo, which is disposable. This one checks template/, which every
   future demo is copied from, so a defect here ships five to seven times a month
   until somebody notices.

   WHY IT EXISTS. Reading a diff missed two real bugs that one browser run found:

     - every demo's cart, wishlist and contact key collapsed into ONE shared
       namespace, because modules read data-demo-slug before boot.js set it
     - an unreachable Google Fonts stylesheet stalled identity.js, and therefore
       initialize, indefinitely

   ONE TAB CANNOT CATCH THE FIRST ONE. It looked perfectly correct in a single
   demo: keys present, storage working, a reload keeping the identity. It is only
   visible with two demos open on ONE origin, which is how they sit on Pages.
   Section 11 below opens two, signs in and fills a cart on one, and asserts the
   other sees neither. Anything claiming to prove isolation has to open two.

   AND AN ASSERTION THAT HARD CODES A KEY NAME CAN PASS BY CHECKING NOTHING. The
   first version compared against dps:template:ck while the code was really
   using dps:demo:ck, so it read null, compared it to null, and passed. Every
   storage assertion here derives the key name from the page instead.
   ========================================================================== */
const { chromium } = require('playwright');

const BASE = (process.env.TEMPLATE_URL || 'http://localhost:8101/template/');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '')); }
}


/* Open the account modal and wait for it to have RENDERED, not merely to exist.
   The body is written by js/storefront.js after js/boot.js has fetched three JSON
   files, so clicking the header icon and waiting a fixed 200ms is a race that
   passes on a warm server and fails on a cold one. Ask for the state instead. */
const MODAL_OPEN = () => {
  const modal = document.querySelector('#account');
  if (!modal || !modal.classList.contains('open')) return false;
  const body = document.querySelector('#account-body');
  return !!body && (body.querySelector('#account-key') || body.querySelector('#account-signout'));
};

async function openAccount(pg) {
  /* WAIT FOR THE STOREFRONT TO HAVE BOOTED, not merely for the document to exist.
     The click listener is attached by Storefront.boot(), which runs only after
     js/boot.js has fetched three JSON files. Everything before this waited on
     window.__calls instead, which fills as soon as the SDK snippet runs in the
     head, so a click could land on a fully rendered page whose buttons were not
     yet wired. It did nothing, and the wait below then timed out with an empty
     Playwright log, which reads like a broken selector rather than a race.

     It surfaced when the product grid gained generated artwork and got a little
     heavier, having been latent for as long as this file existed. */
  await pg.waitForFunction(() =>
    !!window.Storefront && !!window.Catalog && window.Catalog.all().length > 0 &&
    !!document.querySelector('#account-btn'),
    null, { timeout: 20000 });

  await pg.click('#account-btn');
  /* WAIT FOR THE MODAL TO BE OPEN, not merely for its content to exist. The content
     is rendered whether the modal is open or closed, so waiting on it resolved while
     the modal was still closed, and the click then landed on whatever product artwork
     happened to sit behind it. It passed against the template and failed against a
     real demo purely on timing, which is the worst kind of check. */
  try {
    await pg.waitForFunction(MODAL_OPEN, null, { timeout: 6000 });
  } catch (err) {
    /* One retry. data-open calls openOverlay and never toggles, so clicking twice
       cannot close what the first click opened. */
    await pg.click('#account-btn');
    await pg.waitForFunction(MODAL_OPEN, null, { timeout: 10000 });
  }
  /* And for the open transition to finish, so the target is where it will stay. */
  await pg.waitForFunction(() => {
    const m = document.querySelector('#account');
    return m && getComputedStyle(m).opacity === '1';
  }, null, { timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    /* The SDK hosts resolve to nowhere INSIDE THIS BROWSER, so what these
       checks record is always the page's own stub, on every machine. The
       comment used to claim the CDN was unreachable from the sandbox, which
       was true here and false on any machine with internet, where the real
       SDK loaded mid-check and raced the recorder. Enforced, not assumed. */
    args: ['--host-resolver-rules=MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND'] });
  const page = await browser.newPage();

  /* Google Fonts is unreachable from this sandbox and the font stack falls back
     to Inter then system-ui, so a stylesheet that cannot load is not a defect
     here. Everything else is. */
  /* The SDK hosts are refused by the launch flags above, so the loader request
     always fails, by construction rather than by circumstance, and its failure is
     actually the positive signal this suite was missing: a demo REQUESTS the loader
     and the template does not. So the request is asserted below and its failure is
     ignored, rather than ignoring both. */
  const IGNORE = /fonts\.googleapis\.com|fonts\.gstatic\.com|favicon|pcdn\.dengage\.com/;
  const errors = [];
  page.on('pageerror', e => { if (!IGNORE.test(String(e))) errors.push(String(e)); });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const from = (m.location() && m.location().url) || '';
    if (!IGNORE.test(text) && !IGNORE.test(from)) errors.push(text + '  @ ' + from);
  });

  /* Stand in for the SDK so every outgoing call is captured with its arguments,
     in order. There is no application configured in the template, so the loader
     never runs and window.dengage would otherwise be absent. */
  await page.addInitScript(() => {
    window.__calls = [];
    window.dengage = function () { window.__calls.push(Array.prototype.slice.call(arguments)); };
  });

  /* Whether the page even ASKS for the SDK is the difference between the template
     and a demo, and it went unnoticed once already. Assert it. */
  const sdkRequests = [];
  page.on('request', r => { if (/dengage_sdk_loader/.test(r.url())) sdkRequests.push(r.url()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  console.log('\n1. Page and header');
  const isDemo = !/\/template\/$/.test(BASE);
  ok(isDemo ? 'a demo requests the SDK loader' : 'the template must NOT request the SDK loader',
    isDemo ? sdkRequests.length > 0 : sdkRequests.length === 0,
    { isDemo, sdkRequests: sdkRequests.length });
  ok('no JS errors on load', errors.length === 0, errors);
  ok('account button present', await page.locator('#account-btn').count() === 1);
  ok('starts not identified', await page.locator('#account-btn[data-identified]').count() === 0);

  console.log('\n2. Signed out modal');
  await openAccount(page);
  ok('modal open', await page.locator('#account.open').count() === 1);
  ok('prefix shown as fixed text', (await page.locator('#account .affix .fixed').textContent()).trim() === 'DPS-');
  ok('one key input, no full-key field', await page.locator('#account-body input').count() === 1);
  ok('register button present', await page.locator('#account-register').count() === 1);
  ok('key input focused', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'account-key');
  ok('copy resolved, not raw keys',
    !(await page.locator('#account-body').textContent()).includes('accountSignInBody'));

  console.log('\n3. Empty input is refused, and sends nothing');
  const before = await page.evaluate(() => window.__calls.length);
  await page.click('#account-signin');
  await page.waitForTimeout(120);
  ok('error shown', await page.locator('#account-error:not([hidden])').count() === 1);
  ok('error names the prefix',
    (await page.locator('#account-error').textContent()).includes('DPS-'));
  ok('no SDK call made', await page.evaluate(() => window.__calls.length) === before);

  console.log('\n4. Sign in namespaces the key');
  await page.fill('#account-key', '  Acme Buyer  ');
  await page.click('#account-signin');
  await page.waitForTimeout(200);
  const calls = await page.evaluate(() => window.__calls);
  const idx = calls.findIndex(c => c[0] === 'setContactKey');
  ok('setContactKey called', idx !== -1, calls.map(c => c[0]));
  ok('key is namespaced, trimmed, lowercased, despaced',
    idx !== -1 && calls[idx][1] === 'DPS-acme-buyer', idx !== -1 ? calls[idx][1] : null);
  ok('pageView fires AFTER setContactKey',
    idx !== -1 && calls.slice(idx + 1).some(c => c[0] === 'pageView'),
    calls.slice(idx).map(c => c[0]));
  const login = calls.slice(idx + 1).find(c => c[0] === 'pageView');
  ok('that page view is page_type login', login && login[1].page_type === 'login', login && login[1]);

  console.log('\n5. Signed in state');
  ok('key shown', (await page.locator('#account .who code').textContent()).trim() === 'DPS-acme-buyer');
  ok('sign out offered', await page.locator('#account-signout').count() === 1);
  ok('sign in form gone', await page.locator('#account-key').count() === 0);
  ok('header icon marked identified', await page.locator('#account-btn[data-identified="true"]').count() === 1);
  const storeKey = await page.evaluate(() => window.DemoIdentity.storageKey);
  /* DERIVED, NOT HARDCODED. This assertion previously compared against
     'dps:template:ck' and so failed the moment it was pointed at a real demo, whose
     key is correctly dps:<slug>:ck. Same root cause as the bug this whole file
     exists for: a check that hardcodes a value it should read from the page. */
  const pageSlug = await page.evaluate(() => window.DEMO_SLUG);
  ok('storage key is namespaced by slug',
    storeKey === 'dps:' + pageSlug + ':ck', { storeKey, pageSlug });
  ok('persisted where identity.js reads it',
    await page.evaluate(k => sessionStorage.getItem(k), storeKey) === 'DPS-acme-buyer');
  ok('cart and wishlist namespaced too',
    JSON.stringify(await page.evaluate(() => window.Store.keys)) ===
    JSON.stringify({ cart: 'dps:' + pageSlug + ':cart', wishlist: 'dps:' + pageSlug + ':wishlist' }),
    await page.evaluate(() => window.Store.keys));

  console.log('\n6. Identity survives a reload, and initialize carries it');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const afterReload = await page.evaluate(() => window.__calls);
  ok('initialize is call 0', afterReload[0] && afterReload[0][0] === 'initialize', afterReload[0]);
  ok('initialize carries the contact key',
    afterReload[0] && afterReload[0][1] && afterReload[0][1].contactKey === 'DPS-acme-buyer',
    afterReload[0] && afterReload[0][1]);
  ok('still identified in the header', await page.locator('#account-btn[data-identified="true"]').count() === 1);

  console.log('\n7. Sign out returns to anonymous');
  await page.goto(BASE + '?ck=DPS-acme-buyer', { waitUntil: 'networkidle' });
  await openAccount(page);
  await page.click('#account-signout');
  /* Sign out navigates on a timer, so wait for the new document to have actually
     run its head scripts. A bare timeout let the assertion land in a context
     that existed but had not executed the SDK snippet yet, and it read as an
     empty call list. */
  /* commit, not load: Google Fonts is unreachable here and holds the load event
     open for far longer than the page actually takes to become usable. The real
     signal is that the new document's head scripts have run. */
  await page.waitForURL(url => !url.search.includes('ck='), { timeout: 15000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.__calls && window.__calls.length > 0, null, { timeout: 15000 });
  ok('ck stripped from the URL', !page.url().includes('ck='), page.url());
  ok('storage cleared', await page.evaluate(k => sessionStorage.getItem(k), storeKey) === null);
  const anon = await page.evaluate(() => window.__calls);
  ok('initialize is now anonymous', anon[0] && anon[0].length === 1, anon[0]);
  ok('not identified in the header', await page.locator('#account-btn[data-identified]').count() === 0);

  console.log('\n8. Register fires the subscription creative');
  await openAccount(page);
  await page.click('#account-register');
  await page.waitForTimeout(220);
  const layer = await page.evaluate(() => window.dataLayer.slice());
  ok('dataLayer carries the scenario',
    layer.some(e => e.event === 'dengage_demo_subscription-popup'), layer);
  ok('modal closed so the widget is not covered',
    await page.locator('#account.open').count() === 0);
  ok('scrim down', await page.locator('#scrim.open').count() === 0);

  /* 8a EXISTS BECAUSE THE ENGINE MINTS ITS OWN KEY OTHERWISE, and the one it mints
     carries no DPS- marker. A subscription submitted by an anonymous visitor was
     stored keyed sf_ plus a uuid on 10 August 2026: the engine reads the device
     record at submit time, finds nothing, and invents a key before it posts. So the
     key has to exist BEFORE the form can be submitted, which is why firing the card
     identifies the visitor rather than the submit doing it.

     THE TIMESTAMP IS ASSERTED AS A SHAPE, NOT A VALUE. It has to be a number, and
     it has to be a big one: low numbers are what a pre-sales person types into this
     very modal during a call, so minting DPS-1 here would adopt the contact they
     are already demonstrating as. */
  const minted = await page.evaluate(() => window.DemoIdentity.contactKey);
  ok('firing the subscription card identified the visitor',
    typeof minted === 'string' && minted.length > 4, minted);
  ok('with the DPS- marker, so a purge can find the contact',
    String(minted).indexOf('DPS-') === 0, minted);
  ok('and a timestamp rather than a number a human would type',
    /^DPS-\d{13}$/.test(String(minted)), minted);
  ok('setContactKey was called with exactly that key',
    (await page.evaluate(() => window.__calls))
      .some(c => c[0] === 'setContactKey' && c[1] === minted), minted);
  /* Without this the contact owns cart and order rows that no page view can be
     joined to, so nothing can attribute them to this demo. See CLAUDE.md 1b. */
  ok('and a page view followed it, so the contact is attributable',
    (await page.evaluate(() => window.__calls))
      .some(c => c[0] === 'pageView' && c[1] && c[1].page_type === 'login'));

  console.log('\n9. The launcher also clears the way');
  await page.click('.panel-toggle button');
  await page.waitForTimeout(220);
  await page.click('[data-scenario="survey"]');
  await page.waitForTimeout(220);
  ok('launcher modal closed after firing',
    await page.locator('#dengage-panel.open').count() === 0);
  ok('survey scenario pushed',
    (await page.evaluate(() => window.dataLayer.slice())).some(e => e.event === 'dengage_demo_survey'));

  console.log('\n10. Product page has the same account path');
  const first = await page.evaluate(() => window.Catalog.all()[0].id);
  /* THE IDENTITY FROM 8a IS CLEARED FIRST, and not because it is inconvenient.
     Section 8 fired the subscription card, which identifies the visitor by design,
     so this page would open the signed IN modal and the prefix asserted below does
     not exist in that state. Clearing storage is what makes this an anonymous
     visitor again, which is the state this section is about. */
  await page.evaluate(k => { sessionStorage.removeItem(k); localStorage.removeItem(k); }, storeKey);
  await page.goto(BASE + 'product.html?id=' + encodeURIComponent(first), { waitUntil: 'networkidle' });
  await openAccount(page);
  ok('modal present on product.html', await page.locator('#account.open').count() === 1);
  ok('same prefix', (await page.locator('#account .affix .fixed').textContent()).trim() === 'DPS-');

  /* Section 11, the namespace collision checks, lives in factory/checks/collision.js
     and is run separately by factory/checks/run.sh. It is a separate file for one
     reason: factory/checks/test.sh points it at a tree with handoff 12.11
     reintroduced and requires it to FAIL. A copy inlined here would drift from the
     one that is actually proven to catch the bug. */

  console.log('\n11. No stray errors across the whole run');
  ok('clean console', errors.length === 0, errors.slice(0, 5));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
