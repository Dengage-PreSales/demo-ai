/* ============================================================================
   FIVE RECOMMENDATION STRATEGIES, COMPUTED FROM THE DEMO'S OWN CATALOGUE.

   Handoff 2.2c, 5.0, 2.7. Salil's decision, 4 August 2026.

   WHY THIS IS LOCAL AND NOT THE DENGAGE ENGINE, stated plainly because it is a
   real trade and anyone demoing this needs to know which half they are showing.

   The recommendation engine is fed per APPLICATION, and every demo the factory
   builds shares one application. So the engine would hold one catalogue for all of
   them. Demo a mobile retailer on Monday and a fashion retailer on Thursday, and
   the Thursday prospect gets phone recommendations. That is not a limitation worth
   shipping: it is the single most damaging thing a demo can do, because it proves
   the opposite of the point.

   Computing locally is always the right vertical, needs no panel setup, and works
   the moment a demo exists. What it does NOT show is Dengage's engine doing the
   ranking. On a call, say so. The honest line is that the experience is real and
   the ranking is local for the demo.

   If the engine is ever fed per demo, or a shared feed can be filtered by demo,
   these five strategies become the fallback rather than the source and only the
   body of each strategy changes. That is why they are named and separated.

   NO PANEL WORK FOR THIS GROUP AT ALL. There is no campaign, no creative to paste
   and no target selector, because nothing here comes from Dengage. The launcher
   renders them directly.

   EVERY VIEW STILL REPORTS TO DENGAGE. Recommendation rails are where a lot of a
   storefront's engagement happens, so clicking through one records a pageView on
   the product like any other navigation, and adding from one records a cart event.
   The ranking is local; the behaviour it produces is not.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var slug = window.DEMO_SLUG || 'demo';
    var VIEWED_KEY = 'dps:' + slug + ':viewed';
    var MAX_VIEWED = 12;

    /* ------------------------------------------------------------------ */
    /* Recently viewed, which two strategies need                          */

    function readViewed() {
        try {
            var raw = window.sessionStorage.getItem(VIEWED_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) { return []; }
    }

    /* Called from the product page. Most recent first, deduplicated, bounded, and
       in sessionStorage rather than localStorage: "recently viewed" means this
       visit, and a week-old list presented as recent is a lie the prospect can
       catch by opening the demo fresh. */
    function noteViewed(id) {
        if (!id) return;
        var list = readViewed().filter(function (x) { return x !== id; });
        list.unshift(id);
        list = list.slice(0, MAX_VIEWED);
        try { window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify(list)); }
        catch (err) { /* private mode */ }
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                             */

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

    /* Deterministic pseudo-shuffle from a seed, so "trending" is stable within a
       demo instead of reordering on every render. A rail that reshuffles while a
       prospect is looking at it reads as broken rather than as fresh. */
    function seeded(list, seed) {
        var out = list.slice();
        var s = 0, i;
        for (i = 0; i < String(seed).length; i++) s = (s * 31 + String(seed).charCodeAt(i)) % 100003;
        out.sort(function (a, b) {
            var ha = (s + a.id.length * 7 + a.id.charCodeAt(0)) % 1000;
            var hb = (s + b.id.length * 7 + b.id.charCodeAt(0)) % 1000;
            if (ha !== hb) return ha - hb;
        /* A LAST RESORT ON THE ID ITSELF, so the result does not depend on the order
           the list arrived in. Two ids of the same length starting with the same
           character hash identically, which leaves them fully tied, and a stable sort
           then just preserves the input order. That is fine on a page, where the
           catalogue array is always in the same order, and it is not fine anywhere the
           same catalogue arrives differently: a Dengage query returns rows in no
           promised order, so the email rail and the page rail disagreed on exactly
           those ties. Deciding them here makes the ordering a property of the ids and
           the seed alone. */
            return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
        });
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* The five strategies                                                 */

    /* Each returns products from THIS demo's catalogue, so every one of them is
       automatically the prospect's own vertical. None of them can return a phone to
       a fashion retailer, because the catalogue has no phones in it. */
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
                /* Prefer categories the basket does not have. Fall back to the rest
                   so a single-category catalogue still fills the rail. */
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

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */

    /* Renders into a host element, reusing the storefront's own card so a
       recommendation rail is visually identical to the rest of the page. That
       identity is the point: a prospect should not be able to tell which rows the
       storefront chose and which were chosen for them, until it is pointed out. */
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
            /* Say why, rather than showing an empty strip. The two strategies that
               can legitimately be empty are the interesting ones to explain. */
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
