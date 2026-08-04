(function () {
    const STORAGE_KEY = 'cantupneus_cart_items';

    let items = loadItems();

    function loadItems() {
        try {
            const savedItems = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(savedItems) ? savedItems : [];
        } catch (error) {
            return [];
        }
    }

    function saveItems() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }

    function normalizeItem(item) {
        const productId = String(item.productId || item.id || '').trim();
        const productVariantId = String(item.productVariantId || item.variantId || productId || '').trim();
        const oldPriceRaw = Number(item.oldPrice);

        return {
            id: productId,
            productId: productId,
            productVariantId: productVariantId,
            name: String(item.name || 'CantuPneus Piece').trim(),
            price: Number(item.price || 0),
            oldPrice: Number.isFinite(oldPriceRaw) && oldPriceRaw > 0 ? oldPriceRaw : 0,
            currency: item.currency || 'BRL',
            image: item.image || '',
            category: item.category || 'Tires',
            quantity: Math.max(1, Number(item.quantity || 1))
        };
    }

    /* ------------------------------------------------------------------
       Dengage ecommerce events.

       These use the SDK's first-class ec:* actions rather than writing to
       shopping_cart_events / order_events by hand. The SDK owns those table
       shapes, and ec:order additionally fills order_events_detail.

       Every ec:* call wants the whole cart, not just the item that changed.
    ------------------------------------------------------------------- */
    function call(action, payload) {
        try {
            if (typeof window.dengage === 'function') {
                window.dengage(action, payload);
            } else {
                console.log('Dengage ' + action + ' (mock):', payload);
            }
        } catch (err) {
            console.error(action + ' failed', err);
        }
    }

    /* Cart contents in the shape the ec:* actions expect. */
    function cartItemsPayload(list) {
        return (list || items).map(item => {
            const hasDiscount = item.oldPrice && item.oldPrice > item.price;
            return {
                product_id: item.productId || item.id || '',
                product_variant_id: item.productVariantId || item.id || '',
                quantity: Number(item.quantity) || 0,
                unit_price: Number(hasDiscount ? item.oldPrice : item.price) || 0,
                discounted_price: Number(item.price) || 0
            };
        });
    }

    function itemPayload(item, quantity) {
        const hasDiscount = item.oldPrice && item.oldPrice > item.price;
        return {
            product_id: item.productId || item.id || '',
            product_variant_id: item.productVariantId || item.id || '',
            quantity: Number(quantity != null ? quantity : item.quantity) || 0,
            unit_price: Number(hasDiscount ? item.oldPrice : item.price) || 0,
            discounted_price: Number(item.price) || 0,
            cartItems: cartItemsPayload()
        };
    }

    function sendAddToCart(item, quantity) {
        if (item) call('ec:addToCart', itemPayload(item, quantity));
    }

    function sendRemoveFromCart(item, quantity, remaining) {
        if (!item) return;
        const payload = itemPayload(item, quantity);
        /* the item is already gone from `items` by the time this runs on a
           remove, so pass the post-removal cart explicitly when given */
        if (remaining) payload.cartItems = cartItemsPayload(remaining);
        call('ec:removeFromCart', payload);
    }

    function sendDeleteCart() {
        call('ec:deleteCart', {});
    }

    function sendBeginCheckout() {
        call('ec:beginCheckout', { cartItems: cartItemsPayload() });
    }

    function sendOrderEvents(order) {
        if (!order || !order.items || !order.items.length) return;

        const metadata = order.metadata || {};
        const totalAmount = order.items.reduce((sum, item) => {
            const unit = item.oldPrice && item.oldPrice > item.price ? item.oldPrice : item.price;
            return sum + unit * item.quantity;
        }, 0);
        const discountedTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        call('ec:order', {
            order_id: order.orderId,
            item_count: Number(order.itemCount) || 0,
            total_amount: Number(totalAmount.toFixed(2)),
            discounted_price: Number(discountedTotal.toFixed(2)),
            payment_method: metadata.paymentMethod || 'credit_card',
            coupon_code: metadata.couponCode || '',
            cartItems: cartItemsPayload(order.items)
        });
    }

    function getSummary() {
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const currency = items[0] ? items[0].currency : 'BRL';

        return {
            items: items.map(item => ({ ...item })),
            itemCount,
            total,
            currency
        };
    }

    function emitChange(action, changedItem) {
        saveItems();
        const detail = {
            action,
            item: changedItem ? { ...changedItem } : null,
            cart: getSummary()
        };

        window.dispatchEvent(new CustomEvent('cantupneus:cart:updated', { detail }));
    }

    function pushDataLayer(eventName, payload) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            businessType: 'pneus',
            ...payload
        });
    }

    function addItem(rawItem, quantity) {
        const item = normalizeItem({ ...rawItem, quantity: quantity || rawItem.quantity });

        if (!item.id) {
            throw new Error('CantuCart.addItem requires an item id.');
        }

        const existingItem = items.find(cartItem => cartItem.id === item.id);
        const isNew = !existingItem;

        if (existingItem) {
            existingItem.quantity += item.quantity;
        } else {
            items.push(item);
        }

        const changedItem = existingItem || item;
        emitChange('add', changedItem);
        pushDataLayer('add_to_cart', {
            ecommerce: {
                currency: changedItem.currency,
                value: changedItem.price * changedItem.quantity,
                items: [changedItem]
            }
        });

        sendAddToCart(changedItem, changedItem.quantity);

        return getSummary();
    }

    function removeItem(id) {
        const item = items.find(cartItem => cartItem.id === id);
        items = items.filter(cartItem => cartItem.id !== id);
        emitChange('remove', item);

        if (item) {
            pushDataLayer('remove_from_cart', {
                ecommerce: {
                    currency: item.currency,
                    value: item.price * item.quantity,
                    items: [item]
                }
            });
            sendRemoveFromCart(item, item.quantity, items);
        }

        return getSummary();
    }

    function decrementItem(id) {
        const item = items.find(cartItem => cartItem.id === id);
        if (!item) return getSummary();

        if (item.quantity <= 1) {
            return removeItem(id);
        }

        item.quantity -= 1;
        emitChange('decrement', item);
        sendRemoveFromCart(item, 1, items);
        return getSummary();
    }

    function clearCart(options) {
        /* silent when called as part of checkout: ec:order already recorded
           the basket, so an ec:deleteCart on top would double count */
        const silent = !!(options && options.silent);
        items = [];
        emitChange('clear');

        if (!silent) sendDeleteCart();

        return getSummary();
    }

    function checkout(metadata) {
        const summary = getSummary();
        if (!summary.itemCount) {
            return null;
        }

        const order = {
            orderId: 'CANTU-' + Date.now(),
            ...summary,
            metadata: metadata || {}
        };

        /* checkout start, then the order itself */
        sendBeginCheckout();

        pushDataLayer('purchase', {
            transaction_id: order.orderId,
            value: order.total,
            currency: order.currency,
            ecommerce: {
                transaction_id: order.orderId,
                value: order.total,
                currency: order.currency,
                items: order.items
            }
        });

        sendOrderEvents(order);

        clearCart({ silent: true });
        window.dispatchEvent(new CustomEvent('cantupneus:cart:checkout', { detail: order }));
        return order;
    }

    window.CantuCart = {
        addItem,
        removeItem,
        decrementItem,
        clearCart,
        checkout,
        getSummary
    };

    emitChange('init');
})();
