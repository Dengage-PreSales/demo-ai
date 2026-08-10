/* ============================================================================
   The scenario emails: what each one reads, what it folds those rows into, and what it
   says.

   THE RULE THAT GOVERNS THIS WHOLE FILE. **No fold may name a column that
   factory/phase0/columns.mjs does not declare.** The previous set of ten journey emails
   was deleted on 10 August 2026 for exactly one reason: three of them asked an event
   table for a product name, no event table has ever had one, and the builder refused
   rather than sending an email with an empty row in it. So the set produced nothing for
   any demo for as long as it existed. Every column below was read off a real table.
   scenarios.test.mjs asserts the rule mechanically rather than trusting this paragraph.

   WHAT MAKES ONE OF THESE PERSONAL. Not a first name: a demo sends `contactKey` and no
   attributes, so `$Contact.first_name` is empty for every contact a demo creates and a
   subject line with a name in it renders as "Hi ," on a call. What a demo genuinely has
   is behaviour, and dps_product turns a behaviour into something a recipient recognises:
   the product they abandoned, the term they searched, the thing they saved that is now
   cheaper, the order they placed. That is the personalisation, and it is real.

   WHAT MAKES ONE OF THESE ADAPT TO A DEMO. `dps_product.link` and `image_link` are
   absolute, and the resolution block works out which demo the contact's newest row
   belongs to. So one email serves every demo that exists now and every demo built later,
   with nothing to rebuild and nothing to configure. The shell names no storefront for the
   same reason the abandoned cart email does not: it is fixed at build time and its
   contents are not.

   THREE OF THE TEN JOURNEYS ARE DELIBERATELY NOT HERE.

     Identity capture   a welcome email has no behaviour to draw on yet. What it could
                        show is what Browse abandonment already shows, better.
     RFM lifecycle      recency, frequency and monetary value are a SEGMENT. $from has no
                        aggregation, so the email cannot compute them, and once a segment
                        has, the email it wants is Win-back's.
     Cart abandonment   built, and shipped, as the shared Email Builder template. See
                        factory/emails/BEEFREE.md.
   ========================================================================== */

import { COLUMNS } from '../phase0/columns.mjs';
import { CART, VIEW, SAVED, ORDER, SEARCH } from './folds.mjs';
import {
    band, masthead, footer, eyebrow, headline, lede, note,
    factStrip, cardGrid, heroCard, totals, button
} from './scenario-html.mjs';

/* Column names taken from the declarations rather than typed here, so a scenario cannot
   drift from the schema without schema.test.mjs failing first. */
const C = COLUMNS;

/* -------------------------------------------------------------------------- */
/* Extensions. The five folds themselves live in folds.mjs, because the SMS and push       */
/* assets need the same five and a second copy of the cart replay is how this repository   */
/* has shipped its worst defects. What is below is only what a scenario adds to one.       */

/* The totals, over every product looked up rather than every card shown. `priced` gates
   the whole block: one missing or non positive price suppresses it, because Number(null)
   is 0 and a basket that looks cheaper is entirely plausible. */
const CART_TOTALS = `
var subtotal = 0;
var discount = 0;
var counted = 0;
var priced = true;
for (var x = 0; ids.length > x; x++) {
  var item = byId[ids[x]];
  if (!item || !item.is_active) { continue; }
  var qty = (ctx.present[ids[x]] && ctx.present[ids[x]].quantity) ? Number(ctx.present[ids[x]].quantity) : 1;
  if (!isFinite(qty) || 1 > qty) { qty = 1; }
  var fullN = Number(item.${C.product.price});
  if (!isFinite(fullN) || 0 >= fullN) { priced = false; break; }
  var nowN = fullN;
  if (item.${C.product.discounted} != null && String(item.${C.product.discounted}) !== "") {
    var cutN = Number(item.${C.product.discounted});
    if (!isFinite(cutN) || 0 >= cutN) { priced = false; break; }
    if (fullN > cutN) { nowN = cutN; }
  }
  subtotal = subtotal + (fullN * qty);
  discount = discount + ((fullN - nowN) * qty);
  counted = counted + qty;
}
if (all.length > ids.length) { priced = false; }
if (counted === 0) { priced = false; }
ctx.items = counted;`;

/* -------------------------------------------------------------------------- */

export const SCENARIOS = [
    {
        id: 'checkout',
        journey: 'Checkout rescue',
        table: C.cart.table,
        cap: 20,
        show: 4,
        fold: CART,
        extra: CART_TOTALS,
        subject: 'You were one step away',
        preheader: 'Your basket is still saved, and checkout is one press away.',
        /* THE BASKET AND THE TOTAL, AND ONE BUTTON. A checkout rescue is not a browsing
           email: the recipient has already chosen, so more products would be a distraction
           rather than a service. Four cards, the real total, and the way back. */
        body: (p) => [
            band(p,
                eyebrow(p, 'Checkout') +
                headline(p, 'You were one step away') +
                lede(p, 'Everything you chose is still in your basket, exactly as you left it.'),
                { top: 36, bottom: 26 }),
            band(p, cardGrid(p), { top: 0, bottom: 6 }),
            band(p, totals(p) +
                '{% if (priced) { %}<div style="height:22px;line-height:22px;">&nbsp;</div>{% } %}' +
                button(p, 'Finish checkout', "root + 'index.html?open=checkout'",
                    { label: 'or look at your basket first', href: "root + 'index.html?open=cart'" }),
                { ground: p.wash, top: 26, bottom: 28 }),
            band(p, note(p, 'Prices and availability can change, and a basket is not a reservation.'),
                { top: 24, bottom: 30 })
        ]
    },

    {
        id: 'browse',
        journey: 'Browse abandonment',
        table: C.view.table,
        cap: 12,
        show: 4,
        fold: VIEW,
        subject: 'Still thinking about it?',
        preheader: 'The pieces you were looking at, in one place.',
        /* THE CATEGORY IS THE ONLY THING THIS SCENARIO KNOWS THAT THE OTHERS DO NOT, so it
           is in the headline when there is one and the headline is generic when there is
           not. A view of a listing page carries no product, so a contact can genuinely
           have a category and no products. */
        body: (p) => [
            band(p,
                eyebrow(p, 'Recently viewed') +
                '{% if (ctx.category !== "") { %}' +
                headline(p, 'More in {%= ctx.category %}') +
                '{% } else { %}' +
                headline(p, 'Picking up where you left off') +
                '{% } %}' +
                lede(p, 'You were looking at these. They are still here.'),
                { top: 36, bottom: 26 }),
            band(p, cardGrid(p), { top: 0, bottom: 6 }),
            band(p,
                '{% if (ctx.category !== "") { %}' +
                button(p, 'See more in {%= ctx.category %}',
                    "root + 'index.html?category=' + encodeURIComponent(ctx.category)",
                    { label: 'or browse everything', href: "root + 'index.html'" }) +
                '{% } else { %}' +
                button(p, 'Keep browsing', "root + 'index.html'") +
                '{% } %}',
                { ground: p.wash, top: 26, bottom: 28 })
        ]
    },

    {
        id: 'search',
        journey: 'Failed search recovery',
        table: C.search.table,
        cap: 12,
        show: 4,
        /* THE ONE FOLD THAT SEARCHES THE CATALOGUE ITSELF, because $from has no `like` and
           no aggregation: it offers where, take and get. So the match is done in
           JavaScript over the rows it returns, which is the same shape the
           recommendations asset uses for its trending pass.

           IT IS SCOPED TO THE DEMO BY `link`, not by a column, because dps_product holds
           every demo's products in one table and `link` is absolute.

           IT PADS ONLY WHEN NOTHING MATCHED AT ALL, and the "only" is the point. An email
           about a failed search that then shows nothing is the failure twice, so a zero
           match send falls back to the catalogue and says so. Padding a send that found ONE
           real match would put unrelated products under a headline claiming they match, and
           one honest card beats four with a false caption.

           IT READS `ctx.term` RATHER THAN THE FOLD'S OWN `term`, and everything after a
           fold does the same. Both are in scope, because the two halves are concatenated
           into one function body, but ctx is the documented handover and a local name is
           not: folds.mjs is free to rename its counters and this has to keep working. */
        fold: SEARCH + `
var pool = (ctx.term !== "" && root !== "")
  ? $from('$db.${C.product.table}').where('${C.product.active}', '=', true).take(1000).get()
  : [];
var here = [];
for (var q = 0; pool.length > q; q++) {
  var prow = pool[q] || {};
  var plink = String(prow.${C.product.link} == null ? "" : prow.${C.product.link});
  if (plink.indexOf(root) !== 0) { continue; }
  here.push(prow);
}
var needle = ctx.term.toLowerCase();
var hits = [];
for (var h = 0; here.length > h; h++) {
  var hay = (String(here[h].${C.product.name} == null ? "" : here[h].${C.product.name}) + ' ' +
             String(here[h].${C.product.category} == null ? "" : here[h].${C.product.category})).toLowerCase();
  if (hay.indexOf(needle) !== -1) { hits.push(String(here[h].${C.product.id})); }
}
hits.sort();
ctx.matched = hits.length;
for (var i2 = 0; hits.length > i2; i2++) {
  if (all.indexOf(hits[i2]) === -1) { all.push(hits[i2]); }
}
if (ctx.matched === 0) {
  var seedBase = 0;
  for (var c2 = 0; ctx.term.length > c2; c2++) { seedBase = (seedBase * 31 + ctx.term.charCodeAt(c2)) % 100003; }
  var spare = [];
  for (var s2 = 0; here.length > s2; s2++) { spare.push(String(here[s2].${C.product.id})); }
  spare.sort(function (a, b) {
    var ha = (seedBase + a.length * 7 + a.charCodeAt(0)) % 1000;
    var hb = (seedBase + b.length * 7 + b.charCodeAt(0)) % 1000;
    if (ha !== hb) { return ha - hb; }
    return b > a ? -1 : (a > b ? 1 : 0);
  });
  for (var s3 = 0; spare.length > s3; s3++) {
    if (all.indexOf(spare[s3]) === -1) { all.push(spare[s3]); }
  }
}`,
        subject: 'About what you were looking for',
        preheader: 'A few things close to your search.',
        body: (p) => [
            band(p,
                eyebrow(p, 'Your search') +
                '{% if (ctx.matched > 0) { %}' +
                headline(p, 'Found for &ldquo;{%= ctx.term %}&rdquo;') +
                lede(p, 'These match what you searched for.') +
                '{% } else { %}' +
                headline(p, 'Nothing for &ldquo;{%= ctx.term %}&rdquo;, yet') +
                /* NOT "these are close". When nothing matched, the fold falls back to the
                   catalogue in its own order, so the products below are popular rather than
                   related, and saying otherwise is a claim the data does not support. The
                   two branches show the same cards and must not say the same thing about
                   them. */
                lede(p, 'That search came back empty. Here is what other people are picking up.') +
                '{% } %}',
                { top: 36, bottom: 22 }),
            '{% if (ctx.term !== "") { %}' +
                factStrip(p, 'You searched for', '{%= ctx.term %}') + '{% } %}',
            band(p, cardGrid(p), { top: 26, bottom: 6 }),
            band(p, button(p, 'Search again', "root + 'index.html?open=search'"),
                { ground: p.wash, top: 26, bottom: 28 })
        ]
    },

    {
        id: 'wishlist',
        journey: 'Wishlist triggers',
        table: C.wishlist.table,
        cap: 24,
        show: 4,
        /* `add` AND `remove`, NOT add_to_wishlist. Read out of
           template/js/dengageEvents.js, which takes the vocabulary from the SDK. A fold
           written against the names a person would guess resolves every saved item and
           never removes one.

           IT LOOKS THE PRICES UP INSIDE THE FOLD, which the other scenarios do not need
           to, and that is what lets a genuine price drop lead the email: the saved row
           carries the price AT THE TIME OF SAVING, dps_product carries the price now, and
           the difference between two real numbers is the only honest way to claim one.
           Nothing here invents a percentage or a deadline. */
        fold: SAVED + `
var saved = all.slice(0);
all.length = 0;
ctx.saved = saved.length;

var look = saved.length
  ? $from('$db.${C.product.table}').where('${C.product.id}', 'in', saved.slice(0, 24)).take(24).get()
  : [];
var nowBy = {};
for (var n = 0; look.length > n; n++) {
  if (look[n] && look[n].${C.product.id}) { nowBy[String(look[n].${C.product.id})] = look[n]; }
}

var dropped = [];
var rest = [];
ctx.lowStock = 0;
ctx.was = {};
for (var w = 0; saved.length > w; w++) {
  var item = nowBy[saved[w]];
  if (!item || !item.${C.product.active}) { continue; }
  var savedAtN = Number(ctx.savedAt[saved[w]].was);
  var nowN = Number(item.${C.product.price});
  if (item.${C.product.discounted} != null && String(item.${C.product.discounted}) !== "") {
    var cutN = Number(item.${C.product.discounted});
    if (isFinite(cutN) && cutN > 0 && nowN > cutN) { nowN = cutN; }
  }
  var st = Number(item.${C.product.stock});
  if (isFinite(st) && st > 0 && 3 >= st) { ctx.lowStock = ctx.lowStock + 1; }
  if (isFinite(savedAtN) && savedAtN > 0 && isFinite(nowN) && nowN > 0 && savedAtN > nowN) {
    ctx.was[saved[w]] = savedAtN;
    dropped.push(saved[w]);
  } else {
    rest.push(saved[w]);
  }
}
ctx.dropped = dropped.length;
for (var d2 = 0; dropped.length > d2; d2++) { all.push(dropped[d2]); }
for (var r2 = 0; rest.length > r2; r2++) { all.push(rest[r2]); }`,
        subject: 'Something you saved',
        preheader: 'Your saved items, and what changed since you saved them.',
        /* THREE HEADLINES ON ONE PIECE OF EVIDENCE EACH, and the strongest wins. A price
           that fell is a fact about two columns; low stock is a fact about one; otherwise
           the email says only that the items are still saved, which is also a fact. */
        body: (p) => [
            band(p,
                '{% if (ctx.dropped > 0) { %}' +
                eyebrow(p, 'Price drop') +
                headline(p, 'The price fell on something you saved') +
                lede(p, 'It is cheaper now than when you saved it.') +
                '{% } else if (ctx.lowStock > 0) { %}' +
                eyebrow(p, 'Running low') +
                headline(p, 'Something you saved is running low') +
                lede(p, 'Stock is limited on at least one of your saved items.') +
                '{% } else { %}' +
                eyebrow(p, 'Saved items') +
                headline(p, 'Still saved for you') +
                lede(p, 'Everything you put aside is here whenever you want it.') +
                '{% } %}',
                { top: 36, bottom: 26 }),
            /* THE DROPPED ITEM ALONE AND LARGE, then the rest of the saved list under a
               quiet heading, because a one product email about a four item wishlist is
               leaving three real things unsaid. When nothing dropped there is no single
               subject, so it is the grid on its own. */
            '{% if (ctx.dropped > 0) { %}' +
                band(p, heroCard(p, { was: 'ctx.was[card.id]' }), { top: 0, bottom: 26 }) +
                '{% if (view.length > 1) { %}' +
                band(p,
                    '<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;' +
                    'color:' + p.quiet + ';padding:0 0 18px 0;">Also still saved</div>' +
                    '{% var keepView = view; view = view.slice(1); %}' + cardGrid(p) +
                    '{% view = keepView; %}',
                    { top: 0, bottom: 6 }) +
                '{% } %}' +
                '{% } else { %}' + band(p, cardGrid(p), { top: 0, bottom: 6 }) + '{% } %}',
            band(p, button(p, 'Open your saved items', "root + 'index.html?open=wishlist'"),
                { ground: p.wash, top: 26, bottom: 28 })
        ]
    },

    {
        id: 'basket',
        journey: 'Basket building',
        table: C.cart.table,
        cap: 12,
        show: 4,
        /* THE ONE THAT SHOWS WHAT IS NOT IN THE BASKET, which is why the fold looks the
           basket up and then queries again by category. Same shape as the
           recommendations asset's "More like this" pass, and scoped to this demo by
           `link` for the same reason. */
        fold: CART + `
var basket = all.slice(0);
ctx.basket = basket.length;
all.length = 0;

var mineRows = basket.length
  ? $from('$db.${C.product.table}').where('${C.product.id}', 'in', basket.slice(0, 24)).take(24).get()
  : [];
var wanted = [];
ctx.category = "";
for (var b = 0; mineRows.length > b; b++) {
  var path = String(mineRows[b].${C.product.category} == null ? "" : mineRows[b].${C.product.category}).replace(/^\\s+|\\s+$/g, "");
  if (path !== "" && wanted.indexOf(path) === -1) { wanted.push(path); }
}
wanted.sort();
if (wanted.length) {
  ctx.category = wanted[0].split('>').pop().replace(/^\\s+|\\s+$/g, "");
}

var near = wanted.length
  ? $from('$db.${C.product.table}').where('${C.product.category}', 'in', wanted).take(200).get()
  : [];
var offered = [];
for (var o2 = 0; near.length > o2; o2++) {
  var cand = near[o2] || {};
  var cid = String(cand.${C.product.id} == null ? "" : cand.${C.product.id});
  if (cid === "" || basket.indexOf(cid) !== -1) { continue; }
  if (!cand.${C.product.active}) { continue; }
  var clink = String(cand.${C.product.link} == null ? "" : cand.${C.product.link});
  if (root === "" || clink.indexOf(root) !== 0) { continue; }
  if (offered.indexOf(cid) === -1) { offered.push(cid); }
}
offered.sort();
for (var f2 = 0; offered.length > f2; f2++) { all.push(offered[f2]); }`,
        subject: 'Goes with what you picked',
        preheader: 'A few things that pair with your basket.',
        body: (p) => [
            band(p,
                eyebrow(p, 'Pairs well') +
                '{% if (ctx.category !== "") { %}' +
                headline(p, 'Goes with your {%= ctx.category %}') +
                '{% } else { %}' +
                headline(p, 'Goes with what you picked') +
                '{% } %}' +
                lede(p, 'From the same part of the range as what is already in your basket.'),
                { top: 36, bottom: 26 }),
            band(p, cardGrid(p), { top: 0, bottom: 6 }),
            band(p, button(p, 'Back to your basket', "root + 'index.html?open=cart'",
                { label: 'or keep browsing', href: "root + 'index.html'" }),
                { ground: p.wash, top: 26, bottom: 28 })
        ]
    },

    {
        id: 'replenish',
        journey: 'Replenishment',
        table: C.orderLine.table,
        cap: 12,
        show: 4,
        /* THE NEWEST ORDER'S LINES, and nothing about timing. A replenishment email
           usually claims you are about to run out, which needs a consumption rate nothing
           here has. What is true is what was bought and that reordering is one press, so
           that is what it says. The campaign's own trigger owns the timing. */
        fold: ORDER,
        subject: 'Order it again in one press',
        preheader: 'What you bought last time, ready to reorder.',
        body: (p) => [
            band(p,
                eyebrow(p, 'Buy it again') +
                headline(p, 'Order it again in one press') +
                lede(p, 'What you bought last time. Nothing to search for.'),
                { top: 36, bottom: 22 }),
            '{% if (ctx.order !== "") { %}' +
                factStrip(p, 'Your last order', '{%= ctx.order %}') + '{% } %}',
            band(p, cardGrid(p), { top: 26, bottom: 6 }),
            band(p, button(p, 'Reorder now', "root + 'index.html'",
                { label: 'or see your account', href: "root + 'index.html?open=account'" }),
                { ground: p.wash, top: 26, bottom: 28 })
        ]
    },

    {
        id: 'winback',
        journey: 'Win-back',
        table: C.view.table,
        cap: 12,
        show: 6,
        /* THE ONLY SCENARIO WITH NOTHING PERSONAL IN ITS BODY, and it says nothing
           personal. A win-back usually opens by telling you how long it has been, which
           this could compute and should not: the campaign's trigger is what decided the
           contact qualifies, and an email that restates the trigger's threshold is an
           email that goes wrong the day the threshold changes.

           It still reads page_view_events, because that is the only way to know which
           demo to send them back to. The products are the demo's own catalogue, ordered
           by the same seeded shuffle the storefront's Trending now rail uses, so the
           email and the page agree. */
        fold: VIEW + `
all.length = 0;
var pool = root !== ""
  ? $from('$db.${C.product.table}').where('${C.product.active}', '=', true).take(1000).get()
  : [];
var mine = [];
for (var q = 0; pool.length > q; q++) {
  var prow = pool[q] || {};
  var plink = String(prow.${C.product.link} == null ? "" : prow.${C.product.link});
  if (plink.indexOf(root) !== 0) { continue; }
  mine.push(String(prow.${C.product.id}));
}
var seedBase = 0;
for (var c2 = 0; target.length > c2; c2++) { seedBase = (seedBase * 31 + target.charCodeAt(c2)) % 100003; }
mine.sort(function (a, b) {
  var ha = (seedBase + a.length * 7 + a.charCodeAt(0)) % 1000;
  var hb = (seedBase + b.length * 7 + b.charCodeAt(0)) % 1000;
  if (ha !== hb) { return ha - hb; }
  return b > a ? -1 : (a > b ? 1 : 0);
});
for (var m2 = 0; mine.length > m2; m2++) { all.push(mine[m2]); }`,
        subject: 'New in, and worth a look',
        preheader: 'A few of the things people are picking up right now.',
        body: (p) => [
            band(p,
                eyebrow(p, 'Trending now') +
                headline(p, 'Worth another look') +
                lede(p, 'A few of the things moving fastest in the range right now.'),
                { top: 36, bottom: 26 }),
            band(p, cardGrid(p), { top: 0, bottom: 6 }),
            band(p, button(p, 'See the range', "root + 'index.html'"),
                { ground: p.wash, top: 26, bottom: 28 })
        ]
    }
];

export { masthead, footer, band, note };
