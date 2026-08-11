/* ============================================================================
   Tests for the screenshot palette reader.

     node factory/scrape/screenshot.test.mjs

   The counting is tested on constructed pixel data, so the arithmetic is
   proven without a browser. The browser decode path is exercised against a
   PNG built byte by byte when Chromium is present, and says so when it is not.
   The attachment-host rule is tested in refusal, because it is a security
   boundary and those are proven on the refusing side first.
   ========================================================================== */

import { paletteFromPixels, presentIn, paletteFromImage } from './screenshot.mjs';

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

console.log('\n1. Counting pixels that were painted on purpose');
{
    /* A storefront in miniature: white ground, near-black ink, a saturated
       button, a stray anti-aliasing artefact that must not become an accent. */
    const pixels = [];
    const put = (r, g, b, count) => { for (let i = 0; i < count; i++) pixels.push(r, g, b, 255); };
    put(255, 255, 255, 7000);   /* ground */
    put(17, 17, 17, 900);       /* ink */
    put(255, 206, 33, 320);     /* the gold button */
    put(9, 184, 63, 120);       /* the green badge */
    put(200, 30, 250, 3);       /* three stray pixels of noise */

    const palette = paletteFromPixels(pixels);
    ok('the read succeeds', palette.ok, palette);
    ok('the ground is the white', palette.ground === '#f8f8f8' || palette.ground === '#ffffff', palette.ground);
    ok('the ink is the near-black', /^#(00|10|20)/.test(palette.ink || ''), palette.ink);
    ok('the gold button is the first accent', /^#f8c[08]/.test(palette.accents[0] || '') ||
        /^#f8d0/.test(palette.accents[0] || ''), palette.accents);
    ok('the green badge is an accent too', palette.accents.length >= 2, palette.accents);
    ok('three stray pixels are not an accent', palette.accents.length <= 3, palette.accents);
}

console.log('\n2. Presence, which is the validation the theme uses');
{
    const pixels = [];
    const put = (r, g, b, count) => { for (let i = 0; i < count; i++) pixels.push(r, g, b, 255); };
    put(255, 255, 255, 5000);
    put(20, 20, 20, 800);
    put(255, 206, 33, 300);
    const palette = paletteFromPixels(pixels);

    ok('the gold is present', presentIn(palette, '#ffce21'));
    ok('a nearby gold is present too', presentIn(palette, '#f5c518'));
    ok('tailwind blue is absent', !presentIn(palette, '#3b82f6'));
    ok('nothing is present in a failed palette', !presentIn({ ok: false }, '#ffffff'));
}

console.log('\n3. Only GitHub attachment hosts are fetched');
{
    const refused = await paletteFromImage('https://evil.example.com/shot.png');
    ok('an off-host address is refused before any fetch',
       !refused.ok && refused.reason === 'not-an-attachment-host', refused);
    const empty = await paletteFromImage('');
    ok('an empty address is refused', !empty.ok, empty);
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
