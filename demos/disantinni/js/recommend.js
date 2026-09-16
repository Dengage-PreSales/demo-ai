/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    var slug = window.DEMO_SLUG || 'demo';
    var VIEWED_KEY = 'dps:' + slug + ':viewed';
    var MAX_VIEWED = 12;

    function readViewed() {
        try {
            var raw = window.sessionStorage.getItem(VIEWED_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) { return []; }
    }

    function noteViewed(id) {
        if (!id) return;
        var list = readViewed().filter(function (x) { return x !== id; });
        list.unshift(id);
        list = list.slice(0, MAX_VIEWED);
        try { window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify(list)); }
        catch (err) {  }
    }

    function catalog() { return window.Catalog; }

    function currentProduct() {
        var m = /[?&]id=([^&#]*)/.exec(window.location.search);
        if (!m) return null;
        var id;
        try { id = decodeURIComponent(m[1]); } catch (err) { id = m[1]; }
        return catalog().get(id);
    }

    function without(list, ids) {
        return list.filter(function (p) { return ids.indexOf(p.id) === -1; });
    }

    function seeded(list, seed) {
        var out = list.slice();
        var s = 0, i;
        for (i = 0; i < String(seed).length; i++) s = (s * 31 + String(seed).charCodeAt(i)) % 100003;
        out.sort(function (a, b) {
            var ha = (s + a.id.length * 7 + a.id.charCodeAt(0)) % 1000;
            var hb = (s + b.id.length * 7 + b.id.charCodeAt(0)) % 1000;
            if (ha !== hb) return ha - hb;

            return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
        });
        return out;
    }

    var STRATEGIES = [
        {
            id: 'trending',
            label: 'Trending now',
            note: 'Popular across the store',
            explain: 'Ranked across the whole catalogue, the rail for a home page ' +
                     'where nothing is known about the visitor yet.',
            run: function (limit) {
                return seeded(catalog().all(), slug).slice(0, limit);
            }
        },
        {
            id: 'similar',
            label: 'More like this',
            note: 'Same category as the item being viewed',
            explain: 'Content similarity. Needs a product in context, so it is a ' +
                     'product page rail.',
            needsProduct: true,
            run: function (limit) {
                var p = currentProduct();
                if (!p) return [];
                return catalog().similar(p, limit);
            }
        },
        {
            id: 'also-viewed',
            label: 'Others also viewed',
            note: 'Co-viewing, across categories',
            explain: 'Deliberately crosses category boundaries, which is what ' +
                     'separates it from More like this. On a real engine this is ' +
                     'driven by co-view data.',
            needsProduct: true,
            run: function (limit) {
                var p = currentProduct();
                if (!p) return [];
                return catalog().alsoViewed(p, limit);
            }
        },
        {
            id: 'complete-basket',
            label: 'Completes your basket',
            note: 'From categories the basket does not cover yet',
            explain: 'Reads the cart and suggests from categories it is missing, ' +
                     'rather than more of what is already in it. An empty basket ' +
                     'has nothing to complete, and the rail says so.',
            run: function (limit) {
                var cart = window.Store ? window.Store.cart() : [];
                if (!cart.length) return [];
                var haveIds = cart.map(function (l) { return l.id; });
                var haveCats = {};
                cart.forEach(function (l) {
                    var p = catalog().get(l.id);
                    if (p) haveCats[p.category] = 1;
                });
                var pool = without(catalog().all(), haveIds);

                var fresh = pool.filter(function (p) { return !haveCats[p.category]; });
                return (fresh.length ? fresh : pool).slice(0, limit);
            }
        },
        {
            id: 'recently-viewed',
            label: 'Recently viewed',
            note: 'This visit, most recent first',
            explain: 'Scoped to this visit on purpose, so the rail reflects what was ' +
                     'browsed just now rather than a stale list from an earlier session.',
            run: function (limit) {
                var ids = readViewed();
                var here = currentProduct();
                return ids
                    .filter(function (id) { return !here || id !== here.id; })
                    .map(function (id) { return catalog().get(id); })
                    .filter(Boolean)
                    .slice(0, limit);
            }
        }
    ];

    function get(id) {
        return STRATEGIES.filter(function (s) { return s.id === id; })[0] || null;
    }

    function render(id, hostSelector, limit) {
        var strategy = get(id);
        var host = document.querySelector(hostSelector || '#rec-rail');
        if (!strategy || !host || !catalog()) return null;

        var items = [];
        try { items = strategy.run(limit || 6) || []; }
        catch (err) { if (window.console) console.error('[recommend] ' + id, err); }

        var section = host.closest ? host.closest('.section') : null;
        var title = document.querySelector('#rec-title');
        var note = document.querySelector('#rec-note');
        if (title) title.textContent = strategy.label;
        if (note) note.textContent = strategy.note;

        if (!items.length) {

            var reason = strategy.needsProduct
                ? 'Open a product to see this one.'
                : (id === 'complete-basket'
                    ? 'Add something to the basket and this fills in.'
                    : 'Browse a few products and this fills in.');
            host.innerHTML = '<p class="empty">' + reason + '</p>';
        } else {
            host.innerHTML = items.map(window.Storefront.card).join('');
        }

        if (section) section.hidden = false;
        return { id: id, count: items.length };
    }

    window.Recommend = {
        strategies: STRATEGIES,
        get: get,
        render: render,
        noteViewed: noteViewed,
        viewed: readViewed,
        keys: { viewed: VIEWED_KEY }
    };
})(window, document);
