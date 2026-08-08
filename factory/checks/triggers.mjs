/* ============================================================================
   A scenario press reaches a campaign whatever trigger the panel gave it.

     node factory/checks/triggers.mjs      starts its own server and runs alone
     bash factory/checks/run.sh            runs it with the shared server

   WHY THIS EXISTS. The SDK supports five trigger types and three of them are
   "an event with this name", all reading triggerSettings.eventName, all shown in
   the panel as "Event name". They differ only in where the SDK listens:

     DATA_LAYER_EVENT   it wraps window.dataLayer.push and watches for
                        { event: <name> }
     CUSTOM_EVENT       window.addEventListener(<name>)
     DENGAGE_EVENT      window.addEventListener(<name>), same handler

   Not every template offers Data Layer Event. Typeform does not, which is how
   this was found: the campaign was correct, the card was correct, and nothing
   happened. That failure is silent by design (handoff 12.6), so it reads as a
   broken demo rather than a trigger mismatch, and it gets found on a call rather
   than before one.

   So DengageEvents.scenario fires both, and this asserts both go out with the
   same name and, just as importantly, that each goes out exactly ONCE. Sending
   the same signal twice would show a prospect the same widget twice, which is
   worse than not showing it at all.
   ========================================================================== */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 8194;

/* run.sh exports TEMPLATE_URL per target. Standalone, serve the repository root
   the way Pages does so relative paths resolve identically. */
let server = null;
if (!process.env.TEMPLATE_URL) {
    server = spawn('python3', ['-m', 'http.server', String(PORT)], { stdio: 'ignore' });
    await new Promise((resolve) => setTimeout(resolve, 1500));
}
const url = process.env.TEMPLATE_URL || `http://localhost:${PORT}/template/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();

const errors = [];
const IGNORE = /fonts\.googleapis|fonts\.gstatic|favicon|404|pcdn\.dengage\.com/;
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push(e.message); });

let pass = 0;
let fail = 0;
function assert(ok, label) {
    if (ok) { pass += 1; console.log('   ok    ' + label); }
    else { fail += 1; console.log('   FAIL  ' + label); }
}

/* Both recorders installed before the page's own scripts run, which is where the
   SDK would install its own. A wrapper added afterwards would miss anything the
   page fired during load, and that is exactly the case that has to be counted. */
await page.addInitScript(() => {
    window.__dl = [];
    window.__win = [];
    window.dataLayer = [];
    const push = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function (o) { window.__dl.push(o); return push(o); };
    /* Stands in for the SDK's CUSTOM_EVENT handler, which is exactly
       window.addEventListener(eventName). */
    const add = window.addEventListener.bind(window);
    window.__listen = function (name) {
        add(name, function (e) { window.__win.push({ name: name, detail: e.detail }); });
    };
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(600);

const reset = () => page.evaluate(() => { window.__dl.length = 0; window.__win.length = 0; });
const seen = () => page.evaluate(() => ({ dl: window.__dl, win: window.__win }));

console.log('\n1. One press sends both signals, once each\n');
await page.evaluate(() => window.__listen('dengage_demo_survey'));
await reset();
await page.evaluate(() => window.DengageEvents.scenario('survey'));
await page.waitForTimeout(250);

let r = await seen();
assert(r.dl.length === 1, `exactly one data layer push (${r.dl.length})`);
assert(!!r.dl[0] && r.dl[0].event === 'dengage_demo_survey', 'with the prefixed event name');
assert(!!r.dl[0] && r.dl[0].actionType === r.dl[0].event, 'and actionType matching');
assert(r.win.length === 1, `exactly one window event (${r.win.length})`);
assert(!!r.win[0] && r.win[0].name === 'dengage_demo_survey', 'with the same name');
assert(!!r.win[0] && !!r.win[0].detail && r.win[0].detail.slug === 'survey',
    'carrying the slug in detail');

console.log('\n2. A campaign listening only the Custom Event way still fires\n');
await page.evaluate(() => window.__listen('dengage_demo_typeform'));
await reset();
await page.evaluate(() => window.DengageEvents.scenario('typeform'));
await page.waitForTimeout(250);

r = await seen();
assert(r.win.length === 1 && r.win[0].name === 'dengage_demo_typeform',
    'a Custom Event style listener receives dengage_demo_typeform');
assert(r.dl.length === 1, 'and the data layer push still went out alongside it');

console.log('\n3. Pressing a launcher card in the page does the same\n');
await page.evaluate(() => window.__listen('dengage_demo_nps-popup'));
await reset();
const clicked = await page.evaluate(() => {
    const button = document.querySelector('[data-scenario="nps-popup"]');
    if (!button) return false;
    button.click();
    return true;
});
await page.waitForTimeout(300);

r = await seen();
assert(clicked, 'the nps-popup card is present');
assert(r.dl.length === 1, `one data layer push from the card (${r.dl.length})`);
assert(r.win.length === 1, `one window event from the card (${r.win.length})`);

console.log('');
assert(errors.length === 0, errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
console.log(`\n   ${pass} passed, ${fail} failed\n`);

await browser.close();
if (server) server.kill('SIGTERM');
process.exit(fail ? 1 : 0);
