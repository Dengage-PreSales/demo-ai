/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    function config() { return window.DEMO_CONFIG || {}; }
    function copy() { return window.DEMO_COPY || {}; }
    function symbol() {
        var locale = config().locale;
        return (locale && locale.currencySymbol) || '$';
    }

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

            digits = amount.toFixed(2);
        }

        var mark = symbol();
        return mark + (mark.length > 1 ? ' ' : '') + digits;
    }

    function param(name) {
        var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
        if (!m) return null;
        try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (err) { return m[1]; }
    }

    function stockLine(product) {
        if (product.stockCount === null) return '';
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

    var activeCategory = null;

    function renderNav() {
        var nav = $('#site-nav');
        if (!nav) return;
        var cats = window.Catalog.categories();
        var links = ['<a href="index.html"' + (!activeCategory ? ' aria-current="true"' : '') + '>' +
                     t('navAll') + '</a>'];

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

        window.DengageEvents.pageview(activeCategory ? 'category' : 'home', {
            categoryPath: activeCategory || undefined
        });
    }

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

        if (window.Recommend) window.Recommend.noteViewed(product.id);

        window.DengageEvents.pageview('product', {
            productId: product.id,
            categoryPath: product.categoryPath,
            price: product.price,
            discountedPrice: product.discountedPrice,
            stockCount: product.stockCount
        });
    }

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

        try { window.sessionStorage.setItem(window.DemoIdentity.storageKey, key); } catch (err) {  }

        window.DengageEvents.pageview('login');

        renderAccount();
    }

    function signOut() {
        var storageKey = window.DemoIdentity.storageKey;
        try { window.sessionStorage.removeItem(storageKey); } catch (err) {  }
        try { window.localStorage.removeItem(storageKey); } catch (err) {  }
        window.DemoIdentity.contactKey = null;
        window.DengageEvents.pageview('logout');

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

            searchTimer = setTimeout(function () { runSearch(term, false); }, 700);
        });
        input.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (searchTimer) clearTimeout(searchTimer);
            runSearch(input.value, true);
        });
    }

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

        var navToggle = $('#nav-toggle');
        var header = $('#header');
        if (navToggle && header) {
            navToggle.addEventListener('click', function () {
                var open = header.classList.toggle('nav-open');
                navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            header.addEventListener('click', function (event) {
                var link = event.target.closest ? event.target.closest('#site-nav a') : null;
                if (!link) return;
                header.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        }

        window.Store.onChange(function () { renderCart(); renderWishlist(); });
    }

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

        openOverlay(id);
        if (wanted === 'search') {
            var input = $('#search-input');
            if (input) input.focus();
        }
    }

    window.Storefront = {
        boot: boot, card: card, price: price, t: t,
        closeOverlays: closeOverlays,

        openOverlay: openOverlay,

        keyPrefix: keyPrefix
    };
})(window, document);
