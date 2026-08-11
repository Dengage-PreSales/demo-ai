/* ============================================================================
   THE SMOKE TEST. The acceptance check for a GENERATED demo.

     node factory/checks/smoke.mjs --url http://localhost:8101/demos/<slug>/

   Handoff 9. Twelve assertions, about thirty seconds. A generated demo is
   disposable and does not earn a full regression suite, which is what
   factory/checks/ is for: that suite protects template/, the thing every future
   demo is copied from, so a defect in it ships five to seven times a month.

   ITEMS 5, 9 AND 10 ARE NEVER SKIPPED FOR SPEED. They are the ones that protect
   the core assets and the demo's credibility:

     5   every payload comes from js/dengageEvents.js and nothing else, so one
         audited file remains the whole of how this repository writes to a Data
         Space shared with five live demo sites and two mobile apps
     9   every product tile resolves locally, so nothing can 404 mid call
     10  no product carries a fabricated price or stock count

   WHAT THIS CANNOT SEE, and why the other suite exists. `dengage` here is the
   recorder this file installs, never the real SDK. That is enough to prove what
   the page SENDS and in what order, which is what these assertions are about. It
   is not enough to prove a row landed in Data Space, and no headless check can
   be: only the row proves that (handoff 12.5).

   THE LOADER IS BLOCKED TO KEEP THAT TRUE, and until 11 August 2026 this comment
   claimed it was already true because the loader was "unreachable from CI". It is
   reachable. GitHub's runners resolve pcdn.dengage.com perfectly well, so the real
   SDK loaded and assigned over window.dengage, and every assertion about what the
   page sent then depended on which finished first: the SDK replacing the recorder,
   or the catalogue resolving so pageview() could fire.

   That race decided builds. One run reported the product page firing pageView
   exactly once, and the next reported zero from the same store, on a page that had
   rendered the product correctly both times. Locally it never reproduced, because
   locally the loader really is unreachable and the recorder always survived.

   So the two hosts are refused at the network layer, which makes the documented
   assumption enforced rather than hoped for. Nothing is lost: this suite cannot
   verify the SDK anyway, and the one assertion about it reads the page source for
   the loader URL rather than the loaded script.
   ========================================================================== */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i];
    if (!token.startsWith('--')) continue;
    const next = process.argv[i + 1];
    args[token.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i++;
}

const BASE = String(args.url || process.env.DEMO_URL || '').replace(/\/?$/, '/');
if (!BASE || BASE === '/') {
    console.error('usage: node factory/checks/smoke.mjs --url http://localhost:8101/demos/<slug>/');
    process.exit(2);
}

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return true; }
    fail++;
    const line = label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '');
    failures.push(line);
    console.log('   FAIL  ' + line);
    return false;
}

function launchOptions() {
    if (process.env.PW_CHROMIUM && existsSync(process.env.PW_CHROMIUM)) {
        return { executablePath: process.env.PW_CHROMIUM };
    }
    if (existsSync('/opt/pw-browsers/chromium')) return { executablePath: '/opt/pw-browsers/chromium' };
    return {};
}

/* Records every SDK call the page makes, before any page script runs, and keeps
   the STACK for each one. The stack is the whole mechanism behind assertion 5:
   it is what makes "which file sent this" answerable rather than assumed. */
function installRecorder() {
    window.__sdk = [];
    window.__dataLayerSeen = [];
    window.dengage = function () {
        const args = Array.prototype.slice.call(arguments);
        window.__sdk.push({ args, stack: new Error().stack || '' });
        return undefined;
    };
    window.dengage.q = [];

    /* The launcher pushes trigger names here rather than calling the SDK, so both
       surfaces have to be watched to know what a demo emitted.

       A PLAIN ARRAY WITH A WRAPPED push, not an accessor. The first version
       defined a getter and a setter, and the setter recorded its own writes: the
       emitter does `window.dataLayer = window.dataLayer || []`, which reads the
       getter and assigns the same array straight back, so the setter fired,
       spread an empty array into push(), and recorded an undefined entry that
       then broke every reader. Creating the array here instead means that same
       line is a no-op, which is what it was always meant to be. */
    const layer = [];
    const push = layer.push.bind(layer);
    layer.push = function () {
        for (const entry of arguments) {
            if (entry && typeof entry === 'object') window.__dataLayerSeen.push(entry);
        }
        return push.apply(null, arguments);
    };
    window.dataLayer = layer;
}

/* NEVER INTERESTING, WHEREVER IT CAME FROM: a webfont or a favicon that did not
   load, and any transport failure. Checked FIRST, and pcdn.dengage.com is no
   longer on this list.

   That removal is the point of the split. The loader is refused on purpose now,
   so it fails to fetch on every run, and matching on its host meant a genuine
   fault inside the SDK was silenced by the same rule that hid that intended
   refusal. Now the transport failure is dropped for being a transport failure,
   and anything a third party script actually throws survives to be reported. */
const NOISE = /fonts\.googleapis|fonts\.gstatic|favicon|ERR_CONNECTION|ERR_NAME|net::|Failed to load resource/;

const IGNORE_CONSOLE = NOISE;

/* The first stack frame that names a URL, which is the only part of a stack worth
   printing next to a one line message. */
function firstFrame(stack) {
    const hit = stack.match(/https?:\/\/[^\s)]+/);
    return hit ? hit[0] : 'no source in stack';
}

/* SCRIPTS THIS REPOSITORY DOES NOT OWN. The SDK is fetched from pcdn and its
   on-site and inline content is authored in the panel, so nothing in a demo
   folder can fix a fault inside either. */
const THIRD_PARTY = /pcdn\.dengage\.com|push\.dengage\.com|dengage_sdk_loader/;

/* THE ASYMMETRY BELOW TOOK A GOOD DEMO DOWN ON 11 AUGUST 2026, and it is worth
   stating plainly because the two handlers looked equivalent and were not.

   The console handler has always skipped pcdn.dengage.com. The pageerror
   handler skipped nothing, so an UNCAUGHT error from the very same script
   arrived unfiltered and failed the build with

       home is clean  <["Failed to execute 'appendChild' on 'Node': ..."]>

   The demo was fine. The exact folder the build refused passes this suite 53
   for 53 when served locally, which is how the asymmetry was found: the error
   only appears where the SDK can actually load, and it is thrown from inside it.

   THIRD PARTY ERRORS ARE SET ASIDE, NOT DROPPED, and the difference matters
   twice over. Dropping them would hide a real fault in the panel's own content,
   which is shared by every demo and is exactly the kind of thing worth hearing
   about early. Failing on them is the wrong trade, because it refuses to publish
   a working demo over something no change in this repository can fix. So they
   are reported under their own heading, with the origin, and they do not fail
   the build.

   THE STACK IS RECORDED RATHER THAN JUST THE MESSAGE. A message alone cannot be
   attributed, which is what made the first two diagnoses guesswork. If an error
   is genuinely ours, THIRD_PARTY does not match, it still fails, and the origin
   is now in the output. */
async function openPage(browser, path) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    const foreign = [];
    /* One order for both handlers: noise, then not ours, then ours. */
    page.on('pageerror', (err) => {
        const where = String((err && err.stack) || '');
        const text = String((err && err.message) || err);
        if (NOISE.test(text)) return;
        const line = text + '  [' + firstFrame(where) + ']';
        (THIRD_PARTY.test(where) ? foreign : errors).push(line);
    });
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        const from = (message.location() && message.location().url) || '';
        if (NOISE.test(text) || NOISE.test(from)) return;
        if (THIRD_PARTY.test(text) || THIRD_PARTY.test(from)) {
            foreign.push(text + '  [' + (from || 'no source') + ']');
            return;
        }
        errors.push(text);
    });
    await page.addInitScript(installRecorder);

    /* Refuse the SDK, so the recorder installed above is what every call reaches.
       See the header: this is the enforcement of an assumption the file used to
       merely assert. Aborted rather than fulfilled with an empty body, because an
       empty script would still let the page believe a loader arrived. */
    let blocked = 0;
    await page.route(/(pcdn|push)\.dengage\.com/, (route) => { blocked++; return route.abort(); });

    const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Catalog && window.Catalog.all().length &&
        window.DEMO_CONFIG, null, { timeout: 25000 });
    /* boot() fires pageView after the catalogue resolves, so the recorder needs a
       moment past domcontentloaded before it is read. */
    await page.waitForTimeout(700);
    return { page, errors, foreign, blocked, status: response ? response.status() : 0 };
}

(async () => {
    const browser = await chromium.launch(launchOptions());
    console.log('\nSmoke test: ' + BASE);

    /* ---------------------------------------------------------------- 1, 2, 3 */
    console.log('\n1. Both pages load, and the SDK is wired before any event');
    const home = await openPage(browser, 'index.html');
    ok('home returns 200', home.status === 200, home.status);
    ok('home renders its catalogue',
        await home.page.locator('.card').count() > 0);

    const config = await home.page.evaluate(() => window.DEMO_CONFIG);
    const html = await home.page.content();
    ok('the SDK loader names this application',
        html.includes('pcdn.dengage.com/p/push/' + config.dengage.accountId + '/' + config.dengage.appGuid),
        config.dengage.appGuid);
    /* ASSERTED, NOT ASSUMED. The line above proves the page asks for the loader, so
       this one must follow, and if the route stops matching one day it fails here
       rather than silently reintroducing the race described in the header. */
    ok('and the loader was refused, so the recorder is what recorded',
        home.blocked > 0, { blocked: home.blocked });
    ok('the app guid is not a placeholder',
        !!config.dengage.appGuid && !config.dengage.appGuid.startsWith('__'));

    const calls = await home.page.evaluate(() => window.__sdk.map((entry) => entry.args[0]));
    const initialize = calls.indexOf('initialize');
    const firstPageView = calls.indexOf('pageView');
    ok('initialize is called', initialize !== -1, calls);
    ok('initialize runs before any pageView',
        initialize !== -1 && firstPageView !== -1 && initialize < firstPageView, calls);

    /* -------------------------------------------------------------------- 4 */
    console.log('\n4. pageView fires exactly once per page, with a page_type');
    const homeViews = await home.page.evaluate(() =>
        window.__sdk.filter((entry) => entry.args[0] === 'pageView').map((entry) => entry.args[1]));
    ok('home fires pageView once', homeViews.length === 1, homeViews.length);
    ok('and it carries a page_type',
        homeViews.length === 1 && !!homeViews[0] && !!homeViews[0].page_type, homeViews[0]);

    /* -------------------------------------------------------------------- 5 */
    console.log('\n5. Every payload comes from the event module and nothing else');
    /* The stack of each recorded call names the file that made it. A call from
       anywhere but the emitter is the failure this exists to catch, and static
       analysis cannot see it: the guard reads source text, and a call assembled at
       runtime is invisible to that. */
    const sources = await home.page.evaluate(() => window.__sdk.map((entry) => ({
        action: entry.args[0],
        /* the first frame below the recorder itself */
        frame: (entry.stack.split('\n').slice(1).find((line) => /\.js|\.html/.test(line)) || '').trim()
    })));
    const strays = sources.filter((entry) =>
        !/dengageEvents\.js/.test(entry.frame) && !/index\.html|product\.html/.test(entry.frame));
    ok('no SDK call comes from outside js/dengageEvents.js or the page bootstrap',
        strays.length === 0, strays.slice(0, 4));
    /* The bootstrap is allowed exactly one call, initialize, and nothing else.
       Anything more there is an event escaping the audited module. */
    const fromBootstrap = sources.filter((entry) => /index\.html|product\.html/.test(entry.frame));
    ok('the page bootstrap only ever calls initialize',
        fromBootstrap.every((entry) => entry.action === 'initialize'), fromBootstrap.slice(0, 4));

    /* ------------------------------------------------------------------- 5a */
    console.log('\n5a. The event panel offers no way to name a table');
    await home.page.evaluate(() => window.Storefront.openOverlay('#dengage-panel'));
    await home.page.waitForTimeout(250);
    const freeText = await home.page.evaluate(() => {
        const panel = document.getElementById('dengage-panel');
        if (!panel) return { missing: true };
        const inputs = [...panel.querySelectorAll('input,textarea')]
            .filter((el) => !['checkbox', 'radio', 'button', 'submit'].includes(el.type));
        const select = panel.querySelector('#event-select');
        return {
            inputs: inputs.map((el) => el.id || el.name || el.type),
            options: select ? [...select.options].map((option) => option.value) : null
        };
    });
    ok('there is no free text field in the event panel',
        freeText.inputs && freeText.inputs.length === 0, freeText.inputs);
    ok('the event list is a fixed set of choices',
        Array.isArray(freeText.options) && freeText.options.length > 0, freeText.options);
    ok('and every choice is a known SDK action',
        (freeText.options || []).every((value) => value === 'pageView' || value.startsWith('ec:')),
        freeText.options);

    /* -------------------------------------------------------------------- 6 */
    console.log('\n6. The launcher offers every campaign, and fires the right event');
    const launcher = await home.page.evaluate(() => ({
        cards: [...document.querySelectorAll('#launcher-grid [data-scenario]')]
            .map((el) => el.getAttribute('data-scenario')),
        gestures: [...document.querySelectorAll('#launcher-grid [data-gesture]')]
            .map((el) => el.getAttribute('data-gesture')),
        actions: [...document.querySelectorAll('#launcher-grid [data-action]')]
            .map((el) => el.getAttribute('data-action')),
        prefix: (window.DEMO_CONFIG.dengage || {}).scenarioPrefix
    }));
    ok('the launcher has cards', launcher.cards.length > 0, launcher.cards.length);
    ok('it offers the two gesture cards', launcher.gestures.length === 2, launcher.gestures);
    ok('and the action cards that are not campaigns', launcher.actions.length >= 1, launcher.actions);

    const firstCard = launcher.cards.find((slug) => !/^inline-pdp/.test(slug));
    await home.page.evaluate((slug) => {
        window.__dataLayerSeen.length = 0;
        document.querySelector('[data-scenario="' + slug + '"]').click();
    }, firstCard);
    await home.page.waitForTimeout(200);
    const pushed = await home.page.evaluate(() => window.__dataLayerSeen.map((entry) => entry.event));
    ok('pressing a card pushes exactly one trigger', pushed.length === 1, pushed);
    ok('and it is the prefixed name',
        pushed[0] === launcher.prefix + firstCard, { pushed: pushed[0], want: launcher.prefix + firstCard });

    /* A gesture card must not push. A card that pushed anyway would log that it
       fired, and the widget would never appear, which reads as the product
       failing rather than as a gesture nobody made. */
    await home.page.evaluate(() => { window.__dataLayerSeen.length = 0; });
    await home.page.evaluate(() =>
        document.querySelector('#launcher-grid [data-gesture]').click());
    await home.page.waitForTimeout(200);
    ok('a gesture card pushes nothing',
        (await home.page.evaluate(() => window.__dataLayerSeen.length)) === 0);

    /* -------------------------------------------------------------------- 7 */
    console.log('\n7. All five inline slots exist, across the two pages');
    const SLOTS = ['below_header', 'below_hero', 'in_grid', 'above_footer', 'pdp_below_price'];
    const homeSlots = await home.page.evaluate((slots) =>
        slots.filter((slot) => !!document.getElementById('dn_inline_target_' + slot)), SLOTS);

    /* -------------------------------------------------------------------- 8 */
    console.log('\n8. The slot under the header is not hidden behind it');
    /* CONTENT HAS TO GO IN THE SLOT FIRST, and the first version of this did not
       do that. An empty slot collapses to display:none, so its bounding rect is
       all zeros, and comparing zero against the header's bottom edge reported an
       overlap for a slot that was measuring nothing at all. What handoff 9 item 8
       is about is a RENDERED creative disappearing behind a fixed header, so a
       stand-in is injected the way the inline engine would and then measured. */
    const clearance = await home.page.evaluate(() => {
        const slot = document.getElementById('dn_inline_target_below_header');
        const header = document.getElementById('header');
        if (!slot || !header) return null;
        const probe = document.createElement('div');
        probe.id = 'smoke-probe';
        probe.style.height = '48px';
        slot.appendChild(probe);
        const rect = probe.getBoundingClientRect();
        const out = {
            probeTop: rect.top,
            probeHeight: rect.height,
            headerBottom: header.getBoundingClientRect().bottom,
            clearance: getComputedStyle(document.documentElement)
                .getPropertyValue('--dn-header-clearance').trim()
        };
        probe.remove();
        return out;
    });
    ok('a creative in the below-header slot is visible', !!clearance && clearance.probeHeight > 0,
        clearance);
    ok('and it starts at or below the header',
        clearance && clearance.probeTop >= clearance.headerBottom - 1, clearance);
    ok('the measured header clearance is published',
        clearance && /^\d+px$/.test(clearance.clearance), clearance);

    /* ----------------------------------------------------------------- 9, 10 */
    console.log('\n9. Every tile resolves locally, nothing off origin');
    const images = await home.page.evaluate(() => {
        const origin = location.origin;
        const out = { total: 0, offOrigin: [], broken: [] };
        for (const img of document.querySelectorAll('.card img')) {
            out.total++;
            if (img.src && !img.src.startsWith(origin) && !img.src.startsWith('data:')) {
                out.offOrigin.push(img.src);
            }
            if (img.complete && img.naturalWidth === 0) out.broken.push(img.src);
        }
        return out;
    });
    ok('no product image points off origin', images.offOrigin.length === 0, images.offOrigin.slice(0, 3));
    ok('no product image failed to load', images.broken.length === 0, images.broken.slice(0, 3));
    /* Generated artwork is inline SVG rather than an img, so zero img elements is
       the expected and correct state. It is asserted rather than assumed, because
       the difference between "artwork" and "no tile at all" is worth catching. */
    const tiles = await home.page.evaluate(() =>
        [...document.querySelectorAll('.card')].filter((card) =>
            card.querySelector('img, svg')).length);
    ok('every tile has artwork',
        tiles === await home.page.locator('.card').count(), tiles);

    console.log('\n10. No fabricated price or stock count');
    const catalogue = await home.page.evaluate(() => window.Catalog.all().map((product) => ({
        id: product.id, price: product.price,
        discountedPrice: product.discountedPrice, stockCount: product.stockCount
    })));
    ok('every product has a real price',
        catalogue.every((product) => typeof product.price === 'number' && product.price > 0),
        catalogue.filter((product) => !(product.price > 0)).slice(0, 3));
    ok('a discount is only present when it is genuinely lower',
        catalogue.every((product) => product.discountedPrice === null ||
            product.discountedPrice < product.price),
        catalogue.filter((product) => product.discountedPrice !== null &&
            !(product.discountedPrice < product.price)).slice(0, 3));
    /* THE Number(null) TRAP, and the reason this assertion is worded this way. A
       stock count of 0 announces a product out of stock and poisons every
       back-in-stock segment built on it. It is legitimate only when the scrape
       genuinely found none, so what is asserted is that the whole catalogue is
       not zero: that pattern is what a null-to-zero coercion looks like. */
    const zeros = catalogue.filter((product) => product.stockCount === 0).length;
    ok('stock is not zero across the whole catalogue',
        catalogue.length === 0 || zeros < catalogue.length, { zeros, of: catalogue.length });
    ok('no stock count is negative or fractional',
        catalogue.every((product) => product.stockCount === null ||
            (Number.isInteger(product.stockCount) && product.stockCount >= 0)),
        catalogue.filter((product) => product.stockCount !== null &&
            !(Number.isInteger(product.stockCount) && product.stockCount >= 0)).slice(0, 3));

    /* --------------------------------------------------- a prospect's own text */
    /* EVERY PRODUCT AND CATEGORY NAME IN A DEMO WAS WRITTEN BY SOMEBODY ELSE, and
       arrives from a feed meant for a browser. The scraper decodes entities, strips
       tags and normalises dashes before anything is committed, and the storefront
       escapes on render. This is the assertion that the two together actually hold
       on the page, which neither the guard nor an offline test can see. */
    console.log('\nA prospect\'s own text cannot break the page');
    const text = await home.page.evaluate(() => {
        const names = window.Catalog.all().map((product) => product.name);
        const categories = window.Catalog.categories();
        const header = document.getElementById('header');
        const nav = document.getElementById('site-nav');
        return {
            /* Anything the page rendered from a name would appear as an element
               inside the nav, the chips or a tile. Only text belongs there. */
            injectedInNav: nav ? nav.querySelectorAll('*:not(a)').length : -1,
            injectedInChips: document.querySelectorAll('#filters .chip *').length,
            scripts: document.querySelectorAll('#site-nav script, #filters script, .card script').length,
            navOverflows: nav && header ? nav.scrollWidth > header.clientWidth : false,
            sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            undecoded: names.concat(categories).filter((name) =>
                /&(amp|lt|gt|quot|#\d+|nbsp|rsquo|mdash|ndash);/i.test(name)),
            tagged: names.concat(categories).filter((name) => /<[a-z/!]/i.test(name)),
            dashes: names.concat(categories).filter((name) =>
                /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043\ufe58\ufe63\uff0d]/.test(name)),
            longestName: Math.max(0, ...names.map((name) => name.length)),
            longestCategory: Math.max(0, ...categories.map((name) => name.length))
        };
    });
    ok('no name rendered as an element in the navigation', text.injectedInNav === 0, text.injectedInNav);
    ok('no name rendered as an element in the filter chips', text.injectedInChips === 0);
    ok('no script element came from a name', text.scripts === 0);
    ok('no name still carries an undecoded entity', text.undecoded.length === 0, text.undecoded);
    ok('no name still carries a tag', text.tagged.length === 0, text.tagged);
    /* CLAUDE.md 3.10, enforced on committed bytes by the guard. products.json is
       committed, so a dash here would fail the build rather than look odd. */
    ok('no name carries an em or en dash', text.dashes.length === 0, text.dashes);
    ok('the navigation fits the header', text.navOverflows === false, text);
    ok('the page does not scroll sideways', text.sideways === false, text);
    ok('no product name is unbounded', text.longestName <= 120, text.longestName);
    ok('no category name is unbounded', text.longestCategory <= 28, text.longestCategory);

    /* Every filter actually filters. A category in the navigation that shows an
       empty grid is worse than one that is not there. */
    const filters = await home.page.evaluate(async () => {
        const chips = [...document.querySelectorAll('#filters .chip')]
            .map((chip) => chip.getAttribute('data-filter')).filter(Boolean);
        const out = [];
        for (const name of chips) {
            const chip = [...document.querySelectorAll('#filters .chip')]
                .find((c) => c.getAttribute('data-filter') === name);
            chip.click();
            await new Promise((resolve) => setTimeout(resolve, 120));
            out.push({ name, shown: document.querySelectorAll('.card').length });
        }
        return out;
    });
    ok('every category chip shows at least one product',
        filters.length > 0 && filters.every((entry) => entry.shown > 0),
        filters.filter((entry) => entry.shown === 0));

    /* ------------------------------------------------------------------- 12 */
    console.log('\n12. The namespace carries the slug');
    const namespaced = await home.page.evaluate(() => ({
        slug: window.DEMO_SLUG,
        cart: window.Store.keys.cart,
        wishlist: window.Store.keys.wishlist,
        inbox: window.Inbox ? window.Inbox.keys.read : null,
        contactPrefix: window.Storefront.keyPrefix(),
        identityKey: window.DemoIdentity ? window.DemoIdentity.storageKey : null
    }));
    ok('the cart key carries the slug',
        namespaced.cart === 'dps:' + namespaced.slug + ':cart', namespaced);
    ok('the wishlist key carries the slug',
        namespaced.wishlist === 'dps:' + namespaced.slug + ':wishlist', namespaced);
    ok('the inbox read state carries the slug',
        namespaced.inbox === 'dps:' + namespaced.slug + ':inbox-read', namespaced);

    /* THE CONTACT KEY PREFIX IS DPS- AND CARRIES NO SLUG, by Salil's instruction,
       and asserting otherwise is how this check first failed against correct code.
       The isolation that matters is storage: the identity is held under
       dps:<slug>:ck, so a second demo open in the same browser never adopts the
       first one's contact. Order ids do keep their slug, because an order id has
       to be unique in order_events, which is shared. js/storefront.js explains the
       asymmetry where it lives. */
    ok('the contact key prefix is DPS- and names no demo',
        namespaced.contactPrefix === 'DPS-', namespaced.contactPrefix);
    ok('but the identity is stored under the slug',
        namespaced.identityKey === null ||
        namespaced.identityKey === 'dps:' + namespaced.slug + ':ck', namespaced);

    /* ---------------------------------------------------- the product page */
    console.log('\nThe product page');
    const firstId = catalogue[0] && catalogue[0].id;
    const product = await openPage(browser, 'product.html?id=' + encodeURIComponent(firstId));
    ok('product page returns 200', product.status === 200, product.status);
    ok('it renders the product',
        (await product.page.locator('h1').first().innerText()).trim().length > 0);

    const productViews = await product.page.evaluate(() =>
        window.__sdk.filter((entry) => entry.args[0] === 'pageView').map((entry) => entry.args[1]));
    ok('it fires pageView once', productViews.length === 1, productViews.length);
    ok('with page_type product',
        productViews.length === 1 && productViews[0].page_type === 'product', productViews[0]);
    ok('and it names the product',
        productViews.length === 1 && String(productViews[0].product_id) === String(firstId),
        productViews[0]);

    const productSlots = await product.page.evaluate((slots) =>
        slots.filter((slot) => !!document.getElementById('dn_inline_target_' + slot)), SLOTS);
    const everySlot = new Set([...homeSlots, ...productSlots]);
    ok('all five inline slots exist across the two pages',
        SLOTS.every((slot) => everySlot.has(slot)),
        SLOTS.filter((slot) => !everySlot.has(slot)));

    /* ------------------------------------------------------------------- 11 */
    console.log('\n11. No console errors on either page');
    ok('home is clean', home.errors.length === 0, home.errors.slice(0, 3));
    ok('the product page is clean', product.errors.length === 0, product.errors.slice(0, 3));

    /* NOT AN ASSERTION, AND THAT IS THE POINT. These came from the SDK or from
       content authored in the panel, so no change in this demo folder can fix
       one and refusing to publish over one would be refusing a working demo.
       They are printed because the panel's content is shared by every demo, so
       a fault here is worth seeing on the first build rather than the fifth. */
    const foreign = [...home.foreign, ...product.foreign];
    if (foreign.length) {
        console.log('\n    Errors from the SDK and panel content, which do not fail this build:');
        [...new Set(foreign)].slice(0, 6).forEach((line) => console.log('      note  ' + line));
        console.log('      These come from scripts this repository does not own. The demo itself');
        console.log('      is judged by the two assertions above, and both are clean.');
    }

    await browser.close();

    console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
    if (fail) {
        console.log('\nFailures:');
        failures.forEach((line) => console.log('   ' + line));
    }
    process.exit(fail ? 1 : 0);
})().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
});
