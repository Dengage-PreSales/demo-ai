/* ============================================================================
   Refresh one existing demo's product images, without rebuilding the demo.

     node factory/refresh-images.mjs --slug <slug>

   WHY THIS EXISTS AS ITS OWN TOOL. A demo built before 8 August 2026 carries no
   photographs, and a demo whose store blocks automated readers cannot get real
   ones at build time. Rebuilding the whole demo to fix either would reset its
   theme, its catalogue and its expiry for no reason. This reads the demo that
   already exists, tries to recover each product's real photograph from the
   store, fills what remains from the stock fallback when a key is present, and
   writes back only what changed: the images folder and the image field of
   products.json. Names, prices, categories, theme and expiry are not touched.

   THE ORDER IS THE SAME CONTRACT AS THE GENERATOR'S: the store's own
   photograph, then a stock photograph, then the drawn artwork. Stock only
   happens with UNSPLASH_ACCESS_KEY in the environment, which in practice means
   the refresh-images workflow, because the key is a repository secret.

   IDEMPOTENT ON PURPOSE. A product whose committed image file already exists is
   left alone, so running this twice costs one catalogue read and nothing else,
   and a partial failure can be re-run safely.
   ========================================================================== */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { catalogue } from './scrape/catalogue.mjs';
import { downloadImages, stripImageUrls } from './scrape/images.mjs';
import { stockImages } from './scrape/stock.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
    const index = process.argv.indexOf('--' + name);
    return index === -1 ? null : process.argv[index + 1];
}

const slug = arg('slug');
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error('usage: node factory/refresh-images.mjs --slug <slug>');
    process.exit(2);
}

const dest = join(ROOT, 'demos', slug);
if (!existsSync(join(dest, 'products.json'))) {
    console.error('demos/' + slug + '/products.json does not exist. Nothing to refresh.');
    process.exit(2);
}

const config = JSON.parse(readFileSync(join(dest, 'demo.config.json'), 'utf8'));
const shipped = JSON.parse(readFileSync(join(dest, 'products.json'), 'utf8'));
const products = shipped.products;

/* A committed image whose file is really on disk survives; a dangling reference
   is treated as absent, because a path with no file behind it is the broken
   tile this tool exists to remove. */
let kept = 0;
for (const product of products) {
    if (product.image && existsSync(join(dest, product.image))) { kept++; continue; }
    product.image = null;
}
console.error(kept + ' of ' + products.length + ' tiles already carry a committed photograph.');

/* THE REAL STORE FIRST. The catalogue is re-read only to recover image
   addresses, and products are matched by id, so a store that reordered or
   renamed since the demo was built can only ever fill tiles, never rewrite
   them. A store that refuses the read costs one honest failure line. */
if (products.some((product) => !product.image) && config.sourceUrl) {
    const fresh = await catalogue(config.sourceUrl, null, {});
    if (fresh.ok) {
        const byId = new Map(fresh.products.map((product) => [product.id, product.imageUrl]));
        let recovered = 0;
        for (const product of products) {
            if (product.image) continue;
            const url = byId.get(product.id);
            if (url) { product.imageUrl = url; recovered++; }
        }
        console.error('Store read ok via ' + fresh.tier + ': ' + recovered +
                      ' photograph address(es) recovered.');
        if (recovered) {
            const got = await downloadImages(products, join(dest, 'images'));
            console.error('Images: ' + got.downloaded + ' downloaded, ' + got.failed +
                          ' failed, via ' + got.compressor);
        }
    } else {
        console.error('The store could not be read (' +
                      (fresh.attempts || []).map((a) => a.tier + ': ' + (a.reason || 'no')).join(', ') +
                      '). Real photographs stay as they are.');
    }
}

/* THE STOCK FALLBACK, for whatever is still empty. Without a key this reports
   itself and changes nothing. */
const stock = await stockImages(products, join(dest, 'images'));
console.error('Stock: ' + stock.filled + ' filled' +
              (stock.reason ? ' (' + stock.reason + ')' : ''));

stripImageUrls(products);
writeFileSync(join(dest, 'products.json'), JSON.stringify(shipped, null, 2) + '\n');

const final = products.filter((product) => product.image).length;
console.log(JSON.stringify({
    slug,
    tiles: products.length,
    withPhotograph: final,
    artwork: products.length - final,
    stock: stock.filled
}));
