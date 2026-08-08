/* ============================================================================
   A TOP BAR PUSHES THE STOREFRONT HEADER DOWN INSTEAD OF COVERING IT.

     TEMPLATE_URL=http://localhost:8101/template/ node factory/checks/banner.mjs

   THIS IS THE THIRD ATTEMPT AT THIS BUG, and the first two are the reason the check
   exists. Both were verified against a stand in banner written for the test: a short
   fixed div at the top of the page. Both passed. Both left the header covered on the
   live site, and the second one was reported broken twice.

   The stand in was the problem. It is a shape that is easy to imagine and easy to
   handle, and it is not the shape the engine produces. A Dengage banner arrives as a
   cross origin IFRAME, and an iframe is sized by the engine rather than by its content:
   a bar 56px tall can sit at the top of a frame that is as tall as the viewport, with
   nothing but transparency below it. From outside that frame a page cannot tell it from
   a modal scrim, which is precisely why template/js/slots.js used to reject it.

   So the first fixture below is the hard one, and the assertion that matters most is
   the one against it:

     1. a full viewport transparent iframe with a bar drawn at the top of it.
        The shape that shipped broken twice
     2. a short fixed div, one level deep, which is what a campaign authored in the
        panel looks like. The shape the old code handled
     3. a short fixed div wrapped in a static container, so the fixed element is a
        grandchild of body
     4. a modal scrim, full viewport and opaque, which must NOT move the header
     5. dismissal, which must give the pixels back

   WHAT IS ASSERTED. Not "did the variable get set", which is what a test written
   against its own implementation checks. Whether the header's top edge is at or below
   the bottom of the bar, which is the thing a person on a sales call can see.
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = process.env.TEMPLATE_URL || 'http://localhost:8101/template/';
const BAR_HEIGHT = 56;

let failures = 0;
const check = (label, ok, detail) => {
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label +
        (ok ? '' : '   <' + JSON.stringify(detail) + '>'));
    if (!ok) failures++;
};

const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
});

/* The real creative, so the height it reports is the height it really renders rather
   than a number this file made up. */
const stickyBar = readFileSync(ROOT + '/factory/creatives/sticky-bar.html', 'utf8');

async function openStorefront() {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.route('**/fonts.googleapis.com/**', (route) => route.fulfill({
        contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: ''
    }));
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForSelector('.site-header');
    await page.waitForTimeout(400);
    return page;
}

/* Where the header's top edge sits, and where the bar's bottom edge sits. The gap
   between them is the whole question. */
async function headerTop(page) {
    return page.evaluate(() => {
        const h = document.querySelector('.site-header');
        return h ? Math.round(h.getBoundingClientRect().top) : null;
    });
}

/* ---- 1. the shape that shipped broken twice ------------------------------- */
console.log('1. a full viewport transparent iframe with the bar at the top of it');
{
    const page = await openStorefront();
    const before = await headerTop(page);

    /* The creative served from another origin, exactly as the engine serves it, inside
       a frame as tall as the viewport. */
    await page.route('**/cdn.dengage.test/bar.html', (route) => route.fulfill({
        contentType: 'text/html',
        body: stickyBar.replace('</head>',
            '<style>html,body{background:transparent;margin:0}' +
            '#dnf-sb .bar{height:' + BAR_HEIGHT + 'px}</style></head>')
    }));
    await page.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.src = 'https://cdn.dengage.test/bar.html';
        frame.id = 'engine-frame';
        /* Full viewport, transparent, pinned to the top. The bar is drawn inside it. */
        frame.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;' +
                              'border:0;z-index:2147483647;background:transparent';
        document.body.appendChild(frame);
    });
    /* The reporter sends on load and then a few times over about a second. */
    await page.waitForTimeout(1800);

    const after = await headerTop(page);
    const reported = await page.evaluate(() => getComputedStyle(document.documentElement)
        .getPropertyValue('--dn-banner-height').trim());

    check('the header started at the top of the viewport', before === 0, before);
    check('the bar reported exactly its ' + BAR_HEIGHT + 'px, with nothing above it',
          reported === BAR_HEIGHT + 'px', reported);
    check('THE HEADER IS NO LONGER COVERED: its top edge is at or below the bar',
          after >= BAR_HEIGHT - 1, { before, after, reported });

    /* ---- 5. and dismissal gives the pixels back --------------------------- */
    const inner = page.frames().find((f) => f.url().includes('cdn.dengage.test'));
    await inner.evaluate(() => {
        /* The engine's own API is not here, so stand in for the part the button calls
           and leave the part under test alone. */
        window.Dn = { sendClick: () => {}, close: () => {} };
        document.querySelector('#dnf-sb .close').click();
    });
    await page.waitForTimeout(400);
    const dismissed = await headerTop(page);
    check('dismissing the bar returns the header to the top', dismissed === 0,
          { after, dismissed });
    await page.close();
}

/* ---- 1a. THE BAR REPORTS ITS BOTTOM EDGE, NOT ITS HEIGHT ------------------
   The two are the same number only when nothing sits above the bar, and something
   did: the theme bootstrap's loader image was an in-flow <img>, so it reserved a
   line box and pushed the bar about 18px down. The bar then reported 56 while its
   bottom edge was at 74, the header went to 56, and a strip of page showed above
   the bar. That was reported as a gap twice before it was measured.

   So this fixture puts a known 20px above the bar and requires the reported value
   to include it. Reporting height passes every other assertion in this file and
   fails only this one. */
console.log('1a. something above the bar, which height alone would not account for');
{
    const OFFSET = 20;
    const page = await openStorefront();
    await page.route('**/cdn.dengage.test/bar2.html', (route) => route.fulfill({
        contentType: 'text/html',
        body: stickyBar.replace('</head>',
            '<style>html,body{background:transparent;margin:0}' +
            'body{padding-top:' + OFFSET + 'px}' +
            '#dnf-sb .bar{height:' + BAR_HEIGHT + 'px}</style></head>')
    }));
    await page.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.src = 'https://cdn.dengage.test/bar2.html';
        frame.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;' +
                              'border:0;z-index:2147483647;background:transparent';
        document.body.appendChild(frame);
    });
    await page.waitForTimeout(1800);
    const reported = await page.evaluate(() => getComputedStyle(document.documentElement)
        .getPropertyValue('--dn-banner-height').trim());
    const after = await headerTop(page);
    check('it reported ' + (BAR_HEIGHT + OFFSET) + 'px, the bottom edge rather than the height',
          reported === (BAR_HEIGHT + OFFSET) + 'px', reported);
    check('so the header clears the bar rather than sitting under it',
          after >= BAR_HEIGHT + OFFSET - 1, { after, reported });
    await page.close();
}

/* ---- 2 and 3. the shapes a panel authored campaign produces --------------- */
for (const [label, build] of [
    ['2. a short fixed bar, a direct child of body', () => {
        const bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:56px;' +
                            'background:#123;z-index:2147483647';
        document.body.appendChild(bar);
    }],
    ['3. a short fixed bar inside a static wrapper, so it is a grandchild', () => {
        const wrap = document.createElement('div');
        const bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:56px;' +
                            'background:#123;z-index:2147483647';
        wrap.appendChild(bar);
        document.body.appendChild(wrap);
    }]
]) {
    console.log(label);
    const page = await openStorefront();
    await page.evaluate(build);
    await page.waitForTimeout(700);
    const after = await headerTop(page);
    check('the header moved below it, found by shape with nothing reported',
          after >= BAR_HEIGHT - 1, after);
    await page.close();
}

/* ---- 4. and the thing that must NOT move the header ---------------------- */
console.log('4. a modal scrim, which is full viewport and must be left alone');
{
    const page = await openStorefront();
    await page.evaluate(() => {
        const scrim = document.createElement('div');
        scrim.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;' +
                              'background:rgba(0,0,0,.5);z-index:2147483647';
        document.body.appendChild(scrim);
    });
    await page.waitForTimeout(700);
    const after = await headerTop(page);
    /* This is the assertion that keeps the fix from becoming "push the header down
       whenever anything is pinned at the top", which would break every popup. */
    check('the header did not move', after === 0, after);
    await page.close();
}

/* ---- and a hostile height is clamped ------------------------------------- */
console.log('5. a report the page should refuse');
{
    const page = await openStorefront();
    await page.evaluate(() => {
        window.postMessage({ dnBanner: 'height', px: 5000 }, '*');
        window.postMessage({ dnBanner: 'height', px: -40 }, '*');
        window.postMessage({ dnBanner: 'height', px: 'tall' }, '*');
    });
    await page.waitForTimeout(300);
    const after = await headerTop(page);
    check('an absurd, a negative and a non numeric height are all ignored',
          after === 0, after);
    await page.close();
}

await browser.close();

console.log();
if (failures) {
    console.log('Banner clearance FAILED: ' + failures + ' assertion(s).');
    process.exit(1);
}
console.log('Banner clearance passed. The header clears a reported bar, a bar found by ' +
            'shape, and stays put for a scrim.');
