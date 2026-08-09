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

import { beefreeAbandonedCart } from './beefree.mjs';
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
    'mailup-bee-newsletter-modules-divider'
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
            snippets: (overrides && overrides.snippets) || {}
        })
    };
}

function walk(template) {
    const out = { rows: [], modules: [], uuids: [] };
    for (const row of template.page.body.rows) {
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

    /* The currency, stated once, because neither shared asset can print a symbol. */
    ok('the currency is stated once', (text.match(/All prices in/g) || []).length === 1);
    ok('and it names both the symbol and the code', text.includes('₹ (INR)'));

    const noMoney = JSON.stringify(build({ symbol: '', currency: '' }).template);
    ok('a demo whose locale names neither gets no currency line',
       !noMoney.includes('All prices in'));
    const symbolOnly = JSON.stringify(build({ symbol: '₹', currency: '' }).template);
    ok('a symbol with no code still reads correctly',
       symbolOnly.includes('All prices in ₹.'), true);

    /* The button goes to the cart, because the whole proposition is that the basket
       survived. Absolute, because an email resolves nothing relative. */
    const button = walk(template).modules.find((module) => module.descriptor.button);
    ok('the button goes to the demo\'s own cart page',
       button.descriptor.button.href ===
       'https://dengage-presales.github.io/demo-ai/demos/techiestore-in/cart.html',
       button.descriptor.button.href);

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
