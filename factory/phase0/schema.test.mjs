/* ============================================================================
   Every column name the factory uses must exist on the table it is used against.

     node factory/phase0/schema.test.mjs

   WHY THIS TEST EXISTS, and it is the most expensive lesson in the email work. A
   Dengage query that names a column which does not exist does not fail. It resolves
   to nothing, the send returns 200, and the message goes out with an empty row where
   the product should have been. Nothing in a diff, a preview, a browser or a test
   suite could see it: the generated file looked perfect, and it was reading
   event_time, search_query and product_name off tables that have none of them.

   So the schema is written down in SCHEMA.md, read off the live account, and this
   test compares the code against it. It needs no credentials and no network, which
   is the point: the check has to run in CI on every change, and the account is
   behind an IP allowlist that a runner cannot reach.

   THE RECORD CAN GO STALE, and this test cannot tell. It compares the code against
   what was true on the date in SCHEMA.md, not against the account. Re-read the
   account with tables.mjs --verify when anything about the tables changes, and
   update SCHEMA.md in the same change.
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLUMNS } from '../emails/data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

/* SCHEMA.md is the source, parsed rather than duplicated. A second copy of the
   column lists in here would be one more thing to keep in step, and the whole
   failure being guarded against is two descriptions of one table disagreeing. */
function readSchema() {
    const text = readFileSync(join(ROOT, 'factory', 'phase0', 'SCHEMA.md'), 'utf8');
    const tables = {};
    /* Each table is a bold name followed by a fenced block of whitespace separated
       column names. */
    const block = /\*\*([a-z_]+)\*\*,\s*\d+\s*columns\s*\n\s*```\n([\s\S]*?)```/g;
    let found;
    while ((found = block.exec(text)) !== null) {
        tables[found[1]] = found[2].split(/\s+/).filter(Boolean);
    }
    return tables;
}

const schema = readSchema();

/* Seven: the six standard tables plus dps_product, which is ours rather than the
   platform's and is loaded by the ETL from Postgres. */
ok('SCHEMA.md records the six standard tables and the product dimension',
   Object.keys(schema).length === 7, Object.keys(schema));
ok('and dps_product is one of them', Boolean(schema.dps_product));

for (const [table, columns] of Object.entries(schema)) {
    ok(table + ' records its columns', columns.length >= 6,
       { table, count: columns.length });
}

/* -------------------------------------------------------------------------- */
/* The check itself                                                            */

for (const [key, spec] of Object.entries(COLUMNS)) {
    const columns = schema[spec.table];
    ok('COLUMNS.' + key + ' names a table that exists', Array.isArray(columns),
       spec.table);
    if (!Array.isArray(columns)) continue;

    for (const [field, column] of Object.entries(spec)) {
        if (field === 'table') continue;
        ok('COLUMNS.' + key + '.' + field + ' -> ' + spec.table + '.' + column,
           columns.includes(column),
           { column, available: columns });
    }
}

/* THE ABSENCES, ASSERTED RATHER THAN REMEMBERED. These four were in the code and
   are the reason this file exists. If a future change reintroduces one, it fails
   here rather than in a send nobody is watching. */
const banned = [
    ['event_time', 'the column is event_date on every table'],
    ['product_name', 'no EVENT table carries a product name. dps_product.title does'],
    ['product_image', 'no EVENT table carries an image. dps_product.image_link does'],
    ['search_query', 'the column is keywords']
];
for (const [column, why] of banned) {
    const used = Object.entries(COLUMNS)
        .filter(([, spec]) => Object.values(spec).includes(column))
        .map(([key]) => key);
    ok('nothing reads ' + column + ', because ' + why, used.length === 0, used);
}

/* The absence is still real on the EVENT tables, which is what made the dimension
   necessary. Checked against the six only, because dps_product is where a title and
   an image legitimately live now. */
const eventTables = Object.entries(schema)
    .filter(([name]) => name !== 'dps_product')
    .flatMap(([, columns]) => columns);
for (const shape of ['product_name', 'product_image', 'title', 'image_link']) {
    ok('no event table has a ' + shape + ' column', !eventTables.includes(shape),
       eventTables.filter((c) => c === shape));
}

/* And the join exists in both directions, which is the whole architecture in two
   assertions: the dimension is keyed on product_id, and the event tables that need it
   carry the same column. */
ok('dps_product is keyed on product_id', schema.dps_product.includes('product_id'));
for (const table of ['shopping_cart_events', 'page_view_events', 'wishlist_events',
                     'order_events_detail']) {
    ok(table + ' can join to it on product_id', schema[table].includes('product_id'));
}
/* And the two that cannot, so a future change does not quietly assume they can. */
for (const table of ['order_events', 'search_events']) {
    ok(table + ' carries no product_id, by design', !schema[table].includes('product_id'));
}

/* -------------------------------------------------------------------------- */
/* The two pieces of Dengage syntax that were wrong for a day                    */

{
    /* AN OUTPUT TAG CLOSES WITH %} AND NOT WITH =%}. Every tag the factory emitted
       was written {%= value =%}, and that trailing equals makes the engine parse
       "value =" as an incomplete assignment. The Test button returns
       "SyntaxError: Unexpected token '%s' after '%s'" and nothing renders. 58 of them
       across 14 files, and no test could see it because nothing here executed a
       Dengage template.

       This is a text check rather than a behavioural one, and that is the point: the
       engine is not available to test against, so the shape of what gets emitted is
       the only thing that can be asserted. */
    const { readdirSync, statSync } = await import('node:fs');
    const roots = ['factory/emails', 'factory/messages', 'factory/panel/content/_dynamic'];
    const files = [];
    const walk = (dir) => {
        for (const entry of readdirSync(join(ROOT, dir))) {
            const rel = dir + '/' + entry;
            if (statSync(join(ROOT, rel)).isDirectory()) { walk(rel); continue; }
            if (/\.(mjs|html|json|txt)$/.test(entry)) files.push(rel);
        }
    };
    for (const root of roots) walk(root);

    const offenders = files.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes('=%}'));
    ok('nothing emits an output tag closing with =%}, which is a syntax error',
       offenders.length === 0, offenders);

    /* $from OFFERS where, take AND get. Nothing else. orderByDescending was chained
       onto every query in this repository and does not exist: the engine answers
       "TypeError: Object doesn't support property or method 'orderByDescending'".
       Ordering happens in JavaScript on the array get() returns.

       Prose is excluded by looking only for the method call, so the paragraphs
       explaining the mistake do not trip the check on the mistake. */
    const chained = files.filter((f) =>
        /\.orderByDescending\s*\(/.test(readFileSync(join(ROOT, f), 'utf8')));
    ok('nothing chains orderByDescending, which $from does not have',
       chained.length === 0, chained);

    /* THE CONTACT KEY COLUMN ON AN EVENT TABLE IS key, NOT contact_key. Read from the
       API: all six have `key TEXT` first and no contact_key at all. Querying the wrong
       one answers "42703: column contact_key does not exist", which also tells us $from
       compiles to SQL, since 42703 is a Postgres error code.

       $Contact.contact_key stays correct on the contact side, so this looks only for a
       where clause naming the column. */
    /* NARROWED, because contact_key is not wrong everywhere. It is the correct column
       on master_device and master_contact, and it is how a message reaches the devices
       linked to a contact. It is only wrong on the six EVENT tables, whose column is
       key. So the check looks for an event table followed by that filter rather than
       for the column name on its own, which flagged the legitimate device join. */
    const eventTableNames = ['page_view_events', 'shopping_cart_events', 'order_events',
                             'order_events_detail', 'wishlist_events', 'search_events'];
    const wrongKey = files.filter((f) => {
        const text = readFileSync(join(ROOT, f), 'utf8');
        return eventTableNames.some((t) =>
            new RegExp(t + "['\"]\\s*\\)\\s*\\n?\\s*\\.where\\s*\\(\\s*['\"]contact_key").test(text));
    });
    ok('no event table is filtered on contact_key, whose column is key',
       wrongKey.length === 0, wrongKey);

    /* And the other half of the same rule: reaching a contact's devices is how an
       abandoned cart works without a login, so master_device IS filtered on
       contact_key. Asserted so a future tightening of the check above cannot quietly
       break it. */
    const cartAsset = readFileSync(
        join(ROOT, 'factory/panel/content/_dynamic/abandoned-cart.html'), 'utf8');
    ok('the cart asset reaches the contact\'s devices, so no login is required',
       /master_device['"]\s*\)\s*\n?\s*\.where\s*\(\s*['"]contact_key/.test(cartAsset));
    ok('and it filters cart rows on key, not contact_key',
       /shopping_cart_events['"]\s*\)\.where\s*\(\s*['"]key['"]/.test(cartAsset));

    /* A TABLE IS ADDRESSED AS $db.<table>. Taken from a snippet known to work in a live
       account: $from('$db.product'). A bare table name was what this repository used. */
    const { QUERIES, productLookup } = await import('../emails/data.mjs');
    const emitted = Object.values(QUERIES).map((q) => q.expr)
        .concat([productLookup('rows[i]', 'p')]);
    const unprefixed = emitted.filter((e) => /\$from\(\s*['"](?!\$db\.)/.test(e));
    ok('every $from addresses its table as $db.<table>', unprefixed.length === 0, unprefixed);
    ok('and the queries are still scoped to the contact',
       Object.values(QUERIES).every((q) => q.expr.includes('$Contact.contact_key')));
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
