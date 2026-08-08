/* ============================================================================
   The render tier: a headless browser for storefronts that only exist after
   JavaScript runs.

     import { rendered } from './render.mjs';
     const result = await rendered('https://store.example');

   WHY IT EXISTS. A headless Shopify build, a React or Vue storefront, any
   single page application serves an almost empty HTML shell to a plain fetch:
   the shell loads a bundle and the bundle draws the store. The static tiers in
   catalogue.mjs read that shell, find nothing, and move on from a store a
   browser reads perfectly well. This module is that browser. It renders the
   page, waits for the network to go quiet, and hands the resulting DOM to the
   SAME extractor the jsonld tier uses, extractProductsFromHtml, so a page read
   from a fetched body and a page read from a rendered DOM answer identically.

   WHAT IT REFUSES TO DO. It never reads a price off the visible page. A
   struck-through was price, a per-instalment price and a bare "149" with no
   currency all look like prices to a text scraper, and a wrong number is worse
   than no number because the prospect knows their own prices. Structured data
   after rendering, or nothing: a store whose rendered DOM carries no JSON-LD,
   microdata or OpenGraph product markup falls through to the next tier.

   IT IDENTIFIES ITSELF. The browser context carries the same honest User-Agent
   as every plain fetch this factory makes, and there is no fingerprint evasion
   of any kind. A store that blocks the honest agent falls through to the CSV
   tier, and that is the designed behaviour rather than a defect to fix here.

   ROBOTS HOLDS HERE TOO. allowed() from fetch.mjs is asked before every
   navigation, the homepage included, so the robots decision keeps living in
   exactly one place however a page is read.

   IT DEGRADES RATHER THAN CRASHES. A machine without a usable Chromium answers
   { ok: false, reason: 'render-unavailable' } and the dispatcher moves on. The
   catalogue read must never die because a browser is missing, because the tier
   below this one, the CSV path, still works on such a machine.
   ========================================================================== */

import { existsSync } from 'node:fs';

import { allowed, UA } from './fetch.mjs';
import { extractProductsFromHtml } from './catalogue.mjs';

const TIER = 'render';

/* Per page: how long a page gets to reach the network-quiet state before its
   DOM is read as it stands. Shared between the navigation and the quiet wait,
   so one page can never hold the tier for longer than this. */
const SETTLE_MS = 12000;

/* For the whole visit, homepage and product pages together. When it runs out,
   whatever was read so far is the answer: a partial catalogue read slowly still
   beats holding a GitHub Actions runner on one stubborn site. */
const BUDGET_MS = 90000;

/* How many product pages are opened after the homepage. Ten structured pages
   are plenty against a thirty product cap, and a browser page is the most
   expensive read this repository makes, so the fanout stays small. */
const LINK_CAP = 10;

/* Aborted before they leave the browser: none of them can carry product data,
   and together they are most of a storefront's bytes. Product photography is
   not lost by this, because images.mjs downloads it later from the imageUrl
   the structured data reports, with its own size and type checks. */
const HEAVY = new Set(['image', 'media', 'font']);

/* The same shape as catalogue.mjs's own mode(): the most frequent value wins,
   first seen wins a tie, an empty list is null rather than a guess. */
function mode(values) {
    if (!values.length) return null;
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* A product page is recognised by its path alone, which is deliberately crude:
   a link this misses costs one page of fanout, and the extractor still decides
   what is actually a product. Matching '/product' also covers '/products/'. */
function isProductPath(pathname) {
    const path = pathname.toLowerCase();
    return path.includes('/product') || path.includes('/item') || path.includes('/p/');
}

/* Candidate product links from the RENDERED document, which is the point of
   this tier: on an SPA these anchors do not exist in the fetched HTML at all.
   Same origin only, resolved against where the page actually ended up, hash
   stripped so '#reviews' is not a second page, deduped, capped. */
async function productLinks(page, origin) {
    let hrefs = [];
    try {
        hrefs = await page.$$eval('a[href]',
            (anchors) => anchors.map((a) => a.getAttribute('href') || ''));
    } catch (err) {
        /* A page that navigated away mid-read or never built a document simply
           contributes no links; the homepage extraction already happened. */
        return [];
    }

    const from = page.url() || origin + '/';
    const seen = new Set();
    const links = [];
    for (const href of hrefs) {
        let url;
        try { url = new URL(href, from); } catch (err) { continue; }
        if (url.origin !== origin) continue;
        if (!isProductPath(url.pathname)) continue;
        url.hash = '';
        if (url.href === from || seen.has(url.href)) continue;
        seen.add(url.href);
        links.push(url.href);
        if (links.length >= LINK_CAP) break;
    }
    return links;
}

/* One page visit: navigate, then wait for the network to go quiet or for the
   window to close, whichever comes first. The window is shared between the two
   waits rather than granted twice, so "quiet or 12s" means what it says.

   Neither wait is allowed to throw. A page that never reaches
   domcontentloaded, or never goes quiet because an analytics beacon polls
   forever, still gets its DOM read as it stands: whatever rendered by the
   deadline is more than a plain fetch ever saw. */
async function settle(page, url, windowMs) {
    const deadline = Date.now() + windowMs;
    const left = () => Math.max(1, deadline - Date.now());
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: left() });
    } catch (err) { /* read whatever is there */ }
    try {
        await page.waitForLoadState('networkidle', { timeout: left() });
    } catch (err) { /* never went quiet; the window is the answer */ }
}

/* The tier. Answers with the same envelope as every static tier, so the
   dispatcher in catalogue.mjs treats it as one of the family:

     { ok: true, tier: 'render', products, currency, detail }
     { ok: false, tier: 'render', reason }

   options, all optional and none used by the generator:
     budgetMs        replaces the overall wall clock cap, for tests
     settleMs        replaces the per page quiet window, for tests
     prepareContext  receives the browser context before any page opens. The
                     tests use it to install route fixtures so the suite never
                     touches the network; the resource-type abort below is
                     registered after it on purpose, because Playwright runs
                     the newest route handler first and the abort must outrank
                     any fixture. */
export async function rendered(origin, options) {
    const settings = options || {};
    const budgetMs = settings.budgetMs === undefined ? BUDGET_MS : settings.budgetMs;
    const settleMs = settings.settleMs === undefined ? SETTLE_MS : settings.settleMs;
    const started = Date.now();
    const remaining = () => budgetMs - (Date.now() - started);
    const windowFor = () => Math.min(settleMs, Math.max(1, remaining()));

    let base;
    try { base = new URL(origin); } catch (err) {
        return { ok: false, reason: 'bad-origin', tier: TIER };
    }

    /* The homepage is a navigation like any other, so it is asked for first,
       and a robots refusal here is an answer rather than an error. */
    if (!(await allowed(base.href))) {
        return { ok: false, reason: 'robots', tier: TIER };
    }

    /* WHERE THE BROWSER IS, ASKED IN THE ORDER THAT SURVIVES BOTH MACHINES.

       Naming a path outright does not work here: CHROMIUM_PATH or the sandbox's
       /opt/pw-browsers/chromium. That path exists on the machine this file was
       written on and does NOT exist on a GitHub runner, where the workflow
       installs Playwright's own browser under ~/.cache/ms-playwright. A launch
       against a path that is right on one of those and absent on the other
       reports the tier unavailable on exactly the runs it exists for.

       An EXPLICIT CHROMIUM_PATH is still honoured even when it does not exist,
       because the "no browser here" test sets it to a missing file on purpose
       and must keep getting a refusal. Everything else falls through to
       Playwright's own resolution, which is the only answer that is right on a
       runner. factory/scrape/images.mjs resolves it the same way; the two must
       not drift.

       A launch failure of any kind is still the one reason the dispatcher reads
       as "this runner cannot render", never as "this store cannot be read". */
    let browser;
    try {
        const { chromium } = await import('playwright');
        const fromEnv = process.env.CHROMIUM_PATH;
        const options = { headless: true };
        if (fromEnv) options.executablePath = fromEnv;
        else if (existsSync('/opt/pw-browsers/chromium')) {
            options.executablePath = '/opt/pw-browsers/chromium';
        }
        browser = await chromium.launch(options);
    } catch (err) {
        return { ok: false, reason: 'render-unavailable', tier: TIER };
    }

    try {
        const context = await browser.newContext({ userAgent: UA });
        if (settings.prepareContext) await settings.prepareContext(context);
        await context.route('**/*', (route) => {
            if (HEAVY.has(route.request().resourceType())) return route.abort();
            return route.fallback();
        });
        const page = await context.newPage();

        /* Accumulated across every page read. Deduped by id as it arrives, so
           a homepage that lists the same products its product pages describe
           does not count them twice; the dispatcher dedupes again by name,
           which folds colourways exactly as it does for the static tiers. */
        const byId = new Map();
        const currencies = [];
        let pagesRead = 0;
        const harvest = (extracted) => {
            pagesRead++;
            if (extracted.currency) currencies.push(extracted.currency);
            for (const product of extracted.products) {
                if (!byId.has(product.id)) byId.set(product.id, product);
            }
        };

        await settle(page, base.href, windowFor());
        harvest(extractProductsFromHtml(await page.content(), page.url() || base.href));

        const links = await productLinks(page, base.origin);
        let refused = 0;
        for (const link of links) {
            if (remaining() <= 0) break;
            if (!(await allowed(link))) { refused++; continue; }
            await settle(page, link, windowFor());
            harvest(extractProductsFromHtml(await page.content(), page.url() || link));
        }

        /* Quoted on the issue through attempts, like the jsonld tier's method
           counts, so whoever reads it can see how far the browser got. */
        const detail = 'pages ' + pagesRead + ', links ' + links.length +
            (refused ? ', robots refused ' + refused : '');

        const products = [...byId.values()];
        if (!products.length) {
            return { ok: false, reason: 'not-found', tier: TIER, detail };
        }
        return { ok: true, tier: TIER, products, currency: mode(currencies), detail };
    } catch (err) {
        /* A crash mid-crawl, a context that refused to open, a page that died:
           the dispatcher needs an answer, not an exception. THE DETAIL IS PLAIN
           LANGUAGE ON PURPOSE: attempts end up quoted on a public issue read by a
           salesperson, and the first live run of this tier put a vendor internal
           message there ("page.content: Unable to retrieve content because the
           page is navigating..."). The raw error goes to stderr for whoever is
           debugging; the report gets a sentence a person can act on. */
        console.error('[render] ' + String((err && err.message) || err).split('\n')[0]);
        return {
            ok: false, reason: 'render-failed', tier: TIER,
            detail: 'the site did not finish loading in a browser'
        };
    } finally {
        try { await browser.close(); } catch (err) { /* already gone */ }
    }
}
