#!/usr/bin/env node
/**
 * Creates the two Data Space tables every demo writes to. Handoff section 2.3.
 *
 *   sandbox_onsite_events   one row per widget fired from the launcher
 *   sandbox_events          one row per storefront interaction
 *
 * These two are the whole of what a demo may write. Everything the reference
 * build sent to the standard ecommerce tables comes here instead, which is
 * what keeps a generated demo from putting fake-brand rows into tables shared
 * with the five core demo sites and the two mobile apps. Handoff 1.3, 14.4.
 *
 * Usage:
 *
 *   node factory/phase0/create-tables.mjs --dry-run
 *   DENGAGE_API_TOKEN=... node factory/phase0/create-tables.mjs
 *
 * Safe to run twice. The API answers a repeat call with HTTP 400 and code 1,
 * "Table with given name already exists!", which this treats as success rather
 * than as an error, so re-running after a partial failure finishes the job.
 *
 * --dry-run prints exactly what would be sent and sends nothing, so the shape
 * is reviewable before anyone holds a token.
 *
 * Environment:
 *
 *   DENGAGE_API_TOKEN   required unless --dry-run. A REST API bearer token
 *                       with the dataSpace.manage permission. Without that
 *                       permission the API answers 403 with code 10 and names
 *                       the permission it wanted.
 *   DENGAGE_API_BASE    optional. Defaults to https://api.dengage.com. Set it
 *                       if account 28 is served from a regional endpoint.
 *
 * Creating a table is not proof that anything writes to it. Handoff 12.5: an
 * HTTP 200 from the event endpoint means accepted, not stored, and the row in
 * Data Space is the only proof an event landed. That is what the probe page
 * and step 5 of the Phase 0 checklist are for.
 */

const API_BASE = process.env.DENGAGE_API_BASE || 'https://api.dengage.com';
const TABLES_ENDPOINT = `${API_BASE}/rest/dataspace/tables`;

/* Published limit is 30 requests per second per IP. Two requests is nowhere
   near it, so the pause below is only there to keep a retry from stacking. */
const RETRY_PAUSE_MS = 1200;
const MAX_ATTEMPTS = 4;

/* --------------------------------------------------------------------------
   The tables.

   contact_key is TEXT and is named as the contactKeyColumn on both. The API
   requires that column to be text, and without it the rows cannot be joined to
   a contact, which is most of what a demo is demonstrating.

   Left nullable on purpose: an anonymous visitor has no contact key, and
   handoff 6.2 is explicit that staying anonymous is correct behaviour rather
   than a bug to fix. Rows from anonymous sessions still carry demo_slug and
   are still purged by it.

   key, event_date, session_id, event_type and event_id are filled by the SDK
   or by the platform, never by the site, so they are not declared here.

   demo_slug is on both tables and is what separates one demo's rows from
   another's. The 90 day purge filters on it, so it is the difference between a
   purge being one filter and being an archaeology exercise. Handoff 1.7, 10.
   -------------------------------------------------------------------------- */
const TABLES = [
    {
        name: 'sandbox_onsite_events',
        columns: [
            { name: 'contact_key',    type: 'TEXT' },
            { name: 'demo_slug',      type: 'TEXT' },
            { name: 'event_name',     type: 'TEXT' },
            { name: 'scenario_group', type: 'TEXT' },
            { name: 'widget_name',    type: 'TEXT' },
            { name: 'page_type',      type: 'TEXT' },
            { name: 'page_url',       type: 'TEXT' }
        ],
        contactKeyColumn: 'contact_key',
        description: 'Demo Factory: scenario launcher clicks, all demos'
    },
    {
        /* One table for every storefront interaction, deliberately wide and
           mostly empty on any given row. That is what replaces shopping_cart_events,
           order_events, order_events_detail, wishlist_events and search_events,
           and it is what keeps the purge to a single filter.

           unit_price and total_value are omitted from a row, never sent as
           zero, when the scrape did not produce a real price. Number(null) is
           0 in JavaScript and that exact trap has shipped the same bug twice
           on the core repository. Handoff 1.8. */
        name: 'sandbox_events',
        columns: [
            { name: 'contact_key',   type: 'TEXT' },
            { name: 'demo_slug',     type: 'TEXT' },
            { name: 'event_name',    type: 'TEXT' },
            { name: 'product_id',    type: 'TEXT' },
            { name: 'product_name',  type: 'TEXT' },
            { name: 'category_path', type: 'TEXT' },
            { name: 'quantity',      type: 'INTEGER' },
            { name: 'unit_price',    type: 'DECIMAL' },
            { name: 'total_value',   type: 'DECIMAL' },
            { name: 'currency',      type: 'TEXT' },
            { name: 'order_id',      type: 'TEXT' },
            { name: 'search_term',   type: 'TEXT' },
            { name: 'result_count',  type: 'INTEGER' },
            { name: 'list_name',     type: 'TEXT' },
            { name: 'page_type',     type: 'TEXT' },
            { name: 'page_url',      type: 'TEXT' }
        ],
        contactKeyColumn: 'contact_key',
        description: 'Demo Factory: storefront events, all demos'
    }
];

/* The column types the API accepts. Checked before anything is sent, because a
   typo here is otherwise a 400 with a less specific message. */
const VALID_TYPES = new Set(['TEXT', 'INTEGER', 'DATE', 'BOOLEAN', 'EMAIL', 'PHONE', 'DECIMAL']);

const dryRun = process.argv.includes('--dry-run');
const token = process.env.DENGAGE_API_TOKEN;

function fail(message) {
    console.error(`\n${message}\n`);
    process.exit(1);
}

function validate() {
    for (const table of TABLES) {
        const names = new Set();
        for (const column of table.columns) {
            if (!VALID_TYPES.has(column.type)) {
                fail(`${table.name}.${column.name} has type ${column.type}, which the API does not accept.\n` +
                     `Accepted types: ${[...VALID_TYPES].join(', ')}`);
            }
            if (column.name.length > 50) {
                fail(`${table.name}.${column.name} is longer than the 50 character column name limit.`);
            }
            if (names.has(column.name)) {
                fail(`${table.name} declares ${column.name} twice.`);
            }
            names.add(column.name);
        }
        const key = table.contactKeyColumn;
        const keyColumn = table.columns.find((c) => c.name === key);
        if (!keyColumn) {
            fail(`${table.name} names ${key} as its contactKeyColumn but does not declare that column.`);
        }
        if (keyColumn.type !== 'TEXT') {
            fail(`${table.name}.${key} is the contactKeyColumn and must be TEXT, not ${keyColumn.type}.`);
        }
    }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates one table. Returns 'created', 'exists', or throws.
 *
 * The already-exists answer is what makes this safe to run twice, so it is
 * matched on the documented code rather than on the message text.
 */
async function createTable(table) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let response;
        try {
            response = await fetch(TABLES_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(table)
            });
        } catch (err) {
            if (attempt === MAX_ATTEMPTS) {
                throw new Error(`could not reach ${TABLES_ENDPOINT}: ${err.message}`);
            }
            await pause(RETRY_PAUSE_MS * attempt);
            continue;
        }

        let body = null;
        const text = await response.text();
        try { body = text ? JSON.parse(text) : null; } catch { /* not JSON, reported below */ }

        if (response.ok && body && body.code === 0) {
            return { status: 'created', tableId: body.data && body.data.tableId };
        }

        if (response.status === 400 && body && body.code === 1) {
            return { status: 'exists' };
        }

        if (response.status === 403) {
            const missing = body && body.data && body.data.missingPermissions;
            throw new Error(
                'the token was refused.' +
                (missing ? ` It is missing: ${missing.join(', ')}.` : '') +
                '\n  A REST API token with the dataSpace.manage permission is needed.'
            );
        }

        if (response.status === 429) {
            if (attempt === MAX_ATTEMPTS) {
                throw new Error('rate limited after several attempts. The published limit is 30 requests per second per IP.');
            }
            await pause(RETRY_PAUSE_MS * attempt);
            continue;
        }

        throw new Error(
            `HTTP ${response.status}` +
            (body && body.message ? `: ${body.message}` : `: ${text.slice(0, 300)}`)
        );
    }
    throw new Error('exhausted every attempt');
}

async function main() {
    validate();

    console.log('\nDemo Factory: Data Space tables\n');

    if (dryRun) {
        console.log(`Dry run. Nothing is sent. The two requests that would go to`);
        console.log(`${TABLES_ENDPOINT}:\n`);
        for (const table of TABLES) {
            console.log(`POST ${TABLES_ENDPOINT}`);
            console.log('Authorization: Bearer <DENGAGE_API_TOKEN>');
            console.log('Content-Type: application/json\n');
            console.log(JSON.stringify(table, null, 2));
            console.log('');
        }
        console.log('Both definitions are valid against the published column types.');
        console.log('Run again without --dry-run, with DENGAGE_API_TOKEN set, to create them.\n');
        return;
    }

    if (!token) {
        fail(
            'DENGAGE_API_TOKEN is not set.\n\n' +
            '  DENGAGE_API_TOKEN=... node factory/phase0/create-tables.mjs\n\n' +
            'The token needs the dataSpace.manage permission.\n' +
            'To review the requests without a token:\n\n' +
            '  node factory/phase0/create-tables.mjs --dry-run'
        );
    }

    let failures = 0;
    for (const table of TABLES) {
        process.stdout.write(`  ${table.name} ... `);
        try {
            const result = await createTable(table);
            if (result.status === 'created') {
                console.log(`created${result.tableId ? ` (${result.tableId})` : ''}`);
            } else {
                console.log('already exists, left alone');
            }
        } catch (err) {
            console.log('failed');
            console.error(`    ${err.message}`);
            failures++;
        }
    }

    if (failures > 0) {
        console.error(`\n${failures} of ${TABLES.length} tables could not be created.\n`);
        process.exit(1);
    }

    console.log('\nBoth tables are in place.');
    console.log('');
    console.log('That is not yet proof that anything writes to them. Creating a table and');
    console.log('landing a row are different things, and an HTTP 200 from the event endpoint');
    console.log('means accepted, not stored. Run the probe page next and confirm the row in');
    console.log('Data Space under contact_key = ddemo-phase0-probe-1. Handoff 12.5, 13.');
    console.log('');
}

main().catch((err) => fail(err.stack || String(err)));
