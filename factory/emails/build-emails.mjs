/* ============================================================================
   Builds one demo's email set from that demo's own theme and catalogue.

     node factory/emails/build-emails.mjs --slug <slug>
     node factory/emails/build-emails.mjs --all

   Writes demos/<slug>/emails/: ten journey messages, the AMP variant of the cart
   abandonment message, and a preview page that opens all of them side by side.

   IT READS WHAT THE DEMO ALREADY PUBLISHES and nothing else: demo.config.json for
   the theme, the store name and the currency, products.json for real products with
   real prices and their committed images. So an email cannot show a product the
   storefront does not have, or a price the scrape did not produce.

   IMAGES ARE ABSOLUTE, AND THEY HAVE TO BE. An email is read outside the site, so
   a relative path resolves against nothing. Every image points at the published
   demo on dengage-presales.github.io, which is one of the hosts the guard's
   off-origin-assets check allows, and the bytes are already committed next to the
   storefront rather than hotlinked from the prospect.

   THE PREVIEW PAGE IS FOR THE CALL. A presales colleague opens one address and
   shows ten themed messages without a send, an inbox or a test list. It is also
   how the theming gets checked: if a demo's colours are wrong, they are wrong on
   that page in one glance.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emailPalette } from './palette.mjs';
import { JOURNEYS, renderJourney } from './journeys.mjs';
import { ampCartAbandonment } from './amp.mjs';
import { COLUMNS, QUERIES } from './data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = 'https://dengage-presales.github.io/demo-ai/demos/';

/* Money the way the storefront formats it, from the same locale block, so an
   email and a product tile never disagree about a price. */
function money(locale, value) {
    if (typeof value !== 'number' || !isFinite(value)) return '';
    const symbol = (locale && locale.currencySymbol) || (locale && locale.currency) || '';
    const formatted = value.toLocaleString((locale && locale.numberLocale) || 'en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (symbol ? symbol + ' ' : '') + formatted;
}

/* One product, shaped for the layout components. A product with no price shows no
   price rather than a zero: Number(null) is 0, and a zero on a tile reads as free. */
function shape(product, base, locale) {
    const price = typeof product.discountedPrice === 'number'
        ? product.discountedPrice : product.price;
    return {
        name: product.name,
        meta: product.category || '',
        price: money(locale, price),
        image: product.image ? base + product.image : base + 'vendor/assets/placeholder.png',
        href: base + 'product.html?id=' + encodeURIComponent(product.id)
    };
}

/* THE STORE'S NAME AS A PERSON WOULD WRITE IT. demo.config.json's displayName is
   the browser tab text, which is the Dengage demo label rather than the store, and
   the slug is an address ("techiestore-in"). The source host's first label is the
   closest thing to the name the store calls itself, so "wrangler.in" reads
   "Wrangler" and "eyewa.com/ae-en" reads "Eyewa".

   This is a name in text, not a word mark or a logo, which non-negotiable 3 draws
   the line at: the masthead beside it is always the Dengage mark. */
function storeNameFrom(config, slug) {
    let host = '';
    try { host = new URL(config.sourceUrl).hostname; } catch (err) { host = ''; }
    const label = host.replace(/^www\./, '').split('.')[0] ||
        String(slug).replace(/-/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/* The sample sets each journey draws from. Deliberately taken from different
   points in the catalogue so a preview does not show the same three tiles in every
   message, which is what makes a themed set look unconsidered on a call. */
function context(config, products, slug, mode) {
    const base = PAGES + slug + '/';
    const locale = config.locale || {};
    const shaped = products.map((product) => shape(product, base, locale));
    const at = (from, count) => shaped.slice(from, from + count)
        .concat(shaped.slice(0, Math.max(0, count - shaped.slice(from, from + count).length)))
        .slice(0, count);

    return {
        /* Absolute, because amp4email refuses a relative href. See amp.mjs. The
           preview resolves it so a browser shows a link rather than a tag. */
        unsubscribe: base + 'unsubscribe.html?c=' +
            (mode === 'panel' ? '{%= $Contact.contact_key =%}' : 'DPS-1042'),
        storeName: storeNameFrom(config, slug),
        storeUrl: base,
        products: shaped,
        symbol: (locale.currencySymbol || locale.currency || ''),
        /* Preview stand-ins for the values that come from a query in panel mode.
           They are the demo's own data, never invented. */
        sampleFirstName: 'Alex',
        sampleCategory: (shaped[0] && shaped[0].meta) || 'that category',
        sampleQuery: (shaped[0] && shaped[0].name) ? shaped[0].name.split(' ').slice(0, 3).join(' ') : 'that item',
        sampleOrderRef: 'DPS-1042',
        hero: shaped[0] || { name: 'A product', meta: '', price: '', image: base, href: base },
        cart: at(0, 2),
        related: at(3, 3),
        similar: at(6, 3),
        trending: at(9, 3),
        discounted: at(12, 3)
    };
}

/* The preview page. Each message in an iframe at its real width, so what is on
   screen is the message rather than a screenshot of it. */
function previewPage(palette, built, slug, config) {
    const cards = built.map((item) => `
    <section class="msg">
      <header>
        <div>
          <h2>${item.journey}</h2>
          <p class="subj">${item.subject.replace(/\{%[^%]*%\}/g, '').trim()}</p>
        </div>
        <div class="links">
          <a href="${item.file}.html">Panel file</a>
          <a href="${item.preview}" class="amp">Preview</a>${item.amp ? `
          <a href="${item.file}.amp.preview.html" class="amp">AMP</a>` : ''}
        </div>
      </header>
      <iframe src="${item.preview}" title="${item.journey}" loading="lazy"></iframe>
      <p class="reads">${item.reads}</p>
    </section>`).join('');

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email set: ${slug}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;background:${palette.canvas};color:${palette.canvasText};
       font-family:${palette.body};padding:34px 18px 70px}
  .head{max-width:1180px;margin:0 auto 30px}
  h1{font-family:${palette.display};font-size:27px;margin:0 0 8px;color:${palette.canvasText}}
  .sub{margin:0;font-size:15px;color:${palette.canvasQuiet};max-width:70ch;line-height:1.6}
  .swatches{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
  .sw{font-size:11px;padding:5px 9px;border-radius:999px;border:1px solid ${palette.edge};
      background:${palette.card};color:${palette.text}}
  .grid{max-width:1180px;margin:0 auto;display:grid;
        grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:26px}
  .msg{background:${palette.card};border:1px solid ${palette.edge};
       border-radius:${palette.radius}px;overflow:hidden}
  .msg header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;
              padding:15px 17px;border-bottom:1px solid ${palette.edge}}
  h2{font-family:${palette.display};font-size:15px;margin:0 0 3px;color:${palette.text}}
  .subj{margin:0;font-size:13px;color:${palette.quiet}}
  .links{display:flex;flex-direction:column;gap:4px;text-align:right;white-space:nowrap}
  .links a{font-size:12px;color:${palette.brand};text-decoration:none}
  .links a:hover{text-decoration:underline}
  .links .amp{color:${palette.quiet}}
  iframe{display:block;width:100%;height:600px;border:0;background:${palette.canvas}}
  .reads{margin:0;padding:11px 17px 13px;font-size:12px;line-height:1.5;
         color:${palette.quiet};border-top:1px solid ${palette.edge}}
</style></head>
<body>
  <div class="head">
    <h1>Email set for ${slug}</h1>
    <p class="sub">Ten journey messages plus one AMP variant, themed from this demo's own
      palette, typography and catalogue. Every colour below was derived from
      demo.config.json and checked for contrast before it was written. Paste a file into
      the Dengage Code Editor, or the AMP one into the AMP tab beside it.</p>
    <div class="swatches">
      <span class="sw">brand ${palette.brand}</span>
      <span class="sw">on brand ${palette.onBrand}</span>
      <span class="sw">card ${palette.card}</span>
      <span class="sw">canvas ${palette.canvas}</span>
      <span class="sw">text ${palette.text}</span>
      <span class="sw">${palette.dark ? 'dark theme' : 'light theme'}</span>
      <span class="sw">${(config.theme || {}).displayFont || 'default face'}</span>
    </div>
  </div>
  <div class="grid">${cards}
  </div>
</body></html>
`;
}

/* AMP CANNOT TAKE A LOOP AS EASILY AS THE HTML CAN, because the validator has to
   see every amp-img with its dimensions. So the AMP variant renders a fixed
   number of rows, and in panel mode each row's values are Dengage tags reading
   the same shopping_cart_events row by index. Three rows covers the basket sizes
   a message should show; a longer basket is a link to the site rather than a list. */
function ampContext(ctx, mode) {
    if (mode !== 'panel') {
        return { ...ctx, ampCart: ctx.cart, greetingName: ctx.sampleFirstName };
    }
    const c = COLUMNS.cart;
    const rows = [0, 1, 2].map((index) => {
        const at = (column) => 'cartRows[' + index + '].' + column;
        return {
            name: '{% if (cartRows.length > ' + index + ') { %}{%= ' + at(c.name) + ' =%}{% } %}',
            meta: '{% if (cartRows.length > ' + index + ') { %}{%= ' + at(c.category) + ' =%}{% } %}',
            price: '{% if (cartRows.length > ' + index + ') { %}' + ctx.symbol +
                   ' {%= ' + at(c.price) + ' =%}{% } %}',
            image: ctx.storeUrl + '{% if (cartRows.length > ' + index + ') { %}{%= ' +
                   at(c.image) + ' =%}{% } %}',
            href: ctx.storeUrl + 'cart.html'
        };
    });
    return {
        ...ctx,
        ampPrelude: '{% var cartRows = ' + QUERIES.abandonedCart.expr + '; %}',
        ampCart: rows,
        greetingName: '{% if ($Contact.first_name) { %}{%= $Contact.first_name =%}' +
                      '{% } else { %}there{% } %}'
    };
}

export function buildEmails(slug) {
    const dest = join(ROOT, 'demos', slug);
    const configPath = join(dest, 'demo.config.json');
    const productsPath = join(dest, 'products.json');
    if (!existsSync(configPath)) throw new Error('no demo.config.json for ' + slug);

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const raw = existsSync(productsPath)
        ? (JSON.parse(readFileSync(productsPath, 'utf8')).products || [])
        : [];
    if (!raw.length) throw new Error('no products for ' + slug);

    const palette = emailPalette(config.theme);
    const ctxFor = (mode) => context(config, raw, slug, mode);
    const out = join(dest, 'emails');
    mkdirSync(out, { recursive: true });

    /* TWO FILES PER JOURNEY, FROM ONE SOURCE. The panel file is the deliverable and
       carries live queries; the preview is what gets shown on a call. Writing both
       from the same journey function is what stops them drifting. */
    const built = [];
    for (const journey of JOURNEYS) {
        const panel = renderJourney(journey, palette, ctxFor('panel'), 'panel');
        const preview = renderJourney(journey, palette, ctxFor('preview'), 'preview');
        writeFileSync(join(out, panel.file + '.html'), panel.html);
        writeFileSync(join(out, preview.file + '.preview.html'), preview.html);
        if (panel.amp) {
            writeFileSync(join(out, panel.file + '.amp.html'),
                ampCartAbandonment(palette, ampContext(ctxFor('panel'), 'panel'), 'panel'));
            writeFileSync(join(out, panel.file + '.amp.preview.html'),
                ampCartAbandonment(palette, ampContext(ctxFor('preview'), 'preview'), 'preview'));
        }
        built.push({ ...panel, preview: preview.file + '.preview.html' });
    }
    writeFileSync(join(out, 'index.html'), previewPage(palette, built, slug, config));

    return { slug, count: built.length, amp: built.filter((b) => b.amp).length, palette };
}

/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const flag = (name) => {
    const at = args.indexOf('--' + name);
    return at === -1 ? null : (args[at + 1] || true);
};

if (import.meta.url === 'file://' + process.argv[1]) {
    const slugs = args.includes('--all')
        ? readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
        : [flag('slug')].filter((value) => typeof value === 'string');

    if (!slugs.length) {
        console.error('usage: node factory/emails/build-emails.mjs --slug <slug> | --all');
        process.exit(2);
    }
    let failed = 0;
    for (const slug of slugs) {
        try {
            const result = buildEmails(slug);
            console.error('Emails: ' + result.count + ' for ' + slug +
                ', ' + result.amp + ' AMP, brand ' + result.palette.brand +
                (result.palette.dark ? ', dark theme' : ''));
        } catch (err) {
            failed++;
            console.error('Emails: skipped ' + slug + ' (' + err.message + ')');
        }
    }
    process.exit(failed === slugs.length ? 1 : 0);
}
