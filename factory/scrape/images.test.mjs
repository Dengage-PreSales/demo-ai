/* ============================================================================
   Tests for the product image downloader.

     node factory/scrape/images.test.mjs

   LOCAL FIXTURES ONLY. Every byte these tests fetch is served by their own
   http.Server on the loopback, so the result does not depend on any real
   store being up, and the suite exercises exactly the refusals a real store
   would produce: a bot wall answering 200 with text/html, an oversized
   original, a robots.txt that says no. The images themselves are constructed
   in this file, byte by byte, so a fixture can never quietly rot.

   THE FAIL OPEN TEST IS THE ONE THAT MATTERS MOST. A server that answers 200
   text/html for everything is the classic bot wall, and a downloader that
   commits those bodies as images would ship a grid of broken tiles while
   reporting success. Section 6 feeds it exactly that and proves nothing is
   downloaded. A guard proven only on good input is no guard at all.

   BOTH COMPRESSION PATHS ARE COVERED. The canvas path runs against the real
   Chromium, fed data: URIs so the browser never needs the network. The raw
   bytes fallback is exercised deterministically by injecting a launcher that
   refuses, because waiting for CI to break Chromium is not a test plan.
   ========================================================================== */

import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';

import { downloadImages, stripImageUrls } from './images.mjs';

/* Assigned port range for this suite: 9200 to 9299. */
const PORT = 9200;
const WALL_PORT = 9201;

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function is(label, actual, expected) {
    ok(label, actual === expected, { actual, expected });
}

/* -------------------------------------------------------------------------- */
/* Fixture images, constructed rather than committed                          */

/* A real PNG, built chunk by chunk with real CRCs, so Chromium genuinely
   decodes it: signature, IHDR, one deflated IDAT of 8 bit RGBA scanlines,
   IEND. */
function crc32(buf) {
    if (!crc32.table) {
        crc32.table = new Int32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crc32.table[n] = c;
        }
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
}

function makePng(width, height, pixel) {
    const stride = 1 + width * 4;
    const raw = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const at = y * stride + 1 + x * 4;
            const rgba = pixel(x, y);
            raw[at] = rgba[0]; raw[at + 1] = rgba[1];
            raw[at + 2] = rgba[2]; raw[at + 3] = rgba[3];
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   /* bit depth */
    ihdr[9] = 6;   /* truecolour with alpha */
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

/* Reads the dimensions out of a JPEG's start of frame marker, so the long edge
   cap can be asserted on the committed bytes rather than trusted. */
function jpegSize(buf) {
    let i = 2;
    while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        if (marker >= 0xd0 && marker <= 0xd9) { i += 2; continue; }
        if (marker >= 0xc0 && marker <= 0xcf &&
            marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
}

/* 1200 wide, so the 900px cap has something to cap. */
const bigPng = makePng(1200, 600, (x, y) => [x % 256, y % 256, (x + y) % 256, 255]);
const tinyPng = makePng(4, 4, () => [200, 40, 40, 255]);

/* Random pixels do not deflate, so this PNG is genuinely larger than the raw
   fallback's 300KB ceiling while staying far under the 8MB fetch cap. */
const noise = randomBytes(360 * 360 * 4);
const noisePng = makePng(360, 360, (x, y) => {
    const at = (y * 360 + x) * 4;
    return [noise[at], noise[at + 1], noise[at + 2], 255];
});

/* -------------------------------------------------------------------------- */
/* The fixture servers                                                        */

const hits = [];

/* The main store: real images, a bot wall page wearing an image extension, an
   oversized original announced by content-length, an oversized original that
   does not announce itself, and a robots.txt that disallows one path. */
const server = createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nDisallow: /private/\n');
    } else if (req.url === '/big.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(bigPng);
    } else if (req.url === '/tiny.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(tinyPng);
    } else if (req.url === '/noise.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(noisePng);
    } else if (req.url === '/fake.png') {
        /* The classic bot wall: HTTP 200, an image URL, an HTML body. */
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><body>Please verify you are human.</body></html>');
    } else if (req.url === '/huge.jpg') {
        /* Announces nine megabytes and is never asked for them: the downloader
           must refuse on the header alone, so this route deliberately never
           sends a body or ends. closeAllConnections below cleans it up. */
        res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': String(9 * 1024 * 1024) });
        res.write('x');
    } else if (req.url === '/nolength.gif') {
        /* No content-length at all, and a body just over the cap, so the after
           the read check is the only thing standing. */
        res.writeHead(200, { 'content-type': 'image/gif' });
        res.write(Buffer.alloc(8 * 1024 * 1024 + 1, 7));
        res.end();
    } else if (req.url === '/private/hidden.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(tinyPng);
    } else {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('no');
    }
});

/* The wall: 200 text/html for every path, robots.txt included. A store front
   ended entirely by a bot wall looks exactly like this. */
const wall = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>Access denied.</body></html>');
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
await new Promise((resolve) => wall.listen(WALL_PORT, '127.0.0.1', resolve));

const base = 'http://localhost:' + PORT;
const wallBase = 'http://localhost:' + WALL_PORT;
const work = mkdtempSync(join(tmpdir(), 'images-test-'));

function product(id, imageUrl) {
    const p = { id, name: id, category: 'Fixtures', price: 10,
                discountedPrice: null, stockCount: null, attributes: {}, image: null };
    if (imageUrl !== undefined) p.imageUrl = imageUrl;
    return p;
}

function reasonOf(result, id) {
    const row = result.outcomes.find((o) => o.id === id);
    return row ? row.reason : undefined;
}

/* SAY WHY BEFORE SECTION 1 FAILS, because on 11 August 2026 it failed for a
   reason none of its own assertions could name. Section 1 needs the real
   Chromium, so with the playwright package missing it reported
   "the canvas path is the one that ran: raw-bytes" and then died on a jpg that
   was never written. Every one of those messages describes the image pipeline,
   and the image pipeline was fine: two --no-save installs had run in sequence
   and the second pruned the first.

   The assertions below are deliberately left as failures rather than skips. A
   build that cannot compress a photograph must not pass, because the demo it
   would ship carries the prospect's product images at full size. This only adds
   the sentence that points at the cause. */
let canvasAvailable = true;
try { (await import('playwright')); } catch (err) { canvasAvailable = false; }
if (!canvasAvailable) {
    console.log('\nThe playwright package does not resolve, so the canvas path below');
    console.log('cannot run and section 1 will fail. Its browser being on disk is not');
    console.log('enough. With no package.json here every install is --no-save, and npm');
    console.log('prunes whatever the current command did not name, so installing two');
    console.log('packages one after the other leaves only the second. Install them in');
    console.log('one command:');
    console.log('\n    npm install --no-save playwright@1.62.1 amphtml-validator\n');
}

/* -------------------------------------------------------------------------- */
console.log('\n1. The batch, through the canvas path');

{
    const dest = join(work, 'demo1', 'images');
    const big = product('BIG-1', base + '/big.png');
    const tiny = product('TINY 2', base + '/tiny.png');
    const collideA = product('A_1', base + '/tiny.png');
    const collideB = product('A.1', base + '/tiny.png');
    const masquerade = product('FAKE-1', base + '/fake.png');
    const oversized = product('HUGE-1', base + '/huge.jpg');
    const unannounced = product('NOLEN-1', base + '/nolength.gif');
    const disallowed = product('PRIV-1', base + '/private/hidden.png');
    const offsite = product('OFF-1', 'http://example.com/logo.png');
    const nothing = product('NONE-1', null);

    const batch = [big, tiny, collideA, collideB, masquerade, oversized,
                   unannounced, disallowed, offsite, nothing];
    const result = await downloadImages(batch, dest);

    is('four images are downloaded', result.downloaded, 4);
    is('five are skipped, each for its own reason', result.skipped, 5);
    is('nothing fails outright', result.failed, 0);
    is('the canvas path is the one that ran', result.compressor, 'canvas');

    /* The happy path, end to end. */
    ok('the big image is committed as a jpg', existsSync(join(dest, 'big-1.jpg')));
    is('and the product points at the committed relative path', big.image, 'images/big-1.jpg');
    ok('and its imageUrl is gone', !('imageUrl' in big), big);
    const size = jpegSize(readFileSync(join(dest, 'big-1.jpg')));
    ok('the long edge is capped at 900px', size && size.width === 900, size);
    ok('and the aspect ratio survives the cap', size && size.height === 450, size);
    is('a small image keeps its own size',
       JSON.stringify(jpegSize(readFileSync(join(dest, 'tiny-2.jpg')))),
       JSON.stringify({ height: 4, width: 4 }));

    /* Two ids that collapse to the same file stem must not overwrite each
       other. Which one gets the suffix depends on completion order, so the
       assertion is on the pair rather than on either. */
    ok('colliding ids produce two files', existsSync(join(dest, 'a-1.jpg')) &&
       existsSync(join(dest, 'a-1-2.jpg')));
    ok('and the two products point at different files',
       collideA.image !== collideB.image &&
       [collideA.image, collideB.image].every((p) => /^images\/a-1(-2)?\.jpg$/.test(p)),
       [collideA.image, collideB.image]);

    /* The refusals, each with its reason. */
    is('a 200 serving text/html is refused', reasonOf(result, 'FAKE-1'), 'wrong-type');
    ok('and nothing was written for it', !existsSync(join(dest, 'fake-1.jpg')));
    is('a declared oversize is refused on the header alone',
       reasonOf(result, 'HUGE-1'), 'too-big');
    is('an undeclared oversize is refused after the read',
       reasonOf(result, 'NOLEN-1'), 'too-big');
    is('a robots disallowed path is skipped', reasonOf(result, 'PRIV-1'), 'robots');
    ok('and the disallowed path was never requested',
       !hits.includes('/private/hidden.png'), hits);
    is('a plain http address off the loopback is refused without a fetch',
       reasonOf(result, 'OFF-1'), 'not-https');

    /* Every attempted product loses its imageUrl, succeed or fail, because
       products.json is committed and published. */
    ok('no product still carries an imageUrl',
       batch.every((p) => !('imageUrl' in p)), batch.filter((p) => 'imageUrl' in p));
    ok('every refused product still has a null image, so artwork takes over',
       [masquerade, oversized, unannounced, disallowed, offsite]
           .every((p) => p.image === null));

    /* The product that never had an image is untouched and uncounted. */
    is('a product with a null imageUrl keeps its null image', nothing.image, null);
    is('and is not counted anywhere',
       result.downloaded + result.failed + result.skipped, 9);

    /* The byte count is the disk truth, not a guess. */
    const onDisk = readdirSync(dest)
        .reduce((sum, f) => sum + statSync(join(dest, f)).size, 0);
    is('reported bytes equal the bytes on disk', result.bytes, onDisk);
}

/* -------------------------------------------------------------------------- */
console.log('\n2. The raw bytes fallback, when the browser cannot launch');

{
    const dest = join(work, 'demo2', 'images');
    const small = product('RAW-1', base + '/tiny.png');
    const large = product('RAW-2', base + '/noise.png');

    const result = await downloadImages([small, large], dest, {
        launchBrowser: async () => { throw new Error('no browser in this environment'); }
    });

    is('the fallback path reports itself', result.compressor, 'raw-bytes');
    is('a small original is committed raw', result.downloaded, 1);
    is('a large one is skipped rather than committed uncompressed', result.skipped, 1);
    is('and says why', reasonOf(result, 'RAW-2'), 'too-big-raw');
    ok('the raw file keeps its own format and extension',
       existsSync(join(dest, 'raw-1.png')));
    ok('and its bytes are exactly the original',
       readFileSync(join(dest, 'raw-1.png')).equals(tinyPng));
    is('and the product points at it', small.image, 'images/raw-1.png');
    is('the large product keeps its null image', large.image, null);
}

/* -------------------------------------------------------------------------- */
console.log('\n3. The budget');

{
    const dest = join(work, 'demo3', 'images');
    const before = hits.length;
    const first = product('B-1', base + '/tiny.png');
    const second = product('B-2', base + '/big.png');

    /* A budget of minus one is spent before the first dequeue, which is the
       deterministic way to reach the code path a slow store reaches. */
    const result = await downloadImages([first, second], dest, { budgetMs: -1 });

    is('nothing is downloaded once the budget is spent', result.downloaded, 0);
    is('both become skips', result.skipped, 2);
    is('with the budget reason', reasonOf(result, 'B-1'), 'budget');
    is('a spent budget costs no requests at all', hits.length, before);
    ok('and no directory is created for nothing', !existsSync(dest));
    ok('and imageUrl is still stripped', !('imageUrl' in first) && !('imageUrl' in second));
}

/* -------------------------------------------------------------------------- */
console.log('\n4. Inputs that must not crash a build');

{
    const result = await downloadImages([product('U-1', ':not a url:')],
                                        join(work, 'demo4', 'images'));
    is('an unparseable URL is a skip, not a crash', result.skipped, 1);
    is('with its own reason', reasonOf(result, 'U-1'), 'not-a-url');

    const empty = await downloadImages([], join(work, 'demo4', 'images'));
    is('an empty catalogue is a quiet no-op', empty.downloaded + empty.failed + empty.skipped, 0);
    const noList = await downloadImages(null, join(work, 'demo4', 'images'));
    is('and so is no catalogue at all', noList.downloaded + noList.failed + noList.skipped, 0);
}

/* -------------------------------------------------------------------------- */
console.log('\n5. stripImageUrls, the belt under the braces');

{
    const list = [{ id: 'a', imageUrl: 'https://cdn.example.com/x.jpg', image: null },
                  { id: 'b', image: null },
                  { id: 'c', imageUrl: null, image: null }];
    stripImageUrls(list);
    ok('every imageUrl property is removed, absolute or null',
       list.every((p) => !('imageUrl' in p)), list);
    is('and nothing else is touched', list[0].image, null);
}

/* -------------------------------------------------------------------------- */
console.log('\n6. THE FAIL OPEN TEST: a wall that answers 200 text/html to everything');

/* If this section ever fails, the downloader has started committing bot wall
   pages as product images, which is the one failure mode that ships a grid of
   broken tiles while every counter reads success. */
{
    const dest = join(work, 'demo6', 'images');
    const batch = [product('W-1', wallBase + '/a.png'),
                   product('W-2', wallBase + '/b.jpg'),
                   product('W-3', wallBase + '/c.webp')];
    const result = await downloadImages(batch, dest);

    is('downloaded is exactly zero', result.downloaded, 0);
    is('every page is refused', result.skipped, 3);
    ok('each for being the wrong type',
       batch.every((p) => reasonOf(result, p.id) === 'wrong-type'), result.outcomes);
    ok('no image directory is created', !existsSync(dest));
    ok('every product keeps its null image', batch.every((p) => p.image === null));
    ok('and no imageUrl survives', batch.every((p) => !('imageUrl' in p)));
}

/* -------------------------------------------------------------------------- */

server.closeAllConnections();
wall.closeAllConnections();
await new Promise((resolve) => server.close(resolve));
await new Promise((resolve) => wall.close(resolve));
rmSync(work, { recursive: true, force: true });

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
