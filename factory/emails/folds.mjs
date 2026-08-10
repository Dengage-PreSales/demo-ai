/* ============================================================================
   One fold per event table, shared by the scenario emails and the short form snippets.

     import { FOLDS } from './folds.mjs';
     resolveBlock({ table: FOLDS.cart.table, fold: FOLDS.cart.fold })

   WHY PER TABLE AND NOT PER SCENARIO. There are seven scenarios and five tables, and the
   tables are what the data supports. Checkout rescue and basket building both read the
   cart; browse abandonment and win-back both read page views. Writing a fold per scenario
   meant the cart replay existed three times, which is the piece of logic in this
   repository that has shipped the most defects and can least afford three copies.

   SO A FOLD ANSWERS ONE QUESTION PER TABLE: which product ids does this contact have
   here, newest first. What a scenario then does with them is the scenario's business, and
   the ones that need more (a total, a cross sell, a price drop) add it in their own extra
   block rather than in here.

   THE SAME FIVE SERVE SMS AND PUSH, which is what keeps the panel work small. A snippet
   for SMS needs exactly this and nothing else: the newest product's name and how many
   others there are. factory/build-snippets.mjs emits one line asset and one image asset
   per table from these, which is ten objects to create instead of twenty one.

   EVERY COLUMN NAME COMES FROM factory/phase0/columns.mjs, and no fold may name one that
   is not declared there. The previous set of journey emails was deleted for breaking
   exactly that rule. scenarios.test.mjs and snippets.test.mjs both assert it.

   NO `<` CHARACTER ANYWHERE. Dengage validates an AMP email's markup before running the
   engine, so a comparison written the usual way opens an HTML tag that never closes. Every
   comparison here puts the larger side first. resolve.mjs says more about why.
   ========================================================================== */

import { COLUMNS } from '../phase0/columns.mjs';

const C = COLUMNS;

/* THE CART REPLAY. delete_cart empties the basket, a removal is not an item, and an add
   after a removal brings it back. Rows arrive sorted oldest first, so folding forward is
   what makes the replay correct, and reading the newest rows instead is the first defect
   this logic ever shipped. */
const CART = `
var present = {};
var seen = [];
ctx.checkout = false;
for (var r = 0; rows.length > r; r++) {
  var row = rows[r] || {};
  var kind = String(row.event_type == null ? "" : row.event_type).toLowerCase();
  var pid = (row.${C.cart.product} == null) ? "" : String(row.${C.cart.product}).trim();
  if (kind === 'delete_cart') { present = {}; seen = []; }
  else if (kind === 'begin_checkout') { ctx.checkout = true; }
  else if (pid === "") { }
  else if (kind === 'add_to_cart') {
    present[pid] = { quantity: row.${C.cart.quantity} };
    seen.push(pid);
  }
  else if (kind === 'remove_from_cart') { present[pid] = null; }
}
for (var s = seen.length - 1; s >= 0; s--) {
  if (present[seen[s]] && all.indexOf(seen[s]) === -1) { all.push(seen[s]); }
}
ctx.present = present;
ctx.qty = {};
for (var q2 = 0; all.length > q2; q2++) {
  var qn = present[all[q2]] ? Number(present[all[q2]].quantity) : 1;
  if (isFinite(qn) && qn > 1) { ctx.qty[all[q2]] = qn; }
}`;

/* PAGE VIEWS INTO PRODUCTS, newest first, plus the leaf category seen most often. The tie
   is broken on the category name so the answer cannot depend on the order rows arrived in:
   take(n) promises no ordering at all. */
const VIEW = `
var counts = {};
for (var r = rows.length - 1; r >= 0; r--) {
  var row = rows[r] || {};
  var pid = (row.${C.view.product} == null) ? "" : String(row.${C.view.product}).trim();
  if (pid === "") { continue; }
  if (all.indexOf(pid) === -1) { all.push(pid); }
  var leaf = String(row.${C.view.categoryPath} == null ? "" : row.${C.view.categoryPath}).split('>').pop().replace(/^\\s+|\\s+$/g, "");
  if (leaf !== "") { counts[leaf] = (counts[leaf] || 0) + 1; }
}
var best = "";
var bestN = 0;
for (var k in counts) {
  if (counts[k] > bestN || (counts[k] === bestN && best > k)) { bestN = counts[k]; best = k; }
}
ctx.category = best;`;

/* THE SAVED SET. `add` and `remove`, which are the values the SDK actually writes: read
   out of template/js/dengageEvents.js rather than guessed. A fold written against
   add_to_wishlist resolves every saved item and never removes one. */
const SAVED = `
var present = {};
var seen = [];
for (var r = 0; rows.length > r; r++) {
  var row = rows[r] || {};
  var kind = String(row.event_type == null ? "" : row.event_type).toLowerCase();
  var pid = (row.${C.wishlist.product} == null) ? "" : String(row.${C.wishlist.product}).trim();
  if (pid === "") { continue; }
  if (kind === 'remove') { present[pid] = null; }
  else { present[pid] = { was: row.${C.wishlist.price}, list: row.${C.wishlist.list} }; seen.push(pid); }
}
for (var s = seen.length - 1; s >= 0; s--) {
  if (present[seen[s]] && all.indexOf(seen[s]) === -1) { all.push(seen[s]); }
}
ctx.savedAt = present;`;

/* THE NEWEST ORDER'S LINES, and only that order's. An order id is the grouping the table
   gives us, so the newest one is found first and then its lines are collected. */
const ORDER = `
var newest = "";
for (var r = rows.length - 1; r >= 0; r--) {
  var oid = String(rows[r].${C.orderLine.order} == null ? "" : rows[r].${C.orderLine.order}).replace(/^\\s+|\\s+$/g, "");
  if (oid !== "") { newest = oid; break; }
}
ctx.order = newest;
ctx.qty = {};
var qty = 0;
for (var r2 = rows.length - 1; r2 >= 0; r2--) {
  var row = rows[r2] || {};
  if (String(row.${C.orderLine.order} == null ? "" : row.${C.orderLine.order}).replace(/^\\s+|\\s+$/g, "") !== newest) { continue; }
  var pid = (row.${C.orderLine.product} == null) ? "" : String(row.${C.orderLine.product}).trim();
  if (pid === "") { continue; }
  var q = Number(row.${C.orderLine.quantity});
  if (isFinite(q) && q > 0) { qty = qty + q; }
  if (all.indexOf(pid) === -1) { all.push(pid); }
  if (isFinite(q) && q > 1) { ctx.qty[pid] = q; }
}
ctx.lines = all.length;
ctx.units = qty;`;

/* THE NEWEST SEARCH THAT HAD WORDS IN IT. No products: this is the one fold that resolves
   text rather than a catalogue, because a search term is the thing worth quoting back. */
const SEARCH = `
var term = "";
var found = -1;
for (var r = rows.length - 1; r >= 0; r--) {
  var kw = String(rows[r].${C.search.query} == null ? "" : rows[r].${C.search.query}).replace(/^\\s+|\\s+$/g, "");
  if (kw === "") { continue; }
  term = kw;
  found = Number(rows[r].${C.search.results});
  break;
}
ctx.term = term;
ctx.found = isFinite(found) ? found : -1;`;

export const FOLDS = {
    cart: { table: C.cart.table, fold: CART, noun: 'basket' },
    view: { table: C.view.table, fold: VIEW, noun: 'viewed' },
    saved: { table: C.wishlist.table, fold: SAVED, noun: 'saved' },
    order: { table: C.orderLine.table, fold: ORDER, noun: 'ordered' },
    search: { table: C.search.table, fold: SEARCH, noun: 'searched' }
};

export { CART, VIEW, SAVED, ORDER, SEARCH };
