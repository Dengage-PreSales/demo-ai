/* ============================================================================
   THE PRODUCT FEED. Every live demo's catalogue, in one file, for Dengage.

     node factory/build-feed.mjs            writes feed/
     node factory/build-feed.mjs --check    fails if feed/ is out of date

   Published at:
     https://dengage-presales.github.io/demo-ai/feed/products.csv
     https://dengage-presales.github.io/demo-ai/feed/products.json

   WHY THIS EXISTS. Three capabilities are blocked on one thing, and it is not
   more events. Smart Search, the recommendation engine and Product Box Dynamic
   all return PRODUCTS, and Dengage has no products for this application: the
   storefront's ec:* calls record behaviour, which is a different thing from a
   catalogue. This is the catalogue.

   ONE FEED, NOT ONE PER DEMO, AND THAT IS FORCED. Every demo shares one Dengage
   application (handoff 2.1), and an application has one product catalogue. So the
   feed is the union of every live demo, and the thing that keeps a fashion
   prospect from being shown tyres is a FILTER rather than a separate feed.

   That filter is `demo_slug`, and it is the most important column here. Dengage's
   recommendation rules support Advanced Filters over Category, Brand, Price,
   Original Price, Discount, Stock Level, In Stock Status and custom catalog
   attributes, so a rule scoped to one demo filters on demo_slug equals that slug.
   Category would not do: two demos both having "Accessories" is normal.

   Whether Dengage's product integration accepts a custom attribute AND lets a
   rule filter on it is the one thing here that is not verifiable from this side.
   The documentation says custom catalog attributes are filterable. If it turns out
   they are not, this feed is still correct and the scoping question moves to
   Salil, which is why the column is present and named rather than assumed away.

   THE OMISSION RULE APPLIES HERE TOO, and it has a subtlety worth stating.

     in_stock     is a FACT. The scrape knows whether a product is buyable: a
                  Shopify feed says so per variant, and schema.org says so on the
                  offer. false means no variant was available.
     stock_level  is usually UNKNOWN. The same feeds carry no quantity, so this is
                  empty far more often than not, and empty means unknown rather
                  than zero. Writing a number here would be inventing one, and 0
                  in particular would announce every product out of stock.

   So a product can be in stock with no known level, and that is not a
   contradiction: it is the difference between what a public feed publishes and
   what it does not. CLAUDE.md 3.5.
   ========================================================================== */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEMOS = join(ROOT, 'demos');
const OUT = join(ROOT, 'feed');
const SITE = 'https://dengage-presales.github.io/demo-ai';

/* Column order is the file's contract. Dengage's own filter vocabulary decides
   the names where there is one, so a mapping step in the panel is a lookup rather
   than a guess. */
export const COLUMNS = [
    'product_id',      /* what every ec:* event already sends. The join key */
    'demo_slug',       /* the per demo discriminator. See the header */
    'name',
    'category',
    'brand',
    'price',           /* what a customer pays now */
    'original_price',  /* what it was before any discount, else the same */
    'discount',        /* absolute, in the demo's currency. 0 when there is none */
    'currency',
    'in_stock',        /* a fact: true or false */
    'stock_level',     /* a number, or EMPTY meaning unknown. Never 0 for unknown */
    'url',
    'image_url'
];

/* -------------------------------------------------------------------------- */

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function products(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.products)) return payload.products;
    return [];
}

/* A demo past its expiry date is still in the tree until the folder is removed,
   and its products must not stay in the catalogue: a recommendation pointing at a
   demo that has been taken down is a broken link on a live call. Handoff 10 keeps
   folder deletion separate and parked, so the feed does its own filtering rather
   than assuming the folder is gone. */
function isLive(config, today) {
    if (!config.expiresAt) return true;
    return String(config.expiresAt) >= today;
}

function money(value) {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

export function rowsFor(slug, config, list) {
    const currency = (config.locale && config.locale.currency) || 'USD';
    const rows = [];

    for (const product of list) {
        const original = money(product.price);
        const discounted = money(product.discountedPrice);
        /* price is what is paid, which is the discounted figure when there is one.
           This is the same resolution js/catalog.js calls effectivePrice, and the
           two must agree or the feed disagrees with the storefront it describes. */
        const paid = discounted !== null ? discounted : original;
        if (!product.id || paid === null) continue;

        const level = product.stockCount;
        rows.push({
            product_id: String(product.id),
            demo_slug: slug,
            name: product.name || String(product.id),
            category: product.category || '',
            brand: (product.attributes && (product.attributes.Brand || product.attributes.brand)) || '',
            price: paid,
            original_price: original !== null ? original : paid,
            discount: original !== null && discounted !== null
                ? Math.round((original - discounted) * 100) / 100 : 0,
            currency,
            /* 0 is the only value that means out of stock. null means the level is
               unknown, which says nothing about whether it is buyable. */
            in_stock: level === 0 ? 'false' : 'true',
            stock_level: typeof level === 'number' ? level : '',
            url: SITE + '/demos/' + slug + '/product.html?id=' + encodeURIComponent(String(product.id)),
            /* One image per MOTIF, shared by every demo, rather than one per
               product. The storefront draws its artwork inline as SVG so nothing
               can 404 mid call (handoff 7.3), which leaves a Dengage rendered
               widget with no image to show. A motif tile is the same silhouette
               the storefront draws, costs 48 files once rather than 30 per demo,
               and keeps the no-per-demo-images decision intact. */
            image_url: product.motif ? SITE + '/assets/motifs/' + product.motif + '.jpg' : ''
        });
    }
    return rows;
}

/* -------------------------------------------------------------------------- */
/* Serialising                                                                */

/* Quoted only where it has to be, and doubled quotes inside. A product name
   containing a comma is the normal case, not the exception. */
function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function toCsv(rows) {
    const lines = [COLUMNS.join(',')];
    for (const row of rows) lines.push(COLUMNS.map((name) => csvCell(row[name])).join(','));
    return lines.join('\n') + '\n';
}

export function toJson(rows, generatedAt) {
    return JSON.stringify({
        generatedAt,
        productCount: rows.length,
        demos: [...new Set(rows.map((row) => row.demo_slug))].sort(),
        columns: COLUMNS,
        products: rows
    }, null, 2) + '\n';
}

/* -------------------------------------------------------------------------- */

export function collect(today) {
    if (!existsSync(DEMOS)) return { rows: [], demos: [], skipped: [] };

    const rows = [];
    const demos = [];
    const skipped = [];

    for (const slug of readdirSync(DEMOS).sort()) {
        const folder = join(DEMOS, slug);
        const configPath = join(folder, 'demo.config.json');
        const productsPath = join(folder, 'products.json');
        if (!existsSync(configPath) || !existsSync(productsPath)) continue;

        const config = readJson(configPath);
        if (!isLive(config, today)) { skipped.push({ slug, expiresAt: config.expiresAt }); continue; }

        const list = rowsFor(slug, config, products(readJson(productsPath)));
        rows.push(...list);
        demos.push({ slug, products: list.length, expiresAt: config.expiresAt || null });
    }
    return { rows, demos, skipped };
}

function main() {
    const check = process.argv.includes('--check');
    /* The date is the only non deterministic input, and it decides which demos are
       still live. Passed in so --check can compare like with like. */
    const today = (process.argv.find((a) => a.startsWith('--today=')) || '')
        .replace('--today=', '') || new Date().toISOString().slice(0, 10);

    const { rows, demos, skipped } = collect(today);
    const csv = toCsv(rows);

    const csvPath = join(OUT, 'products.csv');
    const jsonPath = join(OUT, 'products.json');

    if (check) {
        /* Compares the CSV only. The JSON carries a generated timestamp, so it
           differs on every run by design and cannot be compared byte for byte. */
        const current = existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : '';
        if (current === csv) { console.log('feed is up to date: ' + rows.length + ' products'); return; }
        console.error('feed/products.csv is out of date. Run: node factory/build-feed.mjs');
        process.exit(1);
    }

    mkdirSync(OUT, { recursive: true });
    writeFileSync(csvPath, csv);
    writeFileSync(jsonPath, toJson(rows, today));

    demos.forEach((demo) => console.log('  ' + demo.slug.padEnd(24) +
        String(demo.products).padStart(4) + ' products   expires ' + (demo.expiresAt || 'never')));
    skipped.forEach((demo) => console.log('  ' + demo.slug.padEnd(24) +
        '  skipped, expired ' + demo.expiresAt));
    console.log('\n' + rows.length + ' products from ' + demos.length + ' demo(s)');
    console.log(SITE + '/feed/products.csv');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
