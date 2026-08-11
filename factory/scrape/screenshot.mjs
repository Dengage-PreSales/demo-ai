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

import { existsSync } from 'node:fs';

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

export async function paletteFromImage(url) {
    if (!ATTACHMENT_HOSTS.test(String(url || ''))) {
        return { ok: false, reason: 'not-an-attachment-host' };
    }

    let bytes;
    let type;
    try {
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) return { ok: false, reason: 'http-' + response.status };
        type = String(response.headers.get('content-type') || 'image/png').split(';')[0];
        if (!/^image\//.test(type)) return { ok: false, reason: 'not-an-image' };
        const raw = new Uint8Array(await response.arrayBuffer());
        if (raw.length > MAX_BYTES) return { ok: false, reason: 'too-large' };
        bytes = raw;
    } catch (err) {
        return { ok: false, reason: 'fetch-failed' };
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
