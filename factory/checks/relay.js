/* ============================================================================
   THE STOREFRONT HALF OF THE RELAY: what it sends, and everything it will not.

     node factory/checks/relay.js                     against the template
     node factory/checks/relay.js --url <demo url>    against a built demo

   js/relay.js is the one module in a storefront that can cause a real email and
   a real push to be delivered to a real person. That is the whole reason this
   file is as long as it is.

   NOTHING HERE REACHES THE REAL RELAY. Every request the page makes is answered
   by a stub installed before the page loads, and the endpoint is refused at the
   network layer as well, so a check can never deliver a message to anybody. Both
   are asserted rather than assumed, which is the rule CLAUDE.md 4 states after a
   comment claiming exactly this kind of thing turned out to be false.

   THE FIVE THINGS ASSERTED, in the order they can hurt:

   1. IT IS INERT WITHOUT A RELAY BLOCK. The template carries no identity of any
      kind and neither does showcase, so the module has to load and do nothing.
      A version that sent from an unconfigured demo would send from every check.

   2. IT NEVER SENDS WITHOUT A CONTACT. The relay finds the address from the key,
      so an anonymous visitor has nowhere for a message to go, and a send that
      went anyway would be asking the relay to guess.

   3. IT NEVER SENDS AN EMPTY BASKET. The only moment that exists is about a
      basket somebody left behind.

   4. IT SENDS ONCE. A transactional message that arrives twice reads as a broken
      integration rather than a demonstration, and this repository has shipped
      exactly that once already, four identical emails from one send.

   5. IT SAYS ONLY WHAT A PAGE IS ENTITLED TO SAY. Product ids and quantities.
      No address, no content id, no price. The relay refuses all three anyway,
      so this is defence in depth rather than the defence, but a page that tried
      would be a page somebody could point somewhere else.
   ========================================================================== */
const { chromium } = require('playwright');

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

/* Installed before any page script runs. It records every relay call and answers
   all of them itself, so the real endpoint is never reached even if the refusal
   below were somehow lifted. */
function stubRelay() {
    window.__relayCalls = [];
    const realFetch = window.fetch;
    window.fetch = function (url, options) {
        if (String(url).indexOf('/rpc/dps_transactional') !== -1) {
            let body = null;
            try { body = JSON.parse((options && options.body) || 'null'); } catch (err) { /* recorded raw */ }
            window.__relayCalls.push({ url: String(url), body,
                headers: (options && options.headers) || {} });
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        }
        return realFetch.apply(window, arguments);
    };
}

(async () => {
    const { launchOptions } = await import('../browser.mjs');
    const browser = await chromium.launch(launchOptions({
        /* The relay's own host resolves to nowhere in here, so a send that
           somehow escaped the stub still could not leave the machine. */
        args: ['--host-resolver-rules=MAP *.supabase.co ~NOTFOUND, ' +
               'MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND']
    }));

    const open = async (path) => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.addInitScript(stubRelay);
        await page.goto(BASE + (path || ''), { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.Catalog && window.Catalog.all().length,
            null, { timeout: 25000 });
        return page;
    };

    console.log('\nRelay: ' + BASE);

    const page = await open('');
    const configured = await page.evaluate(() =>
        !!(window.DEMO_CONFIG && window.DEMO_CONFIG.relay && window.DEMO_CONFIG.relay.url));

    console.log('\n1. The module is present, and the endpoint is unreachable from here');
    ok('js/relay.js is on the page', await page.evaluate(() => !!document.querySelector(
        'script[src$="js/relay.js"]')));
    /* THE HOST IS READ FROM THE DEMO, never written down here. A check that
       names the endpoint itself is a second copy of it, and the two drift the
       moment the relay moves. An unconfigured demo has none to refuse, which is
       reported rather than asserted. */
    const reachable = await page.evaluate(async () => {
        const url = (window.DEMO_CONFIG && window.DEMO_CONFIG.relay
            && window.DEMO_CONFIG.relay.url) || '';
        if (!url) return null;
        try { await fetch(url, { mode: 'no-cors' }); return true; }
        catch (err) { return false; }
    });
    if (reachable === null) console.log('   note  no endpoint configured, so there is none to refuse');
    else ok('the relay host is genuinely unreachable in this browser', reachable === false);
    console.log('   (this demo is ' + (configured ? 'configured to send' : 'NOT configured, so the module is inert') + ')');

    if (!configured) {
        console.log('\n2. With no relay block, it does nothing at all');
        const quiet = await page.evaluate(async () => {
            window.__relayCalls.length = 0;
            /* Everything that could possibly trigger it, at once. */
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('pagehide'));
            document.documentElement.dispatchEvent(
                new MouseEvent('mouseleave', { clientY: -50, bubbles: true }));
            await new Promise((done) => setTimeout(done, 600));
            return { calls: window.__relayCalls.length, exposed: !!window.Relay,
                     configured: !!(window.Relay && window.Relay.configured()) };
        });
        ok('no request was made', quiet.calls === 0, quiet);
        /* window.Relay is exposed on every demo, configured or not, and
           answers truthfully about which it is. A surface that vanished on
           some demos would be a surface every caller has to special case. */
        ok('it still exposes a surface, and that surface says it cannot send',
            quiet.exposed === true && quiet.configured === false, quiet);
        console.log('\n   ' + pass + ' passed, ' + fail + ' failed\n');
        await browser.close();
        process.exit(fail ? 1 : 0);
    }

    console.log('\n2. It refuses to send without a contact and without a basket');
    const refusals = await page.evaluate(async () => {
        const out = {};
        window.__relayCalls.length = 0;

        /* No contact, basket full. */
        const realKey = window.DemoIdentity.contactKey;
        window.DemoIdentity.contactKey = null;
        const first = window.Catalog.all()[0];
        window.Store.addToCart(first, 1);
        window.Relay.send('exit-intent-basket', { lines: [{ id: first.id, qty: 1 }] });
        await new Promise((done) => setTimeout(done, 300));
        out.withoutContact = window.__relayCalls.length;

        /* Contact back, basket empty. */
        window.DemoIdentity.contactKey = realKey || 'DPS-999999';
        window.Store.clearCart();
        document.documentElement.dispatchEvent(
            new MouseEvent('mouseleave', { clientY: -50, bubbles: true }));
        await new Promise((done) => setTimeout(done, 300));
        out.withoutBasket = window.__relayCalls.length;
        return out;
    });
    ok('an anonymous visitor sends nothing', refusals.withoutContact === 0, refusals);
    ok('an empty basket sends nothing', refusals.withoutBasket === 0, refusals);

    console.log('\n3. Leaving with a basket sends exactly one message');
    const sent = await page.evaluate(async () => {
        window.__relayCalls.length = 0;
        window.DemoIdentity.contactKey = window.DemoIdentity.contactKey || 'DPS-999999';
        const items = window.Catalog.all().slice(0, 2);
        for (const item of items) window.Store.addToCart(item, 2);
        /* Both signals, because a phone never produces the first one. */
        document.documentElement.dispatchEvent(
            new MouseEvent('mouseleave', { clientY: -50, bubbles: true }));
        await new Promise((done) => setTimeout(done, 200));
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('pagehide'));
        await new Promise((done) => setTimeout(done, 400));
        return { calls: window.__relayCalls.slice(), ids: items.map((i) => i.id) };
    });
    ok('one request went out', sent.calls.length === 1, sent.calls.length);
    ok('and both leaving signals together still only sent one',
        sent.calls.length === 1, sent.calls.length);

    const body = (sent.calls[0] || {}).body || {};
    ok('it names the intent', body.intent === 'exit-intent-basket', body.intent);
    ok('it names this demo', typeof body.slug === 'string' && body.slug.length > 0, body.slug);
    ok('it carries the contact key', /^DPS-/.test(String(body.contact_key || '')), body.contact_key);

    console.log('\n4. It says only what a page is entitled to say');
    const lines = (body.context && body.context.lines) || [];
    ok('the context is product ids and quantities', lines.length > 0 &&
        lines.every((l) => typeof l.id === 'string' && typeof l.qty === 'number'), lines);
    /* THE THREE THE RELAY REFUSES, asserted here too. A page that sent any of
       them would be a page somebody could point at a different recipient, a
       different template, or a different price. */
    const flat = JSON.stringify(body).toLowerCase();
    ok('no email address anywhere in the body', flat.indexOf('@') === -1, flat.slice(0, 160));
    ok('no content id', !/contentid|content_id/.test(flat), flat.slice(0, 160));
    ok('no price, total or amount', !/price|total|amount|currency/.test(flat), flat.slice(0, 160));

    console.log('\n5. A second visit to the same moment is silent');
    const again = await page.evaluate(async () => {
        window.__relayCalls.length = 0;
        window.Relay.send('exit-intent-basket', { lines: [{ id: 'x', qty: 1 }] });
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise((done) => setTimeout(done, 400));
        return window.__relayCalls.length;
    });
    ok('nothing was sent a second time', again === 0, again);

    await page.close();

    console.log('\n6. And a fresh tab may send again, because a demo is shown repeatedly');
    const fresh = await open('');
    const freshSend = await fresh.evaluate(async () => {
        window.__relayCalls.length = 0;
        try { window.sessionStorage.clear(); } catch (err) { /* private mode */ }
        window.DemoIdentity.contactKey = window.DemoIdentity.contactKey || 'DPS-999999';
        window.Store.addToCart(window.Catalog.all()[0], 1);
        window.dispatchEvent(new Event('pagehide'));
        await new Promise((done) => setTimeout(done, 400));
        return window.__relayCalls.length;
    });
    ok('a new session sends once', freshSend === 1, freshSend);
    await fresh.close();

    console.log('\n   ' + pass + ' passed, ' + fail + ' failed\n');
    await browser.close();
    process.exit(fail ? 1 : 0);
})();
