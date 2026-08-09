/* ============================================================================
   The BeeFree template, checked against the things that make it importable.

     node factory/emails/beefree.test.mjs

   WHY A TEST FOR A FILE SOMEBODY UPLOADS BY HAND. A BeeFree import either succeeds or
   fails silently in part: a module whose type name is wrong is dropped, a row whose
   columns do not sum to twelve reflows, and a duplicate uuid makes the builder edit
   two blocks at once. None of that produces an error message. It produces a template
   that looks nearly right in the one place nobody has time to check it, which is on a
   call.

   So the structural invariants are asserted here, and so are the four rules that
   matter more than structure: the mark is Dengage, the currency is stated once because
   no shared asset can print a symbol, the Dynamic Content blocks are HTML modules
   rather than text modules, and every colour pair clears the contrast bar the rest of
   the factory uses.
   ========================================================================== */

import { beefreeAbandonedCart, templateRows } from './beefree.mjs';
import { emailPalette } from './palette.mjs';
import { parseHex, contrast } from '../scrape/theme.mjs';

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

const TYPES = [
    'mailup-bee-newsletter-modules-text',
    'mailup-bee-newsletter-modules-html',
    'mailup-bee-newsletter-modules-button',
    'mailup-bee-newsletter-modules-divider',
    'mailup-bee-newsletter-modules-image'
];

const THEME = {
    primary: '#ff8c00', onPrimary: '#000000', ink: '#333333', muted: '#7d7d7d',
    surface: '#f5f5f7', page: '#ffffff', line: '#dededf', radius: '5px',
    displayFont: 'DM Sans', bodyFont: 'DM Sans'
};

function build(overrides) {
    const theme = { ...THEME, ...((overrides && overrides.theme) || {}) };
    const palette = emailPalette(theme);
    return {
        palette,
        template: beefreeAbandonedCart({
            palette,
            theme,
            storeName: 'Techiestore',
            storeUrl: 'https://dengage-presales.github.io/demo-ai/demos/techiestore-in/',
            unsubscribe: 'https://dengage-presales.github.io/demo-ai/demos/' +
                'techiestore-in/unsubscribe.html?c={%= $Contact.contact_key %}',
            symbol: overrides && 'symbol' in overrides ? overrides.symbol : '₹',
            currency: overrides && 'currency' in overrides ? overrides.currency : 'INR',
            snippets: (overrides && overrides.snippets) || {},
            categories: overrides && 'categories' in overrides ? overrides.categories
                : ['Laptop Keyboard', 'Laptop Battery', 'Mouse', 'More'],
            heroImage: overrides && 'heroImage' in overrides ? overrides.heroImage
                : 'https://dengage-presales.github.io/demo-ai/demos/techiestore-in/images/email-hero.jpg'
        })
    };
}

function walk(template) {
    const out = { rows: [], modules: [], uuids: [] };
    for (const row of templateRows(template)) {
        out.rows.push(row);
        out.uuids.push(row.uuid);
        for (const column of row.columns) {
            out.uuids.push(column.uuid);
            for (const module of column.modules) {
                out.uuids.push(module.uuid);
                out.modules.push(module);
            }
        }
    }
    return out;
}

/* -------------------------------------------------------------------------- */
/* Structure, which is what an import silently punishes                        */

{
    const { template } = build();
    const { rows, modules, uuids } = walk(template);

    ok('it declares the template BeeFree expects',
       template.page.template.name === 'template-base' &&
       template.page.template.version === '2.0.0', template.page.template);
    ok('the body is a fixed width layout',
       template.page.body.type === 'mailup-bee-newsletter-layout-fixed-width');
    ok('at 600px, and every row agrees',
       template.page.body.content.computedStyle.messageWidth === '600px' &&
       rows.every((row) => row.content.style.width === '600px'));

    /* THE DEFECT THAT IMPORTED AN EMPTY CANVAS. The first version put the rows under
       page.body only. The builder reads page.rows, found nothing, and drew "Drop
       content blocks here" with no error at all, which is this format's whole failure
       mode: a template it cannot read arrives blank rather than complaining.

       Both paths are asserted because both are emitted, and they must be the same rows
       rather than two drifting copies. */
    ok('the rows are at page.rows, where the builder looks',
       Array.isArray(template.page.rows) && template.page.rows.length > 0,
       template.page.rows && template.page.rows.length);
    ok('and mirrored under page.body for a build that reads there instead',
       JSON.stringify(template.page.body.rows) === JSON.stringify(template.page.rows));
    ok('a template with rows in neither place reads as empty rather than throwing',
       templateRows({ page: {} }).length === 0);
    ok('and the reader finds them under body when that is all there is',
       templateRows({ page: { body: { rows: [1, 2] } } }).length === 2);

    const wrong = modules.filter((module) => TYPES.indexOf(module.type) === -1);
    ok('every module is a type BeeFree knows', wrong.length === 0,
       wrong.map((m) => m.type));

    const badGrid = rows.filter((row) =>
        row.columns.reduce((sum, column) => sum + column['grid-columns'], 0) !== 12);
    ok('every row\'s columns sum to twelve', badGrid.length === 0,
       badGrid.map((r) => r.uuid));

    ok('every uuid is unique, so the builder edits one block at a time',
       new Set(uuids).size === uuids.length,
       uuids.length - new Set(uuids).size);

    ok('every module carries a descriptor and a style',
       modules.every((module) => module.descriptor && module.descriptor.style));

    /* Two builds of one demo must produce the same bytes, or every rebuild shows as a
       change and nobody can see a real one. */
    ok('the output is deterministic',
       JSON.stringify(build().template) === JSON.stringify(build().template));
}

/* -------------------------------------------------------------------------- */
/* The two Dynamic Content blocks, which are the point of the file              */

{
    const { template } = build();
    const html = walk(template).modules.filter((module) => module.descriptor.html);

    ok('there are exactly two Dynamic Content blocks', html.length === 2, html.length);

    /* A TEXT MODULE WOULD BREAK THEM. BeeFree runs a text module's content through its
       rich text editor, which escapes or reflows a Dengage tag. */
    ok('both are HTML modules, not text modules',
       html.every((module) => module.type === 'mailup-bee-newsletter-modules-html'));

    ok('without ids, each names the asset that belongs there',
       html[0].descriptor.html.html.includes('dps abandoned cart') &&
       html[1].descriptor.html.html.includes('dps abandoned cart total'));
    ok('and says how to attach it, rather than being an invisible comment',
       html.every((module) =>
           module.descriptor.html.html.includes('Insert &gt; Dynamic Content') &&
           module.descriptor.html.html.indexOf('<!--') === -1));

    const resolved = walk(build({ snippets: { items: '8835', total: '8836' } }).template)
        .modules.filter((module) => module.descriptor.html);
    ok('with ids, each becomes a real snippet tag',
       resolved[0].descriptor.html.html ===
           '<snippet snippet_id="8835" snippet_name="dps abandoned cart"></snippet>' &&
       resolved[1].descriptor.html.html ===
           '<snippet snippet_id="8836" snippet_name="dps abandoned cart total"></snippet>',
       resolved.map((m) => m.descriptor.html.html));
    ok('and the placeholder is gone',
       resolved.every((module) => module.descriptor.html.html.indexOf('dashed') === -1));
}

/* -------------------------------------------------------------------------- */
/* The rules that outrank the layout                                           */

{
    const { template } = build();
    const text = JSON.stringify(template);

    /* NON-NEGOTIABLE 3. The mark is Dengage with the eComm Demo subtext, and the
       store's name appears only as text beside it. */
    ok('the masthead is the Dengage mark with its subtext',
       text.includes('Dengage') && text.includes('eComm Demo'));
    ok('and no image is embedded at all, so no logo can be the wrong one',
       text.indexOf('<img') === -1);

    /* NON-NEGOTIABLE 10, and the same reason the closing tag below is assembled: the
       guard sweeps this file for those two characters, so writing them in the pattern
       would fail the guard on the check for them. Escapes, not literals. */
    const longDashes = new RegExp('[\\u2013\\u2014]', 'g');
    ok('no em dash and no en dash',
       !longDashes.test(text), (text.match(longDashes) || []).slice(0, 3));

    /* The currency, stated once, because neither shared asset can print a symbol.
       COUNTED OVER THE MODULES RATHER THAN THE SERIALISED FILE. The rows are emitted at
       two paths on purpose, so every string in the document appears twice and a naive
       count of the JSON text reports two of everything. */
    const moneyLines = (template) => walk(template).modules
        .filter((module) => module.descriptor.text &&
            module.descriptor.text.html.includes('All prices in'));

    ok('the currency is stated once', moneyLines(template).length === 1,
       moneyLines(template).length);
    ok('and it names both the symbol and the code',
       moneyLines(template)[0].descriptor.text.html.includes('₹ (INR)'));

    ok('a demo whose locale names neither gets no currency line',
       moneyLines(build({ symbol: '', currency: '' }).template).length === 0);
    ok('a symbol with no code still reads correctly',
       moneyLines(build({ symbol: '₹', currency: '' }).template)[0]
           .descriptor.text.html.includes('All prices in ₹.'));

    /* THE BUTTON GOES TO A PAGE THAT EXISTS, and the first version did not. A demo is
       index.html and product.html; the basket is an overlay on the first one, so
       cart.html was a 404 and the primary call to action in the whole email landed on
       one. It now asks the storefront to open the basket from the URL. */
    const button = walk(template).modules.find((module) => module.descriptor.button);
    ok('the button opens the demo\'s basket, on a page that exists',
       button.descriptor.button.href ===
       'https://dengage-presales.github.io/demo-ai/demos/techiestore-in/index.html?open=cart',
       button.descriptor.button.href);
    ok('and names no page the storefront does not have',
       !/\/(cart|checkout|wishlist|account|search)\.html/.test(text),
       (text.match(/\/[a-z]+\.html/g) || []).filter((m) => m !== '/index.html' && m !== '/product.html'));

    ok('the unsubscribe link carries the panel\'s contact tag',
       text.includes('unsubscribe.html?c={%= $Contact.contact_key %}'));
    /* THE TRAILING EQUALS THAT COST FIVE ROUNDS. Asserted here as well as in the
       schema test, because this file is generated rather than written by hand and a
       generator repeats a mistake in every demo at once.

       THE PATTERN IS ASSEMBLED RATHER THAN WRITTEN, and that is not fussiness. The
       schema test sweeps this directory for that exact string, so spelling it here
       would make this file the thing it is checking for. Two guards in this repository
       have already contained the defect they detect. */
    const badClose = '=' + '%}';
    ok('no output tag closes with a trailing equals', !text.includes(badClose));
}

/* -------------------------------------------------------------------------- */
/* The parts a best practice email has, and this one did not                    */

{
    const { template, palette } = build();
    const modules = walk(template).modules;
    const text = JSON.stringify(template);

    /* THE PREHEADER. Without one an inbox shows the first words of the body beside the
       subject, which here would be "Dengage eComm Demo". */
    const preheader = modules.find((module) => module.descriptor.text &&
        module.descriptor.text.html.includes('display:none'));
    ok('there is a hidden preheader', Boolean(preheader));
    ok('and it says something about the basket rather than repeating the mark',
       preheader && /basket/i.test(preheader.descriptor.text.html));

    /* THE CATEGORY NAV, and every link in it has to be a real filtered page. */
    const nav = modules.find((module) => module.descriptor.text &&
        module.descriptor.text.html.includes('index.html?category='));
    ok('the nav carries the demo\'s own categories', Boolean(nav));
    ok('all four of them',
       nav && (nav.descriptor.text.html.match(/index\.html\?category=/g) || []).length === 4,
       nav && (nav.descriptor.text.html.match(/index\.html\?category=/g) || []).length);
    ok('and each is encoded, because a category name has spaces in it',
       nav && nav.descriptor.text.html.includes('category=Laptop%20Keyboard'));

    /* FOUR AT MOST. A nav that wraps to two lines on a phone stops reading as a nav. */
    const many = build({ categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
    const manyNav = walk(many.template).modules.find((module) => module.descriptor.text &&
        module.descriptor.text.html.includes('index.html?category='));
    ok('seven categories are trimmed to four',
       manyNav && (manyNav.descriptor.text.html.match(/\?category=/g) || []).length === 4);

    const none = build({ categories: [] });
    ok('a demo with no categories gets no nav row rather than an empty one',
       !JSON.stringify(none.template).includes('index.html?category='));

    /* THE HERO. Generated per demo, on our own origin, and never referenced when it is
       not there: a broken image in an email is worse than no image. */
    const hero = modules.find((module) => module.descriptor.image);
    ok('the hero is an image module', Boolean(hero));
    ok('it points at this demo\'s own generated file',
       hero && hero.descriptor.image.src.endsWith('/images/email-hero.jpg'));
    ok('it is full bleed, so 600px of image meets 600px of column',
       hero && hero.descriptor.image.width === '600px' &&
       hero.descriptor.style['padding-left'] === '0px' &&
       hero.descriptor.style['padding-right'] === '0px');
    ok('it carries alt text, for the third of recipients who block images',
       hero && hero.descriptor.image.alt.length > 0, hero && hero.descriptor.image.alt);
    ok('and it links to the basket like the button does',
       hero && hero.descriptor.image.href.endsWith('index.html?open=cart'));

    const noHero = build({ heroImage: '' });
    ok('a demo whose hero was never rendered gets no image module at all',
       walk(noHero.template).modules.filter((module) => module.descriptor.image).length === 0);

    /* ONE PRIMARY ACTION, CENTRED, with a quiet second choice rather than a second
       button. Two buttons of equal weight is how a call to action stops being one. */
    const buttons = modules.filter((module) => module.descriptor.button);
    ok('there is exactly one button', buttons.length === 1, buttons.length);
    ok('and it is centred', buttons[0].descriptor.style['text-align'] === 'center');
    ok('the second choice is a link, not a button',
       modules.some((module) => module.descriptor.text &&
           module.descriptor.text.html.includes('keep browsing')));

    /* THE URGENCY LINE HAS TO BE TRUE. A countdown, a reserved basket or an expiring
       discount would all be invented, and non-negotiable 5 is about exactly this. */
    ok('the urgency line states something true of any store',
       text.includes('a basket is not a reservation'));
    for (const invented of ['reserved for', 'expires in', 'hours left', 'only 1 left',
                            'selling fast', 'limited time']) {
        ok('nothing claims "' + invented + '"', !text.toLowerCase().includes(invented));
    }

    /* The footer names the sender, because a footer with no sender reads as a fragment. */
    ok('the footer repeats the mark',
       (text.match(/>Dengage</g) || []).length >= 2,
       (text.match(/>Dengage</g) || []).length);
}

/* -------------------------------------------------------------------------- */
/* Contrast, on the grounds each colour actually sits on                       */

{
    const { template, palette } = build();
    const ratio = (a, b) => contrast(parseHex(a), parseHex(b));

    ok('the button label reads on the brand',
       ratio(palette.onBrand, palette.brand) >= 4.5,
       ratio(palette.onBrand, palette.brand).toFixed(2));
    ok('the masthead reads on the canvas it sits on',
       ratio(palette.canvasText, palette.canvas) >= 4.5,
       ratio(palette.canvasText, palette.canvas).toFixed(2));
    ok('the quiet masthead text reads on the canvas too',
       ratio(palette.canvasQuiet, palette.canvas) >= 4.5,
       ratio(palette.canvasQuiet, palette.canvas).toFixed(2));
    ok('body text reads on the card',
       ratio(palette.text, palette.card) >= 4.5,
       ratio(palette.text, palette.card).toFixed(2));
    ok('and on the wash the totals band uses',
       ratio(palette.text, palette.wash) >= 4.5,
       ratio(palette.text, palette.wash).toFixed(2));

    /* Every band ground in the file is one of the three the palette resolved contrast
       against. A fourth would be a colour nothing was checked on. */
    const grounds = new Set(template.page.body.rows
        .map((row) => String(row.content.style['background-color']).toLowerCase()));
    const allowed = new Set([palette.card, palette.canvas, palette.wash]
        .map((colour) => String(colour).toLowerCase()));
    ok('no band uses a ground the contrast pass never saw',
       [...grounds].every((ground) => allowed.has(ground)), [...grounds]);
}

/* -------------------------------------------------------------------------- */
/* A theme whose page and surface are the same colour                          */

{
    const flat = build({ theme: { page: '#ffffff', surface: '#ffffff' } });
    const bands = flat.template.page.body.rows;
    const dividers = walk(flat.template).modules
        .filter((module) => module.descriptor.divider);

    ok('a flat theme gets hairlines, because the band grounds cannot draw the card',
       dividers.length === 2, dividers.length);

    const themed = build();
    ok('and a theme with two grounds gets none',
       walk(themed.template).modules.filter((m) => m.descriptor.divider).length === 0);

    ok('the flat template is still structurally sound',
       bands.every((row) =>
           row.columns.reduce((sum, column) => sum + column['grid-columns'], 0) === 12));
}

/* -------------------------------------------------------------------------- */
/* The typeface, which is the other half of looking like the storefront         */

{
    const { template } = build();
    ok('the demo\'s face is loaded for the builder\'s preview',
       template.page.body.webFonts.length === 1 &&
       template.page.body.webFonts[0].name === 'DM Sans' &&
       template.page.body.webFonts[0].url.includes('family=DM+Sans'),
       template.page.body.webFonts);

    const two = build({ theme: { displayFont: 'Sora', bodyFont: 'Inter' } });
    ok('two named faces load two entries', two.template.page.body.webFonts.length === 2,
       two.template.page.body.webFonts.map((f) => f.name));

    const none = build({ theme: { displayFont: '', bodyFont: '' } });
    ok('a theme naming no face loads nothing, rather than guessing a URL',
       none.template.page.body.webFonts.length === 0);
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
