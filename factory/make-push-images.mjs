/* ============================================================================
   A 2:1 banner of every product photograph, for the Media field of a web push.

     node factory/make-push-images.mjs                 every demo
     node factory/make-push-images.mjs --slug <slug>   one demo
     node factory/make-push-images.mjs --force         redo up to date banners

   WHY. A rich web push shows its image in a wide band, and the editor asks for 2:1.
   A product photograph is square or portrait, so the browser pads it or crops it, and
   which of those you get depends on the client. The first real push out of this account
   showed a keyboard battery floating in a letterbox with grey bars either side of it,
   which is not a picture anybody chose.

   Size is not the problem and never was. The committed tiles are capped at 900px on
   the long edge and land between 30 and 80KB, comfortably inside the 600KB the editor
   warns about. The ratio is the whole problem, so this fixes the ratio.

   THE GROUND IS SAMPLED FROM THE PHOTOGRAPH ITSELF, and that is the part worth
   understanding. Padding a white cutout onto the demo's surface colour trades a
   letterbox for a visible white rectangle on a grey field, which looks worse rather
   than better. So the four corners of the source are read: when they agree, that colour
   fills the band and the product appears to float on a full bleed background of its own
   making. When they disagree, the photograph fills its frame and has no background to
   extend, so the demo's surface colour is used and the result is an honest inset.

   AND THE PHOTOGRAPH'S OWN MARGIN IS TRIMMED BEFORE IT IS FITTED, which turned out to
   matter more than the ratio did. A studio product shot is mostly background, so fitting
   the file means fitting its whitespace: the battery above came out at about a third of
   the height it could have had, in the middle of a band, looking incidental. With the
   margin off it fills the band. The trim only runs when the ground was sampled, because
   without a known background colour there is nothing to call empty, and it gives up rather
   than guessing when the box it finds is too small to be a margin.

   ENLARGEMENT IS CAPPED AT 1.6. Filling the band with a trimmed product is the point, and
   doing it without limit turns a small photograph into a soft one. Soft product photography
   on a shared screen reads as a cheap demo, so past that point it stays smaller and crisp.

   IT WRITES BESIDE THE ORIGINAL, at images/push/<same name>. That is not decoration
   either: abandoned-cart-image.txt derives the banner's address from the product's own
   image_link by inserting one path segment, so the two must stay in step. push-images.test.mjs
   asserts every product photograph has a banner, which is what keeps a derived URL from
   becoming a 404 in a notification.

   Chromium's own canvas does the work, as it does for the tiles themselves, so this adds
   no dependency this repository did not already have.
   ========================================================================== */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchOptions } from './browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 2:1, the ratio the push editor recommends. 1200 wide is generous enough for a
   high density screen and still a small JPEG at this quality. */
export const WIDTH = 1200;
export const HEIGHT = 600;

/* The share of the band left clear above and below the product. Chrome crops a push
   image to whatever width the notification ends up, so a centred product with room
   around it survives a crop that a full bleed one does not. */
const MARGIN = 0.09;

/* The same quality as the product tiles, for the same reason: it is the point where a
   photograph stops losing anything a viewer can see. */
const QUALITY = 0.82;

/* How close two corners have to be to count as the same colour. Generous, because a
   photograph on white is rarely on pure white: it is on whatever white the studio and
   the JPEG left behind. */
const CORNER_TOLERANCE = 10;

/* How far from the ground a pixel has to be to count as the subject rather than the
   margin. Wider than CORNER_TOLERANCE, because a soft drop shadow is background as far as
   trimming is concerned and would otherwise pull the box out to the full frame. */
const TRIM_TOLERANCE = 26;

/* A bounding box below this share of either dimension is treated as a failed trim rather
   than a tight one. */
const MIN_TRIM = 0.12;

/* The most a trimmed product is enlarged. Past this a 900px tile starts to look soft on a
   shared screen, and soft product photography reads as a cheap demo. */
const MAX_UPSCALE = 1.6;

/* Runs inside the page. The source arrives as a data: URI so nothing here touches the
   network, which is the same promise the tile compressor makes. */
async function toBannerInPage(options) {
    const { src, width, height, margin, fallbackGround, quality } = options;
    const { tolerance, trimTolerance, maxUpscale, minTrim } = options;

    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('undecodable'));
    });
    image.src = src;
    await loaded;

    const w0 = image.naturalWidth || 1;
    const h0 = image.naturalHeight || 1;

    const probe = document.createElement('canvas');
    probe.width = w0;
    probe.height = h0;
    const probeContext = probe.getContext('2d');
    probeContext.drawImage(image, 0, 0);
    const pixels = probeContext.getImageData(0, 0, w0, h0).data;

    const at = (x, y) => {
        const i = (y * w0 + x) * 4;
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    };

    /* THE CORNERS, a few pixels in rather than at the very edge, because a JPEG's
       outermost row often carries ringing from the compression rather than the colour
       behind the subject. */
    const inset = Math.max(1, Math.min(4, Math.floor(Math.min(w0, h0) / 50)));
    const corners = [
        at(inset, inset),
        at(w0 - 1 - inset, inset),
        at(inset, h0 - 1 - inset),
        at(w0 - 1 - inset, h0 - 1 - inset)
    ];

    /* A transparent corner is a cutout, and a cutout's background is white by the same
       reasoning the tile compressor flattens onto white rather than black. */
    const opaque = corners.filter((c) => c[3] > 250);
    let ground = fallbackGround;
    let sampled = false;
    let flat = null;
    if (opaque.length === 4) {
        const spread = (index) => Math.max.apply(null, opaque.map((c) => c[index])) -
                                  Math.min.apply(null, opaque.map((c) => c[index]));
        if (spread(0) <= tolerance && spread(1) <= tolerance && spread(2) <= tolerance) {
            const mean = (index) => Math.round(
                opaque.reduce((sum, c) => sum + c[index], 0) / opaque.length);
            flat = [mean(0), mean(1), mean(2)];
            ground = 'rgb(' + flat[0] + ',' + flat[1] + ',' + flat[2] + ')';
            sampled = true;
        }
    } else if (corners.every((c) => c[3] <= 250)) {
        flat = [255, 255, 255];
        ground = '#ffffff';
        sampled = true;
    }

    /* THE MARGIN INSIDE THE PHOTOGRAPH IS TRIMMED BEFORE FITTING, which is the
       difference between a product that fills the band and one that sits in the middle of
       it looking incidental. A studio product shot is mostly background: fitting the whole
       file means fitting its whitespace too, and the first push out of this account showed
       a battery at about a third of the height it could have had.

       Only when the ground was sampled, because without a known background colour there is
       nothing to call empty. And it gives up rather than guessing: a bounding box smaller
       than minTrim of either dimension means the threshold found the subject rather than
       the margin, most likely on a photograph that fills its frame, so the whole image is
       used instead. */
    let sx = 0, sy = 0, sw = w0, sh = h0;
    let trimmed = false;
    if (flat) {
        let top = h0, left = w0, right = -1, bottom = -1;
        for (let y = 0; y < h0; y++) {
            for (let x = 0; x < w0; x++) {
                const i = (y * w0 + x) * 4;
                if (pixels[i + 3] <= 250) continue;
                if (Math.abs(pixels[i] - flat[0]) <= trimTolerance &&
                    Math.abs(pixels[i + 1] - flat[1]) <= trimTolerance &&
                    Math.abs(pixels[i + 2] - flat[2]) <= trimTolerance) continue;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
        if (right >= left && bottom >= top) {
            const boxWidth = right - left + 1;
            const boxHeight = bottom - top + 1;
            if (boxWidth >= w0 * minTrim && boxHeight >= h0 * minTrim) {
                /* A little of the original margin is kept, so the product does not look
                   cut out and pasted on. */
                const breathe = Math.round(Math.max(boxWidth, boxHeight) * 0.03);
                sx = Math.max(0, left - breathe);
                sy = Math.max(0, top - breathe);
                sw = Math.min(w0 - sx, boxWidth + breathe * 2);
                sh = Math.min(h0 - sy, boxHeight + breathe * 2);
                trimmed = sw < w0 || sh < h0;
            }
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = ground;
    context.fillRect(0, 0, width, height);

    /* Contain, and capped rather than uncapped: enlarging a trimmed product is the point,
       and enlarging it without limit turns a small photograph into a soft one. */
    const boxW = width * (1 - 2 * margin);
    const boxH = height * (1 - 2 * margin);
    const scale = Math.min(maxUpscale, boxW / sw, boxH / sh);
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    context.drawImage(image, sx, sy, sw, sh,
        Math.round((width - w) / 2), Math.round((height - h) / 2), w, h);

    return { dataUrl: canvas.toDataURL('image/jpeg', quality), ground, sampled, trimmed };
}

const MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', avif: 'image/avif'
};

function mimeOf(file) {
    const dot = file.lastIndexOf('.');
    return MIME[dot === -1 ? '' : file.slice(dot + 1).toLowerCase()] || 'image/jpeg';
}

/* The banner's path from the product's own image path, and the ONE place that rule is
   written on this side. abandoned-cart-image.txt performs the same insertion against the
   absolute URL, and push-images.test.mjs holds the two to the same answer. */
export function bannerPathFor(imagePath) {
    const path = String(imagePath || '').trim();
    const cut = path.lastIndexOf('/');
    if (cut === -1) return '';
    const dir = path.slice(0, cut);
    const file = path.slice(cut + 1);
    if (file === '' || !/(^|\/)images$/.test(dir)) return '';
    return dir + '/push/' + file.replace(/\.[^.]+$/, '') + '.jpg';
}

function demoSlugs() {
    const dir = join(ROOT, 'demos');
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

function productsOf(slug) {
    const path = join(ROOT, 'demos', slug, 'products.json');
    if (!existsSync(path)) return [];
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    const list = Array.isArray(payload) ? payload : (payload.products || []);
    return list.filter((product) => product && product.image);
}

function surfaceOf(slug) {
    const path = join(ROOT, 'demos', slug, 'demo.config.json');
    if (!existsSync(path)) return '#ffffff';
    try {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        const theme = config.theme || {};
        return theme.surface || theme.page || '#ffffff';
    } catch (err) {
        return '#ffffff';
    }
}

/* ONLY WHEN RUN, NEVER WHEN IMPORTED. push-images.test.mjs imports bannerPathFor from
   here to hold the generator and the saved asset to the same answer, and without this
   guard that import launches a browser and rewrites thirty files as a side effect of
   running a test. */
const INVOKED = process.argv[1] &&
    resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (INVOKED) await (async () => {
    const args = process.argv.slice(2);
    const only = (args.find((a) => a.startsWith('--slug=')) || '').replace('--slug=', '') ||
                 (args.includes('--slug') ? args[args.indexOf('--slug') + 1] : '');
    const force = args.includes('--force');

    const slugs = only ? [only] : demoSlugs();
    const work = [];
    for (const slug of slugs) {
        const ground = surfaceOf(slug);
        for (const product of productsOf(slug)) {
            const source = join(ROOT, 'demos', slug, product.image);
            const target = bannerPathFor(product.image);
            if (!target) {
                console.log('  ' + slug + ': ' + product.image + ' is not in images/, skipped');
                continue;
            }
            if (!existsSync(source)) {
                console.log('  ' + slug + ': ' + product.image + ' is missing, skipped');
                continue;
            }
            work.push({ slug, ground, source, out: join(ROOT, 'demos', slug, target), rel: target });
        }
    }

    if (!work.length) {
        console.log('Push banners: no product photography to work from');
        return;
    }

    /* Up to date is the common case on a rebuild, so the browser only launches when
       something actually needs drawing. */
    const todo = work.filter((item) => {
        if (force || !existsSync(item.out)) return true;
        return statSync(item.source).mtimeMs > statSync(item.out).mtimeMs;
    });

    if (!todo.length) {
        console.log('Push banners: ' + work.length + ' already current');
        return;
    }

    const { chromium } = await import('playwright');
    const browser = await chromium.launch(launchOptions());
    const page = await browser.newPage();

    let written = 0;
    let sampledGrounds = 0;
    let trimmedCount = 0;
    let largest = 0;
    try {
        for (const item of todo) {
            const bytes = readFileSync(item.source);
            const src = 'data:' + mimeOf(item.source) + ';base64,' + bytes.toString('base64');
            let result;
            try {
                result = await page.evaluate(toBannerInPage, {
                    src, width: WIDTH, height: HEIGHT, margin: MARGIN,
                    fallbackGround: item.ground, quality: QUALITY,
                    tolerance: CORNER_TOLERANCE, trimTolerance: TRIM_TOLERANCE,
                    maxUpscale: MAX_UPSCALE, minTrim: MIN_TRIM
                });
            } catch (err) {
                console.log('  ' + item.slug + ': ' + item.rel + ' could not be decoded, skipped');
                continue;
            }
            const jpeg = Buffer.from(
                result.dataUrl.slice(result.dataUrl.indexOf(',') + 1), 'base64');
            mkdirSync(dirname(item.out), { recursive: true });
            writeFileSync(item.out, jpeg);
            written++;
            if (result.sampled) sampledGrounds++;
            if (result.trimmed) trimmedCount++;
            if (jpeg.length > largest) largest = jpeg.length;
        }
    } finally {
        await browser.close();
    }

    const kb = (n) => Math.round(n / 1024) + 'KB';
    console.log('Push banners: ' + written + ' written at ' + WIDTH + 'x' + HEIGHT +
                ', ' + sampledGrounds + ' on a ground sampled from the photograph, ' +
                trimmedCount + ' with the photograph\'s own margin trimmed, ' +
                'largest ' + kb(largest));
    if (largest > 600 * 1024) {
        console.log('  one is above the 600KB the push editor warns about, which should ' +
                    'not happen at this size. Check the source.');
    }
})().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
});
