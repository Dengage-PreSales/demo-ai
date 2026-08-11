/* ============================================================================
   The catalogue: the tiers, tried in order, and the category structure.

   Handoff 7.1 and 7.1a.

     1. Shopify. <store>/products.json, unauthenticated, on most Shopify stores.
     2. WooCommerce. The Store API at /wp-json/wc/store/v1/products, which is
        public on every WooCommerce store that has not gone out of its way to
        close it, and answers in one request like Shopify does.
     3. JSON-LD. robots.txt, then the sitemap, then structured product markup on
        the product pages: JSON-LD first, then microdata, then OpenGraph meta
        tags, in that order per page and never more than one of them per page.
     4. Render. A headless browser for stores whose markup only exists after
        JavaScript runs. The module lives in render.mjs and is loaded lazily, so
        this file works whether or not it exists yet.
     5. CSV. Only when everything above fails.

   THE RULE THAT SHAPES EVERY MAPPER IN THIS FILE. Never fabricate a number to
   fill a column (CLAUDE.md 3.5). Number(null) is 0 in JavaScript, and 0 in
   stock_count announces a product out of stock, which poisons every
   back-in-stock segment built on it. So an unknown price is null and an unknown
   stock count is absent, and the two are never confused with zero.

   That rule bites hardest on stock, and the shape of the Shopify feed is why.
   The public products.json carries `available`, a boolean, and not
   `inventory_quantity`. So:

     available: false  ->  stockCount 0.   Out of stock is a fact.
     available: true   ->  stockCount null. In stock is a fact, the COUNT is not.

   Writing 1, or 10, or 99 for the second case would be inventing a number the
   scrape never produced, and the storefront would then say "Only 10 left" about
   a product nobody counted.

   NO IMAGES ARE DOWNLOADED HERE, BUT THEIR ADDRESSES ARE KEPT. Every product
   carries two fields that look alike and are not:

     imageUrl  what the store said its product photo is. An absolute https URL
               or null, never http, never a data URI, and never invented. The
               downloader turns it into a compressed, committed local file,
               which is what non-negotiable 4 requires: a demo must never load
               an asset from a third party at runtime.
     image     the committed local file, which does not exist at scrape time,
               so every tier writes null and only the downloader fills it in.

   This file records addresses and fetches none of them, so the scrape still has
   no large downloads in it at all.
   ========================================================================== */

import { get, getJson, getStream, robots, REASON } from './fetch.mjs';
import { generatedCatalogue } from './fallback.mjs';
import { readFileSync } from 'node:fs';

/* Handoff 7.1. Not a performance limit: at roughly 5 to 7 demos a month with 90
   day retention there are about 20 live at a time, and the cap is what keeps the
   repository settling under 100MB rather than growing without limit. Raising it
   is a joint decision rather than a tweak. */
export const PRODUCT_CAP = 30;

/* The site header has no horizontal slack. A prospect with fourteen top level
   categories breaks the layout, so the largest few by product count become the
   navigation and the rest are grouped. Handoff 7.1a. */
export const CATEGORY_CAP = 5;

/* FEWER THAN THIS IS NOT A STOREFRONT, so a tier that finds fewer has not really
   succeeded and the next one is tried.

   One real store blocked its product feed and fell through to its product pages,
   which yielded three products. That built without error and was worse than a
   clean failure: a grid of three, rails holding one item each, filters with
   nothing to filter, and a salesperson discovering all of it on the call. The
   honest answer at that point is to ask for the CSV, which is why the issue form
   asks for 20 to 30 products when it comes to that. */
export const PRODUCT_FLOOR = 8;

/* -------------------------------------------------------------------------- */
/* Shared normalisation                                                       */

/* THIS FUNCTION IS THE Number(null) TRAP, AND IT HAD IT.

   The first version stripped every character that is not a digit, a dot or a
   minus and handed the result to Number. For the text "yes" in a stock column
   that strips to the empty string, and Number('') is 0, not NaN. So a stock
   column containing a word announced every product out of stock: the exact
   failure the whole of this file is written to prevent, reintroduced by the
   sanitising step meant to make it safe.

   It also read European prices wrongly rather than refusing them. "1.299,00" is
   one thousand two hundred and ninety nine, and stripping the comma left
   "1.299", so a demo would have priced it at 1.30. A wrong number is worse than
   no number, because nothing downstream can tell it is wrong. */
function num(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    let text = String(value).trim();
    if (!text) return null;

    /* Keep only what can be part of a number, then require that something was
       actually left, rather than letting the empty string become zero. */
    text = text.replace(/[^0-9.,-]/g, '');
    if (!/[0-9]/.test(text)) return null;

    /* WHICH SEPARATOR IS THE DECIMAL POINT. Both conventions appear in real
       exports, and the last separator in the string is the decimal one in both:

         1.299,00   comma last   ->  1299.00
         1,299.00   dot last     ->  1299.00
         1299,00    comma only   ->  1299.00   two digits after it
         1.299      dot only     ->  1.299     ambiguous, left as written

       The only genuinely ambiguous case is a single separator with exactly three
       digits after it, which is a thousands separator far more often than a
       three decimal price, so it is read that way. */
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
        const decimal = lastComma > lastDot ? ',' : '.';
        const thousands = decimal === ',' ? '.' : ',';
        text = text.split(thousands).join('');
        text = text.replace(decimal, '.');
    } else if (lastComma !== -1) {
        const after = text.length - lastComma - 1;
        text = after === 3 ? text.split(',').join('') : text.replace(',', '.');
    } else if (lastDot !== -1) {
        const after = text.length - lastDot - 1;
        if (after === 3 && text.indexOf('.') !== text.lastIndexOf('.')) {
            text = text.split('.').join('');
        }
    }

    const n = Number(text);
    return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/* Text arriving from someone else's website                                  */

/* Enough named entities to cover what a product title actually contains. A full
   table would be dead weight: the numeric forms below handle everything else. */
const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    lsquo: "'", rsquo: "'", sbquo: "'", ldquo: '"', rdquo: '"', bdquo: '"',
    hellip: '...', middot: '.', bull: '.', deg: ' degrees',
    trade: '(TM)', reg: '(R)', copy: '(C)',
    /* Both dashes decode to a plain hyphen rather than to the character they
       name. See normaliseDashes below for why that is not a shortcut. */
    ndash: '-', mdash: '-', minus: '-', shy: '', times: 'x'
};

function decodeEntities(text) {
    return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);?/gi, (match, body) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X'
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            if (!Number.isFinite(code) || code < 32 || code > 0x10ffff) return '';
            try { return String.fromCodePoint(code); } catch (err) { return ''; }
        }
        const named = ENTITIES[body.toLowerCase()];
        return named === undefined ? match : named;
    });
}

/* EVERY DASH BECOMES A HYPHEN, AND THIS ONE IS LOAD BEARING.

   CLAUDE.md 3.10 forbids em and en dashes in committed text, and the guard
   enforces it by scanning raw UTF-8 bytes across every committed file including
   .json. A generated demo's products.json is committed, so a prospect whose
   product names read "Jacket, Navy" with an em dash would fail the guard, and the
   build workflow runs the guard before it publishes. The demo would not merely
   look odd: it would not build at all.

   That is not a hypothetical spelling. Retailers use em dashes in titles
   constantly, and a rule about this repository's own prose would otherwise decide
   which prospects can have a demo. */
function normaliseDashes(text) {
    return text.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043\ufe58\ufe63\uff0d]/g, '-');
}

/* Product titles arrive as HTML, from a feed that was written for a browser. So
   they carry entities, they sometimes carry tags, and once in a while they carry
   a whole script element. Nothing here is a security boundary, because the
   storefront escapes on render; what this prevents is a tile captioned
   "Jack &amp; Jones" or "<b>Bold</b> Hoodie" on a sales call. */
const MAX_TEXT = 120;

function clean(text) {
    if (text === null || text === undefined) return '';
    let out = String(text);
    /* Tags first: a comment or a script body would otherwise survive as text. */
    out = out.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
    out = out.replace(/<!--[\s\S]*?-->/g, ' ');
    out = out.replace(/<[^>]*>/g, ' ');
    /* Then entities, and only once. Decoding twice is how "&amp;lt;" becomes a
       real angle bracket, which is the classic double decode mistake. */
    out = decodeEntities(out);
    /* Any tag that arrived encoded is now literal text. It is removed rather than
       decoded again, so nothing can round trip into markup. */
    out = out.replace(/<[^>]*>/g, ' ');
    out = normaliseDashes(out);
    /* Control characters, including the zero width and direction marks that
       arrive with right to left text and are invisible in a diff. */
    out = out.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\ufeff]/g, '');
    out = out.replace(/\s+/g, ' ').trim();
    return out.length > MAX_TEXT ? out.slice(0, MAX_TEXT).trim() : out;
}

/* Product ids reach Dengage as product_id and are segmented on, so they have to
   be stable and readable. A real SKU is both; a database row id is neither. */
/* A stable 32 bit hash, used only as the last resort below. */
function hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36).toUpperCase();
}

/* A NON LATIN CATALOGUE MUST NOT LOSE ITS PRODUCTS, and the first version of this
   silently did. Stripping everything outside A to Z leaves nothing at all of an
   Arabic or Chinese title, so a product with no SKU was dropped: a whole store's
   catalogue, minus every item whose feed happened to omit one. Dengage sells into
   Turkish and Arabic speaking markets, so this is the normal case rather than an
   edge one.

   The order is deliberate. A real SKU is preferred because it is what a prospect
   recognises and what segmentation in the panel will key on. Only when nothing
   usable survives does a hash of the original text stand in: readable ids are
   nicer, but a missing product is worse than an opaque id.

   Turkish is worth naming: "Şort" uppercases to "ŞORT" and the S with a cedilla
   is not in A to Z, so the result is "ORT". Mangled but stable and unique enough
   to be a key, which is all this has to be. */
function productId(candidates) {
    for (const candidate of candidates) {
        const source = clean(candidate);
        if (!source) continue;
        const text = source.toUpperCase().replace(/[^A-Z0-9._-]+/g, '-')
            .replace(/^[-.]+|[-.]+$/g, '');
        if (text.length >= 3 && text.length <= 48) return text;
        /* Something was there but nothing survived the stripping, or too little
           did. Keep the product and give it an id derived from what it really
           said, so it stays stable across rebuilds. */
        if (source.length >= 2) return 'P-' + hash(source);
    }
    return null;
}

/* price is what it was, discountedPrice is what it is now, and a discount only
   exists when the second is genuinely lower. js/catalog.js enforces the same
   thing again downstream, deliberately: a hand-edited catalogue can reintroduce
   what a scrape got right. */
/* A PRICE THAT IS NOT POSITIVE IS NOT A PRICE. Zero and negative both arrive from
   real feeds, from placeholder rows and from "call for pricing" items, and both
   are indistinguishable downstream from a price that was read wrongly. The
   smoke test refuses a catalogue containing one, so shipping it would fail the
   build rather than produce a bad demo, but the right place to stop it is here.

   An absurd figure is refused too. A feed that reports a price in minor units, or
   carries a sentinel like 99999999, produces a storefront where one tile is nine
   digits wide and the layout breaks around it. */
const MAX_PRICE = 1000000;

function positivePrice(value) {
    const n = num(value);
    if (n === null || !(n > 0) || n > MAX_PRICE) return null;
    /* Two decimal places. A feed carrying a computed price can report
       19.989999999999998, and that renders as written. */
    return Math.round(n * 100) / 100;
}

function prices(current, was) {
    const now = positivePrice(current);
    const before = positivePrice(was);
    if (now === null) return { price: null, discountedPrice: null };
    if (before !== null && before > now) return { price: before, discountedPrice: now };
    return { price: now, discountedPrice: null };
}

/* Whole units, never negative. A feed reporting -5 or 2.7 is reporting something
   this cannot use, and both would fail the smoke test's own assertion, so they
   become "unknown" rather than a number nobody can act on. Zero survives, because
   out of stock is a fact. */
function stock(value) {
    const n = num(value);
    if (n === null || !Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
}

/* EVERY imageUrl IN A CATALOGUE PASSES THROUGH HERE, whichever tier found it.

   The downloader fetches whatever this returns and commits the bytes, so the
   contract is strict and the same in every tier: an absolute https URL or null.
   Never http, because the fetch happens later from a runner and a mixed-content
   address is one more way for it to fail after the scrape said it worked. Never
   a data URI or a javascript: URL, because a value that is not an address does
   not become one by being stored. And never invented: no candidate means null,
   and the demo draws its own artwork for that product instead.

   A relative path is resolved against the page it was found on, because that is
   what a browser would have done with it, and a protocol relative //cdn... one
   resolves the same way. Both come out https or they come out null. */
function httpsImage(value, baseUrl) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return null;
    let resolved;
    try { resolved = baseUrl ? new URL(text, baseUrl) : new URL(text); }
    catch (err) { return null; }
    if (resolved.protocol !== 'https:') return null;
    return resolved.href;
}

/* -------------------------------------------------------------------------- */
/* Tier 1: Shopify                                                            */

/* Shopify serves this on the storefront domain with no key. limit is capped at
   250 by the platform, and one page is far more than the 30 that ship. */
async function shopify(origin) {
    const result = await getJson(origin + '/products.json?limit=250');
    if (!result.ok) return { ok: false, reason: result.reason, tier: 'shopify' };
    const raw = result.data && result.data.products;
    if (!Array.isArray(raw) || !raw.length) {
        return { ok: false, reason: REASON.NOT_FOUND, tier: 'shopify' };
    }

    const products = [];
    for (const item of raw) {
        const variants = item.variants || [];
        if (!variants.length) continue;

        /* THE PRODUCT IS OUT OF STOCK ONLY IF NO VARIANT IS AVAILABLE, and
           reading variants[0] instead gets this wrong in both directions. A
           clothing feed lists sizes in order, and the smallest size is very often
           the one that sold out first: taking the first variant reported products
           out of stock that had twelve sizes on the shelf.

           So availability is any-of, and the variant that supplies the PRICE is
           an available one where there is one. A sold out variant can carry a
           stale or clearance price that the product page no longer shows. */
        const sellable = variants.filter((variant) => variant.available !== false);
        const priceFrom = sellable[0] || variants[0];

        const id = productId([priceFrom.sku, item.handle, item.id]);
        const name = clean(item.title);
        if (!id || !name) continue;

        const { price, discountedPrice } = prices(priceFrom.price, priceFrom.compare_at_price);
        /* A product with no readable price is dropped rather than shipped with a
           null one: unit_price is required on ec:addToCart, so there is no "omit
           the column" available downstream. */
        if (price === null) continue;

        products.push({
            id,
            name,
            category: clean(item.product_type),
            price,
            discountedPrice,
            /* See the header. No variant available is a fact. Some variant
               available is also a fact, but it is not a COUNT, so it stays null. */
            stockCount: sellable.length ? null : 0,
            attributes: shopifyAttributes(item, priceFrom),
            image: null,
            /* The feed's first image is the one the store leads with. Shopify
               serves its CDN over https, so this normally survives as is; a
               protocol relative src resolves against the store's origin. */
            imageUrl: httpsImage(item.images && item.images[0] && item.images[0].src, origin)
        });
        if (products.length >= PRODUCT_CAP * 3) break;   /* room for category balancing */
    }

    if (!products.length) return { ok: false, reason: REASON.NOT_FOUND, tier: 'shopify' };
    return { ok: true, tier: 'shopify', products, currency: await shopifyCurrency(origin) };
}

/* SHOPIFY'S PUBLIC products.json CARRIES NO CURRENCY.
   Prices arrive as bare numbers, so a store pricing in rupees is indistinguishable
   from one pricing in dollars by the feed alone. This tier used to return null,
   currencyBlock reads null as USD, and so every Shopify demo priced itself in
   dollars: a 19,500 rupee jacket shipped to a live demo reading $19,500, which is
   the most expensive kind of wrong because the prospect knows their own prices.

   The storefront page does carry it, in the object Shopify writes for its own
   scripts. Read it from there. On failure return null rather than a guess: null
   still means USD downstream, but --currency overrides it and the report prints
   what was used either way, so a wrong answer stays visible instead of silent.

   The jsonld tier already reads priceCurrency per offer, and the csv tier
   genuinely has nowhere to read one from, so this was the only gap. */
async function shopifyCurrency(origin) {
    const page = await get(origin + '/');
    if (!page.ok || !page.body) return null;
    const active = /Shopify\.currency\s*=\s*\{[^}]*?["']active["']\s*:\s*["']([A-Za-z]{3})["']/
        .exec(page.body);
    if (active) return active[1].toUpperCase();
    const plain = /["']currency["']\s*:\s*["']([A-Za-z]{3})["']/.exec(page.body);
    return plain ? plain[1].toUpperCase() : null;
}

/* Shopify names its option axes in `options` and gives the chosen value per
   variant in option1..3. Junk names are skipped: a store that calls an axis
   "Title" with the value "Default Title" is telling us it has no options. */
function shopifyAttributes(item, variant) {
    const out = {};
    const names = (item.options || []).map((option) => clean(option.name));
    const values = [variant.option1, variant.option2, variant.option3];
    names.forEach((name, index) => {
        const value = clean(values[index]);
        if (!name || !value) return;
        if (/^title$/i.test(name) && /^default title$/i.test(value)) return;
        out[name] = value;
    });
    if (clean(item.vendor)) out.Brand = clean(item.vendor);
    return out;
}

/* -------------------------------------------------------------------------- */
/* Tier 2: the WooCommerce Store API                                          */

/* WooCommerce ships a public, unauthenticated JSON API for its own storefront
   blocks, and it is on by default: /wp-json/wc/store/v1/products. Before it,
   WooCommerce demos went the long way round through the sitemap and structured
   markup, which works but reads forty pages to answer what this answers in one
   request, and fails entirely on a theme that renders its markup with
   JavaScript.

   THE PRICES ARE STRINGS IN MINOR UNITS, AND THAT IS THE TRAP THIS TIER IS
   BUILT AROUND. The API reports price "1999" with currency_minor_unit 2 for a
   product costing 19.99. Handing that string to prices() without dividing ships
   a price one hundred times too large, which renders perfectly and is the most
   expensive kind of wrong because the prospect knows their own prices. So every
   amount is divided by 10^currency_minor_unit before the shared helpers see it,
   and the exponent is read strictly: a payload that does not carry a genuine
   minor unit is not the Store API's documented shape, and guessing 2 would be
   inventing the divisor that decides every price. Number(null) is 0, and a null
   minor unit read loosely divides by 10^0, which is exactly the 100x bug again
   arriving through the meta field instead of the price. */
function wooMinorUnit(value) {
    const n = typeof value === 'number' ? value
        : (typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : null);
    return Number.isInteger(n) && n >= 0 && n <= 8 ? n : null;
}

function wooAmount(value, exponent) {
    if (value === null || value === undefined || value === '') return null;
    const n = num(value);
    if (n === null) return null;
    return n / Math.pow(10, exponent);
}

/* The mapping alone, exported so the tests can feed it fixtures without a
   server. raw is the API's response body, origin is only a base for resolving
   an image address. */
export function wooFromApi(raw, origin) {
    if (!Array.isArray(raw) || !raw.length) {
        return { ok: false, reason: REASON.NOT_FOUND, tier: 'woocommerce' };
    }

    const products = [];
    const currencies = [];
    for (const item of raw) {
        const name = clean(item.name);
        const id = productId([item.sku, item.slug, item.id]);
        if (!name || !id) continue;

        const quoted = item.prices || {};
        const exponent = wooMinorUnit(quoted.currency_minor_unit);
        /* No genuine minor unit means no readable price. See the header: a
           guessed divisor is the 100x bug, so the product is dropped instead. */
        if (exponent === null) continue;

        /* `price` is what the store charges today, sale or not, and
           `regular_price` is what it was, which is exactly the (now, was) pair
           the shared discount logic wants. prices() then decides whether the
           difference is genuinely a discount. */
        const { price, discountedPrice } = prices(
            wooAmount(quoted.price !== undefined ? quoted.price : quoted.sale_price, exponent),
            wooAmount(quoted.regular_price, exponent));
        if (price === null) continue;

        if (clean(quoted.currency_code)) currencies.push(clean(quoted.currency_code).toUpperCase());

        products.push({
            id, name,
            category: Array.isArray(item.categories) && item.categories[0]
                ? clean(item.categories[0].name) : '',
            price, discountedPrice,
            /* ONLY A NUMERIC stock_quantity IS A COUNT. The API also carries
               is_in_stock, a boolean, and a boolean is not a number: reading
               true as anything at all would put a figure on a shelf nobody
               counted, which is the rule at the top of this file. */
            stockCount: typeof item.stock_quantity === 'number' || typeof item.stock_quantity === 'string'
                ? stock(item.stock_quantity) : null,
            attributes: {},
            image: null,
            imageUrl: httpsImage(item.images && item.images[0] && item.images[0].src, origin)
        });
        if (products.length >= PRODUCT_CAP * 3) break;   /* room for category balancing */
    }

    if (!products.length) return { ok: false, reason: REASON.NOT_FOUND, tier: 'woocommerce' };
    return { ok: true, tier: 'woocommerce', products, currency: mode(currencies) };
}

/* Older WooCommerce installs serve the same API without the /v1 segment, so a
   miss on the current route tries the unversioned one before giving up. Only a
   miss: a block or a network failure is an answer about the site rather than
   about the route, and asking a second path will not change it. */
export async function woocommerce(origin) {
    let result = await getJson(origin + '/wp-json/wc/store/v1/products?per_page=100');
    if (!result.ok && (result.reason === REASON.NOT_FOUND || result.reason === REASON.WRONG_TYPE)) {
        result = await getJson(origin + '/wp-json/wc/store/products?per_page=100');
    }
    if (!result.ok) return { ok: false, reason: result.reason, tier: 'woocommerce' };
    return wooFromApi(result.data, origin);
}

/* -------------------------------------------------------------------------- */
/* Tier 3: structured markup via the sitemap                                  */

/* Every serious ecommerce site emits schema.org/Product for Google, which makes
   this the tier that covers Magento, WooCommerce, BigCommerce and custom builds.
   The route in is robots.txt, then the sitemap, then the product pages. */
const SITEMAP_FANOUT = 6;      /* nested sitemaps to open out of an index */
/* HOW MANY PAGES ARE READ, AND WHY 40 WAS TOO FEW FOR A PRODUCT-PAGE STORE.
   Raised to 90 on 8 August 2026.

   Stores fall into two shapes and the old number only suited one. A category
   page carries sixteen products, so forty of them is far more than a thirty
   product demo needs. A product page carries one, so forty of those is a demo
   that ships fewer than thirty and no way to tell from the outcome: an apparel
   retailer whose sitemap is all product pages came back with nine.

   RAISING IT COSTS ALMOST NOTHING ON THE STORES THAT DID NOT NEED IT, because
   the tier stops as soon as it holds PRODUCT_CAP * 2 distinct names. A store
   serving sixteen products a page reaches that inside four reads and never sees
   the rest of the budget. The extra pages are only ever read by the stores that
   would otherwise ship a thin demo, which is exactly where the time belongs.
   Measured at five concurrent reads: forty pages was about 17 seconds. */
const PAGE_FANOUT = 90;        /* product pages to read */
const PAGE_CONCURRENCY = 5;    /* polite: a prospect's site is not a load target */

/* HOW MUCH OF A SITEMAP IS READ, AND WHY THE OLD ANSWER BIASED EVERY LARGE SITE.
   Raised from six times the page fanout to two hundred times, 8 August 2026.

   A sitemap is sorted by URL, so stopping after the first 240 entries does not
   take a sample of a store, it takes the alphabetical head of one. Measured on a
   regional eyewear retailer: 7043 URLs across 139 sections, of which the first
   240 held two brand collections and no category page at all. Every page the
   tier then read came from those two collections, so a store selling glasses,
   sunglasses and contact lenses produced a thirty product demo from one brand's
   summer edit. Nothing downstream can recover from that, because the sections
   that matter were never in the candidate list to choose from.

   The original worry behind the low number is real and unchanged: a national
   retailer can serve an 8MB locale sitemap and the protocol permits 50MB. This
   is why the read is still streamed and still stops early. What changed is where
   it stops. That whole sitemap was 1.31MB and took 1.1s to read in full, which is
   the actual cost of the thing the old limit was avoiding, and it bought a demo
   that misrepresented the store. Eight thousand entries is roughly 1.5MB at
   observed density, so an ordinary large sitemap is now read whole and a
   pathological one still stops, with MAX_BYTES in fetch.mjs as the hard backstop
   underneath. */
const LOC_TARGET = PAGE_FANOUT * 200;

function xmlTags(xml, tag) {
    const out = [];
    const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
    let match;
    while ((match = re.exec(xml)) !== null) out.push(match[1].trim());
    return out;
}

function sitemapUrls(xml) {
    return xmlTags(xml, 'loc')
        .map((loc) => clean(loc.replace(/^<!\[CDATA\[|\]\]>$/g, '')))
        .filter(Boolean);
}

/* A path that looks like a product page. Used only to prioritise, never to
   exclude: if the guesses find nothing the whole list is read instead, because
   plenty of stores put products at the root. */
/* The /p\d+ shape is how Salla addresses a product page: /en/<slug>/p1533516573.
   Added 11 August 2026, from a store where the OLD rule matched exactly the
   wrong things: its real products all ended in /p<digits>, which nothing here
   recognised, while its static pages sat under /p/ (about, contact, terms in
   twelve languages), which the segment rule matched enthusiastically. The
   reader spent its whole budget on about pages and the demo shipped stand-ins
   for a store whose catalogue was one URL pattern away. */
function looksLikeProduct(url) {
    return /\/(product|products|p|item|items|shop|dp)\//i.test(url) ||
           /-p-\d+/i.test(url) ||
           /\/p\d+\/?$/i.test(url);
}

/* Reads only as much of a sitemap as it takes to collect LOC_TARGET entries.
   An index is detected from the opening tag, which arrives in the first chunk. */
async function readSitemap(url) {
    let count = 0;
    const result = await getStream(url, 'application/xml', (text) => {
        /* Counting on every chunk rather than re-scanning the whole string each
           time would be nicer; at this size the simple version is not the cost. */
        count = (text.match(/<loc>/gi) || []).length;
        return count >= LOC_TARGET;
    });
    if (!result.ok) return null;
    return { isIndex: /<sitemapindex/i.test(result.body), urls: sitemapUrls(result.body) };
}

async function sitemapProductUrls(origin) {
    const parsed = await robots(origin);
    const roots = parsed.sitemaps.length ? parsed.sitemaps : [origin + '/sitemap.xml'];

    const seen = new Set();
    const candidates = [];
    const queue = roots.slice(0, SITEMAP_FANOUT + 1);

    while (queue.length && candidates.length < LOC_TARGET) {
        const next = queue.shift();
        if (!next || seen.has(next)) continue;
        seen.add(next);

        const result = await readSitemap(next);
        if (!result) continue;

        /* A sitemap index points at more sitemaps. Product ones are opened first
           where the name says so, because a large retailer's index can hold two
           thousand entries and only some of them are products. */
        if (result.isIndex) {
            const nested = result.urls
                .slice()
                .sort((a, b) => scoreSitemap(b) - scoreSitemap(a));
            for (const child of nested.slice(0, SITEMAP_FANOUT)) {
                if (!seen.has(child)) queue.push(child);
            }
            continue;
        }
        candidates.push(...result.urls);
    }

    const likely = candidates.filter(looksLikeProduct);
    const pool = oneUrlPerProduct(preferEnglish(likely.length ? likely : candidates));
    return spreadBySection(pool).slice(0, PAGE_FANOUT);
}

/* PREFER ENGLISH ONE LEVEL DOWN FROM WHERE IT ALREADY LIVES. scoreSitemap has
   preferred an en sitemap over an Estonian one since the multilanguage index
   that motivated it, but a store that mixes every locale into ONE sitemap
   never passes through that choice: its URL list arrives here with the same
   product twelve times, /ar/ first because the file leads with it, and
   oneUrlPerProduct keeps the first spelling it sees. The demo then reads the
   Arabic pages and ships Arabic product names under English page copy.

   The preference only acts when it clearly applies: an en locale segment must
   exist in the list, and most of the list must be locale prefixed at all.
   Anything else passes through untouched, so a store with no locales, or
   without an English one, behaves exactly as before. */
function preferEnglish(urls) {
    const EN = /\/en(?:[-_][a-z]{2,3})?\//i;
    const english = urls.filter((url) => EN.test(url));
    if (!english.length) return urls;

    let localised = 0;
    for (const url of urls) {
        let path;
        try { path = new URL(url).pathname; } catch (err) { continue; }
        const head = path.split('/').filter(Boolean)[0] || '';
        if (LOCALE_SEGMENT.test(head)) localised++;
    }
    return localised >= urls.length / 2 ? english : urls;
}

/* ONE STORE LISTED EVERY PRODUCT AT FOUR ADDRESSES, AND THE READ SPENT ITS WHOLE
   BUDGET ON TEN OF THEM. Added 8 August 2026.

   A large apparel retailer publishes each garment under every category path it
   belongs to. The sitemap holds 8776 URLs and they are not 8776 products:

     /men/bottomwear/comfort-blue-8905409710920
     /men/jeans/comfort-blue-8905409710920
     /men/comfort/comfort-blue-8905409710920
     /men/collections/comfort-blue-8905409710920

   Four addresses, one garment, one barcode. The tier reads a fixed number of
   pages, so forty reads returned forty rows that folded to nine products, and a
   demo asked for thirty shipped nine. Nothing was broken and nothing reported a
   problem: the pages were read correctly and the duplicates were collapsed
   correctly, several steps too late to matter.

   The last path segment is the product's own identity on every store shaped this
   way, so it is what the pool is deduped by. FIRST SEEN WINS, which keeps the
   sitemap's own order and therefore keeps spreadBySection's spread meaningful.

   IT CANNOT COLLAPSE TWO REAL PRODUCTS. A store where distinct products share a
   final segment would need the same slug twice under different parents, and the
   segment is what the store's own routing uses to tell them apart. Where a store
   has no such duplication, every segment is unique and this is an identity
   function that costs one pass over a list. */
function oneUrlPerProduct(urls) {
    const seen = new Set();
    const out = [];
    for (const url of urls) {
        let key = url;
        try {
            const segments = new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
            if (segments.length) key = segments[segments.length - 1].toLowerCase();
        } catch (err) { /* unparseable: keep it, keyed on itself */ }
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(url);
    }
    return out;
}

/* A SITEMAP IS IN ALPHABETICAL ORDER AND THE HEAD OF IT IS NOT A CATALOGUE.
   Added 8 August 2026, and it is the difference between a demo that looks like
   the prospect's store and one that looks like a scraping accident.

   The walk used to take the first PAGE_FANOUT candidates as they appeared. Real
   sitemaps are sorted by URL, so "first" means "alphabetically first", and on a
   regional eyewear retailer with seven thousand URLs that meant every page read
   came from two adjacent brand collections. The demo shipped thirty products
   from one brand's summer edit, and the category navigation it derived read
   "30sundays And Blackout" and "30sundays Beige Brown Edit". Every number and
   name in it was real, and it still misrepresented a store that sells glasses,
   sunglasses and contact lenses.

   So the candidates are dealt round robin by their first path segment instead of
   taken in a run. Same count of pages read, same cost, spread across whatever
   sections the store actually has. This is the selection rule capProducts
   already applies to products, applied one layer earlier to pages, and for the
   same reason: what a demo shows should look like the whole store.

   BIGGEST SECTION FIRST, WHICH IS THE ONLY PREFERENCE IT EXPRESSES. Each section
   still contributes its own pages in sitemap order, and a store with one section
   is dealt exactly the list it had before. Ordering matters because the tier
   stops once it has enough distinct names, so it may never reach the later
   rounds: the first round should therefore be the store's main sections rather
   than whichever section happens to sort first. On the retailer above that turns
   round one into sunglasses, glasses, blue light glasses, contact lenses and
   accessories, and leaves ramadan-deals and b1g1-free for a round that is never
   reached. It is the rule capProducts already applies to categories, for the
   same reason. */
function spreadBySection(urls) {
    const sections = new Map();
    for (const url of urls) {
        let key = '';
        try {
            const segments = new URL(url).pathname.split('/').filter(Boolean)
                .filter((segment) => !LOCALE_SEGMENT.test(segment));
            key = segments.length > 1 ? segments[0].toLowerCase() : '';
        } catch (err) { /* an unparseable candidate keeps the shared key */ }
        if (!sections.has(key)) sections.set(key, []);
        sections.get(key).push(url);
    }
    if (sections.size < 2) return urls;

    const lists = [...sections.values()].sort((a, b) => b.length - a.length);
    const out = [];
    for (let round = 0; out.length < urls.length; round++) {
        let took = 0;
        for (const list of lists) {
            if (round >= list.length) continue;
            out.push(list[round]);
            took++;
        }
        if (!took) break;
    }
    return out;
}

/* Two things this has to get right, both learned from one real index.

   MATCH THE ABBREVIATION. A national retailer names its product sitemaps
   `prod-en-GB_1.xml`. Scoring on the word "product" scored those zero, so the
   walk opened whatever happened to be first and found no products at all.

   PREFER ENGLISH. That same index holds the same catalogue in thirty languages,
   ordered by country code, so the first entries were Estonian. The demo ships
   English copy (handoff 14.5), and a storefront whose product names are in a
   language the copy is not reads as a broken build rather than a localised one.
   So an en locale marker outranks everything else. */
function scoreSitemap(url) {
    let score = 0;
    if (/(^|[^a-z])prod(uct)?s?([^a-z]|$)/i.test(url)) score += 3;
    else if (/item|shop|catalog/i.test(url)) score += 2;
    if (/categor|collection|page|post|blog|store-?locator/i.test(url)) score -= 2;
    if (/[-_/](en)([-_.]|\d|$)/i.test(url)) score += 4;
    else if (/[-_/](de|fr|es|it|nl|pl|sv|da|fi|no|pt|tr|ru|zh|ja|ko|ar|et|lv|lt)([-_.]|\d|$)/i.test(url)) {
        score -= 3;
    }
    return score;
}

/* JSON-LD arrives in more shapes than the specification suggests: a single
   object, an array, a @graph, or a Product nested inside a WebPage. All four are
   walked rather than assumed, because the one a given platform emits is not
   knowable in advance. */
/* PRODUCTGROUP IS THE SHAPE MOST STORES ACTUALLY PUBLISH, and until 7 August 2026
   this function rejected it. It accepted only @type Product, so a page describing a
   garment in five sizes as a ProductGroup with five Products under hasVariant
   yielded nothing, the tier reported "no structured data", and the issue asked for a
   CSV. The store was completely readable.

   That is not a rare theme. schema.org added ProductGroup for exactly this case, and
   it is what current Shopify themes and most clothing and footwear retailers emit.
   Measured on citygym.com: robots.txt, the sitemap index, the product sitemap and
   1,961 product pages all answered 200, every page carried valid JSON-LD, and this
   repository read zero products from it.

   TWO THINGS THE GROUP OWNS AND THE VARIANTS DO NOT. The price lives on each
   variant, so the variants have to be reached. The category, the brand and often the
   name live only on the group, so a variant read on its own arrives with no category
   and the whole catalogue collapses into one bucket. Inheriting them is what keeps a
   demo's category structure real, and a variant's own value always wins over the
   group's.

   Several variants of one garment share a name and collapse to one product later
   (dedupeByName), which is the same behaviour a colourway already got. */
export function collectProducts(node, out, depth, inherited) {
    if (!node || depth > 6) return out;
    if (Array.isArray(node)) {
        for (const item of node) collectProducts(item, out, depth + 1, inherited);
        return out;
    }
    if (typeof node !== 'object') return out;

    const type = node['@type'];
    const types = (Array.isArray(type) ? type : [type])
        .filter((t) => typeof t === 'string')
        .map((t) => t.toLowerCase());
    const isGroup = types.includes('productgroup');

    /* The group is offered up as a product too, not only its variants. A store that
       puts an AggregateOffer on the group and no variants at all is then still read,
       and one that prices only its variants loses nothing: a node with no usable
       price is dropped by the caller, which is the single place that decides. */
    if (types.includes('product') || isGroup) out.push(inherited ? { ...inherited, ...node } : node);

    /* 'item' IS THE LAST STEP OF THE COMMONEST LISTING SHAPE, and until 8 August
       2026 this walk stopped one level short of it.

       A category page that lists its products for Google's rich results writes:

         ItemList -> itemListElement -> [ ListItem -> item -> Product ]

       The walk already descended into itemListElement, so it reached the
       ListItems and then had nowhere to go: a ListItem holds nothing but a
       position, a url and the product under 'item'. Every product on the page was
       one key away and none was found. Measured on a live regional retailer whose
       category pages carry sixteen Products each: the sitemap resolved, ninety
       seven pages were listed, each page's markup was valid, and the tier reported
       "no structured data".

       This is the same class of miss as the ProductGroup bug below, and it is
       worth naming the pattern rather than only the fix: a schema.org walk that
       enumerates the containers it knows will keep failing on the container it
       does not. Descending into every plain object value would be the general
       answer, and the reason this list stays explicit is that a breadcrumb is
       also an ItemList of ListItems: its 'item' has no @type, so it contributes
       nothing here, which is exactly the behaviour wanted. */
    const context = isGroup ? shared(node) : inherited;
    for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement',
                       'item', 'hasPart', 'hasVariant']) {
        if (node[key]) collectProducts(node[key], out, depth + 1, context);
    }
    return out;
}

/* Only the keys a variant genuinely inherits. Copying the whole group would carry
   its offers down onto variants that have their own, and the wrong price is the one
   failure this file exists to prevent. The image is inherited because the group is
   where most themes put the photography, and a variant's own image still wins. */
function shared(group) {
    const out = {};
    for (const key of ['category', 'brand', 'name', 'image']) {
        if (group[key] !== undefined) out[key] = group[key];
    }
    return out;
}

function ldJsonBlocks(html) {
    const out = [];
    const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        try { out.push(JSON.parse(match[1].trim())); }
        catch (err) { /* a malformed block on one page is not a failure of the tier */ }
    }
    return out;
}

/* offers is a single Offer, a list of them, or an AggregateOffer. The lowest
   price wins so a "from" price matches what the page shows. */
/* THE LIST PRICE LIVES ONE LEVEL DOWN, and until 8 August 2026 this dropped it.

   schema.org's way of saying "was 399, now 199" is a priceSpecification beside
   the offer's own price, typed ListPrice:

     offers: { price: 199, priceCurrency: "AED",
               priceSpecification: { "@type": "UnitPriceSpecification",
                                     priceType: "ListPrice", price: 399 } }

   Only offer.price was read, so every such store came out at full price with no
   discount anywhere, and the strikethrough that a promotion demo is largely
   about had nothing to draw. The number is the store's own, so reading it invents
   nothing; prices() still refuses to call it a discount unless it is genuinely
   higher than what is being charged now.

   ONLY A ListPrice COUNTS. The same container also expresses sale prices, unit
   prices per kilo, instalment amounts and minimum spends. A per-instalment
   figure read as a "was" price would produce a discount that runs the wrong way,
   so an untyped or differently typed specification is ignored rather than
   guessed at. */
function ldListPrice(offer) {
    const spec = offer && offer.priceSpecification;
    if (!spec || typeof spec !== 'object') return undefined;
    for (const entry of Array.isArray(spec) ? spec : [spec]) {
        if (!entry || typeof entry !== 'object') continue;
        if (!/listprice/i.test(String(entry.priceType || ''))) continue;
        if (entry.price !== undefined) return entry.price;
    }
    return undefined;
}

function ldOffer(product) {
    const offers = [];
    const push = (offer) => {
        if (!offer || typeof offer !== 'object') return;
        if (Array.isArray(offer)) { offer.forEach(push); return; }
        if (offer.lowPrice !== undefined || offer.highPrice !== undefined) {
            offers.push({ price: offer.lowPrice ?? offer.highPrice,
                          currency: offer.priceCurrency, availability: offer.availability,
                          listPrice: ldListPrice(offer) });
            return;
        }
        offers.push({ price: offer.price, currency: offer.priceCurrency,
                      availability: offer.availability, listPrice: ldListPrice(offer) });
        if (offer.offers) push(offer.offers);
    };
    push(product.offers);

    const priced = offers.filter((offer) => num(offer.price) !== null);
    if (!priced.length) {
        return { price: null, currency: null, availability: null, listPrice: undefined };
    }
    priced.sort((a, b) => num(a.price) - num(b.price));
    return priced[0];
}

/* schema.org spells this as a URL, and stores spell it inconsistently, so only
   the two unambiguous ends are trusted and anything else leaves stock unknown. */
function ldStock(availability) {
    const text = clean(availability).toLowerCase();
    if (!text) return null;
    if (text.includes('outofstock') || text.includes('soldout') || text.includes('discontinued')) return 0;
    return null;
}

/* A path arrives as "Furniture > Sofas > Sofa beds" on some platforms and as a
   single leaf on others. The FIRST segment is taken, because handoff 7.1a asks
   for top level names: the leaf of a deep path is one product's shelf, not a
   navigation entry. Where there is no path, the leaf is all there is and the
   minimum-count rule below is what stops it becoming useless navigation. */
function ldCategory(product) {
    const text = ldText(product.category);
    if (!text) return '';
    return clean(text.split(/\s*(?:>|\/|\||»|›)\s*/)[0]);
}

/* WHERE A PAGE LIVES IS A CATEGORY WHEN THE MARKUP DOES NOT CARRY ONE.
   Added 8 August 2026, after a regional retailer shipped with one category.

   schema.org's category property is optional and plenty of large stores omit it.
   Every product then answers '' and categorise() collapses the whole catalogue
   into a single "All Products" entry, which loses one of the twelve things a
   finished demo is supposed to show: the prospect's own category structure. That
   store's URLs carried it plainly all along:

     /ae-en/glasses/spectus-flexi.html      ->  Glasses
     /ae-en/sunglasses/men.html             ->  Sunglasses
     /ae-en/contact-lenses/monthly.html     ->  Contact Lenses

   THIS READS THE STORE'S OWN TAXONOMY RATHER THAN INVENTING ONE. The words come
   from the prospect's URLs, so nothing here is guessed at, and a name that is
   not a real category cannot be conjured by it.

   ONLY A SEGMENT WITH SOMETHING BENEATH IT COUNTS, which is the whole rule and
   the reason it stays quiet when it should. A first segment followed by another
   segment is a container: the page sits inside it. A first segment that is the
   entire path is the page itself, so /ae-en/25foryou.html contributes nothing
   rather than contributing "25foryou" as a category name. A locale prefix is
   skipped, in both the ae-en and the plain en shapes, because it is addressing
   rather than taxonomy. Where the test fails, the answer is '' and the old
   behaviour stands exactly as it was. */
const LOCALE_SEGMENT = /^[a-z]{2}([-_][a-z]{2,3})?$/i;

/* A CONTAINER THAT NAMES ITS SHAPE IS NOT A CATEGORY. Added 11 August 2026,
   after a Shopify-style store shipped with every product filed under
   "Products": its addresses were /products/<slug>, the first segment had
   something beneath it, so the rule above declared the word a category. The
   rule was right for /glasses/spectus.html and wrong here, because these words
   describe the store's routing rather than its taxonomy. The set errs small on
   purpose: a word wrongly listed here costs one recoverable category, a word
   wrongly missing invents a navigation entry every visitor can see. */
const GENERIC_HEAD = new Set([
    'product', 'products', 'prod', 'collection', 'collections',
    'category', 'categories', 'shop', 'store', 'item', 'items',
    'catalog', 'catalogue', 'buy', 'goods',
    'page', 'pages', 'blog', 'blogs', 'news'
]);

function pathCategory(pageUrl) {
    if (!pageUrl) return '';
    let parsed;
    try { parsed = new URL(pageUrl); } catch (err) { return ''; }

    const segments = parsed.pathname.split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .filter((segment) => !LOCALE_SEGMENT.test(segment));

    /* Nothing beneath it means the first segment IS the page. */
    if (segments.length < 2) return '';

    const head = segments[0].replace(/\.(html?|php|aspx?)$/i, '');
    /* A slug long enough to be a product name, or one carrying a product code,
       is not a category however it is positioned. */
    if (head.length < 3 || head.length > 28) return '';
    if (/\d{3,}/.test(head)) return '';
    if (GENERIC_HEAD.has(head.toLowerCase())) return '';

    return clean(head.replace(/[-_]+/g, ' '));
}

/* -------------------------------------------------------------------------- */
/* Categories from the store's own collection pages                            */

/* THE STORE'S TAXONOMY IS PUBLISHED, JUST NOT ON THE PRODUCT PAGE. Added
   11 August 2026, after thegivingmovement.com shipped with one category.

   Its sitemap held 217 collection pages named bottoms-men, crop-tops-womens and
   hoodies-and-sweatshirts-kids, and every one of them lists the products it
   contains as ordinary links. The product pages themselves carried JSON-LD with
   no category at all, and their addresses all began /products/, which
   pathCategory now correctly refuses. So the whole catalogue collapsed into one
   bucket while the real structure sat one fetch away.

   This pass reads that structure. It runs only when the product pages left at
   least half the catalogue uncategorised, because a store that names its
   categories in its markup has already answered and a second opinion from
   merchandising pages would be worse: schema.org category is curated taxonomy,
   collection membership includes every promotional shelf a product sits on.

   THE MOST SPECIFIC COLLECTION WITH COMPANY WINS, and the second half of that
   rule was learned from the store that prompted the first. A store files one
   garment under Apparel, Bottoms and Bottoms Men at once, so the smallest
   collection says the most about the product. But this same store publishes
   217 collections against a thirty product sample, and pure specificity handed
   nearly every product a private collection of its own; categorise then
   correctly refused thirty categories of one, and the demo shipped with the
   same single bucket the pass exists to prevent. So collections are taken
   smallest first, but only ones holding at least two of the sampled products
   are taken at all, which is the same floor the navigation itself applies.
   Ties break alphabetically so two runs of the same build agree.

   WHAT IT REFUSES TO GUESS. A collection whose slug is the whole store
   (all, all-products, frontpage) contributes nothing. A store whose collection
   pages render client side yields no links here, the pass finds nothing, and
   the demo degrades exactly as before to All products, now with a warning in
   the report rather than silence. */
const COLLECTION_PATH = /\/(collections?|categor(?:y|ies))\/[^/?#]+\/?$/i;
const GENERIC_COLLECTION = new Set(['all', 'all-products', 'frontpage', 'shop-all']);
const COLLECTION_FANOUT = 60;   /* collection pages to read, sitemap order */
const COLLECTION_TARGET = 400;  /* collection addresses worth collecting */

/* The last path segment, which is a product's identity on every store shaped
   like this (see oneUrlPerProduct) and a collection's name in its address. */
function lastSegment(url) {
    let parsed;
    try { parsed = new URL(url); } catch (err) { return ''; }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (!segments.length) return '';
    return segments[segments.length - 1].replace(/\.(html?|php|aspx?)$/i, '').toLowerCase();
}

/* Walks the same sitemaps sitemapProductUrls walks, keeping collection pages
   instead. The index children are opened in the OPPOSITE preference order:
   scoreSitemap marks category sitemaps down because product reads must not
   drown in listing pages, and here the listing pages are the point. */
async function sitemapCollectionUrls(origin) {
    const parsed = await robots(origin);
    const roots = parsed.sitemaps.length ? parsed.sitemaps : [origin + '/sitemap.xml'];

    const seen = new Set();
    const found = [];
    const queue = roots.slice(0, SITEMAP_FANOUT + 1);

    while (queue.length && found.length < COLLECTION_TARGET) {
        const next = queue.shift();
        if (!next || seen.has(next)) continue;
        seen.add(next);

        const result = await readSitemap(next);
        if (!result) continue;

        if (result.isIndex) {
            const nested = result.urls
                .slice()
                .sort((a, b) => scoreSitemap(a) - scoreSitemap(b));
            for (const child of nested.slice(0, SITEMAP_FANOUT)) {
                if (!seen.has(child)) queue.push(child);
            }
            continue;
        }
        found.push(...result.urls.filter((url) => COLLECTION_PATH.test(url)));
    }
    return found.slice(0, COLLECTION_FANOUT);
}

/* Every href on a collection page that looks like a product, resolved against
   where the page really came from. A regex over the raw HTML rather than a DOM,
   which is the same trade the rest of this file makes: these pages are read for
   their links, not their structure. */
function productLinksIn(html, pageUrl) {
    const keys = new Set();
    const pattern = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
    let match;
    while ((match = pattern.exec(html))) {
        const raw = match[2] !== undefined ? match[2] : match[3];
        if (!raw) continue;
        let resolved;
        try { resolved = new URL(raw, pageUrl).toString(); } catch (err) { continue; }
        if (!looksLikeProduct(resolved)) continue;
        const key = lastSegment(resolved);
        if (key) keys.add(key);
    }
    return keys;
}

/* Reads the collection pages and answers: which collections list which of the
   page slugs this build actually read. Choosing between them happens in the
   caller, where the sampled products are known. */
async function collectionCategories(origin) {
    const urls = await sitemapCollectionUrls(origin);
    if (!urls.length) return { collections: [], pagesRead: 0 };

    /* slug -> { name, members: Set of product keys } */
    const collections = new Map();
    let pagesRead = 0;

    let cursor = 0;
    async function worker() {
        while (cursor < urls.length) {
            const url = urls[cursor++];
            const slug = lastSegment(url);
            if (!slug || GENERIC_COLLECTION.has(slug)) continue;

            const page = await get(url, 'text/html');
            if (!page.ok) continue;
            pagesRead++;

            const members = productLinksIn(page.body, page.url || url);
            if (!members.size) continue;

            const existing = collections.get(slug);
            if (existing) {
                for (const key of members) existing.members.add(key);
            } else {
                collections.set(slug, {
                    name: clean(slug.replace(/[-_]+/g, ' ')),
                    members
                });
            }
        }
    }
    await Promise.all(Array.from({ length: PAGE_CONCURRENCY }, worker));

    return { collections: [...collections.values()], pagesRead };
}

/* Assigns a category to every sampled product a collection can vouch for, by
   choosing a FEW LARGE buckets rather than many exact ones. Three rules, each
   learned from a way this went wrong on one real store:

   1. A collection covering most of the sample is an umbrella, however real its
      name, and is excluded: Apparel over every garment is the single bucket
      this pass exists to prevent, wearing a better name.
   2. Each round, the collection vouching for the MOST still unassigned
      products wins, tying towards the smaller collection and then the earlier
      name so two runs agree. Choosing smallest first read as more precise and
      shattered a thirty product sample across two hundred collections into
      buckets of one and two, every one of which the navigation minimum then
      threw away, and the demo shipped with one bucket anyway.
   3. A collection must vouch for at least as many products as the navigation
      itself will require, or it is skipped: a category assigned here only to
      be discarded by categorise is work dressed as progress.

   Rounds stop at CATEGORY_CAP, because a sixth category cannot appear in the
   header whatever happens here. */
const MIN_COLLECTION_SUPPORT = 2;
const UMBRELLA_COVERAGE = 0.6;

export function assignFromCollections(productKeys, collections) {
    const sample = new Set(productKeys);
    const unassigned = new Set(productKeys);
    const byProduct = new Map();
    /* The floor is the SHIPPED catalogue's floor, not the raw sample's. The
       sample here can be eighty rows of colourways that collapse to thirty
       shipped products, and demanding minPerCategory(80) support meant no real
       collection qualified at all: the store's own Bottoms Men holds four of a
       thirty product sample, which is a perfectly good navigation entry. */
    const floor = Math.max(MIN_COLLECTION_SUPPORT,
        minPerCategory(Math.min(sample.size, PRODUCT_CAP)));

    const usable = collections.filter((collection) => {
        let coverage = 0;
        for (const key of sample) if (collection.members.has(key)) coverage++;
        return coverage > 0 && coverage <= sample.size * UMBRELLA_COVERAGE;
    });

    for (let round = 0; round < CATEGORY_CAP && unassigned.size >= floor; round++) {
        let best = null;
        let bestSupport = 0;
        for (const collection of usable) {
            let support = 0;
            for (const key of unassigned) if (collection.members.has(key)) support++;
            if (support < floor) continue;
            if (support > bestSupport ||
                (support === bestSupport && best &&
                 (collection.members.size < best.members.size ||
                  (collection.members.size === best.members.size &&
                   collection.name.localeCompare(best.name) < 0)))) {
                best = collection;
                bestSupport = support;
            }
        }
        if (!best) break;
        for (const key of [...unassigned]) {
            if (best.members.has(key)) {
                byProduct.set(key, best.name);
                unassigned.delete(key);
            }
        }
    }
    return byProduct;
}

/* schema.org lets any of these be a bare string or an object with a name, and
   real sites use both. clean() on an object yields "[object Object]", which is
   how a product came back with Brand "[object Object]" on screen, so the type is
   resolved before the value is used rather than after. */
function ldText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return clean(value);
    if (Array.isArray(value)) return ldText(value[0]);
    if (typeof value === 'object') return clean(value.name || value['@value'] || '');
    return '';
}

function ldAttributes(product) {
    const out = {};
    const pairs = { Brand: product.brand, Color: product.color,
                    Material: product.material, Size: product.size };
    for (const [label, raw] of Object.entries(pairs)) {
        const value = ldText(raw);
        if (value) out[label] = value;
    }
    return out;
}

/* schema.org image arrives as a bare string, an array, or an ImageObject, and
   real sites use all three. The first USABLE candidate wins rather than the
   first candidate: an array whose first entry is a data URI or an http address
   still yields the https one behind it, because one unusable entry is not a
   reason to lose the photo. */
function ldImage(value, pageUrl) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return httpsImage(value, pageUrl);
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = ldImage(item, pageUrl);
            if (found) return found;
        }
        return null;
    }
    if (typeof value === 'object') {
        return httpsImage(typeof value.url === 'string' ? value.url : value.contentUrl, pageUrl);
    }
    return null;
}

/* -------------------------------------------------------------------------- */
/* Reading one product page's HTML, three ways                                */

/* Older Magento and custom builds mark products up with itemscope/itemprop
   rather than JSON-LD, and some pages only carry og meta tags. Both are read
   from the pages the sitemap walk already fetched, so covering them costs no
   extra requests at all.

   THE SCOPE RULE IS WHAT MAKES REGEX EXTRACTION SAFE HERE. A listing page holds
   many products side by side, and a property matched across the whole document
   would hand product A's price to product B. So the document is cut at each
   itemscope that declares schema.org/Product, each property is read only inside
   its own cut, and the first occurrence of a property wins within it, which is
   also what keeps a nested Offer's price attached to the product that owns it. */
function microdataScopes(html) {
    const re = /<[a-z][^>]*\bitemtype\s*=\s*["']\s*(?:https?:)?\/\/(?:www\.)?schema\.org\/Product\/?\s*["'][^>]*>/gi;
    const starts = [];
    let match;
    while ((match = re.exec(html)) !== null) {
        if (/\bitemscope\b/i.test(match[0])) starts.push(match.index);
    }
    return starts.map((start, index) =>
        html.slice(start, index + 1 < starts.length ? starts[index + 1] : html.length));
}

/* One scope's properties. A meta or link property carries its value in an
   attribute; an element carries it as text, read up to the next tag, which is
   enough for the plain values microdata actually holds. */
function itemprops(scope) {
    const out = {};
    const re = /<[a-z][a-z0-9]*\b[^>]*\bitemprop\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = re.exec(scope)) !== null) {
        const key = match[1].trim().toLowerCase();
        if (out[key] !== undefined) continue;
        const tag = match[0];
        const attr = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)
            || /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag)
            || /\bhref\s*=\s*["']([^"']*)["']/i.exec(tag);
        if (attr) { out[key] = attr[1]; continue; }
        const text = /^([^<]*)/.exec(scope.slice(match.index + tag.length));
        out[key] = text ? text[1] : '';
    }
    return out;
}

function microdataProducts(html, pageUrl) {
    const products = [];
    const currencies = [];
    for (const scope of microdataScopes(html)) {
        const props = itemprops(scope);
        const name = clean(props.name);
        if (!name) continue;
        /* The price goes through the same num() path as everything else, so a
           scope whose price is a word yields null and the product is dropped.
           It must never yield 0: that is the Number('') trap, and shipping a
           free product is the same invention as shipping a priced one. */
        const { price, discountedPrice } = prices(props.price, null);
        if (price === null) continue;
        const id = productId([props.sku, name.toLowerCase().replace(/\s+/g, '-')]);
        if (!id) continue;

        const currency = clean(props.pricecurrency).toUpperCase();
        if (/^[A-Z]{3}$/.test(currency)) currencies.push(currency);

        const attributes = {};
        if (clean(props.brand)) attributes.Brand = clean(props.brand);

        products.push({
            id, name,
            category: clean(props.category),
            price, discountedPrice,
            stockCount: ldStock(props.availability),
            attributes,
            image: null,
            imageUrl: httpsImage(props.image, pageUrl)
        });
    }
    return { products, currency: mode(currencies) };
}

/* The last method, and the thinnest: og meta describes the page rather than a
   list, so it yields at most one product, and only when both a title and a
   usable price are actually present. */
function metaTags(html) {
    const out = {};
    const re = /<meta\b[^>]*>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(match[0]);
        const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(match[0]);
        if (!key || !content) continue;
        const name = key[1].trim().toLowerCase();
        if (out[name] === undefined) out[name] = content[1];
    }
    return out;
}

function ogProducts(html, pageUrl) {
    const meta = metaTags(html);
    const name = clean(meta['og:title']);
    const { price, discountedPrice } = prices(meta['product:price:amount'], null);
    if (!name || price === null) return { products: [], currency: null };
    const id = productId([meta['product:retailer_item_id'],
                          name.toLowerCase().replace(/\s+/g, '-')]);
    if (!id) return { products: [], currency: null };

    const currency = clean(meta['product:price:currency']).toUpperCase();
    return {
        products: [{
            id, name,
            category: '',
            price, discountedPrice,
            stockCount: null,
            attributes: {},
            image: null,
            imageUrl: httpsImage(meta['og:image'], pageUrl)
        }],
        currency: /^[A-Z]{3}$/.test(currency) ? currency : null
    };
}

/* THE ONE READER OF A PRODUCT PAGE, used by the jsonld tier here and by the
   render tier in render.mjs, so a page read from a fetched body and a page read
   from a rendered DOM answer identically. Three methods on the same HTML, in
   order of how much they say: JSON-LD, then microdata, then og. A page is read
   by exactly one of them, because JSON-LD and microdata usually describe the
   same products and taking both would count every product twice.

   The methods field says how many products each method contributed, because the
   tier's attempts entry quotes it and the issue comment quotes attempts. */
export function extractProductsFromHtml(html, pageUrl) {
    const products = [];
    const currencies = [];
    const methods = { jsonld: 0, microdata: 0, og: 0 };

    for (const block of ldJsonBlocks(html)) {
        for (const product of collectProducts(block, [], 0)) {
            const name = clean(product.name);
            const offer = ldOffer(product);
            const id = productId([product.sku, product.mpn, product.productID,
                                  name.toLowerCase().replace(/\s+/g, '-')]);
            if (!name || !id) continue;
            const { price, discountedPrice } = prices(offer.price, offer.listPrice);
            if (price === null) continue;

            if (clean(offer.currency)) currencies.push(clean(offer.currency).toUpperCase());
            products.push({
                id, name,
                category: ldCategory(product) || pathCategory(pageUrl),
                price, discountedPrice,
                stockCount: ldStock(offer.availability),
                attributes: ldAttributes(product),
                image: null,
                imageUrl: ldImage(product.image, pageUrl)
            });
            methods.jsonld++;
        }
    }

    if (!products.length) {
        const micro = microdataProducts(html, pageUrl);
        products.push(...micro.products);
        methods.microdata = micro.products.length;
        if (micro.currency) currencies.push(micro.currency);
    }

    if (!products.length) {
        const og = ogProducts(html, pageUrl);
        products.push(...og.products);
        methods.og = og.products.length;
        if (og.currency) currencies.push(og.currency);
    }

    return { products, currency: mode(currencies), methods };
}

async function jsonld(origin) {
    const urls = await sitemapProductUrls(origin);
    if (!urls.length) return { ok: false, reason: REASON.NOT_FOUND, tier: 'jsonld' };

    let found = [];
    const currencies = [];
    /* COUNTED BY DISTINCT NAME, NOT BY ROW, and counting rows made the
       ProductGroup fix look half broken. One garment in six sizes is six rows and
       one product, because they share a name and collapse later, so a row counter
       reached its limit on about ten real products and stopped reading. Naming the
       limit after what a demo actually ships is what makes it mean anything. */
    const names = new Set();
    const contributed = { jsonld: 0, microdata: 0, og: 0 };
    let blocked = 0;

    /* A fixed small pool rather than Promise.all over every URL. A prospect's
       site is not a load test target, and a burst is the thing most likely to
       turn a readable site into a 429. */
    /* Which page each product came from, by the page's own slug, so the
       collections pass below can say which collections list it. Keyed by the
       product OBJECT rather than its id, because two pages can legitimately
       yield rows sharing an id before dedupe runs. */
    const pageKey = new Map();

    let cursor = 0;
    async function worker() {
        while (cursor < urls.length && names.size < PRODUCT_CAP * 2) {
            const url = urls[cursor++];
            const page = await get(url, 'text/html');
            if (!page.ok) { if (page.reason === REASON.BLOCKED) blocked++; continue; }

            /* Relative image paths resolve against where the page actually came
               from, which after a redirect is page.url rather than the sitemap's
               spelling of it. */
            const extracted = extractProductsFromHtml(page.body, page.url || url);
            for (const key of Object.keys(contributed)) contributed[key] += extracted.methods[key];
            if (extracted.currency) currencies.push(extracted.currency);
            for (const product of extracted.products) {
                names.add(product.name.toLowerCase());
                found.push(product);
                pageKey.set(product, lastSegment(page.url || url));
            }
        }
    }
    await Promise.all(Array.from({ length: PAGE_CONCURRENCY }, worker));

    if (!found.length) {
        /* Being blocked is a different answer from having no structured data, and
           the message on the issue reads differently for each. */
        return { ok: false, tier: 'jsonld',
                 reason: blocked ? REASON.BLOCKED : REASON.NOT_FOUND };
    }

    /* THE COLLECTIONS PASS, only when the product pages have not answered. Half
       is the line because below it the structure is mostly known and a second
       source could only disagree with it; above it there is no structure to
       disagree with. Only empty categories are filled: a category the store put
       in its own markup is never overwritten. */
    let detail = 'json-ld ' + contributed.jsonld + ', microdata ' + contributed.microdata +
                 ', og ' + contributed.og;
    const uncategorised = found.filter((product) => !product.category).length;
    if (uncategorised >= Math.ceil(found.length / 2)) {
        const recovered = await collectionCategories(origin);
        const keys = found.filter((p) => !p.category)
            .map((p) => pageKey.get(p)).filter(Boolean);
        const byProduct = assignFromCollections(keys, recovered.collections);
        let filled = 0;
        for (const product of found) {
            if (product.category) continue;
            const name = byProduct.get(pageKey.get(product));
            if (name) { product.category = name; filled++; }
        }
        /* Quoted on the issue through attempts, so a thin build says where its
           categories came from, or that the recovery found nothing. */
        detail += ', categories for ' + filled + ' of ' + found.length +
                  ' products from ' + recovered.pagesRead + ' collection pages';

        /* SHIP THE LABELLED PRODUCTS RATHER THAN DILUTING THEM. The read pulls
           up to ninety pages and the demo ships thirty, so when the collections
           pass has labelled a full catalogue's worth, the unlabelled remainder
           is surplus, not signal. Keeping it was how twenty eight labelled rows
           drowned in a pool of eighty two: categorise floors its counts against
           the WHOLE pool, every collection bucket came in under the floor, and
           the demo shipped with one bucket despite the recovery having worked.
           When the labelled set is too small to be a catalogue on its own,
           everything is kept and the thin build warning tells the operator. */
        const labelled = found.filter((product) => product.category);
        const labelledNames = new Set(labelled.map((p) => p.name.toLowerCase()));
        if (labelledNames.size >= PRODUCT_FLOOR) {
            const surplus = found.length - labelled.length;
            found = labelled;
            detail += ', ' + surplus + ' uncategorised rows set aside';
        }
    }

    return {
        ok: true, tier: 'jsonld', products: found, currency: mode(currencies),
        /* Quoted on the issue through attempts, so whoever reads it can see
           whether a store spoke JSON-LD or was rescued by the older markup. */
        detail
    };
}

/* -------------------------------------------------------------------------- */
/* Tier 5: CSV                                                                */

/* The exception path, and it stays one: the workflow only asks for a CSV after
   tiers 1 and 2 have failed, so nobody is ever told to prepare one up front.

   Deliberately forgiving about headings, because the person producing this is a
   salesperson with an export, not an engineer writing to a schema. */
/* Compared against a NORMALISED heading, so each alias is written once in its
   plainest form. See heading() below for what normalising covers: an underscore,
   an accent, a unit in brackets and a capital letter are all the same heading.
   Nobody exporting a catalogue should have to guess our spelling.

   Portuguese and Spanish are here because the first store this was pointed at was
   Brazilian, and a pre-sales colleague pasting an export from a local system is the
   normal case rather than an edge one. */
const CSV_FIELDS = {
    id: ['id', 'sku', 'product id', 'code', 'item', 'item id', 'codigo', 'referencia', 'ref'],
    name: ['name', 'title', 'product', 'product name', 'description', 'item name',
           'produto', 'nome', 'nome do produto', 'titulo', 'descricao', 'nombre'],
    category: ['category', 'type', 'product type', 'collection', 'department', 'group',
               'categoria', 'tipo', 'departamento', 'colecao', 'grupo'],
    /* 'preco de venda' is the selling price in Portuguese, which is THE price and
       not a discount off one. Filed here deliberately, not under discountedPrice. */
    price: ['price', 'rrp', 'list price', 'was', 'regular price', 'unit price',
            'preco', 'preco de venda', 'preco de tabela', 'valor', 'precio'],
    discountedPrice: ['sale price', 'sale', 'discount price', 'discounted price', 'now',
                      'special price', 'preco promocional', 'promocao', 'oferta',
                      'preco com desconto'],
    stockCount: ['stock', 'stock count', 'quantity', 'qty', 'inventory', 'available',
                 'estoque', 'quantidade', 'qtd', 'disponivel'],
    currency: ['currency', 'currency code', 'moeda', 'moneda', 'divisa'],
    /* 'image link' is what a Google Merchant feed calls it, and those exports are
       a common thing for a salesperson to have to hand. heading() has already
       folded image_url and Image URL into 'image url' by the time this matches. */
    imageUrl: ['image', 'image url', 'img', 'photo', 'picture', 'image link',
               'imagem', 'foto', 'imagen']
};

/* WHAT A CSV'S PRICES ARE IN, WHICH THIS TIER USED TO THROW AWAY. Until 7 August
   2026 fromCsv returned currency: null, currencyBlock read null as USD, and a
   Brazilian tyre catalogue shipped priced in dollars. Every figure on the page was
   the store's own and every symbol in front of it was wrong, which is worse than a
   visibly broken page: it looks finished, so nobody checks it before the call.

   Three places a CSV says it, all of them evidence in the file rather than
   inference about it, tried in that order by csvCurrency below:

     1. a currency column
     2. the price HEADING, because "Price (BRL)" and "Preco (R$)" are the ordinary
        output of a shop admin export. heading() deliberately discards the bracket
        so that the column is still recognised as a price, so the raw heading is
        read separately here rather than the normalised one
     3. the price cells, for "R$ 429,90" and "429.90 BRL"

   AMBIGUOUS SYMBOLS ARE LEFT UNRESOLVED, ON PURPOSE AND PERMANENTLY. A bare $ is
   the dollar of at least six countries, and kr is three Nordic currencies.
   Resolving one of those by picking the most likely is how a demo ends up
   confidently showing the wrong country's money, so they are simply absent from
   this list and the caller, which has the website address to work from, decides.
   R$ is listed BEFORE the bare dollar is ever considered, because a substring
   search for $ finds it inside R$. */
const CSV_SYMBOL_CURRENCY = [
    ['r$', 'BRL'],
    ['€', 'EUR'], ['£', 'GBP'], ['₺', 'TRY'], ['₹', 'INR'], ['¥', 'JPY'],
    ['zł', 'PLN'], ['₪', 'ILS'], ['₩', 'KRW'], ['฿', 'THB'], ['₱', 'PHP']
];

/* Matched as a whole word so that a three letter run inside a longer token is not
   read as a currency. Listed rather than pattern matched, because /[A-Z]{3}/ finds
   a currency in "SET", "PCS" and "KIT", all of which appear in real price columns. */
const CSV_CURRENCY_CODES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'TRY', 'INR', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK',
    'DKK', 'PLN', 'AED', 'SAR', 'BRL', 'MXN', 'ZAR', 'SGD', 'NZD', 'HKD', 'ILS',
    'KRW', 'THB', 'PHP', 'CZK', 'HUF', 'RON', 'CLP', 'COP', 'ARS', 'PEN', 'EGP',
    'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'MAD', 'NGN', 'KES', 'IDR', 'MYR', 'VND'
]);

/* One cell, one heading, or one column value. Returns a code or null, never a
   guess. */
function currencyIn(text) {
    const value = clean(text);
    if (!value) return null;
    const code = value.toUpperCase().match(/\b([A-Z]{3})\b/);
    if (code && CSV_CURRENCY_CODES.has(code[1])) return code[1];
    const lower = value.toLowerCase();
    for (const [symbol, iso] of CSV_SYMBOL_CURRENCY) {
        if (lower.includes(symbol)) return iso;
    }
    return null;
}

/* The most common answer across the rows wins, so one mistyped cell in thirty
   cannot decide the whole catalogue's currency. */
function csvCurrency(header, rows, map) {
    if (map.currency !== undefined) {
        const named = mode(rows.map((row) => currencyIn(row[map.currency])).filter(Boolean));
        if (named) return named;
    }
    const titled = currencyIn(header[map.price]);
    if (titled) return titled;
    return mode(rows.map((row) => currencyIn(row[map.price])).filter(Boolean));
}

/* A HEADING IS MATCHED ON MEANING, NOT ON PUNCTUATION, and the first version was
   not. It compared the lowercased heading against a list of English words, so a
   file with Product_Name, or Preco, or "Price (BRL)" was rejected for having no
   name column and no price column. On 7 August 2026 that cost a real request: a
   CSV of thirty products was attached exactly as asked and refused.

   Normalising covers, in order: accents, so preco matches preço; a bracketed unit,
   so "price (BRL)" is a price; underscores, hyphens and dots, so product_name is
   product name; anything else that is not a letter, a digit or a space, so a
   currency sign in a heading does not matter; and repeated spaces. */
function heading(raw) {
    return clean(raw)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[_\-.]+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/* A real CSV has quoted fields containing commas and newlines. A split on comma
   corrupts exactly the rows a product catalogue is most likely to have, so this
   is a character scanner rather than a split. */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    const body = text.replace(/^\ufeff/, '');   /* Excel writes a BOM */
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (quoted) {
            if (ch === '"') {
                if (body[i + 1] === '"') { field += '"'; i++; }
                else quoted = false;
            } else field += ch;
            continue;
        }
        if (ch === '"') { quoted = true; continue; }
        if (ch === ',' || ch === ';' || ch === '\t') { row.push(field); field = ''; continue; }
        if (ch === '\r') continue;
        if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
        field += ch;
    }
    row.push(field);
    if (row.some((cell) => cell !== '')) rows.push(row);
    return rows.filter((r) => r.some((cell) => clean(cell) !== ''));
}

function headerMap(header) {
    const map = {};
    header.forEach((raw, index) => {
        const name = heading(raw);
        for (const [field, aliases] of Object.entries(CSV_FIELDS)) {
            if (map[field] === undefined && aliases.includes(name)) map[field] = index;
        }
    });
    return map;
}

export function fromCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, reason: 'empty', tier: 'csv' };

    const map = headerMap(rows[0]);
    if (map.name === undefined || map.price === undefined) {
        return { ok: false, reason: 'headings', tier: 'csv',
                 detail: 'needs a name column and a price column' };
    }

    const products = [];
    for (const row of rows.slice(1)) {
        const name = clean(row[map.name]);
        if (!name) continue;

        /* A cell that is a sale price is the price now, and the price column is
           then what it was before. Both go through prices(), which is the only
           thing that decides whether a figure is usable. */
        const listed = row[map.price];
        const sale = map.discountedPrice !== undefined ? row[map.discountedPrice] : null;
        const hasSale = sale !== null && sale !== undefined && num(sale) !== null;
        const resolved = hasSale ? prices(sale, listed) : prices(listed, null);

        /* THE DROP TEST IS THE RESOLVED PRICE, NOT THE RAW NUMBER, and the first
           version tested the raw one. Zero and negative are both numbers, so they
           passed the test, then prices() correctly refused them, and the row
           shipped with a null price: the one thing js/catalog.js and the smoke
           test both exist to refuse. A row without a usable price is dropped,
           because unit_price is required on ec:addToCart. */
        if (resolved.price === null) continue;

        const id = productId([map.id !== undefined ? row[map.id] : '',
                              name.toLowerCase().replace(/\s+/g, '-')]);
        if (!id) continue;

        products.push({
            id, name,
            category: map.category !== undefined ? clean(row[map.category]) : '',
            price: resolved.price,
            discountedPrice: resolved.discountedPrice,
            /* An empty stock cell is unknown, not zero. Only a number that is
               actually there is used. */
            stockCount: map.stockCount !== undefined ? stock(row[map.stockCount]) : null,
            attributes: {},
            image: null,
            /* A CSV has no page to resolve a relative path against, so only an
               address that is already absolute https survives. */
            imageUrl: map.imageUrl !== undefined ? httpsImage(row[map.imageUrl], null) : null
        });
    }

    if (!products.length) return { ok: false, reason: 'no-rows', tier: 'csv' };
    return {
        ok: true, tier: 'csv', products,
        currency: csvCurrency(rows[0], rows.slice(1), map)
    };
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */

function mode(values) {
    if (!values.length) return null;
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* A CATEGORY NAME IS SHORTER THAN A PRODUCT NAME, and it has to be. It goes into
   the header navigation, into the filter chips, onto every tile, and into
   category_path on every event that reaches Dengage.

   The site header has no horizontal slack. js/storefront.js caps the navigation
   at six entries, which handles a prospect with fourteen categories, but not a
   prospect with one category whose name is a hundred and twenty characters long:
   a real feed produced exactly that, and the nav grew wider than the header. The
   count cap cannot fix a length problem, so the length is capped here, once, where
   every consumer of the name gets the same answer.

   Cut on a word boundary where there is one within reach, because a name cut mid
   word reads as a rendering fault rather than as a long name. */
const MAX_CATEGORY = 28;

function shorten(text, limit) {
    if (text.length <= limit) return text;
    const cut = text.slice(0, limit);
    const space = cut.lastIndexOf(' ');
    return (space >= limit * 0.6 ? cut.slice(0, space) : cut).trim();
}

function titleCase(text) {
    const cased = clean(text).replace(/\w\S*/g, (word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    return shorten(cased, MAX_CATEGORY);
}

/* Handoff 7.1a. The prospect's own category names, in the order their catalogue
   justifies, capped to what the header fits, with the tail grouped rather than
   dropped so no product becomes unreachable.

   Ordered by product count rather than by the site's menu order, because
   product_type and schema.org category carry no order of their own and count is
   the only signal actually in the data. Taking the largest is also what 7.1a
   asks for. */
/* How many products a category needs before it earns a place in the navigation.

   WHY A MINIMUM AND NOT JUST A CAP. A large retailer's structured data names the
   shelf a product sits on rather than a department: one real catalogue produced
   "3 Seater Sofa Beds", "Vretstorp Covers" and "Custom-made Thick Veneer
   Worktops" as top level navigation, each holding a single product. Every name
   was genuinely the prospect's, and the result was still a storefront whose
   filters did nothing, because clicking one showed the one product already on
   screen.

   WHY IT SCALES WITH THE CATALOGUE. A fixed three was right for thirty products
   and wrong for ten: a ten product CSV with five sensible departments collapsed
   to one navigation entry plus More, because three of ten is nearly a third of
   the catalogue. One tenth, never below two, holds in both directions. Two is
   the floor because a category holding one product is not somewhere to navigate
   to, whatever the catalogue size. */
function minPerCategory(total) {
    return Math.max(2, Math.ceil(total / 10));
}

const TAIL = 'More';
const UNCATEGORISED = 'All products';

export function categorise(products) {
    const counts = new Map();
    for (const product of products) {
        const name = titleCase(product.category);
        /* Names this function assigned on an earlier pass are not evidence about
           the prospect's catalogue. Counting them is what produced a category
           list with More in it twice: the second pass saw the first pass's own
           output as a real category and then appended the tail again.

           COMPARED CASE-BLIND, because titleCase does not fix the sentinel's own
           casing: it turns "All products" into "All Products", so an exact
           comparison waved the sentinel through and the second pass promoted it
           to a real category with the wrong capitalisation. Found by the
           collections-pass test on 11 August 2026, not by a user, which is the
           right way round for once. */
        if (!name || name === TAIL ||
            name.toLowerCase() === UNCATEGORISED.toLowerCase()) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
    }

    const minimum = minPerCategory(products.length);
    const ranked = [...counts.entries()]
        .filter(([, count]) => count >= minimum)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name]) => name);

    if (!ranked.length) {
        /* Either no category information at all, or none of it dense enough to
           navigate. One name is still needed, or the navigation renders empty and
           the filters do nothing. */
        for (const product of products) product.category = UNCATEGORISED;
        return [UNCATEGORISED];
    }

    const kept = ranked.slice(0, CATEGORY_CAP);
    const keptSet = new Set(kept);

    let usedTail = false;
    for (const product of products) {
        const name = titleCase(product.category);
        if (keptSet.has(name)) { product.category = name; continue; }
        product.category = TAIL;
        usedTail = true;
    }

    /* The tail only appears if something is actually in it. A navigation entry
       that leads to an empty grid is worse than one that is not there. */
    return usedTail ? kept.concat(TAIL) : kept;
}

/* COLOURWAYS ARE ONE PRODUCT, NOT SEVERAL. A Shopify store lists each colour of a
   garment as its own product with the same title, so a real feed came back with
   30 products carrying 17 distinct names: four Sasquatch Hoodies, three Mackenzie
   Quilted Bags. On screen that is a grid repeating the same tile at the same
   price, which reads as a rendering fault rather than as a catalogue.

   The alternative was appending the colour to the name, and it was worse. The
   colour values are long and shouted, "BLUE HORIZON HEATHER FOOTBALL", and a tile
   captioned with one is unreadable at grid size. A viewer does not read two
   colours of one hoodie as two products anyway.

   Nothing real is lost. The duplicates are dropped rather than merged, and the
   cap then takes the next distinct product from further down the feed, so a demo
   still ships thirty different things. A sellable colourway is preferred over a
   sold out one, which is the same rule the cap uses. */
function dedupeByName(products) {
    const groups = new Map();
    for (const product of products) {
        const key = product.name.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(product);
    }
    const out = [];
    for (const group of groups.values()) {
        out.push(group.find((product) => product.stockCount !== 0) || group[0]);
    }
    return out;
}

/* TWO PRODUCTS SHARING AN ID IS A DIFFERENT AND WORSE PROBLEM than two sharing a
   name, and a real feed produced one: two distinct rows with the same SKU.

   The id is the key everywhere it goes. product.html?id= resolves to whichever
   the catalogue met first, so one of the two is unreachable. The cart and the
   wishlist are keyed on it, so adding one adds the other. And product_id reaches
   Dengage, where the two products' behaviour merges into one row set that
   segmentation then treats as a single product.

   The later one is dropped rather than given a new id. A synthesised id would put
   a product in the demo under a code the prospect does not use, and the dropped
   product costs nothing: the cap takes the next one from the feed. */
function dedupeById(products) {
    const seen = new Set();
    const out = [];
    for (const product of products) {
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        out.push(product);
    }
    return out;
}

/* Keeps the mix rather than the first thirty. A store whose feed happens to open
   with thirty t-shirts would otherwise produce a demo with one category in the
   navigation and nothing to filter, which reads as a broken storefront rather
   than as a faithful one. So products are taken round robin across categories
   until the cap. */
export function capProducts(products, cap) {
    const byCategory = new Map();
    for (const product of products) {
        const key = titleCase(product.category) || '';
        if (!byCategory.has(key)) byCategory.set(key, []);
        byCategory.get(key).push(product);
    }

    /* IN STOCK FIRST WITHIN EACH CATEGORY, and this is selection rather than
       invention: every number still comes from the scrape, only the choice of
       which thirty products to ship changes.

       It earns its place because a real feed carries its sold out lines. One
       store's catalogue came back 26 of 30 out of stock, which is faithful and
       useless: almost nothing could be added to a cart, so the cart, the
       checkout, the abandonment journey and half the launcher had nothing to
       demonstrate. Preferring sellable products keeps the demo clickable without
       writing a stock count nobody counted. Sold out products still appear when
       a category has nothing else, because "Out of stock" is a state worth
       showing once. */
    for (const list of byCategory.values()) {
        list.sort((a, b) => (a.stockCount === 0 ? 1 : 0) - (b.stockCount === 0 ? 1 : 0));
    }

    /* Largest categories first, so a store with one dominant line still leads
       with it rather than leading with a category holding one product. */
    const lists = [...byCategory.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([, list]) => list);

    const out = [];
    let round = 0;
    while (out.length < cap) {
        let took = 0;
        for (const list of lists) {
            if (round >= list.length) continue;
            out.push(list[round]);
            took++;
            if (out.length >= cap) break;
        }
        if (!took) break;
        round++;
    }
    return out;
}

/* A PLACEHOLDER PRICE IS NOT A PRICE, AND ONLY THE CATALOGUE AROUND IT SAYS SO.
   Added 8 August 2026, found on a live regional eyewear retailer.

   positivePrice above refuses the shapes that are wrong on their own: zero,
   negative, absurd. It cannot refuse this one, because the number is perfectly
   ordinary in isolation. The store's own JSON-LD carries, on one category page,
   the same product name twice:

     "Spectus AMIN-Titanium"  offers.price "599"    the real price
     "Spectus AMIN-Titanium"  offers.price "1"      a placeholder row

   Both are valid markup and both parse. Dozens of entries across the catalogue
   carry 1. Nothing inside a single product can tell the two apart, so the demo
   would have gone to a sales call quoting AED 1 for titanium eyeglasses, which
   is the one kind of error a prospect is guaranteed to notice: they know their
   own prices.

   WHAT THIS DOES AND DOES NOT DO. It drops the product rather than the number.
   A storefront tile with no price cannot be added to a cart, so a priceless
   product is not a product here, and dropping it is the same omission the
   extractor already performs for an offer it could not read at all. It never
   adjusts a price, and never substitutes a sibling's: that would be inventing a
   figure for a real product, which stays forbidden everywhere (CLAUDE.md 5).

   THE THRESHOLD IS RELATIVE, BECAUSE AN ABSOLUTE ONE CANNOT BE WRITTEN. "Under
   five" is meaningless across AED, JPY and GBP alike, and a hard-coded 1 would
   miss the next store's 0.01 sentinel. One percent of the catalogue's own median
   travels between currencies and price points: a 500 median drops below 5, a
   50,000 watch catalogue drops below 500 and its 800 strap survives.

   IT IS DELIBERATELY CONSERVATIVE IN THE DIRECTION THAT COSTS LESS. A genuinely
   cheap accessory sitting two orders of magnitude under everything else in the
   same store can be dropped by this. That costs one tile out of thirty on a
   demo. The other direction costs the call. The median needs a real distribution
   behind it, so a catalogue too small to have one is left exactly as it is. */
const SENTINEL_FRACTION = 0.01;
const SENTINEL_MIN_SAMPLE = 8;

export function dropSentinelPrices(products) {
    const priced = products
        .map((product) => product.price)
        .filter((price) => typeof price === 'number' && price > 0)
        .sort((a, b) => a - b);
    if (priced.length < SENTINEL_MIN_SAMPLE) return products;

    const middle = Math.floor(priced.length / 2);
    const median = priced.length % 2
        ? priced[middle]
        : (priced[middle - 1] + priced[middle]) / 2;
    const floor = median * SENTINEL_FRACTION;
    if (!(floor > 0)) return products;

    return products.filter((product) => {
        if (typeof product.price !== 'number') return true;
        return product.price >= floor;
    });
}

/* -------------------------------------------------------------------------- */
/* The pipeline                                                               */

/* Tries each tier in order and reports which one answered, because the workflow
   says so on the issue and the difference matters to whoever reads it. csvText
   is only supplied on a retry, after the first two tiers have already failed. */
export async function catalogue(origin, csvText, options) {
    const settings = options || {};
    const attempts = [];
    /* A tier that answers with too few products is kept rather than discarded,
       because if every tier is thin the best of them is still what the failure
       message should quote back. */
    let best = null;

    const consider = (result) => {
        /* THE SENTINEL DROP RUNS BEFORE THE COUNT, so the floor is measured in
           products a demo could actually sell and the number quoted on the issue
           is the number that shipped. Filtering after the floor check would let a
           tier clear thirty and deliver twenty without saying so. */
        if (result.ok) result.products = dropSentinelPrices(result.products);
        attempts.push({ tier: result.tier, ok: result.ok, reason: result.reason,
                        detail: result.detail,
                        found: result.ok ? result.products.length : 0 });
        if (!result.ok) return false;
        if (!best || result.products.length > best.products.length) best = result;
        return result.products.length >= PRODUCT_FLOOR;
    };

    if (csvText) {
        if (consider(fromCsv(csvText))) return finish(best, attempts);
    }

    for (const tier of [shopify, woocommerce, jsonld]) {
        if (consider(await tier(origin))) return finish(best, attempts);
    }

    /* THE BROWSER TIER LIVES IN ANOTHER MODULE AND MAY NOT EXIST YET, so it is
       loaded lazily and its absence is not an error: the dispatcher was written
       before render.mjs was, deliberately, so the two could land independently.
       It runs after the static tiers because a headless browser is the most
       expensive way to read a page, and before the generated fallback because a
       real catalogue read slowly still beats an invented one. --no-render maps
       to settings.render === false for a store whose pages a browser upsets. */
    let rendered = null;
    try { ({ rendered } = await import('./render.mjs')); } catch (err) { /* module absent */ }
    if (rendered && settings.render !== false) {
        if (consider(await rendered(origin))) return finish(best, attempts);
    }

    /* THE LAST RESORT, AND IT IS A DIFFERENT KIND OF ANSWER FROM THE THREE ABOVE.
       Added 7 August 2026, because asking a colleague for a CSV turned out to be the
       normal path rather than the exception and a factory that stops for a
       spreadsheet is not automatic.

       Every tier above reads the prospect's own store. This one reads nothing: it
       builds a catalogue for the vertical the address appears to be in, with
       invented prices, which is the single exception to non-negotiable 5 in this
       repository. factory/scrape/fallback.mjs carries the reasoning and the three
       things that keep it honest.

       OPT IN RATHER THAN AUTOMATIC AT THIS LAYER. The generator turns it on; a
       direct caller of catalogue() gets the old refusal, so nothing starts inventing
       a catalogue because it forgot to check a flag. */
    if (settings.generateIfUnreadable) {
        const made = generatedCatalogue(settings.hint || origin);
        attempts.push({ tier: 'generated', ok: true, found: made.products.length });
        return finish(made, attempts);
    }

    /* Nothing cleared the floor. 'thin' is a different answer from 'nothing was
       readable', and the message on the issue reads differently for each. */
    return {
        ok: false,
        attempts,
        thin: best ? best.products.length : 0,
        floor: PRODUCT_FLOOR
    };
}

function finish(result, attempts) {
    /* Duplicates go first, so the cap counts distinct products rather than
       spending a third of its thirty on repeats of the same tile. By id before by
       name: a shared id is a correctness problem and a shared name is a
       presentation one, so the stricter rule runs first. */
    const distinct = dedupeByName(dedupeById(result.products));

    /* Category assignment runs on everything found, then the cap keeps the mix,
       then categories are recomputed: a category that lost all its products to
       the cap must not stay in the navigation pointing at nothing. */
    categorise(distinct);
    const products = capProducts(distinct, PRODUCT_CAP);
    const categories = categorise(products);

    /* THE NAVIGATION ORDER IS THE ORDER PRODUCTS APPEAR IN, not the order of the
       categories array in demo.config.json. js/catalog.js builds its category
       list by walking products and taking each new name as it meets it, so the
       config's array is a record rather than an instruction.

       Sorting the shipped list by category rank is therefore what actually puts
       the largest category first in the header and the tail group last. Without
       it the round robin above interleaves categories, and More lands in the
       navigation somewhere in the middle. */
    const rank = new Map(categories.map((name, index) => [name, index]));
    products.sort((a, b) => (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99));

    /* Every shipped product carries the imageUrl key, even from a source that
       never sets one, such as the generated catalogue. The downloader reads the
       key on every product, and an absent key and a null are the same answer
       stated two ways, so they are made the same here. */
    for (const product of products) {
        if (product.imageUrl === undefined) product.imageUrl = null;
    }

    return {
        ok: true,
        tier: result.tier,
        /* Only a generated catalogue has one. It is reported so the issue comment can
           say which range was used rather than only that one was. */
        vertical: result.vertical,
        attempts,
        currency: result.currency,
        categories,
        products
    };
}

export function readCsvFile(path) {
    return fromCsv(readFileSync(path, 'utf8'));
}
