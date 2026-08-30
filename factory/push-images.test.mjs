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

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bannerPathFor, WIDTH, HEIGHT } from './make-push-images.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
let fail = 0;
let skipped = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

/* A CHECK THAT CANNOT SEE ITS EVIDENCE SAYS SO, LOUDLY, and neither passes nor fails.
   Counted and printed in the summary, because a skip nobody notices is a pass nobody
   earned. Added 10 August 2026 with the git dated staleness check below. */
function skip(label, why) {
    skipped++;
    console.log('   skip  ' + label + (why ? '  (' + why + ')' : ''));
}

/* Is there a git history to read dates out of, and is it deep enough to be worth reading?
   Three ways this is not available and all three are ordinary: no git on the machine, not
   a repository, or a shallow clone, which is what actions/checkout produces by default. */
function gitHistory() {
    const run = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    const inside = run(['rev-parse', '--is-inside-work-tree']);
    if (inside.error) return { available: false, why: 'git is not on this machine' };
    if (inside.status !== 0 || String(inside.stdout).trim() !== 'true') {
        return { available: false, why: 'not a git working tree' };
    }
    const shallow = run(['rev-parse', '--is-shallow-repository']);
    if (String(shallow.stdout).trim() === 'true') {
        return {
            available: false,
            why: 'shallow clone, so commit dates are unknown. Set fetch-depth: 0'
        };
    }
    return { available: true, run };
}

/* The newest commit date per path, in ONE pass over the history rather than one git call
   per file. `git log --format=@%ct --name-only` prints a date and then the paths that
   commit touched, newest commit first, so the FIRST time a path appears is its newest
   commit. The @ prefix is what tells a date line from a path. */
function commitTimes(history, pairs) {
    const paths = [];
    for (const pair of pairs) {
        if (paths.indexOf(pair.photo) === -1) paths.push(pair.photo);
        if (paths.indexOf(pair.banner) === -1) paths.push(pair.banner);
    }
    if (!paths.length) return {};
    const out = history.run(['log', '--format=@%ct', '--name-only', '--'].concat(paths));
    if (out.status !== 0) return {};
    const times = {};
    let at = 0;
    for (const line of String(out.stdout).split('\n')) {
        const text = line.trim();
        if (text === '') continue;
        if (text.charAt(0) === '@') { at = Number(text.slice(1)); continue; }
        if (times[text] === undefined) times[text] = at;
    }
    return times;
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

    /* THE SHARED MOTIF ARTWORK TOO, which is the picture a demo with no photography of its
       own carries into image_link, and therefore into a push. make-motif-images.mjs renders
       those banners from the vector rather than enlarging the tile. */
    const MOTIF = 'https://dengage-presales.github.io/demo-ai/assets/motifs/';
    ok('the motif artwork resolves to a banner on both sides',
       bannerOf(MOTIF + 'camera.jpg') === 'https://dengage-presales.github.io/demo-ai/' +
           bannerPathFor('assets/motifs/camera.jpg') &&
       bannerOf(MOTIF + 'camera.jpg') === MOTIF + 'push/camera.jpg',
       bannerOf(MOTIF + 'camera.jpg'));

    /* AND THE THIRD IMPLEMENTATION, in factory/emails/resolve.mjs, which every scenario
       email carries so a card can offer a known size image. Lifted the same way and held to
       the same answer: three copies of one rule in three files that cannot import each
       other is exactly the shape that drifts. */
    const { resolveBlock } = await import('./emails/resolve.mjs');
    const block = resolveBlock({ table: 'page_view_events', fold: 'ctx.x = 1;' });
    const lifted = block.match(/var bannerOf = function[\s\S]*?\n  \};/);
    ok('the scenario emails carry a bannerOf too', Boolean(lifted));
    /* eslint-disable-next-line no-new-func */
    const inEmail = new Function(lifted[0] + '\nreturn bannerOf;')();
    for (const probe of ['images/p1.jpg', 'images/p2.png', 'assets/motifs/camera.jpg',
                         'images', 'assets/p1.jpg', 'p1.jpg', 'images/', 'imagesx/p1.jpg']) {
        const site = 'https://dengage-presales.github.io/demo-ai/';
        const viaGenerator = bannerPathFor(probe) === '' ? '' : site + bannerPathFor(probe);
        ok('"' + probe + '" resolves the same in the email as in the generator',
           inEmail(site + probe) === viaGenerator,
           [inEmail(site + probe), viaGenerator]);
        ok('and the same as in the push asset', inEmail(site + probe) === bannerOf(site + probe),
           [inEmail(site + probe), bannerOf(site + probe)]);
    }

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
    const pairs = [];
    let checked = 0;
    let declared = 0;

    for (const slug of demos) {
        const path = join(ROOT, 'demos', slug, 'products.json');
        if (!existsSync(path)) continue;
        const payload = JSON.parse(readFileSync(path, 'utf8'));
        const list = Array.isArray(payload) ? payload : (payload.products || []);

        for (const product of list) {
            if (!product || !product.image) continue;
            declared++;
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
               fine. Collected here and judged below, because the timestamps this compares
               are git's rather than the filesystem's. */
            const original = join(ROOT, 'demos', slug, product.image);
            if (existsSync(original)) {
                pairs.push({
                    at: slug + '/' + rel,
                    photo: 'demos/' + slug + '/' + product.image,
                    banner: 'demos/' + slug + '/' + rel
                });
            }
        }
    }

    /* A TREE WITH NO PRODUCT PHOTOGRAPHS IS A REAL STATE, not a broken scan: the
       reference demo draws from the shared motifs, and there are stretches when it is
       the only demo committed. So the fail-open guard keys on what the catalogues
       declare rather than on a constant: every product that declares a photograph
       must have been checked, and when none declares one there is nothing to judge. */
    ok('every declared photograph was checked', checked === declared, { checked, declared });
    if (declared === 0) {
        console.log('   note  no committed demo carries product photographs today, so the banner pairing has nothing to judge');
    }
    ok('every product photograph has a push banner beside it', missing.length === 0, missing);
    ok('every banner is ' + WIDTH + 'x' + HEIGHT, wrongRatio.length === 0, wrongRatio);
    ok('no banner is above the size the push editor warns about',
       tooLarge.length === 0, tooLarge);

    /* GIT COMMIT TIME, NOT FILE MTIME, and the difference is the whole reason this
       assertion is written out rather than being one statSync comparison.

       mtime DOES NOT SURVIVE A CHECKOUT. A fresh clone stamps every file with the moment
       it was written, so the order of a photograph and its banner is whatever the checkout
       happened to do, and it is different on every run. This assertion therefore passed on
       every machine that had generated the banners and failed in CI on two arbitrary files
       out of thirty, which is the worst combination available: green where it is checking
       nothing, red where nothing is wrong. It held the guard red all day on 10 August 2026
       across every commit, and both files it named were correct by every real measure.

       git log -1 --format=%ct IS the record of which was updated last, it is identical in
       a clone, and it is what somebody would look at to answer the question by hand.

       IT SKIPS RATHER THAN GUESSING when the history is not there. actions/checkout fetches
       depth 1 by default, so a shallow clone knows the commit dates of almost nothing;
       .github/workflows/guard.yml sets fetch-depth: 0 so this runs there. A check that
       cannot see its evidence has to say so, because the alternative is the failure above
       in the other direction. */
    const history = gitHistory();
    if (!history.available) {
        skip('no banner is older than the photograph it was made from', history.why);
    } else {
        const times = commitTimes(history, pairs);
        const stale = [];
        const unknown = [];
        for (const pair of pairs) {
            const photo = times[pair.photo];
            const banner = times[pair.banner];
            if (photo === undefined || banner === undefined) { unknown.push(pair.at); continue; }
            if (photo > banner) stale.push(pair.at);
        }
        ok('no banner is older than the photograph it was made from, by commit date',
           stale.length === 0, stale);
        /* AN UNCOMMITTED PAIR IS REPORTED RATHER THAN COUNTED EITHER WAY. A file with no
           commit yet is normal in a working tree mid change and would be a real gap in CI. */
        if (unknown.length) {
            skip('and ' + unknown.length + ' pair(s) are not in the history yet',
                 unknown.slice(0, 4).join(', '));
        }
    }

    /* THE CHECK AGAINST A BANNER THAT IS NOT THERE, because one that matches nothing
       passes on an empty repository. Two checks here have already failed open. */
    ok('the check would notice a banner that does not exist',
       !existsSync(join(ROOT, 'demos', demos[0], 'images', 'push', 'no-such-product.jpg')));

    /* AND THE DIMENSION READER AGAINST SOMETHING THAT IS NOT A JPEG, so a banner written
       as a PNG would be reported rather than silently accepted as unmeasurable. */
    ok('the dimension reader rejects bytes that are not a JPEG',
       jpegSize(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])) === null);
}

/* -------------------------------------------------------------------------- */
/* And every shared motif has one, for the demos with no photography at all      */

{
    /* THE CASE THAT IS EASY TO MISS, and it was missed until dps_product was read rather
       than reasoned about. A demo whose scrape found no product photography carries the
       shared motif artwork in image_link, so that artwork is what its push shows. The
       products.json check above cannot see it: those products have no image field at all,
       and the substitution happens in the feed. */
    const dir = join(ROOT, 'assets', 'motifs');
    const tiles = existsSync(dir)
        ? readdirSync(dir).filter((file) => file.endsWith('.jpg')).sort() : [];
    ok('there is motif artwork to check', tiles.length > 0, tiles.length);

    const missing = [];
    const wrongRatio = [];
    for (const tile of tiles) {
        const rel = bannerPathFor('assets/motifs/' + tile);
        const banner = join(ROOT, rel);
        if (!existsSync(banner)) { missing.push(rel); continue; }
        const size = jpegSize(readFileSync(banner));
        if (!size || size.width !== WIDTH || size.height !== HEIGHT) {
            wrongRatio.push({ at: rel, size });
        }
    }
    ok('every motif has a 2:1 banner', missing.length === 0, missing);
    ok('and every one of them is ' + WIDTH + 'x' + HEIGHT, wrongRatio.length === 0, wrongRatio);

    /* RENDERED RATHER THAN ENLARGED, which is the point of doing it in the motif script.
       A 400x300 tile scaled to 1200x600 would be soft; a banner drawn from the vector at
       the larger size carries more detail, and more detail is more bytes. */
    const tile = readFileSync(join(dir, tiles[0]));
    const banner = readFileSync(join(ROOT, bannerPathFor('assets/motifs/' + tiles[0])));
    ok('the banner carries more detail than the tile it shares a drawing with',
       banner.length > tile.length, { tile: tile.length, banner: banner.length });
}

/* -------------------------------------------------------------------------- */
/* The staleness comparison, against times it cannot have got right by luck     */

{
    /* THE COMPARISON ITSELF, on synthetic dates. The assertion above passes on a healthy
       repository, which says nothing about whether it would catch an unhealthy one, and
       that is exactly how its predecessor came to be green on every developer machine
       while red in CI. CLAUDE.md section 4: a guard needs a test that would catch it
       failing open. */
    const judge = (times, pairs) => {
        const out = { stale: [], unknown: [] };
        for (const pair of pairs) {
            const photo = times[pair.photo];
            const banner = times[pair.banner];
            if (photo === undefined || banner === undefined) { out.unknown.push(pair.at); continue; }
            if (photo > banner) out.stale.push(pair.at);
        }
        return out;
    };
    const pair = { at: 'demo/images/push/p1.jpg', photo: 'a.jpg', banner: 'b.jpg' };

    ok('a banner newer than its photograph passes',
       judge({ 'a.jpg': 100, 'b.jpg': 200 }, [pair]).stale.length === 0);
    ok('a banner OLDER than its photograph is caught',
       judge({ 'a.jpg': 300, 'b.jpg': 200 }, [pair]).stale[0] === pair.at);
    /* THE SAME COMMIT IS NOT STALE, and it is the normal case: the generator writes the
       banner and the photograph is committed with it. A >= comparison would fail every
       demo the factory has ever built. */
    ok('the same commit for both is not stale',
       judge({ 'a.jpg': 200, 'b.jpg': 200 }, [pair]).stale.length === 0);
    ok('a pair missing from the history is reported rather than judged',
       judge({ 'a.jpg': 200 }, [pair]).unknown[0] === pair.at &&
       judge({ 'a.jpg': 200 }, [pair]).stale.length === 0);
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed' +
            (skipped ? ', ' + skipped + ' skipped' : ''));
process.exit(fail ? 1 : 0);
