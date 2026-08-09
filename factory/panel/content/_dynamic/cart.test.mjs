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
    return function (name) {
        const table = String(name).replace('$db.', '');
        if (!Object.prototype.hasOwnProperty.call(tables, table)) {
            throw new Error('the asset queried a table the test does not model: ' + table);
        }
        let rows = tables[table].slice().reverse();
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
    '{ ids: ids, all: all }');
const total = resolver('abandoned-cart-total.html',
    '{ subtotal: subtotal, discount: discount, counted: counted, priced: priced }');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */

const CONTACT = { contact_key: 'DPS-1' };
const DEVICE = 'device-aaa';

const devices = [
    { device_id: DEVICE, contact_key: 'DPS-1' },
    { device_id: 'device-somebody-else', contact_key: 'DPS-9' }
];

let nextId = 100;
function event(type, productId, date, quantity, key) {
    return {
        id: nextId++,
        key: key || DEVICE,
        event_date: date,
        event_type: type,
        product_id: productId,
        quantity: quantity === undefined ? 1 : quantity
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
       only thing assertable offline is its shape. These two are worth the assertion
       because both were wrong and neither showed up in a test.

       The image cell has to be inside the condition, not just the image. An empty 112px
       cell beside every row is what a catalogue with no pictures looked like, and one of
       the demos in this repository has none. */
    const source = readFileSync(join(HERE, 'abandoned-cart.html'), 'utf8');
    const imageCell = source.indexOf('<td width="112"');
    const condition = source.indexOf('{% if (image !== "") { %}');
    ok('the image cell is inside the has-an-image condition',
       condition !== -1 && condition < imageCell, { condition, imageCell });

    /* And the image must not be given a fixed height. The catalogue's images are 1.00,
       1.26 and 1.50 aspect, so a forced square squashed the wide ones. */
    ok('the image has no forced height, so a wide photograph is not squashed',
       /width:96px;height:auto/.test(source) && !/height="96"/.test(source));
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
