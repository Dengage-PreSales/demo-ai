/* ============================================================================
   Product images: downloaded at build time, compressed, committed with the demo.

   THIS REVERSES HANDOFF 7.3, ON THE OWNER'S INSTRUCTION, 8 AUGUST 2026. That
   section said no images are downloaded and a demo draws its own artwork. The
   artwork stays, as the fallback for every product whose image could not be
   fetched, but a real product photograph is what makes a demo read as the
   prospect's range on a shared screen, and non-negotiable 4 always described
   this exact mechanism: downloaded, compressed and committed. What was never
   acceptable, and still is not, is a demo that fetches from a prospect's CDN at
   call time, because the prospect can change or remove the asset between the
   build and the call. Committing the bytes is what removes that dependency.

   WHAT THIS FILE PROMISES, each line deliberate:

   HTTPS ONLY, AND ROBOTS IS RESPECTED. Every URL is checked against the site's
   robots.txt through the same allowed() the text tiers use, so the promise in
   fetch.mjs holds for images too. fetch.mjs itself reads text by design, so the
   binary fetch lives here, with the same honest User-Agent, a 15 second
   timeout, and an 8MB cap checked against content-length before the body is
   read and against the body after. The one exception to HTTPS is plain HTTP to
   the local loopback, which is how the test suite serves its fixtures and
   which can never be a prospect's CDN.

   A 200 THAT IS NOT AN IMAGE IS A REFUSAL, NOT AN IMAGE. The classic bot wall
   answers 200 with a text/html challenge page, and writing that to disk as a
   .jpg ships a broken tile. Only the five image content types below are
   accepted; anything else is a skip with a reason, never a crash.

   COMPRESSION RUNS IN CHROMIUM'S OWN CANVAS, because this repository takes no
   new dependencies and Playwright is already here for the motif pass. One
   browser serves the whole batch: each image is loaded from a data: URI, so
   the browser itself never touches the network, drawn onto a canvas capped at
   900px on the long edge, and exported as JPEG at quality 0.82. An animated
   GIF flattens to its first frame, which is the right trade for a product
   tile. If the browser cannot launch at all, the raw bytes are committed
   unmodified when they are under 300KB, and skipped when they are not: an
   uncompressed hero image is a worse page than a drawn tile.

   THE BATCH HAS A BUDGET. Four downloads at a time, 120 seconds wall clock for
   the lot. When the budget is spent the remaining images become skips with the
   reason 'budget', because a demo that builds inside the 30 minute promise
   with some artwork tiles beats one that misses the call entirely.

   NOTHING ABSOLUTE EVER REACHES products.json. On success the product's image
   becomes the committed relative path and imageUrl is deleted. On any failure
   image stays null, the artwork takes over, and imageUrl is deleted just the
   same, because products.json is committed and published and the smoke test
   hunts hotlinks.
   ========================================================================== */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { allowed, UA } from './fetch.mjs';

const TIMEOUT_MS = 15000;
const MAX_BYTES = 8 * 1024 * 1024;

/* The raw fallback ceiling. A compressed tile is typically 30 to 80KB, so
   300KB of raw bytes is already generous; above it the page cost outweighs the
   tile. */
const RAW_LIMIT = 300 * 1024;

const LONG_EDGE = 900;
const JPEG_QUALITY = 0.82;
const CONCURRENCY = 4;
const BUDGET_MS = 120000;

/* The only content types accepted, mapped to the extension the raw fallback
   writes. The canvas path always writes .jpg, so the extension here is only
   used when the browser could not launch. */
const IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif'
};

/* -------------------------------------------------------------------------- */
/* The one cleanup every caller needs                                          */

/* products.json is committed and published, so it must never carry an absolute
   third party URL, whatever happened to the download. The generator calls this
   after downloadImages and on every path that bypasses it, including
   --no-images, so the promise does not depend on which path ran. */
export function stripImageUrls(products) {
    for (const product of products || []) {
        if (product && 'imageUrl' in product) delete product.imageUrl;
    }
}

/* -------------------------------------------------------------------------- */
/* File names                                                                  */

/* The product id, lowercased, with every run of non alphanumerics collapsed to
   one hyphen. Two ids can collide after that ('A_1' and 'a.1' both become
   'a-1'), and a collision would silently overwrite the first product's tile
   with the second's, so the batch keeps a register and suffixes the loser. */
function fileStem(id, used) {
    let stem = String(id || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!stem) stem = 'product';
    if (used.has(stem)) {
        let n = 2;
        while (used.has(stem + '-' + n)) n++;
        stem = stem + '-' + n;
    }
    used.add(stem);
    return stem;
}

/* -------------------------------------------------------------------------- */
/* The binary fetch                                                            */

/* Every outcome is data rather than an exception, exactly as fetch.mjs does it,
   because a batch of thirty downloads must not die on its ninth. */
function refuse(outcome, reason, detail) {
    return { ok: false, outcome, reason, detail: detail || '' };
}

async function fetchImage(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (err) {
        return refuse('skipped', 'not-a-url');
    }

    const loopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) {
        return refuse('skipped', 'not-https');
    }

    /* The same robots promise the text tiers keep, asked through the same
       parser, so a site that disallows its image paths is obeyed here too. */
    if (!(await allowed(url))) return refuse('skipped', 'robots');

    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: control.signal,
            headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/*;q=0.9,*/*;q=0.5' }
        });
        if (!response.ok) return refuse('failed', 'http-' + response.status);

        /* The content type decides before a byte of body is read. A 200 serving
           text/html is a bot challenge page wearing an image URL, and it is
           refused as data rather than crashed on or, worse, written to disk. */
        const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!(type in IMAGE_TYPES)) return refuse('skipped', 'wrong-type', type || 'no content type');

        /* content-length first, so an honestly labelled 40MB original is never
           pulled into memory at all. The byteLength check after covers a server
           that omits the header. */
        const declared = Number(response.headers.get('content-length') || 0);
        if (declared > MAX_BYTES) return refuse('skipped', 'too-big');

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > MAX_BYTES) return refuse('skipped', 'too-big');
        if (!bytes.byteLength) return refuse('skipped', 'empty');

        return { ok: true, bytes, type };
    } catch (err) {
        return refuse('failed', err.name === 'AbortError' ? 'timeout' : 'network', err.message);
    } finally {
        clearTimeout(timer);
    }
}

/* -------------------------------------------------------------------------- */
/* The compressor                                                              */

/* The same resolution order the motif pass uses: an explicit CHROMIUM_PATH
   wins, the sandbox path is used when it exists, and otherwise Playwright's
   own installed browser, which is what the build workflow provides. Forcing a
   path that does not exist would turn every CI build into the raw fallback,
   which is the degraded mode, not the normal one. */
function launchOptions() {
    const fromEnv = process.env.CHROMIUM_PATH;
    if (fromEnv && existsSync(fromEnv)) return { executablePath: fromEnv };
    if (existsSync('/opt/pw-browsers/chromium')) return { executablePath: '/opt/pw-browsers/chromium' };
    return {};
}

/* Imported lazily so that a runner without the Playwright package still builds
   a demo: the import failure becomes the raw fallback rather than a crash. */
async function launchChromium() {
    const { chromium } = await import('playwright');
    return chromium.launch(launchOptions());
}

/* Runs inside the page. The image arrives as a data: URI, so nothing here
   touches the network; the canvas is capped at the long edge and the export is
   always JPEG. Transparency is flattened onto white first, because a JPEG has
   no alpha channel and the default flatten is black, which turns a transparent
   product cutout into a mourning card. An animated GIF draws its first frame,
   which is what drawImage does with one and is fine for a product tile. */
async function toJpegInPage({ src, longEdge, quality }) {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('undecodable'));
    });
    image.src = src;
    await loaded;

    const w0 = image.naturalWidth || 1;
    const h0 = image.naturalHeight || 1;
    const scale = Math.min(1, longEdge / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
}

/* One browser for the whole batch, launched only when the first image actually
   needs it, shared by every worker through one promise so four workers cannot
   race four launches. When the launch fails, every later ask answers 'raw'
   immediately rather than retrying a browser that already said no. */
function makeCompressor(launcher) {
    let launching = null;
    let page = null;
    let browser = null;
    let unavailable = false;
    let modeUsed = 'none';

    async function ready() {
        if (unavailable) return false;
        if (page) return true;
        if (!launching) {
            launching = (async () => {
                browser = await launcher();
                page = await browser.newPage();
            })().catch(() => { unavailable = true; });
        }
        await launching;
        return !unavailable;
    }

    return {
        mode: () => modeUsed,

        /* One of three answers: { jpeg } compressed bytes, { browserless: true }
           meaning the caller should take the raw path, or { reason } when the
           browser is fine and these bytes are not an image it can decode. */
        async compress(bytes, type) {
            if (!(await ready())) return { browserless: true };
            const src = 'data:' + type + ';base64,' + Buffer.from(bytes).toString('base64');
            try {
                const dataUrl = await page.evaluate(toJpegInPage,
                    { src, longEdge: LONG_EDGE, quality: JPEG_QUALITY });
                modeUsed = 'canvas';
                return { jpeg: Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64') };
            } catch (err) {
                return { reason: 'undecodable' };
            }
        },

        rawWasUsed() { if (modeUsed === 'none') modeUsed = 'raw-bytes'; },

        async close() {
            try { if (browser) await browser.close(); } catch (err) { /* already gone */ }
        }
    };
}

/* -------------------------------------------------------------------------- */
/* The batch                                                                   */

/* downloadImages(products, destDir, options)
     -> { downloaded, failed, skipped, bytes, compressor, outcomes }

   Mutates the products in place, which is the contract the generator relies
   on: on success product.image becomes '<dir>/<stem>.jpg' relative to the demo
   folder, and product.imageUrl is deleted for every product that carried one,
   succeed or fail. A product with no imageUrl, or a null one, keeps its null
   image and is not counted at all.

   'compressor' reports which path ran: 'canvas' when the browser compressed at
   least one image, 'raw-bytes' when the fallback committed raw files, 'none'
   when nothing reached compression. 'outcomes' carries one row per attempted
   product for the report and the tests; it is never written to products.json.

   options, all for the tests and the generator rather than for tuning:
     budgetMs       wall clock budget for the whole batch, default 120000
     concurrency    parallel downloads, default 4
     publicPrefix   the path prefix written into product.image,
                    default the basename of destDir
     launchBrowser  replaces the Chromium launcher, so the raw fallback can be
                    exercised deterministically */
export async function downloadImages(products, destDir, options = {}) {
    const budgetMs = options.budgetMs === undefined ? BUDGET_MS : options.budgetMs;
    const concurrency = options.concurrency || CONCURRENCY;
    const prefix = options.publicPrefix === undefined ? basename(destDir) : options.publicPrefix;

    const result = { downloaded: 0, failed: 0, skipped: 0, bytes: 0, compressor: 'none', outcomes: [] };
    if (!Array.isArray(products) || !products.length) return result;

    /* A null or absent imageUrl is a product the scrape found no image for. The
       property is removed where it exists, because nothing downstream may see
       it, and the product is otherwise untouched. */
    const jobs = [];
    for (const product of products) {
        if (!product || typeof product !== 'object') continue;
        if (product.imageUrl) { jobs.push(product); continue; }
        if ('imageUrl' in product) delete product.imageUrl;
    }
    if (!jobs.length) return result;

    const compressor = makeCompressor(options.launchBrowser || launchChromium);
    const used = new Set();
    const started = Date.now();
    let madeDir = false;
    let next = 0;

    async function commit(product, name, bytes) {
        if (!madeDir) { await mkdir(destDir, { recursive: true }); madeDir = true; }
        await writeFile(join(destDir, name), bytes);
        product.image = (prefix ? prefix + '/' : '') + name;
        result.downloaded++;
        result.bytes += bytes.length;
        result.outcomes.push({ id: product.id, outcome: 'downloaded', file: name });
    }

    function record(product, refusal) {
        result[refusal.outcome]++;
        result.outcomes.push({ id: product.id, outcome: refusal.outcome, reason: refusal.reason });
    }

    async function one(product) {
        const url = product.imageUrl;
        delete product.imageUrl;

        /* The budget is checked at dequeue, before the robots lookup, so a spent
           budget costs no further requests at all. */
        if (Date.now() - started > budgetMs) {
            record(product, refuse('skipped', 'budget'));
            return;
        }

        const fetched = await fetchImage(url);
        if (!fetched.ok) {
            record(product, fetched);
            return;
        }

        const compressed = await compressor.compress(fetched.bytes, fetched.type);
        if (compressed.jpeg) {
            await commit(product, fileStem(product.id, used) + '.jpg', compressed.jpeg);
            return;
        }
        if (compressed.browserless) {
            /* The browser could not launch, so the choice is raw bytes or
               nothing. Small originals are committed as they are; large ones
               are skipped, because artwork beats a megabyte tile. */
            if (fetched.bytes.byteLength <= RAW_LIMIT) {
                compressor.rawWasUsed();
                await commit(product,
                    fileStem(product.id, used) + '.' + IMAGE_TYPES[fetched.type],
                    Buffer.from(fetched.bytes));
            } else {
                record(product, refuse('skipped', 'too-big-raw'));
            }
            return;
        }
        record(product, refuse('failed', compressed.reason));
    }

    async function worker() {
        for (;;) {
            const index = next++;
            if (index >= jobs.length) return;
            /* A single product must never sink the batch: an unexpected throw is
               that product's failure, not everyone's. */
            try {
                await one(jobs[index]);
            } catch (err) {
                record(jobs[index], refuse('failed', 'unexpected', err.message));
            }
        }
    }

    try {
        await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
    } finally {
        await compressor.close();
    }

    result.compressor = compressor.mode();
    return result;
}
