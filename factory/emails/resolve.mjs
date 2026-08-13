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
     rootPath  the same with this origin stripped, for a validator that reads attributes
               before the engine resolves them. See the AMP note below
     all       every product id the fold found, newest first
     ids       the first `cap` of them, which is what dps_product was asked about
     view      the first `show` cards, which is what renders
     extra     how many the email is not showing, so it can say so
     byId      product_id -> the dps_product row
     cards     ids resolved to display fields, inactive products dropped. `banner` on each
               is the 1200x600 crop beside its photograph, for anywhere that needs a known
               size, and "" when the photograph is not where one would be
     ctx       whatever the fold chose to carry, per scenario

   `stop: 'root'` RETURNS AFTER `root` AND TAKES NO FOLD, for a push Target URL and
   anything else that wants an address rather than a catalogue. Same scoping, two fewer
   queries per recipient, one source.

   THE EMITTED CODE USES NO `<` CHARACTER, and that is not style either. Dengage validates
   an AMP email's markup before running the engine, so an HTML parser reads this block as
   document text and `i < rows.length` opens a tag it never closes. Every comparison is
   written with the larger side first. Found from the panel's own validator rejecting the
   first AMP sample with eight structural errors, none of which was about AMP.

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
    /* STOP AFTER THE DEMO ROOT, for anything that wants an address and no products.
       A push Target URL is the case: it needs step 4 and nothing after it, so the fold
       and the per card dps_product lookup are skipped. The scoping itself still reads
       dps_product once, because since 13 August 2026 the demo is decided by the
       products' own links first, and that same lookup also supplies the root when a
       session has no page views. Everything up to and including `root` is identical
       either way. */
    const stopAtRoot = o.stop === 'root';
    const fold = String(o.fold || '').trim();
    if (fold === '' && !stopAtRoot) {
        throw new Error('resolveBlock: a scenario must supply a fold');
    }
    if (fold !== '' && stopAtRoot) {
        throw new Error("resolveBlock: stop: 'root' runs before any fold, so it cannot take one");
    }
    /* A SECOND SLOT, AFTER THE PRODUCT LOOKUP, and it exists because putting it in the
       fold threw. A fold runs before dps_product is queried, so it can see `all` and
       nothing else; anything that needs `ids` or `byId`, which is any arithmetic over
       prices, has to run after. `var` hoisting made that a TypeError on undefined rather
       than a helpful error, which is the kind of thing a renderer catches and a reading
       does not. */
    const extra = String(o.extra || '').trim();
    /* This repository's own published origin. Everything dps_product carries is under it,
       because the ETL builds those addresses from it. */
    const site = o.site || 'https://dengage-presales.github.io/demo-ai/';
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
    push('  for (var d = 0; devices.length > d; d++) {');
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
        push('    return tb > ta ? -1 : (ta > tb ? 1 : 0);');
    } else {
        push('    return 0;');
    }
    push('  });');
    push('');

    /* THE DEMO IS DECIDED PER ROW, NOT PER SESSION, corrected 13 August 2026 after a
       real send. Every demo is served from one origin and one Dengage web application,
       so the SDK issues ONE session per browser sitting: a visitor who opens two demos
       in one sitting writes both demos' rows under one session_id, and a session-level
       join cannot split them. The send that proved it mixed ten of one prospect's
       garments with two of another's perfumes in a single basket email.

       So each row is attributed on its own. A row that names a product belongs to the
       demo that product belongs to: dps_product.link is absolute and carries the slug,
       which is the same fact the product lookup below already relies on. A row that
       names no product, delete_cart being the case that matters, belongs to the demo
       the visitor was on at that MOMENT: the latest page view in its session at or
       before its own timestamp. The old first-page-view-of-the-session join survives
       only inside that fallback, and time-aware rather than arbitrary.

       When the source table is page_view_events, every row carries its own page_url,
       so the row attributes itself and no product lookup is spent. */
    push('  var slugOf = function (url) {');
    push('    var u = (url == null) ? "" : String(url);');
    push("    var at = u.indexOf('/demos/');");
    push('    if (at === -1) { return ""; }');
    push("    var rest = u.slice(at + 7).split('?')[0].split('#')[0];");
    push("    var cut = rest.indexOf('/');");
    push('    return cut === -1 ? rest : rest.slice(0, cut);');
    push('  };');
    push('');
    push('  var rootOf = {};');
    push('  var noteRoot = function (url, slug) {');
    push('    if (slug === "" || rootOf[slug]) { return; }');
    push("    var mark = '/demos/' + slug + '/';");
    push('    var atRoot = String(url).indexOf(mark);');
    push('    if (atRoot !== -1) { rootOf[slug] = String(url).slice(0, atRoot + mark.length); }');
    push('  };');
    push('');
    if (!viewsAreRows) {
        push('  var sessions = [];');
        push('  for (var s0 = 0; rows.length > s0; s0++) {');
        push('    var sid = (rows[s0] && rows[s0].session_id != null) ? String(rows[s0].session_id).trim() : "";');
        push('    if (sid !== "" && sessions.indexOf(sid) === -1) { sessions.push(sid); }');
        push('  }');
        push('');
        push('  var views = sessions.length');
        push("    ? $from('$db.page_view_events').where('session_id', 'in', sessions).take(" + VIEWS + ').get()');
        push('    : [];');
        push('');
        push('  var pids = [];');
        push('  for (var q = rows.length - 1; q >= 0; q--) {');
        push('    var qp = (rows[q] && rows[q].product_id != null) ? String(rows[q].product_id).trim() : "";');
        push('    if (qp !== "" && pids.indexOf(qp) === -1 && 50 > pids.length) { pids.push(qp); }');
        push('  }');
        push('');
        push('  var located = pids.length');
        push("    ? $from('$db.dps_product').where('product_id', 'in', pids).take(60).get()");
        push('    : [];');
        push('');
        push('  var pidDemo = {};');
        push('  for (var l0 = 0; located.length > l0; l0++) {');
        push('    var lp = located[l0];');
        push('    if (!lp || lp.product_id == null) { continue; }');
        push('    var lurl = (lp.link == null) ? "" : String(lp.link);');
        push('    var lslug = slugOf(lurl);');
        /* A PRODUCT ID CLAIMED BY TWO DEMOS ATTRIBUTES NOTHING. Ids are the prospect's
           own SKUs and nothing makes them unique across demos, so a colliding id is not
           evidence of a demo: it falls through to the moment-of-the-row fallback, where
           the session still knows. The dedicated collision test in scenarios.test.mjs is
           what caught the version of this line that let the later row win. */
        push('    if (lslug !== "") {');
        push('      var lkey = String(lp.product_id);');
        push('      if (pidDemo[lkey] === undefined) { pidDemo[lkey] = lslug; }');
        push('      else if (pidDemo[lkey] !== lslug) { pidDemo[lkey] = ""; }');
        push('      noteRoot(lurl, lslug);');
        push('    }');
        push('  }');
        push('');
        push('  var sessViews = {};');
        push('  var sessIds = [];');
        push('  for (var v = 0; views.length > v; v++) {');
        push('    var vs = (views[v] && views[v].session_id != null) ? String(views[v].session_id).trim() : "";');
        push('    if (vs === "") { continue; }');
        push('    var vurl = (views[v] && views[v].page_url != null) ? String(views[v].page_url) : "";');
        push('    var vslug = slugOf(vurl);');
        push('    if (vslug === "") { continue; }');
        push('    var vwhen = (views[v] && views[v].event_date) ? new Date(views[v].event_date) : new Date(0);');
        push('    if (!sessViews[vs]) { sessViews[vs] = []; sessIds.push(vs); }');
        push('    sessViews[vs].push({ when: vwhen, slug: vslug });');
        push('    noteRoot(vurl, vslug);');
        push('  }');
        push('  for (var sv = 0; sessIds.length > sv; sv++) {');
        push('    sessViews[sessIds[sv]].sort(function (x, y) { return x.when - y.when; });');
        push('  }');
        push('');
        push('  var whereOf = function (row) {');
        push('    if (!row) { return ""; }');
        push('    var wp = (row.product_id == null) ? "" : String(row.product_id).trim();');
        push('    if (wp !== "" && pidDemo[wp]) { return pidDemo[wp]; }');
        push('    var ws = (row.session_id == null) ? "" : String(row.session_id).trim();');
        push('    if (ws === "" || !sessViews[ws]) { return ""; }');
        push('    var list = sessViews[ws];');
        push('    var when = (row.event_date) ? new Date(row.event_date) : new Date(0);');
        push('    var best = "";');
        push('    for (var w0 = 0; list.length > w0; w0++) {');
        push('      if (when >= list[w0].when) { best = list[w0].slug; }');
        push('    }');
        push('    return best === "" ? list[0].slug : best;');
        push('  };');
    } else {
        push('  for (var v = 0; rows.length > v; v++) {');
        push('    var vurl = (rows[v] && rows[v].page_url != null) ? String(rows[v].page_url) : "";');
        push('    noteRoot(vurl, slugOf(vurl));');
        push('  }');
        push('');
        push('  var whereOf = function (row) {');
        push('    if (!row) { return ""; }');
        push('    return slugOf((row.page_url == null) ? "" : String(row.page_url));');
        push('  };');
    }
    push('');
    push('  var target = "";');
    push('  for (var t = rows.length - 1; t >= 0; t--) {');
    push('    var tslug = whereOf(rows[t]);');
    push('    if (tslug !== "") { target = tslug; break; }');
    push('  }');
    push('');
    push('  if (target !== "") {');
    push('    var mine = [];');
    push('    for (var m = 0; rows.length > m; m++) {');
    push('      if (whereOf(rows[m]) === target) { mine.push(rows[m]); }');
    push('    }');
    push('    rows = mine;');
    push('  }');
    push('');
    push('  var root = (target !== "" && rootOf[target]) ? rootOf[target] : "";');
    push("  if (root.indexOf('https://') !== 0) { root = \"\"; }");

    if (stopAtRoot) return lines.join('\n');

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
    /* THE LOOKUP IS SCOPED TO THE DEMO TOO, and not only the events. Scoping the events
       was the fix everything here already had: one origin, one device id, so a key carries
       every demo that browser ever visited. This is the other half, and it was open until
       10 August 2026.

       A PRODUCT ID IS THE PROSPECT'S OWN SKU. The scrape takes it off their site, so it is
       FSH-JKT-001 for one store and KBE580-MOUSE for another, and nothing makes it unique
       across demos: two prospects numbering their products 1, 2, 3 collide completely.
       dps_product holds every demo's catalogue in one table, so `where('product_id', 'in',
       ids)` can return two rows for one id and the later one wins the map. The events were
       the right demo's and the product was not.

       What it would have looked like is the reason it is worth two lines: a push naming
       another prospect's product, with their photograph, linking to their demo, on a call.
       `link` is absolute and carries the slug, so comparing it to `root` settles it.

       ONLY WHEN A DEMO RESOLVED. With root empty there is nothing to compare against, and
       dropping every product would turn "no page view" from a message with a real product
       in it into an empty one. */
    push('  var byId = {};');
    push('  for (var p = 0; products.length > p; p++) {');
    push('    var prod = products[p];');
    push('    if (!prod || !prod.product_id) { continue; }');
    push('    if (root !== "") {');
    push('      var prodLink = String(prod.link == null ? "" : prod.link);');
    push('      if (prodLink.indexOf(root) !== 0) { continue; }');
    push('    }');
    push('    byId[String(prod.product_id)] = prod;');
    push('  }');
    push('');
    push('  var money = function (value) {');
    push('    var n = Number(value);');
    push('    if (!isFinite(n) || 0 >= n) { return ""; }');
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
    /* THE 2:1 BANNER BESIDE EACH PHOTOGRAPH, derived rather than stored, which is the same
       rule abandoned-cart-image.txt uses and the same one make-push-images.mjs writes to.
       An AMP email needs it: amp-img demands explicit dimensions, and a product photograph
       is whatever aspect the prospect's studio used, while a banner is always 1200x600.

       THREE IMPLEMENTATIONS OF ONE RULE NOW, in this file, in that asset and in the
       generator, none of which can import the others. factory/push-images.test.mjs runs all
       three against the same inputs and holds them to the same answer, because a derived
       address for a file nobody wrote is a broken image rather than a fallback. */
    push('  var bannerOf = function (url) {');
    push('    var u = String(url == null ? "" : url).trim();');
    push("    var cut = u.lastIndexOf('/');");
    push('    if (cut === -1) { return ""; }');
    push('    var dir = u.slice(0, cut);');
    push("    var file = u.slice(cut + 1).split('?')[0].split('#')[0];");
    push('    var tail = dir.slice(-7);');
    push(`    if (file === "" || (tail !== '/images' && tail !== '/motifs')) { return ""; }`);
    push("    var dot = file.lastIndexOf('.');");
    push('    var stem = dot === -1 ? file : file.slice(0, dot);');
    push('    if (stem === "") { return ""; }');
    push("    return dir + '/push/' + stem + '.jpg';");
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
    /* AN ORIGIN RELATIVE PATH ALONGSIDE EACH ABSOLUTE ONE, and the reason is AMP.
       Dengage validates an AMP email AS AUTHORED, before the template engine runs, so it
       sees `src="{%= card.banner %}"` and reports a disallowed relative URL. A literal
       https prefix followed by a path expression is absolute to a validator reading the
       text, and identical after resolution.

       Empty when the address is not on this repository's own origin, which makes the AMP
       markup omit the image or the link rather than emit half a URL. */
    push("  var SITE = '" + site + "';");
    push('  var pathOf = function (url) {');
    push('    var u = String(url == null ? "" : url);');
    push('    return u.indexOf(SITE) === 0 ? u.slice(SITE.length) : "";');
    push('  };');
    push('');
    push('  var rootPath = pathOf(root);');
    push('');
    push('  var cards = [];');
    push('  for (var c = 0; ids.length > c; c++) {');
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
    push('      banner: bannerOf(httpsOnly(item.image_link)),');
    push('      bannerPath: pathOf(bannerOf(httpsOnly(item.image_link))),');
    push('      linkPath: pathOf(httpsOnly(item.link)),');
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
