/* ============================================================================
   Renders one image per motif, and records which motif each product uses.

     node factory/make-motif-images.mjs           both, for every demo
     node factory/make-motif-images.mjs --slug s  annotate one demo only

   TWO JOBS, ONE BROWSER LAUNCH, and they belong together because both need the
   same thing: the real classifier.

     1. assets/motifs/<id>.jpg     one tile per motif, shared by every demo
     2. demos/<slug>/products.json gains a `motif` field per product

   WHY THE FEED NEEDS THIS AT ALL. The storefront draws its artwork inline as SVG
   so that nothing in a demo can 404 mid call (handoff 7.3, non-negotiable 4).
   That is right for the storefront and leaves Dengage with nothing: a
   recommendation widget or a Product Box is rendered by Dengage from the feed, and
   a feed with no image_url shows an empty tile.

   ONE IMAGE PER MOTIF, NOT PER PRODUCT. Forty-eight files once, shared across
   every demo, instead of thirty per demo times twenty live demos. It is the same
   silhouette the storefront draws, so a Dengage rendered widget and the page agree
   with each other, and the decision not to commit per-demo product images stands.

   THE CLASSIFIER IS NOT REIMPLEMENTED HERE, and that is the whole reason this
   runs a browser rather than parsing JavaScript. template/js/artwork.js is a
   browser module holding the motif table, the keyword lists, the whole-word
   matching and the head-noun scoring. A node side copy of that would be a second
   implementation to drift, and the drift would be silent: a feed whose images
   disagree with the page. So the page is loaded and asked.
   ========================================================================== */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

import { launchOptions } from './browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'motifs');
const PORT = Number(process.env.MOTIF_PORT || 8123);

/* Big enough to stay crisp in a Dengage product card, small enough that
   forty-eight of them are not a burden. The storefront draws the same geometry in
   a 4:3 box, so the ratio matches what a prospect sees on the page. */
const WIDTH = 400;
const HEIGHT = 300;

/* AND A 2:1 COPY OF EACH, for the Media field of a web push. A demo whose scrape found
   no product photography carries motif artwork as its image_link, so this artwork is what
   a push for that demo shows, in a band the push editor asks to be 2:1. A 400x300 file
   arrives letterboxed there.

   RENDERED AT THE LARGER SIZE RATHER THAN ENLARGED FROM THE TILE, which is the whole
   reason it happens here and not in make-push-images.mjs. That script works from committed
   photographs and can only interpolate; this one still has the vector, so 1200x600 is a
   crisp drawing rather than a 3x upscale of a JPEG. The svg keeps its own aspect ratio
   inside the wider box, so the drawing fills the height and the paper fills the rest. */
const PUSH_WIDTH = 1200;
const PUSH_HEIGHT = 600;

/* Fixed rather than themed, and this is the one place that is correct. The
   storefront's artwork inherits the prospect's ink colour through currentColor,
   but one shared file cannot be twenty colours at once, and a Dengage rendered
   card sits on Dengage's own chrome rather than on the demo's. A neutral ink
   reads as a product silhouette on any background. */
const INK = '#5B6472';
const PAPER = '#F4F5F7';

/* template/ is served rather than opened from the filesystem, because the module
   is loaded by a page that fetches its own data files and a file:// origin cannot.
   The server is this script's own and is shut down with it. */
function serve() {
    const child = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT],
        { stdio: 'ignore' });
    return child;
}

async function waitForServer(page, url) {
    for (let attempt = 0; attempt < 40; attempt++) {
        try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3000 });
            if (response && response.ok()) return true;
        } catch (err) { /* not up yet */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
}

function demoFolders(only) {
    const base = join(ROOT, 'demos');
    if (!existsSync(base)) return [];
    return readdirSync(base).sort()
        .filter((slug) => !only || slug === only)
        .filter((slug) => existsSync(join(base, slug, 'products.json')));
}

(async () => {
    const only = (process.argv.find((a) => a.startsWith('--slug=')) || '').replace('--slug=', '') ||
                 (process.argv.includes('--slug') ? process.argv[process.argv.indexOf('--slug') + 1] : '');

    const server = serve();
    const browser = await chromium.launch(launchOptions());
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

    try {
        const up = await waitForServer(page, `http://localhost:${PORT}/template/`);
        if (!up) throw new Error('could not serve template/ on port ' + PORT);
        await page.waitForFunction(() => window.Artwork, null, { timeout: 20000 });

        /* ---------------------------------------------------------------- */
        /* 1. One image per motif                                            */

        const motifs = await page.evaluate(() => window.Artwork.motifs());
        mkdirSync(OUT, { recursive: true });

        for (const id of motifs) {
            /* Asked for by a product NAMED after the motif, so the same classifier
               that decides a real product's motif decides this one. Constructing
               the svg from the motif table directly would bypass exactly the code
               this file exists to stay in step with. */
            const svg = await page.evaluate((motif) => window.Artwork.svg({
                id: 'motif-' + motif, name: motif, category: motif, attributes: {}
            }), id);

            const shot = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
            await shot.setContent(
                '<!doctype html><html><head><meta charset="utf-8"><style>' +
                'html,body{margin:0;padding:0;width:' + WIDTH + 'px;height:' + HEIGHT + 'px}' +
                'body{background:' + PAPER + ';color:' + INK + '}' +
                'svg{display:block;width:100%;height:100%}' +
                '</style></head><body>' + svg + '</body></html>',
                { waitUntil: 'load' });
            /* JPEG, not PNG. The tile is a soft gradient behind a two tone
               silhouette, which is the shape PNG stores worst: forty-eight of them
               came to 2.3MB, around 48kB each, for what is essentially an icon.
               The same tiles as JPEG are a fraction of that with no visible
               difference, because there is no text and no hard colour boundary for
               JPEG to ring against. */
            await shot.screenshot({ path: join(OUT, id + '.jpg'), type: 'jpeg', quality: 88 });
            await shot.close();

            /* The same drawing at 2:1. Same markup, same colours, different viewport, so
               the two can never disagree about what a motif looks like.

               THE ONE CHANGE IS preserveAspectRatio, from meet to slice. With meet, the
               svg keeps its 4:3 and the tile's own gradient stops two thirds of the way
               across, leaving a visible seam against the page behind it. With slice it
               fills the band and the drawing is cropped top and bottom instead, which the
               motifs survive because every one of them is a centred silhouette with room
               around it. Set on the markup rather than in CSS, because object-fit does not
               apply to an inline svg. */
            const wide = svg.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid slice"');
            const banner = await browser.newPage({
                viewport: { width: PUSH_WIDTH, height: PUSH_HEIGHT } });
            await banner.setContent(
                '<!doctype html><html><head><meta charset="utf-8"><style>' +
                'html,body{margin:0;padding:0;width:' + PUSH_WIDTH + 'px;height:' +
                PUSH_HEIGHT + 'px}' +
                'body{background:' + PAPER + ';color:' + INK + '}' +
                'svg{display:block;width:100%;height:100%}' +
                '</style></head><body>' + wide + '</body></html>',
                { waitUntil: 'load' });
            mkdirSync(join(OUT, 'push'), { recursive: true });
            await banner.screenshot({
                path: join(OUT, 'push', id + '.jpg'), type: 'jpeg', quality: 88 });
            await banner.close();
        }
        console.log(motifs.length + ' motif image(s) written to assets/motifs/, ' +
                    'and a 2:1 copy of each to assets/motifs/push/');

        /* ---------------------------------------------------------------- */
        /* 2. Record the motif on every product                              */

        const folders = demoFolders(only);
        for (const slug of folders) {
            const path = join(ROOT, 'demos', slug, 'products.json');
            const payload = JSON.parse(readFileSync(path, 'utf8'));
            const list = Array.isArray(payload) ? payload : payload.products || [];
            if (!list.length) continue;

            const decided = await page.evaluate((items) => items.map((product) => ({
                id: product.id,
                /* null when nothing matched, which is the initials tile. The feed
                   then carries no image for that product rather than a wrong one. */
                motif: window.Artwork.classify(product)
            })), list);

            const byId = new Map(decided.map((entry) => [entry.id, entry.motif]));
            let placed = 0;
            for (const product of list) {
                const motif = byId.get(product.id) || null;
                if (motif) placed++;
                /* Written even when null, so the field's absence always means
                   "never annotated" rather than "annotated, matched nothing". */
                product.motif = motif;
            }
            writeFileSync(path, JSON.stringify(payload, null, 2) + '\n');
            console.log('  ' + slug.padEnd(24) + placed + ' of ' + list.length +
                        ' products have a motif');
        }
    } finally {
        await browser.close();
        server.kill();
    }
})().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
});
