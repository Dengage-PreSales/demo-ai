/* ============================================================================
   THE PRIZE WHEEL'S SLICE LABELS FIT BETWEEN THE HUB AND THE RIM.

     node factory/checks/wheel.mjs

   WHY THIS IS WORTH A CHECK OF ITS OWN. Everything else about a creative can be
   judged by looking at it once. This cannot, because the labels are laid out in a
   fixed coordinate system and rendered in a font that arrives from the prospect's
   theme at run time. A wheel that reads perfectly on the machine it was drawn on
   can have three labels running underneath the hub on a demo whose theme picked a
   wider family, and nothing in a diff shows it.

   That is not hypothetical. The labels were first placed against whatever font this
   container falls back to, which made the worst collision look like one unit. In
   Poppins, a family the factory picks often, the same label was five units under the
   hub. The size and the anchor radius were then set from the widest real family
   rather than from the fallback.

   WHAT IT MEASURES. For every family below, every label's glyph box, against the two
   boundaries the markup itself declares with data-edge: the hub ring's outer edge and
   the rim keyline's inner edge. Stroke width counts, because a 10px ring paints 5
   units either side of its radius.

   IT ALSO CHECKS WHAT THE LABELS SAY, because a shared creative serves every demo at
   once and may not name a brand, a product, a price or a discount. A digit in a slice
   label is the usual way that rule gets broken.

   NETWORK. The font files come from Google Fonts, subset to just the characters the
   labels use, so the download is a few kilobytes rather than a megabyte. Chromium in
   this environment cannot reach fonts.gstatic.com itself, so node fetches them and
   inlines them as data URIs. If they cannot be fetched the check SKIPS loudly rather
   than quietly measuring a fallback and reporting a pass it has not earned.
   ========================================================================== */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const named = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const FILE = named || ROOT + '/factory/creatives/gamification/spin-to-win.html';

/* The families the theme extractor can land on, chosen to bracket the range rather
   than to be exhaustive: the two widest it picks, the narrowest, a serif, and the
   template's own default. A label that fits all five fits the ones in between. */
const FAMILIES = ['Poppins', 'Montserrat', 'Oswald', 'Playfair Display', 'Inter'];

/* Three units at 240 viewBox units across a wheel that renders about 280px wide is
   a little over three device pixels. Below that a label reads as touching. */
const MIN_CLEAR = 3;

const source = readFileSync(FILE, 'utf8');
let failures = 0;
const fail = (message) => { failures++; console.log('  FAIL  ' + message); };
const pass = (message) => { console.log('  ok    ' + message); };

/* ---- the labels, and what they are allowed to say ------------------------- */
const labels = [...source.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map((m) => m[1].trim());
if (labels.length < 4) {
    console.log('  FAIL  found ' + labels.length + ' slice labels, which is too few to be right');
    process.exit(1);
}
pass(labels.length + ' slice labels: ' + labels.join(', '));

/* A CHARACTER CLASS, NOT AN ALTERNATION, and the difference is not cosmetic. Written
   first as /[0-9]|%|$|.../ this matched every label ever passed to it, because a bare
   $ in an alternation is end of string and every string has one. A rule that flags
   everything and a rule that flags nothing read the same way in a diff, so the two
   line self test below feeds this known bad and known good input rather than trusting
   it on a clean file. */
const NUMERIC = /[0-9%£€$₹₺]/;
const numeric = (list) => list.filter((text) => NUMERIC.test(text));

if (process.argv.includes('--selftest')) {
    const bad = numeric(['Free gift', '20% off', 'Save $5', 'Bonus']);
    const clean = numeric(['Free gift', 'Bonus', 'Reward', 'Try again']);
    const ok = bad.length === 2 && bad.includes('20% off') && bad.includes('Save $5') &&
               clean.length === 0;
    console.log('selftest: the label copy rule flags ' + bad.length +
        ' of 4 known bad and ' + clean.length + ' of 4 known good. ' +
        (ok ? 'Correct.' : 'WRONG.'));
    process.exit(ok ? 0 : 1);
}

const offenders = numeric(labels);
if (offenders.length) {
    fail('a slice label carries a number, a percent or a currency symbol, which a ' +
         'creative shared by every demo cannot do: ' + offenders.join(', '));
} else {
    pass('no slice label names a figure, a discount or a currency');
}

/* ---- the fonts ------------------------------------------------------------ */
const characters = [...new Set(labels.join('').split(''))].join('');
const query = FAMILIES.map((f) => 'family=' + f.replace(/ /g, '+') + ':wght@700').join('&');
const cssUrl = 'https://fonts.googleapis.com/css2?' + query +
    '&text=' + encodeURIComponent(characters);

async function inlinedFontCss() {
    const response = await fetch(cssUrl, {
        headers: {
            /* Google serves woff2 only to a user agent it believes supports it, and
               returns older formats otherwise. */
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    if (!response.ok) throw new Error('the stylesheet came back HTTP ' + response.status);
    let css = await response.text();
    const urls = [...new Set([...css.matchAll(/https:\/\/fonts\.gstatic\.com[^)]+/g)]
        .map((m) => m[0]))];
    if (!urls.length) throw new Error('the stylesheet named no font files');
    for (const url of urls) {
        const file = await fetch(url);
        if (!file.ok) throw new Error('a font file came back HTTP ' + file.status);
        const body = Buffer.from(await file.arrayBuffer());
        css = css.replaceAll(url, 'data:font/woff2;base64,' + body.toString('base64'));
    }
    return { css, count: urls.length };
}

let fonts;
try {
    fonts = await inlinedFontCss();
} catch (err) {
    console.log();
    console.log('  SKIPPED: could not fetch the label fonts from Google Fonts.');
    console.log('  ' + err.message);
    console.log('  This check needs them, because the whole point of it is that the');
    console.log('  labels are measured in the families a prospect theme really uses');
    console.log('  rather than in whatever this machine falls back to. Measuring the');
    console.log('  fallback is how the collision it exists to catch got shipped.');
    process.exit(failures ? 1 : 0);
}
pass('inlined ' + fonts.count + ' subset font file(s), ' +
     Math.round(fonts.css.length / 1024) + 'kB, for ' + FAMILIES.length + ' families');

/* ---- the measurement ------------------------------------------------------ */
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
/* Served over http rather than through setContent, so the document has a real origin
   and the font machinery behaves the way it does on a live demo. */
await page.route('**/wheel-check/**', (route) => route.fulfill({
    contentType: 'text/html', body: source
}));
await page.goto('https://dengage-presales.github.io/wheel-check/', { waitUntil: 'load' });
await page.addStyleTag({ content: fonts.css });

const measured = await page.evaluate(async (families) => {
    const svg = document.querySelector('svg.wheel');
    if (!svg) return { error: 'no svg.wheel in this file' };

    const edge = (which, outward) => {
        const circle = svg.querySelector('circle[data-edge="' + which + '"]');
        if (!circle) return null;
        const r = Number(circle.getAttribute('r'));
        const w = Number(circle.getAttribute('stroke-width') || 0);
        /* A stroke straddles its radius, so the painted edge is half a width out. */
        return outward ? r + w / 2 : r - w / 2;
    };
    const hub = edge('hub', true);
    const rim = edge('rim', false);
    if (hub === null || rim === null) {
        return { error: 'the markup does not declare data-edge="hub" and data-edge="rim"' };
    }

    const texts = [...svg.querySelectorAll('text')];
    const out = [];
    for (const family of families) {
        await document.fonts.load('700 11px "' + family + '"');
        const loaded = [...document.fonts]
            .some((f) => f.family === family && f.status === 'loaded');
        texts.forEach((t) => { t.style.fontFamily = '"' + family + '", sans-serif'; });
        void svg.getBoundingClientRect();
        const rows = texts.map((t) => {
            const box = t.getBBox();
            const ax = Number(t.getAttribute('x'));
            const anchor = Math.hypot(ax - 120, Number(t.getAttribute('y')) - 120);
            /* The label runs along its radius and rotates about its own anchor, so its
               extent either side of the anchor in x is its extent in radius. */
            const back = ax - box.x;
            const forward = (box.x + box.width) - ax;
            return {
                text: t.textContent,
                width: box.width,
                inner: anchor - Math.max(back, forward),
                outer: anchor + Math.max(back, forward)
            };
        });
        out.push({ family, loaded, rows });
    }
    return { hub, rim, families: out };
}, FAMILIES);

await browser.close();

if (measured.error) {
    fail(measured.error);
    process.exit(1);
}

console.log();
console.log('  hub ring outer edge r=' + measured.hub +
            ', rim keyline inner edge r=' + measured.rim +
            ', so a label has ' + (measured.rim - measured.hub).toFixed(1) + ' units to sit in');
console.log('  family            widest label      width   inner   outer   clearance');

for (const entry of measured.families) {
    if (!entry.loaded) {
        fail(entry.family + ' did not load, so its row would be the fallback font ' +
             'wearing another name. That is the failure this check exists to prevent.');
        continue;
    }
    const worst = entry.rows.reduce((a, b) => (b.width > a.width ? b : a));
    const clearHub = worst.inner - measured.hub;
    const clearRim = measured.rim - worst.outer;
    const tight = Math.min(clearHub, clearRim);
    const line = '  ' + entry.family.padEnd(18) + worst.text.padEnd(18) +
        worst.width.toFixed(1).padStart(5) +
        worst.inner.toFixed(1).padStart(8) + worst.outer.toFixed(1).padStart(8) +
        tight.toFixed(1).padStart(10);
    if (tight < MIN_CLEAR) {
        console.log(line + '   TOO TIGHT');
        fail(entry.family + ': "' + worst.text + '" comes within ' + tight.toFixed(1) +
             ' units of the ' + (clearHub < clearRim ? 'hub' : 'rim') +
             ', and ' + MIN_CLEAR + ' is the minimum. Reduce the label font size or ' +
             'move the anchor radius, then run this again.');
    } else {
        console.log(line);
    }
}

console.log();
if (failures) {
    console.log('Wheel geometry FAILED: ' + failures + ' problem(s).');
    process.exit(1);
}
console.log('Wheel geometry passed. Every label clears the hub and the rim in every family.');
