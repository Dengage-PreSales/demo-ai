/* The acceptance check for the education demo.

    python3 -m http.server 8101        # from the repository root
    node factory/education/check.mjs

WHAT IT ASSERTS, and why each one is here rather than left to a glance.

  1. Every page loads with no console error and no failed request.
  2. Every page fires exactly one page view, with the page type it declares.
  3. The chrome renders: header, navigation, footer, and the Dengage mark rather
     than an institution's own.
  4. Every collection on every page renders something. An empty grid looks like a
     design choice in a screenshot and like a broken build in a browser.
  5. Every launcher card fires, in both directions: every scenario in the module
     has a card, and every card names a scenario that exists.
  6. The funnel writes the events it claims to. Add a subject, start, submit, and
     the recorded calls are checked against the tables they land in.
  7. Nothing sends a price. A college publishes none, and Number(null) is 0, so
     the one thing worth asserting about the payloads is the absence of a key.

THE SDK IS REFUSED AT LAUNCH, AND THE REFUSAL IS ASSERTED. The real loader is
reachable from a machine with a network, and when it loads it replaces the stub
mid check, races the recorder and fails a good build intermittently. Refusing it
is the only way this check measures the demo rather than the weather, so the
refusal is a test rather than a comment. */
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const BASE = process.env.DEMO_URL || 'http://localhost:8101/demos/meridian-college/';
const SHOTS = process.env.SHOT_DIR || '';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DENGAGE_HOST = /(^|\.)dengage\.com$/;

let pass = 0;
const failures = [];
function ok(label, condition, detail) {
    if (condition) { pass++; return; }
    failures.push(label + (detail === undefined ? '' : '  ' + JSON.stringify(detail)));
}

/* Requests are fetched through curl because this environment reaches the network
   through a proxy the browser is not configured for. Localhost goes the same way
   and works, so there is one path rather than two. */
const work = mkdtempSync(join(tmpdir(), 'educheck-'));
let counter = 0;
async function grab(url) {
    const body = join(work, 'b' + (counter++));
    const head = body + '.h';
    try {
        await run('curl', ['-sSL', '--max-time', '40', '-D', head, '-o', body, url], { maxBuffer: 1 << 26 });
    } catch { return null; }
    let type = 'application/octet-stream';
    let status = 200;
    try {
        const raw = readFileSync(head, 'utf8');
        const codes = [...raw.matchAll(/^HTTP\/[\d.]+ (\d{3})/gm)].map((m) => Number(m[1]));
        if (codes.length) status = codes[codes.length - 1];
        const types = [...raw.matchAll(/^content-type:\s*([^\r\n]+)/gim)];
        if (types.length) type = types[types.length - 1][1].trim();
    } catch { /* headers are a nicety */ }
    return { status, type, buf: readFileSync(body) };
}

const PAGES = [
    { file: 'index.html', type: 'home', renders: ['hero-art', 'campus-art', 'pathways', 'media', 'faculty', 'showcase', 'faqs', 'testimonials', 'news', 'admission-steps'] },
    { file: 'about.html', type: 'other', renders: ['campus-art', 'directors', 'house-rules'] },
    { file: 'academics.html', type: 'category', renders: ['subject-filter', 'subjects', 'faculty', 'programs'] },
    { file: 'product.html?id=9702', type: 'product', renders: ['subject', 'subject-related'] },
    { file: 'admissions.html', type: 'promotion', renders: ['criteria', 'scholarships', 'admission-steps', 'testimonials'] },
    { file: 'counselling.html', type: 'other', renders: ['counselling', 'universities'] },
    { file: 'life.html', type: 'other', renders: ['news', 'campus-art', 'clash-body', 'societies', 'houses', 'house-rules'] },
    { file: 'media.html', type: 'other', renders: ['media', 'showcase'] },
    { file: 'contact.html', type: 'other', renders: [] },
    { file: 'how-to-apply.html', type: 'other', renders: ['admission-steps', 'eligibility', 'faqs'] },
    { file: 'apply.html', type: 'checkout', renders: [] },
    { file: 'blogs.html', type: 'other', renders: ['news'] },
    { file: 'post.html?id=round-2-closing-soon', type: 'other', renders: ['post', 'news'] }
];

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

let sdkRefusals = 0;
await context.route('**/*', async (route) => {
    const url = route.request().url();
    let host = '';
    try { host = new URL(url).hostname; } catch { /* data: and blob: */ }
    if (DENGAGE_HOST.test(host)) { sdkRefusals++; return route.abort(); }
    const got = await grab(url);
    if (!got) return route.abort();
    return route.fulfill({ status: got.status, contentType: got.type, body: got.buf });
});

/* Every call the page hands to the SDK, captured from the event the emitter
   announces rather than by wrapping the SDK function, which would make this a
   second caller of it and break the rule the guard enforces. */
async function watch(page) {
    await page.addInitScript(() => {
        window.__calls = [];
        window.addEventListener('dps:meridian-college:event', (event) => {
            window.__calls.push({ action: event.detail.action, payload: event.detail.payload });
        });
    });
}

if (SHOTS && !existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

for (const spec of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    /* The SDK request this check refuses on purpose logs a failed resource, and
       that one is the check working rather than the page breaking. It is
       identified by the host on the console message rather than by its wording,
       so a genuine failure from any other host is still reported. */
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        let host = '';
        try { host = new URL(message.location().url || '').hostname; } catch { /* no url */ }
        if (DENGAGE_HOST.test(host)) return;
        errors.push(message.text());
    });
    await watch(page);

    const name = spec.file.split('?')[0];
    try {
        await page.goto(BASE + spec.file, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(() => window.EduSite && window.EduSite.state.content, null, { timeout: 30000 });
        await page.waitForTimeout(600);

        ok(name + ': no console error', errors.length === 0, errors.slice(0, 3));

        const calls = await page.evaluate(() => window.__calls);
        const views = calls.filter((call) => call.action === 'pageView');
        ok(name + ': fires exactly one page view', views.length === 1, views.length);
        ok(name + ': page view carries the declared type',
            views[0] && views[0].payload.page_type === spec.type,
            views[0] && views[0].payload.page_type);

        const chrome = await page.evaluate(() => ({
            header: !!document.querySelector('.site-header'),
            nav: document.querySelectorAll('.site-nav a').length,
            footer: !!document.querySelector('.site-footer'),
            mark: (document.querySelector('.logo-word') || {}).textContent,
            sub: (document.querySelector('.logo-sub') || {}).textContent,
            launcher: !!document.querySelector('#launcher-btn'),
            slots: document.querySelectorAll('[id^="dn_inline_target_edu_"]').length
        }));
        ok(name + ': header renders', chrome.header);
        ok(name + ': navigation renders', chrome.nav >= 8, chrome.nav);
        ok(name + ': footer renders', chrome.footer);
        ok(name + ': carries the Dengage mark', chrome.mark === 'Dengage' && chrome.sub === 'Education Demo', chrome);
        ok(name + ': the launcher is present', chrome.launcher);
        ok(name + ': inline slots are present', chrome.slots >= 2, chrome.slots);

        for (const key of spec.renders) {
            const filled = await page.evaluate((selector) => {
                const host = document.querySelector('[data-render="' + selector + '"]');
                return host ? host.innerHTML.trim().length : -1;
            }, key);
            ok(name + ': ' + key + ' renders content', filled > 40, filled);
        }

        /* No page anywhere names the source institution or its parent group. */
        const body = await page.evaluate(() => document.body.innerText);
        ok(name + ': carries no source word mark', !/titan|dany group/i.test(body),
            (body.match(/titan|dany group/i) || [])[0]);

        if (SHOTS) {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let y = 0;
                    const timer = setInterval(() => {
                        window.scrollBy(0, 900); y += 900;
                        if (y > document.body.scrollHeight) { clearInterval(timer); resolve(); }
                    }, 60);
                });
            });
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(SHOTS, name.replace('.html', '') + '.png'), fullPage: true });
        }
    } catch (error) {
        ok(name + ': loads', false, String(error).split('\n')[0]);
    }
    await page.close();
}

/* ------------------------------------------------------- the launcher pair */

{
    const page = await context.newPage();
    await watch(page);
    await page.goto(BASE + 'academics.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.EduUseCases, null, { timeout: 30000 });

    const pairing = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[data-scenario]'))
            .map((el) => el.getAttribute('data-scenario'));
        const scenarios = window.EduUseCases.scenarios();
        return {
            cards,
            scenarios,
            cardsWithoutScenario: cards.filter((id) => scenarios.indexOf(id) === -1),
            scenariosWithoutCard: scenarios.filter((id) => cards.indexOf(id) === -1),
            prefix: window.DEMO_CONFIG.dengage.scenarioPrefix
        };
    });
    ok('every launcher card names a scenario that exists',
        pairing.cardsWithoutScenario.length === 0, pairing.cardsWithoutScenario);
    ok('every scenario has a launcher card',
        pairing.scenariosWithoutCard.length === 0, pairing.scenariosWithoutCard);
    ok('there are 25 cards', pairing.cards.length === 25, pairing.cards.length);
    ok('the scenario prefix is the education one',
        pairing.prefix === 'demo_dengage_edu_', pairing.prefix);

    /* Every card is pressed, and the data layer is read afterwards. A card that
       renders nothing and a card that pushes nothing look identical on screen. */
    const fired = await page.evaluate(async (cards) => {
        window.dataLayer = [];
        const drawn = [];
        for (const id of cards) {
            document.querySelectorAll('#usecase-surface .uc').forEach((el) => el.remove());
            window.EduUseCases.fire(id);
            await new Promise((resolve) => setTimeout(resolve, 40));
            const surface = document.querySelector('#usecase-surface .uc');
            const inline = document.querySelector('[id^="dn_inline_target_edu_"] .uc-inline');
            const panel = document.querySelector('.drawer.is-open, .uc-popup, .uc-slidein, .uc-banner');
            drawn.push({ id, drew: !!(surface || inline || panel) });
        }
        return { events: window.dataLayer.map((row) => row.event), drawn };
    }, pairing.cards);

    ok('every card pushes its data layer event',
        fired.events.length === pairing.cards.length, fired.events.length);
    ok('every event carries the education prefix',
        fired.events.every((name) => name.indexOf('demo_dengage_edu_') === 0),
        fired.events.filter((name) => name.indexOf('demo_dengage_edu_') !== 0));
    const dark = fired.drawn.filter((row) => !row.drew).map((row) => row.id);
    ok('no card is dark', dark.length === 0, dark);

    /* Re-firable, which is the property a sales call actually depends on. */
    const again = await page.evaluate(async () => {
        window.dataLayer = [];
        window.EduUseCases.fire('deadline-countdown');
        await new Promise((resolve) => setTimeout(resolve, 30));
        window.EduUseCases.fire('deadline-countdown');
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { events: window.dataLayer.length, showing: !!document.querySelector('.uc-banner') };
    });
    ok('a card can be fired twice and still shows', again.events === 2 && again.showing, again);

    await page.close();
}

/* ------------------------------------------------------------- the funnel */

{
    const page = await context.newPage();
    await watch(page);
    await page.goto(BASE + 'academics.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.EduJourney, null, { timeout: 30000 });

    const journey = await page.evaluate(async () => {
        window.localStorage.clear();
        window.EduJourney.addSubject('9702');
        window.EduJourney.addSubject('9709');
        window.EduJourney.toggleShortlist('9700');
        window.EduJourney.runSearch('physics');
        window.EduJourney.runSearch('architecture');
        window.EduJourney.identify('DPS-1');
        window.Store.beginCheckout();
        const order = window.EduJourney.submitApplication();
        await new Promise((resolve) => setTimeout(resolve, 60));
        return { calls: window.__calls, order };
    });

    const actions = journey.calls.map((call) => call.action);
    const want = ['ec:addToCart', 'ec:addToWishlist', 'ec:search', 'ec:beginCheckout', 'ec:order'];
    for (const action of want) {
        ok('the funnel sends ' + action, actions.indexOf(action) !== -1, actions);
    }
    ok('two subjects were added',
        actions.filter((action) => action === 'ec:addToCart').length === 2, actions);
    ok('both searches are recorded, including the one with no results',
        actions.filter((action) => action === 'ec:search').length === 2, actions);
    ok('the failed search records a zero result count',
        journey.calls.some((call) => call.action === 'ec:search' &&
            call.payload.keywords === 'architecture' && call.payload.result_count === 0));
    ok('the order id is namespaced by slug',
        journey.order && /^DPS-meridian-college-\d+$/.test(journey.order.orderId), journey.order);

    const order = journey.calls.filter((call) => call.action === 'ec:order').pop();
    ok('the order carries its subjects', order && order.payload.cartItems.length === 2, order);
    ok('the order invents no total', order && !('total_amount' in order.payload), order && order.payload);
    ok('the order invents no discount', order && !('discounted_price' in order.payload), order && order.payload);
    ok('the order uses a payment method that is not a payment',
        order && order.payload.payment_method === 'other', order && order.payload);

    const added = journey.calls.filter((call) => call.action === 'ec:addToCart');
    ok('no cart line invents a price',
        added.every((call) => !('unit_price' in call.payload) && !('discounted_price' in call.payload)),
        added.map((call) => call.payload));
    ok('every cart line names its subject',
        added.every((call) => !!call.payload.product_id), added.map((call) => call.payload));

    const wish = journey.calls.filter((call) => call.action === 'sendDeviceEvent').pop() ||
                 journey.calls.filter((call) => call.action === 'ec:addToWishlist').pop();
    ok('the shortlist row names a list', wish && !!wish.payload.list_name, wish && wish.payload);
    ok('the shortlist row invents no price', wish && !('price' in wish.payload), wish && wish.payload);

    /* The identity a purge would have to find. */
    const identity = await page.evaluate(() => window.DemoIdentity.contactKey);
    ok('the contact key carries the demo prefix', /^DPS-/.test(identity), identity);

    await page.close();
}

ok('the SDK host was refused every time it was asked for', sdkRefusals > 0, sdkRefusals);

await browser.close();
rmSync(work, { recursive: true, force: true });

console.log('\n' + pass + ' passed, ' + failures.length + ' failed');
for (const failure of failures) console.log('  FAIL  ' + failure);
process.exit(failures.length ? 1 : 0);
