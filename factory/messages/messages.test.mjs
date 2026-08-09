/* ============================================================================
   Tests for the short form content pack.

     node factory/messages/messages.test.mjs

   THE LIMIT CHECKER IS TESTED IN BOTH DIRECTIONS, because a checker that cannot
   fail is the most dangerous thing in this directory: every build would report
   "all within limits" and a truncated push title would ship. So the suite plants
   copy that is deliberately too long and requires the checker to catch it.

   THE OTHER THREE THINGS WORTH ASSERTING:

   SMS is counted the way Dengage charges it, where a non-ANSI character costs
   two. An emoji in an SMS is therefore a length bug, not a style choice, and
   every SMS is checked for one.

   WhatsApp has two rules that cost an approval round rather than a send: a button
   label over 25 characters, and a product link as the first or last variable in
   the body. Both are enforced at submission, so catching them here is the only
   cheap place.

   On-site copy must stay generic. Those creatives are shared by every live demo,
   so a product name or a price in one of them appears on every demo at once,
   including demos already in front of a prospect.
   ========================================================================== */

import { CHANNELS, CHANNEL_ORDER, measure, resolved, smsCost, textCost } from './channels.mjs';
import { JOURNEY_COPY } from './copy.mjs';

/* THREE JOURNEYS CANNOT BE BUILT, AND EVERY LOOP BELOW HAS TO KNOW THAT. Cart
   abandonment, wishlist triggers and replenishment all name a product in their copy,
   and no Dengage table carries a product name: factory/phase0/SCHEMA.md. copy.mjs
   throws rather than emitting a tag that resolves to nothing, so a loop calling
   channels() blindly dies on the first of them and takes the assertions for the other
   seven with it.

   built() returns null for a blocked journey instead. Counted once at the end, so the
   suite reports how many were skipped rather than appearing to have checked ten. */
let blockedCount = 0;
function built(entry, mode, context) {
    try {
        return entry.channels(mode, context);
    } catch (err) {
        if (!/no column for/.test(err.message)) throw err;
        return null;
    }
}

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}
function is(label, actual, expected) { ok(label, actual === expected, { actual, expected }); }

const ctx = {
    storeUrl: 'https://dengage-presales.github.io/demo-ai/demos/fixture/',
    storeName: 'Fixture', symbol: 'Rs',
    sampleFirstName: 'Alex', sampleProduct: 'Alpha Keyboard',
    samplePrice: 'Rs 2,400.00', sampleCategory: 'Keyboards',
    sampleQuery: 'alpha keyboard', sampleImage: 'x.jpg', products: []
};

/* -------------------------------------------------------------------------- */
/* 1. The counters                                                             */

{
    is('plain text counts characters', textCost('hello'), 5);
    is('an ANSI SMS costs one per character', smsCost('hello'), 5);
    /* The rule that makes emoji expensive, straight from Dengage's own wording. */
    ok('a non-ANSI character costs two in SMS', smsCost('aé') === 3, smsCost('aé'));
    ok('an emoji costs more than a letter', smsCost('\u{1F600}') > 1, smsCost('\u{1F600}'));

    /* A tag is measured by what it resolves to, not by its own length. */
    const tag = '{% if ($Contact.first_name) { %}{%= $Contact.first_name =%}{% } else { %}there{% } %}';
    const out = resolved(tag);
    ok('a tag resolves to a realistic name rather than its own template',
       out === 'Christopher', out);
    ok('and the resolved form is shorter than the template',
       textCost(out) < textCost(tag), { resolved: textCost(out), template: textCost(tag) });
}

/* -------------------------------------------------------------------------- */
/* 2. The checker catches copy that is too long                                */

{
    const long = 'A push notification title that is very obviously far too long to fit in a shade';
    const result = measure(CHANNELS.webPush, 'title', long);
    ok('an overlong push title is caught', result.over === true, result);
    is('and the limit it failed is reported', result.max, CHANNELS.webPush.limits.title.max);
    ok('with where the limit came from', result.source === 'client', result.source);

    const fine = measure(CHANNELS.webPush, 'title', 'Still thinking about it?');
    ok('a title that fits is not flagged', fine.over === false, fine);

    /* THE CASE THAT PROVES THE TAG ALLOWANCE MATTERS. This title fits when the
       name is short and overruns when it is long, which is exactly the failure a
       naive counter misses. */
    const risky = 'Your basket is waiting for you, {% if ($Contact.first_name) { %}' +
                  '{%= $Contact.first_name =%}{% } else { %}there{% } %}, come back';
    const riskyResult = measure(CHANNELS.webPush, 'title', risky);
    ok('a title that only fits for short names is caught', riskyResult.over === true,
       { cost: riskyResult.cost, max: riskyResult.max, resolved: riskyResult.resolvedTo });

    /* An SMS at the boundary, counted Dengage's way. */
    const smsLimit = CHANNELS.sms.limits.body.max;
    ok('an SMS of ANSI characters at the limit passes',
       measure(CHANNELS.sms, 'body', 'a'.repeat(smsLimit)).over === false);
    ok('and the same length in emoji does not',
       measure(CHANNELS.sms, 'body', '\u{1F600}'.repeat(smsLimit / 2 + 1)).over === true);
}

/* -------------------------------------------------------------------------- */
/* 3. Every real message is within its limits                                   */

{
    const problems = [];
    let count = 0;
    for (const mode of ['panel', 'preview']) {
        for (const entry of JOURNEY_COPY) {
            const channels = built(entry, mode, ctx);
            if (!channels) continue;
            for (const id of Object.keys(channels)) {
                const channel = CHANNELS[id];
                ok('channel ' + id + ' is a known channel', Boolean(channel));
                if (!channel) continue;
                count++;
                const content = channels[id];
                for (const field of Object.keys(channel.limits)) {
                    const text = content[field] !== undefined ? content[field]
                        : (field === 'header' && content.headerText) ? content.headerText : null;
                    if (typeof text !== 'string') continue;
                    const result = measure(channel, field, text);
                    if (result && result.over) {
                        problems.push(mode + ' ' + entry.id + '/' + id + '/' + field +
                            ' ' + result.cost + '>' + result.max);
                    }
                }
                for (const button of content.buttons || []) {
                    const limit = channel.limits.buttonLabel ||
                        (channel.buttons && channel.buttons.label) || {};
                    if (limit.max !== undefined && [...button.label].length > limit.max) {
                        problems.push(mode + ' ' + entry.id + '/' + id + ' button "' +
                            button.label + '" over ' + limit.max);
                    }
                }
            }
        }
    }
    ok('every field of every message is within its limit', problems.length === 0, problems);
    /* MEASURED AGAINST WHAT CAN BUILD, NOT AGAINST A NUMBER. This used to require 50
       messages, which was ten journeys times both modes times the channels each uses.
       Three journeys are now blocked on the product feed, so a fixed floor would have
       to be lowered until it passed, and a threshold tuned to whatever the code
       currently produces asserts nothing. Per buildable journey it still means
       something: a journey that quietly lost its channels fails this. */
    const buildable = JOURNEY_COPY.filter((entry) => built(entry, 'panel', ctx)).length;
    ok('every journey that can build carries at least two channels',
       count >= buildable * 2 * 2, { count, buildable });
}

/* -------------------------------------------------------------------------- */
/* 4. Channel specific rules                                                   */

{
    for (const entry of JOURNEY_COPY) {
        const channels = built(entry, 'panel', ctx);
        if (!channels) continue;

        /* SMS: no emoji, and an opt out is mandatory. */
        if (channels.sms) {
            const body = channels.sms.body;
            ok(entry.id + ' SMS carries no non-ANSI character',
               smsCost(resolved(body)) === textCost(resolved(body)),
               { sms: smsCost(resolved(body)), plain: textCost(resolved(body)) });
            ok(entry.id + ' SMS carries the documented opt out',
               body.includes(CHANNELS.sms.unsubscribeTag) ||
               body.includes(CHANNELS.sms.brandUnsubscribeTag));
        }

        /* WhatsApp: a real category and message type, and Dengage's button rule. */
        if (channels.whatsapp) {
            const wa = channels.whatsapp;
            ok(entry.id + ' WhatsApp names a real category',
               CHANNELS.whatsapp.categories.includes(wa.category), wa.category);
            ok(entry.id + ' WhatsApp names a real message type',
               CHANNELS.whatsapp.messageTypes.includes(wa.messageType), wa.messageType);
            /* Only Blank Content exists for Utility, per Dengage. */
            if (wa.category === 'Utility') {
                is(entry.id + ' a Utility template uses Blank Content', wa.messageType, 'Blank Content');
            }
            ok(entry.id + ' WhatsApp has at most ten buttons',
               (wa.buttons || []).length <= CHANNELS.whatsapp.buttons.max);
            /* A product link may not be the first or last variable in the body. The
               copy avoids putting any URL in the body at all, which satisfies the
               rule by construction and is the simplest way not to break it. */
            ok(entry.id + ' WhatsApp keeps links out of the body, so no link is first or last',
               !/https?:\/\//.test(wa.body), wa.body.slice(0, 40));
        }

        /* Inbox: Dengage caps expiry at seven days and priority at one to five. */
        if (channels.inbox) {
            const inbox = channels.inbox;
            ok(entry.id + ' inbox expiry is within the seven day maximum',
               inbox.expiryDays >= 1 && inbox.expiryDays <= CHANNELS.inbox.limits.expiryDays.max,
               inbox.expiryDays);
            ok(entry.id + ' inbox priority is one to five',
               inbox.priority >= 1 && inbox.priority <= 5, inbox.priority);
        }

        /* On-site: shared by every demo, so the words stay generic. */
        if (channels.onsite) {
            const words = [channels.onsite.heading, channels.onsite.body, channels.onsite.cta].join(' ');
            ok(entry.id + ' on-site copy names no product',
               !words.includes(ctx.sampleProduct), words.slice(0, 50));
            ok(entry.id + ' on-site copy names no price or currency',
               !/\d[\d,.]*\s*(Rs|\$|£|€|₹)|(?:Rs|\$|£|€|₹)\s*\d/.test(words), words.slice(0, 50));
            ok(entry.id + ' on-site copy carries no personalisation tag',
               !/\{%|\{\{/.test(words), words.slice(0, 50));
            ok(entry.id + ' on-site names the template to use',
               typeof channels.onsite.template === 'string' && channels.onsite.template.length > 3);
        }
    }
}

/* -------------------------------------------------------------------------- */
/* 5. Panel mode personalises; preview mode resolves                           */

{
    let queried = 0;
    let tagged = 0;
    const tablesRead = new Set();
    for (const entry of JOURNEY_COPY) {
        const panelRaw = built(entry, 'panel', ctx);
        if (!panelRaw) continue;
        const panel = JSON.stringify(panelRaw);
        const preview = JSON.stringify(built(entry, 'preview', ctx));
        if (panel.includes('$from(')) queried++;
        for (const hit of panel.matchAll(/\$from\(\\?"([a-z_]+)\\?"\)/g)) {
            tablesRead.add(hit[1]);
        }
        if (panel.includes('{%')) tagged++;
        /* A preview may still carry {{unsubscribe-link}} and {{shortlink}}, which
           are panel-side literals rather than resolved values, so only the
           scripting syntax has to be gone. */
        ok(entry.id + ' preview resolves the scripting tags', !preview.includes('{%'),
           (preview.match(/\{%[^%]*%\}/g) || []).slice(0, 2));
    }
    /* PINNED, NOT THRESHOLDED, and the difference matters. Three of ten journeys are
       blocked on the product feed, so any fraction here would have to be chosen to fit
       what the code currently emits, which asserts nothing at all.

       The set of tables actually read is a fact instead. Two today, because the
       journeys that would read shopping_cart_events, wishlist_events and
       order_events_detail are exactly the three that name a product. When the feed is
       registered and those come back, this fails and asks to be updated, which is the
       reminder worth having. */
    const canBuild = JOURNEY_COPY.filter((entry) => built(entry, 'panel', ctx)).length;
    ok('the tables the buildable journeys read are the ones expected',
       [...tablesRead].sort().join(',') === 'page_view_events,search_events',
       { read: [...tablesRead].sort(), canBuild });
    ok('every journey that builds and queries also carries a tag',
       tagged >= queried, { tagged, queried });
    ok('most journeys that build personalise at all',
       tagged >= Math.ceil(canBuild / 2), { tagged, canBuild });
}

/* -------------------------------------------------------------------------- */
/* The deck's copy button must hand over the PANEL copy, not what is on screen   */

{
    const { panelFields } = await import('./build-messages.mjs');

    /* FOUND RATHER THAN NAMED, because a hardcoded journey and channel makes this
       test a hostage to the copy. Pointed at one that happens not to use a first
       name, the three assertions below pass trivially and prove nothing. So the pair
       is chosen by the property being tested: the first channel anywhere in the pack
       whose two modes actually differ. */
    let panelOut = '';
    let previewOut = '';
    let where = '';
    for (const entry of JOURNEY_COPY) {
        const panel = built(entry, 'panel', ctx);
        const preview = built(entry, 'preview', ctx);
        if (!panel || !preview) continue;
        for (const id of Object.keys(panel)) {
            const a = panelFields(id, panel[id]);
            const b = panelFields(id, preview[id]);
            if (a !== b && b.includes(ctx.sampleFirstName) && !where) {
                panelOut = a; previewOut = b; where = entry.id + ' / ' + id;
            }
        }
    }
    ok('at least one channel personalises by name', where !== '', where);

    /* THE FAILURE THIS CATCHES IS SILENT AND TOTAL. Copying the preview instead of the
       panel copy pastes a message that looks perfect and never personalises: the
       sample name is baked in where the tag should be. Nothing downstream would
       notice, because both strings are valid copy. */
    /* Every line, not a named field: the channels do not share a field list. A push
       has a title and a body, WhatsApp has a category, a header, a body and a footer,
       and an assertion naming any of them tests the copy rather than the format. */
    ok('every line is labelled so it maps onto a box in the content record',
       panelOut.split('\n').filter(Boolean).every((line) => /^[a-zA-Z]+: ./.test(line)),
       panelOut.slice(0, 120));
    ok('the panel copy and the preview copy are not the same string',
       panelOut !== previewOut);
    ok('the preview copy resolves the sample name',
       previewOut.includes(ctx.sampleFirstName));
    ok('and the panel copy carries the tag instead',
       panelOut.includes('$Contact.first_name') && !panelOut.includes(ctx.sampleFirstName));
}

blockedCount = JOURNEY_COPY.filter((entry) => built(entry, 'panel', ctx) === null).length;
ok('the journeys that name a product are blocked rather than half built', blockedCount === 3,
   { blocked: blockedCount });
console.log('   SKIP  ' + blockedCount + ' journey(s) name a product, which no table carries.');
console.log('         factory/phase0/SCHEMA.md. Their assertions did not run.');

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
