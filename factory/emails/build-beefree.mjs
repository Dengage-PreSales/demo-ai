/* ============================================================================
   Writes one demo's BeeFree template, ready to import into the Email Builder.

     node factory/emails/build-beefree.mjs --slug <slug>
     node factory/emails/build-beefree.mjs --all

   Output: factory/panel/content/<slug>/emails/beefree-abandoned-cart.json

   In the panel: Content > Email > New > Email Builder, then the import control, then
   choose that file. The demo's brand colour, typeface, currency and store name are
   already in it, and the two Dynamic Content blocks are already in position.

   WITH SNIPPET IDS IT IMPORTS FINISHED. Dengage assigns snippet_id when a Dynamic
   Content asset is saved, so nothing here can know it. Pass what the panel shows and
   both blocks become real tags:

     DPS_SNIPPET_CART=8835 DPS_SNIPPET_CART_TOTAL=8836 \
       node factory/emails/build-beefree.mjs --slug <slug>

   Without them each block imports as a labelled dashed box naming the asset that goes
   there, which is visible in the builder and one click from the picker.

   ITS OWN SCRIPT, ON PURPOSE. build-emails.mjs builds the ten Code Editor messages and
   currently throws on the journeys that still ask an event table for a product name,
   which is a separate job. A template that could only be produced by a command that
   fails would not be a deliverable. That script calls this one, so nothing has to be
   remembered twice.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emailPalette } from './palette.mjs';
import { beefreeAbandonedCart, templateRows } from './beefree.mjs';
import { previewBeefree, productRows, summaryRows } from './beefree-preview.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = 'https://dengage-presales.github.io/demo-ai/demos/';

/* THE STORE'S NAME AS A PERSON WOULD WRITE IT, from the source host rather than
   displayName, which is the Dengage demo label. Same derivation build-emails.mjs uses,
   so the two never disagree about the name beside the mark. A name in text is not a
   word mark: non-negotiable 3 draws the line at the logo, and the mark here is always
   Dengage. */
function storeNameFrom(config, slug) {
    let host = '';
    try { host = new URL(config.sourceUrl).hostname; } catch (err) { host = ''; }
    const label = host.replace(/^www\./, '').split('.')[0] ||
        String(slug).replace(/-/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/* THE PREVIEW'S SAMPLE BASKET, FROM THE DEMO'S OWN CATALOGUE. Four products, because
   four is the number that exposed the old cap and is what a real basket looks like.
   Prices are formatted the way the storefront formats them, from the same locale block,
   and a product the scrape gave no price shows none: Number(null) is 0 and a zero on a
   tile reads as free, which is non-negotiable 5 and a defect that has shipped twice. */
function sampleBasket(products, locale) {
    const format = (value) => (typeof value === 'number' && isFinite(value))
        ? value.toLocaleString(locale.numberLocale || 'en-US',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

    const basket = products.slice(0, 4).map((product, index) => ({
        name: product.name,
        category: product.category || '',
        image: product.image
            ? PAGES + product.slug + '/' + product.image
            : '',
        price: format(product.price),
        discounted: typeof product.discountedPrice === 'number'
            ? format(product.discountedPrice) : '',
        /* One line with a quantity above one, because that path renders differently
           and a preview that never shows it cannot reveal it is broken. */
        quantity: index === 1 ? 2 : 1,
        rawPrice: product.price,
        rawDiscounted: product.discountedPrice
    }));

    /* The same arithmetic and the same refusal as abandoned-cart-total.html: one
       unpriced line and there is no honest total, so there is no summary. */
    let subtotal = 0;
    let discount = 0;
    let priced = basket.length > 0;
    for (const line of basket) {
        const full = Number(line.rawPrice);
        if (!isFinite(full) || full <= 0) { priced = false; break; }
        let now = full;
        const cut = Number(line.rawDiscounted);
        if (line.rawDiscounted != null && isFinite(cut) && cut > 0 && cut < full) now = cut;
        subtotal += full * line.quantity;
        discount += (full - now) * line.quantity;
    }

    return {
        basket,
        totals: priced ? {
            subtotal: format(subtotal),
            discount: discount > 0 ? format(discount) : '',
            total: format(subtotal - discount)
        } : null
    };
}

export function buildBeefree(slug, snippets) {
    const configPath = join(ROOT, 'demos', slug, 'demo.config.json');
    if (!existsSync(configPath)) throw new Error('no demo.config.json for ' + slug);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    const palette = emailPalette(config.theme);
    const locale = config.locale || {};
    const storeUrl = PAGES + slug + '/';

    const template = beefreeAbandonedCart({
        palette,
        theme: config.theme || {},
        storeName: storeNameFrom(config, slug),
        storeUrl,
        /* The panel's own tag, so a real send unsubscribes the recipient rather than
           a sample contact. It is the one Dengage expression in the file. */
        unsubscribe: storeUrl + 'unsubscribe.html?c={%= $Contact.contact_key %}',
        symbol: locale.currencySymbol || '',
        currency: locale.currency || '',
        snippets: snippets || {
            items: process.env.DPS_SNIPPET_CART || null,
            total: process.env.DPS_SNIPPET_CART_TOTAL || null
        }
    });

    const out = join(ROOT, 'factory', 'panel', 'content', slug, 'emails');
    mkdirSync(out, { recursive: true });
    const file = join(out, 'beefree-abandoned-cart.json');
    writeFileSync(file, JSON.stringify(template, null, 2) + '\n');

    /* AND A PREVIEW, BECAUSE A JSON FILE CANNOT BE LOOKED AT. This is how the theming
       gets checked before anything is uploaded: if a demo's colours or typeface came
       out wrong, they are wrong on that page in one glance. Handoff 9 and CLAUDE.md 4,
       verify in a browser rather than by reading a diff. */
    const productsPath = join(ROOT, 'demos', slug, 'products.json');
    const products = existsSync(productsPath)
        ? (JSON.parse(readFileSync(productsPath, 'utf8')).products || [])
            .map((product) => ({ ...product, slug }))
        : [];
    const sample = sampleBasket(products, locale);

    /* Keyed by module uuid, which is why the uuids are deterministic. The two HTML
       modules are the first and second in document order. */
    const htmlModules = [];
    for (const templateRow of templateRows(template)) {
        for (const column of templateRow.columns) {
            for (const module of column.modules) {
                if (module.descriptor && module.descriptor.html) htmlModules.push(module.uuid);
            }
        }
    }
    const filled = {};
    if (htmlModules[0] && sample.basket.length) {
        filled[htmlModules[0]] =
            '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
            'style="border-collapse:collapse;">' + productRows(sample.basket, palette) +
            '</table>';
    }
    if (htmlModules[1]) {
        filled[htmlModules[1]] = sample.totals
            ? '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
              'style="border-collapse:collapse;font-family:inherit;color:inherit;">' +
              summaryRows(sample.totals, palette) + '</table>'
            : '';
    }

    writeFileSync(join(out, 'beefree-abandoned-cart.preview.html'),
        previewBeefree(template, { palette, filled }));

    return {
        slug,
        file,
        rows: templateRows(template).length,
        brand: palette.brand,
        currency: locale.currencySymbol || locale.currency || '',
        resolved: Boolean(templateRows(template).some((row) => row.columns.some((column) =>
            column.modules.some((module) =>
                module.descriptor && module.descriptor.html &&
                module.descriptor.html.html.indexOf('<snippet') === 0))))
    };
}

/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);

if (import.meta.url === 'file://' + process.argv[1]) {
    const at = args.indexOf('--slug');
    const slugs = args.includes('--all')
        ? readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
        : (at === -1 ? [] : [args[at + 1]]).filter(Boolean);

    if (!slugs.length) {
        console.error('usage: node factory/emails/build-beefree.mjs --slug <slug> | --all');
        process.exit(2);
    }

    let failed = 0;
    for (const slug of slugs) {
        try {
            const result = buildBeefree(slug);
            console.error('BeeFree: ' + slug + ', ' + result.rows + ' rows, brand ' +
                result.brand + (result.currency ? ', ' + result.currency : '') +
                (result.resolved ? ', snippet ids applied'
                                 : ', Dynamic Content left as placeholders'));
        } catch (err) {
            failed++;
            console.error('BeeFree: skipped ' + slug + ' (' + err.message + ')');
        }
    }
    process.exit(failed === slugs.length ? 1 : 0);
}
