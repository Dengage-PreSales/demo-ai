/* ============================================================================
   STANDBY: THE DEMO'S OWN COPY OF A CREATIVE, AND WHEN IT IS ALLOWED TO APPEAR.

   Run from the repository root:  bash factory/checks/run.sh

   js/standby.js draws a committed creative itself when Dengage does not answer,
   so a call does not go dark because a campaign was deactivated or a network
   blocked the CDN. That makes it the one module in the storefront that can put
   something on screen which Dengage did not send, which is why this file exists
   and why it is this long.

   THE FOUR THINGS ASSERTED, in the order they can hurt:

   1. IT STAYS ASLEEP WHEN THE ENGINE ANSWERS. A standby copy drawn on top of a
      live campaign, or beside it, would turn the fallback into the defect. The
      engine's answer is simulated by putting an iframe in the page, and by
      filling an inline slot, which are the two shapes js/standby.js looks for.

   2. NOTHING ON SCREEN SAYS IT IS A STANDBY COPY, AND THE READOUT SAYS SO
      LOUDLY. Both halves are asserted, because they used to be the other way
      round and the reasons for each are equally real: a prospect must not see
      internal plumbing across a creative, and nobody must be able to claim
      Dengage rendered something it did not. The record moved, it did not go.

   3. AN OVERLAY IS SANDBOXED AND AN INLINE SLOT IS NOT. The engine sandboxes
      popups in an iframe and lifts an inline creative's style into
      document.head, handoff 12.3, so the standby copy has to do the same. An
      overlay creative rendered inline would leak its CSS page wide and visibly
      break the storefront, which is a much bigger failure than the one the
      fallback was added to prevent.

   4. IT YIELDS TO THE ENGINE, EVEN LATE. The grace period before drawing is
      short on purpose, so a campaign that answers after the standby copy is
      already up is an ordinary case rather than a freak one. Two widgets at
      once is worse than either failure this module exists for, so the engine
      arriving late is driven here and the standby copy has to disappear.

   5. EVERY SLUG IT CLAIMS HAS A FILE, AND EVERY FILE IS CLAIMED. Held in BOTH
      directions, for the reason CLAUDE.md gives about counts: a map that names a
      creative which was since renamed loses that fallback silently, and a
      creative nobody maps gets no fallback at all. Neither shows up on a page.
   ========================================================================== */
const { chromium } = require('playwright');
const { readdirSync, existsSync, statSync } = require('node:fs');
const { join, dirname, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..', '..');
const BASE = process.env.TEMPLATE_URL || 'http://localhost:8101/template/';

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '')); }
};

/* Every committed creative, as a path relative to factory/creatives/. Read from
   the tree rather than listed here, so a new one has to be mapped or explained
   rather than merely added. */
function creativeFiles(dir, prefix) {
    const out = [];
    const names = readdirSync(dir).sort();
    for (const name of names) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            /* native/ holds the film's generator and its source, not a campaign
               creative, so it is not a candidate for a launcher card. */
            if (name === 'native') continue;
            /* AND A DIRECTORY BESIDE A FILE OF THE SAME NAME IS THAT FILE SPLIT
               UP, not a second creative. The panel's Inline campaign takes three
               separate fields, so each inline creative is committed twice: whole,
               as below-header.html, and split, as below-header/html.html plus
               script.js plus style.css. Counting the split form as its own
               creative made this check demand a standby mapping for a fragment
               that no campaign pastes and no launcher card names. */
            if (names.indexOf(name + '.html') !== -1) continue;
            out.push(...creativeFiles(full, prefix + name + '/'));
            continue;
        }
        if (name.endsWith('.html')) out.push(prefix + name);
    }
    return out;
}

(async () => {
    const browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium',
        /* THE SDK HOSTS RESOLVE TO NOWHERE INSIDE THIS BROWSER, and here that is
           not merely noise reduction: this whole file is about what happens when
           the engine does not answer, so the engine must not be able to. The
           refusal is asserted below rather than assumed, which is the rule
           CLAUDE.md 4 states after a comment claiming exactly this turned out to
           be false and failed good builds for a day. */
        args: ['--host-resolver-rules=MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND']
    });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const refused = [];
    page.on('requestfailed', (r) => {
        if (/pcdn\.dengage|push\.dengage/.test(r.url())) refused.push(r.url());
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Standby && window.Panels && window.Catalog &&
        window.Catalog.all().length, null, { timeout: 20000 });

    console.log('\n1. The engine cannot answer in this browser, and that is asserted');
    ok('js/standby.js is on the page', await page.evaluate(() => !!window.Standby));
    /* ASKED FOR, NOT WAITED FOR. The template carries no application identity,
       the guard's app-guid check refuses one there, so nothing on this page ever
       requests the SDK and a listener for a failed request would sit at zero
       whether the resolver rule worked or not. That is the shape CLAUDE.md 4
       calls a comment pretending to be an assertion, so the request is made
       here and its refusal is the assertion. */
    const reachable = await page.evaluate(async () => {
        try {
            await fetch('https://pcdn.dengage.com/p/push/probe.js', { mode: 'no-cors' });
            return true;
        } catch (err) { return false; }
    });
    ok('the SDK host is genuinely unreachable from this browser', reachable === false);
    ok('and the failure was a refusal, not a timeout', refused.length > 0, refused);
    ok('so window.dengage is the page\'s own stub, never the real SDK',
        await page.evaluate(() => typeof window.dengage === 'function' && !window.dn_loader));

    console.log('\n2. Every slug it claims has a committed file, and every file is claimed');
    const map = await page.evaluate(() => window.Standby.CREATIVES);
    const onDisk = creativeFiles(join(ROOT, 'factory', 'creatives'), '');
    const claimed = Object.values(map);

    const missing = claimed.filter((file) => !existsSync(join(ROOT, 'factory', 'creatives', file)));
    ok('every mapped creative exists on disk', missing.length === 0, missing);

    /* The other direction. A creative nobody maps has no standby copy, and the
       only place that is visible is here. Variants b and c of the A/B test are
       the one intended exception: the engine picks between them and a standby
       copy has no experiment to pick from, so variant a stands in for the card. */
    const EXPECTED_UNCLAIMED = ['ab-testing/variant-b.html', 'ab-testing/variant-c.html'];
    const unclaimed = onDisk.filter((file) => claimed.indexOf(file) === -1);
    ok('every committed creative is either mapped or a known exception',
        unclaimed.length === EXPECTED_UNCLAIMED.length &&
        unclaimed.every((f) => EXPECTED_UNCLAIMED.indexOf(f) !== -1),
        { unclaimed, EXPECTED_UNCLAIMED });

    /* And the map's keys have to be launcher cards, or the fallback is armed for
       something nobody can press. */
    const cards = await page.evaluate(() =>
        window.Panels.SCENARIOS.map((s) => s.slug));
    const strays = Object.keys(map).filter((slug) => cards.indexOf(slug) === -1);
    ok('every slug it claims is a launcher card', strays.length === 0, strays);

    /* THE SLUG IS READ FROM THE PAGE, not written down here. Both the custom
       event and the host id are namespaced by slug, non-negotiable 6, so a
       literal "template" in this file passed against template/ and failed
       against every demo it was pointed at, on the two assertions that matter
       most. The build workflow runs this against the demo it just built. */
    const slug = await page.evaluate(() =>
        window.DEMO_SLUG || (window.DEMO_CONFIG && window.DEMO_CONFIG.slug) || 'demo');
    const NOTE_EVENT = 'dps:' + slug + ':standby';
    console.log('   (slug: ' + slug + ')');

    console.log('\n3. It stays asleep when the engine answers');
    /* An overlay. js/standby.js counts iframes before waiting, so putting one in
       the page is the engine answering as far as it can tell. */
    const overlay = await page.evaluate(async (note) => {
        const seen = [];
        window.addEventListener(note, (e) => seen.push(e.detail));
        window.Standby.arm('image-popup', null);
        const frame = document.createElement('iframe');
        frame.setAttribute('srcdoc', '<p>the engine</p>');
        document.body.appendChild(frame);
        await new Promise((done) => setTimeout(done, 1200));
        return { seen, drew: !!document.querySelector('.dps-standby-host') };
    }, NOTE_EVENT);
    ok('an overlay campaign that answers stands the fallback down',
        overlay.drew === false, overlay);
    ok('and the readout records that Dengage answered',
        overlay.seen.some((d) => d && d.how === 'dengage'), overlay.seen);

    /* An inline slot. Different signal entirely: the slot has content. */
    const inline = await page.evaluate(async (note) => {
        const seen = [];
        window.addEventListener(note, (e) => seen.push(e.detail));
        const slot = document.getElementById('dn_inline_target_below_hero');
        slot.innerHTML = '';
        window.Standby.arm('inline-below-hero', { target: 'dn_inline_target_below_hero' });
        slot.innerHTML = '<div class="engine">the engine</div>';
        await new Promise((done) => setTimeout(done, 1200));
        return { seen, html: slot.innerHTML };
    }, NOTE_EVENT);
    ok('an inline campaign that answers stands the fallback down',
        inline.html.indexOf('dps-standby-inline-note') === -1, inline.html.slice(0, 80));
    ok('and that is recorded too',
        inline.seen.some((d) => d && d.how === 'dengage'), inline.seen);

    console.log('\n4. It draws the committed copy when nothing answers, and says nothing');
    const drawn = await page.evaluate(async (note) => {
        const seen = [];
        window.addEventListener(note, (e) => seen.push(e.detail));
        window.Standby.close();
        window.Standby.arm('image-popup', null);
        await new Promise((done) => setTimeout(done, 2000));
        const host = document.querySelector('.dps-standby-host');
        return {
            seen,
            present: !!host,
            id: host ? host.id : '',
            /* Everything the visitor can read on our own chrome, which after the
               label was removed should be the close control and nothing else. */
            label: host ? (host.textContent || '').trim() : '',
            /* THE PART THAT MATTERS MOST: it has to be in a frame of its own. */
            frames: host ? host.querySelectorAll('iframe').length : 0,
            inlineLeak: document.querySelectorAll('style[data-dps-standby]').length
        };
    }, NOTE_EVENT);
    ok('the standby copy is on screen', drawn.present, drawn);
    ok('its host id carries the slug', drawn.id === 'dps-standby-' + slug,
        { id: drawn.id, slug });
    /* THE WORDS ARE GONE FROM THE SCREEN, and this is asserted against the exact
       strings that used to be there rather than against a class name, because a
       class can be renamed while the sentence stays. */
    ok('nothing on our own chrome names it as a standby copy',
        !/standby|did not answer|not by Dengage/i.test(drawn.label),
        drawn.label.slice(0, 80));
    ok('and the readout still records it, which is where the record belongs',
        drawn.seen.some((d) => d && d.how === 'standby'), drawn.seen);
    ok('and it is sandboxed in an iframe, not inlined',
        drawn.frames === 1, drawn.frames);
    ok('so no overlay stylesheet was lifted into the page',
        drawn.inlineLeak === 0, drawn.inlineLeak);

    /* The creative inside the frame is the committed file, and the shim the
       creatives expect is there before their markup is parsed. */
    const inside = await page.evaluate(() => {
        const frame = document.querySelector('.dps-standby-host iframe');
        const doc = frame && frame.contentDocument;
        return {
            hasDn: !!(frame && frame.contentWindow && frame.contentWindow.Dn),
            calls: doc ? ['close', 'sendClick', 'setTags', 'getGameWinner']
                .filter((k) => typeof frame.contentWindow.Dn[k] === 'function') : [],
            /* Deliberately absent: the creatives carry their own documented path
               for these not having been injected. */
            absent: doc ? ['postQuestion', 'postSubscription']
                .filter((k) => frame.contentWindow.Dn[k] === undefined) : []
        };
    });
    ok('the frame has the Dn object the creatives expect', inside.hasDn, inside);
    ok('with the four calls the shim stands in for',
        inside.calls.length === 4, inside.calls);
    ok('and without the two it deliberately leaves to the creative',
        inside.absent.length === 2, inside.absent);

    console.log('\n5. An inline standby copy goes in the slot, the engine\'s own way');
    const inlineDrawn = await page.evaluate(async () => {
        const slot = document.getElementById('dn_inline_target_in_grid');
        slot.innerHTML = '';
        window.Standby.arm('inline-in-grid', { target: 'dn_inline_target_in_grid' });
        await new Promise((done) => setTimeout(done, 2000));
        return {
            html: slot.innerHTML.slice(0, 200),
            labelled: /dps-standby-inline-note|standby copy/i.test(slot.innerHTML),
            styles: document.querySelectorAll('style[data-dps-standby]').length,
            /* The engine inserts .dn-inline-html itself, so the standby copy has
               to have inserted the same element rather than the whole file. */
            body: !!slot.querySelector('.dn-inline-html')
        };
    });
    ok('the slot holds the creative\'s own root element', inlineDrawn.body, inlineDrawn.html);
    ok('and nothing in the slot names it as a standby copy',
        !inlineDrawn.labelled, inlineDrawn.html);
    ok('and its style went to document.head, which is what the engine does',
        inlineDrawn.styles === 1, inlineDrawn.styles);

    console.log('\n6. A pinned standby bar pushes the header down');
    /* THE BUG THIS CATCHES SHIPPED TWICE IN ONE HOUR, in two different ways, and
       both times the storefront's logo and navigation were half covered on
       screen. js/slots.js moves the header for a pinned banner, and it prefers a
       height the bar reports about itself over anything it can measure. The bar
       creative sends that report itself, because it is the same file a live
       campaign pastes, and it reports only its own height. The host can be
       taller than the creative, so js/standby.js reports the host's real height
       afterwards and the last word wins. */
    const bar = await page.evaluate(async () => {
        window.Standby.close();
        window.Standby.arm('sticky-bar', null);
        await new Promise((done) => setTimeout(done, 2400));
        const host = document.querySelector('.dps-standby-host');
        const header = document.querySelector('.site-header');
        return {
            pinned: host ? /dps-at-top/.test(host.className) : false,
            hostBottom: host ? Math.round(host.getBoundingClientRect().bottom) : 0,
            headerTop: header ? Math.round(header.getBoundingClientRect().top) : 0,
            /* Short and full width, which is the shape js/slots.js looks for and
               the reason a host at inset:0 was invisible to it. */
            height: host ? Math.round(host.getBoundingClientRect().height) : 0,
            width: host ? Math.round(host.getBoundingClientRect().width) : 0,
            viewport: window.innerWidth
        };
    });
    ok('a bar creative is pinned rather than centred', bar.pinned, bar);
    ok('and it is the shape a pinned banner has, short and full width',
        bar.height > 0 && bar.height <= 200 && bar.width >= bar.viewport * 0.9, bar);
    ok('the header starts below the whole standby bar',
        bar.headerTop >= bar.hostBottom - 1, bar);

    /* And it gives the pixels back. A bar that stayed reported after it was
       dismissed would leave the header pushed down for the rest of the call. */
    const released = await page.evaluate(async () => {
        window.Standby.close();
        await new Promise((done) => setTimeout(done, 700));
        const header = document.querySelector('.site-header');
        return {
            headerTop: header ? Math.round(header.getBoundingClientRect().top) : -1,
            banner: getComputedStyle(document.documentElement)
                .getPropertyValue('--dn-banner-height').trim()
        };
    });
    ok('closing it returns the header to the top of the page',
        released.headerTop <= 1, released);
    ok('and the reported banner height goes back to zero',
        /^0px$/.test(released.banner), released);

    console.log('\n6a. The engine arriving late takes the screen back');
    /* THE ASSERTION THAT MAKES A SHORT GRACE PERIOD SAFE. Drawing quickly is only
       acceptable if a campaign that answers afterwards still wins, and on a call
       the failure this prevents is two widgets on screen at once, which reads as
       the product being broken rather than as a fallback working. */
    const late = await page.evaluate(async () => {
        window.Standby.close();
        window.Standby.arm('image-popup', null);
        await new Promise((done) => setTimeout(done, 1600));
        const drewOurs = !!document.querySelector('.dps-standby-host');
        /* The engine answering, as far as this module can tell: an iframe that
           is not ours appears in the page. */
        const engine = document.createElement('iframe');
        engine.id = 'pretend-engine';
        engine.setAttribute('srcdoc', '<p>the engine, late</p>');
        document.body.appendChild(engine);
        await new Promise((done) => setTimeout(done, 900));
        const stillOurs = !!document.querySelector('.dps-standby-host');
        engine.remove();
        return { drewOurs, stillOurs };
    });
    ok('the standby copy was up before the engine answered', late.drewOurs, late);
    ok('and it is gone the moment the engine draws', late.stillOurs === false, late);

    console.log('\n6b. It is quick enough not to read as a pause');
    const speed = await page.evaluate(async () => {
        window.Standby.close();
        const started = Date.now();
        window.Standby.arm('image-popup', null);
        for (let i = 0; i < 60; i++) {
            if (document.querySelector('.dps-standby-host')) return Date.now() - started;
            await new Promise((done) => setTimeout(done, 25));
        }
        return -1;
    });
    /* The creative is already fetched by the time this runs, which is the point
       of warm(): the only thing left between the press and the pixels is the
       grace period itself. A second is the outer edge of what reads as instant. */
    ok('the standby copy is on screen within a second, ' + speed + 'ms',
        speed > 0 && speed < 1000, speed);

    console.log('\n7. A slug with no committed creative is refused, not guessed');
    const refusedSlug = await page.evaluate(async () => {
        const answers = [];
        window.Standby.render('story', null, (drew, why) => answers.push({ drew, why }));
        await new Promise((done) => setTimeout(done, 600));
        return answers;
    });
    ok('render refuses a slug it has no file for',
        refusedSlug.length === 1 && refusedSlug[0].drew === false, refusedSlug);
    ok('and says so rather than failing silently',
        refusedSlug.length === 1 && /no committed creative/.test(refusedSlug[0].why || ''),
        refusedSlug);

    console.log('\n8. No page errors');
    const real = errors.filter((e) => !/dengage|Failed to fetch|NetworkError/i.test(e));
    if (real.length) real.forEach((e) => console.log('      ' + e));
    else console.log('   none');
    ok('clean console', real.length === 0, real);

    console.log('\n   ' + pass + ' passed, ' + fail + ' failed\n');
    await browser.close();
    process.exit(fail ? 1 : 0);
})();
