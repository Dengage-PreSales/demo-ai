/* ============================================================================
   Every scenario email, executed.

     node factory/emails/scenarios.test.mjs

   WHY THIS IS THE WHOLE POINT. A Code Editor email carries its own query, so it is a
   program, and the only honest way to know a program works is to run it. The set this
   replaced was never run: it referenced a product name on an event table that has never
   had one, so it produced nothing for either demo for as long as it existed, and no test
   would have caught that because there was no test that executed anything.

   FOUR THINGS ARE CHECKED, and they are in order of what has actually gone wrong here.

   1. NO INVENTED COLUMN. Every property read off a row in every emitted block is
      checked against the column lists in factory/phase0/SCHEMA.md, which were read off
      the real tables. This is the check that would have prevented the deletion of the
      previous set.
   2. NO NAME COLLISION between the query and the markup. The whole email compiles to one
      JavaScript function, so a `var` in the resolution block and a `var` of the same name
      in a card is the same variable. That happened during this build: the wishlist fold's
      saved price and the hero card's struck-through price were both `wasN`.
   3. IT RESOLVES. Each scenario runs against a synthetic event log and must produce the
      products that log implies, in the order it implies, with the prices it implies.
   4. IT DEGRADES. Empty history, another demo's history, and a product with no price.
      All three render something sendable and none of them invents a value.
   ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS } from './scenarios.mjs';
import { scenarioHtml } from './build-scenarios.mjs';
import { emailPalette } from './palette.mjs';
import { dengageTheme } from './dengage-theme.mjs';
import { render, arrayFrom, transpile } from './dengage-template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PALETTE = emailPalette(dengageTheme());

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

const sources = {};
for (const scenario of SCENARIOS) sources[scenario.id] = scenarioHtml(scenario, PALETTE);
const blockOf = (id) => sources[id].slice(2, sources[id].indexOf('%}'));
const markupOf = (id) => sources[id].slice(sources[id].indexOf('%}') + 2);

/* -------------------------------------------------------------------------- */
/* 1. Every column named exists                                                */

{
    /* THE REAL COLUMN LISTS, parsed out of SCHEMA.md rather than restated here, because a
       list restated is a list that drifts. SCHEMA.md carries them in fenced blocks under a
       bold table name, and factory/phase0/schema.test.mjs checks it against the account. */
    const schema = readFileSync(join(ROOT, 'factory', 'phase0', 'SCHEMA.md'), 'utf8');
    const columns = new Set();
    const blocks = schema.match(/\*\*[a-z_]+\*\*,[^\n]*\n\n```\n([\s\S]*?)```/g) || [];
    for (const found of blocks) {
        const body = found.slice(found.indexOf('```') + 3, found.lastIndexOf('```'));
        for (const word of body.split(/\s+/)) if (/^[a-z][a-z0-9_]*$/.test(word)) columns.add(word);
    }
    /* master_device IS NOT ONE OF THE SIX and SCHEMA.md does not describe it, so its two
       columns are added here. Every asset in this repository reads it: a demo visitor is
       anonymous until they identify, so their rows are under a device id rather than a
       contact key, and this is the table that maps one to the other. */
    columns.add('device_id');
    columns.add('contact_key');

    ok('SCHEMA.md yielded the column lists', columns.size > 30, columns.size);
    ok('and they include the ones that are easy to get wrong',
       columns.has('keywords') && columns.has('result_count') && columns.has('category_path') &&
       columns.has('order_id') && columns.has('image_link') && columns.has('stock_count'),
       [...columns].slice(0, 8));

    /* Properties that are JavaScript rather than data, or a local this file builds. A
       property not in either set is a column that has to exist, and this is the assertion
       the deleted set would have failed. */
    const JS = new Set(['length', 'indexOf', 'push', 'slice', 'split', 'sort', 'trim', 'pop',
        'replace', 'toLowerCase', 'charCodeAt', 'substring', 'concat', 'join', 'unshift',
        'was', 'list', 'qty', 'saved', 'dropped', 'lowStock', 'category', 'term', 'found',
        'matched', 'present', 'checkout', 'basket', 'order', 'lines', 'units', 'quantity',
        'title', 'image', 'link', 'price', 'cut', 'stock', 'row', 'id']);

    for (const scenario of SCENARIOS) {
        const block = blockOf(scenario.id);
        const bad = [];
        /* Only property reads off something that could be a row. A row here is always
           subscripted or named row/item/prow/cand/look, which is what the generator and the
           folds use, so the pattern is narrow on purpose: a wide one matches Math.min. */
        const pattern = /\b(?:row|item|prow|cand|rows\[[^\]]+\]|look\[[^\]]+\]|devices\[[^\]]+\]|products\[[^\]]+\]|views\[[^\]]+\]|pool\[[^\]]+\]|near\[[^\]]+\]|here\[[^\]]+\]|mineRows\[[^\]]+\])\.([a-z_][a-z0-9_]*)/g;
        let m;
        while ((m = pattern.exec(block)) !== null) {
            const prop = m[1];
            if (!columns.has(prop) && !JS.has(prop)) bad.push(prop);
        }
        ok(scenario.id + ': every column it reads is one the tables have',
           bad.length === 0, [...new Set(bad)]);
    }

    /* AND THE CHECK ITSELF, against the exact mistake that deleted the previous set. */
    const invented = 'rows[0].product_name';
    const pattern = /\b(?:row|rows\[[^\]]+\])\.([a-z_][a-z0-9_]*)/g;
    const found = pattern.exec(invented);
    ok('the check would reject product_name, which no event table has',
       Boolean(found) && !columns.has(found[1]), found && found[1]);
}

/* -------------------------------------------------------------------------- */
/* 2. The query and the markup do not share a variable                         */

{
    /* ONE FUNCTION, ONE SCOPE. dengageTemplate concatenates every {% %} piece into a
       single function body, which is what makes `{% if (x) { %}...{% } %}` work at all. The
       cost is that a name declared in the resolution block and a name declared inside a
       card are the same variable, and the second wins for everything after it. */
    const names = (text) => {
        const out = [];
        const pattern = /\bvar\s+([A-Za-z_$][\w$]*)/g;
        let m;
        while ((m = pattern.exec(text)) !== null) out.push(m[1]);
        return out;
    };
    for (const scenario of SCENARIOS) {
        const inQuery = new Set(names(blockOf(scenario.id)));
        const clash = [...new Set(names(markupOf(scenario.id)))].filter((n) => inQuery.has(n));
        ok(scenario.id + ': no card redeclares a variable the query already owns',
           clash.length === 0, clash);
    }
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */

const MINE = 'https://dengage-presales.github.io/demo-ai/demos/mine/';
const THEIRS = 'https://dengage-presales.github.io/demo-ai/demos/theirs/';

function product(id, options) {
    const o = options || {};
    const base = o.base || MINE;
    return {
        product_id: id,
        title: o.title || ('Product ' + id),
        price: 'price' in o ? o.price : '100',
        discounted_price: 'discounted_price' in o ? o.discounted_price : null,
        image_link: 'image_link' in o ? o.image_link : base + 'images/' + id + '.jpg',
        link: base + 'product.html?id=' + id,
        /* NOT "Widgets". The search test looks for the term "widget", and a default category
           containing it made the product meant to be the non-match match on its category
           instead of its title. The fold searches both, correctly; the fixture was wrong. */
        category_path: o.category_path || 'Things > Gadgets',
        stock_count: 'stock_count' in o ? o.stock_count : 9,
        is_active: o.is_active === undefined ? true : o.is_active
    };
}

const DEVICES = [{ device_id: 'dev-1', contact_key: 'DPS-1' }];
const CONTACT = { contact_key: 'DPS-1' };
const viewRow = (session, url, productId, at, category) => ({
    key: 'dev-1', session_id: session, page_url: url, page_title: 'A page',
    product_id: productId || null, category_path: category || '', event_date: at, price: null
});

function run(id, tables) {
    return render(sources[id], {
        $from: arrayFrom(Object.assign({
            master_device: DEVICES, dps_product: [], page_view_events: [],
            shopping_cart_events: [], wishlist_events: [], search_events: [],
            order_events_detail: []
        }, tables)),
        $Contact: CONTACT
    });
}

const shown = (html) => (html.match(/>([^<>]*Product [a-z0-9]+[^<>]*)</g) || [])
    .map((s) => (s.match(/Product [a-z0-9]+/) || [])[0])
    .filter((v, i, a) => v && a.indexOf(v) === i);

/* -------------------------------------------------------------------------- */
/* 3. Each scenario resolves what its history implies                          */

{
    const cart = (id, at, type, qty) => ({
        id: at, key: 'dev-1', session_id: 'mine', event_date: '2026-08-10T10:0' + at + ':00Z',
        event_type: type || 'add_to_cart', product_id: id, quantity: qty === undefined ? 1 : qty
    });
    const views = [viewRow('mine', MINE + 'index.html', null, '2026-08-10T09:00:00Z')];
    const catalogue = [product('p1'), product('p2'), product('p3')];

    const checkout = run('checkout', {
        shopping_cart_events: [cart('p1', 1), cart('p2', 2, 'add_to_cart', 2),
                               cart('p3', 3), cart('p3', 4, 'remove_from_cart')],
        page_view_events: views, dps_product: catalogue
    });
    ok('checkout: the basket is replayed, so a removed product is gone',
       shown(checkout).join(',') === 'Product p2,Product p1', shown(checkout));
    ok('checkout: quantity above one is stated', /Qty 2/.test(checkout));
    /* 100 + 100 x 2 = 300, and no discount anywhere in the fixture. */
    ok('checkout: the total is the sum over quantity',
       /300\.00/.test(checkout) && !/Discount/.test(checkout),
       (checkout.match(/[\d,]+\.00/g) || []));
    ok('checkout: the button addresses the demo the rows belong to',
       checkout.includes(MINE + 'index.html?open=checkout'));

    const browse = run('browse', {
        page_view_events: views.concat([
            viewRow('mine', MINE + 'product.html?id=p1', 'p1', '2026-08-10T09:01:00Z', 'A > Shirts'),
            viewRow('mine', MINE + 'product.html?id=p2', 'p2', '2026-08-10T09:02:00Z', 'A > Shirts'),
            viewRow('mine', MINE + 'product.html?id=p3', 'p3', '2026-08-10T09:03:00Z', 'A > Coats')
        ]),
        dps_product: catalogue
    });
    ok('browse: newest view first', shown(browse)[0] === 'Product p3', shown(browse));
    ok('browse: the category seen most often is the one named',
       browse.includes('More in Shirts'), (browse.match(/More in [A-Za-z]+/) || [])[0]);

    const search = run('search', {
        search_events: [{ key: 'dev-1', session_id: 'mine', keywords: 'widget',
                          result_count: 0, event_date: '2026-08-10T10:00:00Z', filters: null }],
        page_view_events: views,
        dps_product: [product('p1', { title: 'A Widget Thing' }), product('p2', { title: 'Unrelated' })]
    });
    ok('search: the term is quoted back from the row', search.includes('widget'));
    ok('search: a title that contains the term is matched, one that does not is not',
       search.includes('A Widget Thing') && !search.includes('Unrelated'),
       shown(search));

    const wishlist = run('wishlist', {
        wishlist_events: [
            { event_id: 'a', key: 'dev-1', session_id: 'mine', event_type: 'add',
              product_id: 'p1', price: '180', event_date: '2026-08-10T10:00:00Z' },
            { event_id: 'b', key: 'dev-1', session_id: 'mine', event_type: 'add',
              product_id: 'p2', price: '100', event_date: '2026-08-10T10:01:00Z' }],
        page_view_events: views, dps_product: [product('p1'), product('p2')]
    });
    ok('wishlist: a price below the saved price is a price drop',
       wishlist.includes('The price fell on something you saved'));
    /* SAVED AT 180, NOW 100. The struck through number must be 180, because that is what
       the sentence above it refers to. Showing the catalogue's own price instead was the
       defect this assertion exists for. */
    ok('wishlist: the struck through price is the saved one, not the catalogue one',
       wishlist.includes('180.00'), (wishlist.match(/[\d,]+\.00/g) || []));

    const removed = run('wishlist', {
        wishlist_events: [
            { event_id: 'a', key: 'dev-1', session_id: 'mine', event_type: 'add',
              product_id: 'p1', price: '100', event_date: '2026-08-10T10:00:00Z' },
            { event_id: 'b', key: 'dev-1', session_id: 'mine', event_type: 'remove',
              product_id: 'p1', price: null, event_date: '2026-08-10T10:01:00Z' }],
        page_view_events: views, dps_product: [product('p1')]
    });
    ok('wishlist: "remove" is the real vocabulary, so an unsaved item is gone',
       !shown(removed).length, shown(removed));

    const basket = run('basket', {
        shopping_cart_events: [cart('p1', 1)],
        page_view_events: views,
        dps_product: [product('p1'), product('p2'), product('p3'),
                      product('q1', { base: THEIRS })]
    });
    ok('basket: it offers what is not in the basket', shown(basket).indexOf('Product p1') === -1,
       shown(basket));
    ok('basket: from the same category, and only this demo',
       shown(basket).length === 2 && !basket.includes(THEIRS), shown(basket));

    const replenish = run('replenish', {
        order_events_detail: [
            { key: 'dev-1', session_id: 'mine', order_id: 'OLD-1', product_id: 'p3',
              quantity: 1, unit_price: '100', event_date: '2026-08-09T10:00:00Z' },
            { key: 'dev-1', session_id: 'mine', order_id: 'NEW-2', product_id: 'p1',
              quantity: 2, unit_price: '100', event_date: '2026-08-10T10:00:00Z' }],
        page_view_events: views, dps_product: catalogue
    });
    ok('replenish: only the newest order, and it is named',
       replenish.includes('NEW-2') && !replenish.includes('OLD-1') &&
       shown(replenish).join(',') === 'Product p1', shown(replenish));
    ok('replenish: quantity carries through from the order line', /Qty 2/.test(replenish));

    const winback = run('winback', {
        page_view_events: views, dps_product: catalogue.concat([product('q1', { base: THEIRS })])
    });
    ok('winback: the catalogue of this demo only', shown(winback).length === 3 &&
       !winback.includes(THEIRS), shown(winback));
    ok('winback: and it is deterministic',
       run('winback', { page_view_events: views,
                        dps_product: catalogue.slice().reverse() }) === winback);
}

/* -------------------------------------------------------------------------- */
/* 4. Every scenario degrades rather than breaking                             */

{
    for (const scenario of SCENARIOS) {
        const empty = run(scenario.id, {});
        ok(scenario.id + ': no history renders a whole email rather than throwing',
           empty.includes('</html>') && empty.length > 1000, empty.length);
        ok(scenario.id + ': and no button, because no demo resolved',
           !/href="https:/.test(empty) && !empty.includes('undefined') && !empty.includes('NaN'),
           (empty.match(/undefined|NaN|href="https:[^"]*"/g) || []).slice(0, 3));
    }

    /* ANOTHER DEMO'S HISTORY MUST NOT LEAK, which is the defect the abandoned cart email
       shipped: one origin, one device id, so a key carries every demo it ever visited. */
    const crossed = run('checkout', {
        shopping_cart_events: [
            { id: 1, key: 'dev-1', session_id: 'theirs', event_date: '2026-08-10T09:00:00Z',
              event_type: 'add_to_cart', product_id: 'q1', quantity: 1 },
            { id: 2, key: 'dev-1', session_id: 'mine', event_date: '2026-08-10T10:00:00Z',
              event_type: 'add_to_cart', product_id: 'p1', quantity: 1 }],
        page_view_events: [
            viewRow('theirs', THEIRS + 'index.html', null, '2026-08-10T09:00:00Z'),
            viewRow('mine', MINE + 'index.html', null, '2026-08-10T10:00:00Z')],
        dps_product: [product('p1'), product('q1', { base: THEIRS })]
    });
    ok('the newest demo wins and the other demo does not appear',
       shown(crossed).join(',') === 'Product p1' && !crossed.includes(THEIRS), shown(crossed));

    /* AND THE SAME PRODUCT ID ON BOTH DEMOS, which the case above does not reach because
       it gives the two demos different ids. Found on 10 August 2026 by
       factory/snippets.test.mjs, which shares this resolution block.

       A product id is the prospect's own SKU, taken off their site by the scrape, and
       nothing makes it unique across demos: two prospects numbering their products the same
       way collide completely. dps_product holds every catalogue in one table, so
       `where('product_id', 'in', ids)` returns two rows for one id, and until the lookup was
       scoped as well as the events the later row won. The basket was the right demo's and
       the product in it was not, with the other prospect's photograph and a link to their
       demo.

       THEIRS IS FIRST IN THE TABLE ON PURPOSE, and getting that backwards is worth a
       sentence because it made this assertion pass without the fix in place. arrayFrom
       hands rows back in REVERSE insertion order, deliberately, because take(n) without an
       ordering returns some n rows rather than the newest n. So the row written LAST into
       byId is the one listed FIRST here, and only this order lets the other prospect's
       product win. Checked by removing the guard and watching it fail. */
    const sameIds = run('checkout', {
        shopping_cart_events: [
            { id: 1, key: 'dev-1', session_id: 'theirs', event_date: '2026-08-10T09:00:00Z',
              event_type: 'add_to_cart', product_id: 'p1', quantity: 1 },
            { id: 2, key: 'dev-1', session_id: 'mine', event_date: '2026-08-10T10:00:00Z',
              event_type: 'add_to_cart', product_id: 'p1', quantity: 1 }],
        page_view_events: [
            viewRow('theirs', THEIRS + 'index.html', null, '2026-08-10T09:00:00Z'),
            viewRow('mine', MINE + 'index.html', null, '2026-08-10T10:00:00Z')],
        dps_product: [product('p1', { base: THEIRS, title: 'Their Product' }), product('p1')]
    });
    ok('a colliding product id resolves to this demo, not the other one',
       shown(sameIds).join(',') === 'Product p1' && !sameIds.includes('Their Product') &&
       !sameIds.includes(THEIRS), shown(sameIds));

    /* A PRODUCT WITH NO PRICE. Number(null) is 0, so a subtotal that quietly includes it
       reads as a discount nobody offered. */
    const unpriced = run('checkout', {
        shopping_cart_events: [
            { id: 1, key: 'dev-1', session_id: 'mine', event_date: '2026-08-10T10:00:00Z',
              event_type: 'add_to_cart', product_id: 'p1', quantity: 1 },
            { id: 2, key: 'dev-1', session_id: 'mine', event_date: '2026-08-10T10:01:00Z',
              event_type: 'add_to_cart', product_id: 'p2', quantity: 1 }],
        page_view_events: [viewRow('mine', MINE + 'index.html', null, '2026-08-10T09:00:00Z')],
        dps_product: [product('p1'), product('p2', { price: null })]
    });
    ok('one unpriced product suppresses the whole total',
       !unpriced.includes('Subtotal') && !unpriced.includes('Total'),
       (unpriced.match(/Subtotal|Total/g) || []));
    ok('but the products still show, and the one with no price shows none',
       shown(unpriced).length === 2 && (unpriced.match(/100\.00/g) || []).length === 1,
       (unpriced.match(/[\d,]+\.00/g) || []));

    /* A WITHDRAWN PRODUCT IS NOT OFFERED, because is_active is the catalogue saying so. */
    const gone = run('browse', {
        page_view_events: [
            viewRow('mine', MINE + 'index.html', null, '2026-08-10T09:00:00Z'),
            viewRow('mine', MINE + 'product.html?id=p1', 'p1', '2026-08-10T09:01:00Z', 'A > B')],
        dps_product: [product('p1', { is_active: false })]
    });
    ok('a withdrawn product is not shown', !shown(gone).length, shown(gone));

    /* AN http IMAGE IS NOT AN IMAGE, for the same reason the push banner rejects one. */
    const insecure = run('browse', {
        page_view_events: [
            viewRow('mine', MINE + 'index.html', null, '2026-08-10T09:00:00Z'),
            viewRow('mine', MINE + 'product.html?id=p1', 'p1', '2026-08-10T09:01:00Z', 'A > B')],
        dps_product: [product('p1', { image_link: 'http://example.test/p1.jpg' })]
    });
    ok('an http image is dropped rather than blocked by the client',
       !insecure.includes('http://example.test'), insecure.includes('<img'));
}

/* -------------------------------------------------------------------------- */
/* The shell, and the rules that apply to every email in this repository       */

{
    for (const scenario of SCENARIOS) {
        const source = sources[scenario.id];
        ok(scenario.id + ': the shell names no storefront',
           !source.replace(/\{%[\s\S]*?%\}/g, '').includes('/demos/'),
           (source.match(/\/demos\/[a-z-]+/g) || []).slice(0, 2));
        const longDashes = new RegExp('[\\u2013\\u2014]');
        ok(scenario.id + ': no em dash and no en dash', !longDashes.test(source));
        ok(scenario.id + ': no output tag closes with a trailing equals',
           !source.includes('=' + '%}'));
        /* STRINGS COME OUT FIRST, because 'https://' is not a comment and the first
           version of this check said it was. */
        const bare = blockOf(scenario.id)
            .replace(/'(?:[^'\\]|\\.)*'/g, "''")
            .replace(/"(?:[^"\\]|\\.)*"/g, '""');
        ok(scenario.id + ': the block carries no comment, which the engine rejects',
           !/\/\/|\/\*/.test(bare), (bare.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) || [])[0]);
        ok(scenario.id + ': it transpiles', (() => {
            try { transpile(source); return true; } catch (err) { return false; }
        })());
        ok(scenario.id + ': the mark is Dengage, twice, and no image but the products',
           (source.match(/>Dengage</g) || []).length >= 1 &&
           source.includes('eComm Demo') &&
           !/<img [^>]*src="https:\/\/dengage-presales/.test(source));
    }

    /* THE COMMITTED FILES ARE THE ONES SOMEBODY PASTES, so they are checked rather than
       only the generator's output. A stale file is the failure mode here: the generator
       is right and the panel gets last week's email. */
    for (const scenario of SCENARIOS) {
        const path = join(ROOT, 'factory', 'panel', 'content', '_shared',
                          'scenario-' + scenario.id + '.html');
        ok(scenario.id + ': the file to paste is committed', existsSync(path));
        if (existsSync(path)) {
            ok(scenario.id + ': and matches what the generator produces now',
               readFileSync(path, 'utf8') === sources[scenario.id]);
        }
    }
}

/* -------------------------------------------------------------------------- */
/* The AMP sample, against the rules rather than against a reading of them      */

{
    const { ampScenario } = await import('./amp-scenario.mjs');
    const { AMP_SCENARIO, previewOf, ORIGIN } = await import('./build-scenarios.mjs');
    const scenario = SCENARIOS.find((s) => s.id === AMP_SCENARIO);
    ok('the AMP sample names a scenario that exists', Boolean(scenario), AMP_SCENARIO);

    const amp = ampScenario(scenario, PALETTE);

    /* STRUCTURAL FIRST, because these run with no dependency and no network, so they run
       everywhere. Each one is a rule the official validator enforces, and each was read
       off the validator rather than off documentation: an `<img>` fails, an inline style
       attribute does not, and `!important` is rejected outright. */
    ok('AMP: the html tag carries amp4email', /<html amp4email\b/.test(amp));
    ok('AMP: the boilerplate is exact, because a character out is a rejected email',
       amp.includes('<style amp4email-boilerplate>body{visibility:hidden}</style>'));
    ok('AMP: the runtime is included', amp.includes('src="https://cdn.ampproject.org/v0.js"'));
    ok('AMP: and a custom-element script for every amp component used', (() => {
        const used = new Set((amp.match(/<(amp-[a-z-]+)[\s>]/g) || [])
            .map((t) => t.replace(/[<\s>]/g, '')).filter((t) => t !== 'amp-img'));
        return [...used].every((tag) =>
            amp.includes('custom-element="' + tag + '"'));
    })(), (amp.match(/custom-element="[^"]+"/g) || []));
    ok('AMP: exactly one amp-custom style block',
       (amp.match(/<style amp-custom>/g) || []).length === 1);
    ok('AMP: no !important, which amp rejects rather than ignores', !amp.includes('!important'));
    ok('AMP: no plain img tag anywhere', !/<img[\s>]/.test(amp));
    ok('AMP: every amp-img has explicit dimensions and a layout',
       (amp.match(/<amp-img [^>]*>/g) || []).every((tag) =>
           /width="/.test(tag) && /height="/.test(tag) && /layout="/.test(tag)),
       (amp.match(/<amp-img [^>]*>/g) || [])[0]);
    ok('AMP: the images are the 1200x600 banners, which is why a fixed ratio is possible',
       amp.includes('card.banner') && amp.includes('width="1200" height="600"'));
    /* ONE PRODUCT IS NOT A CAROOUSEL. Arrows that do nothing read as broken rather than
       empty, so a single slide renders without one. */
    ok('AMP: a carousel only when there is more than one slide',
       amp.includes('{% if (view.length > 1) { %}'));

    const rendered = previewOf(scenario, amp, 'techiestore-in', (() => {
        const list = JSON.parse(readFileSync(
            join(ROOT, 'demos', 'techiestore-in', 'products.json'), 'utf8')).products;
        const base = ORIGIN + 'demos/techiestore-in/';
        return list.map((p) => ({
            product_id: String(p.id), title: p.name,
            price: p.price == null ? null : String(p.price),
            discounted_price: p.discountedPrice == null ? null : String(p.discountedPrice),
            image_link: p.image ? base + p.image : null,
            link: base + 'product.html?id=' + encodeURIComponent(String(p.id)),
            category_path: p.category || '', stock_count: null, is_active: true
        }));
    })(), { absolute: true });

    ok('AMP: it renders slides from a real catalogue',
       (rendered.match(/<amp-img /g) || []).length >= 2,
       (rendered.match(/<amp-img /g) || []).length);
    ok('AMP: and every address in the send is absolute https, which amp requires',
       !/(?:src|href)="(?!https:\/\/)/.test(rendered),
       (rendered.match(/(?:src|href)="(?!https:)[^"]*"/g) || []).slice(0, 2));

    /* THE PANEL'S OWN VALIDATOR IS STRICTER THAN THE OFFICIAL ONE, and this section is
       every rule it taught us. The difference is not a bug in either: the official
       validator was given the RESOLVED document, and Dengage validates the file AS
       AUTHORED, before the template engine runs. So a document that passes the official
       validator perfectly can be rejected by the panel with eight structural errors, none
       of which is about AMP. That happened, on 10 August 2026, and these are the four
       causes.

       Every one of them is asserted on the authored source rather than on the render,
       because that is what the panel sees. */
    ok('AMP: the doctype is the very first thing in the file',
       amp.indexOf('<!doctype html>') === 0, amp.slice(0, 40));
    ok('AMP: the query is inside the body, not above the doctype',
       amp.indexOf('{%') > amp.indexOf('<body'), [amp.indexOf('{%'), amp.indexOf('<body')]);
    /* AN HTML PARSER READS THE QUERY AS MARKUP, so `i < rows.length` opens a tag. The
       generated block writes every comparison with the larger side first. */
    ok('AMP: the query contains no < character, which a parser would read as a tag',
       !amp.slice(amp.indexOf('{%'), amp.indexOf('%}')).includes('<'),
       amp.slice(amp.indexOf('{%'), amp.indexOf('%}'))
          .split('\n').filter((l) => l.includes('<')).slice(0, 2));
    /* A TAG INSIDE AN ATTRIBUTE. In a URL the panel reports a disallowed relative URL; in
       a style attribute it breaks the quoting and reports nine invented attributes per
       slide. Both are fixed by writing the origin out and by using classes. */
    const attributes = amp.match(/(?:src|href)="([^"]*)"/g) || [];
    ok('AMP: every src and href begins with a literal https, before the engine runs',
       attributes.every((a) => /="https:\/\//.test(a)),
       attributes.filter((a) => !/="https:\/\//.test(a)).slice(0, 3));
    /* EVERY TAG IS PARSED THE WAY A PARSER WOULD, rather than pattern matched, and this
       replaced two narrower checks that each missed the next instance of the same bug.

       The first version of this file put a conditional in a style attribute. Told about it,
       I moved the conditional into a class attribute, which failed identically, because the
       cause is not the attribute's name. An attribute is double quoted and closes at the
       next double quote, so `class="{% if (x === "") ... "` ends inside the comparison and
       everything after is read as more attributes: '%}n{%', 'else', '{', '}'. That is
       exactly what the panel listed, twice.

       So this consumes each tag attribute by attribute the way a parser does and fails if
       anything is left over. It catches the style case, the class case, and any attribute
       somebody adds later. */
    const malformed = [];
    for (const tag of amp.slice(amp.indexOf('%}') + 2).match(/<[a-zA-Z][^>]*>/g) || []) {
        let rest = tag.replace(/^<[a-zA-Z][\w-]*/, '');
        for (;;) {
            const before = rest;
            rest = rest.replace(/^\s*\/?>$/, '')
                       .replace(/^\s+[a-zA-Z_:][\w:.-]*(?:="[^"]*")?/, '');
            if (rest === '' || rest === before) break;
        }
        if (rest !== '') malformed.push(tag.slice(0, 70));
    }
    ok('AMP: every tag parses attribute by attribute with nothing left over',
       malformed.length === 0, malformed.slice(0, 2));

    /* AND THE CHECK AGAINST THE EXACT MARKUP THAT FAILED, because a parser check that
       accepts everything accepts nothing. */
    const wasBroken = '<div class="{% if (a === "") { %}n t{% } else { %}n{% } %}">';
    let leftover = wasBroken.replace(/^<[a-zA-Z][\w-]*/, '');
    for (;;) {
        const before = leftover;
        leftover = leftover.replace(/^\s*\/?>$/, '')
                           .replace(/^\s+[a-zA-Z_:][\w:.-]*(?:="[^"]*")?/, '');
        if (leftover === '' || leftover === before) break;
    }
    ok('and it rejects the class attribute the panel rejected', leftover !== '',
       leftover.slice(0, 40));

    ok('AMP: so the slide styles are classes in amp-custom instead',
       amp.includes('<div class="s">') && amp.includes('.n.t{'));

    /* AND THE TWO PATHS THE ORIGIN PREFIX RELIES ON. resolve.mjs strips the same origin
       this file writes out, so if the two ever disagreed the URL would be wrong in a way
       that still validates: a doubled origin, or a missing slash. */
    ok('AMP: the origin it writes out is the one resolve.mjs strips',
       amp.includes('src="https://dengage-presales.github.io/demo-ai/{%= card.bannerPath %}"'),
       (amp.match(/src="[^"]*bannerPath[^"]*"/) || [])[0]);

    /* AND THEN THE REAL VALIDATOR, when it is installed. This is the only assertion here
       that is authority rather than inference: everything above is a rule I read off it,
       and this is it. It runs on the SEND output rather than a preview, because a preview
       rewrites addresses to relative paths and AMP requires absolute ones.

       BOTH ARTEFACTS ARE CHECKED, and confusing the two is the mistake this whole section
       is shaped around. The panel validates what you paste; the recipient sees what the
       engine produced. A pass on one says nothing about the other, and I reported a pass on
       the wrong one twice before Salil asked which I was actually running.

       IT SKIPS RATHER THAN FAILS when the package is absent, so the suite still runs on a
       machine that has not installed it, and it says which happened. */
    let validator = null;
    try {
        validator = (await import('amphtml-validator')).default;
    } catch (err) {
        console.log('   skip  AMP: official validator not installed ' +
                    '(npm ci to run it)');
    }
    if (validator) {
        const instance = await validator.getInstance();

        /* THE AUTHORED FILE FIRST, AND THIS ASSERTION IS THE ONE I SHOULD HAVE WRITTEN
           FIRST. Salil, 10 August 2026, looking at sixteen errors in the AMP playground:
           "are you not validating it yourself?" I was, with this exact validator, against
           the RESOLVED document. The playground and the Dengage panel both validate the
           file AS PASTED, tags intact, so I was checking the one artefact nobody sees and
           reporting a pass on it. Twice.

           Structural checks on the authored form are not a substitute for this, because
           they only ever cover the last mistake: they missed the class attribute after
           catching the style attribute. This runs the whole validator on the whole file. */
        const authored = instance.validateString(amp, 'AMP4EMAIL');
        ok('AMP: the official validator passes the file AS PASTED, tags and all',
           authored.status === 'PASS',
           authored.errors.map((e) => e.line + ':' + e.col + ' ' + e.params.join(' ')).slice(0, 4));

        const result = instance.validateString(rendered, 'AMP4EMAIL');
        ok('AMP: and the send output, once the engine has resolved it',
           result.status === 'PASS',
           result.errors.map((e) => e.line + ':' + e.col + ' ' + e.params.join(' ')).slice(0, 4));

        /* THE VALIDATOR AGAINST SOMETHING IT MUST REJECT, because a validator that passes
           everything passes nothing. */
        const broken = rendered.replace('<amp-img ', '<img ');
        ok('and it rejects the same document with a plain img in it',
           instance.validateString(broken, 'AMP4EMAIL').status === 'FAIL');
    }

    const path = join(ROOT, 'factory', 'panel', 'content', '_shared',
                      'scenario-' + AMP_SCENARIO + '.amp.html');
    ok('AMP: the file to paste is committed', existsSync(path));
    if (existsSync(path)) {
        ok('AMP: and matches what the generator produces now',
           readFileSync(path, 'utf8') === amp);
    }
    ok('AMP: no blank preview file is shipped, because the runtime cannot load from disk',
       !existsSync(join(ROOT, 'factory', 'panel', 'content', '_shared',
                        'scenario-' + AMP_SCENARIO + '.amp.preview.html')));
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
