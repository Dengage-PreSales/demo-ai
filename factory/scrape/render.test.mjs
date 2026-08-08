/* ============================================================================
   Tests for the render tier.

     node factory/scrape/render.test.mjs

   NO LIVE NETWORK. Every page the browser opens is served by a route fixture
   installed through the tier's prepareContext seam, on a fake origin that does
   not resolve, so nothing here depends on any real store and nothing can leak
   a request to one. The one real socket in this file is a loopback server in
   section 3, and it exists because robots.txt is read by allowed() in Node
   rather than by the browser: a route fixture can only answer the browser, so
   the robots test needs an origin Node can genuinely fetch. Assigned port
   range for this suite: 9300 to 9399.

   THE FAIL OPEN TESTS ARE THE ONES THAT MATTER MOST. Section 1 first proves
   the fixture page yields NOTHING to a plain read, because a render tier
   tested only on pages a plain fetch could read proves nothing. Section 3
   proves a disallowed path is never navigated to, and section 4 proves a
   machine without a browser degrades to a clean refusal instead of crashing
   the whole catalogue read.
   ========================================================================== */

import { createServer } from 'node:http';
import { rendered } from './render.mjs';
import { extractProductsFromHtml } from './catalogue.mjs';

/* Never resolves, so a robots.txt fetch by Node reports a network failure and
   the standard's own answer applies: no robots.txt means no restrictions. The
   browser never tries to resolve it at all, because every request to it is
   answered by a route fixture before it leaves Playwright. */
const FAKE = 'https://render-fixture.test';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function is(label, actual, expected) {
    ok(label, actual === expected, { actual, expected });
}

function same(label, actual, expected) {
    ok(label, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */

/* A JSON-LD Product block of the shape current storefronts emit, and the only
   kind of price this suite ever serves: structured, with a currency. */
function ld(name, price, currency) {
    return '<script type="application/ld+json">' + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        sku: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        offers: { '@type': 'Offer', price: String(price), priceCurrency: currency }
    }) + '</script>';
}

/* A request the fixture holds open forever, for the budget test: the route
   handler simply never answers, so the page never reaches network idle. */
const HANG = Symbol('never answers');

/* Builds a prepareContext hook serving `pages` (pathname to HTML) and logging
   every request URL that actually reaches the fixture. Aborted requests never
   reach it, which is itself asserted in section 1. */
function fixtureRoutes(pages, log) {
    return async (context) => {
        await context.route('**/*', (route) => {
            const url = route.request().url();
            log.push(url);
            const body = pages[new URL(url).pathname];
            if (body === HANG) return; /* stays pending, on purpose */
            if (body === undefined) {
                return route.fulfill({ status: 404, contentType: 'text/html', body: '<p>not here</p>' });
            }
            return route.fulfill({ status: 200, contentType: 'text/html', body });
        });
    };
}

/* -------------------------------------------------------------------------- */
console.log('\n1. A JavaScript rendered storefront yields its catalogue');

{
    /* The defining case for the tier: an empty shell whose product markup is
       injected by script 300ms after load, exactly what a headless Shopify or
       React build serves. The image in the shell exists to prove the heavy
       resource abort, because a hero image is the first thing such a shell
       requests. */
    const blob = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Aurora Table Lamp',
        sku: 'AUR-1',
        offers: { '@type': 'Offer', price: '149.50', priceCurrency: 'EUR' }
    });
    const shell = '<html><head><title>Shell</title></head><body>' +
        '<div id="app"></div><img src="/hero.jpg">' +
        '<script>setTimeout(function () {' +
        'var s = document.createElement("script");' +
        's.type = "application/ld+json";' +
        's.textContent = ' + JSON.stringify(blob) + ';' +
        'document.head.appendChild(s);' +
        '}, 300);</script></body></html>';

    /* The fail open half first: the shell as served must read as empty, or
       this section only proves what the jsonld tier already covers. */
    const plain = extractProductsFromHtml(shell, FAKE + '/');
    is('the raw shell yields nothing to a plain read', plain.products.length, 0);

    const log = [];
    const result = await rendered(FAKE, { prepareContext: fixtureRoutes({ '/': shell }, log) });

    ok('the render tier reads it', result.ok, result);
    is('under its own name', result.tier, 'render');
    is('one product', result.ok && result.products.length, 1);
    is('with the injected name', result.ok && result.products[0].name, 'Aurora Table Lamp');
    is('the structured price, not a scraped one', result.ok && result.products[0].price, 149.5);
    is('and the currency the markup declared', result.currency, 'EUR');
    ok('the hero image was aborted before it reached the fixture',
       !log.some((url) => url.includes('/hero.jpg')), log);
}

/* -------------------------------------------------------------------------- */
console.log('\n2. Product links: discovered post render, deduped, capped at 10');

{
    /* Fourteen product links where the cap allows ten, plus every shape the
       filter must refuse: an exact duplicate, the same page again behind a
       hash, a non-product path, and a product path on another origin. If the
       dedupe failed, the duplicates would spend two of the ten slots and
       item-10 would never be visited. */
    let home = '<html><body><h1>Store</h1>';
    home += '<a href="/products/item-1">again</a>';
    home += '<a href="/products/item-2#reviews">reviews</a>';
    for (let i = 1; i <= 14; i++) {
        home += '<a href="/products/item-' + i + '">Item ' + i + '</a>';
    }
    home += '<a href="/about">About</a>';
    home += '<a href="https://elsewhere.test/products/x">External</a>';
    home += '</body></html>';

    const pages = { '/': home };
    for (let i = 1; i <= 14; i++) {
        pages['/products/item-' + i] =
            '<html><body>' + ld('Fixture Item ' + i, 10 + i, 'GBP') + '</body></html>';
    }

    const log = [];
    const result = await rendered(FAKE, { prepareContext: fixtureRoutes(pages, log) });

    ok('the tier reads the store', result.ok, result);
    const visits = log.filter((url) => url.includes('/products/item-'));
    is('exactly ten product pages are visited when fourteen exist', visits.length, 10);
    is('ten products arrive', result.ok && result.products.length, 10);
    is('the duplicate link did not spend a slot: item-10 is visited',
       visits.filter((url) => url.endsWith('/products/item-10')).length, 1);
    is('the duplicated item-1 is visited once, not twice',
       visits.filter((url) => url.endsWith('/products/item-1')).length, 1);
    is('the hash variant of item-2 is visited once, not twice',
       visits.filter((url) => url.includes('/products/item-2')).length, 1);
    ok('items beyond the cap are never visited',
       !log.some((url) => /item-1[1-4]$/.test(url)), visits);
    ok('the non-product path is never visited', !log.some((url) => url.includes('/about')), log);
    ok('the other origin is never visited', !log.some((url) => url.includes('elsewhere.test')), log);
    is('the modal currency is reported', result.currency, 'GBP');
}

/* -------------------------------------------------------------------------- */
console.log('\n3. robots.txt binds rendered navigation too');

{
    /* allowed() runs in Node, so robots.txt must live on an origin Node can
       fetch: a loopback server inside this suite's port range. The browser
       side of that same origin is fully served by route fixtures, and the
       server's own log proves it at the end: if interception ever failed, the
       server would have seen page requests alongside the robots reads. */
    const PORT = 9300;
    const serverLog = [];
    const server = createServer((request, response) => {
        serverLog.push(request.url);
        if (request.url === '/robots.txt') {
            response.writeHead(200, { 'content-type': 'text/plain' });
            response.end('User-agent: *\nDisallow: /products/\n');
            return;
        }
        response.writeHead(404, { 'content-type': 'text/html' });
        response.end('<p>not here</p>');
    });
    await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + PORT;

    const pages = {
        '/': '<html><body>' + ld('Front Door', 12, 'USD') +
             '<a href="/products/secret-1">One</a>' +
             '<a href="/products/secret-2">Two</a>' +
             '<a href="/item/open-1">Open</a></body></html>',
        '/products/secret-1': '<html><body>' + ld('Secret One', 5, 'USD') + '</body></html>',
        '/products/secret-2': '<html><body>' + ld('Secret Two', 6, 'USD') + '</body></html>',
        '/item/open-1': '<html><body>' + ld('Open One', 7, 'USD') + '</body></html>'
    };
    const log = [];
    const result = await rendered(origin, { prepareContext: fixtureRoutes(pages, log) });

    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));

    ok('the tier still reads what robots allows', result.ok, result);
    ok('no disallowed page was ever navigated to',
       !log.some((url) => url.includes('/products/')), log);
    ok('the allowed product link was visited',
       log.some((url) => url.includes('/item/open-1')), log);
    same('only the permitted pages contribute products',
         result.ok ? result.products.map((p) => p.name).sort() : [],
         ['Front Door', 'Open One']);
    ok('the browser never reached the real socket: the server saw only robots reads',
       serverLog.length > 0 && serverLog.every((url) => url === '/robots.txt'), serverLog);
}

/* -------------------------------------------------------------------------- */
console.log('\n4. A machine without a browser degrades instead of crashing');

{
    /* The fail open test the module exists to pass: CHROMIUM_PATH pointing at
       nothing must come back as a clean refusal the dispatcher can step over,
       because the CSV tier still works on a machine with no browser at all. */
    const before = process.env.CHROMIUM_PATH;
    process.env.CHROMIUM_PATH = '/nonexistent/chromium';
    const result = await rendered(FAKE, { prepareContext: async () => {} });
    if (before === undefined) delete process.env.CHROMIUM_PATH;
    else process.env.CHROMIUM_PATH = before;

    same('a missing browser is a clean, named refusal',
         { ok: result.ok, reason: result.reason, tier: result.tier },
         { ok: false, reason: 'render-unavailable', tier: 'render' });
}

/* -------------------------------------------------------------------------- */
console.log('\n5. The wall clock budget: a page that never goes quiet still answers');

{
    /* Every page here opens a fetch the fixture never answers, so network idle
       never fires anywhere and only the two clocks can end the read. The
       budget and settle window are shrunk through the same options the
       generator leaves untouched, because a test that genuinely waited 90
       seconds would prove the same thing more slowly. */
    const hangScript = '<script>fetch("/hang").catch(function () {});</script>';
    const pages = {
        '/': '<html><body><div id="app"></div>' + ld('Patient Product', 20, 'EUR') +
             '<a href="/products/slow-1">One</a>' +
             '<a href="/products/slow-2">Two</a>' +
             '<a href="/products/slow-3">Three</a>' +
             hangScript + '</body></html>',
        '/hang': HANG,
        '/products/slow-1': '<html><body><p>loading</p>' + hangScript + '</body></html>',
        '/products/slow-2': '<html><body><p>loading</p>' + hangScript + '</body></html>',
        '/products/slow-3': '<html><body><p>loading</p>' + hangScript + '</body></html>'
    };

    const log = [];
    const started = Date.now();
    const result = await rendered(FAKE, {
        prepareContext: fixtureRoutes(pages, log),
        settleMs: 700,
        budgetMs: 2500
    });
    const elapsed = Date.now() - started;

    ok('the function returns', result && typeof result.ok === 'boolean', result);
    ok('inside a bounded time rather than hanging on the pending request',
       elapsed < 12000, elapsed);
    ok('and returns what it had when the budget expired', result.ok, result);
    is('the homepage product, read before the clock ran out',
       result.ok ? result.products[0].name : null, 'Patient Product');
    is('nothing else was invented to fill the gap', result.ok && result.products.length, 1);
}

/* -------------------------------------------------------------------------- */

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
