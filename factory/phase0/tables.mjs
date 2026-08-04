#!/usr/bin/env node
/**
 * The two Data Space tables every demo writes to. Handoff sections 2.3, 2.3a.
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
 *   node factory/phase0/tables.mjs
 *       Prints the specification to enter in the panel. Sends nothing.
 *
 *   DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
 *     node factory/phase0/tables.mjs --verify
 *       Checks what actually exists against that specification.
 *
 * THIS SCRIPT DOES NOT CREATE TABLES, AND THAT IS DELIBERATE.
 *
 * An earlier version did, and it created the wrong kind. The CreateTable API
 * has no field for the table type: given a contactKeyColumn it makes a
 * SENDABLE table, which is a send list, an audience you can mail or push to.
 * Event data belongs in a BIG DATA table. There is no way to ask the API for
 * one, so the two tables are made by hand in the panel, once, and this prints
 * exactly what to enter. Handoff 2.3.
 *
 * The difference is not cosmetic. On a Sendable table the contact key cannot
 * be nullable, so every event from an anonymous visitor would be refused and
 * the demo would record nothing until somebody signed up. On a Big Data table
 * it is nullable, which is what Dengage's star schema documentation says it is
 * for. Handoff 2.3a, 6.2.
 *
 * NOTHING HERE DELETES ANYTHING. Dropping or truncating a table, or deleting
 * rows or contacts, needs Salil's written approval first, every time, for that
 * specific object. CLAUDE.md section 1a. This script has no such code path on
 * purpose: those endpoints exist, and reaching for one is a decision that gets
 * made in a conversation rather than in a script.
 *
 * Environment, for --verify only:
 *
 *   DENGAGE_API_USERKEY   an API user, created in the panel under
 *   DENGAGE_API_PASSWORD  Configuration, Users, New User. The platform
 *                         generates the key and shows the password once.
 *   DENGAGE_API_TOKEN     optional. An access token obtained elsewhere.
 *   DENGAGE_API_BASE      optional. Defaults to https://api.dengage.com.
 *
 * Neither the key nor the password is ever written into this repository.
 *
 * A table existing is not proof that anything writes to it. Handoff 12.5: an
 * HTTP 200 from the event endpoint means accepted, not stored, and the row in
 * Data Space is the only proof an event landed. That is the probe page's job.
 */

const API_BASE = process.env.DENGAGE_API_BASE || 'https://api.dengage.com';
const LOGIN_ENDPOINT = `${API_BASE}/rest/login`;
const TABLES_ENDPOINT = `${API_BASE}/rest/dataspace/tables`;

/* Higher than a handful of requests needs, because of the IP allowlist. A
   machine behind a rotating egress pool presents a different address per
   connection, so an attempt can be refused on the address alone and the next
   one succeed. On a machine with one fixed address every attempt uses that
   address, so this fails the same way it would have on the first try and
   reports the address that needs allowlisting. */
const RETRY_PAUSE_MS = 1000;
const MAX_ATTEMPTS = 8;

/* --------------------------------------------------------------------------
   The tables.

   contact_key is TEXT and is named as the contact key column on both, because
   without it the rows cannot be joined to a contact, which is most of what a
   demo is demonstrating.

   It is NULLABLE, which is only possible because these are Big Data tables.
   Dengage's star schema documentation gives the reason directly: a nullable
   contact key is what lets an anonymous, unauthenticated device record rows.
   Handoff 6.2 has anonymous visitors staying anonymous as correct behaviour,
   so this is the difference between a demo that records everything and one
   that records nothing until somebody signs up.

   key, event_date, session_id, event_type and event_id are filled by the SDK
   or by the platform, never by the site, so they are not declared.

   demo_slug is on both and is what separates one demo's rows from another's.
   The 90 day purge filters on it. Handoff 1.7, 10.
   -------------------------------------------------------------------------- */
const TABLES = [
    {
        name: 'sandbox_onsite_events',
        description: 'Demo Factory: scenario launcher clicks, all demos',
        contactKeyColumn: 'contact_key',
        columns: [
            { name: 'contact_key',    type: 'TEXT' },
            { name: 'demo_slug',      type: 'TEXT' },
            { name: 'event_name',     type: 'TEXT' },
            { name: 'scenario_group', type: 'TEXT' },
            { name: 'widget_name',    type: 'TEXT' },
            { name: 'page_type',      type: 'TEXT' },
            { name: 'page_url',       type: 'TEXT' }
        ]
    },
    {
        /* One table for every storefront interaction, deliberately wide and
           mostly empty on any given row. That is what replaces
           shopping_cart_events, order_events, order_events_detail,
           wishlist_events and search_events, and it is what keeps the purge to
           a single filter.

           unit_price and total_value are left out of a row, never sent as
           zero, when the scrape did not produce a real price. Number(null) is
           0 in JavaScript and that exact trap has shipped the same bug twice
           on the core repository. Handoff 1.8. */
        name: 'sandbox_events',
        description: 'Demo Factory: storefront events, all demos',
        contactKeyColumn: 'contact_key',
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
        ]
    }
];

const VALID_TYPES = new Set(['TEXT', 'INTEGER', 'DATE', 'BOOLEAN', 'EMAIL', 'PHONE', 'DECIMAL']);

const verify = process.argv.includes('--verify');
let token = process.env.DENGAGE_API_TOKEN || '';
const userKey = process.env.DENGAGE_API_USERKEY;
const password = process.env.DENGAGE_API_PASSWORD;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
    console.error(`\n${message}\n`);
    process.exit(1);
}

/* ------------------------------------------------------------------ */
/* The specification                                                   */

function printSpec() {
    console.log('\nDemo Factory: the two Data Space tables\n');
    console.log('Created by hand, in the panel, once. The API cannot make the right');
    console.log('type: it produces a Sendable table, which is a send list, and event');
    console.log('data belongs in a Big Data table. Handoff 2.3, 2.3a.\n');
    console.log('Data Space, Tables, New, and pick Big Data. Not Regular, which is for');
    console.log('data linked on primary keys. Not either Sendable type.\n');

    for (const table of TABLES) {
        console.log('-'.repeat(66));
        console.log('Type          Big Data');
        console.log(`Name          ${table.name}`);
        console.log(`Description   ${table.description}`);
        console.log(`Contact key   ${table.contactKeyColumn}, left nullable`);
        console.log('Columns');
        for (const column of table.columns) {
            const note = column.name === table.contactKeyColumn
                ? '   the contact key column, leave it nullable'
                : '';
            console.log(`  ${column.name.padEnd(15)} ${column.type}${note}`);
        }
        console.log('');
    }

    console.log('-'.repeat(66));
    console.log('\nThen relate each table to master_contact.\n');
    console.log('  Where        the Connect Toolbox, upper right of the table,');
    console.log('               then New Relation');
    console.log('  From         <this table>.contact_key');
    console.log('  To           master_contact.contact_key');
    console.log('  Cardinality  one to many. One contact, many event rows\n');
    console.log('Without the relation the tables are inert stores. With it, the');
    console.log('Interactive Segment tools can build segments across them, which is');
    console.log('the thing a prospect is actually being shown.\n');
    console.log('Check the result with:\n');
    console.log('  DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \\');
    console.log('    node factory/phase0/tables.mjs --verify\n');
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */

/**
 * Recognises the IP allowlist refusal and returns a message naming the address
 * that needs allowlisting, or null when this is not that.
 *
 * The API refuses on the address before it looks at the credentials, and it
 * reports through `actionResult` rather than through the `message` field the
 * other errors use. The default reading of a 403 on a login call is "wrong
 * password", and sending someone to re-check a correct credential while the
 * real cause is the network costs an afternoon.
 */
function detectIpBlock(body, text) {
    const reason = (body && (body.actionResult || body.message)) || text || '';
    if (!/not\s+whitelisted|whitelist|forbidden for/i.test(reason)) return null;
    const found = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(reason);
    return (
        'the Dengage API refused this machine, before checking the credentials.\n' +
        '  The API is IP allowlisted and this address is not on the list' +
        (found ? `:\n\n      ${found[1]}\n` : '.\n') +
        '\n  The credentials are probably fine. Nothing has been checked yet.\n' +
        '\n  Options, in the order they are usually worth trying:\n' +
        '    1. Run this from a machine whose address is already allowlisted.\n' +
        '    2. Ask Dengage to add the address above.\n' +
        '    3. For anything scheduled, give it a fixed egress address. A stock\n' +
        '       GitHub Actions runner cannot work here: its address comes from a\n' +
        '       large pool that changes, so there is nothing stable to allowlist.'
    );
}

async function call(url, options = {}) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let response;
        try {
            response = await fetch(url, options);
        } catch (err) {
            if (attempt === MAX_ATTEMPTS) throw new Error(`could not reach ${url}: ${err.message}`);
            await pause(RETRY_PAUSE_MS * attempt);
            continue;
        }

        const text = await response.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { /* handled by the caller */ }

        const blocked = detectIpBlock(body, text);
        if (blocked) {
            if (attempt === MAX_ATTEMPTS) throw new Error(blocked);
            await pause(RETRY_PAUSE_MS * attempt);
            continue;
        }

        if (response.status === 429) {
            if (attempt === MAX_ATTEMPTS) throw new Error('rate limited after several attempts');
            await pause(RETRY_PAUSE_MS * attempt);
            continue;
        }

        return { response, body, text };
    }
    throw new Error('exhausted every attempt');
}

async function login() {
    const { response, body, text } = await call(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userkey: userKey, password: password })
    });

    if (!response.ok || !body || !body.access_token) {
        throw new Error(
            `login failed with HTTP ${response.status}` +
            (body && (body.message || body.actionResult)
                ? `: ${body.message || body.actionResult}`
                : `: ${text.slice(0, 300)}`) +
            '\n  These are an API user created in the panel under Configuration,' +
            '\n  Users, New User, not the panel login used in a browser.'
        );
    }
    return body.access_token;
}

/** Finds each table's id by name, paging through the account's table list. */
async function findTableIds(names) {
    const wanted = new Set(names);
    const found = new Map();
    const PAGE = 1000;   /* the API rejects a limit below 10 or above 1000 */

    for (let offset = 0; ; offset += PAGE) {
        const { body } = await call(`${TABLES_ENDPOINT}?limit=${PAGE}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = body && body.data;
        const rows = (data && data.result) || [];
        for (const row of rows) {
            if (wanted.has(row.tableName)) found.set(row.tableName, row.publicId);
        }
        const total = (data && data.totalRowCount) || 0;
        if (found.size === wanted.size || offset + PAGE >= total || rows.length === 0) break;
    }
    return found;
}

function compare(spec, actual) {
    const problems = [];
    const byName = new Map((actual.columns || []).map((c) => [c.name, c]));

    for (const column of spec.columns) {
        const got = byName.get(column.name);
        if (!got) { problems.push(`missing column ${column.name}`); continue; }
        if (got.type !== column.type) {
            problems.push(`${column.name} is ${got.type}, expected ${column.type}`);
        }
    }
    for (const name of byName.keys()) {
        if (!spec.columns.some((c) => c.name === name)) problems.push(`unexpected column ${name}`);
    }
    if (actual.contactKeyColumn !== spec.contactKeyColumn) {
        problems.push(
            `contact key column is ${actual.contactKeyColumn || 'not set'}, ` +
            `expected ${spec.contactKeyColumn}`
        );
    }

    /* Neither the list nor the detail endpoint reports the table type, so this
       is the closest available check for it. A non-nullable contact key is
       what the API forces on a Sendable table, and a Big Data table has no
       such requirement, so seeing it here almost certainly means the table is
       the wrong type. The panel shows the type on the table list. */
    const key = (actual.columns || []).find((c) => c.name === spec.contactKeyColumn);
    if (key && key.isNullable === false) {
        problems.push(
            'contact_key is NOT NULLABLE, which suggests a Sendable table rather ' +
            'than a Big Data one. Anonymous visitors cannot record rows on a ' +
            'Sendable table. Check the type in the panel'
        );
    }
    return problems;
}

async function runVerify() {
    if (!token) {
        if (!userKey || !password) {
            fail(
                'No credentials, so there is nothing to verify against.\n\n' +
                '  DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \\\n' +
                '    node factory/phase0/tables.mjs --verify\n\n' +
                'Run without --verify to print the specification instead.'
            );
        }
        try { token = await login(); } catch (err) { fail(err.message); }
        console.log('  signed in');
    }

    let ids;
    try { ids = await findTableIds(TABLES.map((t) => t.name)); } catch (err) { fail(err.message); }

    let problems = 0;
    for (const spec of TABLES) {
        const id = ids.get(spec.name);
        if (!id) {
            console.log(`  ${spec.name.padEnd(23)} NOT FOUND`);
            problems++;
            continue;
        }
        let detail;
        try {
            const { body } = await call(`${TABLES_ENDPOINT}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            detail = body && body.data;
        } catch (err) {
            console.log(`  ${spec.name.padEnd(23)} could not be read: ${err.message}`);
            problems++;
            continue;
        }
        const issues = compare(spec, detail || {});
        if (issues.length === 0) {
            console.log(`  ${spec.name.padEnd(23)} matches, ${detail.totalRowCount} row(s)`);
        } else {
            console.log(`  ${spec.name.padEnd(23)} ${issues.length} problem(s)`);
            issues.forEach((p) => console.log(`      ${p}`));
            problems += issues.length;
        }
    }

    console.log('');
    if (problems > 0) {
        console.log('The tables do not match the specification. Run without --verify to');
        console.log('print what should be entered. Nothing here changes anything: fixing a');
        console.log('table is done in the panel.\n');
        process.exit(1);
    }
    console.log('Both tables match. The relation to master_contact cannot be checked from');
    console.log('here, so confirm that in the panel, then run the probe and find the row.');
    console.log('A table existing is not proof that anything writes to it. Handoff 12.5.\n');
}

/* ------------------------------------------------------------------ */

function validateSpec() {
    for (const table of TABLES) {
        const seen = new Set();
        for (const column of table.columns) {
            if (!VALID_TYPES.has(column.type)) {
                fail(`${table.name}.${column.name} has type ${column.type}, which is not one of ` +
                     `${[...VALID_TYPES].join(', ')}`);
            }
            if (column.name.length > 50) {
                fail(`${table.name}.${column.name} exceeds the 50 character column name limit.`);
            }
            if (seen.has(column.name)) fail(`${table.name} declares ${column.name} twice.`);
            seen.add(column.name);
        }
        if (!table.columns.some((c) => c.name === table.contactKeyColumn)) {
            fail(`${table.name} names ${table.contactKeyColumn} as its contact key column ` +
                 `but does not declare that column.`);
        }
    }
}

validateSpec();

if (verify) {
    console.log('\nDemo Factory: checking the Data Space tables\n');
    runVerify().catch((err) => fail(err.stack || String(err)));
} else {
    printSpec();
}
