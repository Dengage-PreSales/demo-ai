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

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
