/* ============================================================================
   Wishlist state, and the two Dengage wishlist events.

   This file is BYTE-IDENTICAL across all five demo sites. Everything that
   differs per site arrives on the script tag, the same way js/identity.js does
   it, so there is one implementation to keep correct instead of four that
   drift:

     <script src="js/wishlist.js"
             data-store="cantupneus_wishlist"
             data-ns="cantupneus"
             data-catalog="CantuCatalogData"
             data-global="CantuWishlist"
             data-list-name="favorites"></script>

   ---------------------------------------------------------------------------
   HOW THE ROWS ARE WRITTEN

   Wishlist rows go out with sendDeviceEvent, the SDK's documented custom-table
   write, with event_type and is_used set explicitly so wishlist_events stores
   every column the table declares. Nothing is lost by writing the row this
   way: unlike the cart events, which also set contact tags, the wishlist path
   only writes the row.

   Do not swap these calls to ec:addToWishlist / ec:removeFromWishlist and do
   not drop the event_type and is_used lines: required for correct behaviour
   with this SDK version. Background: Salil.

   ---------------------------------------------------------------------------
   The field contract, from https://dev.dengage.com/docs/ecommerce-events

   ec:addToWishlist       -> wishlist_events
       list_name            required. "favorites / shopping_list /
                             price_drop_alert / back_in_stock_alert ..."
       product_id           required
       product_variant_id   optional
       expire_date          optional, ISO 8601
       price                optional, "necessary for price drop campaigns"
       discounted_price     optional
       stock_count          optional, "necessary for back-in-stock campaigns"

   ec:removeFromWishlist  -> wishlist_events
       list_name            required
       product_id           required

   Two details worth knowing before you change anything here.

   price vs discounted_price: the docs type both as strings, unlike the cart
   events which take numbers, so they go out as strings. price is list price and
   discounted_price is what the customer would actually pay. On a product with
   no promotion the two are equal, which is correct rather than lazy: a price
   drop campaign compares against list.

   stock_count is only sent when the catalogue actually tracks stock. The two
   CantuPneus catalogues do. The fintech and banking catalogues do not, because
   a card or a mortgage has no unit count, and the field is optional. Omitting
   it is the honest answer; sending a made-up number would poison any
   back-in-stock segment built on the table.
   ========================================================================== */
(function () {
    'use strict';

    var el = document.currentScript;
    var cfg = (el && el.dataset) || {};

    var STORE = cfg.store || 'dn_wishlist';
    var NS = cfg.ns || 'site';
    var CATALOG = cfg.catalog || '';
    var GLOBAL = cfg.global || 'DnWishlist';

    /* The list this site's heart button writes to. A real deployment would run
       several: favorites for saves, back_in_stock_alert for a sold-out product,
       price_drop_alert for a watch. One list keeps the demo legible. */
    var LIST_NAME = cfg.listName || 'favorites';

    /* How long a saved item stays interesting. Sent as expire_date so a
       campaign can stop chasing a save nobody came back for. */
    var EXPIRE_DAYS = Number(cfg.expireDays || 90);

    var items = load();

    /* --------------------------------------------------------------- storage */
    function load() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORE) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (err) {
            return [];
        }
    }

    function save() {
        try {
            localStorage.setItem(STORE, JSON.stringify(items));
        } catch (err) { /* private mode: the list is in memory for this page */ }
    }

    /* A stock figure, or null when this catalogue does not track stock.

       Written as its own function because normalize() has to be IDEMPOTENT and
       the obvious Number() version is not. toggle() normalizes its argument and
       then hands the result to add(), which normalizes again, so every field
       makes the trip twice. Number(null) is 0, so a null stock came back as 0 on
       the second pass and every wishlist event carried stock_count: 0, which a
       back-in-stock campaign would read as "out of stock" for the entire
       catalogue. Absent, null and empty string all have to stay null. */
    function countOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        var n = Number(value);
        return Number.isFinite(n) && n >= 0 ? n : null;
    }

    /* ------------------------------------------------------------ normalizing
       Accepts a catalogue product, a cart-style item, or a dataset off a
       button, and flattens the three into one shape. */
    function normalize(raw) {
        if (!raw) return null;

        var productId = String(raw.productId || raw.id || '').trim();
        if (!productId) return null;

        var price = Number(raw.price);
        var oldPrice = Number(raw.oldPrice);
        var stock = countOrNull(raw.stock);

        return {
            id: productId,
            productId: productId,
            productVariantId: String(raw.productVariantId || raw.variantId || productId).trim(),
            name: String(raw.name || productId).trim(),
            price: Number.isFinite(price) && price > 0 ? price : 0,
            oldPrice: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : 0,
            currency: raw.currency || '',
            image: raw.image || '',
            category: raw.category || '',
            /* null, not 0, when the catalogue does not track stock: 0 would
               read as "out of stock" to a back-in-stock campaign */
            stock: stock,
            savedAt: raw.savedAt || new Date().toISOString()
        };
    }

    /* ------------------------------------------------------------ SDK events */
    /* The table these rows go to. Same table ec:addToWishlist would have used. */
    var TABLE = 'wishlist_events';

    function call(payload) {
        try {
            if (typeof window.dengage === 'function') {
                window.dengage('sendDeviceEvent', TABLE, payload);
            } else {
                console.log('Dengage sendDeviceEvent ' + TABLE + ' (mock):', payload);
            }
        } catch (err) {
            console.error('sendDeviceEvent ' + TABLE + ' failed', err);
        }
    }

    /* ec:addToWishlist stamped its own event_id. sendDeviceEvent does not, and
       every row that stored during testing carried one, so it is generated here
       rather than left to chance. */
    function eventId() {
        try {
            if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        } catch (err) { /* fall through */ }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function expiryIso() {
        return new Date(Date.now() + EXPIRE_DAYS * 86400000).toISOString();
    }

    /* Money goes out as a string because that is how the wishlist docs type
       price and discounted_price. Two decimals, so the column stays sortable. */
    function money(value) {
        return (Number(value) || 0).toFixed(2);
    }

    function sendAdd(item) {
        var listPrice = item.oldPrice && item.oldPrice > item.price ? item.oldPrice : item.price;

        var payload = {
            /* required by the wishlist_events table; do not remove */
            event_type: 'add',
            is_used: false,

            event_id: eventId(),
            list_name: LIST_NAME,
            product_id: item.productId,
            product_variant_id: item.productVariantId,
            expire_date: expiryIso(),
            price: money(listPrice),
            discounted_price: money(item.price)
        };

        /* optional, and only truthful when the catalogue tracks stock */
        if (item.stock !== null) payload.stock_count = item.stock;

        call(payload);
    }

    function sendRemove(item) {
        /* list_name and product_id, the documented contract for the remove
           event, plus event_type and is_used, which the table requires. */
        call({
            event_type: 'remove',
            is_used: false,
            event_id: eventId(),
            list_name: LIST_NAME,
            product_id: item.productId
        });
    }

    /* ---------------------------------------------------------------- reading */
    function has(id) {
        var key = String(id || '');
        return items.some(function (item) { return item.id === key; });
    }

    function getSummary() {
        return {
            listName: LIST_NAME,
            items: items.map(function (item) { return Object.assign({}, item); }),
            itemCount: items.length
        };
    }

    function emitChange(action, changed) {
        save();
        window.dispatchEvent(new CustomEvent(NS + ':wishlist:updated', {
            detail: {
                action: action,
                item: changed ? Object.assign({}, changed) : null,
                wishlist: getSummary()
            }
        }));
    }

    /* GTM parity with the cart, which pushes its own dataLayer events. Also
       what a Default Scenario would trigger on if you wanted a popup the moment
       somebody saves something. */
    function pushDataLayer(eventName, item) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            list_name: LIST_NAME,
            ecommerce: {
                currency: item.currency,
                value: item.price,
                items: [item]
            }
        });
    }

    /* ---------------------------------------------------------------- writing */
    function add(raw) {
        var item = normalize(raw);
        if (!item) return getSummary();
        if (has(item.id)) return getSummary();   /* saving twice is one save */

        items.push(item);
        emitChange('add', item);
        pushDataLayer('add_to_wishlist', item);
        sendAdd(item);

        return getSummary();
    }

    function remove(id) {
        var key = String(id || '');
        var item = items.filter(function (candidate) { return candidate.id === key; })[0];
        if (!item) return getSummary();

        items = items.filter(function (candidate) { return candidate.id !== key; });
        emitChange('remove', item);
        pushDataLayer('remove_from_wishlist', item);
        sendRemove(item);

        return getSummary();
    }

    /* What the heart button calls. Returns true when the item is now saved. */
    function toggle(raw) {
        var item = normalize(raw);
        if (!item) return false;

        if (has(item.id)) {
            remove(item.id);
            return false;
        }
        add(item);
        return true;
    }

    function clear() {
        /* removing the list is removing each item: there is no bulk remove in
           the wishlist contract, so every product gets its own event */
        items.slice().forEach(function (item) { remove(item.id); });
        return getSummary();
    }

    /* ----------------------------------------------------------- catalogue tie
       Saved items keep their own copy of name, price and image so the drawer
       renders with no network call. Prices move, though, so refresh from the
       catalogue once it is loaded. This does NOT re-send any event: it is a
       display refresh, not a new save. */
    function refreshFromCatalog() {
        var catalog = CATALOG && window[CATALOG];
        if (!catalog || !items.length) return;

        catalog.loadProducts().then(function () {
            var pending = items.map(function (item) {
                return catalog.getProductById(item.id).then(function (product) {
                    if (!product) return;
                    item.name = product.name;
                    item.price = product.price;
                    item.oldPrice = product.oldPrice || 0;
                    item.currency = product.currency;
                    item.image = product.image;
                    item.category = product.category;
                    item.stock = countOrNull(product.stock);
                });
            });
            return Promise.all(pending);
        }).then(function () {
            emitChange('refresh');
        }).catch(function (err) {
            console.error('wishlist refresh failed', err);
        });
    }

    window[GLOBAL] = {
        listName: LIST_NAME,
        add: add,
        remove: remove,
        toggle: toggle,
        clear: clear,
        has: has,
        getSummary: getSummary
    };

    emitChange('init');
    refreshFromCatalog();
})();
