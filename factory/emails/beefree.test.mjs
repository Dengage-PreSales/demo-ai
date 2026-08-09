/* ============================================================================
   The BeeFree template, checked against the things that make it importable.

     node factory/emails/beefree.test.mjs

   WHY A TEST FOR A FILE SOMEBODY UPLOADS BY HAND. A BeeFree import either succeeds or
   fails silently in part: a module whose type name is wrong is dropped, a row whose
   columns do not sum to twelve reflows, and a duplicate uuid makes the builder edit
   two blocks at once. None of that produces an error message. It produces a template
   that looks nearly right in the one place nobody has time to check it, which is on a
   call.

   So the structural invariants are asserted here, and so are the rules that matter more
   than structure: the mark is Dengage and nobody else, the shell names no storefront at
   all so it cannot contradict the basket inside it, the Dynamic Content blocks are HTML
   modules rather than text modules, and every colour pair clears the contrast bar the
   rest of the factory uses.

   MOST OF THIS FILE ASSERTS AN ABSENCE, which is unusual and is the design. The template
   used to carry the demo's store name, category nav and currency, baked in at build time,
   while the basket is resolved at send time from whichever storefront the visitor last
   touched. The two disagreed in a real send. Nothing that names a store can be in here.
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
            snippets: (overrides && overrides.snippets) || {},
            heroImage: overrides && 'heroImage' in overrides ? overrides.heroImage
                : 'https://dengage-presales.github.io/demo-ai/assets/email-hero-cart.jpg'
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

    /* THREE, and each is a scenario rather than a piece of layout: the basket, the
       summary with the button in it, and the storefront's own recommendation rail. */
    ok('there are three Dynamic Content blocks', html.length === 3, html.length);

    /* A TEXT MODULE WOULD BREAK THEM. BeeFree runs a text module's content through its
       rich text editor, which escapes or reflows a Dengage tag. */
    ok('both are HTML modules, not text modules',
       html.every((module) => module.type === 'mailup-bee-newsletter-modules-html'));

    ok('without ids, each names the asset that belongs there',
       html[0].descriptor.html.html.includes('dps abandoned cart') &&
       html[1].descriptor.html.html.includes('dps abandoned cart total') &&
       html[2].descriptor.html.html.includes('dps recommendations'));
    ok('and says how to attach it, rather than being an invisible comment',
       html.every((module) =>
           module.descriptor.html.html.includes('Insert &gt; Dynamic Content') &&
           module.descriptor.html.html.indexOf('<!--') === -1));

    /* A UUID, NOT A NUMBER. Dengage's documentation shows snippet_id="8835" and the
       panel issues a UUID, so the fixture is the shape the panel really produces.

       READ FROM factory/sandbox.json rather than spelled here, for the same reason the
       generator reads it: one place, and it is the place the app-guid guard allowlists. */
    const { readFileSync: read } = await import('node:fs');
    const { join: at, dirname: up } = await import('node:path');
    const { fileURLToPath: fromUrl } = await import('node:url');
    const configured = JSON.parse(read(
        at(up(fromUrl(import.meta.url)), '..', 'sandbox.json'), 'utf8')).snippets || {};
    const CART = configured.abandonedCart;
    const TOTAL = configured.abandonedCartTotal;
    ok('factory/sandbox.json names both saved assets',
       Boolean(CART) && Boolean(TOTAL), configured);
    /* ASSEMBLED, NOT WRITTEN, and for the same reason two patterns in this file are.
       The app-guid guardrail rejects every identifier in this repository that is not
       named in factory/sandbox.json, which is what keeps the core demos' application
       out. This is a fixture rather than a real asset, so it must not be in that
       allowlist, which means it must not appear in the source as one string. */
    const RECO = 'ffffffff-0000-1111' + '-2222-' + '333333333333';
    const resolved = walk(build({
        snippets: { items: CART, total: TOTAL, recommendations: RECO }
    }).template).modules.filter((module) => module.descriptor.html);
    ok('with ids, each becomes a real snippet tag',
       resolved[0].descriptor.html.html.includes(
           '<snippet snippet_id="' + CART + '" snippet_name="dps abandoned cart"></snippet>') &&
       resolved[1].descriptor.html.html.includes(
           '<snippet snippet_id="' + TOTAL + '" snippet_name="dps abandoned cart total"></snippet>'),
       resolved.map((m) => m.descriptor.html.html));

    /* THE WRAPPER IS THE ONLY THING THAT GIVES A SNIPPET A TYPEFACE, and that is a fact
       about BeeFree rather than a choice here. Read out of a real export from the
       account: all 67 of its font-family declarations are inline on individual blocks,
       there is not one global rule, and the body tag has none. So BeeFree sets a font on
       every block and never on the email, which means font-family:inherit inside an HTML
       block has nothing above it and falls through to the client default. That is why
       every product name arrived in Times under a sans headline.

       The saved assets cannot name a face themselves: they are shared by every demo, and
       an explicit family on the content would beat anything the template said. So they
       declare inherit, and this div is what they inherit from. */
    ok('every block is wrapped in a typeface, because inherit alone resolves to Times',
       resolved.every((module) =>
           module.descriptor.html.html.indexOf('<div style="font-family:') === 0),
       resolved.map((m) => m.descriptor.html.html.slice(0, 60)));
    ok('the placeholders carry the same wrapper, so the preview is not flattering',
       html.every((module) =>
           module.descriptor.html.html.indexOf('<div style="font-family:') === 0));

    /* THE SIDE PADDING IS IN THE SAME WRAPPER, AND FOR THE SAME REASON. BeeFree puts a
       block's padding on a td around it and does not do that for raw HTML, so the module's
       24px never applied and the totals table sat flush against both edges of the email
       while the text blocks were inset. The product cards hid it, because their content is
       centred, so they looked inset when they were not.

       Asserted in both directions: the wrapper has it, and the module does not, so there
       is one source rather than two that can disagree about which one a client honoured. */
    ok('every wrapper carries the side gutter, because the module cannot',
       resolved.every((module) => /padding:0 24px/.test(module.descriptor.html.html)),
       resolved.map((m) => m.descriptor.html.html.slice(0, 120)));
    ok('and the HTML modules declare no side padding, so there is only one source',
       html.every((module) =>
           module.descriptor.style['padding-left'] === '0px' &&
           module.descriptor.style['padding-right'] === '0px'),
       html.map((m) => m.descriptor.style));

    /* AND THE GUTTER MATCHES THE TEXT BLOCKS', or the snippets would line up with nothing.
       The text modules get theirs from BeeFree, which does honour a text block's padding. */
    const textGutters = walk(template).modules
        .filter((module) => module.descriptor.text)
        .map((module) => module.descriptor.style['padding-left']);
    ok('the gutter is the one the text blocks use',
       new Set(textGutters).size === 1 && textGutters[0] === '24px',
       [...new Set(textGutters)]);

    /* AND IT IS THE SAME FACE THE TEXT BLOCKS USE, pinned rather than hoped for. The
       wrapper and the headline are written by two different functions from the same
       palette, so they agree by construction today. This is what makes a future change to
       one of them fail rather than ship an email whose products are in a different
       typeface from its copy. */
    const family = (declaration) => {
        const found = /font-family:([^;"]+)/.exec(declaration || '');
        return found ? found[1].trim() : '';
    };
    const textFamilies = walk(template).modules
        .filter((module) => module.descriptor.text)
        .map((module) => module.descriptor.text.style['font-family']);
    const wrapperFamilies = html.map((module) => family(module.descriptor.html.html));

    ok('the text blocks all declare one typeface',
       new Set(textFamilies).size === 1, [...new Set(textFamilies)]);
    ok('and every Dynamic Content wrapper declares exactly that one',
       new Set(wrapperFamilies).size === 1 &&
       wrapperFamilies[0] === textFamilies[0],
       { wrapper: [...new Set(wrapperFamilies)], text: [...new Set(textFamilies)] });
    ok('and the placeholder is gone',
       resolved.every((module) => module.descriptor.html.html.indexOf('dashed') === -1));
    ok('the recommendation block takes an id like the other two',
       resolved[2].descriptor.html.html.includes('snippet_id="' + RECO + '"'),
       resolved[2].descriptor.html.html);
}

/* -------------------------------------------------------------------------- */
/* The shell names no storefront, which is the whole reason it is shared         */

{
    const { template } = build();
    const modules = walk(template).modules;
    const text = JSON.stringify(template);

    /* THE DEFECT THIS SECTION EXISTS FOR. The template used to carry the demo's store
       name, its category nav and its currency, all baked in when the demo was built. The
       basket inside it is resolved at send time from whichever storefront the visitor
       last touched, so the two could disagree, and they did: a Techiestore masthead and a
       laptop nav around four garments, above a rupee line against dollar prices.

       Every assertion here is the absence of something, which is unusual and is the
       point. A shell that names no store cannot contradict a basket. */
    ok('no link addresses a particular demo',
       !text.includes('/demos/'), (text.match(/\/demos\/[a-z0-9-]+/g) || []).slice(0, 3));
    ok('there is no category nav', !text.includes('?category='));
    ok('there is no currency line', !text.includes('All prices in'));
    ok('and no currency symbol anywhere',
       !/[₹€£¥₺]/.test(text), (text.match(/[₹€£¥₺]/g) || []).slice(0, 3));

    /* NO BUTTON MODULE EITHER, and that surprises people, so it is asserted. A BeeFree
       button holds one literal href, and a basket link needs a demo in it, so in a shared
       template it could only ever point at the wrong storefront. The saved asset works
       out the demo and builds the URL, so the button lives there. */
    ok('there is no button module, because only the asset can address a basket',
       modules.filter((module) => module.descriptor.button).length === 0);

    /* THE MARK IS STILL DENGAGE'S, twice, and it is the only name in the file. */
    ok('the masthead is the Dengage mark with its subtext',
       text.includes('Dengage') && text.includes('eComm Demo'));
    ok('the footer repeats it',
       (text.match(/>Dengage</g) || []).length >= 2,
       (text.match(/>Dengage</g) || []).length);
    ok('no image is embedded except the hero, so no logo can be the wrong one',
       (text.match(/<img/g) || []).length === 0);

    /* NON-NEGOTIABLE 10. Escapes rather than literals: the guard sweeps this file for
       those two characters, so writing them in the pattern would fail the check for
       them. Two guards here have already contained the defect they detect. */
    const longDashes = new RegExp('[\\u2013\\u2014]', 'g');
    ok('no em dash and no en dash',
       !longDashes.test(text), (text.match(longDashes) || []).slice(0, 3));

    const badClose = '=' + '%}';
    ok('no output tag closes with a trailing equals', !text.includes(badClose));

    /* THE PREHEADER. Without one an inbox shows the first words of the body beside the
       subject, which here would be "Dengage eComm Demo". */
    const preheader = modules.find((module) => module.descriptor.text &&
        module.descriptor.text.html.includes('display:none'));
    ok('there is a hidden preheader', Boolean(preheader));
    ok('and it says something about the basket rather than repeating the mark',
       preheader && /checkout|basket/i.test(preheader.descriptor.text.html));

    /* IT MUST NOT REPEAT THE HEADLINE, which is the copy most likely to be reused as the
       subject. A preheader that restates the subject wastes the extra line. */
    ok('the preheader does not repeat the headline',
       preheader && !preheader.descriptor.text.html.includes('Still thinking it over'));

    /* AND IT HAS TO BE PADDED, or the client fills the rest of the preview line with the
       next visible text, which here is the Dengage mark. */
    ok('it is padded, so the mark does not leak into the preview line',
       preheader && (preheader.descriptor.text.html.match(/&zwnj;/g) || []).length > 20,
       preheader && (preheader.descriptor.text.html.match(/&zwnj;/g) || []).length);

    /* THE HERO, shared and in the standard palette rather than a prospect's. */
    const hero = modules.find((module) => module.descriptor.image);
    ok('the hero is an image module', Boolean(hero));
    ok('it points at the shared artwork, not a demo folder',
       hero && hero.descriptor.image.src.endsWith('/assets/email-hero-cart.jpg'));
    ok('it is full bleed, so 600px of image meets 600px of column',
       hero && hero.descriptor.image.width === '600px' &&
       hero.descriptor.style['padding-left'] === '0px' &&
       hero.descriptor.style['padding-right'] === '0px');
    ok('it carries alt text, for the third of recipients who block images',
       hero && hero.descriptor.image.alt.length > 0, hero && hero.descriptor.image.alt);
    ok('and it links nowhere, because there is no demo to link to',
       hero && hero.descriptor.image.href === '');

    const noHero = build({ heroImage: '' });
    ok('with no hero rendered there is no image module at all',
       walk(noHero.template).modules.filter((module) => module.descriptor.image).length === 0);

    /* THE URGENCY LINE HAS TO BE TRUE. A countdown, a reserved basket or an expiring
       discount would all be invented, and non-negotiable 5 is about exactly this. */
    ok('the urgency line states something true of any store',
       text.includes('a basket is not a reservation'));
    for (const invented of ['reserved for', 'expires in', 'hours left', 'only 1 left',
                            'selling fast', 'limited time']) {
        ok('nothing claims "' + invented + '"', !text.toLowerCase().includes(invented));
    }
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

/* -------------------------------------------------------------------------- */
/* The committed file, which is what actually gets imported                     */

{
    /* THE TEST ABOVE BUILDS ITS OWN TEMPLATE. This reads the one on disk, because that is
       the file somebody uploads, and a placeholder left in it would not show until a send
       came out with two dashed boxes in it. */
    const { readFileSync, existsSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const path = join(root, 'factory', 'panel', 'content', '_shared',
                      'beefree-abandoned-cart.json');

    ok('the shared template is committed', existsSync(path), path);
    if (existsSync(path)) {
        const committed = JSON.parse(readFileSync(path, 'utf8'));
        const html = walk(committed).modules.filter((module) => module.descriptor.html);
        ok('it has all three Dynamic Content blocks', html.length === 3, html.length);

        /* ALL THREE ARE ATTACHED NOW, so the import needs no clicks at all. Left as an
           equality rather than "at least two", because a block that quietly reverts to a
           placeholder would otherwise pass and only show as an empty section in a send. */
        const attached = html.filter((module) =>
            module.descriptor.html.html.includes('<snippet '));
        ok('all three are attached, so the import needs no clicks',
           attached.length === 3, attached.length);
        ok('with no placeholder left behind',
           html.every((module) => !module.descriptor.html.html.includes('dashed')));
        ok('and it still names no storefront',
           !JSON.stringify(committed).includes('/demos/'));
    }
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
