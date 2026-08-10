/* ============================================================================
   The resolution block, emitted once per scenario from one source.

     import { resolveBlock } from './resolve.mjs';
     const block = resolveBlock({ table: 'wishlist_events', fold: '...' });

   WHY IT IS GENERATED RATHER THAN WRITTEN. Every saved asset in
   factory/panel/content/_dynamic/ opens with the same hundred lines: build the key set,
   read one event table, scope the rows to one demo, fold them into a list of product
   ids, look those up in dps_product. Four assets carry four hand copied versions of it
   today, which was tolerable at four. At nine emails as well it stops being tolerable:
   a correction to the demo scoping would have to land in thirteen places and would land
   in eleven.

   SO ONLY TWO OF THE SIX STEPS ARE PARAMETERS, exactly as
   factory/panel/content/_dynamic/README.md says: the table a scenario reads, and the
   fold it applies to those rows. Everything else is identical and is written here once.

   THE EMITTED CODE CARRIES NO COMMENTS, and that is not tidiness. A comment inside a
   {% %} block produced the first SyntaxError this project ever hit from Dengage's
   engine, so the assets have never contained one. The reasoning lives in this file
   instead, which is also the only place it can be read without a panel open.

   WHAT THE BLOCK LEAVES BEHIND for the markup after it:

     keys      every identifier this contact's rows could be under
     target    the slug of the demo the newest row belongs to, or ""
     root      that demo's absolute base URL, or ""
     all       every product id the fold found, newest first
     ids       the first `cap` of them, which is what dps_product was asked about
     view      the first `show` cards, which is what renders
     extra     how many the email is not showing, so it can say so
     byId      product_id -> the dps_product row
     cards     ids resolved to display fields, inactive products dropped
     ctx       whatever the fold chose to carry, per scenario

   PRICES ARE NEVER INVENTED ANYWHERE IN HERE. money() returns "" for anything that is
   not a finite positive number, and a card with no price renders none. CLAUDE.md rule 5,
   and Number(null) being 0 is the trap it exists for.
   ========================================================================== */

/* Every table this repository may read, with the column that breaks a tie inside one
   second. Two of the six have nothing to break it with, which is a fact about the
   schema rather than an omission here: a fold over those must not depend on the order
   of rows sharing a timestamp, and the ones below do not.

   READ OFF THE REAL TABLES, not the documentation. factory/phase0/SCHEMA.md lists all
   six in full and factory/phase0/columns.mjs is the machine readable copy. */
const TIE_BREAK = {
    /* A serial, so it compares as a number and the newer row is the larger one. */
    shopping_cart_events: { column: 'id', kind: 'number' },
    /* A UUID, NOT A SERIAL, and that distinction is the whole reason this carries a
       kind. template/js/dengageEvents.js generates it with crypto.randomUUID, so
       Number(event_id) is NaN, NaN - NaN is NaN, and a comparator returning NaN leaves
       the sort order undefined. It orders nothing useful either way, since a UUID is not
       chronological: it is here only so two rows in the same second land in a stable
       order rather than an arbitrary one. */
    wishlist_events: { column: 'event_id', kind: 'string' },
    page_view_events: null,
    search_events: null,
    order_events: null,
    order_events_detail: null
};

export const TABLES = Object.keys(TIE_BREAK);

/* How many rows of history to read. Generous enough to replay a real session and small
   enough to stay a keyed lookup rather than a scan of a table shared with live traffic:
   every query here is anchored on `key in keys`. */
const ROWS = 100;
const VIEWS = 300;
const PRODUCTS = 24;

export function resolveBlock(options) {
    const o = options || {};
    const table = String(o.table || '');
    if (TABLES.indexOf(table) === -1) {
        throw new Error('resolveBlock: not one of the six standard tables: ' + table);
    }
    const tie = TIE_BREAK[table];
    const fold = String(o.fold || '').trim();
    if (fold === '') throw new Error('resolveBlock: a scenario must supply a fold');
    /* A SECOND SLOT, AFTER THE PRODUCT LOOKUP, and it exists because putting it in the
       fold threw. A fold runs before dps_product is queried, so it can see `all` and
       nothing else; anything that needs `ids` or `byId`, which is any arithmetic over
       prices, has to run after. `var` hoisting made that a TypeError on undefined rather
       than a helpful error, which is the kind of thing a renderer catches and a reading
       does not. */
    const extra = String(o.extra || '').trim();
    const cap = Number(o.cap) || 20;
    const show = Number(o.show) || 6;

    /* THE SOURCE TABLE IS SOMETIMES THE SCOPING TABLE. Browse abandonment reads
       page_view_events, which already carries page_url, so the second query would be
       the same rows again. One less query per recipient, on a shared account, and one
       less place for the two copies to disagree about which demo won. */
    const viewsAreRows = table === 'page_view_events';

    const lines = [];
    const push = (s) => lines.push(s);

    push('  var keys = [];');
    push('  if ($Contact && $Contact.contact_key) { keys.push(String($Contact.contact_key)); }');
    push('');
    push('  var devices = ($Contact && $Contact.contact_key)');
    push("    ? $from('$db.master_device').where('contact_key', '=', $Contact.contact_key).take(50).get()");
    push('    : [];');
    push('');
    push('  for (var d = 0; d < devices.length; d++) {');
    push('    var did = (devices[d] && devices[d].device_id != null) ? String(devices[d].device_id).trim() : "";');
    push('    if (did !== "" && keys.indexOf(did) === -1) { keys.push(did); }');
    push('  }');
    push('');
    push('  var rows = keys.length');
    push("    ? $from('$db." + table + "').where('key', 'in', keys).take(" +
         (viewsAreRows ? VIEWS : ROWS) + ').get()');
    push('    : [];');
    push('');
    push('  rows.sort(function (a, b) {');
    push('    var byDate = new Date(a.event_date) - new Date(b.event_date);');
    push('    if (byDate !== 0) { return byDate; }');
    if (tie && tie.kind === 'number') {
        push('    return Number(a.' + tie.column + ') - Number(b.' + tie.column + ');');
    } else if (tie) {
        push('    var ta = String(a.' + tie.column + ' == null ? "" : a.' + tie.column + ');');
        push('    var tb = String(b.' + tie.column + ' == null ? "" : b.' + tie.column + ');');
        push('    return ta < tb ? -1 : (ta > tb ? 1 : 0);');
    } else {
        push('    return 0;');
    }
    push('  });');
    push('');

    if (!viewsAreRows) {
        push('  var sessions = [];');
        push('  for (var s0 = 0; s0 < rows.length; s0++) {');
        push('    var sid = (rows[s0] && rows[s0].session_id != null) ? String(rows[s0].session_id).trim() : "";');
        push('    if (sid !== "" && sessions.indexOf(sid) === -1) { sessions.push(sid); }');
        push('  }');
        push('');
        push('  var views = sessions.length');
        push("    ? $from('$db.page_view_events').where('session_id', 'in', sessions).take(" + VIEWS + ').get()');
        push('    : [];');
    } else {
        push('  var views = rows;');
    }
    push('');
    push('  var slugOf = function (url) {');
    push('    var u = (url == null) ? "" : String(url);');
    push("    var at = u.indexOf('/demos/');");
    push('    if (at === -1) { return ""; }');
    push("    var rest = u.slice(at + 7).split('?')[0].split('#')[0];");
    push("    var cut = rest.indexOf('/');");
    push('    return cut === -1 ? rest : rest.slice(0, cut);');
    push('  };');
    push('');
    push('  var demoOf = {};');
    push('  var rootOf = {};');
    push('  for (var v = 0; v < views.length; v++) {');
    push('    var vs = (views[v] && views[v].session_id != null) ? String(views[v].session_id).trim() : "";');
    push('    if (vs === "" || demoOf[vs]) { continue; }');
    push('    var vurl = (views[v] && views[v].page_url != null) ? String(views[v].page_url) : "";');
    push('    var vslug = slugOf(vurl);');
    push('    if (vslug !== "") {');
    push('      demoOf[vs] = vslug;');
    push('      if (!rootOf[vslug]) {');
    push("        var mark = '/demos/' + vslug + '/';");
    push('        var atRoot = vurl.indexOf(mark);');
    push('        if (atRoot !== -1) { rootOf[vslug] = vurl.slice(0, atRoot + mark.length); }');
    push('      }');
    push('    }');
    push('  }');
    push('');
    push('  var target = "";');
    push('  for (var t = rows.length - 1; t >= 0; t--) {');
    push('    var ts = (rows[t] && rows[t].session_id != null) ? String(rows[t].session_id).trim() : "";');
    push('    if (ts !== "" && demoOf[ts]) { target = demoOf[ts]; break; }');
    push('  }');
    push('');
    push('  if (target !== "") {');
    push('    var mine = [];');
    push('    for (var m = 0; m < rows.length; m++) {');
    push('      var ms = (rows[m] && rows[m].session_id != null) ? String(rows[m].session_id).trim() : "";');
    push('      if (ms !== "" && demoOf[ms] === target) { mine.push(rows[m]); }');
    push('    }');
    push('    rows = mine;');
    push('  }');
    push('');
    push('  var root = (target !== "" && rootOf[target]) ? rootOf[target] : "";');
    push("  if (root.indexOf('https://') !== 0) { root = \"\"; }");
    push('');
    push('  var all = [];');
    push('  var ctx = {};');
    /* The scenario's own lines, indented to match. */
    for (const line of fold.split('\n')) push(line === '' ? '' : '  ' + line);
    push('');
    /* TWO LIMITS, AND CONFLATING THEM PRODUCED A WRONG TOTAL. `cap` is how many products
       are looked up, which is what the arithmetic runs over: a subtotal for four of nine
       basket items is not a subtotal. `show` is how many cards render, which is a layout
       question. The abandoned cart asset only avoided this by looking up fifty and
       showing six. */
    push('  var ids = all.slice(0, ' + cap + ');');
    push('');
    push('  var products = ids.length');
    push("    ? $from('$db.dps_product').where('product_id', 'in', ids).take(" + PRODUCTS + ').get()');
    push('    : [];');
    push('');
    push('  var byId = {};');
    push('  for (var p = 0; p < products.length; p++) {');
    push('    if (products[p] && products[p].product_id) { byId[String(products[p].product_id)] = products[p]; }');
    push('  }');
    push('');
    push('  var money = function (value) {');
    push('    var n = Number(value);');
    push('    if (!isFinite(n) || n <= 0) { return ""; }');
    push("    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);");
    push('  };');
    push('');
    push('  var httpsOnly = function (url) {');
    push('    var u = (url == null) ? "" : String(url).trim();');
    push("    return u.indexOf('https://') === 0 ? u : \"\";");
    push('  };');
    push('');
    push('  var clamp = function (value, n) {');
    push('    var s = String(value == null ? "" : value).replace(/^\\s+|\\s+$/g, "");');
    push('    if (s === "") { return ""; }');
    push('    return s.length > n ? s.substring(0, n - 3).replace(/[\\s,]+$/, "") + "..." : s;');
    push('  };');
    push('');
    push('  var leafOf = function (path) {');
    push("    var parts = String(path == null ? \"\" : path).split('>');");
    push('    return parts[parts.length - 1].replace(/^\\s+|\\s+$/g, "");');
    push('  };');
    push('');
    if (extra) {
        for (const line of extra.split('\n')) push(line === '' ? '' : '  ' + line);
        push('');
    }
    push('  var cards = [];');
    push('  for (var c = 0; c < ids.length; c++) {');
    push('    var item = byId[ids[c]];');
    push('    if (!item || !item.is_active) { continue; }');
    push('    var full = money(item.price);');
    push('    var cut = money(item.discounted_price);');
    push('    if (cut !== "" && Number(item.discounted_price) >= Number(item.price)) { cut = ""; }');
    push('    cards.push({');
    push('      id: String(ids[c]),');
    push('      title: clamp(item.title, 60),');
    push('      category: leafOf(item.category_path),');
    push('      image: httpsOnly(item.image_link),');
    push('      link: httpsOnly(item.link),');
    push('      price: full,');
    push('      cut: cut,');
    push('      stock: Number(item.stock_count),');
    push('      row: item');
    push('    });');
    push('  }');
    push('');
    push('  var view = cards.slice(0, ' + show + ');');
    push('  var extra = (all.length - view.length) > 0 ? (all.length - view.length) : 0;');

    return lines.join('\n');
}
