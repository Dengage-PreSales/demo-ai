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

    function paid(product) {
        var n = Number(product && (product.discountedPrice || product.price));
        return isFinite(n) && n > 0 ? n : null;
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
            id: 'step-up',
            label: 'Step up',
            note: 'A higher spec pick from the same shelf',
            explain: 'The classic upsell. Same shelf as the item in context, ' +
                     'priced above it, nearest first, so the suggestion is a ' +
                     'reachable upgrade rather than the most expensive thing in ' +
                     'the store.',
            run: function (limit) {
                var anchor = currentProduct();
                if (!anchor && window.Store) {
                    var lines = window.Store.cart();
                    if (lines.length) anchor = catalog().get(lines[lines.length - 1].id);
                }
                if (!anchor) return [];
                var floor = paid(anchor);
                if (floor === null) return [];
                return catalog().all()
                    .filter(function (p) {
                        if (p.id === anchor.id || p.category !== anchor.category) return false;
                        var cost = paid(p);
                        return cost !== null && cost > floor;
                    })
                    .sort(function (a, b) {
                        var da = paid(a) - floor;
                        var db = paid(b) - floor;
                        if (da !== db) return da - db;
                        return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
                    })
                    .slice(0, limit);
            }
        },
        {
            id: 'also-viewed',
            label: 'You might also like',
            note: 'From the other shelves in your visit',
            explain: 'Crosses category boundaries, which is what separates it ' +
                     'from More like this. It reads the shelves this visitor ' +
                     'actually browsed or carted and offers from those, so two ' +
                     'visitors with different histories see different rails. A ' +
                     'fresh visitor with no history gets a stable cross ' +
                     'category mix instead.',
            run: function (limit) {
                var here = currentProduct();
                var exclude = [];
                if (here) exclude.push(here.id);
                var cats = {};
                readViewed().forEach(function (id) {
                    var p = catalog().get(id);
                    if (p && (!here || p.category !== here.category)) cats[p.category] = 1;
                });
                var lines = window.Store ? window.Store.cart() : [];
                lines.forEach(function (l) {
                    exclude.push(l.id);
                    var p = catalog().get(l.id);
                    if (p && (!here || p.category !== here.category)) cats[p.category] = 1;
                });
                var browsed = Object.keys(cats);
                if (browsed.length) {
                    var pool = without(catalog().all(), exclude).filter(function (p) {
                        return cats[p.category];
                    });
                    if (pool.length) return seeded(pool, (here ? here.id : slug)).slice(0, limit);
                }

                if (!here) return [];
                return catalog().alsoViewed(here, limit);
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
        rails: rails,
        refresh: refresh,
        noteViewed: noteViewed,
        viewed: readViewed,
        keys: { viewed: VIEWED_KEY }
    };

    var RAIL_PLAN = {
        home: ['recently-viewed', 'complete-basket', 'also-viewed', 'trending'],
        product: ['step-up', 'also-viewed', 'recently-viewed']
    };
    var RAIL_CAP = { home: 2, product: 3 };

    function railBlock(strategy, items) {
        return '<div class="rec-block">' +
            '<div class="section-head"><h2>' + strategy.label + '</h2>' +
            '<span class="count">' + strategy.note + '</span></div>' +
            '<div class="rail">' + items.map(window.Storefront.card).join('') + '</div>' +
            '</div>';
    }

    function rails() {
        var section = document.querySelector('#recommendations');
        if (!section || !catalog() || !window.Storefront) return;
        var container = section.querySelector('.container') || section;
        var context = /product\.html/.test(window.location.pathname) ? 'product' : 'home';

        var host = container.querySelector('#rec-rails');
        if (!host) {
            host = document.createElement('div');
            host.id = 'rec-rails';
            container.appendChild(host);
        }

        var legacy = container.querySelector('#rec-rail');
        if (legacy && !legacy.innerHTML) {
            var head = container.querySelector('.section-head');
            if (head && head.parentNode === container) head.style.display = 'none';
            legacy.style.display = 'none';
        }

        var blocks = [];
        var plan = RAIL_PLAN[context];
        for (var i = 0; i < plan.length && blocks.length < RAIL_CAP[context]; i++) {
            var strategy = get(plan[i]);
            if (!strategy) continue;
            var items = [];
            try { items = strategy.run(6) || []; }
            catch (err) { if (window.console) console.error('[recommend] ' + plan[i], err); }
            if (items.length > 1) blocks.push(railBlock(strategy, items));
        }
        host.innerHTML = blocks.join('');
        if (blocks.length) section.hidden = false;
        drawerRail();
    }

    function drawerRail() {
        var drawer = document.querySelector('#cart');
        if (!drawer || !catalog() || !window.Storefront) return;
        var strategy = get('complete-basket');
        var items = [];
        try { items = strategy.run(3) || []; }
        catch (err) {  }
        var host = drawer.querySelector('#cart-rec');
        if (!items.length) {
            if (host) host.innerHTML = '';
            return;
        }
        if (!host) {
            host = document.createElement('div');
            host.id = 'cart-rec';
            drawer.appendChild(host);
        }
        host.innerHTML = '<div class="section-head"><h2>' + strategy.label + '</h2></div>' +
            '<div class="rail">' + items.map(window.Storefront.card).join('') + '</div>';
    }

    function refresh() { rails(); }

    var waited = 0;
    function ready() {
        return catalog() && catalog().all().length && window.Storefront;
    }
    function firstRender() {
        if (ready()) { rails(); return; }
        waited += 1;
        if (waited < 80) window.setTimeout(firstRender, 150);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', firstRender);
    } else {
        firstRender();
    }
    if (window.Store && window.Store.onChange) window.Store.onChange(refresh);
})(window, document);
