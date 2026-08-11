/* ============================================================================
   Theme extraction: the prospect's brand colours, typography and corner radius.

   Handoff 7.2. Four things are taken and nothing else:

     primary and accent   the most frequent non-neutral colours, weighted toward
                          buttons, links and the header
     displayFont/bodyFont mapped to a family the template can actually load
     radius               from button and card styles

   THE NEUTRALS ARE EXTRACTED TOO, SINCE 8 AUGUST 2026. page, surface, ink, muted
   and line are read from the rendered page, so a store with a black storefront
   gets a dark demo. This reverses an explicit decision, and both halves of the
   reversal are documented at applyRendered below rather than here, because that
   is where the contrast rules that make it safe live. The short version: the old
   reasoning was that guessed neutrals produce grey text on a grey card, which was
   true while they could only be guessed from text, and the price of not reading
   them was a prospect whose store is black receiving a white demo.

   THERE IS A BROWSER NOW, AND IT OUTRANKS THE TEXT. This module still reads the
   site's HTML and stylesheets as text, and that is still the right first answer:
   a brand colour usually is written down. But it is not always, and a store whose
   server sends nothing but bootstrap.min.css cannot be read from text at all, at
   which point every channel here can only see the framework's palette. So a
   rendered pass runs last and wins where it answers. See theme-rendered.mjs; the
   browser it needs is already installed in the build for images and the render
   tier, so the old cost argument against it no longer holds.

   NEVER THE LOGO. Handoff 7.2 and non-negotiable 3. Nothing here looks at
   images, and nothing downstream may: the generated demo carries the Dengage
   mark with the subtext "eComm Demo".
   ========================================================================== */

import { get } from './fetch.mjs';

const STYLESHEET_LIMIT = 6;    /* how many linked stylesheets to read */

/* -------------------------------------------------------------------------- */
/* Colour                                                                     */

function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }

function toHex(rgb) {
    return '#' + rgb.map((channel) =>
        clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('');
}

export function parseHex(text) {
    let hex = text.replace('#', '');
    if (hex.length === 3 || hex.length === 4) {
        hex = hex.slice(0, 3).split('').map((ch) => ch + ch).join('');
    }
    if (hex.length === 8) hex = hex.slice(0, 6);   /* drop the alpha channel */
    if (hex.length !== 6 || !/^[0-9a-f]{6}$/i.test(hex)) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function parseRgb(text) {
    const match = text.match(/rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function parseHsl(text) {
    const match = text.match(/hsla?\(\s*([0-9.]+)(?:deg)?[\s,]+([0-9.]+)%[\s,]+([0-9.]+)%/i);
    if (!match) return null;
    return hslToRgb(Number(match[1]) / 360, Number(match[2]) / 100, Number(match[3]) / 100);
}

function hslToRgb(h, s, l) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
        let x = t;
        if (x < 0) x += 1;
        if (x > 1) x -= 1;
        if (x < 1 / 6) return p + (q - p) * 6 * x;
        if (x < 1 / 2) return q;
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
        return p;
    };
    return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

function rgbToHsl(rgb) {
    const [r, g, b] = rgb.map((channel) => channel / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h, s, l };
}

function parseColour(text) {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.startsWith('#')) return parseHex(trimmed);
    if (trimmed.startsWith('rgb')) return parseRgb(trimmed);
    if (trimmed.startsWith('hsl')) return parseHsl(trimmed);
    return null;
}

/* Relative luminance and contrast, per WCAG. Used to keep a scraped palette
   readable rather than to score it. */
function luminance(rgb) {
    const [r, g, b] = rgb.map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* A brand colour is not a grey and not almost-black or almost-white. Without
   this every site resolves to #ffffff or #000000, because those are the two most
   frequent colours in any stylesheet by a wide margin. */
export function isBrandColour(rgb) {
    const { s, l } = rgbToHsl(rgb);
    return s >= 0.18 && l >= 0.12 && l <= 0.88;
}

/* -------------------------------------------------------------------------- */
/* Reading the site's CSS                                                     */

function styleLinks(html, baseUrl) {
    const out = [];
    const re = /<link\b[^>]*>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        const tag = match[0];
        if (!/stylesheet/i.test(tag)) continue;
        const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
        if (!href) continue;
        try {
            const url = new URL(href, baseUrl);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
            /* Font stylesheets carry no brand colour and cost a request. */
            if (/fonts\.googleapis|fonts\.gstatic|typekit|fontawesome/i.test(url.href)) continue;
            out.push(url.href);
        } catch (err) { /* an unparseable href is not worth reporting */ }
    }
    return out;
}

function inlineStyles(html) {
    const out = [];
    const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    while ((match = re.exec(html)) !== null) out.push(match[1]);
    return out;
}

/* Inline style attributes are where a site's own theming often ends up, because
   a CMS writes the brand colour straight onto the element. */
function styleAttributes(html) {
    const out = [];
    const re = /style\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(html)) !== null) out.push('* { ' + match[1] + ' }');
    return out;
}

/* -------------------------------------------------------------------------- */
/* Weighted colour collection                                                 */

/* A brand colour is not the most common colour on the page, it is the colour of
   the things you are meant to press. So a declaration's weight comes from what
   it applies to and what property it sets.

   Custom properties are weighted highly on their own: a site that writes
   --brand-primary: #1f5c3d has told us the answer directly, and that is more
   reliable than counting how often it is used. */
const SELECTOR_WEIGHTS = [
    [/\.(btn|button|cta)|\bbutton\b|\[type=["']?submit/i, 6],
    [/\b(header|navbar|nav|masthead|topbar)\b/i, 4],
    [/\ba\b|\.link|\.badge|\.tag|\.price|\.sale/i, 3],
    [/\b(footer)\b/i, 2]
];

const PROPERTY_WEIGHTS = [
    [/^--/, 7],                                  /* the site naming its own token */
    [/^background(-color)?$/, 4],
    [/^(border(-\w+)?-color|border)$/, 2],
    [/^color$/, 2],
    [/^(fill|stroke|outline-color|accent-color)$/, 2]
];

function weightFor(list, text, fallback) {
    for (const [pattern, weight] of list) {
        if (pattern.test(text)) return weight;
    }
    return fallback;
}

/* A deliberately small CSS reader: rule blocks and their declarations. A full
   parser would buy nothing here, because the only thing wanted is the pairing of
   a selector with the colours it sets. */
/* THE SITE NAMING ITS OWN BRAND OUTRANKS EVERYTHING COUNTED, and the two must not
   share a filter. Added 8 August 2026, off a real store.

   isBrandColour() exists for the FREQUENCY path: black, white and the greys are
   the most common colours in any stylesheet, so counting has to ignore them or
   every site resolves to #000000. But a custom property whose NAME says primary
   or brand is not a frequency signal, it is the site answering the question
   directly. A grey filter applied to that answer throws it away: for a store whose
   declared brand is exactly #000000 the extractor rejects the declaration and then
   crowns the most-counted survivor, which is a framework grey from the platform's
   utility CSS. A black brand is not a failure to have a
   brand. Luxury retail uses it constantly.

   WHICH NAMES COUNT. The name must END with primary, brand or accent, however
   prefixed: --color-primary (Salla), --brand, --wp--preset--color--primary
   (WordPress), --colors-accent. The suffix rule is what keeps out the shade and
   inverse variants that travel WITH a token and would poison it: on the store
   that motivated this, --color-primary-reverse is #cccccc (the text colour ON
   the brand) and --color-primary-light is a hover shade. Ending the match at
   the token name means those never register. Framework plumbing like
   --tw-text-opacity or --swiper-theme-color never matches either.

   AND THE NAME MUST BE ABOUT THE BRAND, NOT A ROLE THAT BORROWS THE WORD. The
   same store declares --store-text-primary 97 times: that is its primary TEXT
   colour, a near-black for paragraphs, and taking it as a brand vote made the
   accent a dark grey. A name mentioning text, font, bg, background, surface,
   shadow, border or outline is describing where a colour goes, not what the
   brand is, whatever it ends with.

   WHAT IS STILL REFUSED. A value that does not parse, and near-white (l > 0.94):
   a white primary would produce white buttons on a white storefront, and unlike
   black, white-as-brand gives the theme nothing to work with anywhere else. */
const DECLARED_TOKEN = /(?:^|-)(primary|brand|button|accent(?:-[123])?)$/;
const DECLARED_ROLE = /(?:^|-)(text|font|bg|background|surface|shadow|border|outline|link|icon)(?:-|$)/;

function declaredWeight(name) {
    const bare = name.replace(/^--/, '');
    if (DECLARED_ROLE.test(bare)) return 0;
    const match = DECLARED_TOKEN.exec(bare);
    if (!match) return 0;
    /* primary and brand are the site saying exactly what this is. button is the
       thing you press, which is what a brand colour is FOR, so it counts nearly
       as much: Shopify's Dawn family names its action colour --color-button and
       its palette --color-base-accent-1, and stores on it declare nothing called
       primary at all. */
    if (match[1] === 'primary' || match[1] === 'brand') return 3;
    if (match[1] === 'button') return 2;
    return 1;
}

/* A CSS FRAMEWORK'S UNTOUCHED DEFAULT IS NOT THE PROSPECT'S BRAND COLOUR.
   Added 8 August 2026, after a national denim retailer's demo came out in
   Bootstrap blue.

   That store loads nothing but bootstrap.min.css from its server. Bootstrap
   declares --bs-primary: #0d6efd and --bs-danger: #dc3545 in its own :root, the
   names match DECLARED_TOKEN exactly, and the declared channel weights a name
   ending in "primary" above all counted evidence. So the strongest signal this
   module has was pointing at a colour Bootstrap ships to every site that uses
   it, and the demo looked like the standard palette rather than like the
   prospect. It is worth being precise about the failure: it was not that the
   theme was missed, it was that a framework default outranked the evidence.

   THE TOKEN NAME CANNOT BE THE TEST, AND THIS IS THE WHOLE SUBTLETY. A store
   that customises Bootstrap sets $primary in its own SCSS, which compiles to
   --bs-primary carrying THEIR colour. Ignoring the namespace would throw away a
   real brand colour from every customised Bootstrap store, which is most of
   them. The value is what separates the two cases: --bs-primary at #0d6efd is
   Bootstrap untouched, and --bs-primary at anything else is a decision somebody
   made.

   SO ONLY THE EXACT SHIPPED DEFAULTS ARE REFUSED, and only for the token that
   ships them. Nothing else about the declared channel changes, and a store whose
   brand colour genuinely is Bootstrap blue is not left with nothing: the vote is
   dropped, the counted channel still sees the colour painted across the page,
   and it wins there on its own evidence instead of by assertion. */
const FRAMEWORK_DEFAULTS = {
    /* Bootstrap 5, from its own :root. The theme colours plus the named greys
       that most often end up in a token whose name matches DECLARED_TOKEN. */
    'bs-primary': ['#0d6efd'],
    'bs-secondary': ['#6c757d'],
    'bs-success': ['#198754'],
    'bs-danger': ['#dc3545'],
    'bs-warning': ['#ffc107'],
    'bs-info': ['#0dcaf0'],
    'bs-light': ['#f8f9fa'],
    'bs-dark': ['#212529'],
    'bs-blue': ['#0d6efd'],
    'bs-indigo': ['#6610f2'],
    'bs-purple': ['#6f42c1'],
    'bs-pink': ['#d63384'],
    'bs-red': ['#dc3545'],
    'bs-orange': ['#fd7e14'],
    'bs-yellow': ['#ffc107'],
    'bs-green': ['#198754'],
    'bs-teal': ['#20c997'],
    'bs-cyan': ['#0dcaf0'],
    /* Bootstrap 4, still in the field on plenty of stores. */
    'primary': ['#007bff'],
    'blue': ['#007bff']
};

export function isFrameworkDefault(name, hex) {
    if (!name || !hex) return false;
    const bare = String(name).replace(/^--/, '').toLowerCase();
    const defaults = FRAMEWORK_DEFAULTS[bare];
    return Boolean(defaults && defaults.includes(String(hex).toLowerCase()));
}

/* THE COUNTED CHANNEL NEEDS THE SAME GATE, AND FOR A SHARPER REASON. Blocking the
   declared vote was not enough: Bootstrap's stylesheet also paints those hexes
   across .btn-primary, .bg-primary, .text-primary, .border-primary and a dozen
   more, so a store serving an untouched bootstrap.min.css votes for #0d6efd
   dozens of times by frequency alone and wins the count. That is what the denim
   retailer's demo was blue from, even after the declared vote was refused.

   THE COST, STATED PLAINLY, BECAUSE IT IS NOT ZERO. A store whose brand really is
   one of these seven hexes loses its counted votes. #dc3545 is an ordinary red
   and some retailer genuinely uses it. What makes the trade acceptable is that
   the count is the WEAKEST of the three channels and the other two still see it:
   such a store almost always names the colour in a token of its own, which the
   declared channel accepts because the token is not in the table above, and the
   rendered channel sees it painted on the actual buttons. Losing a frequency vote
   is recoverable. Handing every Bootstrap store the same blue is not. */
/* TAILWIND'S STOCK PALETTE, REFUSED THE SAME WAY, added 11 August 2026 after a
   perfume house's demo shipped in blue-500 and orange-400 under Poppins. The
   vendor-filename rule above cannot catch Tailwind, because Tailwind is never
   served as its own file: it compiles into the store's app bundle, which is
   exactly the file the counted channel is right to read. So its famous defaults
   arrive by frequency wearing the store's own filename, and the only place to
   refuse them is by value, the same trade the Bootstrap table makes and for the
   same reason: losing a frequency vote is recoverable through the declared and
   rendered channels, and handing every Tailwind store the same blue is not.
   Only the core 400 to 600 shades are listed, the ones a stock utility class
   actually paints. */
const TAILWIND_STOCK = [
    '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd',
    '#ef4444', '#dc2626', '#f87171',
    '#f97316', '#fb923c', '#ea580c',
    '#f59e0b', '#fbbf24', '#d97706',
    '#22c55e', '#16a34a', '#4ade80',
    '#10b981', '#059669', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#38bdf8', '#0284c7',
    '#6366f1', '#4f46e5', '#818cf8',
    '#8b5cf6', '#7c3aed', '#a855f7', '#9333ea',
    '#d946ef', '#ec4899', '#db2777', '#f43f5e', '#e11d48'
];

const FRAMEWORK_VALUES = new Set(
    Object.values(FRAMEWORK_DEFAULTS).flat()
        .concat(TAILWIND_STOCK)
        .map((hex) => hex.toLowerCase()));

export function isFrameworkValue(hex) {
    return FRAMEWORK_VALUES.has(String(hex || '').toLowerCase());
}

/* A VENDOR FRAMEWORK'S STYLESHEET IS NOT THE STORE'S DESIGN LANGUAGE, AND THIS IS
   THE RULE THAT ENDS THE GAME THE TABLE ABOVE WAS LOSING.

   Refusing Bootstrap's seven theme colours by value worked, and then the counted
   channel returned #0a58ca, which is Bootstrap's own shade of the same blue and
   was not in the table. The next store would have found the tint. Enumerating a
   framework's palette is unwinnable: a framework ships dozens of derived values
   and any of them can be the most frequent colour in a file the store did not
   write.

   The structural answer is to stop reading the file. A stylesheet served as
   bootstrap.min.css tells you what Bootstrap looks like, which is a fact about
   Bootstrap. The store's own decisions are in the store's own CSS, in its inline
   style blocks, and, since 8 August 2026, in what its pages actually paint.

   WHAT THIS DOES NOT SKIP, deliberately. Inline <style> blocks and style
   attributes are always read, whatever they contain, because a store's own
   overrides live there and that is exactly where a customised framework's real
   colours end up. Nor does it skip a bundle with a project name in it: only
   filenames that ARE the distribution are matched, so app.css, main.css and
   theme.min.css are all read normally.

   THE COST. A store that customised Bootstrap by editing bootstrap.min.css in
   place loses that signal here. It is a rare way to work, and the rendered channel
   still sees the result painted on the page, so the colour is not lost, only the
   weakest of the three routes to it. The value table above stays as defence in
   depth for a framework served under a name this does not recognise. */
const VENDOR_STYLESHEET =
    /(^|\/)(bootstrap|tailwind|foundation|bulma|materialize|material-?(?:ui|design)|semantic(?:-ui)?|uikit|primer|normalize|reset|sanitize|milligram|skeleton|purecss|pure-min|spectre|animate)(\.min)?(\.[a-z0-9]+)*\.css(\?|$)/i;

export function isVendorStylesheet(href) {
    const path = String(href || '').split('#')[0];
    if (VENDOR_STYLESHEET.test(path)) return true;
    /* A framework served out of a directory named after itself, which is how the
       denim retailer serves it: /lib/bootstrap/bootstrap.min.css already matches
       above, but /lib/bootstrap/custom-build.css is the same vendor directory and
       is not the store's own design either. */
    return /\/(?:bootstrap|tailwind|foundation|bulma|materialize|semantic|uikit)\//i.test(path);
}

/* One gate for every declared source: parse, refuse near-white, then record.
   Shopify Dawn writes its tokens as bare RGB triplets, "18,18,18", which no CSS
   colour parser accepts, so they are read here explicitly. */
function addDeclared(declared, value, weight, name) {
    if (!declared || !weight) return;
    const text = String(value || '').trim();
    let rgb = null;
    const triplet = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/.exec(text);
    if (triplet) {
        const parts = [Number(triplet[1]), Number(triplet[2]), Number(triplet[3])];
        rgb = parts.every((n) => n <= 255) ? parts : null;
    } else {
        const token = text.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i);
        rgb = token ? parseColour(token[0]) : null;
    }
    if (!rgb || rgbToHsl(rgb).l > 0.94) return;
    const key = toHex(rgb);
    /* Checked here rather than at each call site, so every declared source is
       covered by one gate and a new source cannot forget it. */
    if (isFrameworkDefault(name, key)) return;
    declared.set(key, (declared.get(key) || 0) + weight);
}

function collect(css, colours, fonts, radii, declared) {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let rule;
    while ((rule = ruleRe.exec(css)) !== null) {
        const selector = rule[1].slice(-400);
        const body = rule[2];
        const selectorWeight = weightFor(SELECTOR_WEIGHTS, selector, 1);

        for (const declaration of body.split(';')) {
            const split = declaration.indexOf(':');
            if (split === -1) continue;
            const property = declaration.slice(0, split).trim().toLowerCase();
            const value = declaration.slice(split + 1).trim();
            if (!property || !value) continue;

            if (property === 'font-family') {
                /* Headings and body are tracked separately, because a site very
                   often sets a display face on one and a text face on the other. */
                const display = /h[1-6]|display|heading|title|hero/i.test(selector);
                fonts.push({ stack: value, display, weight: selectorWeight });
                continue;
            }

            if (property === 'border-radius' || property === 'border-top-left-radius') {
                const px = value.match(/(-?[0-9.]+)px/);
                if (px) {
                    const size = Number(px[1]);
                    /* A pill and a hairline are both real, and neither is a card
                       corner. 999px on a button says nothing about the theme. */
                    if (size >= 2 && size <= 28) {
                        radii.push({ size, weight: selectorWeight });
                    }
                }
                continue;
            }

            const propertyWeight = weightFor(PROPERTY_WEIGHTS, property, 0);
            if (!propertyWeight) continue;

            /* One declaration can hold several colours, as in a gradient or a
               shorthand border. All of them count. */
            const tokens = value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || [];

            /* The direct channel, before the grey filter: see DECLARED_TOKEN. The
               whole raw value goes in, because a Dawn triplet carries no token the
               regex above recognises. */
            if (declared && property.startsWith('--')) {
                addDeclared(declared, value, declaredWeight(property), property);
            }

            for (const token of tokens) {
                const rgb = parseColour(token);
                if (!rgb || !isBrandColour(rgb)) continue;
                const key = toHex(rgb);
                /* See isFrameworkValue: a framework's own palette is painted across
                   its utility classes, so counting it lets an untouched Bootstrap
                   outvote the store. */
                if (isFrameworkValue(key)) continue;
                colours.set(key, (colours.get(key) || 0) + propertyWeight * selectorWeight);
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Fonts                                                                      */

/* THE TEMPLATE HAS TO BE ABLE TO LOAD WHAT THIS PICKS, so the answer is one of a
   curated set rather than whatever the prospect uses. Each of these is a Google
   font with the weights the template asks for, so the stylesheet request cannot
   fail on a weight that does not exist.

   Matched by typographic class rather than by name: a prospect using Circular or
   Gotham gets Poppins, which is the point. Nothing here is a request for the
   prospect's licensed font. */
const FONTS = [
    { name: 'Playfair Display', test: /^(playfair|didot|bodoni|garamond|baskerville|canela|tiempos)/ },
    { name: 'Merriweather', test: /^(merriweather|georgia|times|charter|freight|noto serif|pt serif|serif)$|^(merriweather|georgia|times|charter|freight)/ },
    { name: 'Space Grotesk', test: /^(space grotesk|grotesk|monument|suisse|neue haas|helvetica now)/ },
    { name: 'Poppins', test: /^(poppins|circular|gotham|montserrat|futura|avenir|proxima|brandon|geometr)/ },
    { name: 'Sora', test: /^(sora|satoshi|general sans|cabinet)/ },
    { name: 'Work Sans', test: /^(work sans|open sans|lato|source sans|nunito|mulish|rubik|karla)/ },
    { name: 'IBM Plex Sans', test: /^(ibm plex|plex|jetbrains)/ },
    { name: 'DM Sans', test: /^(dm sans|graphik|inter|sf pro|-apple-system|system-ui|blinkmacsystemfont|segoe|roboto|arial|helvetica|sans-serif)/ }
];

const FONT_FALLBACK_DISPLAY = 'Sora';
const FONT_FALLBACK_BODY = 'Inter';

/* Inter is not in FONTS because it is the template's own default and mapping a
   site's Inter to Inter is the same answer either way. It still has to be a
   legal value, so it joins the loadable set here. */
export const LOADABLE = FONTS.map((font) => font.name).concat(['Inter']);

/* ONLY THE FIRST FAMILY IN THE STACK IS THE BRAND'S CHOICE. Everything after it
   is a fallback, and matching against the whole stack reads the fallbacks as
   intent. That produced two wrong answers on real sites at once: nearly every
   stylesheet ends a stack with `monospace`, which matched the IBM Plex pattern,
   and every stack ending `sans-serif` contains the substring `serif`, which
   matched the serif pattern. One site mapped to IBM Plex Sans while using
   neither IBM Plex nor a mono face anywhere.

   The patterns are anchored for the same reason. This is the same trap the
   artwork classifier paid for: a substring match inside a longer word is not a
   match. */
function firstFamily(stack) {
    const first = String(stack).split(',')[0] || '';
    return first.trim()
        .replace(/^["']|["']$/g, '')          /* quoted family names */
        .replace(/\s*!important\s*$/i, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/* Exported for factory/scrape/scrape.test.mjs. The two bugs this function has
   already had were both invisible until it was called directly with the stacks
   real sites publish, so it is reachable from a test rather than only through a
   network fetch. */
export function mapFont(stack) {
    const family = firstFamily(stack);
    if (!family || family.startsWith('var(')) return null;
    for (const font of FONTS) {
        if (font.test.test(family)) return font.name;
    }
    return null;
}

function pickFonts(fonts) {
    const score = (subset) => {
        const counts = new Map();
        for (const entry of subset) {
            const mapped = mapFont(entry.stack);
            if (!mapped) continue;
            counts.set(mapped, (counts.get(mapped) || 0) + entry.weight);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    };

    const display = score(fonts.filter((entry) => entry.display));
    const body = score(fonts.filter((entry) => !entry.display));

    return {
        displayFont: (display && display[0]) || (body && body[0]) || FONT_FALLBACK_DISPLAY,
        bodyFont: (body && body[0]) || FONT_FALLBACK_BODY
    };
}

/* -------------------------------------------------------------------------- */
/* Accessibility clamping                                                     */

/* Handoff 7.2: clamp to an accessible pair rather than shipping what the scrape
   found. A demo whose Add to cart button has white text on a pale yellow brand
   colour is unreadable on a projector, and that is where these are seen. */
const MIN_ON_PRIMARY = 4.5;

const WHITE = [255, 255, 255];

function darken(rgb, amount) {
    const { h, s, l } = rgbToHsl(rgb);
    return hslToRgb(h, s, clamp(l - amount, 0, 1));
}

/* Chooses the readable text colour for a brand colour, and darkens the brand
   colour itself if neither white nor near-black is readable on it. The colour is
   darkened rather than lightened because a demo's primary sits behind white text
   on buttons, and going lighter would need dark text, which then fails against
   the page. */
function resolveOnPrimary(primary, ink) {
    let colour = primary;
    for (let step = 0; step < 12; step++) {
        const onWhite = contrast(colour, WHITE);
        const onInk = contrast(colour, ink);
        if (onWhite >= MIN_ON_PRIMARY) return { primary: colour, onPrimary: toHex(WHITE) };
        if (onInk >= MIN_ON_PRIMARY) return { primary: colour, onPrimary: toHex(ink) };
        colour = darken(colour, 0.06);
    }
    /* Twelve steps of darkening always reaches contrast against white, so this is
       a guard rather than an expected outcome. */
    return { primary: colour, onPrimary: toHex(WHITE) };
}

/* -------------------------------------------------------------------------- */
/* The one entry point                                                        */

/* Returns a theme block, and a `found` record of what was genuinely extracted
   rather than defaulted, so the workflow can say so on the issue. */
export async function theme(origin, defaults, options) {
    const settings = options || {};
    const base = { ...defaults };
    const found = { primary: false, accent: false, fonts: false, radius: false };

    const home = await get(origin + '/', 'text/html');
    if (!home.ok) return { theme: base, found, reason: home.reason };

    const colours = new Map();
    const fonts = [];
    const radii = [];
    const declared = new Map();

    for (const css of inlineStyles(home.body)) collect(css, colours, fonts, radii, declared);
    for (const css of styleAttributes(home.body)) collect(css, colours, fonts, radii, declared);

    /* TWO MORE PLACES A SITE NAMES ITS OWN COLOUR, both standard and both cheap.
       The theme-color meta is what tints the browser chrome on a phone, and the
       web manifest's theme_color is its installable-app twin. Sites set them to
       the brand far more often than to anything else, near-white excepted, and
       addDeclared already refuses near-white. Weight 2: below a named primary
       token, above an accent, because a meta is occasionally set to a header
       tint rather than the brand itself. */
    for (const pattern of [
        /<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i
    ]) {
        const match = pattern.exec(home.body);
        if (match) { addDeclared(declared, match[1], 2); break; }
    }
    const manifestLink =
        /<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i.exec(home.body) ||
        /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']manifest["']/i.exec(home.body);
    if (manifestLink) {
        try {
            const manifest = await get(new URL(manifestLink[1], home.url).href, 'application/manifest+json');
            if (manifest.ok) {
                const parsed = JSON.parse(manifest.body);
                addDeclared(declared, parsed.theme_color, 2);
            }
        } catch (err) { /* a manifest that does not parse is not a theme signal */ }
    }

    const links = styleLinks(home.body, home.url)
        .filter((href) => !isVendorStylesheet(href))
        .slice(0, STYLESHEET_LIMIT);
    /* Sequential rather than parallel. Six stylesheets from one host in one burst
       is the shape that turns a readable site into a 429, and the whole scrape
       has a budget of minutes rather than seconds. */
    for (const link of links) {
        const sheet = await get(link, 'text/css');
        if (sheet.ok) collect(sheet.body, colours, fonts, radii, declared);
    }

    /* Declared tokens first, most-asserted first, then the counted ranking. A
       site that says --color-primary once has answered; a site that never says
       it is ranked exactly as before this channel existed. */
    const said = [...declared.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
    const counted = [...colours.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
    const ranked = said.concat(counted.filter((hex) => !said.includes(hex)));

    if (ranked.length) {
        const primary = parseHex(ranked[0]);
        const ink = parseHex(base.ink) || [20, 24, 27];
        const resolved = resolveOnPrimary(primary, ink);
        base.primary = resolved.primary === primary ? ranked[0] : toHex(resolved.primary);
        base.onPrimary = resolved.onPrimary;
        found.primary = true;
        /* WHICH CHANNEL DECIDED, carried to the issue comment, because "the
           colours look wrong" is a five second judgement for a person who can
           see the prospect's site and an impossible one for this code. A
           salesperson reading "declared by the site" versus "inferred from
           usage" knows exactly how much to trust the palette before the call. */
        found.primarySource = said.includes(ranked[0]) ? 'declared' : 'counted';

        /* The accent has to be a different hue, not a shade of the primary, or
           the two read as one colour and every "act on this" cue disappears.

           UNLESS THE PRIMARY HAS NO HUE. A declared black or charcoal brand sits
           at hue zero by convention, which is also where red lives, so the gap
           test would refuse a perfectly good red accent while accepting nothing
           better. Against an achromatic primary the accent's whole job is to be
           the one colourful thing on the page, so the bar moves from "different
           hue" to "actually colourful": a near-grey accent on a black brand
           marks nothing as special. */
        const primaryHsl = rgbToHsl(primary);
        const accent = ranked.slice(1).find((hex) => {
            const rgb = parseHex(hex);
            if (!rgb) return false;
            if (primaryHsl.s < 0.05) return rgbToHsl(rgb).s >= 0.35;
            const gap = Math.abs(rgbToHsl(rgb).h - primaryHsl.h);
            return Math.min(gap, 1 - gap) > 0.08;
        });
        if (accent) { base.accent = accent; found.accent = true; }
    }

    const picked = pickFonts(fonts);
    if (picked.displayFont !== FONT_FALLBACK_DISPLAY || picked.bodyFont !== FONT_FALLBACK_BODY) {
        found.fonts = true;
    }
    base.displayFont = picked.displayFont;
    base.bodyFont = picked.bodyFont;

    if (radii.length) {
        const weighted = new Map();
        for (const entry of radii) {
            weighted.set(entry.size, (weighted.get(entry.size) || 0) + entry.weight);
        }
        const best = [...weighted.entries()].sort((a, b) => b[1] - a[1])[0][0];
        base.radius = best + 'px';
        found.radius = true;
    }

    /* ---------------------------------------------------------------------- */
    /* The rendered channel, which outranks everything above when it answers    */

    /* WHY THIS RUNS LAST AND STILL WINS. Everything above reads the site as text
       and is correct about what the text says. A browser is correct about what
       the store looks like, which is the actual question, so where the two
       disagree the browser is right. It runs last only because it is the
       expensive one: a store the text channels read perfectly still gets its
       colours confirmed rather than assumed, and a store whose CSS is a
       framework's gets read properly for the first time.

       It is allowed to fail silently. No browser, a site that will not load, a
       page that paints nothing: the text answer above stands exactly as it did
       before this channel existed. */
    let rendered = null;
    if (settings.render !== false) {
        try {
            const { renderedTheme } = await import('./theme-rendered.mjs');
            const seen = await renderedTheme(origin, { settleMs: settings.settleMs });
            if (seen.ok) rendered = seen;
        } catch (err) { /* module absent or unusable: the text answer stands */ }
    }

    if (rendered) {
        found.rendered = true;
        applyRendered(base, found, rendered);
    }

    return { theme: base, found, colours: ranked.slice(0, 6), rendered };
}

/* THE NEUTRALS ARE NOW EXTRACTED, AND THIS REVERSES THE DECISION AT THE TOP OF
   THIS FILE. Salil's call, 8 August 2026, and handoff 7.2 is updated with it.

   The original reasoning was sound and is quoted here so the trade is visible: a
   scrape that guesses the neutrals wrong produces grey text on a grey card, which
   is worse than a demo whose greys are a shade off. That risk was real when the
   neutrals could only be guessed from text. It is much smaller when they are read
   from a rendered page, and the cost of not reading them turned out to be larger
   than expected: a prospect whose store is black got a white demo with a blue
   header, and the honest answer to "why does this not look like us" was "the
   factory never looks at your background". A palette that gets the brand colour
   right on the wrong ground does not read as themed.

   WHAT PROTECTS READABILITY IS MEASUREMENT, NOT AVOIDANCE. Every neutral is
   adopted as a SET or not at all, and only if the text on it clears the same
   contrast bar the rest of this module uses. A partial adoption is the one
   outcome that produces the grey-on-grey the original decision feared: a dark
   page with the template's dark ink is unreadable, and either page alone or ink
   alone can do that. So they move together or they do not move. */
const MIN_INK = 4.5;      /* body text on the ground it sits on */
const MIN_LINE = 1.25;    /* a hairline only has to be visible, not legible */

function applyRendered(base, found, seen) {
    /* The brand colour first, because the neutrals below are resolved against
       whatever it ends up being. A button the store actually paints outranks
       every text signal; a link colour is the weaker second source. */
    /* A FRAMEWORK DEFAULT IS REFUSED HERE TOO, because a gate on the other two
       channels means nothing if this one lets the same value back in. A store whose real storefront is a
       separately loaded micro frontend renders, for a plain browser, as close to
       unstyled Bootstrap: white page, #212529 text, and a .btn-primary still
       carrying #0d6efd. That blue is genuinely painted, so the rendered channel
       took it and handed back the exact colour the declared and counted channels
       had just been taught to refuse. A painted default is still a default.

       An unreadable store is then reported as unreadable, which is the honest
       outcome: found.primary stays false, the demo keeps the standard palette, and
       the issue comment says the colours could not be read rather than implying
       the prospect's own were used. */
    const painted = [seen.button, seen.link].find((hex) => {
        if (!hex) return false;
        const rgb = parseHex(hex);
        return rgb && isFrameworkValue(hex) === false && (isBrandColour(rgb) || veryDark(rgb));
    });
    if (painted) {
        base.primary = painted;
        found.primary = true;
        found.primarySource = painted === seen.button ? 'painted button' : 'painted link';
    }

    /* THE NEUTRALS, AS A SET. page, surface, ink and line together or none. */
    const page = seen.page ? parseHex(seen.page) : null;
    const ink = seen.ink ? parseHex(seen.ink) : null;
    if (page && ink) {
        /* A surface the store does not distinguish from its page is not a
           mistake, it is a flat design, so the page stands in for it. */
        const surface = (seen.surface ? parseHex(seen.surface) : null) || page;
        const readable = contrast(ink, page) >= MIN_INK && contrast(ink, surface) >= MIN_INK;
        if (readable) {
            base.page = toHex(page);
            base.surface = toHex(surface);
            base.ink = toHex(ink);

            /* muted is derived rather than read. It is the same hue as the ink,
               stepped toward the surface until it is quieter than body text but
               still legible, which is what it means on every storefront. A read
               value would be whatever the store used for one caption. */
            base.muted = toHex(towards(ink, surface, 0.38));

            /* A hairline is only adopted if it can be seen against the surface it
               divides. An invisible line makes a storefront look unfinished, and
               the template's own is never invisible. */
            const line = seen.line ? parseHex(seen.line) : null;
            base.line = line && contrast(line, surface) >= MIN_LINE
                ? toHex(line)
                : toHex(towards(surface, ink, 0.12));

            found.neutrals = true;
            found.dark = rgbToHsl(page).l < 0.5;

            /* onPrimary is now wrong: it was resolved against the template's ink
               on the template's surface. The brand colour has to be re-checked
               against the ground it will actually sit on, or a dark theme ships
               buttons whose label cannot be read. */
            const brand = parseHex(base.primary);
            if (brand) {
                const resolved = resolveLabel(brand, seen.buttonInk, ink);
                base.primary = toHex(resolved.primary);
                base.onPrimary = resolved.onPrimary;
            }
        }
    }

    /* Fonts and radius are confirmations rather than reversals: the text channels
       are reliable for both, so the rendered value is only taken where they found
       nothing. A family the template cannot load is mapped exactly as a declared
       one would be. */
    if (!found.fonts) {
        const display = mapFont(seen.displayFont);
        const body = mapFont(seen.bodyFont);
        if (display || body) {
            base.displayFont = display || body;
            base.bodyFont = body || display;
            found.fonts = true;
        }
    }
    if (!found.radius && seen.radius) {
        base.radius = seen.radius;
        found.radius = true;
    }
}

/* Near black, which isBrandColour refuses and which a monochrome brand means. The
   same threshold the rendered reader uses for a colourless button, kept in step
   with it deliberately: one of the two rejecting what the other accepts would let
   a black brand through the browser and then drop it here. */
function veryDark(rgb) {
    return rgbToHsl(rgb).l < 0.12;
}

/* A step from one colour toward another, per channel. Used for muted and for a
   fallback hairline, both of which are "the same colour, quieter". */
function towards(from, to, amount) {
    return from.map((channel, index) =>
        Math.round(channel + (to[index] - channel) * amount));
}

/* WHAT COLOUR THE BUTTON LABEL IS, AND WHY resolveOnPrimary IS NOT ENOUGH HERE.
   Added 8 August 2026 with the rendered channel.

   resolveOnPrimary tries white, then the page's own text colour, and darkens the
   brand until one of them works. That is right for a light theme, where those two
   candidates are white and near-black. On a DARK theme the page's text colour is
   also near-white, so both candidates are light, and a bright brand colour gets
   darkened step after step until white finally reads on it. A store's yellow
   ships as brown, and the demo looks nothing like them.

   THE STORE ALREADY ANSWERED THE QUESTION. It painted a label on that button, and
   whatever colour it used is by definition the one its designer chose for exactly
   this. So that is tried first and kept whenever it clears the bar. Only if the
   store gave no answer, or gave an unreadable one, does this fall back to trying
   black and white before touching the brand colour at all. Darkening stays the
   last resort rather than the second. */
function resolveLabel(brand, storeLabel, ink) {
    const candidates = [];
    const said = storeLabel ? parseHex(storeLabel) : null;
    if (said) candidates.push(said);
    /* Black and white before the page's ink, because on either kind of theme one
       of the two is correct and neither needs the brand colour changed. */
    candidates.push([0, 0, 0], WHITE);
    if (ink) candidates.push(ink);

    for (const candidate of candidates) {
        if (contrast(brand, candidate) >= MIN_ON_PRIMARY) {
            return { primary: brand, onPrimary: toHex(candidate) };
        }
    }
    /* Nothing reads on it as it stands, which means a mid tone brand. Fall back to
       the existing darkening walk, which is guaranteed to reach contrast. */
    return resolveOnPrimary(brand, ink || [20, 24, 27]);
}
