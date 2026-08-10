/* ============================================================================
   The basket replay, executed rather than read.

     node factory/panel/content/_dynamic/cart.test.mjs

   WHY THIS EXISTS. The resolution block at the top of each abandoned cart asset is
   the only piece of logic in this repository that runs inside Dengage, where nothing
   can reach it: no console, no breakpoint, and a mistake renders as an email that
   looks fine and is wrong. Three defects have already shipped from it.

     1. The basket was read off the newest rows, so a removal came back as though it
        were still in the basket.
     2. Cart events inside the same minute share an event_date, so without the row id
        the order within that minute was arbitrary and adds and removes resolved at
        random.
     3. It showed three products. A real basket held four, and the fourth silently
        disappeared with nothing in the email to say so.

   The block is ordinary JavaScript apart from $from, so it can be lifted out of the
   asset and run against a synthetic event log with $from stubbed. That is what this
   file does. It reads the assets themselves rather than a copy of the logic, so the
   assertions cannot drift away from what the panel is given.

   The stub returns rows in REVERSE insertion order on purpose. take(n) without an
   ordering returns some n rows rather than the newest n, so the block must not depend
   on the order it receives anything in.
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

/* -------------------------------------------------------------------------- */
/* The stub. where, take and get, because that is all $from has                */

function stubFrom(tables) {
    /* page_view_events defaults to empty, so a case that does not care about which demo
       a row belongs to still runs. With no page views the asset cannot attribute any
       row to a demo and deliberately does not filter, which is the fallback being
       relied on here. */
    const all = Object.assign({ page_view_events: [] }, tables);
    return function (name) {
        const table = String(name).replace('$db.', '');
        if (!Object.prototype.hasOwnProperty.call(all, table)) {
            throw new Error('the asset queried a table the test does not model: ' + table);
        }
        let rows = all[table].slice().reverse();
        const api = {
            where(column, operator, value) {
                if (operator === '=') {
                    rows = rows.filter((r) => String(r[column]) === String(value));
                } else if (operator === 'in') {
                    const wanted = (value || []).map(String);
                    rows = rows.filter((r) => wanted.indexOf(String(r[column])) !== -1);
                } else {
                    throw new Error('the asset used an operator this test does not model: ' + operator);
                }
                return api;
            },
            take(n) { rows = rows.slice(0, n); return api; },
            get() { return rows; }
        };
        return api;
    };
}

/* The resolution block is everything up to the first closing tag. Lifted from the
   asset on disk so this test cannot pass against logic the panel never sees. */
function resolver(file, returns) {
    const source = readFileSync(join(HERE, file), 'utf8');
    const block = source.match(/^\{%([\s\S]*?)%\}/);
    if (!block) throw new Error(file + ' does not open with a code block');
    /* eslint-disable-next-line no-new-func */
    return new Function('$from', '$Contact', block[1] + '\nreturn ' + returns + ';');
}

const html = resolver('abandoned-cart.html',
    '{ ids: ids, more: more, all: all, present: present, keys: keys }');
const json = resolver('abandoned-cart.json',
    '{ ids: ids, more: more, all: all }');
const text = resolver('abandoned-cart.txt',
    '{ ids: ids, all: all, line: line, count: count }');
const total = resolver('abandoned-cart-total.html',
    '{ subtotal: subtotal, discount: discount, counted: counted, priced: priced }');
const image = resolver('abandoned-cart-image.txt', '{ image: image, ids: ids }');
const url = resolver('abandoned-cart-url.txt',
    '{ basketUrl: basketUrl, target: target, rootOf: rootOf }');
const recommend = resolver('recommendations.html',
    '{ picks: picks, wanted: wanted, label: LABEL, lead: LEAD, cards: cards }');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */

const CONTACT = { contact_key: 'DPS-1' };
const DEVICE = 'device-aaa';

const devices = [
    { device_id: DEVICE, contact_key: 'DPS-1' },
    { device_id: 'device-somebody-else', contact_key: 'DPS-9' }
];

let nextId = 100;
function event(type, productId, date, quantity, key, session) {
    return {
        id: nextId++,
        key: key || DEVICE,
        session_id: session || 'session-1',
        event_date: date,
        event_type: type,
        product_id: productId,
        quantity: quantity === undefined ? 1 : quantity
    };
}

/* A page view is what ties a session to a demo. The SDK fills page_url itself, and the
   slug is in it. CLAUDE.md 1b: this join is the only way back to a demo's rows. */
function view(session, slug) {
    return {
        session_id: session,
        page_url: 'https://dengage-presales.github.io/demo-ai/demos/' + slug + '/index.html',
        event_date: '2026-08-09T09:00:00Z'
    };
}

/* A PRODUCT PAGE VIEW, which is a real page_view_events row. pageview() in
   template/js/dengageEvents.js sends product_id and category_path, and the SDK fills
   page_url and session_id itself, so a view of a product is recoverable per contact
   without any engine. */
function viewProduct(session, slug, productId, when) {
    return {
        session_id: session,
        key: DEVICE,
        page_type: 'product',
        product_id: productId,
        page_url: 'https://dengage-presales.github.io/demo-ai/demos/' + slug +
            '/product.html?id=' + productId,
        event_date: when
    };
}

function product(id, active) {
    return {
        product_id: id,
        title: 'Product ' + id,
        price: '10.00',
        discounted_price: null,
        image_link: 'https://example.test/' + id + '.jpg',
        link: 'https://example.test/p/' + id,
        category_path: 'Category',
        is_active: active === undefined ? true : active
    };
}

function catalogue(ids) {
    return ids.map((id) => product(id));
}

/* -------------------------------------------------------------------------- */
/* 1. The defect the user hit: a basket of four showed three                    */

{
    const MINUTE = '2026-08-09T10:00:00Z';
    const cart = [
        event('add_to_cart', 'p1', MINUTE),
        event('add_to_cart', 'p2', MINUTE),
        event('add_to_cart', 'p3', MINUTE),
        event('add_to_cart', 'p4', MINUTE)
    ];
    const from = stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2', 'p3', 'p4'])
    });

    const out = html(from, CONTACT);
    ok('a basket of four resolves four products', out.ids.length === 4, out.ids);
    ok('and nothing is described as held back', out.more === 0, out.more);
    ok('newest addition first', out.ids[0] === 'p4', out.ids);

    ok('the JSON asset agrees', json(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2', 'p3', 'p4'])
    }), CONTACT).ids.length === 4);

    /* The text asset counts every item rather than a display window, because SMS
       names one product and then says how many others there are. Capped at three it
       told a four item basket it held three. */
    ok('the text asset counts all four', text(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2', 'p3', 'p4'])
    }), CONTACT).all.length === 4);
}

/* -------------------------------------------------------------------------- */
/* 2. Overflow is stated, not silent                                            */

{
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const cart = ids.map((id, i) =>
        event('add_to_cart', id, '2026-08-09T10:0' + i + ':00Z'));
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(ids)
    }), CONTACT);

    ok('eight items show six', out.ids.length === 6, out.ids);
    ok('and the email can say two more', out.more === 2, out.more);
    ok('the whole basket is still known', out.all.length === 8, out.all.length);
}

/* -------------------------------------------------------------------------- */
/* 3. The log is replayed. A removal is not a basket item                       */

{
    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z'),
        event('add_to_cart', 'p2', '2026-08-09T10:01:00Z'),
        event('remove_from_cart', 'p1', '2026-08-09T10:02:00Z'),
        event('begin_checkout', null, '2026-08-09T10:03:00Z')
    ];
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2'])
    }), CONTACT);

    ok('a removed product is gone', out.ids.indexOf('p1') === -1, out.ids);
    ok('the one still in the basket survives',
       out.ids.length === 1 && out.ids[0] === 'p2', out.ids);
}

/* -------------------------------------------------------------------------- */
/* 4. A product added again after being removed comes back                      */

{
    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z'),
        event('remove_from_cart', 'p1', '2026-08-09T10:01:00Z'),
        event('add_to_cart', 'p1', '2026-08-09T10:02:00Z', 3)
    ];
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1'])
    }), CONTACT);

    ok('re-adding a removed product puts it back', out.ids.length === 1, out.ids);
    ok('and the quantity is the one it was re-added with',
       Number(out.present.p1.quantity) === 3, out.present.p1);
}

/* -------------------------------------------------------------------------- */
/* 5. delete_cart empties everything before it, and nothing after               */

{
    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z'),
        event('add_to_cart', 'p2', '2026-08-09T10:01:00Z'),
        event('delete_cart', null, '2026-08-09T10:02:00Z'),
        event('add_to_cart', 'p3', '2026-08-09T10:03:00Z')
    ];
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2', 'p3'])
    }), CONTACT);

    ok('delete_cart clears what came before',
       out.ids.length === 1 && out.ids[0] === 'p3', out.ids);
}

/* -------------------------------------------------------------------------- */
/* 6. Seven events in one minute. The row id is the only tie break              */

{
    const SAME = '2026-08-09T10:00:00Z';
    const cart = [
        event('add_to_cart', 'p1', SAME),
        event('add_to_cart', 'p2', SAME),
        event('remove_from_cart', 'p1', SAME),
        event('add_to_cart', 'p3', SAME),
        event('add_to_cart', 'p1', SAME),
        event('remove_from_cart', 'p3', SAME),
        event('add_to_cart', 'p4', SAME)
    ];
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2', 'p3', 'p4'])
    }), CONTACT);

    /* p1 removed then added back, p3 added then removed, p2 and p4 untouched. */
    ok('a whole session inside one minute resolves in order',
       out.ids.join(',') === 'p4,p1,p2', out.ids);
}

/* -------------------------------------------------------------------------- */
/* 7. No login. The device link is what finds the rows                          */

{
    const cart = [event('add_to_cart', 'p1', '2026-08-09T10:00:00Z', 1, DEVICE)];
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1'])
    }), CONTACT);

    ok('the contact key is one of the keys searched',
       out.keys.indexOf('DPS-1') !== -1, out.keys);
    ok('and so is the device linked to it', out.keys.indexOf(DEVICE) !== -1, out.keys);
    ok('another contact\'s device is not',
       out.keys.indexOf('device-somebody-else') === -1, out.keys);
    ok('a basket built while signed out still resolves', out.ids.length === 1, out.ids);
}

/* -------------------------------------------------------------------------- */
/* 8. A withdrawn product is dropped at render, not at resolution               */

{
    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z'),
        event('add_to_cart', 'p2', '2026-08-09T10:01:00Z')
    ];
    const from = stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: [product('p1', true), product('p2', false)]
    });
    const out = html(from, CONTACT);
    ok('both ids resolve, and the inactive one is filtered when rendered',
       out.ids.length === 2, out.ids);
}

/* -------------------------------------------------------------------------- */
/* 9. An empty basket, and a contact with nothing linked, both resolve to empty */

{
    const empty = html(stubFrom({
        master_device: devices, shopping_cart_events: [], dps_product: []
    }), CONTACT);
    ok('an empty basket is empty rather than an error', empty.ids.length === 0);

    const anonymous = html(stubFrom({
        master_device: [], shopping_cart_events: [], dps_product: []
    }), { contact_key: '' });
    ok('a contact with no key resolves to nothing rather than throwing',
       anonymous.ids.length === 0 && anonymous.keys.length === 0);
}

/* -------------------------------------------------------------------------- */
/* 10. Only cart events count. A row from another table shape cannot leak in     */

{
    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z'),
        event('view_cart', 'p2', '2026-08-09T10:01:00Z'),
        event('ADD_TO_CART', 'p3', '2026-08-09T10:02:00Z')
    ];
    const out = html(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        dps_product: catalogue(['p1', 'p2', 'p3'])
    }), CONTACT);

    ok('an event type that is not a cart change is ignored',
       out.ids.indexOf('p2') === -1, out.ids);
    ok('and the event type is matched case insensitively',
       out.ids.indexOf('p3') !== -1, out.ids);
}

/* -------------------------------------------------------------------------- */
/* 11. The totals asset adds up real prices, and refuses when it cannot         */

{
    /* Two of one at 10.00, one at 25.00 reduced to 20.00, one withdrawn. */
    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z', 2),
        event('add_to_cart', 'p2', '2026-08-09T10:01:00Z', 1),
        event('add_to_cart', 'p3', '2026-08-09T10:02:00Z', 1)
    ];
    const priced = [
        product('p1'),
        Object.assign(product('p2'), { price: '25.00', discounted_price: '20.00' }),
        Object.assign(product('p3', false), { price: '99.00' })
    ];
    const out = total(stubFrom({
        master_device: devices, shopping_cart_events: cart, dps_product: priced
    }), CONTACT);

    ok('the subtotal is the sum of full prices times quantity',
       out.priced && out.subtotal === 45, out);
    ok('the discount is the real reduction, not a percentage of anything',
       out.discount === 5, out.discount);
    ok('so the total is 40', out.subtotal - out.discount === 40, out);
    ok('a withdrawn product is not counted', out.counted === 3, out.counted);

    /* THE Number(null) TRAP, which has shipped the same defect twice on the core
       repository. A product with no price contributes zero to a sum, so the total
       comes out lower than the basket and looks entirely plausible. There is no
       honest total to show, so nothing is shown. */
    const unpriced = total(stubFrom({
        master_device: devices,
        shopping_cart_events: [event('add_to_cart', 'p1', '2026-08-09T10:00:00Z')],
        dps_product: [Object.assign(product('p1'), { price: null })]
    }), CONTACT);
    ok('a product with no price suppresses the whole block rather than under-counting',
       unpriced.priced === false, unpriced);

    const emptyBasket = total(stubFrom({
        master_device: devices, shopping_cart_events: [], dps_product: []
    }), CONTACT);
    ok('an empty basket shows no totals at all', emptyBasket.priced === false);

    /* A discounted price above the full price is a data fault, not a surcharge. */
    const backwards = total(stubFrom({
        master_device: devices,
        shopping_cart_events: [event('add_to_cart', 'p1', '2026-08-09T10:00:00Z')],
        dps_product: [Object.assign(product('p1'),
            { price: '10.00', discounted_price: '12.00' })]
    }), CONTACT);
    ok('a discounted price above the full price adds no discount',
       backwards.priced && backwards.discount === 0, backwards);
}

/* -------------------------------------------------------------------------- */
/* 12. The markup around the logic, for the two things that have no image        */

{
    /* A TEXT CHECK, AND IT HAS TO BE. Everything above executes the resolution block,
       but the rendering below it is a Dengage template rather than JavaScript, so the
       only thing assertable offline is its shape. Each of these is a defect that shipped
       and that no test could see.

       PRODUCTS ARE CARDS, TWO ACROSS, NOT LINE ITEMS. A 96px thumbnail beside
       left-aligned text reads as an order confirmation; the reference this was rebuilt
       against merchandises them as centred cards with large images. */
    const source = readFileSync(join(HERE, 'abandoned-cart.html'), 'utf8');
    ok('the products are laid out two across',
       /for \(var g = 0; g < cards.length; g \+= 2\)/.test(source) &&
       (source.match(/<td width="50%"/g) || []).length >= 2);
    ok('and each card is centred',
       /<td width="50%" align="center"/.test(source));

    /* An odd number of cards must still close its row, or the table reflows. */
    ok('an odd last row is padded rather than left short',
       /if \(!card\) \{ %\}/.test(source));

    /* The image is emitted only when there is one. A card with none starts at the
       category instead, so there is no empty cell to leave dead space, which is what a
       catalogue with no pictures used to look like. One demo here has none. */
    ok('the image is inside a has-an-image condition',
       source.indexOf('{% if (card.image !== "") { %}') !== -1);

    /* THE IMAGE ITSELF MUST NOT BE GIVEN A HEIGHT, because the catalogue's images are
       1.00, 1.26 and 1.50 aspect and a forced square squashed the wide ones. */
    const img = (source.match(/<img [^>]*>/g) || [])[0] || '';
    ok('the image is not given a height, so a wide photograph is not squashed',
       /height:auto/.test(img) && !/\sheight="/.test(img), img);

    /* BUT ITS FRAME IS, and that is the other half. Without a fixed height cell around
       it, two cards in a row start their text at different heights, because their images
       do not: the reference this was rebuilt against only avoids that because every one
       of its images is the same 270x203. */
    ok('the image sits in a fixed height frame, so a row of cards lines up',
       /<td height="200" align="center" valign="middle"/.test(source));

    /* AND THE NAME IS CLAMPED, for the same reason. A 95 character product name is four
       lines in a 290px card, so the price under it lands somewhere different in each. */
    ok('a long product name is clamped rather than wrapping to four lines',
       /t\.length > 60 \? t\.substring\(0, 57\)/.test(source));
}

/* -------------------------------------------------------------------------- */
/* 13. ONE DEMO'S BASKET, NOT EVERY DEMO'S                                      */

{
    /* THE DEFECT THIS SECTION EXISTS FOR. Every demo is served from one origin, so the
       SDK's device id is the same on all of them, and DPS- contact keys are shared on
       purpose. That means one key carries the cart rows of every demo the same browser
       ever visited, and a send showed all of them mixed together: four garments from
       one storefront and a laptop keyboard from another, in one basket.

       There is no demo column to filter on and there never was: columns cannot be added
       to the six standard tables. What there is, is session_id. A session belongs to one
       page, page_view_events carries that page's URL, and the slug is in the URL. So the
       asset resolves session to demo, takes the demo of the newest cart row, and keeps
       only that demo's rows. */
    const cart = [
        event('add_to_cart', 'shirt', '2026-08-09T09:00:00Z', 1, DEVICE, 'session-fashion'),
        event('add_to_cart', 'boot', '2026-08-09T09:01:00Z', 1, DEVICE, 'session-fashion'),
        event('add_to_cart', 'keyboard', '2026-08-09T10:00:00Z', 1, DEVICE, 'session-tech'),
        event('add_to_cart', 'battery', '2026-08-09T10:01:00Z', 1, DEVICE, 'session-tech')
    ];
    const views = [
        view('session-fashion', 'showcase'),
        view('session-tech', 'techiestore-in')
    ];
    const products = catalogue(['shirt', 'boot', 'keyboard', 'battery']);

    const out = html(stubFrom({
        master_device: devices, shopping_cart_events: cart,
        page_view_events: views, dps_product: products
    }), CONTACT);

    ok('only the newest demo\'s items are in the basket',
       out.ids.join(',') === 'battery,keyboard', out.ids);
    ok('the other demo\'s items are gone', out.ids.indexOf('shirt') === -1);
    ok('and the count reflects the scoped basket, not the combined one',
       out.all.length === 2, out.all.length);

    /* AND IT FOLLOWS THE VISITOR. The same rows with the fashion session newest should
       resolve the other way round, which is what proves it is scoping rather than
       preferring one demo. */
    const reversed = [
        event('add_to_cart', 'keyboard', '2026-08-09T09:00:00Z', 1, DEVICE, 'session-tech'),
        event('add_to_cart', 'shirt', '2026-08-09T10:00:00Z', 1, DEVICE, 'session-fashion'),
        event('add_to_cart', 'boot', '2026-08-09T10:01:00Z', 1, DEVICE, 'session-fashion')
    ];
    const other = html(stubFrom({
        master_device: devices, shopping_cart_events: reversed,
        page_view_events: views, dps_product: products
    }), CONTACT);
    ok('the newest activity decides which demo it is',
       other.ids.join(',') === 'boot,shirt', other.ids);

    /* A REMOVAL ON ONE DEMO MUST NOT EMPTY ANOTHER'S BASKET, which is why the scoping
       happens before the replay rather than after it. delete_cart is the sharp case:
       clearing a basket on one storefront used to clear the email's basket for all. */
    const cleared = [
        event('add_to_cart', 'shirt', '2026-08-09T09:00:00Z', 1, DEVICE, 'session-fashion'),
        event('add_to_cart', 'keyboard', '2026-08-09T10:00:00Z', 1, DEVICE, 'session-tech'),
        event('delete_cart', null, '2026-08-09T10:05:00Z', 1, DEVICE, 'session-fashion'),
        event('add_to_cart', 'battery', '2026-08-09T10:06:00Z', 1, DEVICE, 'session-tech')
    ];
    const survived = html(stubFrom({
        master_device: devices, shopping_cart_events: cleared,
        page_view_events: views, dps_product: products
    }), CONTACT);
    ok('a delete_cart on one demo leaves the other demo\'s basket alone',
       survived.ids.join(',') === 'battery,keyboard', survived.ids);

    /* THE FALLBACK, and it has to be this way round. If no page view resolves, the asset
       cannot attribute anything, and an empty email is a worse failure than an
       unscoped one: the recipient sees nothing rather than seeing too much. */
    const unresolved = html(stubFrom({
        master_device: devices, shopping_cart_events: cart,
        page_view_events: [], dps_product: products
    }), CONTACT);
    ok('with no page views it falls back to the whole basket rather than an empty one',
       unresolved.ids.length === 4, unresolved.ids);

    /* A URL that is not a demo URL yields no slug, so it cannot become a target. */
    const foreign = html(stubFrom({
        master_device: devices, shopping_cart_events: cart,
        page_view_events: [{ session_id: 'session-tech', page_url: 'https://example.test/x' }],
        dps_product: products
    }), CONTACT);
    ok('a page URL with no demo in it attributes nothing',
       foreign.ids.length === 4, foreign.ids);

    /* All four assets share this block, so all four have to scope. */
    for (const [name, run] of [['JSON', json], ['text', text]]) {
        const scoped = run(stubFrom({
            master_device: devices, shopping_cart_events: cart,
            page_view_events: views, dps_product: products
        }), CONTACT);
        ok('the ' + name + ' asset scopes to one demo too',
           scoped.all.length === 2, scoped.all);
    }
    const scopedTotal = total(stubFrom({
        master_device: devices, shopping_cart_events: cart,
        page_view_events: views, dps_product: products
    }), CONTACT);
    ok('and the total is the scoped basket\'s total, not the combined one',
       scopedTotal.counted === 2, scopedTotal);
}

/* -------------------------------------------------------------------------- */
/* 14. THE RECOMMENDATIONS, which are the storefront's rail and not a new idea    */

{
    /* template/js/recommend.js computes five strategies in the browser from the demo's
       own catalogue, and says why it is local: the Dengage engine is fed per application
       and every demo shares one, so an engine rail would offer a fashion prospect
       phones. An email cannot run that JavaScript, so the asset runs the same strategy
       against dps_product. This section checks it picks the right things.

       SCOPING IS THE HARD PART AND IT IS NOT store_name. That column is the same
       constant for every demo, and the slug lives in a Supabase only column that never
       reaches Dengage. What does reach it is link, which is absolute and contains the
       slug, so the asset filters on it after the query rather than in it. */
    const shirt = Object.assign(product('mine:shirt'), {
        category_path: 'Fashion > Shirts',
        link: 'https://dengage-presales.github.io/demo-ai/demos/mine/product.html?id=shirt'
    });
    const sameRange = ['mine:a', 'mine:b', 'mine:c', 'mine:d', 'mine:e'].map((id) =>
        Object.assign(product(id), {
            category_path: 'Fashion > Shirts',
            link: 'https://dengage-presales.github.io/demo-ai/demos/mine/product.html?id=' + id
        }));
    /* Another demo, same category name. This is the case store_name could not have
       caught and the link filter does. */
    const otherDemo = Object.assign(product('theirs:x'), {
        category_path: 'Fashion > Shirts',
        link: 'https://dengage-presales.github.io/demo-ai/demos/theirs/product.html?id=x'
    });
    const withdrawn = Object.assign(product('mine:gone', false), {
        category_path: 'Fashion > Shirts',
        link: 'https://dengage-presales.github.io/demo-ai/demos/mine/product.html?id=gone'
    });

    const cart = [event('add_to_cart', 'mine:shirt', '2026-08-09T10:00:00Z', 1, DEVICE, 'session-mine')];
    const views = [view('session-mine', 'mine')];
    const tables = {
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shirt].concat(sameRange, [otherDemo, withdrawn])
    };

    const out = recommend(stubFrom(tables), CONTACT);

    ok('it looks in the categories the basket is in',
       out.wanted.join(',') === 'Fashion > Shirts', out.wanted);
    ok('it uses the label the storefront uses', out.label === 'More like this', out.label);
    ok('it offers four, which is two rows of cards', out.picks.length === 4, out.picks.length);

    const offered = out.picks.map((p) => p.product_id);
    ok('nothing already in the basket is offered',
       offered.indexOf('mine:shirt') === -1, offered);
    ok('nothing from ANOTHER demo is offered, which store_name could not have prevented',
       offered.indexOf('theirs:x') === -1, offered);
    ok('and nothing withdrawn from the catalogue is offered',
       offered.indexOf('mine:gone') === -1, offered);
    ok('every offer is from this demo', offered.every((id) => id.indexOf('mine:') === 0), offered);

    /* A NAME IS CLAMPED AND A CATEGORY IS ITS LEAF, the same as the basket cards, so the
       two blocks read as one email rather than two. */
    ok('the cards carry the leaf category only',
       out.cards.every((card) => card.category === 'Shirts'),
       out.cards.map((c) => c.category));

    /* THE FALLBACK, AND IT IS THE DEFECT THAT SHOWED IN A REAL SEND. One demo's
       catalogue holds exactly ONE product in each of the four categories its basket
       covered, so the same-category pass had nothing left after excluding the basket and
       the rail rendered nothing at all. A catalogue shaped like that is not unusual.

       So a thin category pass falls back to Trending now, which is the storefront's own
       first strategy: the same seeded() function, seeded with the same slug, over that
       demo's rows. product_id is the catalogue's own id, unprefixed, so the ordering is
       the one the site shows rather than merely a similar one. */
    const otherCats = ['mine:p', 'mine:q', 'mine:r', 'mine:s'].map((id) =>
        Object.assign(product(id), {
            category_path: 'Home > Lighting',
            link: 'https://dengage-presales.github.io/demo-ai/demos/mine/product.html?id=' + id
        }));
    const oneEach = recommend(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shirt].concat(otherCats, [otherDemo])
    }), CONTACT);
    ok('one product per category falls back rather than rendering nothing',
       oneEach.picks.length === 4, oneEach.picks.length);
    ok('and it says Trending now, which is what the site calls that strategy',
       oneEach.label === 'Trending now' && oneEach.lead === 'Popular across the store',
       { label: oneEach.label, lead: oneEach.lead });
    ok('the fallback is still scoped to this demo',
       oneEach.picks.every((p) => String(p.product_id).indexOf('mine:') === 0),
       oneEach.picks.map((p) => p.product_id));

    /* THE ORDERING IS THE STOREFRONT'S, not something similar to it. recommend.js is
       lifted and run here against the same rows, and the two must agree. */
    {
        const site = readFileSync(
            join(HERE, '..', '..', '..', '..', 'template', 'js', 'recommend.js'), 'utf8');
        const body = site.match(/function seeded\(list, seed\) \{[\s\S]*?\n    \}/);
        ok('recommend.js still has a seeded() to compare against', Boolean(body));
        if (body) {
            /* eslint-disable-next-line no-new-func */
            const siteSeeded = new Function('return (' + body[0] + ')')();
            /* The same set the asset ranks in the oneEach case above: this demo's rows
               with the basket's own excluded. The seed is the slug in both. */
            const siteOrder = siteSeeded(
                otherCats.map((p) => ({ id: String(p.product_id) })), 'mine')
                .map((p) => p.id);
            ok('the asset ranks trending exactly as the storefront does',
               oneEach.picks.map((p) => String(p.product_id)).join(',') ===
               siteOrder.slice(0, 4).join(','),
               { asset: oneEach.picks.map((p) => String(p.product_id)), site: siteOrder });
        }
    }

    /* HALF A RAIL IS STILL WORSE THAN NONE, so the markup gates on more than one. */
    ok('the block gates on more than one card',
       readFileSync(join(HERE, 'recommendations.html'), 'utf8')
           .includes('{% if (cards.length > 1) { %}'));

    /* NOTHING TO SCOPE TO MEANS NOTHING TO OFFER. Without a resolved demo the fallback
       cannot tell one catalogue from another, so it does not run. */
    const noDemo = recommend(stubFrom({
        master_device: devices, shopping_cart_events: [],
        page_view_events: [], dps_product: [shirt].concat(sameRange)
    }), CONTACT);
    ok('with no demo resolved it offers nothing rather than another store\'s products',
       noDemo.picks.length === 0, noDemo.picks.length);
}

/* -------------------------------------------------------------------------- */
/* 15. THE RAIL IS REAL BEHAVIOUR FIRST, not a shuffle                           */

{
    /* SALIL'S QUESTION, 9 AUGUST 2026: with page views landing in Dengage and every
       product in dps_product, can the recommendations be real rather than computed?

       For anything anchored to the RECIPIENT, yes, and this is it. page_view_events
       carries product_id, and the SDK fills page_url and session_id itself, so the
       products a contact actually looked at are recoverable across sessions and across
       devices. That is strictly better than the storefront's own Recently viewed, which
       reads sessionStorage and forgets everything when the tab closes.

       The query is anchored on the same key set the basket uses, so it is small and
       precise rather than a scan of a table shared with live traffic. */
    const demoRoot = 'https://dengage-presales.github.io/demo-ai/demos/mine/';
    const rows = ['a', 'b', 'c', 'd'].map((id) =>
        Object.assign(product('mine:' + id), {
            category_path: 'Fashion > Shirts',
            link: demoRoot + 'product.html?id=' + id
        }));
    const inBasket = Object.assign(product('mine:cart'), {
        category_path: 'Fashion > Shirts',
        link: demoRoot + 'product.html?id=cart'
    });
    const elsewhere = Object.assign(product('theirs:z'), {
        category_path: 'Fashion > Shirts',
        link: 'https://dengage-presales.github.io/demo-ai/demos/theirs/product.html?id=z'
    });

    const cart = [event('add_to_cart', 'mine:cart', '2026-08-09T12:00:00Z', 1, DEVICE, 'session-mine')];
    const views = [
        view('session-mine', 'mine'),
        viewProduct('session-mine', 'mine', 'mine:a', '2026-08-09T11:00:00Z'),
        viewProduct('session-mine', 'mine', 'mine:b', '2026-08-09T11:30:00Z'),
        viewProduct('session-mine', 'mine', 'mine:c', '2026-08-09T10:00:00Z'),
        /* Already in the basket, so it must not be offered back. */
        viewProduct('session-mine', 'mine', 'mine:cart', '2026-08-09T11:45:00Z'),
        /* Another demo entirely, which the page_url filter has to catch. */
        viewProduct('session-other', 'theirs', 'theirs:z', '2026-08-09T11:50:00Z')
    ];

    const out = recommend(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: rows.concat([inBasket, elsewhere])
    }), CONTACT);

    ok('the rail is what the contact actually viewed',
       out.label === 'Recently viewed' && out.lead === 'Still on your mind',
       { label: out.label, lead: out.lead });
    ok('newest view first',
       out.picks.map((p) => String(p.product_id)).join(',') === 'mine:b,mine:a,mine:c',
       out.picks.map((p) => String(p.product_id)));
    ok('what is already in the basket is not offered back',
       out.picks.every((p) => String(p.product_id) !== 'mine:cart'));
    ok('a view on another demo is not offered',
       out.picks.every((p) => String(p.product_id) !== 'theirs:z'));

    /* THE PAGE URL FILTER LOOKS REDUNDANT AND IS NOT, which only shows past the cap.
       mine() already drops another demo's products by their own link, so with a handful
       of views either filter alone gets the right answer. The list of viewed ids is
       capped at twelve, though, and it is built BEFORE mine() runs. A contact who
       browsed another demo heavily would fill all twelve slots with that demo's products
       and starve the two from this one, and the rail would fall through to a shuffle
       while real behaviour was sitting in the table. */
    const busyElsewhere = [];
    for (let n = 0; n < 12; n++) {
        busyElsewhere.push(viewProduct('session-other', 'theirs', 'theirs:' + n,
            '2026-08-09T11:5' + (n % 10) + ':00Z'));
    }
    const crowded = recommend(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: [view('session-mine', 'mine')].concat(busyElsewhere, [
            viewProduct('session-mine', 'mine', 'mine:a', '2026-08-09T09:00:00Z'),
            viewProduct('session-mine', 'mine', 'mine:b', '2026-08-09T09:01:00Z')
        ]),
        dps_product: rows.concat([inBasket, elsewhere])
    }), CONTACT);
    ok('twelve views on another demo do not starve two on this one',
       crowded.label === 'Recently viewed' &&
       crowded.picks.map((p) => String(p.product_id)).join(',') === 'mine:b,mine:a',
       { label: crowded.label, picks: crowded.picks.map((p) => String(p.product_id)) });

    /* IT SPANS DEVICES, which sessionStorage cannot. Same contact, a view recorded
       under a second device linked to them. */
    const second = viewProduct('session-phone', 'mine', 'mine:d', '2026-08-09T11:59:00Z');
    second.key = 'device-second';
    const spanning = recommend(stubFrom({
        master_device: devices.concat([{ device_id: 'device-second', contact_key: 'DPS-1' }]),
        shopping_cart_events: cart,
        page_view_events: views.concat([second]),
        dps_product: rows.concat([inBasket])
    }), CONTACT);
    ok('a view from another of the contact\'s devices counts too',
       spanning.picks.map((p) => String(p.product_id))[0] === 'mine:d',
       spanning.picks.map((p) => String(p.product_id)));

    /* ONE VIEW IS NOT A RAIL, so it falls through to the category pass rather than
       showing a single card. */
    const thin = recommend(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: [view('session-mine', 'mine'),
                           viewProduct('session-mine', 'mine', 'mine:a', '2026-08-09T11:00:00Z')],
        dps_product: rows.concat([inBasket])
    }), CONTACT);
    ok('one view falls through to the category pass',
       thin.label === 'More like this', thin.label);

    /* AND WITH NO PRODUCT VIEWS AT ALL, which is a visitor who added from a listing
       page, the chain still ends somewhere that fills. */
    const none = recommend(stubFrom({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: [view('session-mine', 'mine')],
        dps_product: rows.concat([inBasket])
    }), CONTACT);
    ok('no product views still fills, from the categories the basket is in',
       none.label === 'More like this' && none.picks.length === 4,
       { label: none.label, picks: none.picks.length });
}

/* -------------------------------------------------------------------------- */
/* 16. THE ONE LINE, which is the most reused asset in the account               */

{
    /* SALIL, 9 AUGUST 2026: a preheader takes a Dynamic Content snippet, and so do push
       text, push image, SMS and on site content. That makes this the asset that gets
       reused most, because one saved object now feeds an SMS body, a push title, the
       email's subject line and its hidden preheader. Four channels read it, so what it
       emits is asserted exactly rather than by shape.

       IT EMITS ONE LINE AND NOTHING AROUND IT, and that is a real fix rather than tidying.
       The line used to be built across five template tags on five physical lines, so the
       output opened and closed with a newline. Invisible in an SMS body. Not invisible in
       the email, where the preheader follows the snippet with a comma: a collapsed newline
       puts a space in front of it. The whole line is now computed in the resolution block
       and emitted by one output tag, which the last assertion here pins. */
    const basket = (of) => text(stubFrom({
        master_device: devices,
        shopping_cart_events: of.map((id, i) =>
            event('add_to_cart', id, '2026-08-09T10:0' + i + ':00Z')),
        dps_product: catalogue(of)
    }), CONTACT);

    const four = basket(['p1', 'p2', 'p3', 'p4']);
    const two = basket(['p1', 'p2']);
    const one = basket(['p1']);

    ok('four items name the newest and count the rest',
       four.line === 'Product p4 and 3 more items', four.line);
    ok('two items say one more item, singular',
       two.line === 'Product p2 and 1 more item', two.line);
    ok('one item is the product and nothing else',
       one.line === 'Product p1', one.line);
    ok('and the count is the whole basket rather than a window',
       four.count === 4 && two.count === 2 && one.count === 1,
       [four.count, two.count, one.count]);

    /* A BASKET THAT RESOLVES TO NOTHING STILL HAS TO READ AS A SENTENCE, in all four
       channels, because a test send to yourself is exactly when it happens. */
    const empty = text(stubFrom({
        master_device: devices, shopping_cart_events: [], dps_product: []
    }), CONTACT);
    ok('an empty basket falls back to a phrase rather than nothing',
       empty.line === 'the items you saved', empty.line);

    const withdrawn = text(stubFrom({
        master_device: devices,
        shopping_cart_events: [event('add_to_cart', 'gone', '2026-08-09T10:00:00Z')],
        dps_product: [product('gone', false)]
    }), CONTACT);
    ok('a basket holding only a withdrawn product falls back too',
       withdrawn.line === 'the items you saved' && withdrawn.count === 0,
       [withdrawn.line, withdrawn.count]);

    /* THE PREHEADER PUTS A COMMA AFTER THIS, so a stray space at either end shows up in
       the inbox as "items , one press from checkout". */
    ok('every line composes with the preheader tail without a gap',
       [four.line, two.line, one.line, empty.line, withdrawn.line]
           .every((value) => value === value.trim() && value !== ''));

    /* AND IT IS CLAMPED, because a preview line is about ninety characters and a real
       product name here is ninety five. A display truncation of a real name, never an
       invented one. */
    const long = 'A product name that runs well past the width of any inbox preview line';
    const clamped = text(stubFrom({
        master_device: devices,
        shopping_cart_events: [event('add_to_cart', 'p1', '2026-08-09T10:00:00Z')],
        dps_product: [Object.assign(product('p1'), { title: long })]
    }), CONTACT);
    ok('a long product name is clamped rather than filling the whole line',
       clamped.line.length <= 48 && /\.\.\.$/.test(clamped.line), clamped.line);

    const source = readFileSync(join(HERE, 'abandoned-cart.txt'), 'utf8');
    const after = source.slice(source.indexOf('%}') + 2);
    ok('the asset emits one output tag and nothing else, not even a trailing newline',
       after === '{%= line %}', JSON.stringify(after));
}

/* -------------------------------------------------------------------------- */
/* 17. THE TWO PUSH ASSETS, where an empty value is the safe one                 */

{
    /* SALIL, 10 AUGUST 2026: every field of a web push takes a Dynamic Content snippet,
       and only the text kind. Title, Message, Media, Target URL, Badge URL and the custom
       parameters, all of them. That is more than personalized copy: the IMAGE and the
       DESTINATION of a rich push can be the visitor's own product and their own basket,
       from two assets that emit one line of plain text each.

       WHICH MAKES EMPTY THE IMPORTANT CASE HERE rather than an edge case. A push carrying
       the wrong product's photograph, or landing on another demo's storefront, is worse on
       a call than a push with no image or a push that was not sent: both of those are
       invisible and the wrong one is not. So both assets emit nothing rather than anything
       they cannot stand behind, and that is what most of this section asserts. */
    const ROOT = 'https://dengage-presales.github.io/demo-ai/demos/mine/';
    const shot = (id, src) => Object.assign(product(id), { image_link: src });
    /* THE ASSET ASKS FOR THE 2:1 BANNER, NOT THE SQUARE TILE, and derives its address from
       the photograph's own by inserting one path segment. A push image is shown in a wide
       band, so the tile arrives letterboxed with the product at about a third of the height
       it could have. factory/make-push-images.mjs writes the banner and
       factory/push-images.test.mjs holds the two namings to the same answer. */
    const banner = (file) => ROOT + 'images/push/' + file;

    const cart = [
        event('add_to_cart', 'p1', '2026-08-09T10:00:00Z', 1, DEVICE, 'session-mine'),
        event('add_to_cart', 'p2', '2026-08-09T10:01:00Z', 1, DEVICE, 'session-mine')
    ];
    const views = [view('session-mine', 'mine')];

    const both = (tables) => ({
        image: image(stubFrom(tables), CONTACT),
        url: url(stubFrom(tables), CONTACT)
    });

    const out = both({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shot('p1', ROOT + 'images/p1.jpg'), shot('p2', ROOT + 'images/p2.jpg')]
    });

    /* THE NEWEST ADDITION, because that is the product the push is about and the one the
       copy beside it names. ids is newest first, so this is the first that has a picture. */
    ok('the image is the newest basket product\'s own photograph, as a 2:1 banner',
       out.image.image === banner('p2.jpg'), out.image.image);
    ok('and the destination is that demo\'s basket',
       out.url.basketUrl === ROOT + 'index.html?open=cart', out.url.basketUrl);

    /* A PRODUCT WITH NO PICTURE MUST NOT COST THE PUSH ITS PICTURE, so it falls through to
       the next one that has one rather than emitting an empty Media URL. One demo in this
       repository has no product photography at all. */
    const partial = both({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shot('p1', ROOT + 'images/p1.jpg'), shot('p2', null)]
    });
    ok('a newest product with no picture falls through to one that has a picture',
       partial.image.image === banner('p1.jpg'), partial.image.image);

    const none = both({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shot('p1', null), shot('p2', '')]
    });
    ok('a catalogue with no pictures emits nothing, so the push sends without one',
       none.image.image === '', none.image.image);

    /* HTTP IS NOT HTTPS. A rich push image over plain http is blocked by the browser, so an
       http URL is the same as no URL and saying so here is cheaper than a silent one. */
    const insecure = both({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shot('p2', 'http://example.test/p2.jpg'), shot('p1', null)]
    });
    ok('an http image is treated as no image, because a browser blocks it anyway',
       insecure.image.image === '', insecure.image.image);

    /* NO PAGE VIEW MEANS NO DEMO, AND NO DEMO MEANS NO URL. This is the case that must not
       guess: there is no address that is correct for every demo, so an invented one lands
       the recipient on somebody else's storefront. */
    const unattributed = both({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: [],
        dps_product: [shot('p1', ROOT + 'images/p1.jpg')]
    });
    ok('with no page view to attribute the basket, the URL is empty rather than guessed',
       unattributed.url.basketUrl === '' && unattributed.url.target === '',
       unattributed.url.basketUrl);

    /* AND IT IS THIS DEMO'S BASKET, NOT THE ONE BROWSED BEFORE IT. Same defect the email
       had, and it is worse in a push: the email at least shows the products it linked to. */
    const OTHER = 'https://dengage-presales.github.io/demo-ai/demos/theirs/';
    const crossed = both({
        master_device: devices,
        shopping_cart_events: [
            event('add_to_cart', 'q1', '2026-08-09T09:00:00Z', 1, DEVICE, 'session-theirs'),
            event('add_to_cart', 'p1', '2026-08-09T10:00:00Z', 1, DEVICE, 'session-mine')
        ],
        page_view_events: [
            { session_id: 'session-theirs', page_url: OTHER + 'index.html',
              event_date: '2026-08-09T09:00:00Z' },
            { session_id: 'session-mine', page_url: ROOT + 'index.html',
              event_date: '2026-08-09T10:00:00Z' }
        ],
        dps_product: [shot('p1', ROOT + 'images/p1.jpg'),
                      shot('q1', OTHER + 'images/q1.jpg')]
    });
    ok('the push lands on the demo the newest basket row belongs to',
       crossed.url.basketUrl === ROOT + 'index.html?open=cart', crossed.url.basketUrl);
    ok('and carries that demo\'s product photograph, not the earlier demo\'s',
       crossed.image.image === banner('p1.jpg'), crossed.image.image);

    /* AND A PHOTOGRAPH THAT IS NOT WHERE A BANNER WOULD BE FALLS BACK TO ITSELF. A
       letterboxed product is a real picture and merely badly proportioned; a derived path to
       a file that was never written is a 404 in a notification. */
    const elsewhere = both({
        master_device: devices,
        shopping_cart_events: cart,
        page_view_events: views,
        dps_product: [shot('p2', ROOT + 'assets/p2.jpg'), shot('p1', null)]
    });
    ok('a photograph outside images/ falls back to itself rather than a derived 404',
       elsewhere.image.image === ROOT + 'assets/p2.jpg', elsewhere.image.image);

    /* AND BOTH EMIT ONE LINE, for the same reason the copy asset does: these go into a
       Media URL field and a Target URL field, where a leading newline is a broken URL
       rather than a cosmetic problem. */
    for (const file of ['abandoned-cart-image.txt', 'abandoned-cart-url.txt']) {
        const source = readFileSync(join(HERE, file), 'utf8');
        const after = source.slice(source.indexOf('%}') + 2);
        ok(file + ' emits one output tag and nothing else',
           /^\{%= [a-zA-Z]+ %\}$/.test(after), JSON.stringify(after));
    }
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
