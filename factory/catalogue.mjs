/* ============================================================================
   A committed demo's products, as the dps_product rows Dengage holds for it.

     import { demoWithProducts, asProductRows } from './catalogue.mjs';
     const demo = demoWithProducts();
     const rows = asProductRows(demo.slug, demo.list);

   WHY THIS IS SHARED RATHER THAN COPIED. Two builders render against a real catalogue:
   the scenario emails, to write a .preview.html beside each one, and the short form assets,
   to show what an SMS and a push actually say before anybody pastes them into the panel.
   Both need the same translation, and a second copy of it would be a second answer to
   "what does the ETL put in this column", which is the question the previews exist to
   answer honestly.

   NO PRICE IS INVENTED HERE. A product the scrape gave no price for gets none, so a
   preview shows a card with no price exactly as a send would. CLAUDE.md rule 5, and
   Number(null) being 0 is the trap it exists for.
   ========================================================================== */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ORIGIN = 'https://dengage-presales.github.io/demo-ai/';

/* A DEMO WITH PHOTOGRAPHS FIRST, and that is not cosmetic. The first pass of this picked
   whichever demo sorted first, which is the one whose scrape found no product photography
   at all, so every preview came out with zero images and looked like the card markup was
   broken. A preview of the case that hides the main feature is a preview nobody can check
   anything against. */
export function demoWithProducts() {
    const dir = join(ROOT, 'demos');
    if (!existsSync(dir)) return null;
    const found = [];
    for (const slug of readdirSync(dir).sort()) {
        const path = join(dir, slug, 'products.json');
        if (!existsSync(path)) continue;
        const payload = JSON.parse(readFileSync(path, 'utf8'));
        const list = Array.isArray(payload) ? payload : (payload.products || []);
        if (list.length) found.push({ slug, list, images: list.filter((p) => p.image).length });
    }
    if (!found.length) return null;
    found.sort((a, b) => b.images - a.images);
    return found[0];
}

/* products.json into dps_product rows, the way the ETL does: absolute link and image_link,
   category_path, and a price only where the scrape produced one. */
export function asProductRows(slug, list) {
    const base = ORIGIN + 'demos/' + slug + '/';
    return list.map((product) => ({
        product_id: String(product.id),
        title: product.name,
        price: product.price === null || product.price === undefined ? null : String(product.price),
        discounted_price: product.discountedPrice === null || product.discountedPrice === undefined
            ? null : String(product.discountedPrice),
        image_link: product.image ? base + product.image : null,
        link: base + 'product.html?id=' + encodeURIComponent(String(product.id)),
        category_path: product.category || '',
        stock_count: product.stockCount === null || product.stockCount === undefined
            ? null : Number(product.stockCount),
        is_active: true
    }));
}
