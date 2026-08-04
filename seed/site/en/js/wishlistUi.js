/* ============================================================================
   Wishlist interface: header button, heart on every product card, save button
   on the product page, and a drawer listing what is saved.

   BYTE-IDENTICAL across all four demo sites. Per-site values arrive on the
   script tag, and the interface language is read from <html lang>, so this file
   serves the Portuguese CantuPneus site and the three English sites unchanged:

     <script src="js/wishlistUi.js"
             data-ns="cantupneus"
             data-global="CantuWishlist"
             data-catalog="CantuCatalogData"></script>

   ---------------------------------------------------------------------------
   Three things this file deliberately does NOT do.

   It does not ship a stylesheet change. Everything it needs is injected here,
   written against the design tokens every site already defines (--color-gold,
   --color-charcoal, --font-display and friends). The same CSS therefore comes
   out purple on CantuPneus, indigo on NovaPay and navy on Meridian, and no
   existing rule is touched.

   It does not own an "add to cart" path. The buttons it renders in the drawer
   carry data-cart-add and the standard data-product-* attributes, which the
   cart's own delegated handler in cartUi.js already listens for. One cart
   implementation, not two.

   It does not edit productList.js to add hearts to cards. It observes the grid
   and decorates whatever cards appear, which also covers cards that arrive
   later from a recommendation or a search result.
   ========================================================================== */
(function () {
    'use strict';

    var el = document.currentScript;
    var cfg = (el && el.dataset) || {};

    var NS = cfg.ns || 'site';
    var GLOBAL = cfg.global || 'DnWishlist';
    var CATALOG = cfg.catalog || '';

    /* The finance sites have no cart, they have an application, and their own
       product cards say "Add to application". So the drawer's button label comes
       from the tag rather than being hardcoded, and falls back to the
       translation below when a site does not set it. */
    var ADD_LABEL = cfg.addLabel || '';

    /* Interface language from the document, so it cannot drift from the page.
       Three sites share this file byte for byte, so the copy lives here keyed
       by language rather than in three near-identical forks. */
    var LANG = /^(pt|ru)/i.test(document.documentElement.lang || '')
        ? document.documentElement.lang.slice(0, 2).toLowerCase()
        : 'en';

    var COPY = {
        pt: {
            openLabel: 'Abrir favoritos',
            eyebrow: 'Favoritos',
            title: 'Suas medidas salvas',
            close: 'Fechar favoritos',
            empty: 'Nenhuma medida salva ainda. Toque no coração em qualquer produto.',
            clear: 'Limpar lista',
            addToCart: 'Adicionar ao carrinho',
            remove: 'Remover',
            save: 'Salvar medida',
            saved: 'Medida salva',
            saveShort: 'Salvar',
            savedToast: 'Salvo nos favoritos.',
            removedToast: 'Removido dos favoritos.',
            lowStock: 'restam',
            mobile: 'Favoritos',
            locale: 'pt-BR'
        },
        en: {
            openLabel: 'Open saved items',
            eyebrow: 'Saved',
            title: 'Your saved items',
            close: 'Close saved items',
            empty: 'Nothing saved yet. Tap the heart on any product.',
            clear: 'Clear list',
            addToCart: 'Add to cart',
            remove: 'Remove',
            save: 'Save this item',
            saved: 'Saved',
            saveShort: 'Save',
            savedToast: 'Saved to your list.',
            removedToast: 'Removed from your list.',
            lowStock: 'left',
            mobile: 'Saved',
            locale: 'en-US'
        },
        ru: {
            openLabel: 'Открыть избранное',
            eyebrow: 'Избранное',
            title: 'Сохранённые типоразмеры',
            close: 'Закрыть избранное',
            empty: 'Пока ничего не сохранено. Нажмите на сердечко у любого товара.',
            clear: 'Очистить список',
            addToCart: 'В корзину',
            remove: 'Удалить',
            save: 'Сохранить типоразмер',
            saved: 'Типоразмер сохранён',
            saveShort: 'Сохранить',
            savedToast: 'Добавлено в избранное.',
            removedToast: 'Удалено из избранного.',
            lowStock: 'осталось',
            mobile: 'Избранное',
            locale: 'ru-RU'
        }
    };

    var T = COPY[LANG] || COPY.en;

    var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        + '<path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21Z"></path>'
        + '</svg>';

    function wishlist() { return window[GLOBAL] || null; }
    function catalog() { return (CATALOG && window[CATALOG]) || null; }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function money(value, currency) {
        try {
            return new Intl.NumberFormat(T.locale, {
                style: 'currency',
                currency: currency || 'USD'
            }).format(Number(value) || 0);
        } catch (err) {
            return String(value);
        }
    }

    /* The cart's toast, reused rather than reinvented. */
    function showToast(message) {
        var toast = document.getElementById('loginSuccessMessage');
        if (!toast) return;

        clearTimeout(window.dnWishlistToastTimer);
        toast.textContent = message;
        toast.classList.add('active');
        window.dnWishlistToastTimer = setTimeout(function () {
            toast.classList.remove('active');
        }, 2000);
    }

    /* ------------------------------------------------------------------ styles
       Written entirely in the host site's own tokens, so it themes itself. */
    function injectStyles() {
        if (document.getElementById('dnw-styles')) return;

        var style = document.createElement('style');
        style.id = 'dnw-styles';
        style.textContent = [
            /* the card needs a positioning context for the heart; it has no
               positioned children today, so this changes nothing visually */
            '.product-card{position:relative;}',

            '.dnw-heart{position:absolute;top:10px;right:10px;z-index:4;',
            'width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;',
            'border:1px solid rgba(0,0,0,.12);border-radius:50%;cursor:pointer;',
            'background:rgba(255,255,255,.92);color:var(--color-taupe);',
            'transition:color .25s ease,background .25s ease,transform .25s ease;padding:0;}',
            '.dnw-heart svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;}',
            '.dnw-heart:hover{color:var(--color-gold);transform:scale(1.08);}',
            '.dnw-heart.is-saved{color:var(--color-gold);border-color:var(--color-gold);}',
            '.dnw-heart.is-saved svg{fill:currentColor;}',

            /* save button on the product page, next to add to cart */
            '.dnw-save-btn{display:inline-flex;align-items:center;gap:.5rem;',
            'padding:0 1.1rem;min-height:52px;cursor:pointer;',
            'border:1px solid var(--color-charcoal);background:transparent;',
            'color:var(--color-charcoal);font-size:.78rem;letter-spacing:.08em;',
            'text-transform:uppercase;font-weight:600;transition:all .3s ease;}',
            '.dnw-save-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;}',
            '.dnw-save-btn:hover{background:var(--color-charcoal);color:var(--color-warm-white);}',
            '.dnw-save-btn.is-saved{border-color:var(--color-gold);color:var(--color-gold);}',
            '.dnw-save-btn.is-saved svg{fill:currentColor;}',
            '.dnw-save-btn.is-saved:hover{background:var(--color-gold);color:var(--color-warm-white);}',

            /* drawer, mirroring the cart drawer's geometry and z tier */
            '.dnw-drawer{position:fixed;inset:0;z-index:3100;display:none;}',
            '.dnw-drawer.is-open{display:block;}',
            '.dnw-drawer-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);}',
            '.dnw-drawer-panel{position:absolute;top:0;right:0;height:100%;width:100%;',
            'max-width:420px;background:var(--color-warm-white);display:flex;flex-direction:column;',
            'box-shadow:-14px 0 40px rgba(0,0,0,.18);animation:dnw-slide .32s ease;}',
            '@keyframes dnw-slide{from{transform:translateX(28px);opacity:.4;}to{transform:none;opacity:1;}}',
            '.dnw-drawer-header{display:flex;align-items:flex-start;justify-content:space-between;',
            'gap:1rem;padding:1.6rem 1.4rem 1.1rem;border-bottom:1px solid var(--color-ivory);}',
            '.dnw-eyebrow{font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;',
            'color:var(--color-taupe);margin:0 0 .35rem;}',
            '.dnw-drawer-title{font-family:var(--font-display);font-size:1.55rem;line-height:1.15;',
            'color:var(--color-charcoal);margin:0;}',
            '.dnw-drawer-close{width:36px;height:36px;flex-shrink:0;border:0;background:transparent;',
            'font-size:1.6rem;line-height:1;cursor:pointer;color:var(--color-charcoal);}',
            '.dnw-items{flex:1;overflow-y:auto;padding:1.1rem 1.4rem;display:grid;gap:1rem;',
            'align-content:start;}',
            '.dnw-empty{margin:0;padding:1.6rem 1.4rem;color:var(--color-taupe);font-size:.9rem;}',
            '.dnw-item{display:grid;grid-template-columns:74px 1fr;gap:.9rem;',
            'padding-bottom:1rem;border-bottom:1px solid var(--color-ivory);}',
            '.dnw-item:last-child{border-bottom:0;padding-bottom:0;}',
            '.dnw-item img{width:74px;height:74px;object-fit:cover;background:var(--color-ivory);}',
            '.dnw-item-name{font-size:.92rem;font-weight:600;line-height:1.3;margin:0 0 .2rem;',
            'color:var(--color-charcoal);}',
            '.dnw-item-name a{color:inherit;text-decoration:none;}',
            '.dnw-item-name a:hover{text-decoration:underline;}',
            '.dnw-item-price{font-size:.9rem;margin:0 0 .1rem;color:var(--color-charcoal);}',
            '.dnw-item-was{font-size:.78rem;color:var(--color-taupe);text-decoration:line-through;',
            'margin-left:.4rem;}',
            '.dnw-item-stock{font-size:.74rem;color:var(--color-taupe);margin:0 0 .5rem;}',
            '.dnw-item-stock.is-low{color:var(--color-accent-dark);font-weight:600;}',
            '.dnw-item-actions{display:flex;flex-wrap:wrap;gap:.45rem;}',
            '.dnw-item-actions button{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;',
            'font-weight:600;padding:.5rem .75rem;cursor:pointer;border:1px solid var(--color-charcoal);',
            'background:var(--color-charcoal);color:var(--color-warm-white);transition:all .25s ease;}',
            '.dnw-item-actions .dnw-item-remove{background:transparent;color:var(--color-charcoal);}',
            '.dnw-item-actions .dnw-item-remove:hover{background:var(--color-charcoal);',
            'color:var(--color-warm-white);}',
            '.dnw-drawer-footer{padding:1.1rem 1.4rem 1.5rem;border-top:1px solid var(--color-ivory);}',
            '.dnw-clear{width:100%;padding:.85rem;cursor:pointer;font-size:.72rem;font-weight:600;',
            'letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--color-charcoal);',
            'background:transparent;color:var(--color-charcoal);transition:all .25s ease;}',
            '.dnw-clear:hover{background:var(--color-charcoal);color:var(--color-warm-white);}',
            '.dnw-clear:disabled{opacity:.4;cursor:default;}',
            '@media (max-width:640px){.dnw-drawer-panel{max-width:100%;}}'
        ].join('');

        document.head.appendChild(style);
    }

    /* ---------------------------------------------------------- header button */
    function injectHeaderButton() {
        var nav = document.querySelector('.nav-main');
        if (nav && !nav.querySelector('[data-dnw-open]')) {
            var button = document.createElement('button');
            /* borrows the cart button's look, not its behaviour: no
               data-cart-open here, so cartUi never sees it */
            button.className = 'cart-icon-btn dnw-open-btn';
            button.type = 'button';
            button.setAttribute('aria-label', T.openLabel);
            button.setAttribute('data-dnw-open', '');
            button.innerHTML = HEART + '<span class="cart-count" data-dnw-count>0</span>';

            var cartButton = nav.querySelector('.cart-icon-btn:not(.dnw-open-btn)');
            if (cartButton) nav.insertBefore(button, cartButton);
            else nav.appendChild(button);
        }

        var mobile = document.querySelector('.mobile-nav-cta');
        if (mobile && !mobile.querySelector('[data-dnw-open]')) {
            var mobileButton = document.createElement('button');
            mobileButton.className = 'btn-primary dnw-mobile-btn';
            mobileButton.type = 'button';
            mobileButton.setAttribute('data-dnw-open', '');
            mobileButton.innerHTML = escapeHtml(T.mobile) + ' (<span data-dnw-count>0</span>)';
            mobile.appendChild(mobileButton);
        }
    }

    /* ----------------------------------------------------------------- drawer */
    function injectDrawer() {
        if (document.getElementById('dnwDrawer')) return;

        var drawer = document.createElement('div');
        drawer.className = 'dnw-drawer';
        drawer.id = 'dnwDrawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.innerHTML = ''
            + '<div class="dnw-drawer-overlay" data-dnw-close></div>'
            + '<aside class="dnw-drawer-panel" aria-labelledby="dnwDrawerTitle">'
            + '  <div class="dnw-drawer-header">'
            + '    <div>'
            + '      <p class="dnw-eyebrow">' + escapeHtml(T.eyebrow) + '</p>'
            + '      <h2 class="dnw-drawer-title" id="dnwDrawerTitle">' + escapeHtml(T.title) + '</h2>'
            + '    </div>'
            + '    <button class="dnw-drawer-close" type="button" aria-label="' + escapeHtml(T.close) + '" data-dnw-close>&times;</button>'
            + '  </div>'
            + '  <div class="dnw-items" data-dnw-items></div>'
            + '  <p class="dnw-empty" data-dnw-empty>' + escapeHtml(T.empty) + '</p>'
            + '  <div class="dnw-drawer-footer">'
            + '    <button class="dnw-clear" type="button" data-dnw-clear>' + escapeHtml(T.clear) + '</button>'
            + '  </div>'
            + '</aside>';

        document.body.appendChild(drawer);
    }

    function openDrawer() {
        var drawer = document.getElementById('dnwDrawer');
        if (!drawer) return;

        /* the mobile menu and the cart drawer both own body overflow; close
           whichever is open so two panels are never stacked */
        ['mobileNav', 'mobileOverlay'].forEach(function (id) {
            var node = document.getElementById(id);
            if (node) node.classList.remove('active');
        });
        var cart = document.getElementById('cartDrawer');
        if (cart) {
            cart.classList.remove('active');
            cart.setAttribute('aria-hidden', 'true');
        }

        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        var drawer = document.getElementById('dnwDrawer');
        if (!drawer) return;
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    /* --------------------------------------------------------------- rendering */
    function itemRow(item) {
        var url = catalog() ? catalog().buildProductUrl(item.id) : '#';
        var was = item.oldPrice && item.oldPrice > item.price
            ? '<span class="dnw-item-was">' + escapeHtml(money(item.oldPrice, item.currency)) + '</span>'
            : '';

        /* only shown where the catalogue actually tracks stock */
        var stock = item.stock === null || item.stock === undefined
            ? ''
            : '<p class="dnw-item-stock' + (item.stock <= 10 ? ' is-low' : '') + '">'
              + escapeHtml(LANG === 'ru' ? T.lowStock + ' ' + item.stock : item.stock + ' ' + T.lowStock) + '</p>';

        return ''
            + '<article class="dnw-item" data-dnw-item-id="' + escapeHtml(item.id) + '">'
            + '  <img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" loading="lazy">'
            + '  <div>'
            + '    <h3 class="dnw-item-name"><a href="' + escapeHtml(url) + '">' + escapeHtml(item.name) + '</a></h3>'
            + '    <p class="dnw-item-price">' + escapeHtml(money(item.price, item.currency)) + was + '</p>'
            + stock
            + '    <div class="dnw-item-actions">'
            /* data-cart-add is the cart's own hook: cartUi.js picks this up */
            + '      <button type="button" data-cart-add'
            + '        data-product-id="' + escapeHtml(item.id) + '"'
            + '        data-product-variant-id="' + escapeHtml(item.productVariantId) + '"'
            + '        data-product-name="' + escapeHtml(item.name) + '"'
            + '        data-product-price="' + escapeHtml(item.price) + '"'
            + '        data-product-old-price="' + escapeHtml(item.oldPrice || '') + '"'
            + '        data-product-currency="' + escapeHtml(item.currency) + '"'
            + '        data-product-image="' + escapeHtml(item.image) + '"'
            + '        data-product-category="' + escapeHtml(item.category) + '"'
            + '      >' + escapeHtml(ADD_LABEL || T.addToCart) + '</button>'
            + '      <button class="dnw-item-remove" type="button" data-dnw-remove="' + escapeHtml(item.id) + '">'
            + escapeHtml(T.remove) + '</button>'
            + '    </div>'
            + '  </div>'
            + '</article>';
    }

    function render() {
        var list = wishlist();
        if (!list) return;

        var summary = list.getSummary();

        document.querySelectorAll('[data-dnw-count]').forEach(function (node) {
            node.textContent = summary.itemCount;
        });

        var itemsEl = document.querySelector('[data-dnw-items]');
        var emptyEl = document.querySelector('[data-dnw-empty]');
        var clearEl = document.querySelector('[data-dnw-clear]');

        if (itemsEl) itemsEl.innerHTML = summary.items.map(itemRow).join('');
        if (emptyEl) emptyEl.style.display = summary.itemCount ? 'none' : 'block';
        if (clearEl) clearEl.disabled = summary.itemCount === 0;

        syncToggles();
    }

    /* Every heart and every save button reflects the stored list, wherever it
       came from: the grid, a search result, the product page. */
    function syncToggles() {
        var list = wishlist();
        if (!list) return;

        document.querySelectorAll('[data-dnw-toggle]').forEach(function (node) {
            var saved = list.has(node.dataset.productId);
            node.classList.toggle('is-saved', saved);
            node.setAttribute('aria-pressed', saved ? 'true' : 'false');

            var label = node.querySelector('[data-dnw-toggle-label]');
            if (label) label.textContent = saved ? T.saved : T.save;
            else node.setAttribute('aria-label', saved ? T.saved : T.save);
        });
    }

    /* ------------------------------------------------------------ card hearts
       productList.js writes the grid with innerHTML, and recommendation and
       search cards arrive later still, so decorate on mutation instead of
       editing every renderer. */
    function heartFor(data) {
        var button = document.createElement('button');
        button.className = 'dnw-heart';
        button.type = 'button';
        button.setAttribute('data-dnw-toggle', '');
        Object.keys(data).forEach(function (key) {
            button.setAttribute('data-product-' + key, data[key] == null ? '' : data[key]);
        });
        /* the dataset keys the toggle handler reads back */
        button.dataset.productId = data.id;
        button.innerHTML = HEART;
        return button;
    }

    function decorateCards(root) {
        (root || document).querySelectorAll('.product-card').forEach(function (card) {
            if (card.querySelector('.dnw-heart')) return;

            var addBtn = card.querySelector('[data-cart-add]');
            if (!addBtn) return;

            var d = addBtn.dataset;
            card.appendChild(heartFor({
                id: d.productId,
                'variant-id': d.productVariantId || d.productId,
                name: d.productName,
                price: d.productPrice,
                'old-price': d.productOldPrice,
                currency: d.productCurrency,
                image: d.productImage,
                category: d.productCategory
            }));
        });

        fillStock(root);
        syncToggles();
    }

    /* The grid's own add-to-cart button carries no stock figure, and stock_count
       is the field a back-in-stock campaign needs, so the hearts get it from the
       catalogue instead. Left unset where the catalogue does not track stock,
       which is how the event ends up omitting stock_count rather than sending a
       zero. Runs after the hearts exist and is safe to run again: a heart that
       already has the attribute is skipped. */
    function fillStock(root) {
        var source = catalog();
        if (!source) return;

        var pending = [].slice.call((root || document)
            .querySelectorAll('[data-dnw-toggle]:not([data-product-stock])'));
        if (!pending.length) return;

        source.loadProducts().then(function () {
            pending.forEach(function (node) {
                source.getProductById(node.dataset.productId).then(function (product) {
                    if (product && product.stock !== null && product.stock !== undefined) {
                        node.dataset.productStock = product.stock;
                    }
                });
            });
        }).catch(function () { /* no catalogue: the event omits stock_count */ });
    }

    function watchGrid() {
        var grid = document.getElementById('productGrid');
        if (!grid || typeof MutationObserver !== 'function') return;

        new MutationObserver(function () { decorateCards(grid); })
            .observe(grid, { childList: true, subtree: true });
    }

    /* --------------------------------------------------- product page button */
    function injectSaveButton(product) {
        var actions = document.querySelector('.product-detail-actions');
        if (!actions || actions.querySelector('[data-dnw-toggle]')) return;

        var button = document.createElement('button');
        button.className = 'dnw-save-btn';
        button.type = 'button';
        button.setAttribute('data-dnw-toggle', '');
        button.dataset.productId = product.id;
        button.dataset.productVariantId = product.id;
        button.dataset.productName = product.name;
        button.dataset.productPrice = product.price;
        button.dataset.productOldPrice = product.oldPrice || '';
        button.dataset.productCurrency = product.currency;
        button.dataset.productImage = product.image;
        button.dataset.productCategory = product.category;
        /* set only when the catalogue tracks stock: an empty string here used
           to coerce to 0 and every save claimed the product was out of stock */
        if (product.stock !== null && product.stock !== undefined) {
            button.dataset.productStock = product.stock;
        }
        button.innerHTML = HEART + '<span data-dnw-toggle-label>' + escapeHtml(T.save) + '</span>';

        actions.appendChild(button);
        syncToggles();
    }

    /* ---------------------------------------------------------------- wiring */
    function itemFromToggle(node) {
        var d = node.dataset;
        return {
            id: d.productId,
            productId: d.productId,
            productVariantId: d.productVariantId || d.productId,
            name: d.productName,
            price: d.productPrice,
            oldPrice: d.productOldPrice,
            currency: d.productCurrency,
            image: d.productImage,
            category: d.productCategory,
            /* blank means the catalogue does not track stock, and normalize()
               turns that into null so stock_count is left off the event */
            stock: d.productStock
        };
    }

    function bind() {
        document.body.addEventListener('click', function (event) {
            var toggle = event.target.closest('[data-dnw-toggle]');
            if (toggle) {
                /* hearts sit on cards whose media is a link */
                event.preventDefault();
                event.stopPropagation();

                var list = wishlist();
                if (!list) return;

                var saved = list.toggle(itemFromToggle(toggle));
                showToast(saved ? T.savedToast : T.removedToast);
                return;
            }

            if (event.target.closest('[data-dnw-open]')) {
                event.preventDefault();
                openDrawer();
                return;
            }

            if (event.target.closest('[data-dnw-close]')) {
                closeDrawer();
                return;
            }

            var remove = event.target.closest('[data-dnw-remove]');
            if (remove) {
                var wl = wishlist();
                if (wl) wl.remove(remove.dataset.dnwRemove);
                return;
            }

            if (event.target.closest('[data-dnw-clear]')) {
                var all = wishlist();
                if (all) all.clear();
            }
        });

        window.addEventListener('keydown', function (event) {
            var drawer = document.getElementById('dnwDrawer');
            if (event.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
                closeDrawer();
            }
        });

        window.addEventListener(NS + ':wishlist:updated', render);

        /* the product page already announces its product; no second fetch */
        window.addEventListener(NS + ':product:loaded', function (event) {
            var product = event && event.detail && event.detail.product;
            if (product) injectSaveButton(product);
        });
    }

    function init() {
        if (!wishlist()) return;   /* wishlist.js absent: add nothing, break nothing */

        injectStyles();
        injectHeaderButton();
        injectDrawer();
        bind();
        decorateCards();
        watchGrid();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
