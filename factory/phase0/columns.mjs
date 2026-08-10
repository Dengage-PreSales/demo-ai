/* ============================================================================
   The six standard ecommerce tables, their columns, and the queries over them.

     import { COLUMNS, QUERIES, productLookup } from './columns.mjs';

   ONE PLACE THE COLUMN NAMES ARE DECLARED, which is the whole point of the file.
   Every column here was read off a real table rather than a document: the contact key
   on an event table is `key` and not `contact_key`, and a query naming a column that
   does not exist fails at send time with `42703` where nobody is watching.
   factory/phase0/SCHEMA.md is the prose beside it and lists what each table holds.

   IT MOVED HERE ON 10 AUGUST 2026, from factory/emails/data.mjs. It was written for the
   ten Code Editor journey emails, and those are gone: they read product names from event
   tables that never had any, so they produced nothing and refused rather than sending an
   email with an empty row in it. The declarations outlived them, because
   factory/phase0/schema.test.mjs checks them against the real schema and
   factory/messages/copy.mjs builds the short form channel copy from them.

   WHAT TO USE FOR A NEW SCENARIO. Not these queries. A Dengage Dynamic Content asset is
   the mechanism that works end to end, and it reads dps_product rather than an event
   table for anything a recipient has to see the name of. The six steps are in
   factory/panel/content/_dynamic/README.md, under "Writing the next scenario".
   ========================================================================== */

/* Every column this module reads, named once, and every one of these was READ OFF
   THE LIVE ACCOUNT rather than assumed. factory/phase0/SCHEMA.md holds the full
   column list per table with the date it was read, and schema.test.mjs pins this
   object against it, so a name that does not exist cannot reach a generated file.

   IT USED TO BE ASSUMED, AND IT WAS WRONG IN SIX PLACES. Worth listing, because
   every one of them was invisible: a Dengage query naming a column that does not
   exist resolves to nothing, the send still returns 200, and the message goes out
   with an empty row where the product should be.

     event_time      the column is event_date, on all six tables. So every
                     orderByDescending in this file referenced nothing
     search_query    the column is keywords
     unit_price      wishlist_events spells it price, unlike cart and order lines
     category        page_view_events has category_id and category_path, and no
                     other table has anything category shaped at all

   NO TABLE CARRIES A PRODUCT NAME OR A PRODUCT IMAGE. That is not a naming error
   to correct, it is an absence: every table identifies a product by product_id and
   stops there. Resolving an id into a name, a price and a picture is what the
   product feed is for, and what Product Box does with it. So a name field and an
   image field are deliberately absent below rather than guessed at, and until the
   feed is registered against this application there is nothing a query can render.
   factory/panel/REFERENCE.md, and SCHEMA.md for the reasoning. */
export const COLUMNS = {
    cart: {
        table: 'shopping_cart_events',
        contactKey: 'key',
        product: 'product_id', variant: 'product_variant_id',
        price: 'unit_price', discounted: 'discounted_price',
        quantity: 'quantity', time: 'event_date'
    },
    view: {
        table: 'page_view_events',
        contactKey: 'key',
        url: 'page_url', title: 'page_title',
        categoryPath: 'category_path', categoryId: 'category_id',
        product: 'product_id', price: 'price', time: 'event_date'
    },
    wishlist: {
        table: 'wishlist_events',
        contactKey: 'key',
        product: 'product_id', variant: 'product_variant_id',
        /* price, not unit_price. The one table that differs. */
        price: 'price', discounted: 'discounted_price',
        list: 'list_name', time: 'event_date'
    },
    search: {
        table: 'search_events',
        contactKey: 'key',
        query: 'keywords', results: 'result_count',
        filters: 'filters', time: 'event_date'
    },
    orderLine: {
        table: 'order_events_detail',
        contactKey: 'key',
        order: 'order_id', product: 'product_id', variant: 'product_variant_id',
        price: 'unit_price', discounted: 'discounted_price',
        quantity: 'quantity', time: 'event_date'
    },

    /* THE PRODUCT DIMENSION, and the reason anything above can show a product at all.
       The five specs above are facts: they record that something happened to a
       product_id. This is the one that says what that id IS.

       It is not one of the six standard tables. It is loaded by Dengage's ETL from
       Postgres (factory/panel/supabase/), so unlike the six, its columns are ours and
       can be relied on rather than discovered. Settled 9 August 2026 in preference to
       a remote table, because remote tables are documented for Interactive Segments
       and never mentioned for personalisation, and a live passthrough would have meant
       one external query per recipient at send time.

       link and image_link are absolute in the row itself. That is what lets one shared
       piece of dynamic content serve every demo: nothing in a send says which demo
       triggered it, so the demo's addresses have to arrive with the data. */
    product: {
        table: 'dps_product',
        id: 'product_id', name: 'title', image: 'image_link',
        thumb: 'small_image_link', price: 'price', discounted: 'discounted_price',
        link: 'link', category: 'category_path', brand: 'brand',
        availability: 'availability', stock: 'stock_count', active: 'is_active'
    }
};

/* THE LOOKUP THAT TURNS AN ID INTO A PRODUCT. Emitted inside a loop over an event
   table, so each row's product_id becomes a row of dps_product.

   is_active is checked rather than trusted. A product withdrawn from the catalogue
   still has cart rows from before it went, and a basket reminder for something that
   cannot be bought is worse than one item short. `continue` skips it, so the message
   shows what remains instead of an empty slot. */
export function productLookup(cursor, variable) {
    const p = COLUMNS.product;
    return '{% var ' + variable + " = $from('$db." + p.table + "')" +
        ".where('" + p.id + "', '=', " + cursor + '.' + COLUMNS.cart.product + ')' +
        '.take(1).get()[0]; %}' +
        '{% if (!' + variable + ' || !' + variable + '.' + p.active + ') { continue; } %}';
}

/* A Dengage query, as the expression that goes inside a {% %} block. Newest
   first and a small take, because an email shows a few things rather than a
   history, and a large take costs send time for rows nobody sees. */
function query(spec, take) {
    /* ONLY where, take AND get. Those three are the whole proven surface of $from,
       taken from a snippet running in a live account. orderByDescending was used here
       and does not exist: the engine answers
       "TypeError: Object doesn't support property or method 'orderByDescending'".

       So the ordering happens in JavaScript on the array get() returns, which is
       ordinary Array.prototype and cannot be refused. The window is deliberately wider
       than the number of rows wanted, because without server side ordering take(n)
       returns SOME n rows rather than the newest n, so the sort needs something to
       choose from. A contact with more cart events than the window may still miss the
       very newest, and that is a real limit rather than a solved problem. */
    return "$from('$db." + spec.table + "')" +
        ".where('" + spec.contactKey + "', '=', $Contact.contact_key)" +
        '.take(' + (take * 10) + ').get()' +
        ".sort(function (a, b) { return new Date(b['" + spec.time +
        "']) - new Date(a['" + spec.time + "']); })" +
        '.slice(0, ' + take + ')';
}

export const QUERIES = {
    abandonedCart: { spec: COLUMNS.cart, take: 3, expr: query(COLUMNS.cart, 3),
                     what: 'the items left in the basket' },
    savedItems: { spec: COLUMNS.wishlist, take: 3, expr: query(COLUMNS.wishlist, 3),
                  what: 'the items saved for later' },
    viewedProducts: { spec: COLUMNS.view, take: 3, expr: query(COLUMNS.view, 3),
                      what: 'the products viewed recently' },
    /* Hand written rather than from query(), because order lines have no event_date
       ordering that means anything: the lines of one order all share it. That is also
       how it escaped the $db. prefix when query() gained one. */
    lastOrderLines: { spec: COLUMNS.orderLine, take: 3,
                      expr: "$from('$db." + COLUMNS.orderLine.table + "')" +
                            ".where('" + COLUMNS.orderLine.contactKey + "', '=', $Contact.contact_key).take(3).get()",
                      /* No sort: the lines of one order share their event_date, so
                         ordering them says nothing. */
                      what: 'the lines on the last order' },
    lastSearch: { spec: COLUMNS.search, take: 1, expr: query(COLUMNS.search, 1),
                  what: 'the last thing searched for' }
};

/* -------------------------------------------------------------------------- */

/* A field, in whichever mode is being rendered. In panel mode it is the Dengage
   output tag that produces the value; in preview mode it is the value itself.
   layout.mjs receives a plain object either way and stays unaware of the
   difference, which is what stops the two versions diverging. */
function field(mode, tag, literal) {
    return mode === 'panel' ? '{%= ' + tag + ' %}' : literal;
}

/* A COLUMN THAT DOES NOT EXIST MUST STOP THE BUILD, NOT REACH A FILE. Before this
   existed, asking for a column the table does not have produced the string
   "row.undefined" inside a live tag: valid template syntax, resolving to nothing,
   in a message that looked complete. Four of them per email, in ten emails, and
   every test still passed.

   Throwing is the right severity. A build that cannot fill a field has nothing
   useful to write, and the generator already reports a failed email set as a skip
   with the command to rerun, so a demo build survives it. Silence does not survive
   it: an empty product row is only discovered by a recipient. */
function column(spec, key) {
    const name = spec[key];
    if (!name) {
        throw new Error(
            'no column for "' + key + '" on ' + spec.table + '. ' +
            'factory/phase0/SCHEMA.md lists what the table actually has. ' +
            'Product names and images are not in any table: Product Box resolves ' +
            'them from the product feed, see factory/panel/REFERENCE.md');
    }
    return name;
}

/* The store's own money format, applied to a Dengage value in panel mode. The
   currency symbol is a constant for the demo, so only the number comes from the
   row and the two versions format identically. */
function priced(mode, symbol, tag, literal) {
    return mode === 'panel' ? symbol + ' {%= ' + tag + ' %}' : literal;
}

/* ONE PRODUCT, FROM EITHER SOURCE. `index` is the loop variable name in panel
   mode, so the same builder serves a loop body and a preview row. */
export function itemFields(mode, options) {
    const { spec, cursor, sample, symbol, base } = options;
    if (mode !== 'panel') {
        return sample;
    }
    const at = (key) => cursor + '.' + column(spec, key);
    /* name, meta and image are asked for through column() on purpose. No table has
       them, so this throws, and that is the intended behaviour rather than an
       oversight: it is what stops a product row being written that cannot be filled.
       When the product feed is registered these rows come from a Product Box, not
       from here, so this function will render the id and the price and leave the
       presentation to the block. */
    return {
        name: field(mode, at('name'), ''),
        meta: field(mode, at('category'), ''),
        price: priced(mode, symbol, at('price'), ''),
        image: base + '{%= ' + at('image') + ' %}',
        href: base + 'product.html?id={%= ' + at('product') + ' %}'
    };
}

/* THE LOOP. In panel mode this emits the query, the for statement and the closing
   brace around whatever `render` produces. In preview mode it simply renders the
   samples. `render` is the same function in both cases. */
export function repeat(mode, options) {
    const { query: q, samples, symbol, base, render, join } = options;
    const glue = join === undefined ? '' : join;

    if (mode !== 'panel') {
        return samples.map((sample) => render(sample)).join(glue);
    }

    const cursor = 'row';
    const item = itemFields('panel', { spec: q.spec, cursor, symbol, base });
    return `
                    {% var rows = ${q.expr}; %}
                    {% for (var i = 0; i < rows.length; i++) { var ${cursor} = rows[i]; %}` +
        render(item) + `
                    {% if (i < rows.length - 1) { %}${glue}{% } %}
                    {% } %}`;
}

/* A SCALAR READ FROM A TABLE, for a headline rather than a list: the category
   someone was browsing, the words they searched for. Falls back to a phrase that
   still reads when the contact has no such row, because an empty headline is
   worse than a general one. */
export function scalar(mode, options) {
    const { query: q, column, fallback, sample } = options;
    if (mode !== 'panel') return sample || fallback;
    return `{% var one = ${q.expr}; %}` +
        `{% if (one.length && one[0].${column}) { %}{%= one[0].${column} %}` +
        `{% } else { %}${fallback}{% } %}`;
}

/* The contact's own columns. First name is the one worth guarding, because
   "Hi ," on a real send is the most visible personalisation failure there is. */
export function firstName(mode, sample) {
    if (mode !== 'panel') return sample || 'there';
    return '{% if ($Contact.first_name) { %}{%= $Contact.first_name %}' +
           '{% } else { %}there{% } %}';
}
