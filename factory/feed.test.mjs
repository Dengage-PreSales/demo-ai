/* ============================================================================
   Offline tests for the product feed.

     node factory/feed.test.mjs

   The feed is the thing three blocked capabilities are waiting on, and it is also
   the one artefact in this repository that a system OUTSIDE it reads. A storefront
   defect is visible on the page; a feed defect is visible only as a recommendation
   that quietly makes no sense.

   What matters most here is the same omission rule as everywhere else, plus one
   distinction the feed adds: whether a product is buyable is a FACT, and how many
   are left is usually UNKNOWN. Confusing the two writes a zero, and a zero
   announces every product out of stock.
   ========================================================================== */
import { rowsFor, toCsv, toJson, COLUMNS, collect } from './build-feed.mjs';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function is(label, actual, expected) {
    ok(label, actual === expected, { actual, expected });
}

const CONFIG = { locale: { currency: 'EUR', currencySymbol: '€' }, expiresAt: '2099-01-01' };

function row(product) {
    return rowsFor('acme', CONFIG, [product])[0];
}

const BASE = {
    id: 'A-1', name: 'Quilted Jacket', category: 'Outerwear',
    price: 189, discountedPrice: 149, stockCount: 12,
    attributes: { Brand: 'Northfield' }, motif: 'jacket', image: null
};

/* -------------------------------------------------------------------------- */
console.log('\n1. The shape Dengage is given');

{
    const r = row(BASE);
    is('product_id is the same id the events send', r.product_id, 'A-1');
    is('the demo slug is carried', r.demo_slug, 'acme');
    is('name', r.name, 'Quilted Jacket');
    is('category', r.category, 'Outerwear');
    is('brand comes out of the attributes', r.brand, 'Northfield');
    is('currency comes from the demo', r.currency, 'EUR');

    /* price is what a customer PAYS, which is the discounted figure when there is
       one. js/catalog.js resolves it the same way, and the two must agree or the
       feed contradicts the storefront it describes. */
    is('price is what is paid', r.price, 149);
    is('original_price is what it was', r.original_price, 189);
    is('discount is the difference', r.discount, 40);

    is('the url is the product page on the live demo', r.url,
       'https://dengage-presales.github.io/demo-ai/demos/acme/product.html?id=A-1');
    is('the image is the shared motif tile', r.image_url,
       'https://dengage-presales.github.io/demo-ai/assets/motifs/jacket.jpg');
    ok('every declared column is present',
       COLUMNS.every((name) => Object.prototype.hasOwnProperty.call(r, name)),
       COLUMNS.filter((name) => !Object.prototype.hasOwnProperty.call(r, name)));
}

/* -------------------------------------------------------------------------- */
console.log('\n2. Stock: buyable is a fact, the level usually is not');

is('a known level is written', row({ ...BASE, stockCount: 12 }).stock_level, 12);
is('and it is in stock', row({ ...BASE, stockCount: 12 }).in_stock, 'true');

/* THE ONE THAT MATTERS. A public product feed carries availability and not
   quantity, so this is the common case, not the edge one. */
is('an UNKNOWN level is empty, not zero', row({ ...BASE, stockCount: null }).stock_level, '');
is('and unknown level still means buyable', row({ ...BASE, stockCount: null }).in_stock, 'true');

is('zero is out of stock', row({ ...BASE, stockCount: 0 }).in_stock, 'false');
is('and zero is written as a level, because it is known',
   row({ ...BASE, stockCount: 0 }).stock_level, 0);

/* -------------------------------------------------------------------------- */
console.log('\n3. Prices and omissions');

{
    const r = row({ ...BASE, discountedPrice: null });
    is('no discount means price equals original', r.price, r.original_price);
    is('and the discount is zero', r.discount, 0);
}
is('a product with no price at all is not in the feed',
   rowsFor('acme', CONFIG, [{ ...BASE, price: null, discountedPrice: null }]).length, 0);
is('a product with no id is not in the feed',
   rowsFor('acme', CONFIG, [{ ...BASE, id: '' }]).length, 0);
is('a missing brand is empty rather than absent', row({ ...BASE, attributes: {} }).brand, '');
is('a product with no motif carries no image rather than a wrong one',
   row({ ...BASE, motif: null }).image_url, '');
is('a product never annotated carries no image',
   row({ id: 'B-1', name: 'x', price: 10 }).image_url, '');

/* -------------------------------------------------------------------------- */
console.log('\n4. The CSV is a real CSV');

{
    const rows = rowsFor('acme', CONFIG, [
        { ...BASE, id: 'C-1', name: 'Jacket, quilted' },
        { ...BASE, id: 'C-2', name: 'Say "hello"' },
        { ...BASE, id: 'C-3', name: 'Plain' }
    ]);
    const csv = toCsv(rows);
    const lines = csv.trim().split('\n');
    is('a header plus one line per product', lines.length, 4);
    is('the header is the column list', lines[0], COLUMNS.join(','));
    ok('a name containing a comma is quoted', lines[1].includes('"Jacket, quilted"'), lines[1]);
    ok('a quote inside a name is doubled', lines[2].includes('"Say ""hello"""'), lines[2]);
    ok('a plain name is not quoted', /,Plain,/.test(lines[3]), lines[3]);
    ok('the file ends with a newline', csv.endsWith('\n'));

    /* Parsed back with a real reader, because a CSV that only this file can read
       is not a CSV. */
    const parsed = lines.slice(1).map((line) => {
        const cells = [];
        let cell = '';
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (quoted) {
                if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
                else cell += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === ',') { cells.push(cell); cell = ''; }
            else cell += ch;
        }
        cells.push(cell);
        return cells;
    });
    ok('every row has exactly as many cells as there are columns',
       parsed.every((cells) => cells.length === COLUMNS.length),
       parsed.map((cells) => cells.length));
    is('and the comma survived the round trip', parsed[0][COLUMNS.indexOf('name')],
       'Jacket, quilted');
    is('as did the quotes', parsed[1][COLUMNS.indexOf('name')], 'Say "hello"');
}

/* -------------------------------------------------------------------------- */
console.log('\n5. Expiry keeps the catalogue honest');

/* A demo past its expiry is still on disk until somebody removes the folder, and
   handoff 10 keeps that deletion parked. A recommendation pointing at a demo that
   has been taken down is a broken link on a live call, so the feed filters on the
   date rather than assuming the folder is gone. */
{
    const live = collect('2026-08-06');
    ok('the real tree produces rows', live.rows.length > 0, live.demos);
    ok('every row names a demo that is in the tree',
       live.rows.every((r) => live.demos.some((d) => d.slug === r.demo_slug)));
    ok('every product_id is unique within its demo', (() => {
        const seen = new Set();
        return live.rows.every((r) => {
            const key = r.demo_slug + '/' + r.product_id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })());

    /* Far future: everything is live. Far past: nothing is. */
    const future = collect('2099-12-31');
    is('nothing survives a date past every expiry', future.rows.length, 0);
    ok('and the demos are reported as skipped rather than silently dropped',
       future.skipped.length > 0, future.skipped);
}

/* -------------------------------------------------------------------------- */
console.log('\n6. The JSON form');

{
    const rows = rowsFor('acme', CONFIG, [BASE]);
    const parsed = JSON.parse(toJson(rows, '2026-08-06'));
    is('it records when it was built', parsed.generatedAt, '2026-08-06');
    is('it counts the products', parsed.productCount, 1);
    is('it lists the demos it covers', parsed.demos.join(','), 'acme');
    is('it declares its own columns', parsed.columns.join(','), COLUMNS.join(','));
    is('and carries the rows', parsed.products.length, 1);
    is('with the same values as the csv', parsed.products[0].product_id, 'A-1');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
