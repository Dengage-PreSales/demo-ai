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

   IT IMPORTS FINISHED. Dengage assigns an id when a Dynamic Content asset is saved, so
   for a while these were arguments and the template arrived with two dashed boxes to
   attach by hand. The ids are known now and are below: they are per account rather than
   per demo, so they never change again and nothing needs remembering.

   THEY ARE UUIDS, NOT NUMBERS. Dengage's own documentation shows snippet_id="8835",
   which is what this file assumed, and the panel issues a UUID. Both go in the same
   attribute as a string, so nothing had to change to accept one, but a numeric example is
   worth not copying. They live in factory/sandbox.json beside the app guid.

   Any of them can still be overridden, for a second account or a renamed asset:

     DPS_SNIPPET_CART=<id> DPS_SNIPPET_CART_TOTAL=<id> \
       DPS_SNIPPET_RECOMMENDATIONS=<id> DPS_SNIPPET_CART_LINE=<id> \
       node factory/emails/build-beefree.mjs

   ITS OWN SCRIPT, ON PURPOSE. The generator calls it, and it is runnable by hand for the
   case that actually comes up: a snippet id arriving, or the standard palette moving in
   template/style.css. The template is shared, so this is idempotent and safe to re-run.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emailPalette } from './palette.mjs';
import { dengageTheme } from './dengage-theme.mjs';
import { beefreeAbandonedCart, templateRows, dynamicModules } from './beefree.mjs';
import { previewBeefree, productRows, summaryRows } from './beefree-preview.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = 'https://dengage-presales.github.io/demo-ai/demos/';

/* THE TWO SAVED ASSETS, READ FROM factory/sandbox.json RATHER THAN WRITTEN HERE.

   Recorded rather than passed in, because they are per account and permanent, and
   because the whole point of the shared template is that a rebuild needs nothing
   remembered. They are content ids and not application ids: nothing sends to a device
   because of them.

   ONE PLACE, AND THAT PLACE IS THE ONE THE GUARD ALREADY READS. The app-guid check
   rejects every identifier in this repository that is not in sandbox.json, which is what
   keeps the core demos' application out. Putting the snippet ids in a literal here would
   have meant either failing that check or loosening it into a pattern. Naming them in the
   config keeps it an allowlist: these two pass, every other identifier still fails. */
function snippetIds() {
    const config = JSON.parse(readFileSync(join(ROOT, 'factory', 'sandbox.json'), 'utf8'));
    const named = config.snippets || {};
    return {
        items: named.abandonedCart || null,
        total: named.abandonedCartTotal || null,
        recommendations: named.recommendations || null,
        /* THE LINE ASSET, which is the plain text one line naming the basket. It feeds
           the preheader here, and the same saved asset feeds SMS, WhatsApp, push and the
           subject line. Null until it is created in the panel, and the preheader falls
           back to its static sentence rather than to a dashed box. */
        line: named.abandonedCartLine || null
    };
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
        /* FOUR MORE FROM THE SAME CATEGORIES, which is what the recommendation asset
           does with real rows: the ones after the basket's own, so the preview shows a
           rail that is plausibly what a send would pick rather than the basket again. */
        recommended: products.slice(4, 8).map((product) => ({
            name: product.name,
            category: product.category || '',
            image: product.image ? PAGES + product.slug + '/' + product.image : '',
            price: format(product.price),
            discounted: typeof product.discountedPrice === 'number'
                ? format(product.discountedPrice) : '',
            quantity: 1
        })),
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
    const configured = snippetIds();

    const template = beefreeAbandonedCart({
        palette,
        theme: dengageTheme(),
        /* Shared artwork, in assets/, because the hero is no longer per demo either. */
        heroImage: existsSync(join(ROOT, 'assets', 'email-hero-cart.jpg'))
            ? 'https://dengage-presales.github.io/demo-ai/assets/email-hero-cart.jpg'
            : '',
        snippets: snippets || {
            items: process.env.DPS_SNIPPET_CART || configured.items,
            total: process.env.DPS_SNIPPET_CART_TOTAL || configured.total,
            recommendations: process.env.DPS_SNIPPET_RECOMMENDATIONS || configured.recommendations,
            line: process.env.DPS_SNIPPET_CART_LINE || configured.line
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

    /* Keyed by module uuid, which is why the uuids are deterministic, and looked up by
       ASSET NAME rather than by position. Document order worked until the preheader
       became a fourth Dynamic Content block, at which point counting would have filled
       the basket module with the rail and drawn a plausible email in the wrong order
       without failing anything. */
    const blocks = dynamicModules(template);
    const filled = {};
    if (blocks.items && sample.basket.length) {
        filled[blocks.items] =
            '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
            'style="border-collapse:collapse;">' + productRows(sample.basket, palette) +
            '</table>';
    }
    if (blocks.recommendations && sample.recommended && sample.recommended.length) {
        filled[blocks.recommendations] =
            '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
            'style="border-collapse:collapse;font-family:inherit;color:inherit;">' +
            '<tr><td colspan="2" style="padding:0 0 4px 0;"><div style="border-top:1px solid ' +
            'rgba(128,128,128,0.18);width:100%;font-size:0;line-height:0;">&nbsp;</div>' +
            '</td></tr>' +
            '<tr><td colspan="2" align="center" style="padding:30px 0 26px 0;">' +
            '<div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;' +
            'opacity:0.5;padding:0 0 8px 0;">More like this</div>' +
            '<div style="font-size:20px;line-height:1.3;font-weight:bold;">' +
            'More from the same range</div></td></tr>' +
            productRows(sample.recommended, palette) + '</table>';
    }
    if (blocks.total) {
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
        filled[blocks.total] = (sample.totals
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
