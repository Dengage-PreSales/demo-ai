/* ============================================================================
   Rendering and interaction for both pages.

   Two pages are the whole site. Cart, checkout, search and wishlist are
   overlays on them, and the category page is index.html filtered by a query
   parameter rather than a third file. Handoff 5.0, as amended 4 August 2026.

   Nothing here talks to Dengage. Every event goes through DengageEvents, and
   the guard refuses an ec:*, pageView or sendDeviceEvent call in this file.
   ========================================================================== */
(function (window, document) {
    'use strict';

    /* Read at call time, never captured here. boot.js sets these AFTER every
       module script has been evaluated, so a value captured at this point is
       always the empty default and every label renders as its own key. That is
       the bug this shape exists to prevent, and it is invisible in a diff. */
    function config() { return window.DEMO_CONFIG || {}; }
    function copy() { return window.DEMO_COPY || {}; }
    function symbol() {
        var locale = config().locale;
        return (locale && locale.currencySymbol) || '$';
    }

    /* The tag the digits are grouped by, which is NOT the same question as the
       symbol in front of them. A rupee price groups as 2,64,500 and a dollar price
       as 264,500, and getting that wrong makes a real price look like a typo. Held
       in the config so the generator decides it once per demo rather than this file
       inferring it from a symbol that several currencies share. */
    function numberLocale() {
        var locale = config().locale;
        return (locale && locale.numberLocale) || 'en-US';
    }

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    function t(key, vars) {
        var text = copy()[key] || key;
        Object.keys(vars || {}).forEach(function (name) {
            text = text.replace('{' + name + '}', vars[name]);
        });
        return text;
    }

    /* Money, or the "price on request" string. Never a fabricated zero.

       GROUPED, because toFixed alone renders 26500.00 and a five figure price with
       no separator reads as a longer number than it is. Intl does the grouping the
       store's own locale would, including Indian grouping, which no hand rolled
       three digit split gets right.

       A value that is not a finite number returns null rather than the string
       "NaN", so it renders as "price on request" like any other missing price.
       Non-negotiable 5: better to say nothing than to show a number that is not
       one. */
    function price(value) {
        if (value === null || value === undefined) return null;
        var amount = Number(value);
        if (!isFinite(amount)) return null;
        var digits;
        try {
            digits = new Intl.NumberFormat(numberLocale(), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } catch (err) {
            /* An engine without Intl, or a locale tag it does not know. Ungrouped
               is worse than grouped and better than nothing. */
            digits = amount.toFixed(2);
        }
        /* A SPACE ONLY AFTER A SYMBOL THAT IS MORE THAN ONE CHARACTER. $12.00 and
           £12.00 are written closed up, and CHF12.00, AED12.00 and R$12.00 read as
           one run of characters rather than as money. The length test is the rule
           itself rather than a list to maintain: every single character symbol here
           is one that closes up, and every multi character one is a code or an
           abbreviation that does not. */
        var mark = symbol();
        return mark + (mark.length > 1 ? ' ' : '') + digits;
    }

    function param(name) {
        var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
        if (!m) return null;
        try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (err) { return m[1]; }
    }

    /* ------------------------------------------------------------------ */
    /* Product card                                                        */

    function stockLine(product) {
        if (product.stockCount === null) return '';          /* unknown, say nothing */
        if (product.stockCount === 0) return '<div class="card-stock out">' + t('outOfStock') + '</div>';
        if (product.stockCount <= 5) return '<div class="card-stock">' + t('lowStock', { n: product.stockCount }) + '</div>';
        return '';
    }

    function priceBlock(product) {
        var now = price(window.Catalog.effectivePrice(product));
        if (now === null) return '<div class="card-price"><span class="none">' + t('priceOnRequest') + '</span></div>';
        var was = product.discountedPrice !== null ? price(product.price) : null;
        return '<div class="card-price"><span class="now">' + now + '</span>' +
               (was ? '<span class="was">' + was + '</span>' : '') + '</div>';
    }

    var HEART = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7 3.4C19 15.4 12 20 12 20z"/></svg>';

    function card(product) {
        var esc = window.Catalog.escapeAttr;
        return '<article class="card" data-id="' + esc(product.id) + '">' +
            '<div class="card-media">' + window.Catalog.media(product) +
              '<button type="button" class="card-save" data-save="' + esc(product.id) + '" ' +
              'aria-pressed="' + (window.Store.isSaved(product.id) ? 'true' : 'false') + '" ' +
              'aria-label="' + esc(t('save')) + '">' + HEART + '</button>' +
            '</div>' +
            '<div class="card-body">' +
              '<span class="card-cat">' + window.Catalog.escapeText(product.categoryPath) + '</span>' +
              '<h3 class="card-name"><a href="' + esc(product.url) + '">' +
                window.Catalog.escapeText(product.name) + '</a></h3>' +
              priceBlock(product) + stockLine(product) +
              '<button type="button" class="btn btn-block" data-add="' + esc(product.id) + '"' +
                (product.stockCount === 0 ? ' disabled' : '') + '>' +
                (product.stockCount === 0 ? t('outOfStock') : t('addToCart')) + '</button>' +
            '</div>' +
        '</article>';
    }

    function renderInto(selector, list) {
        var host = $(selector);
        if (!host) return;
        host.innerHTML = list.map(card).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Home, listing and category                                          */

    var activeCategory = null;

    function renderNav() {
        var nav = $('#site-nav');
        if (!nav) return;
        var cats = window.Catalog.categories();
        var links = ['<a href="index.html"' + (!activeCategory ? ' aria-current="true"' : '') + '>' +
                     t('navAll') + '</a>'];
        /* The header has no horizontal slack. A prospect with fourteen top level
           categories would break the layout, so take what fits and let the rest
           be reachable from the filter chips. Handoff 7.1a. */
        cats.slice(0, 6).forEach(function (c) {
            links.push('<a href="index.html?category=' + encodeURIComponent(c) + '"' +
                (activeCategory === c ? ' aria-current="true"' : '') + '>' +
                window.Catalog.escapeText(c) + '</a>');
        });
        nav.innerHTML = links.join('');
    }

    function renderFilters() {
        var host = $('#filters');
        if (!host) return;
        var cats = window.Catalog.categories();
        host.innerHTML = ['<button type="button" class="chip" data-filter="" aria-pressed="' +
            (!activeCategory ? 'true' : 'false') + '">' + t('filterAll') + '</button>']
            .concat(cats.map(function (c) {
                return '<button type="button" class="chip" data-filter="' + window.Catalog.escapeAttr(c) +
                    '" aria-pressed="' + (activeCategory === c ? 'true' : 'false') + '">' +
                    window.Catalog.escapeText(c) + '</button>';
            })).join('');
    }

    function renderGrid() {
        var list = window.Catalog.inCategory(activeCategory);
        renderInto('#product-grid', list);
        var head = $('#grid-title');
        if (head) head.textContent = activeCategory || t('gridTitle');
        var count = $('#grid-count');
        if (count) count.textContent = t('gridCount', { n: list.length });
    }

    function setCategory(category, fromUser) {
        activeCategory = category || null;
        renderNav();
        renderFilters();
        renderGrid();
        if (fromUser) {
            /* A category view is a page view in its own right, with page_type
               'category' and the hierarchical category_path, which is what makes
               category targeting and segmentation work. */
            var sample = window.Catalog.inCategory(activeCategory)[0];
            window.DengageEvents.pageview(activeCategory ? 'category' : 'home', {
                categoryPath: activeCategory ? (sample ? sample.categoryPath.split('>')[0].trim() : activeCategory) : undefined
            });
        }
    }

    function bootHome() {
        activeCategory = param('category');
        renderNav();
        renderFilters();
        renderGrid();

        var rail = $('#rail-featured');
        if (rail) {
            var featured = window.Catalog.all().slice(0, 8);
            rail.innerHTML = featured.map(card).join('');
        }

        /* pageView first, before anything else on the page. It is the On-Site
           trigger and the per-demo manifest. Handoff 6.1, 13. */
        window.DengageEvents.pageview(activeCategory ? 'category' : 'home', {
            categoryPath: activeCategory || undefined
        });
    }

    /* ------------------------------------------------------------------ */
    /* Product detail                                                      */

    function bootProduct() {
        var product = window.Catalog.get(param('id') || '');
        var host = $('#pdp');
        if (!host) return;

        if (!product) {
            host.innerHTML = '<p class="empty">' + t('searchNone', { q: param('id') || '' }) + '</p>';
            window.DengageEvents.pageview('other');
            return;
        }

        var esc = window.Catalog.escapeAttr;
        var now = price(window.Catalog.effectivePrice(product));
        var was = product.discountedPrice !== null ? price(product.price) : null;

        var attrs = Object.keys(product.attributes).map(function (k) {
            return '<div><dt>' + window.Catalog.escapeText(k) + '</dt><dd>' +
                   window.Catalog.escapeText(product.attributes[k]) + '</dd></div>';
        }).join('');

        host.innerHTML =
            '<div class="pdp-media">' + window.Catalog.media(product) + '</div>' +
            '<div>' +
              '<p class="crumb">' + window.Catalog.escapeText(product.categoryPath) + '</p>' +
              '<h1>' + window.Catalog.escapeText(product.name) + '</h1>' +
              '<div class="price">' +
                (now === null
                  ? '<span class="none">' + t('priceOnRequest') + '</span>'
                  : '<span class="now">' + now + '</span>' + (was ? '<span class="was">' + was + '</span>' : '')) +
              '</div>' +
              stockLine(product) +
              /* The inline slot under the price block, one of the five. */
              '<div id="dn_inline_target_pdp_below_price"></div>' +
              (attrs ? '<dl class="attrs">' + attrs + '</dl>' : '') +
              '<div class="actions">' +
                '<button type="button" class="btn" data-add="' + esc(product.id) + '"' +
                  (product.stockCount === 0 ? ' disabled' : '') + '>' +
                  (product.stockCount === 0 ? t('outOfStock') : t('addToCart')) + '</button>' +
                '<button type="button" class="btn btn-quiet" data-save="' + esc(product.id) + '" ' +
                  'aria-pressed="' + (window.Store.isSaved(product.id) ? 'true' : 'false') + '">' +
                  (window.Store.isSaved(product.id) ? t('saved') : t('save')) + '</button>' +
              '</div>' +
            '</div>';

        renderInto('#rail-similar', window.Catalog.similar(product, 6));
        renderInto('#rail-viewed', window.Catalog.alsoViewed(product, 6));

        /* Record the view AFTER rendering the rails, so "recently viewed" does not
           list the product currently on screen as something recently viewed
           elsewhere. js/recommend.js owns the list and its session scoping. */
        if (window.Recommend) window.Recommend.noteViewed(product.id);

        /* price, discounted_price and stock_count are sent only when the
           catalogue genuinely produced them. The emitter drops the key
           otherwise, so an unknown stock count never arrives as zero and never
           announces the product out of stock. Handoff 1.8, 6.1. */
        window.DengageEvents.pageview('product', {
            productId: product.id,
            categoryPath: product.categoryPath,
            price: product.price,
            discountedPrice: product.discountedPrice,
            stockCount: product.stockCount
        });
    }

    /* ------------------------------------------------------------------ */
    /* Overlays                                                            */

    function openOverlay(id) {
        var el = $(id);
        if (!el) return;
        el.classList.add('open');
        $('#scrim').classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeOverlays() {
        $$('.drawer, .modal').forEach(function (el) { el.classList.remove('open'); });
        var scrim = $('#scrim');
        if (scrim) scrim.classList.remove('open');
        document.body.style.overflow = '';
    }

    function renderCart() {
        var body = $('#cart-body');
        var foot = $('#cart-foot');
        if (!body) return;
        var lines = window.Store.cart();

        if (!lines.length) {
            body.innerHTML = '<p class="empty">' + t('cartEmpty') + '</p>';
            if (foot) foot.innerHTML = '';
        } else {
            body.innerHTML = lines.map(function (l) {
                var unit = l.discountedPrice !== null && l.discountedPrice !== undefined ? l.discountedPrice : l.price;
                var shown = price(unit === null || unit === undefined ? null : unit * l.quantity);
                return '<div class="line">' +
                    '<div class="line-info">' +
                      '<div class="line-name">' + window.Catalog.escapeText(l.name) + '</div>' +
                      '<div class="line-meta">' + l.quantity + ' x ' +
                        (price(unit) || t('priceOnRequest')) + '</div>' +
                    '</div>' +
                    '<div class="line-name">' + (shown || '') + '</div>' +
                    /* The x is the control, and the accessible name still says
                       "Remove" so a screen reader and the copy file agree. An icon
                       with no name is a button that only sighted users can use. */
                    '<button type="button" class="line-x" data-remove="' +
                      window.Catalog.escapeAttr(l.id) + '" title="' +
                      window.Catalog.escapeAttr(t('cartRemove')) + '" aria-label="' +
                      window.Catalog.escapeAttr(t('cartRemove')) + '">&times;</button>' +
                '</div>';
            }).join('');

            var total = window.Store.cartTotal();
            if (foot) {
                foot.innerHTML =
                    '<div class="total"><span>' + t('cartTotal') + '</span><span>' +
                      (price(total) || t('priceOnRequest')) + '</span></div>' +
                    '<button type="button" class="btn btn-block" id="to-checkout"' +
                      (total === null ? ' disabled' : '') + '>' + t('cartCheckout') + '</button>';
            }
        }

        var badge = $('#cart-badge');
        if (badge) {
            var n = window.Store.cartCount();
            badge.textContent = n;
            badge.hidden = n === 0;
        }
    }

    function renderWishlist() {
        var body = $('#wishlist-body');
        if (!body) return;
        var items = window.Store.wishlist();
        body.innerHTML = items.length
            ? items.map(function (w) {
                return '<div class="line">' +
                    '<div class="line-info">' +
                      '<div class="line-name">' + window.Catalog.escapeText(w.name) + '</div>' +
                      '<div class="line-meta">' + window.Catalog.escapeText(w.listName) + '</div>' +
                    '</div>' +
                    /* data-unsave, NOT data-remove. The cart's remove and the
                       wishlist's removal are different events landing in different
                       tables, and one attribute serving both would have sent a
                       cart event for a wishlist action. */
                    '<button type="button" class="line-x" data-unsave="' +
                      window.Catalog.escapeAttr(w.id) + '" title="' +
                      window.Catalog.escapeAttr(t('wishlistRemove')) + '" aria-label="' +
                      window.Catalog.escapeAttr(t('wishlistRemove')) + '">&times;</button>' +
                '</div>';
              }).join('')
            : '<p class="empty">' + t('wishlistEmpty') + '</p>';

        var badge = $('#wishlist-badge');
        if (badge) { badge.textContent = items.length; badge.hidden = items.length === 0; }
    }

    /* ------------------------------------------------------------------ */
    /* Account: identification, not authentication                         */

    /* THE DIFFERENCE IS THE WHOLE DESIGN OF THIS MODAL, so it is stated here
       rather than left implicit.

       The Web SDK exposes setContactKey and no lookup. A page cannot ask whether
       a contact exists, so there is no password to check, no "not found" to
       report, and no failure path. An unknown key does not error: it CREATES
       that contact. That is how ddemo-phase0-probe-1 came into being in Phase 0,
       from nothing but a ?ck= parameter.

       So the risk is not a wrong password, it is a TYPO. Account 28 is shared
       with five live demo sites, and a mistyped key mints a junk contact there
       that the 90 day purge cannot find, because the purge filters on
       DPS-<slug>-.

       The field therefore shows the prefix as fixed text and accepts only the
       remainder. A key outside the namespace is not rejected, it is untypeable.
       Same reasoning as the event panel having no table name field: structural
       beats defensive, because the person using it on a call will not know why
       it matters. Handoff 5.3, 6.2.

       The operator escape hatch is still ?ck= in the URL, which identity.js
       resolves before initialize runs and does not constrain. That is the
       documented path for demoing as a specific existing contact, and it is a
       deliberate asymmetry: a URL is typed once by someone who knows what they
       are doing, a form is used live in front of a prospect. */

    /* JUST 'DPS-', WITH NO SLUG. Salil's call: it is typed live on a call and
       shorter wins.

       ONE CONSEQUENCE, recorded here rather than discovered later. Contact keys are
       no longer per demo, so DPS-1 on a fashion demo and DPS-1 on an electronics
       demo are the SAME contact and their events accumulate on one record. For a
       demo that is usually what you want: one recognisable person to point at.

       It does not weaken the isolation that matters. Storage stays namespaced by
       slug, dps:<slug>:ck, so opening a second demo never adopts the first one's
       identity and the cart and wishlist stay separate. That was the collision
       worth preventing, and it is still prevented in the layer that prevents it.

       Order ids keep their slug, in js/store.js, and that asymmetry is deliberate:
       an order id has to be unique in order_events, which is shared with five live
       demo sites, while a contact key is meant to be recognisable and reused.

       What this costs is per-demo attribution of contacts. Nothing depends on it
       today, because the row purge is parked (handoff 10) and factory contacts are
       identified by the DPS- marker rather than by demo. If that changes, put the
       slug back here and nowhere else. */
    function keyPrefix() {
        return 'DPS-';
    }

    function currentKey() {
        return (window.DemoIdentity && window.DemoIdentity.contactKey) || null;
    }

    function renderAccount() {
        var host = $('#account-body');
        if (!host) return;
        var key = currentKey();
        var esc = window.Catalog.escapeText;

        if (key) {
            host.innerHTML =
                '<div class="who"><span class="dot"></span><code>' + esc(key) + '</code></div>' +
                '<p class="note">' + t('accountSignedInBody') + '</p>' +
                '<button type="button" class="btn btn-quiet btn-block" id="account-signout" ' +
                    'style="margin-top:16px">' + t('accountSignOut') + '</button>';
        } else {
            host.innerHTML =
                '<h3 style="font-size:14px;margin-bottom:6px">' + t('accountSignInTitle') + '</h3>' +
                '<p class="note" style="margin-top:0">' + t('accountSignInBody') + '</p>' +
                '<div class="field" style="margin-top:14px">' +
                  '<label for="account-key">' + t('accountKeyLabel') + '</label>' +
                  '<div class="affix">' +
                    '<span class="fixed">' + esc(keyPrefix()) + '</span>' +
                    '<input type="text" id="account-key" autocomplete="off" spellcheck="false" ' +
                      'inputmode="text" placeholder="1">' +
                  '</div>' +
                  '<span class="note" style="margin-top:6px;display:block">' + t('accountKeyHint') + '</span>' +
                  '<span class="field-error" id="account-error" hidden></span>' +
                '</div>' +
                '<button type="button" class="btn btn-block" id="account-signin">' +
                  t('accountSignIn') + '</button>' +
                '<div class="divider">' + t('accountRegisterTitle') + '</div>' +
                '<p class="note" style="margin-top:0">' + t('accountRegisterBody') + '</p>' +
                '<button type="button" class="btn btn-quiet btn-block" id="account-register" ' +
                    'style="margin-top:12px">' + t('accountRegister') + '</button>';
        }

        var button = $('#account-btn');
        if (button) {
            if (key) button.setAttribute('data-identified', 'true');
            else button.removeAttribute('data-identified');
        }
    }

    function signIn() {
        var input = $('#account-key');
        var error = $('#account-error');
        if (!input) return;

        /* Whitespace and case are the two things a person typing a key on a call
           gets wrong. Both are silent: the contact is created either way, just
           not the one they meant. */
        var suffix = input.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (!suffix) {
            if (error) {
                error.textContent = t('accountInvalid', { prefix: keyPrefix() });
                error.hidden = false;
            }
            input.focus();
            return;
        }

        var key = keyPrefix() + suffix;
        if (!window.DengageEvents.setContactKey(key)) return;

        window.DemoIdentity.contactKey = key;
        /* The same storage identity.js reads, so a reload keeps the identity and
           the SDK initializes with the key already attached. */
        try { window.sessionStorage.setItem(window.DemoIdentity.storageKey, key); } catch (err) { /* private mode */ }

        /* A page view AFTER identification, so there is a row on the contact
           rather than only on the anonymous device. This is the moment worth
           showing on a call: the contact card fills in while the prospect
           watches. page_type 'login' is in the documented vocabulary. */
        window.DengageEvents.pageview('login');

        renderAccount();
    }

    function signOut() {
        var storageKey = window.DemoIdentity.storageKey;
        try { window.sessionStorage.removeItem(storageKey); } catch (err) { /* private mode */ }
        try { window.localStorage.removeItem(storageKey); } catch (err) { /* private mode */ }
        window.DemoIdentity.contactKey = null;
        window.DengageEvents.pageview('logout');

        /* A RELOAD IS THE ONLY HONEST WAY BACK TO ANONYMOUS. The SDK has no
           method to detach a contact key from a device, so the key stays on this
           page's SDK instance until the page is replaced. Clearing storage alone
           would leave the modal saying signed out while events kept arriving on
           the contact.

           ck= is stripped from the query, otherwise the reloaded page reads it
           straight back out of the URL and signs in again.

           The wait is not cosmetic: an event sent as navigation begins can be
           cancelled before it leaves the browser, which would lose the logout
           page view that was the point of firing it. */
        var search = window.location.search
            .replace(/([?&])ck=[^&]*&?/, '$1')
            .replace(/[?&]$/, '');
        setTimeout(function () {
            window.location.href = window.location.pathname + search;
        }, 350);
    }

    function wireAccount() {
        document.addEventListener('click', function (event) {
            var id = event.target.id;
            if (id === 'account-signin') signIn();
            else if (id === 'account-signout') signOut();
            else if (id === 'account-register') {
                /* Registration is the subscription creative, because the SDK
                   cannot write a contact's name, email, phone or permissions and
                   the engine's native form can. Handoff 12.4.

                   The modal closes first. The creative renders in the engine's
                   own container, and leaving our scrim up over it makes a widget
                   that fired look like a widget that did not. */
                closeOverlays();
                window.DengageEvents.scenario('subscription-popup');
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && event.target.id === 'account-key') {
                event.preventDefault();
                signIn();
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Search, once per settled query                                      */

    var searchTimer = null;
    var lastFired = '';

    function runSearch(term, force) {
        var results = window.Catalog.search(term);
        var host = $('#search-results');
        if (host) {
            host.innerHTML = !term.trim()
                ? ''
                : (results.length
                    ? '<p class="note">' + t('searchCount', { n: results.length, q: term }) + '</p>' +
                      '<div class="grid">' + results.slice(0, 8).map(card).join('') + '</div>'
                    : '<p class="empty">' + t('searchNone', { q: window.Catalog.escapeText(term) }) + '</p>');
        }
        /* Fires once per SETTLED query, never per keystroke. Without this the
           table records "m", "ma", "mar", "mars", and describes typing rather
           than intent. Handoff 5.3. */
        if (term.trim() && (force || term !== lastFired)) {
            lastFired = term;
            window.DengageEvents.search(term, results.length);
        }
    }

    function wireSearch() {
        var input = $('#search-input');
        if (!input) return;
        input.addEventListener('input', function () {
            var term = input.value;
            if (searchTimer) clearTimeout(searchTimer);
            /* 700ms settle, or Enter, or a filter change. */
            searchTimer = setTimeout(function () { runSearch(term, false); }, 700);
        });
        input.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (searchTimer) clearTimeout(searchTimer);
            runSearch(input.value, true);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Checkout                                                            */

    function wireCheckout() {
        document.addEventListener('click', function (event) {
            if (event.target.id === 'to-checkout') {
                window.Store.beginCheckout();
                closeOverlays();
                openOverlay('#checkout');
                var total = window.Store.cartTotal();
                var summary = $('#checkout-summary');
                if (summary) {
                    summary.innerHTML = '<div class="total"><span>' + t('cartTotal') + '</span><span>' +
                        (price(total) || '') + '</span></div>';
                }
            }
            if (event.target.id === 'place-order') {
                var result = window.Store.placeOrder($('#payment-method') ? $('#payment-method').value : 'credit_card');
                var body = $('#checkout-body');
                if (result && body) {
                    body.innerHTML = '<p class="note">' + t('checkoutDone') + '</p>' +
                        '<p class="note">' + t('checkoutRef') + ': <code>' +
                        window.Catalog.escapeText(result.orderId) + '</code></p>' +
                        '<button type="button" class="btn btn-block" data-close="1">' + t('continue') + '</button>';
                }
                renderCart();
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Delegated interaction                                               */

    function wire() {
        document.addEventListener('click', function (event) {
            var el = event.target.closest ? event.target.closest('[data-add],[data-save],[data-remove],[data-unsave],[data-filter],[data-open],[data-close]') : null;
            if (!el) return;

            var id;
            if (el.hasAttribute('data-add')) {
                id = el.getAttribute('data-add');
                var product = window.Catalog.get(id);
                if (product) {
                    window.Store.addToCart(product, 1);
                    el.textContent = t('addedToCart');
                    setTimeout(function () { el.textContent = t('addToCart'); }, 1200);
                }
            } else if (el.hasAttribute('data-save')) {
                id = el.getAttribute('data-save');
                var saveProduct = window.Catalog.get(id);
                if (saveProduct) {
                    var saved = window.Store.toggleWishlist(saveProduct);
                    el.setAttribute('aria-pressed', saved ? 'true' : 'false');
                    if (el.classList.contains('btn')) el.textContent = saved ? t('saved') : t('save');
                }
            } else if (el.hasAttribute('data-remove')) {
                window.Store.removeFromCart(el.getAttribute('data-remove'));
            } else if (el.hasAttribute('data-unsave')) {
                window.Store.removeFromWishlist(el.getAttribute('data-unsave'));
            } else if (el.hasAttribute('data-filter')) {
                setCategory(el.getAttribute('data-filter'), true);
            } else if (el.hasAttribute('data-open')) {
                var target = el.getAttribute('data-open');
                openOverlay(target);
                /* The overlay animates in, so focus waits for it. Focusing a
                   pointer-events:none element does nothing. */
                var focusOn = target === '#search' ? '#search-input'
                            : target === '#account' ? '#account-key' : null;
                if (focusOn) {
                    setTimeout(function () {
                        var input = $(focusOn);
                        if (input) input.focus();
                    }, 60);
                }
            } else if (el.hasAttribute('data-close')) {
                closeOverlays();
            }
        });

        var scrim = $('#scrim');
        if (scrim) scrim.addEventListener('click', closeOverlays);
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeOverlays();
        });

        /* The category nav on a narrow screen. The class goes on the header rather
           than the nav so the CSS can style either from one hook, and the state
           lives in aria-expanded rather than in a variable here so the button and
           the screen reader can never disagree.

           Not part of the overlay set above on purpose: it is not an overlay, it
           carries no scrim, and closeOverlays must not reach it. */
        var navToggle = $('#nav-toggle');
        var header = $('#header');
        if (navToggle && header) {
            navToggle.addEventListener('click', function () {
                var open = header.classList.toggle('nav-open');
                navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            /* Following a category leaves the panel open behind the new page on a
               browser that restores scroll, so close it on the way out. */
            header.addEventListener('click', function (event) {
                var link = event.target.closest ? event.target.closest('#site-nav a') : null;
                if (!link) return;
                header.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        }

        window.Store.onChange(function () { renderCart(); renderWishlist(); });
    }

    /* ------------------------------------------------------------------ */
    /* Boot                                                                */

    function boot() {
        var pageType = document.body.getAttribute('data-page-type') || 'other';
        wire();
        wireSearch();
        wireCheckout();
        wireAccount();
        renderCart();
        renderWishlist();
        renderAccount();

        if (pageType === 'product') bootProduct();
        else bootHome();

        if (window.Panels) window.Panels.init();
        if (window.Slots) window.Slots.init();
        if (window.Inbox) window.Inbox.boot();

        openFromUrl();
    }

    /* ------------------------------------------------------------------ */
    /* index.html?open=cart                                                */

    /* WHY A URL HAS TO BE ABLE TO OPEN AN OVERLAY. The basket, the checkout, the
       search and the saved items are overlays on this page rather than pages of
       their own, so there is no cart.html to link to. Every message this factory
       sends has a button, and the whole proposition of an abandoned cart email is
       that pressing it lands on the basket that survived. Without this it lands on
       a 404, which is the worst thing a demo can do on a call.

       Named rather than open ended: the parameter selects from this list and
       nothing else, so a link cannot be crafted to add a class to an arbitrary
       element. */
    var OPENABLE = {
        cart: '#cart',
        checkout: '#checkout',
        search: '#search',
        account: '#account',
        wishlist: '#wishlist'
    };

    function openFromUrl() {
        var wanted = String(param('open') || '').toLowerCase();
        if (!wanted) return;
        var id = OPENABLE[wanted];
        if (!id) return;
        /* After the render above, so the basket the email is about is already drawn
           when the overlay appears rather than filling in a moment later. */
        openOverlay(id);
        if (wanted === 'search') {
            var input = $('#search-input');
            if (input) input.focus();
        }
    }

    window.Storefront = {
        boot: boot, card: card, price: price, t: t,
        closeOverlays: closeOverlays,
        /* The launcher opens the inbox drawer from its own card, so opening has
           to be reachable from outside this module rather than only from a
           data-open click. */
        openOverlay: openOverlay,
        /* Exposed for the smoke test, which asserts the namespace rule holds
           without reaching into a closure. */
        keyPrefix: keyPrefix
    };
})(window, document);
