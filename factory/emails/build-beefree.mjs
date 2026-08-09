/* ============================================================================
   Writes the shared BeeFree template, ready to import into the Email Builder.

     node factory/emails/build-beefree.mjs

   Output: factory/panel/content/_shared/beefree-abandoned-cart.json
           factory/panel/content/_shared/beefree-abandoned-cart.preview.html

   In the panel: Content > Email > New > Email Builder, then the import control, then
   choose that file. **Once, not once per demo.**

   ONE TEMPLATE FOR EVERY DEMO, settled 9 August 2026, Salil's call. It used to be
   generated per demo and carried that demo's brand colour, typeface, store name,
   category nav and currency. The problem is a split in timing: the chrome is baked when
   the demo is built, because an email carries no custom properties and no stylesheet,
   while the basket inside it is resolved when the email is sent, from whichever
   storefront the visitor last touched. So a template named and themed for one demo can
   wrap another demo's basket. It did: a Techiestore masthead and a laptop nav around
   four garments, above "All prices in (INR)" against dollar prices.

   A shell that names no store cannot contradict a basket. So the template is drawn in
   the standard Dengage demo palette, and everything that identified a storefront is
   gone: the store name, the nav, the currency line and the link to the store. What is
   left is what was always the point, which is real products at real prices out of the
   visitor's own basket.

   THE BUTTON MOVED INTO THE SAVED ASSET for the same reason. A basket link needs a demo
   in it, and a BeeFree button module holds one literal href, so in a shared template it
   could only ever point at the wrong storefront. The asset already works out which demo
   the basket belongs to, so it is the only thing that can address the right basket, and
   it builds the URL from the page the visitor was actually on rather than from a
   hardcoded origin.

   WITH SNIPPET IDS IT IMPORTS FINISHED. Dengage assigns snippet_id when a Dynamic
   Content asset is saved, so nothing here can know it. Pass what the panel shows and
   both blocks become real tags:

     DPS_SNIPPET_CART=8835 DPS_SNIPPET_CART_TOTAL=8836 \
       node factory/emails/build-beefree.mjs

   Without them each block imports as a labelled dashed box naming the asset that goes
   there, which is visible in the builder and one click from the picker.

   ITS OWN SCRIPT, ON PURPOSE. build-emails.mjs builds the ten Code Editor messages and
   currently throws on the journeys that still ask an event table for a product name,
   which is a separate job. A template that could only be produced by a command that
   fails would not be a deliverable.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emailPalette } from './palette.mjs';
import { dengageTheme } from './dengage-theme.mjs';
import { beefreeAbandonedCart, templateRows } from './beefree.mjs';
import { previewBeefree, productRows, summaryRows } from './beefree-preview.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = 'https://dengage-presales.github.io/demo-ai/demos/';

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

export function buildBeefree(snippets) {
    /* THE STANDARD DENGAGE PALETTE, read out of template/style.css rather than written
       down, so the email and a demo with no theme of its own cannot disagree. */
    const palette = emailPalette(dengageTheme());

    const template = beefreeAbandonedCart({
        palette,
        theme: dengageTheme(),
        /* Shared artwork, in assets/, because the hero is no longer per demo either. */
        heroImage: existsSync(join(ROOT, 'assets', 'email-hero-cart.jpg'))
            ? 'https://dengage-presales.github.io/demo-ai/assets/email-hero-cart.jpg'
            : '',
        snippets: snippets || {
            items: process.env.DPS_SNIPPET_CART || null,
            total: process.env.DPS_SNIPPET_CART_TOTAL || null
        }
    });

    const out = join(ROOT, 'factory', 'panel', 'content', '_shared');
    mkdirSync(out, { recursive: true });
    const file = join(out, 'beefree-abandoned-cart.json');
    writeFileSync(file, JSON.stringify(template, null, 2) + '\n');

    /* AND A PREVIEW, BECAUSE A JSON FILE CANNOT BE LOOKED AT. Handoff 9 and CLAUDE.md 4,
       verify in a browser rather than by reading a diff.

       ITS SAMPLE BASKET COMES FROM A REAL DEMO, and it has to come from somewhere: the
       template is shared, so there is no one catalogue behind it. The first demo with
       product images is used, purely so the proportions can be judged against real
       photographs and real prices. Nothing about that demo reaches the template. */
    const demos = readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    let sample = { basket: [], totals: null };
    let sampledFrom = '';
    for (const slug of demos) {
        const productsPath = join(ROOT, 'demos', slug, 'products.json');
        const configPath = join(ROOT, 'demos', slug, 'demo.config.json');
        if (!existsSync(productsPath) || !existsSync(configPath)) continue;
        const products = (JSON.parse(readFileSync(productsPath, 'utf8')).products || [])
            .map((product) => ({ ...product, slug }));
        if (!products.some((product) => product.image)) continue;
        const locale = JSON.parse(readFileSync(configPath, 'utf8')).locale || {};
        sample = sampleBasket(products, locale);
        sampledFrom = slug;
        break;
    }

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
        /* The summary block carries the button now, so the preview has to as well or it
           would show an email with no call to action in it. */
        const button =
            '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
            'style="border-collapse:collapse;font-family:inherit;"><tr>' +
            '<td align="center" style="padding:' + (sample.totals ? 22 : 0) + 'px 0 0 0;">' +
            '<a href="#" style="display:inline-block;background-color:' + palette.brand +
            ';color:' + palette.onBrand + ';font-family:inherit;font-size:16px;' +
            'font-weight:bold;line-height:1.2;padding:14px 30px;border-radius:' +
            palette.radius + 'px;text-decoration:none;">Return to your basket</a></td></tr>' +
            '<tr><td align="center" style="padding:12px 0 0 0;font-family:inherit;' +
            'font-size:13px;line-height:1.5;"><a href="#" style="color:inherit;' +
            'opacity:0.65;text-decoration:underline;">or keep browsing the store</a>' +
            '</td></tr></table>';
        filled[htmlModules[1]] = (sample.totals
            ? '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
              'style="border-collapse:collapse;font-family:inherit;color:inherit;">' +
              summaryRows(sample.totals, palette) + '</table>'
            : '') + button;
    }

    writeFileSync(join(out, 'beefree-abandoned-cart.preview.html'),
        previewBeefree(template, { palette, filled }));

    return {
        file,
        rows: templateRows(template).length,
        brand: palette.brand,
        sampledFrom,
        resolved: Boolean(templateRows(template).some((row) => row.columns.some((column) =>
            column.modules.some((module) =>
                module.descriptor && module.descriptor.html &&
                module.descriptor.html.html.indexOf('<snippet') !== -1))))
    };
}

/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);

if (import.meta.url === 'file://' + process.argv[1]) {
    try {
        const result = buildBeefree();
        console.error('BeeFree: shared template, ' + result.rows + ' rows, brand ' +
            result.brand +
            (result.sampledFrom ? ', preview sampled from ' + result.sampledFrom : '') +
            (result.resolved ? ', snippet ids applied'
                             : ', Dynamic Content left as placeholders'));
    } catch (err) {
        console.error('BeeFree: failed (' + err.message + ')');
        process.exit(1);
    }
}
