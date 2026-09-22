/* ============================================================================
   Tests for the rendered theme channel.

     node factory/scrape/theme-rendered.test.mjs

   A LOCAL SERVER, NOT THE INTERNET. Every fixture is served from 127.0.0.1, so
   the suite is fast, repeatable and does not depend on a prospect's site being
   up. That is also the only way it can run in this sandbox, where the browser
   has no outbound network at all.

   WHAT IS BEING TESTED IS THE READING, NOT THE BROWSER. Each fixture is a page
   whose intended answer is obvious by construction: a black page must read as
   dark, a Bootstrap page whose real theme arrives with its JavaScript must read
   as the JavaScript left it and not as Bootstrap shipped it. That second shape is
   the reason this file exists: it is the one a text reader cannot get right.

   IT SKIPS LOUDLY. Without a usable browser the assertions are not silently
   counted as passes, because a suite that reports green on a machine that could
   not run it is worse than one that says it did not run.
   ========================================================================== */
import { createServer } from 'node:http';

import { renderedTheme } from './theme-rendered.mjs';
import { theme } from './theme.mjs';

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

/* A throwaway server per fixture, on its own port, closed before the next one. */
let port = 9300;
async function serve(pages) {
    const chosen = port++;
    const server = createServer((request, response) => {
        const path = request.url.split('?')[0];
        const page = pages[path];
        if (!page) { response.writeHead(404); response.end('no'); return; }
        response.writeHead(200, { 'content-type': page.type || 'text/html; charset=utf-8' });
        response.end(page.body);
    });
    await new Promise((resolve) => server.listen(chosen, '127.0.0.1', resolve));
    return {
        origin: 'http://127.0.0.1:' + chosen,
        close: () => new Promise((resolve) => server.close(resolve))
    };
}

/* A SERVER THE BROWSER WILL NOT TRUST, so the refusal under test is the
   browser's real one rather than a simulation of it. The certificate is
   generated here and signed by nobody, which is exactly what a local
   interception authority looks like to a browser that has not been told about
   it: same error code, same interstitial, same colours. */
async function serveHttps() {
    const chosen = port++;
    const { generateKeyPairSync } = await import('node:crypto');
    const { execFileSync } = await import('node:child_process');
    const { mkdtempSync, writeFileSync, readFileSync: read } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'dps-cert-'));
    /* openssl rather than a hand rolled certificate: it is present wherever this
       suite runs, and a certificate this test builds itself would be one more
       thing that can be subtly wrong in a way that makes the test pass. */
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '2',
        '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
    const { createServer: createTls } = await import('node:https');
    const server = createTls({ key: read(join(dir, 'k.pem')), cert: read(join(dir, 'c.pem')) },
        (request, response) => {
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            response.end(storefront('body{background:#0b0b0b;color:#f2f2f2}'));
        });
    await new Promise((resolve) => server.listen(chosen, '127.0.0.1', resolve));
    return {
        origin: 'https://127.0.0.1:' + chosen,
        close: () => new Promise((resolve) => server.close(resolve))
    };
}

/* Enough of a storefront for the reader to have something real to measure:
   prose long enough to count as text, cards big enough to count as surfaces,
   and a button big enough to count as an action. */
function storefront(css, extra) {
    return `<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Georgia, serif; }
      .wrap { padding: 40px; }
      .card { width: 300px; height: 200px; padding: 20px; margin: 12px 0; border-top: 1px solid; }
      h1 { font-family: Oswald, sans-serif; font-size: 40px; }
      p { font-size: 16px; }
      .btn { display: inline-block; width: 200px; height: 48px; border: 0; border-radius: 6px; }
      ${css}
    </style></head><body><div class="wrap">
      <h1>The season is here</h1>
      <p>This paragraph is long enough to count as real prose on the page.</p>
      <div class="card"><p>A card with its own background and a hairline above it.</p></div>
      <div class="card"><p>A second card so the surface colour has more than one vote.</p></div>
      <button class="btn">Add to cart</button>
      <a href="/x">A link that is long enough to be measured</a>
      ${extra || ''}
    </div></body></html>`;
}

/* -------------------------------------------------------------------------- */

const probe = await serve({ '/': { body: storefront('') } });
const available = await renderedTheme(probe.origin, { settleMs: 8000 });
await probe.close();

if (!available.ok && available.reason === 'render-unavailable') {
    console.log('\n   SKIPPED: no usable browser on this machine.');
    console.log('   These assertions did not run. That is not a pass.');
    process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* 1. A dark store reads as dark                                              */

{
    const site = await serve({
        '/': {
            body: storefront(`
                body { background: #0b0b0b; color: #f2f2f2; }
                .card { background: #1a1a1a; border-top-color: #333333; }
                .btn { background: #c8102e; color: #ffffff; }
                a { color: #e8b64c; }
            `)
        }
    });
    const seen = await renderedTheme(site.origin, { settleMs: 8000 });
    ok('a dark storefront is read at all', seen.ok, seen);
    is('the page colour is the black it is painted with', seen.page, '#0b0b0b');
    is('the text colour is the near white on it', seen.ink, '#f2f2f2');
    is('the card is read as the surface', seen.surface, '#1a1a1a');
    is('the hairline is read', seen.line, '#333333');
    is('the button colour is the brand, not the black behind it', seen.button, '#c8102e');
    ok('and the page is reported as dark', seen.pageLuminance < 0.1, seen.pageLuminance);

    /* The whole point: the theme that comes out must be dark, not the template's. */
    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };
    const out = await theme(site.origin, light, { settleMs: 8000 });
    await site.close();

    ok('the neutrals were adopted', out.found.neutrals === true, out.found);
    ok('and the demo is flagged dark', out.found.dark === true, out.found);
    is('the demo page is dark', out.theme.page, '#0b0b0b');
    is('the demo surface is dark', out.theme.surface, '#1a1a1a');
    is('the demo text is light', out.theme.ink, '#f2f2f2');
    is('the brand colour is the store\'s button', out.theme.primary, '#c8102e');
    ok('none of the template\'s light neutrals survived',
       out.theme.page !== light.page && out.theme.surface !== light.surface &&
       out.theme.ink !== light.ink && out.theme.muted !== light.muted,
       { page: out.theme.page, surface: out.theme.surface, ink: out.theme.ink, muted: out.theme.muted });
}

/* -------------------------------------------------------------------------- */
/* 2. The case that caused this: Bootstrap in the HTML, the real theme in JS   */

{
    /* A storefront whose served CSS declares Bootstrap's palette and nothing
       else, with its real look applied by script after load. No text reader can
       see past the framework here. */
    const bootstrapish = `
        :root { --bs-primary: #0d6efd; --bs-danger: #dc3545; --bs-body-bg: #ffffff; }
        .text-primary { color: #0d6efd; } .bg-primary { background: #0d6efd; }
        .btn-primary { background: #0d6efd; } .border-primary { border-color: #0d6efd; }
        .link-primary { color: #0d6efd; } .badge-primary { background: #0d6efd; }
    `;
    const script = `<script>
        document.addEventListener('DOMContentLoaded', function () {
            var s = document.createElement('style');
            s.textContent = 'body{background:#000000;color:#ffffff}' +
                '.card{background:#141414;border-top-color:#2b2b2b}' +
                '.btn{background:#f5c518;color:#000000}';
            document.head.appendChild(s);
        });
    </script>`;
    const site = await serve({ '/': { body: storefront(bootstrapish, script) } });

    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };

    /* Without the browser this is the old behaviour, and it is the bug: the only
       evidence in the text is Bootstrap's, so Bootstrap's palette wins. */
    const textOnly = await theme(site.origin, light, { render: false });
    ok('with text alone the page stays light, which is what the browser corrects',
       textOnly.theme.page === light.page, textOnly.theme.page);
    ok('and no framework default was adopted as the brand',
       textOnly.theme.primary !== '#0d6efd', textOnly.theme.primary);

    const out = await theme(site.origin, light, { settleMs: 9000 });
    await site.close();
    is('with the browser the page is the black the script painted', out.theme.page, '#000000');
    is('the surface is the script\'s card colour', out.theme.surface, '#141414');
    is('the text is white', out.theme.ink, '#ffffff');
    is('the brand is the painted button, not Bootstrap blue', out.theme.primary, '#f5c518');
    ok('the label on that button is readable',
       out.theme.onPrimary === '#14181b' || out.theme.onPrimary === '#000000', out.theme.onPrimary);
}

/* -------------------------------------------------------------------------- */
/* 3. Unreadable neutrals are refused as a set, never adopted by halves        */

{
    /* Text that does not clear 4.5 against its own background. Adopting the page
       here and keeping the template's dark ink, or the reverse, is precisely the
       grey-on-grey the old no-neutrals decision was protecting against. */
    const site = await serve({
        '/': {
            body: storefront(`
                body { background: #6b6b6b; color: #7a7a7a; }
                .card { background: #6b6b6b; border-top-color: #6f6f6f; }
                .btn { background: #2f6f4f; color: #ffffff; }
            `)
        }
    });
    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };
    const out = await theme(site.origin, light, { settleMs: 8000 });
    await site.close();

    ok('an unreadable pairing is not adopted', out.found.neutrals !== true, out.found);
    is('the page stays the template\'s', out.theme.page, light.page);
    is('the surface stays the template\'s', out.theme.surface, light.surface);
    is('the text stays the template\'s', out.theme.ink, light.ink);
    ok('but the brand colour is still taken, because it was readable',
       out.theme.primary === '#2f6f4f', out.theme.primary);
}

/* -------------------------------------------------------------------------- */
/* 4. A grey button is not a brand colour                                     */

{
    const site = await serve({
        '/': {
            body: storefront(`
                body { background: #ffffff; color: #222222; }
                .card { background: #fafafa; border-top-color: #dddddd; }
                .btn { background: #eeeeee; color: #222222; }
            `)
        }
    });
    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };
    const out = await theme(site.origin, light, { settleMs: 8000 });
    await site.close();
    ok('a grey button does not become the brand colour',
       out.theme.primary !== '#eeeeee', out.theme.primary);
    ok('the light neutrals are still adopted, since they are readable',
       out.found.neutrals === true, out.found);
}

/* -------------------------------------------------------------------------- */
/* 5. No browser is a clean refusal, not a wrong answer                       */

{
    const site = await serve({ '/': { body: storefront('') } });
    const before = process.env.CHROMIUM_PATH;
    process.env.CHROMIUM_PATH = '/nonexistent/chromium-that-is-not-here';
    const seen = await renderedTheme(site.origin, { settleMs: 4000 });
    const out = await theme(site.origin, { primary: '#125cfa', ink: '#14181b', page: '#f6f7f8',
                                           surface: '#ffffff', muted: '#667085', line: '#e4e7ec',
                                           onPrimary: '#ffffff', accent: '#ff5a1f',
                                           radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' },
                            { settleMs: 4000 });
    if (before === undefined) delete process.env.CHROMIUM_PATH;
    else process.env.CHROMIUM_PATH = before;
    await site.close();

    is('a missing browser is reported as unavailable', seen.reason, 'render-unavailable');
    ok('and the text answer still ships a theme', typeof out.theme.primary === 'string', out.theme);
    ok('with the rendered channel marked absent', !out.found.rendered, out.found);
}

/* -------------------------------------------------------------------------- */
/* 6. A painted framework default is still a framework default                 */

{
    /* THE SHAPE OF A REAL STORE, and the one that showed this was missing. A
       denim retailer's storefront is a separately loaded micro frontend, so a
       plain browser renders the shell: white page, Bootstrap's own body text
       colour, and a .btn-primary still carrying Bootstrap's blue because nothing
       ever restyled it. Every text channel had been taught to refuse that blue,
       and the rendered channel handed it straight back because it really is
       painted. */
    const site = await serve({
        '/': {
            body: storefront(`
                :root { --bs-primary: #0d6efd; }
                body { background: #ffffff; color: #212529; }
                .card { background: #fafafa; border-top-color: #e0e0e1; }
                .btn { background: #0d6efd; color: #ffffff; }
            `)
        }
    });
    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };
    const out = await theme(site.origin, light, { settleMs: 8000 });
    await site.close();

    ok('a painted framework default is not adopted as the brand',
       out.theme.primary !== '#0d6efd', out.theme.primary);
    ok('and the store is reported as having no readable brand colour',
       out.found.primary !== true, out.found);
    /* The neutrals are still real and still adopted: the page genuinely is white
       and the cards genuinely are #fafafa, so reading them is correct. */
    is('the page it really paints is still read', out.theme.page, '#ffffff');
    is('and the card colour with it', out.theme.surface, '#fafafa');
}

/* -------------------------------------------------------------------------- */
/* 7. A monochrome brand keeps its black                                       */

{
    /* Fashion and denim retail put black buttons on white pages and mean it.
       Refusing every colourless button lost those brands entirely, which is the
       opposite error to the one above and just as wrong. */
    const site = await serve({
        '/': {
            body: storefront(`
                body { background: #ffffff; color: #1a1a1a; }
                .card { background: #f7f7f7; border-top-color: #e2e2e2; }
                .btn { background: #000000; color: #ffffff; }
            `)
        }
    });
    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };
    const out = await theme(site.origin, light, { settleMs: 8000 });
    await site.close();

    is('a deliberate black button becomes the brand colour', out.theme.primary, '#000000');
    ok('with a readable label on it', out.theme.onPrimary === '#ffffff', out.theme.onPrimary);

    /* And the mid grey that a framework ships must still be refused, or this
       change would let every unstyled button through. */
    const grey = await serve({
        '/': {
            body: storefront(`
                body { background: #ffffff; color: #1a1a1a; }
                .card { background: #f7f7f7; border-top-color: #e2e2e2; }
                .btn { background: #6c757d; color: #ffffff; }
            `)
        }
    });
    const greyOut = await theme(grey.origin, light, { settleMs: 8000 });
    await grey.close();
    ok('an unstyled mid grey button is still refused',
       greyOut.theme.primary !== '#6c757d', greyOut.theme.primary);
}

/* -------------------------------------------------------------------------- */
/* 8. A page the browser wrote itself is never read as the store               */

{
    /* THIS IS THE ONE THAT SHIPPED. On a machine whose outbound TLS is
       re-signed by a local authority, Chromium refused a Saudi grocer's
       certificate and painted "Your connection is not private" instead. That
       page has a background, a text colour and a blue Back to safety button, so
       this module read all three and reported success, and the demo went out in
       Chromium's own palette and fallback font under the store's name.

       DRIVEN RATHER THAN DESCRIBED, which is the whole point of putting it here.
       A certificate the browser will not accept is served for real below, so the
       browser paints its real error page and the module is asked about it. */
    const cert = await serveHttps();
    const light = { primary: '#125cfa', onPrimary: '#ffffff', accent: '#ff5a1f', ink: '#14181b',
                    muted: '#667085', surface: '#ffffff', page: '#f6f7f8', line: '#e4e7ec',
                    radius: '8px', displayFont: 'Inter', bodyFont: 'Inter' };
    const seen = await renderedTheme(cert.origin, { settleMs: 9000 });
    is('a certificate the browser refuses is reported as such', seen.reason, 'certificate');
    ok('and nothing is returned to theme from it', seen.ok === false, seen);

    /* The whole answer, not just this channel's: the demo must come out in the
       standard palette rather than in the browser's. #1a73e8 is the exact blue
       of Chromium's Back to safety button, which is what shipped. */
    const out = await theme(cert.origin, light, { settleMs: 9000 });
    await cert.close();
    ok('so the theme is never the browser\'s own error page',
       out.theme.primary !== '#1a73e8' && out.theme.ink !== '#5f6368', out.theme);
    /* AND NOTHING FROM A BROWSER PAGE REACHED THE THEME. found.rendered is the
       record of the rendered channel having contributed, so its absence is the
       assertion: the palette above is the standard one because nothing overrode
       it, rather than by coincidence.

       WHAT THIS FIXTURE CANNOT REPRODUCE, said plainly because it is the half
       that shipped. Here the certificate is refused by Node as well, so theme()
       never gets as far as opening a browser. The real fault was an asymmetry:
       Node was told about the local authority and the browser was not, so the
       text channels read the real store and only the browser saw a warning
       page. That asymmetry is what the assertion above covers, by asking
       renderedTheme directly, which is the unit that was wrong. */
    ok('and nothing from a browser page reached the theme',
       out.found.rendered !== true, out.found);

    /* A NAME THAT DOES NOT RESOLVE IS THE SAME CLASS OF FAULT and gets its own
       reason, because the sentence a salesperson reads is different: one is the
       build machine's setting and the other is a wrong address. */
    const gone = await renderedTheme('https://not-a-real-store.invalid/', { settleMs: 9000 });
    ok('an address that does not resolve is reported as unreachable',
       gone.ok === false && gone.reason === 'unreachable', gone);
}

/* -------------------------------------------------------------------------- */
console.log('\n4. A store the text readers cannot reach is still read by the browser');

/* THE ONE THAT SHIPPED. theme() fetched the home page as text first and returned
   there if that failed, so the rendered channel, which outranks every text
   signal and exists precisely for a store a plain reader cannot get, was skipped
   in exactly the case it was built for. The build then reported "browser channel
   not run", which reads as a decision.

   uniworthshop.com in the drill of 22 September 2026: sixty products read
   through its Shopify endpoints, every check passed, and a palette belonging to
   nobody. A demo in the wrong colours is the defect a colleague actually sees.

   The fixture is the real shape rather than a stand in: the server refuses a
   plain reader and serves the painted page to a browser, which is what a store
   with a bot rule in front of it does. */
{
    const painted = '<!DOCTYPE html><html><head><style>' +
        'body{background:#ffffff;color:#101820;font-family:Rubik,sans-serif;}' +
        '.btn{background:#8b1f41;color:#ffffff;padding:12px 20px;display:inline-block;}' +
        '</style></head><body><a class="btn" href="/x">Add to basket</a></body></html>';

    const chosen = port++;
    let plainRefusals = 0;
    const server = createServer((request, response) => {
        /* sec-fetch-mode: a browser opening a page sends "navigate" and node's
           fetch sends "cors". Nothing else in the request separates them. The
           user agent cannot, because both identify themselves the same honest
           way on purpose, and the presence of the header cannot either, because
           node sends it too. Two earlier versions of this fixture tried each of
           those, served the page to both readers, and passed every assertion
           below without once creating the refusal it exists to create. */
        const isBrowser = String(request.headers['sec-fetch-mode'] || '') === 'navigate';
        if (!isBrowser) {
            plainRefusals++;
            response.writeHead(403); response.end('no');
            return;
        }
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(painted);
    });
    await new Promise((resolve) => server.listen(chosen, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + chosen;

    const STANDARD = { primary: '#125cfa', accent: '#f5a524', ink: '#14181b',
                       displayFont: 'Sora', bodyFont: 'Inter', radius: '10px' };
    const out = await theme(origin, STANDARD, { settleMs: 1200 });

    ok('the text reader was refused, so this is the case under test', plainRefusals > 0,
       { plainRefusals });
    ok('the browser was asked anyway', out.rendered !== null && out.rendered !== undefined,
       out.rendered);
    ok('and it answered', Boolean(out.rendered && out.rendered.ok), out.rendered);
    ok('so the store\'s own colour reached the theme, not the standard palette',
       out.found.rendered === true && out.theme.primary !== STANDARD.primary, out.theme);

    await new Promise((resolve) => server.close(resolve));
}

/* AND A CHANNEL THAT THROWS SAYS SO. The catch around the rendered channel used
   to swallow, so a fault in the channel itself came out as the standard palette
   with the build reporting that the browser was never asked: the one shape that
   cannot be traced back to anything. */
{
    const STANDARD = { primary: '#125cfa', accent: '#f5a524', ink: '#14181b',
                       displayFont: 'Sora', bodyFont: 'Inter', radius: '10px' };
    /* An origin the URL parser inside the channel cannot make sense of, which is
       the cheapest way to reach the catch without breaking a real browser. */
    const out = await theme('http://127.0.0.1:1', STANDARD, { settleMs: 800 });
    ok('a store that cannot be read at all still reports a reason rather than nothing',
       out.rendered !== null && out.rendered !== undefined && out.rendered.ok === false,
       out.rendered);
    ok('and the standard palette is what it falls back to',
       out.theme.primary === STANDARD.primary, out.theme);
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
