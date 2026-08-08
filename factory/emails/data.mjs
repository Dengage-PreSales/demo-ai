/* ============================================================================
   The star schema queries each journey needs, and the two ways to render them.

   THE PROBLEM THIS SOLVES. An email that is genuinely personalised has to read
   the contact's own rows at send time: the items they left in a basket, the
   category they were looking at, the thing they saved when it was more expensive.
   That is a query, and Dengage runs it inside the content through
   $from("table"). But a file full of $from loops renders as nothing in a browser,
   and a presales colleague needs to show these messages on a call without an
   inbox, a send or a test list.

   So every journey is written ONCE and rendered TWICE, from the same markup:

     panel    the file that goes into the Code Editor. Real {%= =%} tags and real
              $from queries. Nothing about the recipient is hardcoded.
     preview  the same layout with those queries already resolved against this
              demo's own committed catalogue, so it opens in a browser and looks
              exactly like what the panel version will send.

   The trick that keeps them honest is below: a field is either a literal string
   or the Dengage tag that produces it, and layout.mjs cannot tell the difference.
   One markup path, two sources, so the preview cannot drift from what sends.

   THE COLUMN NAMES ARE THE ONE THING TO CHECK PER ACCOUNT. The six standard
   ecommerce tables are standard, but a column can be named slightly differently
   between accounts, and no scrape can discover that. Each query below states the
   columns it reads in one place, so correcting an account takes one edit rather
   than ten. COLUMNS is that place.
   ========================================================================== */

/* Every column this module reads, named once. If an account spells one of these
   differently, change it here and every journey follows. */
export const COLUMNS = {
    cart: {
        table: 'shopping_cart_events',
        product: 'product_id', name: 'product_name', price: 'unit_price',
        image: 'product_image', category: 'category', time: 'event_time'
    },
    view: {
        table: 'page_view_events',
        url: 'page_url', title: 'page_title', category: 'category',
        product: 'product_id', time: 'event_time'
    },
    wishlist: {
        table: 'wishlist_events',
        product: 'product_id', name: 'product_name', price: 'unit_price',
        image: 'product_image', category: 'category', time: 'event_time'
    },
    search: {
        table: 'search_events',
        query: 'search_query', results: 'result_count', time: 'event_time'
    },
    orderLine: {
        table: 'order_events_detail',
        product: 'product_id', name: 'product_name', price: 'unit_price',
        image: 'product_image', category: 'category', quantity: 'quantity'
    }
};

/* A Dengage query, as the expression that goes inside a {% %} block. Newest
   first and a small take, because an email shows a few things rather than a
   history, and a large take costs send time for rows nobody sees. */
function query(spec, take) {
    return '$from("' + spec.table + '")' +
        '.where("contact_key", "=", $Contact.contact_key)' +
        '.orderByDescending("' + spec.time + '")' +
        '.take(' + take + ').get()';
}

export const QUERIES = {
    abandonedCart: { spec: COLUMNS.cart, take: 3, expr: query(COLUMNS.cart, 3),
                     what: 'the items left in the basket' },
    savedItems: { spec: COLUMNS.wishlist, take: 3, expr: query(COLUMNS.wishlist, 3),
                  what: 'the items saved for later' },
    viewedProducts: { spec: COLUMNS.view, take: 3, expr: query(COLUMNS.view, 3),
                      what: 'the products viewed recently' },
    lastOrderLines: { spec: COLUMNS.orderLine, take: 3,
                      expr: '$from("' + COLUMNS.orderLine.table + '")' +
                            '.where("contact_key", "=", $Contact.contact_key).take(3).get()',
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
    return mode === 'panel' ? '{%= ' + tag + ' =%}' : literal;
}

/* The store's own money format, applied to a Dengage value in panel mode. The
   currency symbol is a constant for the demo, so only the number comes from the
   row and the two versions format identically. */
function priced(mode, symbol, tag, literal) {
    return mode === 'panel' ? symbol + ' {%= ' + tag + ' =%}' : literal;
}

/* ONE PRODUCT, FROM EITHER SOURCE. `index` is the loop variable name in panel
   mode, so the same builder serves a loop body and a preview row. */
export function itemFields(mode, options) {
    const { spec, cursor, sample, symbol, base } = options;
    if (mode !== 'panel') {
        return sample;
    }
    const at = (column) => cursor + '.' + column;
    return {
        name: field(mode, at(spec.name || spec.title), ''),
        meta: field(mode, at(spec.category), ''),
        price: priced(mode, symbol, at(spec.price), ''),
        /* The image column holds whatever the store sent. Where an account stores
           a path rather than a full address, prefixing it with the demo base is
           what makes it resolve in an inbox. */
        image: base + '{%= ' + at(spec.image) + ' =%}',
        href: base + 'product.html?id={%= ' + at(spec.product) + ' =%}'
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
        `{% if (one.length && one[0].${column}) { %}{%= one[0].${column} =%}` +
        `{% } else { %}${fallback}{% } %}`;
}

/* The contact's own columns. First name is the one worth guarding, because
   "Hi ," on a real send is the most visible personalisation failure there is. */
export function firstName(mode, sample) {
    if (mode !== 'panel') return sample || 'there';
    return '{% if ($Contact.first_name) { %}{%= $Contact.first_name =%}' +
           '{% } else { %}there{% } %}';
}
