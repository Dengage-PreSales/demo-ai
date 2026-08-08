/* ============================================================================
   Cart and wishlist state, and the only place either is persisted.

   NAMESPACED BY SLUG, and that is not tidiness. Every demo the factory builds
   is served from one origin, so localStorage is shared between all of them. Two
   demos open in one browser must not see each other's cart. Handoff 1.6.

   Keys look like:  dps:<slug>:cart   dps:<slug>:wishlist

   Every mutation reports to Dengage through DengageEvents, never directly. This
   module holds no knowledge of table names, event names or payload shapes, and
   the guard would refuse it if it did.
   ========================================================================== */
(function (window) {
    'use strict';

    /* window.DEMO_SLUG, set synchronously by js/identity.js in the head. NOT the
       data-demo-slug attribute read directly, and not DEMO_CONFIG.slug: this
       file is evaluated before boot.js has fetched anything, so both of those
       were empty here and every demo's cart collapsed into one shared key. See
       the note at the top of js/identity.js. */
    var slug = window.DEMO_SLUG || 'demo';
    var CART_KEY = 'dps:' + slug + ':cart';
    var WISH_KEY = 'dps:' + slug + ':wishlist';

    var listeners = [];

    function read(key) {
        try {
            var raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (err) { return []; }
    }
    function write(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* private mode */ }
    }

    var cart = read(CART_KEY);
    var wishlist = read(WISH_KEY);

    function announce() {
        listeners.forEach(function (fn) {
            try { fn(); } catch (err) { if (window.console) console.error(err); }
        });
    }

    /* The shape DengageEvents expects for a cart line. Price may be null, and
       the emitter drops the key rather than sending zero. */
    function line(product, quantity) {
        return {
            id: product.id,
            name: product.name,
            quantity: quantity,
            price: product.price,
            discountedPrice: product.discountedPrice,
            categoryPath: product.categoryPath,
            image: product.image || null
        };
    }

    /* ------------------------------------------------------------------ */
    /* Cart                                                                */

    function addToCart(product, quantity) {
        quantity = quantity || 1;
        var existing = cart.filter(function (l) { return l.id === product.id; })[0];
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push(line(product, quantity));
        }
        write(CART_KEY, cart);
        /* cartItems carries the whole cart, not the delta: the SDK derives
           totals and abandonment from it, so a delta makes both wrong. */
        window.DengageEvents.addToCart(line(product, quantity), cart);
        announce();
    }

    function removeFromCart(id) {
        var removed = cart.filter(function (l) { return l.id === id; })[0];
        cart = cart.filter(function (l) { return l.id !== id; });
        write(CART_KEY, cart);
        if (removed) window.DengageEvents.removeFromCart(removed, cart);
        announce();
    }

    function clearCart(silent) {
        cart = [];
        write(CART_KEY, cart);
        if (!silent) window.DengageEvents.deleteCart();
        announce();
    }

    /* null when any line has no price, rather than a total that silently treats
       unknown as free. The checkout button is disabled in that case. */
    function cartTotal() {
        var total = 0, i, price;
        for (i = 0; i < cart.length; i++) {
            price = cart[i].discountedPrice !== null && cart[i].discountedPrice !== undefined
                ? cart[i].discountedPrice : cart[i].price;
            if (price === null || price === undefined) return null;
            total += price * cart[i].quantity;
        }
        return total;
    }

    function cartCount() {
        return cart.reduce(function (n, l) { return n + l.quantity; }, 0);
    }

    /* ------------------------------------------------------------------ */
    /* Checkout                                                            */

    function beginCheckout() {
        if (!cart.length) return;
        window.DengageEvents.beginCheckout(cart);
    }

    /* The order id is namespaced by slug so two demos cannot collide in
       order_events, which is shared. */
    function placeOrder(paymentMethod) {
        if (!cart.length) return null;
        var orderId = 'DPS-' + slug + '-' + Date.now();
        var total = cartTotal();
        window.DengageEvents.order({
            orderId: orderId,
            itemCount: cartCount(),
            totalAmount: total,
            paymentMethod: paymentMethod || 'credit_card'
        }, cart);
        clearCart(true);
        return { orderId: orderId, total: total };
    }

    /* ------------------------------------------------------------------ */
    /* Wishlist                                                            */

    /* list_name IS 'favorites' UNLESS SOMEBODY OPTS IN. Corrected 6 August 2026,
       and the reason is evidence rather than preference.

       Every row that has ever landed in wishlist_events, across every property on
       this shared account, carries list_name 'favorites'. The other three names in
       the documented set, shopping_list, price_drop_alert and back_in_stock_alert,
       have never appeared in a stored row. The SDK passes the field through as
       given, so 'favorites' is the only one of the four with a stored row behind it.
       Until another is observed in one, a demo that reliably records a save is worth
       more than one that labels the save precisely on the strength of an
       assumption.

       THIS ALSO FIXES A REAL LOGIC BUG. The old version read

           if (product.discountedPrice !== null) return 'price_drop_alert';

       and `undefined !== null` is true, so a product with no discount at all took
       that branch too. Every one of the demo catalogue's 15 products was being
       saved as price_drop_alert, including the 10 that have never been discounted.
       The intent was "when there is a discount", which is what hasDiscount() below
       actually asks.

       TO TURN THE SEMANTIC LISTS BACK ON, once one is seen landing, set
       dengage.wishlistLists to true in demo.config.json. The mapping is kept here
       rather than deleted, because back_in_stock_alert and price_drop_alert are
       what the panel's back-in-stock and price-drop campaigns key on, and that is
       a real capability to restore rather than rewrite. */
    function hasDiscount(product) {
        return product.discountedPrice !== null &&
               product.discountedPrice !== undefined &&
               product.discountedPrice !== '' &&
               Number(product.discountedPrice) < Number(product.price);
    }

    function semanticListsEnabled() {
        var config = window.DEMO_CONFIG || {};
        var dengageConfig = config.dengage || {};
        return dengageConfig.wishlistLists === true;
    }

    function listFor(product) {
        if (!semanticListsEnabled()) return 'favorites';
        if (product.stockCount === 0) return 'back_in_stock_alert';
        if (hasDiscount(product)) return 'price_drop_alert';
        return 'favorites';
    }

    function isSaved(id) {
        return wishlist.some(function (w) { return w.id === id; });
    }

    /* Removes by id, for the wishlist drawer's own remove control.

       toggleWishlist needs a whole product because ADDING one records its price
       and stock, and the drawer does not hold a product, only the saved line. So
       this reads the saved line back and removes from that, which means a removal
       carries the list it was actually saved to rather than one recomputed from a
       product that may have been repriced since.

       Added 6 August 2026 with the drawer's remove control. Before that the only
       way to unsave anything was to find the product again and press its heart,
       so ec:removeFromWishlist was effectively unreachable from the drawer. */
    function removeFromWishlist(id) {
        var saved = wishlist.filter(function (w) { return w.id === id; })[0];
        if (!saved) return;
        wishlist = wishlist.filter(function (w) { return w.id !== id; });
        write(WISH_KEY, wishlist);
        window.DengageEvents.removeFromWishlist({
            id: saved.id,
            variantId: saved.variantId
        }, saved.listName);
        announce();
    }

    function toggleWishlist(product) {
        var listName = listFor(product);
        if (isSaved(product.id)) {
            wishlist = wishlist.filter(function (w) { return w.id !== product.id; });
            write(WISH_KEY, wishlist);
            window.DengageEvents.removeFromWishlist(product, listName);
        } else {
            wishlist.push({
                id: product.id, name: product.name, listName: listName,
                price: product.price, discountedPrice: product.discountedPrice,
                image: product.image || null
            });
            write(WISH_KEY, wishlist);
            window.DengageEvents.addToWishlist({
                id: product.id,
                price: product.price,
                discountedPrice: product.discountedPrice,
                stockCount: product.stockCount
            }, listName);
        }
        announce();
        return isSaved(product.id);
    }

    /* ------------------------------------------------------------------ */

    window.Store = {
        cart: function () { return cart.slice(); },
        cartCount: cartCount,
        cartTotal: cartTotal,
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        clearCart: clearCart,
        beginCheckout: beginCheckout,
        placeOrder: placeOrder,
        wishlist: function () { return wishlist.slice(); },
        isSaved: isSaved,
        toggleWishlist: toggleWishlist,
        removeFromWishlist: removeFromWishlist,
        onChange: function (fn) { listeners.push(fn); },
        keys: { cart: CART_KEY, wishlist: WISH_KEY }
    };
})(window);
