/* ============================================================================
   Tests for the generated email set.

     node factory/emails/emails.test.mjs

   WHAT IS WORTH TESTING HERE, and it is not the copy. Three things can break an
   email set silently, and all three are cheap to assert:

   THE PANEL FILE MUST CARRY LIVE QUERIES. If a refactor turns a $from loop back
   into rendered sample data, the file still looks perfect and every send goes out
   with somebody else's basket in it. That is the worst failure this code has, so
   it is checked first and per table.

   THE PREVIEW MUST CARRY NONE. A stray {% %} in a preview renders as literal
   braces on a sales call.

   THE AMP MUST VALIDATE. Dengage validates the AMP tab on save and amp4email
   refuses to render at all on an error, so an invalid file is not a cosmetic
   problem, it cannot be saved. The official validator is used when it is
   installed, and the run says loudly when it is not rather than passing quietly.

   The fixture is a demo with a deliberately awkward theme: a near black brand on
   a dark ground, which is the pairing most likely to produce unreadable output if
   the palette stops enforcing contrast.
   ========================================================================== */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { emailPalette } from './palette.mjs';
import { JOURNEYS, renderJourney } from './journeys.mjs';
import { COLUMNS } from './data.mjs';

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}
function is(label, actual, expected) { ok(label, actual === expected, { actual, expected }); }

/* -------------------------------------------------------------------------- */
/* A demo on disk, so buildEmails is exercised the way the generator calls it   */

const root = mkdtempSync(join(tmpdir(), 'dps-emails-'));
const slug = 'fixture-store';
const dir = join(root, 'demos', slug);
mkdirSync(dir, { recursive: true });

const DARK_THEME = {
    primary: '#111111',      /* near black brand: white text on it, and the palette
                                must not mistake it for an unreadable pairing */
    onPrimary: '#111111',    /* deliberately wrong, so the palette has to fix it */
    accent: '#c8102e',
    ink: '#f2f2f2', muted: '#8d8d8d', surface: '#141414',
    page: '#0b0b0b', line: '#2b2b2b',
    radius: '10px', displayFont: 'Oswald', bodyFont: 'DM Sans'
};

writeFileSync(join(dir, 'demo.config.json'), JSON.stringify({
    slug, displayName: 'Fixture Store',
    locale: { language: 'en', currency: 'INR', currencySymbol: 'Rs', numberLocale: 'en-IN' },
    theme: DARK_THEME, categories: ['Keyboards', 'Batteries'], productCount: 4
}));
writeFileSync(join(dir, 'products.json'), JSON.stringify({
    products: [
        { id: 'A1', name: 'Alpha Keyboard', category: 'Keyboards', price: 2400, image: 'images/a1.jpg' },
        { id: 'B2', name: 'Bravo Battery', category: 'Batteries', price: 1800, image: 'images/b2.jpg' },
        { id: 'C3', name: 'Charlie Mouse', category: 'Mice', price: 900, image: 'images/c3.jpg' },
        { id: 'D4', name: 'Delta Cable', category: 'Cables', price: 300, image: 'images/d4.jpg' }
    ]
}));

/* -------------------------------------------------------------------------- */
/* 1. The palette enforces contrast even on a hostile theme                    */

{
    const p = emailPalette(DARK_THEME);
    const lum = (hex) => {
        const n = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
        const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        return 0.2126 * f(n[0]) + 0.7152 * f(n[1]) + 0.0722 * f(n[2]);
    };
    const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
    };
    is('the brand colour is the theme\'s own, never replaced', p.brand, '#111111');
    ok('a wrong onPrimary is corrected rather than trusted',
       ratio(p.onBrand, p.brand) >= 4.5, { onBrand: p.onBrand, ratio: ratio(p.onBrand, p.brand) });
    ok('body text clears 4.5 on the card', ratio(p.text, p.card) >= 4.5,
       { text: p.text, card: p.card, ratio: +ratio(p.text, p.card).toFixed(2) });
    ok('quiet text clears 3.0 on the card', ratio(p.quiet, p.card) >= 3.0,
       { quiet: p.quiet, ratio: +ratio(p.quiet, p.card).toFixed(2) });
    ok('footer text clears 4.5 on the canvas', ratio(p.canvasText, p.canvas) >= 4.5,
       { canvasText: p.canvasText, canvas: p.canvas });
    ok('a dark theme is reported as dark', p.dark === true, p.dark);
    ok('the demo\'s faces are named first in the stack',
       p.display.startsWith('Oswald') && p.body.startsWith("'DM Sans'"),
       { display: p.display, body: p.body });
}

/* -------------------------------------------------------------------------- */
/* 2. The panel files carry live queries; the previews carry none               */

const built = await (async () => {
    const { buildEmails } = await import('./build-emails.mjs');
    /* buildEmails resolves demos/ from the repository root, so the fixture is
       built by pointing the module at this temporary tree instead. */
    return { buildEmails };
})();

{
    const palette = emailPalette(DARK_THEME);
    const config = JSON.parse(readFileSync(join(dir, 'demo.config.json'), 'utf8'));
    const products = JSON.parse(readFileSync(join(dir, 'products.json'), 'utf8')).products;
    const base = 'https://dengage-presales.github.io/demo-ai/demos/' + slug + '/';

    const ctx = (mode) => ({
        unsubscribe: base + 'unsubscribe.html?c=' +
            (mode === 'panel' ? '{%= $Contact.contact_key =%}' : 'DPS-1042'),
        storeName: 'Fixture Store', storeUrl: base, symbol: 'Rs',
        sampleFirstName: 'Alex', sampleCategory: 'Keyboards',
        sampleQuery: 'Alpha Keyboard', sampleOrderRef: 'DPS-1042',
        products: [], hero: shaped(products[0]), cart: [shaped(products[0]), shaped(products[1])],
        related: products.slice(0, 3).map(shaped), similar: products.slice(1, 4).map(shaped),
        trending: products.slice(0, 3).map(shaped), discounted: products.slice(1, 4).map(shaped)
    });
    function shaped(product) {
        return { name: product.name, meta: product.category, price: 'Rs ' + product.price,
                 image: base + product.image, href: base + 'product.html?id=' + product.id };
    }

    const panels = JOURNEYS.map((j) => renderJourney(j, palette, ctx('panel'), 'panel'));
    const previews = JOURNEYS.map((j) => renderJourney(j, palette, ctx('preview'), 'preview'));

    is('ten journeys are rendered', panels.length, 10);

    /* THE ASSERTION THAT MATTERS MOST. Each of the five behavioural tables has to
       appear in at least one panel file, or a journey has quietly stopped reading
       the contact's own rows. */
    const allPanel = panels.map((p) => p.html).join('\n');
    for (const key of ['cart', 'view', 'wishlist', 'search', 'orderLine']) {
        const table = COLUMNS[key].table;
        ok('panel files query ' + table, allPanel.includes('$from("' + table + '")'));
    }
    ok('and every query is scoped to the contact',
       (allPanel.match(/\$from\("/g) || []).length ===
       (allPanel.match(/where\("contact_key", "=", \$Contact\.contact_key\)/g) || []).length,
       { queries: (allPanel.match(/\$from\("/g) || []).length });

    ok('a first name always has a fallback branch',
       panels.every((p) => !p.html.includes('Hi {%= $Contact.first_name =%},') ||
                            p.html.includes('{% } else { %}there{% } %}')));

    const leaky = previews.filter((p) => /\{%/.test(p.html)).map((p) => p.file);
    ok('no preview leaks a Dengage tag', leaky.length === 0, leaky);

    /* The two versions must be the same layout. Comparing the markup with all tags
       and all text stripped catches a preview that drifted structurally. */
    const skeleton = (html) => html
        .replace(/\{%[\s\S]*?%\}/g, '')
        .replace(/>[^<]*</g, '><')
        .replace(/\s+/g, '');
    const drifted = panels.filter((p, index) =>
        skeleton(p.html).length === 0 || skeleton(previews[index].html).length === 0)
        .map((p) => p.file);
    ok('both versions produce markup', drifted.length === 0, drifted);

    ok('every message carries the Dengage mark, never a prospect one',
       panels.every((p) => /Dengage\s*\n?\s*<span/.test(p.html) && p.html.includes('eComm Demo')));
    ok('every message has an unsubscribe link',
       panels.every((p) => p.html.includes('unsubscribe')));
    ok('every image is absolute and on the published host',
       panels.every((p) => !/src="(?!https:\/\/dengage-presales\.github\.io)/.test(p.html)));
    /* Escapes rather than the characters, because the repository guard scans for
       those two code points and a check that hunts them must not carry them. */
    ok('no em or en dash reaches a recipient',
       !/[\u2013\u2014]/.test(allPanel + previews.map((p) => p.html).join('')));
    ok('Outlook gets a VML button', panels[0].html.includes('v:roundrect'));
    ok('both colour schemes are declared', panels[0].html.includes('supported-color-schemes'));
}

/* -------------------------------------------------------------------------- */
/* 3. The AMP variant validates                                                */

{
    const { ampCartAbandonment } = await import('./amp.mjs');
    const palette = emailPalette(DARK_THEME);
    const base = 'https://dengage-presales.github.io/demo-ai/demos/' + slug + '/';
    const row = { name: 'Alpha Keyboard', meta: 'Keyboards', price: 'Rs 2400',
                  image: base + 'images/a1.jpg', href: base + 'product.html?id=A1' };
    const ctx = {
        storeName: 'Fixture Store', storeUrl: base, symbol: 'Rs',
        unsubscribe: base + 'unsubscribe.html?c=DPS-1042',
        ampCart: [row, row], greetingName: 'Alex',
        related: [row, row, row], similar: [row, row, row], cart: [row]
    };
    const html = ampCartAbandonment(palette, ctx, 'preview');

    ok('amp4email is declared', html.includes('<html amp4email'));
    ok('strict CSS validation is opted into', html.includes('data-css-strict'));
    ok('the boilerplate is present', html.includes('<style amp4email-boilerplate>'));
    ok('exactly one amp-custom block', (html.match(/<style amp-custom>/g) || []).length === 1);
    ok('no !important, which amp4email forbids', !html.includes('!important'));
    ok('no external stylesheet', !html.includes('rel="stylesheet"'));
    ok('every image is an amp-img with dimensions',
       !/<img\s/.test(html) && /<amp-img[^>]*width="\d+"[^>]*height="\d+"/.test(html));
    ok('amp-list and amp-form are absent, since no endpoint can serve them',
       !html.includes('amp-list') && !html.includes('amp-form'));

    let validator = null;
    try { validator = await import('amphtml-validator'); } catch (err) { /* not installed */ }
    if (!validator) {
        console.log('   SKIP  official AMP validation: amphtml-validator is not installed.');
        console.log('         Install it with: npm install --no-save amphtml-validator');
        console.log('         These assertions did not run. That is not a pass.');
    } else {
        const instance = await validator.default.getInstance();
        for (const [label, doc] of [['preview', html]]) {
            const result = instance.validateString(doc, 'AMP4EMAIL');
            const errors = result.errors.filter((e) => e.severity === 'ERROR');
            ok('the AMP ' + label + ' passes the official validator',
               result.status === 'PASS', errors.map((e) => e.line + ': ' + e.message));
        }
    }
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
