/* ============================================================================
   Every product photograph has a 2:1 push banner beside it, and the two ways of
   naming that banner agree.

     node factory/push-images.test.mjs

   WHY THIS EXISTS, and it is the reason the whole approach is safe. The push asset does
   not read a column holding the banner's address: it DERIVES the address from the
   product's own image_link by inserting one path segment. That is what lets a rich push
   carry a per recipient image with no change to dps_product, no migration and nothing to
   re-run in Supabase.

   The cost of deriving is that a missing file is not a fallback, it is a 404 in a
   notification on somebody's phone, and nothing upstream would report it. So the
   invariant has to be real rather than assumed: every product photograph committed with a
   demo has a banner beside it, at the exact path the asset will ask for.

   Two halves, and both are needed. bannerPathFor() in make-push-images.mjs decides where
   the generator WRITES, and bannerOf() inside abandoned-cart-image.txt decides what the
   send ASKS FOR. They are in different languages in different files and neither can import
   the other, so this runs them against the same inputs and holds them to the same answer.
   ========================================================================== */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bannerPathFor, WIDTH, HEIGHT } from './make-push-images.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

/* JPEG dimensions off the SOF marker, because the alternative is a dependency and the
   header is fifteen lines. Walks the segment chain rather than scanning for bytes: 0xFFC0
   can occur inside entropy coded data, and a scan finds it there first. */
function jpegSize(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let at = 2;
    while (at < bytes.length - 9) {
        if (bytes[at] !== 0xFF) { at++; continue; }
        const marker = bytes[at + 1];
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
            at += 2;
            continue;
        }
        const length = bytes.readUInt16BE(at + 2);
        /* SOF0, SOF1, SOF2 and the rest of the frame headers, minus the four that are
           not frame headers at all. */
        if (marker >= 0xC0 && marker <= 0xCF &&
            marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
        }
        at += 2 + length;
    }
    return null;
}

/* -------------------------------------------------------------------------- */
/* The two namers, held to one answer                                          */

{
    /* THE ASSET'S OWN FUNCTION, lifted off disk rather than copied here, so this cannot
       pass against logic the panel never sees. Same technique cart.test.mjs uses on the
       resolution block. */
    const source = readFileSync(
        join(ROOT, 'factory', 'panel', 'content', '_dynamic', 'abandoned-cart-image.txt'), 'utf8');
    const found = source.match(/var bannerOf = function[\s\S]*?\n  \};/);
    ok('the asset carries a bannerOf', Boolean(found));
    /* eslint-disable-next-line no-new-func */
    const bannerOf = new Function(found[0] + '\nreturn bannerOf;')();

    const ORIGIN = 'https://dengage-presales.github.io/demo-ai/demos/mine/';

    ok('the send asks for the path the generator writes',
       bannerOf(ORIGIN + 'images/p1.jpg') === ORIGIN + bannerPathFor('images/p1.jpg'),
       [bannerOf(ORIGIN + 'images/p1.jpg'), ORIGIN + bannerPathFor('images/p1.jpg')]);

    /* A PNG SOURCE BECOMES A JPEG BANNER, so the extension has to be replaced rather than
       carried. Both sides do it, and this is where they would drift. */
    ok('a png source resolves to a jpg banner on both sides',
       bannerOf(ORIGIN + 'images/p2.png') === ORIGIN + bannerPathFor('images/p2.png') &&
       /\/push\/p2\.jpg$/.test(bannerOf(ORIGIN + 'images/p2.png')),
       bannerOf(ORIGIN + 'images/p2.png'));

    /* AND NEITHER INVENTS A PATH FROM A SHAPE IT DOES NOT RECOGNISE. The asset falls back
       to the original photograph, which is a real image and merely letterboxed, and the
       generator skips the file rather than writing somewhere unexpected. */
    for (const odd of ['images', 'assets/p1.jpg', 'p1.jpg', 'images/', 'imagesx/p1.jpg']) {
        ok('"' + odd + '" is not turned into a banner path', bannerPathFor(odd) === '',
           bannerPathFor(odd));
        ok('and the asset declines it too', bannerOf(ORIGIN + odd) === '',
           bannerOf(ORIGIN + odd));
    }

    /* A QUERY STRING ON THE PHOTOGRAPH MUST NOT REACH THE BANNER'S NAME, or the send asks
       for a file whose name contains a question mark. */
    ok('a query string is dropped before the banner is named',
       bannerOf(ORIGIN + 'images/p1.jpg?v=2') === ORIGIN + 'images/push/p1.jpg',
       bannerOf(ORIGIN + 'images/p1.jpg?v=2'));
}

/* -------------------------------------------------------------------------- */
/* Every committed photograph has one                                          */

{
    const demos = existsSync(join(ROOT, 'demos'))
        ? readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
        : [];
    ok('there are demos to check', demos.length > 0, demos);

    const missing = [];
    const wrongRatio = [];
    const tooLarge = [];
    const stale = [];
    let checked = 0;

    for (const slug of demos) {
        const path = join(ROOT, 'demos', slug, 'products.json');
        if (!existsSync(path)) continue;
        const payload = JSON.parse(readFileSync(path, 'utf8'));
        const list = Array.isArray(payload) ? payload : (payload.products || []);

        for (const product of list) {
            if (!product || !product.image) continue;
            const rel = bannerPathFor(product.image);
            if (!rel) continue;
            checked++;

            const banner = join(ROOT, 'demos', slug, rel);
            if (!existsSync(banner)) { missing.push(slug + '/' + rel); continue; }

            const bytes = readFileSync(banner);
            const size = jpegSize(bytes);
            if (!size || size.width !== WIDTH || size.height !== HEIGHT) {
                wrongRatio.push({ at: slug + '/' + rel, size });
            }
            /* The push editor warns above 600KB. At this size nothing should come close,
               so a file that does is a signal rather than a threshold to tune. */
            if (bytes.length > 600 * 1024) {
                tooLarge.push({ at: slug + '/' + rel, kb: Math.round(bytes.length / 1024) });
            }
            /* A REGENERATED PHOTOGRAPH WITH A STALE BANNER is the quiet failure this whole
               file is for: the push would carry last week's picture and look completely
               fine. The generator compares the same two timestamps. */
            const original = join(ROOT, 'demos', slug, product.image);
            if (existsSync(original) &&
                statSync(original).mtimeMs > statSync(banner).mtimeMs) {
                stale.push(slug + '/' + rel);
            }
        }
    }

    ok('there are product photographs to check', checked > 0, checked);
    ok('every product photograph has a push banner beside it', missing.length === 0, missing);
    ok('every banner is ' + WIDTH + 'x' + HEIGHT, wrongRatio.length === 0, wrongRatio);
    ok('no banner is above the size the push editor warns about',
       tooLarge.length === 0, tooLarge);
    ok('no banner is older than the photograph it was made from', stale.length === 0, stale);

    /* THE CHECK AGAINST A BANNER THAT IS NOT THERE, because one that matches nothing
       passes on an empty repository. Two checks here have already failed open. */
    ok('the check would notice a banner that does not exist',
       !existsSync(join(ROOT, 'demos', demos[0], 'images', 'push', 'no-such-product.jpg')));

    /* AND THE DIMENSION READER AGAINST SOMETHING THAT IS NOT A JPEG, so a banner written
       as a PNG would be reported rather than silently accepted as unmeasurable. */
    ok('the dimension reader rejects bytes that are not a JPEG',
       jpegSize(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])) === null);
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
