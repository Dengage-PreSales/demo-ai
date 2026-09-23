/* ============================================================================
   The palette of a screenshot, read the way a person sees it.

     import { paletteFromImage } from './screenshot.mjs';
     const palette = await paletteFromImage(url);

   WHY A SCREENSHOT AT ALL. The one client every store must serve is a human's
   browser: bot walls that blank every reader this factory has still show the
   real storefront to the pre-sales person filing the request. A screenshot of
   the product listing page therefore carries ground truth the scrape keeps
   having to guess, and it arrives through the issue form, mandatory since
   11 August 2026. It drives LOOK AND FEEL ONLY: reading names or prices out of
   pixels invites transcription errors, and a wrong real price is worse than a
   placeholder, so products stay scrape or CSV.

   WHAT IS RETURNED, all as lowercase hex:

     ground   the page's background, the most common colour by area
     ink      the darkest colour used in quantity, which is the text
     accents  saturated colours ranked by area, framework free by construction
              because pixels do not lie about what was painted

   HOW IT READS. The bytes are fetched in node, handed to Chromium as a data
   URL, drawn to a canvas at reduced size, and counted per pixel after coarse
   quantisation. A data URL rather than the network inside the browser, so a
   cross origin image cannot taint the canvas and the browser needs no route to
   anything. Chromium is the same one every other check uses, and if it cannot
   launch the answer is { ok: false } rather than a throw: a build must never
   die over a palette.

   ONLY GITHUB'S OWN ATTACHMENT HOSTS ARE FETCHED. The URL arrives from an
   issue body, and fetching arbitrary addresses because an issue named them is
   how a workflow becomes somebody else's download client. The same rule the
   CSV path applies.
   ========================================================================== */

import { existsSync, readFileSync } from 'node:fs';

const ATTACHMENT_HOSTS = /^https:\/\/(?:github\.com\/user-attachments\/(?:assets|files)\/|(?:[a-z0-9-]+\.)?user-images\.githubusercontent\.com\/|objects\.githubusercontent\.com\/|private-user-images\.githubusercontent\.com\/)/i;

const MAX_BYTES = 12 * 1024 * 1024;

function launchOptions() {
    const fromEnv = process.env.PW_CHROMIUM;
    if (fromEnv && existsSync(fromEnv)) return { executablePath: fromEnv };
    if (existsSync('/opt/pw-browsers/chromium')) return { executablePath: '/opt/pw-browsers/chromium' };
    return {};
}

/* Coarse buckets, 32 per channel, so anti-aliasing and JPEG noise collapse
   into the colour they were meant to be. */
function bucket(value) { return Math.min(248, Math.round(value / 32) * 32); }

function hex(r, g, b) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function saturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}

/* The counting itself, exported for the test, which feeds it pixel data
   directly so the arithmetic is provable without a browser. */
export function paletteFromPixels(data) {
    const counts = new Map();
    for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i + 3] < 200) continue;   /* transparent pixels paint nothing */
        const key = hex(bucket(data[i]), bucket(data[i + 1]), bucket(data[i + 2]));
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return { ok: false, reason: 'no-pixels' };

    const total = ranked.reduce((sum, [, n]) => sum + n, 0);
    const parts = (h) => [1, 3, 5].map((at) => parseInt(h.slice(at, at + 2), 16));

    const ground = ranked[0][0];

    let ink = null;
    for (const [colour, count] of ranked) {
        const [r, g, b] = parts(colour);
        if (Math.max(r, g, b) <= 96 && count >= total * 0.002) { ink = colour; break; }
    }

    const accents = [];
    for (const [colour, count] of ranked) {
        const [r, g, b] = parts(colour);
        if (saturation(r, g, b) < 0.35) continue;         /* greys are not accents */
        if (Math.max(r, g, b) < 60) continue;             /* nor near-black */
        if (count < total * 0.0008) continue;             /* nor stray pixels */
        accents.push(colour);
        if (accents.length >= 6) break;
    }

    return { ok: true, ground, ink, accents, distinct: ranked.length };
}

/* True when a candidate is close enough to something actually painted in the
   screenshot to count as present in it. Coarse on purpose: the question is
   "is this colour in the store's world", not "is this the exact pixel". */
export function presentIn(palette, candidate) {
    if (!palette || !palette.ok || !candidate) return false;
    const parts = (h) => [1, 3, 5].map((at) => parseInt(h.slice(at, at + 2), 16));
    let target;
    try { target = parts(String(candidate).toLowerCase()); } catch (err) { return false; }
    const pool = [palette.ground, palette.ink, ...(palette.accents || [])].filter(Boolean);
    return pool.some((colour) => {
        const [r, g, b] = parts(colour);
        const distance = Math.abs(r - target[0]) + Math.abs(g - target[1]) + Math.abs(b - target[2]);
        return distance <= 150;
    });
}

/* WHICH COLOURS IN A SCREENSHOT ARE THE BRAND.

   The build took the screenshot's INK as the brand colour, from the day the
   screenshot path was written, with white hard coded on top of it. Ink here
   means the most common dark colour, which is the text, or on a product grid
   whatever dark photograph covers the most pixels. It was never a brand colour
   and nothing said why it was used as one.

   What it produced: Queima Diaria in near black, and FirstCry, whose storefront
   is a bright yellow navigation bar and orange add to basket buttons, in the
   brown of a pair of children's joggers in the second product photograph.

   THE BRAND IS THE LARGEST VIVID AREA. Accents are already ranked by how much of
   the screenshot they cover, and a store's own colour is the one it paints
   across its navigation and its buttons. Vivid means saturated AND bright
   enough to read as a colour rather than a shadow, which is what keeps a dark
   brown out of it.

   THE ACCENT HAS TO BE A DIFFERENT COLOUR. The next vivid area is very often a
   lighter or darker shade of the first, and a demo whose accent is its primary
   one step over looks like it has only one colour. So it is the next vivid
   accent at least HUE_APART degrees round the colour wheel.

   INK STAYS THE ANSWER FOR A STORE WITH NO COLOUR IN IT. A black and white
   storefront has no vivid area at all, and for that store the dark text colour
   genuinely is the most honest primary there is.

   A KNOWN LIMIT, stated because it will come up. A screenshot cannot tell a deep
   brand colour from a dark photograph: a navy header and a pair of brown
   trousers look the same to a pixel count. So a colour darker than the vivid
   threshold is not taken as the brand. A store whose brand is a deep green gets
   the brightest green it paints instead, which is the right hue, and a store
   whose only colour is navy falls back to ink, which is what it got before this
   existed.

   AND THE LABEL COLOUR IS MEASURED, not assumed. White on yellow is unreadable,
   and the old line wrote white on everything. */
const HUE_APART = 25;

function channels(colour) {
    return [1, 3, 5].map((at) => parseInt(String(colour).slice(at, at + 2), 16));
}

function vivid(colour) {
    const [r, g, b] = channels(colour);
    return saturation(r, g, b) >= 0.35 && Math.max(r, g, b) >= 128;
}

function hueOf(colour) {
    const [r, g, b] = channels(colour).map((value) => value / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
}

function hueDistance(a, b) {
    const d = Math.abs(hueOf(a) - hueOf(b));
    return Math.min(d, 360 - d);
}

function luminance(colour) {
    const [r, g, b] = channels(colour).map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOf(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/* The label that reads best on a colour: white, or the store's own dark ink,
   whichever clears the bar, and failing both whichever comes closer.

   The store's ink is used only when it is NEUTRAL. On a product grid the most
   common dark colour is often a photograph rather than the text, and a label in
   the brown of a pair of joggers reads as a mistake. */
export function labelFor(colour, ink) {
    const neutral = ink && (() => {
        const [r, g, b] = channels(ink);
        return saturation(r, g, b) < 0.25;
    })();
    const dark = neutral ? ink : '#14181b';
    const onWhite = contrastOf('#ffffff', colour);
    const onDark = contrastOf(dark, colour);
    if (onWhite >= 4.5) return '#ffffff';
    if (onDark >= 4.5) return dark;
    return onWhite >= onDark ? '#ffffff' : dark;
}

export function brandFromScreenshot(shot) {
    const accents = (shot && shot.accents) || [];
    const bright = accents.filter(vivid);
    const primary = bright[0] || (shot && shot.ink) || null;
    if (!primary) return null;
    const accent = bright.find((colour) => colour !== primary &&
        hueDistance(colour, primary) >= HUE_APART) || null;
    return {
        primary,
        onPrimary: labelFor(primary, shot.ink),
        accent,
        fromInk: !bright.length
    };
}

/* A SCREENSHOT ON THIS MACHINE, as well as one pasted into an issue.

   Added 23 September 2026 for a store the GitHub runner cannot read at all.
   FirstCry refuses the runner's datacenter address and renders perfectly for an
   ordinary browser elsewhere, so the screenshot that would theme it can be taken,
   and looked at, by the person running the build. It cannot reach the build
   through an issue without somebody pasting it into GitHub by hand, which is the
   step the factory exists to remove.

   IT CANNOT WIDEN WHAT AN ISSUE CAN FETCH, and that is the property worth
   stating. The attachment host rule below is about text written by anybody who
   can open an issue: an address in that text must never make this build fetch
   something. A local path is not reachable from there. The request parser only
   ever returns a GitHub attachment address, so the only way a path arrives here
   is an operator typing it on the command line, where they could equally have
   run anything else. It must still be absolute, exist, and be a PNG or JPEG. */
const LOCAL_IMAGE = /^\/[^\0]+\.(png|jpe?g)$/i;

export async function paletteFromImage(url) {
    const source = String(url || '');
    let bytes;
    let type;

    if (LOCAL_IMAGE.test(source) && existsSync(source)) {
        const raw = new Uint8Array(readFileSync(source));
        if (raw.length > MAX_BYTES) return { ok: false, reason: 'too-large' };
        bytes = raw;
        type = /\.png$/i.test(source) ? 'image/png' : 'image/jpeg';
    } else {
        if (!ATTACHMENT_HOSTS.test(source)) {
            return { ok: false, reason: 'not-an-attachment-host' };
        }
        try {
            const response = await fetch(source, { redirect: 'follow' });
            if (!response.ok) return { ok: false, reason: 'http-' + response.status };
            type = String(response.headers.get('content-type') || 'image/png').split(';')[0];
            if (!/^image\//.test(type)) return { ok: false, reason: 'not-an-image' };
            const raw = new Uint8Array(await response.arrayBuffer());
            if (raw.length > MAX_BYTES) return { ok: false, reason: 'too-large' };
            bytes = raw;
        } catch (err) {
            return { ok: false, reason: 'fetch-failed' };
        }
    }

    let chromium;
    try { ({ chromium } = await import('playwright')); }
    catch (err) { return { ok: false, reason: 'no-browser' }; }

    let browser;
    try {
        browser = await chromium.launch(launchOptions());
        const page = await browser.newPage();
        const src = 'data:' + type + ';base64,' + Buffer.from(bytes).toString('base64');
        const data = await page.evaluate(async (dataUrl) => {
            const image = new Image();
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(new Error('undecodable'));
                image.src = dataUrl;
            });
            const scale = Math.min(1, 320 / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
        }, src);
        await browser.close();
        return paletteFromPixels(data);
    } catch (err) {
        if (browser) await browser.close().catch(() => {});
        return { ok: false, reason: 'decode-failed' };
    }
}
