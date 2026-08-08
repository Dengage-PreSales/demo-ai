#!/usr/bin/env node
/**
 * THE SIX TABLES A DEMO WRITES TO, and whether a demo's events are landing in
 * them. Handoff sections 1.3, 15a. CLAUDE.md section 1b.
 *
 *   node factory/phase0/tables.mjs
 *       Prints which call writes to which table. Reaches nothing.
 *
 *   DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
 *     node factory/phase0/tables.mjs --verify
 *       Confirms all six exist and prints each one's columns and row count.
 *
 *   DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
 *     node factory/phase0/tables.mjs --counts
 *       Row counts only, one line each. Run it, fire some events, run it again.
 *
 * REWRITTEN 6 AUGUST 2026, and the reason matters more than the change.
 *
 * This script used to hold the specification for two private tables,
 * sandbox_onsite_events and sandbox_events, and described them as "the whole of
 * what a demo may write". That design was reversed on 4 August: demos now write
 * to the six standard ecommerce tables using the SDK's own ec:* calls, because
 * the recommendation engine feeds off those tables and a demo that cannot show
 * recommendations is missing one of the things a prospect most wants to see.
 *
 * The old contents also declared a demo_slug column on both tables. That column
 * does not exist and never did: columns cannot be added to the six standard
 * tables. A script that specifies a column nobody can create is worse than no
 * script, because the next person tries to create it.
 *
 * SO WHAT REPLACED THE SLUG. Nothing tags a demo's rows. What finds them is
 * pageView and only pageView. The SDK fills page_url, page_title and session_id
 * on that row itself, and session_id is the only join to the other five tables:
 *
 *     page_view_events where page_url contains the slug   ->  session_ids
 *          ->  those session_ids find its cart, order, wishlist and search rows
 *
 * THAT JOIN CANNOT BE RUN FROM HERE. The Data Space API exposes table metadata
 * and row COUNTS, and no endpoint that reads rows. So attributing rows to one
 * demo is panel work, in Interactive Segment or a report, and this script's job
 * is the question below it that can be answered: are the events arriving at all.
 *
 * WHY THAT QUESTION NEEDS A TOOL. An HTTP 200 from the event endpoint means
 * accepted, not stored. The row is the only proof. Handoff 12.5, and two
 * confident and wrong "it is working" claims on the reference build. A row count
 * before and after is the cheapest honest version of that check.
 *
 * NOTHING HERE WRITES, CREATES, DROPS, TRUNCATES OR DELETES. The only request
 * that is not a GET is the login. Dropping or truncating a table, or deleting
 * rows or contacts, needs Salil's written approval first, every time, for that
 * specific object. CLAUDE.md section 1a. Those endpoints exist and this script
 * has no code path to them on purpose: reaching for one is a decision that gets
 * made in a conversation rather than in a script.
 *
 * Environment, for --verify and --counts only:
 *
 *   DENGAGE_API_USERKEY   an API user, created in the panel under
 *   DENGAGE_API_PASSWORD  Configuration, Users, New User. The platform
 *                         generates the key and shows the password once.
 *   DENGAGE_API_TOKEN     optional. An access token obtained elsewhere.
 *   DENGAGE_API_BASE      optional. Defaults to https://api.dengage.com.
 *
 * Neither the key nor the password is ever written into this repository.
 *
 * The API is IP allowlisted, so run this from a machine whose address is on the
 * list. A stock CI runner is not, and its address changes, so there is nothing
 * stable to add.
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
   The six tables, and the call that writes each one.

   These are platform tables, related to master_contact already, with schemas
   this repository does not own and cannot extend. So there is no column
   specification here to compare against, which is the whole difference from
   what this file used to be: the question is no longer "do these match what we
   asked for" but "do these exist, and are rows arriving".

   page_view_events is first because it is the one that matters. Every page
   fires pageView before anything else, and a page that skips it writes cart,
   order, wishlist and search rows whose session_id appears in no page view, so
   nothing can ever attribute them to a demo. The guard's pageview-required
   check exists for exactly that. CLAUDE.md 1b, 3.1.
   -------------------------------------------------------------------------- */
const TABLES = [
    {
        name: 'page_view_events',
        writtenBy: ['pageView'],
        note: 'the only route back to a demo\'s rows, through page_url and session_id'
    },
    {
        name: 'shopping_cart_events',
        writtenBy: ['ec:addToCart', 'ec:removeFromCart', 'ec:deleteCart', 'ec:beginCheckout'],
        note: 'one row per cart change, event_type says which'
    },
    {
        name: 'order_events',
        writtenBy: ['ec:order', 'ec:cancelOrder'],
        note: 'the order header'
    },
    {
        name: 'order_events_detail',
        writtenBy: ['ec:order', 'ec:cancelOrder'],
        note: 'one row per line item, written by the same call'
    },
    {
        name: 'wishlist_events',
        writtenBy: ['ec:addToWishlist', 'ec:removeFromWishlist'],
        note: 'event_type is add or remove, and list_name names the list'
    },
    {
        name: 'search_events',
        writtenBy: ['ec:search'],
        note: 'the term and the result count'
    }
];

const verify = process.argv.includes('--verify');
const countsOnly = process.argv.includes('--counts');
let token = process.env.DENGAGE_API_TOKEN || '';
const userKey = process.env.DENGAGE_API_USERKEY;
const password = process.env.DENGAGE_API_PASSWORD;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
    console.error(`\n${message}\n`);
    process.exit(1);
}

/* ------------------------------------------------------------------ */
/* What writes where                                                   */

function printSpec() {
    console.log('\nDemo Factory: the six tables a demo writes to\n');
    console.log('These are the standard ecommerce tables. They already exist, they are');
    console.log('already related to master_contact, and their schemas are the platform\'s.');
    console.log('There is nothing to create and nothing to enter in the panel.\n');

    for (const table of TABLES) {
        console.log(`  ${table.name}`);
        console.log(`      written by  ${table.writtenBy.join(', ')}`);
        console.log(`      ${table.note}`);
        console.log('');
    }

    console.log('Every one of those calls comes from template/js/dengageEvents.js and');
    console.log('nowhere else, which is what makes the rule checkable rather than hoped');
    console.log('for. The guard\'s event-single-source check refuses an SDK call anywhere');
    console.log('else, and pageview-required checks every page loads that module.\n');

    console.log('NO COLUMN TAGS A DEMO. Columns cannot be added to these six, so a demo\'s');
    console.log('rows are found only through pageView: page_url carries the slug, and');
    console.log('session_id joins that row to the other five tables. That join is panel');
    console.log('work, because the API reads table metadata and row counts but not rows.\n');

    console.log('To check events are landing at all:\n');
    console.log('  DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \\');
    console.log('    node factory/phase0/tables.mjs --counts\n');
    console.log('Run it, use the storefront, run it again. A count that did not move is');
    console.log('the answer, whatever the browser console said. Handoff 12.5.\n');
}

/* ------------------------------------------------------------------ */
/* The API                                                             */

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

async function signIn(mode) {
    if (token) return;
    if (!userKey || !password) {
        fail(
            'No credentials, so there is nothing to read.\n\n' +
            '  DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \\\n' +
            `    node factory/phase0/tables.mjs ${mode}\n\n` +
            'Run with no flags to print what writes where instead.'
        );
    }
    try { token = await login(); } catch (err) { fail(err.message); }
}

/** Reads one table's detail, or null with the reason already printed. */
async function detailFor(name, id) {
    try {
        const { body } = await call(`${TABLES_ENDPOINT}/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return (body && body.data) || null;
    } catch (err) {
        console.log(`  ${name.padEnd(22)} could not be read: ${err.message}`);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Modes                                                               */

async function runCounts() {
    await signIn('--counts');
    console.log('\nRow counts, whole table, all demos and all other traffic together\n');

    let ids;
    try { ids = await findTableIds(TABLES.map((t) => t.name)); } catch (err) { fail(err.message); }

    let missing = 0;
    for (const table of TABLES) {
        const id = ids.get(table.name);
        if (!id) { console.log(`  ${table.name.padEnd(22)} NOT FOUND`); missing++; continue; }
        const detail = await detailFor(table.name, id);
        if (!detail) { missing++; continue; }
        const count = detail.totalRowCount;
        console.log(`  ${table.name.padEnd(22)}${typeof count === 'number' ? count : 'unknown'}`);
    }

    console.log('');
    console.log('These are whole table counts. The account is shared, so a number that');
    console.log('moved is not proof it was YOUR event, and a number that did not move is');
    console.log('proof that it was not. Use the second reading, not the first.\n');
    if (missing) process.exit(1);
}

async function runVerify() {
    await signIn('--verify');
    console.log('\nDemo Factory: the six tables a demo writes to\n');

    let ids;
    try { ids = await findTableIds(TABLES.map((t) => t.name)); } catch (err) { fail(err.message); }

    let missing = 0;
    for (const table of TABLES) {
        const id = ids.get(table.name);
        if (!id) {
            console.log(`  ${table.name}`);
            console.log('      NOT FOUND in this account\n');
            missing++;
            continue;
        }
        const detail = await detailFor(table.name, id);
        if (!detail) { missing++; continue; }

        const columns = detail.columns || [];
        console.log(`  ${table.name}`);
        console.log(`      rows        ${detail.totalRowCount}`);
        console.log(`      contact key ${detail.contactKeyColumn || 'not set'}`);
        console.log(`      columns     ${columns.length}`);
        if (columns.length) {
            /* Wrapped, because these tables are wide and one long line is unreadable
               in a terminal. Names only: the types belong to the platform and are
               not something this repository has an opinion about. */
            const names = columns.map((c) => c.name);
            let line = '        ';
            for (const name of names) {
                if (line.length + name.length + 2 > 76) { console.log(line); line = '        '; }
                line += name + '  ';
            }
            if (line.trim()) console.log(line);
        }
        console.log('');
    }

    if (missing > 0) {
        console.log(`${missing} of the six could not be read. These are platform tables, so a`);
        console.log('missing one is a question for Dengage rather than something to create.\n');
        process.exit(1);
    }

    console.log('All six are present. Two things this cannot tell you:\n');
    console.log('  A table existing is not proof anything writes to it. Use --counts');
    console.log('  before and after using the storefront. Handoff 12.5.\n');
    console.log('  Which rows belong to which demo. No endpoint reads rows, so that is');
    console.log('  panel work: find page_view_events where page_url contains the slug,');
    console.log('  then follow session_id into the other five. CLAUDE.md 1b.\n');
}

/* ------------------------------------------------------------------ */

/**
 * Guards the table list itself, so a typo in it cannot become a confident
 * "NOT FOUND" against a table that is really there under its correct name.
 */
function validateSpec() {
    const seen = new Set();
    for (const table of TABLES) {
        if (seen.has(table.name)) fail(`${table.name} is listed twice.`);
        seen.add(table.name);
        if (!/^[a-z][a-z0-9_]*$/.test(table.name)) {
            fail(`${table.name} is not a plausible table name. These are lower case with underscores.`);
        }
        if (!table.writtenBy || table.writtenBy.length === 0) {
            fail(`${table.name} does not say what writes to it, so it should not be listed.`);
        }
    }
    if (TABLES.length !== 6) {
        fail(`This lists ${TABLES.length} tables. CLAUDE.md 1b names six, so one of the two is wrong.`);
    }
    if (TABLES[0].name !== 'page_view_events') {
        fail('page_view_events is listed first on purpose. It is the only route back to a demo\'s rows.');
    }
}

validateSpec();

if (countsOnly) {
    runCounts().catch((err) => fail(err.stack || String(err)));
} else if (verify) {
    runVerify().catch((err) => fail(err.stack || String(err)));
} else {
    printSpec();
}
