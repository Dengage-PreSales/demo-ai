#!/usr/bin/env node
/**
 * SEND ONE SAMPLE WEB PUSH, so a call can show what a Dengage push looks like
 * when it arrives on the desktop.
 *
 *   # print exactly what would be sent, and send nothing
 *   node factory/panel/send-instant-push.mjs --segment <uuid>
 *
 *   # send it
 *   DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
 *     node factory/panel/send-instant-push.mjs --segment <uuid> --send
 *
 *   # read the delivery report afterwards, which writes nothing
 *   DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
 *     node factory/panel/send-instant-push.mjs --report <trackingId>
 *
 * This wraps SendInstantPush, https://dev.dengage.com/reference/sendinstantpush.
 *
 * WHY THIS IS A SCRIPT AND NOT A BUTTON ON THE STOREFRONT. The launcher fires
 * every other scenario from the page, and this one cannot work that way. The API
 * authenticates with an account level token, and a token reachable from a public
 * static page is a token anyone can read and reuse. The API also has no per
 * device field: it selects an audience with a segment or a table, so a button
 * would push to every subscribed device rather than to the browser that pressed
 * it. Both of those are properties of a server side API rather than problems to
 * work around, so this stays a script an operator runs deliberately.
 *
 * FOR A PER DEVICE PUSH DURING A CALL, use a journey instead. The storefront
 * already emits the events, so a journey with a Data Layer Event entry and a Web
 * Push step reaches exactly the device that triggered it, in seconds, with no
 * credential anywhere near the page. Handoff 2.5. This script is for the case
 * where you want to send on demand, without waiting for an event.
 *
 * THE ONE THING THAT MATTERS MOST HERE. applicationIds is optional in the API,
 * and leaving it out sends to every application in the account. Account 28 is
 * shared, so that would push to devices this repository has nothing to do with.
 * This script therefore always sends applicationIds, always reads it from
 * factory/sandbox.json, and has no flag to change or omit it. CLAUDE.md 1.
 *
 * NOTHING HERE DELETES ANYTHING, and nothing here creates a segment. Both are
 * decisions that get made in a conversation. CLAUDE.md 1a.
 *
 * Environment:
 *
 *   DENGAGE_API_USERKEY   an API user, created in the panel under
 *   DENGAGE_API_PASSWORD  Configuration, Users, New User.
 *   DENGAGE_API_TOKEN     optional. An access token obtained elsewhere.
 *   DENGAGE_API_BASE      optional. Defaults to https://api.dengage.com.
 *
 * No credential is written into this repository, printed by this script, or
 * passed on a command line where a shell would record it in a history file.
 *
 * The API is IP allowlisted, so run this from a machine whose address is on the
 * list. A stock CI runner is not, and its address changes, so there is nothing
 * stable to add.
 */

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SITE = 'https://dengage-presales.github.io/demo-ai';

const API_BASE = process.env.DENGAGE_API_BASE || 'https://api.dengage.com';
const LOGIN_ENDPOINT = `${API_BASE}/rest/login`;
const PUSH_ENDPOINT = `${API_BASE}/rest/push/sendInstant`;

const RETRY_PAUSE_MS = 1000;
const MAX_ATTEMPTS = 8;

/* The word that has to be typed before anything is sent. Long enough that a
   return key pressed out of habit does not arm it. */
const CONFIRM_WORD = 'send';

/* --------------------------------------------------------------------------
   The message.

   Generic on purpose, exactly like the shared creatives: no brand, no product,
   no price and no vertical, because one push is used on every call. The icon
   comes from the application's own Icon/Badge URL setting rather than from here,
   so this only supplies the large image. Handoff 2.1.
   -------------------------------------------------------------------------- */
const CONTENT = {
    title: 'Dengage eComm Demo',
    message: 'A web push, sent from Dengage to this browser. Everything on the demo storefront can trigger one.',
    mediaUrl: `${SITE}/assets/popup/dn-vertical-popup.jpg`,
    targetUrl: `${SITE}/`
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
    console.error(`\n${message}\n`);
    process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Arguments                                                           */

/** Reads `--name value`, returning null when the flag is absent. */
function flag(name) {
    const at = process.argv.indexOf(`--${name}`);
    if (at === -1) return null;
    const value = process.argv[at + 1];
    if (!value || value.startsWith('--')) fail(`--${name} needs a value after it.`);
    return value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidFlag(name) {
    const value = flag(name);
    if (value === null) return null;
    if (!UUID.test(value)) {
        fail(
            `--${name} is not a uuid: ${value}\n` +
            '  The panel shows it in the address bar when the object is open.'
        );
    }
    return value.toLowerCase();
}

const args = {
    segment: uuidFlag('segment'),
    table: uuidFlag('table'),
    report: uuidFlag('report'),
    title: flag('title'),
    message: flag('message'),
    url: flag('url'),
    engaged: process.argv.includes('--engaged'),
    send: process.argv.includes('--send')
};

/* An https URL only. A push with an http target is dropped by the browser, and
   a relative one has nothing to resolve against inside a notification. */
if (args.url && !/^https:\/\//i.test(args.url)) {
    fail(`--url has to start with https, and this one does not:\n  ${args.url}`);
}

/* ------------------------------------------------------------------ */
/* The application                                                     */

function application() {
    let raw;
    try {
        raw = JSON.parse(readFileSync(join(ROOT, 'factory', 'sandbox.json'), 'utf8'));
    } catch (err) {
        fail(`Could not read factory/sandbox.json: ${err.message}`);
    }
    if (!raw.appGuid || !raw.accountId) {
        fail('factory/sandbox.json is missing accountId or appGuid.');
    }
    /* An unconfigured identity fails here rather than becoming a request. The
       generator leaves __DENGAGE_APP_GUID__ in the template until a demo is built,
       and a request carrying that would be refused by the platform with an error
       that says nothing about where the value came from. */
    if (!UUID.test(String(raw.appGuid))) {
        fail(
            `factory/sandbox.json does not name a configured application:\n  ${raw.appGuid}\n` +
            '\n  Nothing has been sent.'
        );
    }
    return { accountId: String(raw.accountId), appGuid: String(raw.appGuid) };
}

/* ------------------------------------------------------------------ */
/* The request                                                         */

/**
 * Builds the request. Takes the options rather than reading them from argv, so
 * that --self-test can run it over a matrix of arguments and assert the one rail
 * that fails silently if it ever breaks.
 */
function body(app, options) {
    const content = { ...CONTENT };
    if (options.title) content.title = options.title;
    if (options.message) content.message = options.message;
    if (options.url) content.targetUrl = options.url;

    /* applicationIds is never omitted and never widened. See the header. */
    const payload = { applicationIds: [app.appGuid], content };

    if (options.segment) payload.segmentId = options.segment;
    if (options.table) payload.tableId = options.table;
    if (options.engaged) payload.useOnlyEngagedTokens = true;

    return payload;
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
function detectIpBlock(responseBody, text) {
    const reason = (responseBody && (responseBody.actionResult || responseBody.message)) || text || '';
    if (!/not\s+whitelisted|whitelist|forbidden for/i.test(reason)) return null;
    const found = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(reason);
    return (
        'the Dengage API refused this machine, before checking the credentials.\n' +
        '  The API is IP allowlisted and this address is not on the list' +
        (found ? `:\n\n      ${found[1]}\n` : '.\n') +
        '\n  The credentials are probably fine. Nothing has been sent.'
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
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { /* handled by the caller */ }

        const blocked = detectIpBlock(parsed, text);
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

        return { response, body: parsed, text };
    }
    throw new Error('exhausted every attempt');
}

/**
 * Retries are safe on the login call and on the report, which change nothing.
 * They are NOT safe on the send: a request that reached the platform and then
 * timed out on the way back would be sent twice, and two pushes on a call look
 * like a fault in the product. So the send is attempted once.
 */
async function callOnce(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* handled by the caller */ }
    return { response, body: parsed, text };
}

/**
 * Whether a credential is present, without using it. Checked before the terminal
 * asks anything, so a missing environment variable is reported instead of being
 * discovered after somebody has already typed the word that arms the send.
 */
function haveCredentials() {
    return !!(process.env.DENGAGE_API_TOKEN ||
        (process.env.DENGAGE_API_USERKEY && process.env.DENGAGE_API_PASSWORD));
}

function requireCredentials() {
    if (haveCredentials()) return;
    fail(
        'Set DENGAGE_API_USERKEY and DENGAGE_API_PASSWORD in the environment.\n' +
        '  These are an API user created in the panel under Configuration,\n' +
        '  Users, New User, not the panel login used in a browser.\n' +
        '\n  Nothing has been sent.'
    );
}

async function login() {
    /* Every caller checks this first, so that the terminal never asks a question
       it is going to refuse to act on. Repeated here so a path added later cannot
       reach the network with an empty credential and get an unhelpful 403. */
    requireCredentials();

    if (process.env.DENGAGE_API_TOKEN) return process.env.DENGAGE_API_TOKEN;

    const userKey = process.env.DENGAGE_API_USERKEY;
    const password = process.env.DENGAGE_API_PASSWORD;

    const { response, body: parsed, text } = await call(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userkey: userKey, password: password })
    });

    if (!response.ok || !parsed || !parsed.access_token) {
        const said = parsed && (parsed.message || parsed.actionResult);
        throw new Error(
            `login failed with HTTP ${response.status}` +
            (said ? `: ${said}` : `: ${text.slice(0, 300)}`) +
            '\n  Nothing has been sent.'
        );
    }
    return parsed.access_token;
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */

/** Asks on the terminal, and treats anything other than the word as a no. */
function confirm(question) {
    const io = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        io.question(question, (answer) => {
            io.close();
            resolve(answer.trim().toLowerCase() === CONFIRM_WORD);
        });
    });
}

function describe(app, payload) {
    console.log('\nPOST ' + PUSH_ENDPOINT + '\n');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');
    console.log(`  Account          ${app.accountId}`);
    console.log(`  Application      ${app.appGuid}`);
    console.log('  Audience         ' +
        (payload.segmentId ? `segment ${payload.segmentId}` : `table ${payload.tableId}`));
    console.log('  Engaged only     ' + (payload.useOnlyEngagedTokens ? 'yes' : 'no'));
    console.log('  Schedule         immediately');
    console.log('');
    console.log('  This reaches every subscribed device the audience above selects,');
    console.log('  inside this one application. It cannot be recalled once sent.');
    console.log('');
}

function reportLine(label, value) {
    if (value === undefined || value === null) return;
    console.log(`  ${label.padEnd(18)}${value}`);
}

async function runReport(trackingId) {
    requireCredentials();
    const token = await login();
    const url = `${PUSH_ENDPOINT}?trackingId=${encodeURIComponent(trackingId)}` +
        `&applicationId=${encodeURIComponent(application().appGuid)}`;

    const { response, body: parsed, text } = await call(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 404) {
        fail(
            `No report yet for ${trackingId}.\n` +
            '  A send takes a moment to appear. Try again shortly.'
        );
    }
    if (!response.ok || !parsed || !parsed.data) {
        fail(`The report came back as HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = parsed.data;
    console.log(`\nDelivery report for ${trackingId}\n`);
    reportLine('Status', data.status);
    reportLine('Created', data.createdAt);
    reportLine('Delivered', data.totalDeliveredCount);
    reportLine('Opened', data.totalOpenCount);
    reportLine('Bounced', data.totalBounceCount);
    reportLine('Errors', data.totalErrorCount);
    if (data.errorMessage) reportLine('Reported', data.errorMessage);

    for (const group of [['Browsers', data.browsers], ['Devices', data.deviceTypes]]) {
        const rows = group[1] || [];
        if (!rows.length) continue;
        console.log(`\n  ${group[0]}`);
        for (const row of rows) {
            console.log(`    ${String(row.itemName || 'unknown').padEnd(24)}` +
                `delivered ${row.deliveredCount || 0}, opened ${row.openCount || 0}`);
        }
    }
    console.log('');
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Self test                                                           */

/**
 * Asserts the rail in the header: whatever the arguments, the request names
 * exactly one application and it is this repository's.
 *
 * This exists because that is the only mistake here with no visible symptom. A
 * wrong title is obvious on the notification. An applicationIds array that lost
 * an entry, or gained one, sends to devices belonging to other work and looks
 * completely normal from this side. CLAUDE.md 4, test the guard against known
 * bad input rather than trusting that it holds.
 *
 * It builds requests and asserts on them. It sends nothing and needs no
 * credential.
 *
 * NO UUID LITERAL APPEARS HERE, and that is deliberate rather than awkward. The
 * guard's app-guid check refuses any identifier in this repository that is not
 * the sandbox application, and a placeholder uuid in a test fixture is exactly
 * the kind of thing that gets an allowlist entry added and quietly weakens the
 * check for everything else. body() never parses its audience, so a plain label
 * tests the same rail. The pattern itself is tested against the one real uuid
 * this repository is allowed to contain.
 */
function selfTest() {
    const app = application();
    const audience = 'the-segment-under-test';
    const other = 'a-different-audience';

    const cases = [
        ['nothing set', {}],
        ['a segment', { segment: audience }],
        ['a table', { table: audience }],
        ['engaged only', { segment: audience, engaged: true }],
        ['every override', { segment: audience, title: 'x', message: 'y', url: 'https://example.com', engaged: true }],
        ['both audiences', { segment: audience, table: other }],
        ['an empty string audience', { segment: '', table: '' }],
        ['an option named applicationIds', { segment: audience, applicationIds: [other] }],
        ['an option named appGuid', { segment: audience, appGuid: other }]
    ];

    let failures = 0;
    let checks = 0;
    const assert = (ok, label) => {
        checks += 1;
        if (!ok) { failures += 1; console.log(`   FAIL  ${label}`); }
        else console.log(`   ok    ${label}`);
    };

    console.log('\nThe request always names one application, and it is ours\n');
    for (const [label, options] of cases) {
        const payload = body(app, options);
        const ids = payload.applicationIds;
        assert(Array.isArray(ids) && ids.length === 1 && ids[0] === app.appGuid, label);
    }

    console.log('\nAnd the rest of the request holds\n');
    const full = body(app, { segment: audience, title: 'T', message: 'M', url: 'https://example.com/x' });
    assert(full.content.title === 'T', 'a title override reaches the content');
    assert(full.content.message === 'M', 'so does a message override');
    assert(full.content.targetUrl === 'https://example.com/x', 'so does a target url');
    assert(full.content.mediaUrl === CONTENT.mediaUrl, 'and the image is left alone');
    assert(full.segmentId === audience, 'the segment is passed through');
    assert(full.tableId === undefined, 'and no table is invented alongside it');
    assert(full.scheduleDate === undefined, 'nothing is scheduled, so it sends immediately');
    assert(body(app, {}).useOnlyEngagedTokens === undefined, 'engaged only is off unless asked for');
    assert(body(app, { segment: audience }).content !== CONTENT, 'the shared content is copied, not mutated');
    assert(CONTENT.title === 'Dengage eComm Demo', 'so the default title survives an override');

    /* The audience flags are read through uuidFlag, so the pattern behind them is
       worth a check of its own. The one uuid this repository may contain is the
       sandbox application's, so it stands in for a well formed id. */
    console.log('\nAnd a malformed audience id is refused before anything else\n');
    assert(UUID.test(app.appGuid), 'a well formed id is accepted');
    assert(UUID.test(app.appGuid.toUpperCase()), 'in either case');
    assert(!UUID.test('everyone'), 'a word is refused');
    assert(!UUID.test(''), 'so is nothing at all');
    assert(!UUID.test(app.appGuid.replace(/-/g, '')), 'so is the same id without its separators');
    assert(!UUID.test(app.appGuid.slice(0, -1)), 'so is one character short');
    assert(!UUID.test(app.appGuid + '0'), 'so is one character long');
    assert(!UUID.test(` ${app.appGuid} `), 'and so is one with whitespace around it');

    console.log(`\n   ${checks - failures} passed, ${failures} failed\n`);
    if (failures) process.exit(1);
}

async function runSend() {
    const app = application();
    const payload = body(app, args);

    if (!payload.segmentId && !payload.tableId) {
        fail(
            'Name the audience with --segment <uuid> or --table <uuid>.\n' +
            '\n  There is no default, on purpose. Without one the platform decides\n' +
            '  who receives this, and the account is shared with other work.\n' +
            '\n  For a demo, build a segment in the panel that matches the demo\n' +
            '  contacts only, whose keys all start DPS-, and pass its id here.'
        );
    }
    if (payload.segmentId && payload.tableId) {
        fail('Pass either --segment or --table, not both. The platform takes one audience.');
    }

    /* Before the terminal asks anything, so that a missing credential is not
       discovered after the word that arms the send has already been typed. */
    if (args.send) requireCredentials();

    describe(app, payload);

    if (!args.send) {
        console.log('  Nothing was sent. This was a dry run.');
        console.log('  Add --send to send it.\n');
        return;
    }

    if (!process.stdin.isTTY) {
        fail(
            'This needs a terminal, because it asks before it sends.\n' +
            '  Run it directly rather than from a pipe or a scheduled job.\n' +
            '\n  Nothing has been sent.'
        );
    }

    const armed = await confirm(`  Type ${CONFIRM_WORD} to send this, or anything else to stop: `);
    if (!armed) {
        console.log('\n  Stopped. Nothing was sent.\n');
        return;
    }

    const token = await login();
    const { response, body: parsed, text } = await callOnce(PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const said = parsed && (parsed.message || parsed.actionResult);
        fail(
            `The send came back as HTTP ${response.status}` +
            (said ? `: ${said}` : `: ${text.slice(0, 300)}`) +
            '\n\n  Check the panel before trying again. A 200 is the only reply that\n' +
            '  means queued, and anything else may still have been accepted.'
        );
    }

    const trackingId = parsed && parsed.data && parsed.data.trackingId;
    console.log('\n  Queued.');
    if (trackingId) {
        console.log(`  Tracking id      ${trackingId}\n`);
        console.log('  Delivery numbers, in a moment:\n');
        console.log(`    node factory/panel/send-instant-push.mjs --report ${trackingId}\n`);
    } else {
        console.log('  The platform did not return a tracking id, so there is nothing');
        console.log('  to read a report against. The panel has the send.\n');
    }
}

async function main() {
    if (process.argv.includes('--self-test')) {
        selfTest();
        return;
    }
    if (args.report) {
        if (args.send) fail('--report reads a send. It cannot be combined with --send.');
        await runReport(args.report);
        return;
    }
    await runSend();
}

main().catch((err) => fail(err.message));
