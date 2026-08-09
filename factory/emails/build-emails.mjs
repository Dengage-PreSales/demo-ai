/* ============================================================================
   Builds one demo's email set from that demo's own theme and catalogue.

     node factory/emails/build-emails.mjs --slug <slug>
     node factory/emails/build-emails.mjs --all

   Writes factory/panel/content/<slug>/emails/: ten journey messages, the AMP variant
   of the cart abandonment message, and index.html, a console that shows all of them
   side by side with a copy button behind each one.

   NOT UNDER demos/, DELIBERATELY. pages.yml publishes index.html, assets, demos and
   feed, so anything written into a demo folder is served from a customer facing URL.
   These files name panel locations and carry sample data, which is setup material
   rather than something a prospect should be able to load. buildEmails says more.

   IT READS WHAT THE DEMO ALREADY PUBLISHES and nothing else: demo.config.json for
   the theme, the store name and the currency, products.json for real products with
   real prices and their committed images. So an email cannot show a product the
   storefront does not have, or a price the scrape did not produce.

   IMAGES ARE ABSOLUTE, AND THEY HAVE TO BE. An email is read outside the site, so
   a relative path resolves against nothing. Every image points at the published
   demo on dengage-presales.github.io, which is one of the hosts the guard's
   off-origin-assets check allows, and the bytes are already committed next to the
   storefront rather than hotlinked from the prospect.

   THE CONSOLE IS FOR SETUP AND FOR THE CALL. Opening index.html shows ten themed
   messages without a send, an inbox or a test list, and each one's panel source is one
   press away. It is also how the theming gets checked: if a demo's colours are wrong,
   they are wrong on that page in one glance. It is self contained, so it opens from
   disk with no server.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emailPalette } from './palette.mjs';
import { JOURNEYS, renderJourney } from './journeys.mjs';
import { ampCartAbandonment } from './amp.mjs';
import { sourceBox, copyScript } from '../panel/copy-console.mjs';
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

/* THE SETUP CONSOLE. One page that holds the rendered message AND the exact source
   behind a copy button, because the job this page exists for is moving eleven files
   into the panel rather than admiring them.

   It replaced a page of links. A link to a .html file opens a RENDERED email, so
   getting at the source meant view-source on every one of eleven files, eleven
   times per demo. The source is now inline and one click puts it on the clipboard.

   SELF CONTAINED ON PURPOSE, and this is the constraint that shapes the rest. These
   files are no longer published (see buildEmails), so this page is opened from disk.
   That rules out fetch, which file:// refuses, and it rules out iframe src pointing
   at a sibling file, which some browsers also refuse. So every source is embedded
   here and the previews are injected with srcdoc. Double clicking index.html works
   with no server, and python3 -m http.server works too.

   Sources live in a hidden <textarea> rather than a <script> block for one specific
   reason: the AMP file contains </script>, which would terminate a script block and
   truncate the source. A textarea holds it as text, and reading .value gives the
   bytes back exactly, entity decoding included. */
function sourceStore(built) {
    return built.map((item) => [
        sourceBox('p-' + item.file, item.file + '.html', item.panelHtml),
        sourceBox('v-' + item.file, item.file + '.preview.html', item.previewHtml),
        sourceBox('a-' + item.file, item.file + '.amp.html', item.ampPanel),
        sourceBox('w-' + item.file, item.file + '.amp.preview.html', item.ampPreview)
    ].join('')).join('');
}

function previewPage(palette, built, slug, config) {
    const slots = (item) => (item.html.match(/Placeholder, replace in the panel/g) || []).length;

    const cards = built.map((item) => {
        const count = slots(item);
        return `
    <section class="msg">
      <header>
        <div>
          <h2>${item.journey}</h2>
          <p class="subj">${item.subject.replace(/\{%[^%]*%\}/g, '').trim()}</p>
        </div>
        <div class="acts">
          <button class="copy" data-src="p-${item.file}">Copy panel HTML</button>${item.amp ? `
          <button class="copy alt" data-src="a-${item.file}">Copy AMP</button>` : ''}
          <span class="fname">${item.file}.html</span>
        </div>
      </header>
      <iframe data-src="v-${item.file}" title="${item.journey}" loading="lazy"></iframe>
      <p class="reads"><b>Reads:</b> ${item.reads}${count ? `
        <br><b>By hand:</b> ${count} recommendation block${count === 1 ? '' : 's'} to place with
        Insert &gt; Dynamic Content &gt; Product Box. The dashed box in the message names the
        model to choose.` : ''}</p>
    </section>`;
    }).join('');

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
  .acts{display:flex;flex-direction:column;gap:6px;align-items:flex-end;white-space:nowrap}
  .copy{font:inherit;font-size:12px;font-weight:bold;cursor:pointer;padding:7px 12px;
        border-radius:6px;border:1px solid ${palette.brand};
        background:${palette.brand};color:${palette.onBrand}}
  .copy:hover{filter:brightness(0.94)}
  .copy.alt{background:transparent;color:${palette.brandText};border-color:${palette.edge}}
  .copy.done{background:${palette.wash};color:${palette.brandText};border-color:${palette.brandText}}
  .fname{font-size:11px;color:${palette.quiet}}
  iframe{display:block;width:100%;height:600px;border:0;background:${palette.canvas}}
  .reads{margin:0;padding:11px 17px 13px;font-size:12px;line-height:1.5;
         color:${palette.quiet};border-top:1px solid ${palette.edge}}
</style></head>
<body>
  <div class="head">
    <h1>Email set for ${slug}</h1>
    <p class="sub">Ten journey messages plus one AMP variant, themed from this demo's own
      palette, typography and catalogue. Every colour below was derived from
      demo.config.json and checked for contrast before it was written.</p>
    <p class="sub">Press <b>Copy panel HTML</b> and paste straight into the Dengage Code
      Editor, or <b>Copy AMP</b> into the AMP tab beside it. What you copy is the panel
      version, carrying the live queries; the message on screen is the preview, with
      sample data, which is what to show on a call.</p>
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
  </div>${sourceStore(built)}${copyScript()}
</body></html>
`;
}

/* AMP CANNOT TAKE A LOOP AS EASILY AS THE HTML CAN, because the validator has to
   see every amp-img with its dimensions. So the AMP variant renders a fixed
   number of rows, and in panel mode each row's values are Dengage tags reading
   the same shopping_cart_events row by index. Three rows covers the basket sizes
   a message should show; a longer basket is a link to the site rather than a list. */
/* THE AMP CAROUSEL CANNOT HOLD A PRODUCT BOX, so it holds a real query instead.
   Insert > Dynamic Content is a builder action on the HTML tab; the AMP tab is hand
   written and validated on save, so there is nowhere for the engine's block to go.
   Rather than freeze three catalogue products into a swipeable strip, the carousel
   shows the contact's own saved items, which is a table this module can genuinely
   read (wishlist_events) and is personal without the engine.

   Indexed access rather than a loop, for the same reason the cart rows below use it:
   the validator runs against the unresolved template, so every amp-img has to exist
   in the document with explicit dimensions before any tag resolves. The guard wraps
   the whole slide so an absent row emits no slide at all rather than an empty tile. */
function ampSlots(ctx, spec, variable, count) {
    const c = spec;
    return Array.from({ length: count }, (unused, index) => {
        const at = (column) => variable + '[' + index + '].' + column;
        const open = '{% if (' + variable + '.length > ' + index + ') { %}';
        return {
            open, close: '{% } %}',
            name: '{%= ' + at(c.name) + ' =%}',
            price: ctx.symbol + ' {%= ' + at(c.price) + ' =%}',
            image: ctx.storeUrl + '{%= ' + at(c.image) + ' =%}',
            href: ctx.storeUrl + 'wishlist.html'
        };
    });
}

function ampContext(ctx, mode) {
    if (mode !== 'panel') {
        return {
            ...ctx, ampCart: ctx.cart, greetingName: ctx.sampleFirstName,
            ampSlides: ctx.similar.slice(0, 3)
        };
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
        ampPrelude: '{% var cartRows = ' + QUERIES.abandonedCart.expr + '; %}' +
                    '{% var savedRows = ' + QUERIES.savedItems.expr + '; %}',
        ampCart: rows,
        ampSlides: ampSlots(ctx, COLUMNS.wishlist, 'savedRows', QUERIES.savedItems.take),
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

    /* THE DEMO FOLDER IS THE INPUT. THE OUTPUT GOES TO THE FACTORY, and that is a
       rule rather than a preference.

       pages.yml publishes an allowlist, index.html assets demos feed, so anything
       written under demos/ is served from a customer facing URL. These files are
       setup material: they name panel locations and carry sample data. Serving that
       from a demo a prospect is looking at is the same category the 6 August audit
       removed from the published site, so they belong beside factory/creatives/,
       the other content that is pasted into the panel and never served.

       Co-location bought nothing anyway. Every image URL in these files is absolute,
       because an email client fetches it remotely rather than relative to a page, so
       the files resolve identically from any folder. */
    const out = join(ROOT, 'factory', 'panel', 'content', slug, 'emails');
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
        let ampPanel = null;
        let ampPreview = null;
        if (panel.amp) {
            ampPanel = ampCartAbandonment(palette, ampContext(ctxFor('panel'), 'panel'), 'panel');
            ampPreview = ampCartAbandonment(palette, ampContext(ctxFor('preview'), 'preview'), 'preview');
            writeFileSync(join(out, panel.file + '.amp.html'), ampPanel);
            writeFileSync(join(out, panel.file + '.amp.preview.html'), ampPreview);
        }
        /* The sources travel with the entry so index.html can carry them inline and
           hand them to a copy button. Same strings that were just written to disk. */
        built.push({ ...panel, preview: preview.file + '.preview.html',
                     panelHtml: panel.html, previewHtml: preview.html, ampPanel, ampPreview });
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
