#!/usr/bin/env node
/* ============================================================================
   A dps_product upload, from a demo the factory has already built.

     node factory/panel/dps-product.mjs --slug <slug>
     node factory/panel/dps-product.mjs --all

   Writes factory/panel/content/<slug>/dps_product.csv, ready to import in
   Data Space > Tables > dps_product.

   WHY THIS EXISTS. No Dengage event table carries a product name or a picture:
   every one identifies a product by product_id and stops (factory/phase0/SCHEMA.md).
   dps_product is what turns an id back into something a person can read, so it is
   the difference between an abandoned cart email that shows a basket and one that
   shows three broken images.

   IT INVENTS NOTHING. Every value comes from the demo's own products.json, which
   came from the scrape. A product with no price gets an empty price cell rather
   than a zero, for the reason in CLAUDE.md 3.5: Number(null) is 0 and a zero in a
   price column reads as free. stock_count is omitted entirely unless the scrape
   genuinely produced one.

   THE KEY IS NAMESPACED BY SLUG, AND THAT IS THE WHOLE REASON THIS IS NOT A
   ONE LINER. dps_product has one primary key, product_id, and one table serves
   every demo. Two prospects whose catalogues both contain an id like "12345" would
   overwrite each other, and the demo on the call would show the other one's
   picture. Non-negotiable 6 already says every demo is namespaced by its slug, so
   the key written here is "<slug>:<id>".

   THAT MEANS THE EMITTER HAS TO MATCH. template/js/dengageEvents.js sends the
   catalogue's own id today, so the join from shopping_cart_events into this table
   only lands once both sides agree. Run with --natural-ids for a single demo test
   where nothing else is loaded, and the key stays the bare id.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = 'https://dengage-presales.github.io/demo-ai/demos/';

/* The columns dps_product holds, in order, exactly as named on the table. Only the
   ones a scrape can honestly fill are written; the rest are present and empty so an
   import maps cleanly rather than silently shifting a column. */
export const DPS_PRODUCT_COLUMNS = [
    'product_id', 'title', 'description', 'category_id', 'brand_id', 'link',
    'image_link', 'price', 'discounted_price', 'availability', 'availability_date',
    'stock_count', 'parent_id', 'trans_title', 'product_vendor', 'category_path',
    'brand', 'mobile_web_link', 'android_deep_link', 'ios_deep_link',
    'small_image_link', 'large_image_link', 'is_active', 'product_special_code',
    'store_name', 'legacy_resource_id', 'publish_date'
];

/* RFC 4180: quote anything containing a comma, a quote or a newline, and double an
   inner quote. Product titles contain commas constantly, so this is not optional. */
function cell(value) {
    if (value === null || value === undefined || value === '') return '';
    const text = String(value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/* A number, or nothing. Never a zero standing in for absent. */
function num(value) {
    return typeof value === 'number' && isFinite(value) ? String(value) : '';
}

export function rowsFor(slug, options) {
    const natural = Boolean(options && options.naturalIds);
    const dest = join(ROOT, 'demos', slug);
    const config = JSON.parse(readFileSync(join(dest, 'demo.config.json'), 'utf8'));
    const products = JSON.parse(readFileSync(join(dest, 'products.json'), 'utf8')).products || [];
    if (!products.length) throw new Error('no products for ' + slug);

    const base = PAGES + slug + '/';
    const storeName = config.displayName || slug;

    return products.filter((p) => p && p.id).map((product) => {
        /* discountedPrice only counts when it is genuinely lower, the same rule the
           storefront's catalogue applies. */
        const price = typeof product.price === 'number' ? product.price : null;
        const cut = typeof product.discountedPrice === 'number' &&
                    price !== null && product.discountedPrice < price
            ? product.discountedPrice : null;

        const row = {
            product_id: natural ? String(product.id) : slug + ':' + product.id,
            title: product.name || '',
            /* ABSOLUTE, BOTH OF THEM, and that is what lets one shared dynamic
               content asset serve every demo: the row carries the demo's own
               addresses, so the asset never has to know which demo it is sending
               for. It cannot know, there is no demo marker in a send. */
            link: base + 'product.html?id=' + encodeURIComponent(String(product.id)),
            image_link: product.image ? base + product.image : '',
            small_image_link: product.image ? base + product.image : '',
            price: num(price),
            discounted_price: num(cut),
            category_path: product.categoryPath || product.category || '',
            /* stock_count ONLY when the scrape produced one. An invented stock
               figure is the exact trap CLAUDE.md 3.5 names, and "in stock" with no
               number is both true and useful. */
            stock_count: num(product.stockCount),
            availability: product.stockCount === 0 ? 'out of stock' : 'in stock',
            is_active: '1',
            /* Which demo a row belongs to, readable in the panel. Not a filter a
               dynamic content asset can use, since a send carries no demo marker,
               but the thing that makes a table of several demos legible to a human. */
            store_name: storeName
        };
        return DPS_PRODUCT_COLUMNS.map((name) => cell(row[name]));
    });
}

export function buildDpsProduct(slug, options) {
    const rows = rowsFor(slug, options);
    const csv = [DPS_PRODUCT_COLUMNS.join(',')]
        .concat(rows.map((r) => r.join(','))).join('\n') + '\n';
    const out = join(ROOT, 'factory', 'panel', 'content', slug);
    mkdirSync(out, { recursive: true });
    const file = join(out, 'dps_product.csv');
    writeFileSync(file, csv);
    const priced = rows.filter((r) => r[DPS_PRODUCT_COLUMNS.indexOf('price')]).length;
    const imaged = rows.filter((r) => r[DPS_PRODUCT_COLUMNS.indexOf('image_link')]).length;
    return { slug, file, count: rows.length, priced, imaged,
             key: rows.length ? rows[0][0] : '' };
}

/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const flag = (name) => {
    const at = args.indexOf('--' + name);
    return at === -1 ? null : (args[at + 1] || true);
};

if (import.meta.url === 'file://' + process.argv[1]) {
    const naturalIds = args.includes('--natural-ids');
    const slugs = args.includes('--all')
        ? readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
            .filter((e) => e.isDirectory() && existsSync(join(ROOT, 'demos', e.name, 'products.json')))
            .map((e) => e.name)
        : [flag('slug')].filter((x) => typeof x === 'string');

    if (!slugs.length) {
        console.error('usage: node factory/panel/dps-product.mjs --slug <slug> [--natural-ids] | --all');
        process.exit(2);
    }
    let failed = 0;
    for (const slug of slugs) {
        try {
            const r = buildDpsProduct(slug, { naturalIds });
            console.error('dps_product: ' + r.count + ' rows for ' + slug +
                ', ' + r.priced + ' priced, ' + r.imaged + ' with an image' +
                (naturalIds ? ', natural ids' : ', keys namespaced as "' + r.key + '"'));
        } catch (err) {
            failed++;
            console.error('dps_product: skipped ' + slug + ' (' + err.message + ')');
        }
    }
    process.exit(failed === slugs.length ? 1 : 0);
}
