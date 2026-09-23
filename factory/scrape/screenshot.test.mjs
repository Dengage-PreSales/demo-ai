/* ============================================================================
   Tests for the screenshot palette reader.

     node factory/scrape/screenshot.test.mjs

   The counting is tested on constructed pixel data, so the arithmetic is
   proven without a browser. The browser decode path is exercised against a
   PNG built byte by byte when Chromium is present, and says so when it is not.
   The attachment-host rule is tested in refusal, because it is a security
   boundary and those are proven on the refusing side first.
   ========================================================================== */

import { paletteFromPixels, presentIn, paletteFromImage, brandFromScreenshot, labelFor }
    from './screenshot.mjs';

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}
const is = (label, actual, expected) => ok(label, actual === expected, { actual, expected });

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

console.log('\n3a. A screenshot on this machine, and what that cannot open up');

/* A local file is accepted so a person running the build can supply a
   screenshot they took and looked at. It must not become a way for ISSUE TEXT
   to make the build read the filesystem, and it cannot, because the request
   parser only ever returns a GitHub attachment address. What is asserted here is
   the local half: only an absolute path to an existing PNG or JPEG. */
{
    for (const [label, path] of [
        ['a relative path', 'shots/listing.png'],
        ['a file that is not an image', '/etc/passwd'],
        ['an image that does not exist', '/no/such/listing.png'],
        ['a path with a traversal in a relative form', '../listing.png']
    ]) {
        const refused = await paletteFromImage(path);
        ok(label + ' is refused', !refused.ok, refused);
    }
}

console.log('\n4. Which colours in a screenshot are the brand');

/* THE TWO FAULTS THAT SHIPPED. The build used the screenshot's ink, its most
   common dark colour, as the brand, and wrote white on top of it. Queima Diaria
   came out near black, and FirstCry, a bright yellow navigation bar with orange
   buttons, came out in the brown of a product photograph. */
{
    /* FirstCry's listing page, as the palette reader actually returned it on
       23 September 2026: yellow navigation, shades of it, a dark photo brown,
       and the orange of the add to basket buttons. */
    const firstcry = { ground: '#f8f8f8', ink: '#604040',
        accents: ['#f8e020', '#e0c060', '#f8e040', '#e0c020', '#604020', '#f86020'] };
    const brand = brandFromScreenshot(firstcry);

    is('the largest vivid area is the brand, not the text colour', brand.primary, '#f8e020');
    ok('which is not the ink it used to be', brand.primary !== firstcry.ink, brand);
    is('the accent is a DIFFERENT colour, the orange, not a shade of the yellow',
       brand.accent, '#f86020');
    ok('a dark photo brown is never taken as a brand colour',
       brand.primary !== '#604020' && brand.accent !== '#604020', brand);
    ok('and no white is written on the yellow',
       brand.onPrimary !== '#ffffff', brand);
    is('the label is neutral rather than the photo brown the ink came from',
       brand.onPrimary, '#14181b');

    /* A store with no colour in it at all. For this one the text colour
       genuinely is the most honest primary, so the fallback is kept exactly. */
    const mono = brandFromScreenshot({ ground: '#ffffff', ink: '#202020', accents: ['#202040'] });
    is('a monochrome store still takes its ink', mono.primary, '#202020');
    is('with a readable label on it', mono.onPrimary, '#ffffff');
    ok('and says it came from the ink', mono.fromInk === true, mono);

    ok('a screenshot with nothing in it gives no brand rather than a guess',
       brandFromScreenshot({ ground: '#ffffff', ink: null, accents: [] }) === null);
}

console.log('\n5. A label is measured, never assumed');
{
    is('white on a dark blue', labelFor('#1f3a93', '#202020'), '#ffffff');
    ok('not white on a yellow', labelFor('#f8e020', '#202020') !== '#ffffff');
    is('the store\'s own ink when it is neutral', labelFor('#f8e020', '#202020'), '#202020');
    is('a neutral dark when the ink is really a photograph', labelFor('#f8e020', '#604040'), '#14181b');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
