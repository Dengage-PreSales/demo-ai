/* ============================================================================
   The email palette, derived from a demo's own theme.

     import { emailPalette } from './palette.mjs';
     const palette = emailPalette(config.theme);

   WHY THIS EXISTS AT ALL, AND IT IS THE WHOLE REASON EMAIL NEEDS ITS OWN PASS.
   The storefront themes itself at runtime: template/style.css declares custom
   properties and js/boot.js sets them from demo.config.json, so one stylesheet
   serves every demo. An email cannot work that way. Custom properties are
   unsupported in Outlook on Windows and unreliable in several webmail clients, a
   <link> to a stylesheet is stripped, and much of the layout still has to be
   attributes on table cells. So the colour has to be a literal hex by the time
   the message is sent, which means theming happens HERE, at build time, per
   demo, exactly the way the images and the catalogue already do.

   IT ENFORCES CONTRAST RATHER THAN TRUSTING THE THEME. A scraped theme is a
   reasonable guess, and it is now read from a rendered page, so it can carry a
   dark ground with light text. Both are fine on a storefront that was measured.
   An email is composited by a client that may also apply its own dark mode, and
   nobody sees the result before the send. So every pair this returns is checked
   and adjusted, and the rule is the same 4.5 the rest of the factory uses.

   IT NEVER INVENTS A BRAND COLOUR. The brand is the theme's own primary, always.
   What is adjusted is only what sits ON it, and the neutrals around it.
   ========================================================================== */

import { parseHex, contrast } from '../scrape/theme.mjs';

const MIN_TEXT = 4.5;     /* body copy, and anything a person has to read */
/* QUIET COPY IS STILL COPY. This was 3.0, on the reasoning that secondary text is
   meant to recede. Measured in a browser, that let a store name and a caption ship
   at 4.12 against white, which is below the bar for text at any size and is a
   readability failure rather than a design choice. Anything a person reads gets
   4.5; 3.0 survives below only for a hairline. */
const MIN_QUIET = 4.5;
const MIN_EDGE = 1.25;    /* a hairline only has to be visible */

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

function hex(rgb) {
    return '#' + rgb.map((n) => {
        const v = Math.max(0, Math.min(255, Math.round(n)));
        return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
}

function luminance(rgb) {
    const channel = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/* A step from one colour toward another, per channel. */
function towards(from, to, amount) {
    return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
}

/* THE READABLE VERSION OF A COLOUR ON A GIVEN GROUND. The preference is always
   the colour the theme asked for. Only when that fails the bar does this move,
   and it moves toward whichever end of the scale the ground is not, so text on a
   dark card goes lighter and text on a light card goes darker. */
function readable(want, ground, bar) {
    if (want && contrast(want, ground) >= bar) return want;
    const target = luminance(ground) > 0.45 ? BLACK : WHITE;
    let colour = want || target;
    for (let step = 1; step <= 20; step++) {
        colour = towards(colour, target, 0.12);
        if (contrast(colour, ground) >= bar) return colour;
    }
    return target;
}

export function emailPalette(theme) {
    const t = theme || {};
    const pick = (value, fallback) => parseHex(value) || fallback;

    const brand = pick(t.primary, [13, 118, 128]);
    const card = pick(t.surface, WHITE);
    const canvas = pick(t.page, [246, 247, 248]);

    /* The label on a brand-coloured button. The theme already resolved one
       against the storefront, so it is tried first and only replaced if it does
       not hold here. */
    const onBrand = readable(pick(t.onPrimary, null), brand, MIN_TEXT);

    /* THE STRIP'S GROUND COUNTS TOO, AND MISSING IT COST NINE FAILURES. A
       recommendation strip sits on `wash`, a tint of the brand, not on the card. Text
       checked only against the card can clear 4.5 there and fail on the strip, which
       is exactly what happened on a warm brand: quiet came out at 3.78 on the tint
       while passing on white. So wash is computed FIRST and every text colour is
       resolved against whichever of the two grounds is harder. */
    const washRgb = towards(card, brand, luminance(canvas) < 0.45 ? 0.16 : 0.08);
    const hardest = (want, bar) => {
        const onCard = readable(want, card, bar);
        return contrast(onCard, washRgb) >= bar ? onCard : readable(onCard, washRgb, bar);
    };

    const text = hardest(pick(t.ink, null), MIN_TEXT);
    const quiet = hardest(pick(t.muted, null), MIN_QUIET);
    const edge = readable(pick(t.line, null), card, MIN_EDGE);

    /* THE BRAND COLOUR AS TEXT IS A DIFFERENT COLOUR FROM THE BRAND COLOUR AS A
       FILL, and treating them as one is what put a bright orange eyebrow on a white
       card at 2.14. A saturated brand works as a button because the label on it is
       chosen to suit; the same hex as small uppercase text on a light ground is
       simply illegible.

       So the brand is darkened until it reads on both grounds it can appear over,
       keeping the hue and losing only lightness. This is the email twin of the
       storefront's own brand-text derivation, and the two agree by construction
       because both walk the same 12 percent steps against the same 4.5 bar. */
    const brandText = hardest(brand, MIN_TEXT);

    /* Text on the canvas as well as on the card, because the preheader, the
       footer and the unsubscribe line sit outside the card and a demo whose page
       and surface differ would otherwise put card-checked text on canvas. */
    const canvasText = readable(text, canvas, MIN_TEXT);
    const canvasQuiet = readable(quiet, canvas, MIN_QUIET);

    const dark = luminance(canvas) < 0.45;

    /* A tint of the brand, behind a recommendation strip. Derived from the card so it
       stays on the right side of the theme, and already used above as a contrast
       ground rather than only as decoration. */
    const wash = hex(washRgb);

    return {
        brand: hex(brand),
        onBrand: hex(onBrand),
        accent: t.accent && parseHex(t.accent) ? t.accent : hex(brand),
        card: hex(card),
        canvas: hex(canvas),
        text: hex(text),
        brandText: hex(brandText),
        quiet: hex(quiet),
        edge: hex(edge),
        canvasText: hex(canvasText),
        canvasQuiet: hex(canvasQuiet),
        wash,
        radius: /^\d+px$/.test(t.radius || '') ? parseInt(t.radius, 10) : 8,
        dark,
        /* Named first, with a stack behind it. A webfont in email loads in some
           clients and silently does not in others, so the stack is what actually
           has to look right. */
        display: fontStack(t.displayFont),
        body: fontStack(t.bodyFont)
    };
}

/* The demo's face first, then faces a mail client is likely to have, then the
   generic. Quoted where a name contains a space, because an unquoted two word
   family is dropped by some clients. */
function fontStack(name) {
    const safe = "Helvetica Neue, Helvetica, Arial, sans-serif";
    if (!name || typeof name !== 'string') return safe;
    const quoted = /\s/.test(name) ? "'" + name + "'" : name;
    return quoted + ', ' + safe;
}

export { hex, luminance };
