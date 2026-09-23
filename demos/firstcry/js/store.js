/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window) {
    'use strict';

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
        try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) {  }
    }

    var cart = read(CART_KEY);
    var wishlist = read(WISH_KEY);

    function announce() {
        listeners.forEach(function (fn) {
            try { fn(); } catch (err) { if (window.console) console.error(err); }
        });
    }

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

    function addToCart(product, quantity) {
        quantity = quantity || 1;
        var existing = cart.filter(function (l) { return l.id === product.id; })[0];
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push(line(product, quantity));
        }
        write(CART_KEY, cart);

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

    function beginCheckout() {
        if (!cart.length) return;
        window.DengageEvents.beginCheckout(cart);
    }

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
