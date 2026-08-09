#!/usr/bin/env node
/**
 * Runs a Dengage Automated Flow on demand, instead of waiting for its schedule.
 *
 *   DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
 *     node factory/panel/trigger-flow.mjs --id <flow uuid>
 *
 *   DENGAGE_FLOW_ID=... is read if --id is not given.
 *
 * WHY THIS EXISTS. The chain that puts products in front of a prospect has three
 * links and only the middle one is on a timer:
 *
 *   the factory publishes demos/<slug>/products.json
 *     -> load_dps_product('<slug>')  refreshes Postgres
 *        -> an Automated Flow copies Postgres into dps_product
 *           -> email, push and on-site read dps_product
 *
 * A daily flow is right for steady state and wrong for the case that actually
 * matters: a demo built twenty minutes before a call. Waiting until tomorrow for
 * the catalogue to arrive is not an option, so the flow gets triggered as the last
 * step of a build rather than hoped about.
 *
 * THE FLOW ID IS NOT COMMITTED, DELIBERATELY. This repository is public
 * (CLAUDE.md 9). A flow id plus credentials is the ability to run somebody's ETL,
 * so it arrives as an argument or an environment variable and is never written into
 * a file here.
 *
 * A 200 IS NOT SUCCESS ON THIS ENDPOINT. The documented response carries
 * data.HasError inside a 200, so the status code alone would report a failed flow
 * as a working one. That is the same trap as an event returning 200 and never
 * being stored, which has produced two confident and wrong "it is working" claims
 * on the reference build. Both are checked below.
 *
 * WHAT THIS CANNOT TELL YOU. It reports that the flow was ACCEPTED for execution,
 * not that rows arrived. The flow runs asynchronously, and nothing in this response
 * describes its outcome. The run history in the panel is the only proof, and
 * factory/phase0/tables.mjs --counts is the cheap second opinion: run it, trigger
 * the flow, run it again.
 */

const API_BASE = process.env.DENGAGE_API_BASE || 'https://api.dengage.com';
const LOGIN_ENDPOINT = `${API_BASE}/rest/login`;
const TRIGGER_ENDPOINT = `${API_BASE}/rest/dataspace/triggerAutomatedFlow`;

/* HIGHER THAN A HANDFUL OF REQUESTS NEEDS, because of the IP allowlist. The Dengage
   API is allowlisted per address, and a machine behind a rotating egress pool
   presents a different address per connection: a run from a session container took
   nine attempts to get one request through, and a later run of forty got none. On a
   machine with ONE fixed address every attempt uses that address, so this fails the
   same way it would have on the first try and reports the address to allowlist. */
const MAX_ATTEMPTS = 40;
const RETRY_PAUSE_MS = 800;

const args = process.argv.slice(2);
const flag = (name) => {
    const at = args.indexOf('--' + name);
    return at === -1 ? null : args[at + 1];
};

const userKey = process.env.DENGAGE_API_USERKEY;
const password = process.env.DENGAGE_API_PASSWORD;
const flowId = flag('id') || process.env.DENGAGE_FLOW_ID;

function fail(message) {
    console.error('\n  ' + message + '\n');
    process.exit(1);
}

if (!userKey || !password) {
    fail('Set DENGAGE_API_USERKEY and DENGAGE_API_PASSWORD.\n' +
         '  These are an API user created in the panel under Configuration, Users,\n' +
         '  New User, not the panel login used in a browser.');
}
/* Checked here rather than left to the API, because the documented 400 for this is
   "id need to be a guid!", which is clear but costs a round trip through an
   allowlist that may take dozens of attempts to pass. */
if (!flowId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowId)) {
    fail('Pass the flow id: --id <uuid>, or set DENGAGE_FLOW_ID.\n' +
         '  It is the Public ID on the flow\'s API Trigger node: hover the node and\n' +
         '  click to copy it.');
}

let blockedFrom = null;

async function call(url, options) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let response;
        let text;
        try {
            response = await fetch(url, options);
            text = await response.text();
        } catch (err) {
            await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
            continue;
        }
        /* 403 is the allowlist and 407 is a proxy, and only those two are worth
           another address. Everything else, a 401 included, is a real answer and
           retrying it would just be slower. */
        if (response.status === 403 || response.status === 407) {
            const found = /\b\d{1,3}(?:\.\d{1,3}){3}\b/.exec(text);
            if (found) blockedFrom = found[0];
            await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
            continue;
        }
        let body = null;
        try { body = JSON.parse(text); } catch (err) { /* not json */ }
        return { response, body, text };
    }
    return null;
}

function allowlistAdvice() {
    return 'The Dengage API refused every attempt on the address, before the\n' +
        '  credentials were checked.' +
        (blockedFrom ? ' The last one it named was ' + blockedFrom + '.' : '') +
        '\n\n' +
        '  The API is allowlisted per address. If this ran somewhere with a rotating\n' +
        '  egress pool, no single allowlist entry will hold: run it from a machine\n' +
        '  with one fixed address, and allowlist that.';
}

const auth = await call(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userkey: userKey, password: password })
});
if (!auth) fail(allowlistAdvice());
if (!auth.response.ok || !auth.body || !auth.body.access_token) {
    fail('Login failed with HTTP ' + auth.response.status + ': ' +
        ((auth.body && (auth.body.message || auth.body.actionResult)) || auth.text.slice(0, 200)));
}

const trigger = await call(TRIGGER_ENDPOINT, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + auth.body.access_token
    },
    body: JSON.stringify({ id: flowId })
});
if (!trigger) fail(allowlistAdvice());

/* THREE THINGS HAVE TO BE TRUE, and only the first is the status code. The
   documented response nests HasError inside a 200 body, so a flow that failed to
   start looks identical to one that started unless the body is read. */
const data = (trigger.body && trigger.body.data) || {};
const httpOk = trigger.response.ok;
const codeOk = !trigger.body || trigger.body.code === 0 || trigger.body.code === undefined;
const noError = data.HasError !== true;

if (!httpOk || !codeOk || !noError) {
    fail('The flow was not accepted.\n' +
        '  HTTP ' + trigger.response.status +
        (trigger.body && trigger.body.code !== undefined ? ', code ' + trigger.body.code : '') +
        (data.HasError === true ? ', HasError true' : '') + '\n' +
        '  ' + (data.ErrorMessage || (trigger.body && trigger.body.message) ||
               trigger.text.slice(0, 300)));
}

console.error('Flow accepted for execution.' +
    (trigger.body && trigger.body.transactionId
        ? '  transaction ' + trigger.body.transactionId : ''));
console.error('');
console.error('  ACCEPTED IS NOT LOADED. The flow runs asynchronously and this response');
console.error('  says nothing about its outcome. Check the run history in the panel, and');
console.error('  factory/phase0/tables.mjs --counts before and after is the cheap');
console.error('  second opinion on whether rows actually arrived.');
