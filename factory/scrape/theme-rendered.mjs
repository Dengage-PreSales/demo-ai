/* ============================================================================
   The rendered theme channel: what the browser actually paints.

     import { renderedTheme } from './theme-rendered.mjs';
     const seen = await renderedTheme('https://store.example');

   WHY IT EXISTS, AND IT IS THE SAME LESSON THE CATALOGUE LEARNED FIRST.
   theme.mjs reads a site's HTML and stylesheets as text, on the reasoning that a
   brand colour is written down rather than computed. That holds for a store whose
   CSS is its own. It fails completely for a store whose CSS is a framework's and
   whose real design arrives with its JavaScript, and that turned out to be a
   national denim retailer: its server sends one stylesheet, bootstrap.min.css,
   so every channel the text reader has, declared tokens and counted frequency
   alike, could only ever see Bootstrap's own palette. The demo came out in
   Bootstrap blue on a white page while the store is black. Nothing was missed and
   nothing errored: the evidence available in the text was Bootstrap's.

   A browser has no such problem. It resolves the cascade, runs the JavaScript,
   and can be asked what colour a thing ended up. The catalogue reached this
   conclusion on 8 August 2026 for the same reason and render.mjs was the answer;
   this is that answer applied to colour. The browser is already installed in the
   build for images and the render tier, so it costs a page load rather than a
   dependency.

   IT READS PAINTED PIXELS' WORTH OF TRUTH, NOT MARKUP. Every value here comes
   from getComputedStyle on an element that is actually visible, with a real box,
   after the network has gone quiet. A rule nobody applied contributes nothing,
   which is exactly the property the text reader cannot have.

   IT REPORTS WHAT IT SAW AND JUDGES NOTHING. No contrast clamping, no fallbacks,
   no template defaults. Every field is either a colour the page really uses or
   null. theme.mjs owns every decision about whether a value is safe to ship,
   because that is where the template's own palette lives and where the contrast
   rules already are. Splitting it this way keeps this module testable against a
   fixture: serve a dark page, assert it reads dark.

   IT DEGRADES RATHER THAN CRASHES, like render.mjs. No usable browser, a site
   that will not load, a page with no body: all answer { ok: false, reason } and
   the caller carries on with the text channels. A store must never lose its
   demo because a browser was missing.
   ========================================================================== */

import { existsSync } from 'node:fs';

import { allowed, UA } from './fetch.mjs';

/* One page, so the budget is a page load rather than a crawl. Long enough for a
   hydrating storefront to paint, short enough that a dead site does not hold a
   runner: the same 12 seconds render.mjs gives a single navigation. */
const SETTLE_MS = 12000;

/* Fonts and images are wanted here, unlike in render.mjs, because a font family
   is one of the things being read and a hero image can be what makes a header
   dark. Nothing is aborted. */

/* HOW MANY ELEMENTS ARE SAMPLED per question. A storefront home page can hold
   thousands of nodes and the answer never needs all of them: the most common
   value among a few hundred visible boxes is the same answer the full set gives,
   for a fraction of the work inside the page. */
const SAMPLE_CAP = 400;

/* A box smaller than this is a decoration, an icon or a tracking pixel, and its
   colour is not the page's. */
const MIN_BOX = 24;

/* -------------------------------------------------------------------------- */

/* Everything below runs INSIDE the page, so it is written as one self contained
   function with no imports and no closure over anything in this module. It is
   passed to page.evaluate and its return value is plain JSON.

   It is deliberately one function rather than several: page.evaluate serialises
   what it is given, so helpers defined out here would not exist in there, and a
   previous bug in this repository came from exactly that mistake in a different
   file. */
function readPaintedTheme(limits) {
    const CAP = limits.cap;
    const MIN = limits.minBox;

    const parse = (value) => {
        const match = /rgba?\(([^)]+)\)/.exec(value || '');
        if (!match) return null;
        const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        if (parts.length < 3 || parts.slice(0, 3).some((n) => !isFinite(n))) return null;
        const alpha = parts.length > 3 ? parts[3] : 1;
        return { rgb: parts.slice(0, 3), alpha };
    };
    const hex = (rgb) => '#' + rgb.map((n) => {
        const v = Math.max(0, Math.min(255, Math.round(n)));
        return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
    const luminance = (rgb) => {
        const channel = (c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    };
    const grey = (rgb) => (Math.max(...rgb) - Math.min(...rgb)) <= 16;

    /* BLACK IS A BRAND COLOUR AND MID GREY IS NOT, so "has no hue" is the wrong
       test on its own. Fashion and denim retail put black buttons on white pages
       constantly and mean it; nobody chooses #6c757d, which is what an unstyled
       framework button looks like. Near white fails too: a white button on a white
       storefront gives the theme nothing to work with anywhere else, which is the
       same reason the declared channel refuses near white.

       So a colourless button counts only at the very dark end. This is the
       rendered twin of the rule isBrandColour applies to counted colours, and it
       exists because refusing every grey lost a monochrome brand entirely. */
    const usableBrand = (rgb) => {
        if (!grey(rgb)) return true;
        return luminance(rgb) < 0.06;
    };

    /* THE BACKGROUND A THING IS ACTUALLY SEEN AGAINST. A transparent background
       is not white, it is whatever is behind it, so the ancestors are walked
       until something opaque is found. This is why a dark page whose sections
       declare nothing still reads as dark. */
    const backgroundOf = (el) => {
        let node = el;
        while (node && node !== document.documentElement.parentNode) {
            const cs = getComputedStyle(node);
            const parsed = parse(cs.backgroundColor);
            if (parsed && parsed.alpha >= 0.9) return parsed.rgb;
            node = node.parentElement;
        }
        return null;
    };

    const visible = [];
    for (const el of document.body ? document.body.querySelectorAll('*') : []) {
        if (visible.length >= CAP) break;
        const box = el.getBoundingClientRect();
        if (box.width < MIN || box.height < MIN) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.1) continue;
        visible.push({ el, cs, box });
    }

    const mode = (values) => {
        const counts = new Map();
        for (const value of values) {
            if (value === null || value === undefined) continue;
            counts.set(value, (counts.get(value) || 0) + 1);
        }
        let best = null;
        let bestCount = 0;
        for (const [value, count] of counts) {
            if (count > bestCount) { best = value; bestCount = count; }
        }
        return best;
    };

    /* THE PAGE. What the largest amount of the viewport is painted with, taken
       from body upward rather than from a guess, because body itself is very
       often transparent over a themed html element. */
    const pageRgb = backgroundOf(document.body) || null;

    /* THE TEXT. The colour of real prose, not of the first element that happens
       to have one. Only elements whose own text nodes are non empty count, so a
       wrapper inheriting a colour nothing is written in cannot vote. */
    const inkVotes = [];
    for (const item of visible) {
        const own = [...item.el.childNodes]
            .filter((node) => node.nodeType === 3 && node.textContent.trim().length > 12);
        if (!own.length) continue;
        const parsed = parse(item.cs.color);
        if (parsed && parsed.alpha >= 0.6) inkVotes.push(hex(parsed.rgb));
    }
    const inkHex = mode(inkVotes);

    /* THE CARD. A surface is a box that sits on the page with a background of its
       own, so it is found by looking for exactly that rather than by class name,
       which differs on every store. */
    const surfaceVotes = [];
    const lineVotes = [];
    for (const item of visible) {
        if (item.box.width < 120 || item.box.height < 80) continue;
        const own = parse(item.cs.backgroundColor);
        if (own && own.alpha >= 0.9 && pageRgb && hex(own.rgb) !== hex(pageRgb)) {
            surfaceVotes.push(hex(own.rgb));
        }
        const border = parse(item.cs.borderTopColor);
        if (border && border.alpha >= 0.3 && Number.parseFloat(item.cs.borderTopWidth) > 0) {
            lineVotes.push(hex(border.rgb));
        }
    }

    /* THE BRAND. The colour of the thing you press. A button's own background,
       preferring the biggest one, and only when it is not a neutral: a white or
       grey button says nothing about a brand. Links are a weaker second source
       because their colour is a brand cue on plenty of stores.

       NOT THE HEADER. A dark header is extremely common and is a neutral, so
       reading a brand off it produces black-as-brand on half the web. The header
       informs the PAGE colour through backgroundOf above, which is where it
       belongs. */
    const actionVotes = [];
    for (const item of visible) {
        const tag = item.el.tagName;
        const role = (item.el.getAttribute('role') || '').toLowerCase();
        const isButton = tag === 'BUTTON' || role === 'button' ||
            (tag === 'INPUT' && /^(submit|button)$/i.test(item.el.type || '')) ||
            /(^|\s)(btn|button)(\s|$|-)/i.test(item.el.className || '');
        if (!isButton) continue;
        const own = parse(item.cs.backgroundColor);
        if (!own || own.alpha < 0.6 || !usableBrand(own.rgb)) continue;
        /* THE LABEL COLOUR IS READ WITH IT, and it matters more than it looks. A
           store that paints a yellow button knows perfectly well that its label
           is black. Without this the caller can only guess, and guessing from the
           page's text colour gets it exactly backwards on a dark theme: white on
           yellow fails contrast, so the brand colour gets darkened until white
           works and a bright yellow ships as mud. The store already answered. */
        const label = parse(item.cs.color);
        actionVotes.push({
            hex: hex(own.rgb),
            ink: label && label.alpha >= 0.6 ? hex(label.rgb) : null,
            area: item.box.width * item.box.height
        });
    }
    actionVotes.sort((a, b) => b.area - a.area);
    const buttonHex = actionVotes.length ? mode(actionVotes.map((v) => v.hex)) : null;
    const buttonInk = buttonHex
        ? mode(actionVotes.filter((v) => v.hex === buttonHex).map((v) => v.ink))
        : null;

    const linkVotes = [];
    for (const item of visible) {
        if (item.el.tagName !== 'A') continue;
        const parsed = parse(item.cs.color);
        if (!parsed || parsed.alpha < 0.6 || grey(parsed.rgb)) continue;
        linkVotes.push(hex(parsed.rgb));
    }

    /* FONTS. The first family in the stack, from real prose and from the largest
       heading, because a store very often sets a display face on one only. */
    const familyOf = (value) => {
        const first = String(value || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
        return first || null;
    };
    let heading = null;
    let headingSize = 0;
    for (const item of visible) {
        if (!/^H[1-3]$/.test(item.el.tagName)) continue;
        if (!item.el.textContent.trim()) continue;
        const size = Number.parseFloat(item.cs.fontSize) || 0;
        if (size > headingSize) { headingSize = size; heading = familyOf(item.cs.fontFamily); }
    }
    const bodyFamily = document.body ? familyOf(getComputedStyle(document.body).fontFamily) : null;

    /* RADIUS from the same buttons and cards the colours came from. */
    const radiusVotes = [];
    for (const item of visible) {
        if (item.box.width < 80) continue;
        const r = Number.parseFloat(item.cs.borderTopLeftRadius);
        if (isFinite(r) && r > 0 && r <= 32) radiusVotes.push(Math.round(r) + 'px');
    }

    return {
        page: pageRgb ? hex(pageRgb) : null,
        pageLuminance: pageRgb ? luminance(pageRgb) : null,
        ink: inkHex,
        surface: mode(surfaceVotes),
        line: mode(lineVotes),
        button: buttonHex,
        buttonInk,
        link: mode(linkVotes),
        displayFont: heading,
        bodyFont: bodyFamily,
        radius: mode(radiusVotes),
        sampled: visible.length
    };
}

/* -------------------------------------------------------------------------- */

/* Resolved exactly as images.mjs and render.mjs resolve it. The three must not
   drift: a hardcoded sandbox path in render.mjs broke a real build on 8 August
   2026 because it does not exist on a GitHub runner. */
function launchOptions() {
    const fromEnv = process.env.CHROMIUM_PATH;
    const options = { headless: true };
    if (fromEnv) options.executablePath = fromEnv;
    else if (existsSync('/opt/pw-browsers/chromium')) {
        options.executablePath = '/opt/pw-browsers/chromium';
    }
    return options;
}

export async function renderedTheme(origin, options) {
    const settings = options || {};
    const settleMs = settings.settleMs === undefined ? SETTLE_MS : settings.settleMs;

    let base;
    try { base = new URL(origin); } catch (err) {
        return { ok: false, reason: 'bad-origin' };
    }
    if (!(await allowed(base.href))) return { ok: false, reason: 'robots' };

    let browser;
    try {
        const { chromium } = await import('playwright');
        browser = await chromium.launch(launchOptions());
    } catch (err) {
        return { ok: false, reason: 'render-unavailable' };
    }

    try {
        const context = await browser.newContext({ userAgent: UA });
        if (settings.prepareContext) await settings.prepareContext(context);
        const page = await context.newPage();

        const deadline = Date.now() + settleMs;
        const left = () => Math.max(1, deadline - Date.now());
        try {
            await page.goto(base.href, { waitUntil: 'domcontentloaded', timeout: left() });
        } catch (err) { /* read whatever painted */ }
        try {
            await page.waitForLoadState('networkidle', { timeout: left() });
        } catch (err) { /* never went quiet; the window is the answer */ }

        const seen = await page.evaluate(readPaintedTheme,
            { cap: SAMPLE_CAP, minBox: MIN_BOX });

        /* A page that produced no page colour and no text colour was not read,
           whatever else it returned, and saying so is better than handing the
           caller a half theme it has to second guess. */
        if (!seen || (!seen.page && !seen.ink)) {
            return { ok: false, reason: 'nothing-painted' };
        }
        return { ok: true, ...seen };
    } catch (err) {
        console.error('[theme-rendered] ' + String((err && err.message) || err).split('\n')[0]);
        return { ok: false, reason: 'render-failed' };
    } finally {
        try { await browser.close(); } catch (err) { /* already gone */ }
    }
}
