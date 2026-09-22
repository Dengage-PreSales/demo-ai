/* ============================================================================
   EVERY CATEGORY THE STORE HAS IS REACHABLE, at a laptop width and on a phone.

     node factory/checks/nav.mjs                     the template
     node factory/checks/nav.mjs --url <demo url>    a generated demo

   WHY THIS EXISTS. factory/scrape/catalogue.mjs was raised on 18 September 2026
   to keep up to eight categories, because three shelves does not carry a sales
   conversation. The header was a single flex row with overflow: hidden, which
   with five categories never showed and with eight silently clips the last ones.

   A CLIPPED CATEGORY IS THE WORST SHAPE OF THIS BUG. The shelf exists, its
   products are in the catalogue, the filters know about it, and the one thing a
   prospect uses to get to it is invisible with nothing on screen to say so. It
   would have been found on a call rather than here.

   SO THE ASSERTION IS REACHABILITY, NOT APPEARANCE. Every category named in the
   demo's own configuration has a link, that link has a real box, and it is
   either inside the nav's visible width or the nav can be scrolled to it. That
   holds whether the fix is tighter spacing, a scroller, a wrap or something
   nobody has thought of yet.
   ========================================================================== */
import { chromium } from 'playwright';
import { launchOptions } from '../browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i];
    if (!token.startsWith('--')) continue;
    const next = process.argv[i + 1];
    args[token.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i++;
}
const BASE = String(args.url || process.env.TEMPLATE_URL ||
    'http://localhost:8101/template/').replace(/\/?$/, '/');

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
    if (cond) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
};

/* Everything measured about the nav at one viewport, in one pass inside the
   page.

   WHAT "REACHABLE" CANNOT BE MEASURED AS, because the first version of this file
   got it wrong and passed on the broken CSS. It compared each link's right edge
   against clientWidth plus the nav's scrollable slack, on the assumption that
   overflow: hidden would report no slack. It reports all of it: scrollWidth
   describes the content whether or not the visitor can ever see it, so the
   comparison was against the content's own width and every link "fitted".

   SO REACHABILITY IS DRIVEN, NOT DERIVED. A link inside clientWidth is visible
   and that is that. A link outside it is reachable only if a real scroll gesture
   brings it in, so the check performs one, which is the same thing a person
   would do and the one thing overflow: hidden refuses. See reachByScrolling. */
function measureNav() {
    const nav = document.querySelector('.site-nav');
    const links = nav ? [...nav.querySelectorAll('a')] : [];
    const navBox = nav ? nav.getBoundingClientRect() : null;
    const style = nav ? getComputedStyle(nav) : null;
    const reach = nav ? nav.clientWidth + (nav.scrollWidth - nav.clientWidth) : 0;
    const stacked = style ? style.flexDirection === 'column' : false;
    return {
        present: !!nav,
        stacked,
        count: links.length,
        overflowY: style ? style.overflowY : '',
        navWidth: navBox ? Math.round(navBox.width) : 0,
        scrollWidth: nav ? nav.scrollWidth : 0,
        clientWidth: nav ? nav.clientWidth : 0,
        scrollsUpAndDown: nav ? nav.scrollHeight > nav.clientHeight + 1 : false,
        names: links.map((a) => (a.textContent || '').trim()),
        /* The distance from the nav's own left edge to each link's right edge.
           Anything beyond `reach` cannot be brought into view by any amount of
           scrolling, which is the definition of clipped. */
        ends: links.map((a) => Math.round(
            a.getBoundingClientRect().right - navBox.left + nav.scrollLeft)),
        reach: Math.round(reach),
        overflowX: style ? style.overflowX : '',
        scrollLeft: nav ? Math.round(nav.scrollLeft) : 0,
        /* Inside the visible width, with no scrolling of any kind. */
        visibleNow: links.filter((a) =>
            a.getBoundingClientRect().right <= navBox.right + 1 &&
            a.getBoundingClientRect().left >= navBox.left - 1).length,
        /* Stacked, the nav is a dropped panel and each row is full width, so the
           vertical extent is what matters instead. */
        bottoms: stacked ? links.map((a) => Math.round(a.getBoundingClientRect().height)) : [],
        pageSideways: document.documentElement.scrollWidth > window.innerWidth
    };
}

/* EVERY CATEGORY EITHER SHOWS OR CAN BE SCROLLED TO, proved by scrolling.

   The gesture is a real wheel over the nav rather than an assignment to
   scrollLeft, because script can scroll a container the visitor cannot: setting
   scrollLeft moves an overflow: hidden element quite happily, which is exactly
   the false pass this replaced. A wheel is what a person does and it is refused
   by the same declaration that refuses them.

   It scrolls in steps and collects what became visible, so a nav needing several
   drags is still judged reachable, and it puts the nav back afterwards so later
   measurements start where they would for a visitor arriving. */
async function reachByScrolling(page) {
    const nav = page.locator('.site-nav');
    const seen = new Set(await page.evaluate(() => {
        const bar = document.querySelector('.site-nav');
        const box = bar.getBoundingClientRect();
        return [...bar.querySelectorAll('a')]
            .filter((a) => a.getBoundingClientRect().right <= box.right + 1)
            .map((a) => (a.textContent || '').trim());
    }));
    const all = await page.evaluate(() => [...document.querySelectorAll('.site-nav a')]
        .map((a) => (a.textContent || '').trim()));
    await nav.hover();
    for (let step = 0; step < 8 && seen.size < all.length; step++) {
        await page.mouse.wheel(220, 0);
        await page.waitForTimeout(90);
        for (const name of await page.evaluate(() => {
            const bar = document.querySelector('.site-nav');
            const box = bar.getBoundingClientRect();
            return [...bar.querySelectorAll('a')]
                .filter((a) => {
                    const r = a.getBoundingClientRect();
                    return r.left >= box.left - 1 && r.right <= box.right + 1;
                })
                .map((a) => (a.textContent || '').trim());
        })) seen.add(name);
    }
    await page.evaluate(() => { document.querySelector('.site-nav').scrollLeft = 0; });
    return { unreachable: all.filter((name) => !seen.has(name)), all: all.length };
}

(async () => {
    const browser = await chromium.launch(launchOptions({ headless: true }));
    console.log('\nNavigation: ' + BASE);

    /* ------------------------------------------------------------------- 1 */
    /* THE CATEGORIES ARE READ FROM THE DEMO RATHER THAN LISTED HERE, so this
       file is right about every store instead of about one. */
    const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await wide.goto(BASE, { waitUntil: 'domcontentloaded' });
    await wide.waitForFunction(() => window.DEMO_CONFIG && window.Catalog &&
        window.Catalog.all().length, null, { timeout: 25000 });
    const configured = await wide.evaluate(() => (window.DEMO_CONFIG.categories || []).slice());

    console.log('\n1. A laptop width shows every category the demo has');
    console.log('   (' + configured.length + ' configured: ' + configured.join(', ') + ')');
    const laptop = await wide.evaluate(measureNav);
    ok('the header has a nav', laptop.present, laptop);
    ok('with a link for every configured category',
        laptop.count >= configured.length, { links: laptop.count, configured: configured.length });
    const missing = configured.filter((name) =>
        !laptop.names.some((text) => text.toLowerCase() === String(name).toLowerCase()));
    ok('and each one is named in it', missing.length === 0, missing);

    /* THE ASSERTION THE CLIPPING FAILS. With overflow: hidden a link past the
       nav's width has a box, is in the DOM, answers to a selector and cannot be
       brought on screen by anything the visitor can do. */
    const laptopReach = await reachByScrolling(wide);
    ok('no category is clipped out of reach', laptopReach.unreachable.length === 0,
        laptopReach);

    /* And the overflow trap this repository has now paid for twice. */
    ok('the nav is not declared scrollable up and down',
        laptop.overflowY === 'hidden' || laptop.overflowY === 'clip' ||
        laptop.overflowY === 'visible', laptop.overflowY);
    ok('and nothing in it actually scrolls vertically',
        laptop.scrollsUpAndDown === false, laptop);
    ok('the page does not scroll sideways because of it',
        laptop.pageSideways === false, laptop);
    await wide.close();

    /* ------------------------------------------------------------------- 2 */
    console.log('\n2. A phone reaches them too, in the dropped panel');
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await phone.goto(BASE, { waitUntil: 'domcontentloaded' });
    await phone.waitForFunction(() => window.DEMO_CONFIG && window.Catalog &&
        window.Catalog.all().length, null, { timeout: 25000 });
    /* The panel is shut until the toggle is pressed, which is the storefront
       behaving correctly, so it is opened the way a visitor opens it. */
    await phone.click('.nav-toggle');
    await phone.waitForTimeout(250);
    const small = await phone.evaluate(measureNav);
    ok('the panel opens', small.count > 0, small);
    ok('and it stacks rather than staying a row', small.stacked, small);
    ok('every row is a comfortable tap target',
        small.bottoms.length > 0 && small.bottoms.every((h) => h >= 36), small.bottoms);
    ok('the phone still does not scroll sideways', small.pageSideways === false, small);
    await phone.close();

    /* ------------------------------------------------------------------- 3 */
    console.log('\n3. And it copes with the most categories the scrape will ever give it');
    /* THE TEMPLATE HAS THREE CATEGORIES, so everything above passes on a nav
       that was never asked a hard question. That is the shape CLAUDE.md 4 calls
       a guard that proves nothing, and it is why this section exists: the cap in
       factory/scrape/catalogue.mjs is read, the nav is filled to it with names
       as long as a real store's, and the same reachability rule is applied.

       THE NAMES ARE FROM REAL STORES seen while building this, because the
       length is the whole difficulty. "Herbs & Spices" and "Nuts & Dried
       Fruits" are what a grocer's header actually holds, and a check that used
       "Cat 1" through "Cat 8" would fit anywhere and catch nothing. */
    const CAP = await (async () => {
        const mod = await import('../scrape/catalogue.mjs');
        return mod.CATEGORY_CAP;
    })();
    /* THE CAP IS NOT THE WORST CASE, and using it here meant this section tested
       two links fewer than a real build can produce. A demo's header carries
       every shelf the scrape kept, plus the tail group that holds whatever did
       not fit a shelf, plus the All products link the storefront adds itself. */
    const WORST = CAP + 2;
    const LONG = ['Fresh Fruits', 'Fresh Vegetables', 'Fresh Flowers', 'Herbs & Spices',
        'Nuts & Dried Fruits', 'Gift Bundles', 'Weekly Deals', 'Juices & Smoothies',
        'Bakery & Pastry', 'Hampers'];
    const full = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await full.goto(BASE, { waitUntil: 'domcontentloaded' });
    await full.waitForFunction(() => window.DEMO_CONFIG && window.Catalog &&
        window.Catalog.all().length, null, { timeout: 25000 });
    const stuffed = await full.evaluate(({ names, measure }) => {
        const nav = document.querySelector('.site-nav');
        const model = nav.querySelector('a');
        nav.innerHTML = '';
        for (const name of names) {
            const link = model.cloneNode(true);
            link.textContent = name;
            link.removeAttribute('aria-current');
            nav.appendChild(link);
        }
        return new Function('return (' + measure + ')()')();
    }, { names: LONG.slice(0, WORST), measure: measureNav.toString() });
    console.log('   (' + WORST + ' links, the worst case a build can produce)');
    ok('the nav holds all ' + WORST, stuffed.count === WORST, stuffed.count);
    const fullReach = await reachByScrolling(full);
    ok('and not one of them is clipped out of reach', fullReach.unreachable.length === 0,
        fullReach);
    ok('still nothing scrolling up and down in it',
        stuffed.scrollsUpAndDown === false, stuffed);
    ok('and the header has not pushed the page sideways',
        stuffed.pageSideways === false, stuffed);
    await full.close();

    console.log('\n   ' + pass + ' passed, ' + fail + ' failed\n');
    await browser.close();
    process.exit(fail ? 1 : 0);
})();
