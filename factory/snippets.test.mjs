/* ============================================================================
   Every short form Dynamic Content asset, executed.

     node factory/snippets.test.mjs

   WHY EXECUTED AND NOT READ. An asset is a program that runs inside Dengage, where
   nothing here can reach it: no console, no breakpoint, and a mistake renders as a
   message that looks correct and is wrong. A removed product named as still in the
   basket, a count one too high, an address on the wrong demo. All three read as normal
   copy on a phone.

   SO EVERY ASSERTION BELOW RUNS THE ASSET. factory/emails/dengage-template.mjs executes
   the same {% %} subset Dengage does, against a $from with only where, take and get,
   over a synthetic event log. That cannot prove Dengage agrees, and an HTTP 200 from a
   send does not prove it either: the only proof an event landed is the row. What it does
   prove is that the query compiles, the fold resolves, the count matches the log and no
   value is invented.

   WHAT IS CHECKED, in the order these things have gone wrong:

   1. THE SHAPE OF THE FILE. One output tag, no trailing newline, no `<` character. Each
      of the three has cost real time: a trailing newline put a space before a comma in a
      live email preheader, and a `<` is what an HTML parser reads as a tag.
   2. IT RESOLVES what the log implies, including the count and the singular.
   3. IT DEGRADES. No history, another demo's history, and a product withdrawn from the
      catalogue since the visit. None of the three may invent anything.
   4. THE CART PAIR STILL AGREES with the two hand written assets that are live in the
      panel. That is the drift alarm: those two are not generated, so a correction to the
      resolution block that changed the phrase would otherwise leave them behind silently.
   5. THE COMMITTED FILES ARE WHAT THE GENERATOR PRODUCES NOW. A stale one means the panel
      is holding last week's asset while this repository looks correct.
   6. THE MESSAGES COMPOSE AND FIT, resolved against a committed demo's real catalogue
      rather than a fixture. A real product name is longer than an invented one and a real
      slug makes the URL longer, and the 450 character limit is on the RESOLVED length.
   7. THE PANEL DOCUMENT NAMES EVERY ASSET AND EVERY SCENARIO. It is the only thing
      somebody reads before creating fourteen objects, so an asset missing from it is an
      asset that never gets built.
   ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    SNIPPETS, LIVE, CART_EQUIVALENTS, MESSAGES, SMS_LIMIT,
    snippetSource, tableOf, assetOf, assetsUsedBy, compose, previewLog, resolveAll
} from './build-snippets.mjs';
import { demoWithProducts, asProductRows } from './catalogue.mjs';
import { SCENARIOS } from './emails/scenarios.mjs';
import { render, arrayFrom } from './emails/dengage-template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'factory', 'panel', 'content', '_dynamic');

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

const sources = {};
for (const snippet of SNIPPETS) sources[snippet.file] = snippetSource(snippet);

/* -------------------------------------------------------------------------- */
/* The catalogue and the logs                                                  */

const SITE = 'https://dengage-presales.github.io/demo-ai/';
const BASE = SITE + 'demos/kitchenshop/';
const OTHER = SITE + 'demos/otherstore/';

/* FOUR PRODUCTS, AND ONE OF THEM HAS NO PRICE ON PURPOSE. Prices are strings because
   that is how the ETL loads them and Number("") is 0, which is the trap CLAUDE.md rule 5
   exists for. The fourth is withdrawn, so it exercises is_active without a second
   catalogue. */
function product(id, title, options) {
    const o = options || {};
    return {
        product_id: id,
        title,
        price: o.price === undefined ? '120.00' : o.price,
        discounted_price: o.cut === undefined ? null : o.cut,
        image_link: o.image === undefined ? BASE + 'images/' + id + '.jpg' : o.image,
        link: BASE + 'product.html?id=' + id,
        category_path: o.category === undefined ? 'Home > Cookware' : o.category,
        stock_count: o.stock === undefined ? 9 : o.stock,
        is_active: o.active === undefined ? true : o.active
    };
}

const CATALOGUE = [
    product('p1', 'Copper Saucepan'),
    product('p2', 'Cast Iron Skillet', { cut: '96.00' }),
    /* NO PICTURE AT ALL, so the image asset has to walk past it rather than emit "". */
    product('p3', 'Enamel Stockpot', { image: null }),
    /* WITHDRAWN. Its cart row still exists, the way a real one would. */
    product('p4', 'Discontinued Kettle', { active: false }),
    /* AN http PHOTOGRAPH, which a browser refuses to show in a notification. */
    product('p5', 'Wooden Spoon Set', { image: 'http://cdn.example.com/spoon.jpg' })
];

/* A page view per product, plus a home page view first, which is what makes the demo
   resolvable at all: the slug comes out of page_url and nothing else carries it.

   `hour` IS A PARAMETER AND HAS TO BE. page_view_events has no column that breaks a tie
   inside one second, so two sessions whose rows share a timestamp have no defined order
   and "the newest demo" is not a question the data can answer. The first version of the
   two demo case below gave both sessions the same times and then asserted which one won:
   it failed, and it was the fixture that was wrong rather than the asset. A test that
   needs an order has to put one in the log. */
function views(ids, options) {
    const o = options || {};
    const base = o.base || BASE;
    const session = o.session || 'ses-1';
    const hour = o.hour === undefined ? 9 : o.hour;
    const at = (n) => '2026-08-10T' + String(hour).padStart(2, '0') + ':0' + n + ':00Z';
    const rows = [{
        key: 'dev-1', session_id: session, event_date: at(0),
        page_url: base + 'index.html', page_title: 'Home',
        product_id: null, category_path: '', price: null
    }];
    ids.forEach((id, i) => rows.push({
        key: 'dev-1', session_id: session, event_date: at(i + 1),
        page_url: base + 'product.html?id=' + id,
        page_title: id, product_id: id,
        category_path: o.category || 'Home > Cookware', price: '120.00'
    }));
    return rows;
}

function log(overrides) {
    return Object.assign({
        master_device: [{ device_id: 'dev-1', contact_key: 'DPS-1' }],
        dps_product: CATALOGUE,
        page_view_events: [],
        shopping_cart_events: [],
        wishlist_events: [],
        search_events: [],
        order_events_detail: []
    }, overrides || {});
}

function run(source, tables) {
    return render(source, {
        $from: arrayFrom(log(tables)),
        $Contact: { contact_key: 'DPS-1' }
    });
}

const out = (file, tables) => run(sources[file], tables);

/* -------------------------------------------------------------------------- */
/* 1. The shape of the file                                                    */

for (const snippet of SNIPPETS) {
    const source = sources[snippet.file];
    const tags = source.match(/\{%=/g) || [];
    ok(snippet.file + ': exactly one output tag',
       tags.length === 1, tags.length);
    /* AND IT IS THE LAST THING IN THE FILE. A tag with anything after it is a tag with
       literal text after it, which in a one value asset is text nobody asked for. */
    ok(snippet.file + ': and the file ends with it',
       /\{%= [a-z]+ %\}$/.test(source), source.slice(-20));
    ok(snippet.file + ': no trailing newline, which would be emitted',
       !source.endsWith('\n'));
    /* NO `<` ANYWHERE. These are Plain Text assets so nothing parses them as markup
       today, but the same resolution block goes into the AMP email where Dengage does,
       and one source cannot be safe in one place and not the other. */
    ok(snippet.file + ': no < character, which a parser reads as a tag',
       source.indexOf('<') === -1, source.indexOf('<'));
    ok(snippet.file + ': it reads a table the schema has',
       ['page_view_events', 'shopping_cart_events', 'wishlist_events',
        'search_events', 'order_events_detail'].indexOf(tableOf(snippet)) !== -1,
       tableOf(snippet));
}

{
    /* THE SHAPE CHECK, AGAINST A FILE KNOWN TO BE WRONG. A check that only ever sees
       correct input proves nothing about what it would reject. CLAUDE.md section 4. */
    const broken = sources['view-line.txt'] + '\n';
    ok('the newline check would reject a file that ends with one',
       broken.endsWith('\n'));
    const twoTags = sources['view-line.txt'].replace('%}{%= line %}', '%}{%= name %} {%= line %}');
    ok('the one tag check would reject two',
       (twoTags.match(/\{%=/g) || []).length === 2);
}

/* -------------------------------------------------------------------------- */
/* 2. Each one resolves what its log implies                                   */

{
    /* THE LINE ASSETS. Newest product first, then a count of the rest, and the count is
       of what is still buyable rather than of rows. */
    const viewed = { page_view_events: views(['p1', 'p2', 'p3']) };
    ok('view line: the newest viewed product, and the rest counted',
       out('view-line.txt', viewed) === 'Enamel Stockpot and 2 more items',
       out('view-line.txt', viewed));

    const two = { page_view_events: views(['p1', 'p2']) };
    ok('view line: two is singular, which is the wording that gets forgotten',
       out('view-line.txt', two) === 'Cast Iron Skillet and 1 more item',
       out('view-line.txt', two));

    const one = { page_view_events: views(['p2']) };
    ok('view line: one is the name on its own',
       out('view-line.txt', one) === 'Cast Iron Skillet', out('view-line.txt', one));

    /* THE WITHDRAWN PRODUCT IS NOT COUNTED. p4 was viewed and is no longer in the
       catalogue, so a count of rows would say three and the honest answer is two. */
    const withdrawn = { page_view_events: views(['p1', 'p2', 'p4']) };
    ok('view line: a withdrawn product is neither named nor counted',
       out('view-line.txt', withdrawn) === 'Cast Iron Skillet and 1 more item',
       out('view-line.txt', withdrawn));

    /* AND WHEN THE WITHDRAWN ONE IS THE NEWEST, the name is the next one down rather
       than empty, which is the case the ordering makes easy to get wrong. */
    const newestGone = { page_view_events: views(['p1', 'p4']) };
    ok('view line: and when it is the newest, the name is the next one down',
       out('view-line.txt', newestGone) === 'Copper Saucepan',
       out('view-line.txt', newestGone));
}

{
    /* THE SAVED SET. `add` and `remove`, which are the values the SDK writes, and a
       removal has to actually remove. */
    const saved = (entries) => ({
        page_view_events: views([]),
        wishlist_events: entries.map((e, i) => ({
            event_id: 'w' + i, key: 'dev-1', session_id: 'ses-1',
            event_date: '2026-08-10T10:0' + i + ':00Z',
            event_type: e.kind || 'add', product_id: e.id,
            list_name: 'favorites', price: '150.00', discounted_price: null
        }))
    });

    const three = saved([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
    ok('saved line: the newest saved product, and the rest counted',
       out('saved-line.txt', three) === 'Enamel Stockpot and 2 more items',
       out('saved-line.txt', three));

    const removed = saved([{ id: 'p1' }, { id: 'p2' }, { id: 'p2', kind: 'remove' }]);
    ok('saved line: a removal removes, so two saves and one remove is one item',
       out('saved-line.txt', removed) === 'Copper Saucepan',
       out('saved-line.txt', removed));

    const readded = saved([
        { id: 'p1' }, { id: 'p1', kind: 'remove' }, { id: 'p1' }, { id: 'p2' }
    ]);
    ok('saved line: and saving again after removing brings it back',
       out('saved-line.txt', readded) === 'Cast Iron Skillet and 1 more item',
       out('saved-line.txt', readded));
}

{
    /* THE NEWEST ORDER'S LINES, AND ONLY THAT ORDER'S. Two orders in the log, and an
       asset that ignored order_id would count five items across both. */
    const line = (order, id, at) => ({
        key: 'dev-1', session_id: 'ses-1', event_date: at, order_id: order,
        product_id: id, quantity: 1, unit_price: '120.00',
        discounted_price: null, event_type: 'order'
    });
    const orders = {
        page_view_events: views([]),
        order_events_detail: [
            line('OLD-1', 'p1', '2026-08-01T10:00:00Z'),
            line('OLD-1', 'p2', '2026-08-01T10:00:00Z'),
            line('NEW-2', 'p2', '2026-08-09T10:00:00Z'),
            line('NEW-2', 'p3', '2026-08-09T10:00:00Z')
        ]
    };
    const got = out('order-line.txt', orders);
    ok('order line: the newest order only, so two items and not four',
       got === 'Cast Iron Skillet and 1 more item' || got === 'Enamel Stockpot and 1 more item',
       got);
    ok('order line: and it names something that was on that order',
       got.indexOf('Copper Saucepan') === -1, got);
}

{
    /* THE SEARCH TERM. The newest search that had words in it, so a later empty search
       does not blank the message. */
    const searches = (entries) => ({
        page_view_events: views([]),
        search_events: entries.map((e, i) => ({
            key: 'dev-1', session_id: 'ses-1',
            event_date: '2026-08-10T10:0' + i + ':00Z',
            keywords: e.words, result_count: e.found === undefined ? 0 : e.found, filters: null
        }))
    });

    ok('search term: the words that were typed',
       out('search-term.txt', searches([{ words: 'copper pan' }])) === 'copper pan',
       out('search-term.txt', searches([{ words: 'copper pan' }])));

    const then = searches([{ words: 'copper pan' }, { words: '' }]);
    ok('search term: an empty search after it does not blank the message',
       out('search-term.txt', then) === 'copper pan', out('search-term.txt', then));

    const later = searches([{ words: 'copper pan' }, { words: 'cast iron' }]);
    ok('search term: and the newest of two wins',
       out('search-term.txt', later) === 'cast iron', out('search-term.txt', later));
}

{
    /* THE PICTURES. The 2:1 banner beside the photograph, which is the file
       make-push-images.mjs writes and push-images.test.mjs proves exists. */
    const viewed = { page_view_events: views(['p1', 'p2']) };
    ok('view image: the banner beside the photograph, not the photograph',
       out('view-image.txt', viewed) === BASE + 'images/push/p2.jpg',
       out('view-image.txt', viewed));

    /* A PRODUCT WITH NO PICTURE IS WALKED PAST rather than emitted as "". p3 is newest
       and has no image_link at all. */
    const noPicture = { page_view_events: views(['p1', 'p3']) };
    ok('view image: a product with no photograph is walked past',
       out('view-image.txt', noPicture) === BASE + 'images/push/p1.jpg',
       out('view-image.txt', noPicture));

    /* AND SO IS AN http ONE, because a browser refuses a mixed content push image. */
    const mixed = { page_view_events: views(['p2', 'p5']) };
    ok('view image: and so is an http one, which a browser would refuse',
       out('view-image.txt', mixed) === BASE + 'images/push/p2.jpg',
       out('view-image.txt', mixed));

    /* THE WITHDRAWN PRODUCT'S PICTURE IS NOT USED EITHER. A notification showing
       something that cannot be bought is the worst of the three. */
    const gone = { page_view_events: views(['p1', 'p4']) };
    ok('view image: a withdrawn product does not supply the picture',
       out('view-image.txt', gone) === BASE + 'images/push/p1.jpg',
       out('view-image.txt', gone));
}

{
    /* THE ADDRESSES. One overlay on one demo, and every one of them absolute. */
    const viewed = { page_view_events: views(['p1']) };
    ok('url home: the demo root',
       out('url-home.txt', viewed) === BASE + 'index.html', out('url-home.txt', viewed));
    ok('url checkout: the checkout overlay on that demo',
       out('url-checkout.txt', viewed) === BASE + 'index.html?open=checkout',
       out('url-checkout.txt', viewed));
    ok('url wishlist: the wishlist overlay',
       out('url-wishlist.txt', viewed) === BASE + 'index.html?open=wishlist',
       out('url-wishlist.txt', viewed));
    ok('url search: the search overlay',
       out('url-search.txt', viewed) === BASE + 'index.html?open=search',
       out('url-search.txt', viewed));

    /* EVERY ADDRESS THE FACTORY PROMISES IS A PAGE THAT EXISTS. index.html and the
       overlays are query strings on it, which is what factory/panel/links.test.mjs
       exists to enforce: ten emails once linked to cart.html, which is not a file. */
    for (const file of ['url-home.txt', 'url-checkout.txt', 'url-wishlist.txt', 'url-search.txt']) {
        const got = out(file, viewed);
        ok(file + ': and it addresses index.html rather than a page that does not exist',
           got.indexOf(BASE + 'index.html') === 0, got);
    }

    /* AND THE OVERLAY NAME IS ONE THE STOREFRONT HONOURS, read out of the template rather
       than trusted. `?open=` selects from a named list on purpose, so a name that is not in
       it is silently ignored: the link works, the page loads, and the overlay the whole
       message was about never appears. Nothing else would catch that, because the address
       resolves to a real file either way. Same class of defect as the ten emails that
       linked to cart.html, which is not a page in a demo at all. */
    const storefront = readFileSync(join(ROOT, 'template', 'js', 'storefront.js'), 'utf8');
    const listed = storefront.slice(storefront.indexOf('var OPENABLE = {'));
    const openable = (listed.slice(0, listed.indexOf('};')).match(/^\s{8}([a-z]+):/gm) || [])
        .map((m) => m.replace(/[^a-z]/g, ''));
    ok('the storefront declares its openable overlays where they can be read',
       openable.length >= 4, openable);
    for (const file of ['url-checkout.txt', 'url-wishlist.txt', 'url-search.txt']) {
        const got = out(file, viewed);
        const wanted = (got.match(/\?open=([a-z]+)$/) || [])[1];
        ok(file + ': the overlay it opens is one the storefront honours',
           Boolean(wanted) && openable.indexOf(wanted) !== -1, [wanted, openable]);
    }
    /* AND THE READER WOULD NOTICE A NAME THAT IS NOT THERE. An empty list would pass every
       assertion above by matching nothing, which is the way this check fails open. */
    ok('and a name the storefront does not declare would be caught',
       openable.indexOf('basket') === -1 && openable.indexOf('cart') !== -1, openable);
}

/* -------------------------------------------------------------------------- */
/* 3. It degrades, and nothing invents a value                                 */

for (const snippet of SNIPPETS) {
    /* NO HISTORY AT ALL, which is what a test send from the panel looks like. */
    const empty = out(snippet.file, {});
    const url = snippet.file.indexOf('url-') === 0;
    const image = snippet.file.indexOf('-image') !== -1;
    if (url || image) {
        ok(snippet.file + ': with no history it emits nothing rather than a guess',
           empty === '', empty);
    } else {
        ok(snippet.file + ': with no history it emits its fallback phrase',
           empty !== '' && empty.indexOf('undefined') === -1 &&
           empty.indexOf('null') === -1 && empty.indexOf('NaN') === -1, empty);
    }
    ok(snippet.file + ': and never the words null, undefined or NaN',
       !/\b(?:null|undefined|NaN)\b/.test(empty), empty);
}

{
    /* ANOTHER DEMO'S HISTORY ONLY. One origin serves every demo, so one device id carries
       the events of every demo that browser ever visited, and there is no demo column to
       filter on. Scoping is the slug in page_url and nothing else. */
    const elsewhere = { page_view_events: views(['p1', 'p2'], { base: OTHER, session: 'ses-9' }) };
    ok('url home: another demo resolves to that demo, never to this one',
       out('url-home.txt', elsewhere) === OTHER + 'index.html',
       out('url-home.txt', elsewhere));

    /* TWO DEMOS IN ONE BROWSER, AND THE NEWEST WINS. The other demo is an hour earlier,
       because page_view_events has nothing to break a tie inside one second: see `views`. */
    const both = {
        page_view_events: views(['p1'], { base: OTHER, session: 'ses-9', hour: 9 })
            .concat(views(['p2'], { base: BASE, session: 'ses-1', hour: 10 }))
    };
    ok('url home: with two demos in one browser it is the newest one',
       out('url-home.txt', both) === BASE + 'index.html', out('url-home.txt', both));
    ok('view line: and the products are that demo\'s, not the other one\'s',
       out('view-line.txt', both) === 'Cast Iron Skillet', out('view-line.txt', both));

    /* EVERY VIEW ON ANOTHER DEMO, so this one has nothing to show. The catalogue here holds
       only this demo's products, and the other demo's ids happen to be the same strings,
       which is the case below. */
    ok('view image: another demo supplies no picture for this one',
       out('view-image.txt', elsewhere) === '', out('view-image.txt', elsewhere));

    /* TWO DEMOS THAT NUMBER THEIR PRODUCTS THE SAME WAY, which is the failure this test
       found on 10 August 2026 and the reason resolveBlock now scopes the product lookup as
       well as the events. A product id is the prospect's own SKU, taken off their site by
       the scrape, and nothing makes it unique across demos: dps_product holds every
       catalogue in one table, so `where('product_id', 'in', ids)` returns two rows for one
       id and the later one used to win.

       The events were already the right demo's. The product was not, so a push would have
       carried another prospect's product name, their photograph and a link to their demo. */
    const collision = {
        page_view_events: views(['p1'], { base: OTHER, session: 'ses-9', hour: 9 })
            .concat(views(['p2'], { base: BASE, session: 'ses-1', hour: 10 })),
        dps_product: CATALOGUE.concat([
            {
                product_id: 'p2', title: 'Another Prospect Kettle', price: '80.00',
                discounted_price: null, image_link: OTHER + 'images/p2.jpg',
                link: OTHER + 'product.html?id=p2', category_path: 'Home > Kettles',
                stock_count: 4, is_active: true
            }
        ])
    };
    ok('view line: a colliding product id resolves to this demo\'s product',
       out('view-line.txt', collision) === 'Cast Iron Skillet',
       out('view-line.txt', collision));
    ok('view image: and to this demo\'s photograph, not the other prospect\'s',
       out('view-image.txt', collision) === BASE + 'images/push/p2.jpg',
       out('view-image.txt', collision));

    /* AND THE PROBE THAT SHOWS THE GUARD IS DOING THE WORK. With the other prospect's row
       last in the table and no scoping, its title is what the map would hold. A check that
       passes because the fixture happens to be ordered kindly is not a check. */
    const reversed = Object.assign({}, collision, {
        dps_product: collision.dps_product.slice().reverse()
    });
    ok('view line: and it does not depend on which order the catalogue rows arrive in',
       out('view-line.txt', reversed) === 'Cast Iron Skillet', out('view-line.txt', reversed));
}

{
    /* NO PAGE VIEW AT ALL, which is the case CLAUDE.md section 1b is about. A contact
       whose cart rows exist and whose page views do not cannot be attributed to a demo,
       so the address is empty rather than a guess. */
    const noViews = {
        wishlist_events: [{
            event_id: 'w0', key: 'dev-1', session_id: 'ses-1',
            event_date: '2026-08-10T10:00:00Z', event_type: 'add',
            product_id: 'p1', list_name: 'favorites', price: '150.00', discounted_price: null
        }]
    };
    ok('url home: no page view means no demo, so no address',
       out('url-home.txt', noViews) === '', out('url-home.txt', noViews));
    /* AND THE PHRASE STILL DEGRADES RATHER THAN FAILING. The scoping found no demo, so
       the rows are unfiltered, and the fold still has a real product to name. */
    const phrase = out('saved-line.txt', noViews);
    ok('saved line: and the phrase is still something sendable',
       phrase !== '' && phrase.indexOf('undefined') === -1, phrase);
}

{
    /* A CONTACT WITH NO DEVICE ROW. Every asset builds its key set from master_device,
       and a contact who never identified on a device has none. */
    const noDevice = {
        master_device: [],
        page_view_events: views(['p1'])
    };
    for (const file of ['view-line.txt', 'view-image.txt', 'url-home.txt']) {
        const got = render(sources[file], {
            $from: arrayFrom(log(noDevice)),
            $Contact: { contact_key: 'DPS-1' }
        });
        ok(file + ': a contact with no device row renders rather than throwing',
           typeof got === 'string' && got.indexOf('undefined') === -1, got);
    }

    /* AND NO CONTACT AT ALL, which is what a preview with nothing selected passes. */
    for (const file of ['view-line.txt', 'url-home.txt']) {
        let got = null;
        try {
            got = render(sources[file], { $from: arrayFrom(log({})), $Contact: null });
        } catch (err) {
            got = 'threw: ' + err.message;
        }
        ok(file + ': and no contact at all does not throw',
           typeof got === 'string' && got.indexOf('threw:') === -1, got);
    }
}

/* -------------------------------------------------------------------------- */
/* 4. The cart pair still agrees with the live hand written assets             */

{
    /* THE DRIFT ALARM, and it is the assertion in this file most likely to earn its
       keep. The two cart assets in the panel are hand written and are not regenerated,
       because they are live and the abandoned cart flow is the one confirmed working end
       to end in all three channels. That is a reasonable decision and it has one cost: a
       correction to the shared resolution block would improve nine assets and quietly
       leave those two behind.

       So this builds the cart line and the cart image from the shared source, runs both
       against the same log as the live files, and requires the same output. When it
       fails, the fix is to re-paste the live asset rather than to change this. */
    const cart = (entries) => ({
        page_view_events: views([]),
        shopping_cart_events: entries.map((e, i) => ({
            id: 100 + i, key: 'dev-1', session_id: 'ses-1',
            event_date: '2026-08-10T10:0' + i + ':00Z',
            event_type: e.kind || 'add_to_cart', product_id: e.id,
            quantity: e.qty === undefined ? 1 : e.qty,
            unit_price: '120.00', discounted_price: null
        }))
    });

    const cases = [
        cart([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]),
        cart([{ id: 'p1' }, { id: 'p2' }]),
        cart([{ id: 'p2' }]),
        cart([{ id: 'p1' }, { id: 'p1', kind: 'remove_from_cart' }, { id: 'p2' }]),
        cart([{ id: 'p1' }, { id: 'p2' }, { id: 'p2', kind: 'delete_cart' }]),
        cart([{ id: 'p1' }, { id: 'p4' }]),
        cart([{ id: 'p3' }, { id: 'p5' }]),
        {}
    ];

    for (const equivalent of CART_EQUIVALENTS) {
        const path = join(DIR, equivalent.file);
        if (!existsSync(path)) {
            ok(equivalent.file + ': the live asset is committed', false, path);
            continue;
        }
        const live = readFileSync(path, 'utf8');
        const built = snippetSource(equivalent);
        ok(equivalent.file + ': the live asset is committed and is not generated', true);

        let agreed = 0;
        const differed = [];
        for (const tables of cases) {
            const a = run(live, tables);
            const b = run(built, tables);
            if (a === b) agreed++; else differed.push([a, b]);
        }
        ok(equivalent.file + ': the shared source produces the same output on ' +
           cases.length + ' logs',
           differed.length === 0, differed.slice(0, 2));
        ok(equivalent.file + ': and every one of those logs produced something',
           agreed === cases.length, agreed);
    }

    /* AND THE ALARM WOULD ACTUALLY SOUND. A comparison that only ever sees two identical
       things says nothing about what it would catch, and this one guards a decision
       rather than a line of code, so it is the one worth probing. */
    const live = readFileSync(join(DIR, 'abandoned-cart.txt'), 'utf8');
    const drifted = live.replace('" and " + (count - 1) + " more items"',
                                 '" and " + count + " more items"');
    ok('the comparison would catch a phrase that drifted by one',
       drifted !== live &&
       run(drifted, cases[0]) !== run(snippetSource(CART_EQUIVALENTS[0]), cases[0]),
       [run(drifted, cases[0]), run(snippetSource(CART_EQUIVALENTS[0]), cases[0])]);
}

/* -------------------------------------------------------------------------- */
/* 5. The committed files are what the generator produces now                  */

for (const snippet of SNIPPETS) {
    const path = join(DIR, snippet.file);
    if (!existsSync(path)) {
        ok(snippet.file + ': is committed', false, path);
        continue;
    }
    ok(snippet.file + ': the committed file is what the generator produces now',
       readFileSync(path, 'utf8') === sources[snippet.file]);
}

{
    /* NO TWO ASSETS SHARE A FILE OR A PANEL NAME. Two rows pointing at one object is how
       an id gets filed against the wrong asset, which happened on 10 August 2026 and put
       a URL in an email preheader for a day. */
    const files = SNIPPETS.map((s) => s.file);
    const names = SNIPPETS.map((s) => s.panel);
    ok('every asset has its own file', new Set(files).size === files.length, files.length);
    ok('and its own name to create it under', new Set(names).size === names.length, names.length);
    /* AND NONE OF THEM COLLIDES WITH A LIVE ONE. */
    const liveNames = CART_EQUIVALENTS.map((s) => s.panel);
    ok('and none of them is the name of a live asset',
       names.every((n) => liveNames.indexOf(n) === -1), names);
}

/* -------------------------------------------------------------------------- */
/* 6. The messages, composed and measured against a real demo                  */

{
    /* AGAINST THE COMMITTED CATALOGUE, not a fixture, because the two things that go wrong
       here are about real data: a product name longer than any invented one, and a slug
       long enough that the URL eats the field. Everything above this point uses synthetic
       products deliberately; this part must not. */
    const demo = demoWithProducts();
    ok('there is a committed demo to resolve the messages against', Boolean(demo),
       demo && demo.slug);

    if (demo) {
        const cat = asProductRows(demo.slug, demo.list);
        const resolved = resolveAll(previewLog(demo.slug, cat));

        /* EVERY SCENARIO THE EMAILS HAVE, and no others. Seven emails and seven pairs of
           short form messages: a scenario with an email and no push is a gap nobody sees,
           and one with a push and no email is a scenario that does not exist. */
        const emailIds = SCENARIOS.map((s) => s.id).sort().join(',');
        const messageIds = MESSAGES.map((m) => m.id).sort().join(',');
        ok('there is one message pair per scenario email, and the ids agree',
           emailIds === messageIds, [emailIds, messageIds]);

        for (const message of MESSAGES) {
            /* EVERY ASSET IT NAMES EXISTS. A rename that left a composition pointing at a
               deleted asset would be a field somebody pastes an id into for nothing. */
            let known = true;
            for (const file of assetsUsedBy(message)) {
                try { assetOf(file); } catch (err) { known = false; }
            }
            ok(message.id + ': every asset it references exists', known,
               assetsUsedBy(message));

            const body = compose(message.sms, resolved);
            ok(message.id + ': the SMS body fits the ' + SMS_LIMIT + ' character field once ' +
               'its tags expand', body.length <= SMS_LIMIT, body.length);
            ok(message.id + ': and it resolved to something rather than a gap',
               body.length > 40 && body.indexOf('  ') === -1 && !/\s[.,?]/.test(body), body);
            ok(message.id + ': and never the words null, undefined or NaN',
               !/\b(?:null|undefined|NaN)\b/.test(body), body);

            /* THE PHRASE NEVER TAKES A VERB AFTER IT. One item and nine items have to read
               equally well, and only the recipient knows which they are, so every snippet
               in a sentence follows a colon or a question mark and nothing agrees with it.
               "Oxford Shirt are waiting for you" is the failure this prevents. */
            const parts = Array.isArray(message.sms) ? message.sms : [message.sms];
            let agreed = true;
            parts.forEach((part, i) => {
                if (typeof part !== 'object' || !part.asset) return;
                if (part.asset.indexOf('url-') === 0 || part.asset.indexOf('-url') !== -1) return;
                const before = i > 0 && typeof parts[i - 1] === 'string' ? parts[i - 1] : '';
                if (!/[:?]\s$/.test(before) && !/^Still looking for $/.test(before)) agreed = false;
            });
            ok(message.id + ': the phrase follows a colon, so one item reads as well as nine',
               agreed, parts.filter((p) => typeof p === 'string'));

            /* THE ALTERNATE IS A USABLE MESSAGE, not a footer. The panel sends it in place
               of the body when the body's tags expand past the limit, so a contact really
               receives it. */
            ok(message.id + ': the alternate message is a message rather than a note',
               typeof message.alternate === 'string' && message.alternate.length > 30 &&
               message.alternate.length <= SMS_LIMIT && /\.$/.test(message.alternate),
               message.alternate);
            /* AND IT CARRIES NO TAG, which is the whole point of an alternate: it has to be
               deliverable when expansion is what failed. */
            ok(message.id + ': and the alternate holds no snippet of its own',
               message.alternate.indexOf('{%') === -1 && message.alternate.indexOf('<') === -1);

            const title = message.push.title;
            ok(message.id + ': the push title is short enough to survive a lock screen',
               typeof title === 'string' && title.length > 0 && 40 >= title.length,
               [title, title.length]);
            /* NO SNIPPET IN THE TITLE. A title is where a truncated product name looks
               worst, and the message line under it is where the same phrase has room. */
            ok(message.id + ': and it is fixed copy, so nothing truncates in it',
               title.indexOf('{%') === -1);

            const pushed = compose(message.push.message, resolved);
            ok(message.id + ': the push message resolved',
               pushed.length > 10 && !/\b(?:null|undefined|NaN)\b/.test(pushed), pushed);

            const media = compose(message.push.media, resolved);
            ok(message.id + ': the Media field is an https address or empty',
               media === '' || media.indexOf('https://') === 0, media);
            const url = compose(message.push.url, resolved);
            ok(message.id + ': the Target URL is this demo, and it is absolute',
               url.indexOf('https://') === 0 && url.indexOf('/demos/' + demo.slug + '/') !== -1,
               url);
        }

        /* NOTHING ANYWHERE REACHES FOR A CONTACT ATTRIBUTE. A demo sets the contact key and
           no attributes, so $Contact.first_name is empty for every contact a demo creates
           and a subject line with a name in it renders as "Hi ," on a call. */
        const everything = JSON.stringify(MESSAGES);
        ok('no message reaches for a contact attribute, which a demo never sets',
           everything.indexOf('$Contact') === -1);
    }
}

/* -------------------------------------------------------------------------- */
/* 7. The panel document says what somebody has to do                          */

{
    const doc = readFileSync(join(ROOT, 'factory', 'panel', 'SMS-AND-PUSH.md'), 'utf8');
    const missing = SNIPPETS.filter((s) => doc.indexOf(s.panel) === -1).map((s) => s.panel);
    ok('every asset is named in the document somebody creates them from',
       missing.length === 0, missing);
    const unlinked = SNIPPETS.filter((s) => doc.indexOf('content/_dynamic/' + s.file) === -1)
        .map((s) => s.file);
    ok('and linked to the file whose body goes in it', unlinked.length === 0, unlinked);
    /* AND EVERY MESSAGE IS IN IT UNDER THE NAME SOMEBODY TYPES. The document is the only
       thing read before creating fourteen assets and fourteen messages, so a scenario
       missing from it is a scenario that does not get built. The campaign name is what is
       pinned rather than the longer journey description, because the name is the part that
       has to match what is in the panel. */
    const absent = MESSAGES.filter((m) => doc.indexOf(m.name) === -1).map((m) => m.name);
    ok('and every message is named in it, under the name it gets in the panel',
       absent.length === 0, absent);

    /* THE SAME NAME IN ALL THREE CHANNELS. A campaign builder looking for a scenario's
       messages should find the email, the SMS and the push under one name rather than three
       spellings of it, so the email document is held to the same list. */
    const emails = readFileSync(join(ROOT, 'factory', 'panel', 'SCENARIO-EMAILS.md'), 'utf8');
    const unnamed = MESSAGES.filter((m) => emails.indexOf(m.name) === -1).map((m) => m.name);
    ok('and the email of the same scenario carries the same name',
       unnamed.length === 0, unnamed);
    /* THE THREE LIVE ASSETS TOO, because two of the seven scenarios use them and somebody
       reading only the new table would not know they already exist. */
    const liveMissing = LIVE.filter((s) => doc.indexOf(s.panel) === -1).map((s) => s.panel);
    ok('and so are the three that are already live', liveMissing.length === 0, liveMissing);
}

/* -------------------------------------------------------------------------- */

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
