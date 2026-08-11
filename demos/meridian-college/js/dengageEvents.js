/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    function config() { return window.DEMO_CONFIG || {}; }

    function slug() { return window.DEMO_SLUG || config().slug || 'demo'; }

    function compact(payload) {
        var out = {};
        Object.keys(payload || {}).forEach(function (key) {
            var value = payload[key];
            if (value === null || value === undefined || value === '') return;
            if (typeof value === 'number' && !isFinite(value)) return;
            out[key] = value;
        });
        return out;
    }

    function money(value) {
        if (value === null || value === undefined || value === '') return undefined;
        var n = Number(value);
        return isFinite(n) ? n : undefined;
    }

    function count(value) {
        if (value === null || value === undefined || value === '') return undefined;
        var n = Number(value);
        return isFinite(n) ? Math.round(n) : undefined;
    }

    function announceSent(action, body, accepted) {
        var name = 'dps:' + slug() + ':event';
        try {
            window.dispatchEvent(new CustomEvent(name, {
                detail: { action: action, payload: body, accepted: !!accepted, at: Date.now() }
            }));
        } catch (err) {  }
    }

    function send(action, payload) {
        var body = compact(payload);
        if (typeof window.dengage !== 'function') {

            if (window.console) console.log('[dengage dry] ' + action, body);
            announceSent(action, body, false);
            return body;
        }
        try {
            window.dengage(action, body);
            announceSent(action, body, true);
        } catch (err) {
            if (window.console) console.error('[dengage] ' + action + ' failed', err);
            announceSent(action, body, false);
        }
        return body;
    }

    function cartItems(lines) {
        return (lines || []).map(function (line) {
            return compact({
                product_id: String(line.id),
                product_variant_id: line.variantId ? String(line.variantId) : String(line.id),
                quantity: count(line.quantity) || 1,
                unit_price: money(line.price),
                discounted_price: money(line.discountedPrice !== undefined ? line.discountedPrice : line.price)
            });
        });
    }

    var PAGE_TYPES = ['home', 'category', 'product', 'cart', 'checkout',
                      'promotion', 'pricing', 'login', 'logout', 'other'];

    function pageview(pageType, detail) {
        var type = PAGE_TYPES.indexOf(pageType) === -1 ? 'other' : pageType;
        detail = detail || {};
        return send('pageView', {
            page_type: type,
            category_path: detail.categoryPath,
            product_id: detail.productId,
            price: money(detail.price),
            discounted_price: money(detail.discountedPrice),
            stock_count: count(detail.stockCount),
            promotion_id: detail.promotionId
        });
    }

    function addToCart(line, lines) {
        return send('ec:addToCart', {
            product_id: String(line.id),
            product_variant_id: line.variantId ? String(line.variantId) : String(line.id),
            quantity: count(line.quantity) || 1,
            unit_price: money(line.price),
            discounted_price: money(line.discountedPrice !== undefined ? line.discountedPrice : line.price),
            cartItems: cartItems(lines)
        });
    }

    function removeFromCart(line, lines) {
        return send('ec:removeFromCart', {
            product_id: String(line.id),
            product_variant_id: line.variantId ? String(line.variantId) : String(line.id),
            quantity: count(line.quantity) || 1,
            unit_price: money(line.price),
            discounted_price: money(line.discountedPrice !== undefined ? line.discountedPrice : line.price),
            cartItems: cartItems(lines)
        });
    }

    function deleteCart() {
        return send('ec:deleteCart', {});
    }

    function beginCheckout(lines) {
        return send('ec:beginCheckout', { cartItems: cartItems(lines) });
    }

    function order(details, lines) {
        return send('ec:order', {
            order_id: String(details.orderId),
            item_count: count(details.itemCount),
            total_amount: money(details.totalAmount),
            discounted_price: money(details.discountedTotal !== undefined
                ? details.discountedTotal : details.totalAmount),
            payment_method: details.paymentMethod || 'credit_card',
            coupon_code: details.couponCode,
            cartItems: cartItems(lines)
        });
    }

    function search(term, resultCount, filters) {
        return send('ec:search', {
            keywords: String(term || ''),
            result_count: count(resultCount) || 0,
            filters: filters
        });
    }

    var LISTS = ['favorites', 'shopping_list', 'price_drop_alert', 'back_in_stock_alert'];

    var WISHLIST_ADD = 'add';
    var WISHLIST_REMOVE = 'remove';

    function eventId() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
        } catch (err) {  }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
            var n = Math.random() * 16 | 0;
            return (ch === 'x' ? n : (n & 3 | 8)).toString(16);
        });
    }

    function wishlistRow(eventType, fields) {
        var row = compact(fields);
        row.event_id = eventId();
        row.event_type = eventType;
        row.list_name = row.list_name || 'favorites';
        row.is_used = false;
        return row;
    }

    function sendWishlist(action, eventType, fields) {
        var row = wishlistRow(eventType, fields);
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] ' + action, row);
            announceSent(action, row, false);
            return row;
        }
        try {
            window.dengage('sendDeviceEvent', 'wishlist_events', row);
            announceSent(action, row, true);
        } catch (err) {
            if (window.console) console.error('[dengage] ' + action + ' failed', err);
            announceSent(action, row, false);
        }
        return row;
    }

    function wishlistList(name) {
        return LISTS.indexOf(name) === -1 ? 'favorites' : name;
    }

    function variantOf(product) {
        return product.variantId ? String(product.variantId) : String(product.id);
    }

    function addToWishlist(product, listName) {
        return sendWishlist('ec:addToWishlist', WISHLIST_ADD, {
            list_name: wishlistList(listName),
            product_id: String(product.id),
            product_variant_id: variantOf(product),
            price: money(product.price),
            discounted_price: money(product.discountedPrice !== undefined
                ? product.discountedPrice : product.price),
            stock_count: count(product.stockCount)
        });
    }

    function removeFromWishlist(product, listName) {
        return sendWishlist('ec:removeFromWishlist', WISHLIST_REMOVE, {
            list_name: wishlistList(listName),
            product_id: String(product.id),
            product_variant_id: variantOf(product)
        });
    }

    function setContactKey(key) {
        if (!key) return false;
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] setContactKey ' + key);
            return true;
        }
        try {

            window.dengage('setContactKey', key);
        } catch (err) {
            if (window.console) console.error('[dengage] setContactKey failed', err);
            return false;
        }
        if (window.console) console.log('[dengage] setContactKey ' + key);
        return true;
    }

    var CAPTURES_A_CONTACT = { 'subscription-popup': true };

    function identifyBeforeCapture(slug) {
        if (!CAPTURES_A_CONTACT[slug]) return;

        var identity = window.DemoIdentity;
        if (!identity || identity.contactKey) return;
        if (typeof identity.mintKey !== 'function') return;

        var key = identity.mintKey(Date.now());
        if (!setContactKey(key)) return;
        identity.contactKey = key;

        try {
            window.sessionStorage.setItem(identity.storageKey, key);
        } catch (err) {  }

        pageview('login');
    }

    function scenario(slug) {
        var dengageConfig = config().dengage || {};
        var eventName = (dengageConfig.scenarioPrefix || 'dengage_demo_') + slug;

        identifyBeforeCapture(slug);

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: eventName, actionType: eventName });

        try {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { slug: slug } }));
        } catch (err) {
            try {
                var legacy = document.createEvent('Event');
                legacy.initEvent(eventName, false, false);
                window.dispatchEvent(legacy);
            } catch (ignored) {  }
        }

        if (window.console) console.log('[scenario] ' + eventName + ' (dataLayer and window event)');
        return eventName;
    }

    function pushSupported() {
        if (typeof window.dengage !== 'function') return false;
        try { window.dengage('isPushNotificationsSupported'); return true; }
        catch (err) { return false; }
    }

    function pushStatus() {
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] getNotificationPermission');
            return null;
        }
        try { return window.dengage('getNotificationPermission'); }
        catch (err) {
            if (window.console) console.error('[dengage] getNotificationPermission failed', err);
            return null;
        }
    }

    function pushPrompt() {
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] showNativePrompt');
            return false;
        }
        try { window.dengage('showNativePrompt'); return true; }
        catch (err) {
            if (window.console) console.error('[dengage] showNativePrompt failed', err);
            return false;
        }
    }

    var INBOX_LIMIT = 20;
    var inbox = null;

    function inboxProvider() {
        if (inbox) return inbox;
        if (typeof window.dengage !== 'function') return null;
        var provider;
        try { provider = window.dengage('InboxMessageProvider', INBOX_LIMIT); }
        catch (err) {
            if (window.console) console.error('[dengage] InboxMessageProvider failed', err);
            return null;
        }
        if (!provider || typeof provider.getMessages !== 'function') return null;
        inbox = provider;
        return inbox;
    }

    function hasApplication() {
        var dengageConfig = config().dengage || {};
        return !!(dengageConfig.appGuid && dengageConfig.appGuid.indexOf('__') !== 0);
    }

    function inboxMessages(limit) {
        if (typeof window.dengage !== 'function' || !hasApplication()) {
            if (window.console) console.log('[dengage dry] InboxMessageProvider.getMessages');
            return Promise.resolve({ status: 'dry', list: [] });
        }
        var provider = inboxProvider();
        if (!provider) return Promise.resolve({ status: 'starting', list: [] });
        var result;
        try { result = provider.getMessages(limit || INBOX_LIMIT); }
        catch (err) { return Promise.resolve({ status: 'starting', list: [] }); }
        if (!result || typeof result.then !== 'function') {
            return Promise.resolve({ status: 'starting', list: [] });
        }
        return result.then(function (list) {
            return { status: 'ok', list: Array.isArray(list) ? list : [] };
        }, function (reason) {

            if (reason === undefined || reason === null) {
                return { status: 'starting', list: [] };
            }
            if (window.console) console.warn('[dengage] inbox getMessages', reason);
            return { status: 'error', list: [], reason: String(reason) };
        });
    }

    function inboxReport(method, id, buttonId) {
        var provider = inboxProvider();
        if (!provider || typeof provider[method] !== 'function') {
            if (window.console) console.log('[dengage dry] inbox ' + method + ' ' + id);
            return false;
        }
        try {
            if (buttonId === undefined) provider[method](id);
            else provider[method](id, buttonId);
        } catch (err) {
            if (window.console) console.error('[dengage] inbox ' + method + ' failed', err);
            return false;
        }
        return true;
    }

    function inboxImpression(id) { return inboxReport('onImpression', id); }
    function inboxOpen(id) { return inboxReport('onOpen', id); }
    function inboxClick(id, buttonId) { return inboxReport('onClick', id, buttonId || 'cta'); }

    function inboxDelete(id) {
        var dengageConfig = config().dengage || {};
        if (!dengageConfig.inboxReportDelete) {
            if (window.console) {
                console.log('[dengage] inbox dismiss is local only. Set ' +
                    'dengage.inboxReportDelete to report it to Dengage.');
            }
            return false;
        }
        return inboxReport('onDelete', id);
    }

    var SDK_SESSION_KEY = '_dn_sessions';

    function sdkSessionId() {
        try {
            var raw = window.localStorage.getItem(SDK_SESSION_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return (parsed && parsed.sessionId) ? String(parsed.sessionId) : null;
        } catch (err) {
            return null;
        }
    }

    function reference(done) {
        var dengageConfig = config().dengage || {};
        var out = {
            contactKey: (window.DemoIdentity && window.DemoIdentity.contactKey) || null,
            sessionId: sdkSessionId(),
            deviceId: null,
            pushToken: null,
            appGuid: dengageConfig.appGuid || null,
            accountId: dengageConfig.accountId || null,
            slug: slug(),

            demoUrl: (function () {
                try {
                    return window.location.origin + window.location.pathname;
                } catch (err) {
                    return null;
                }
            }())
        };

        if (typeof window.dengage !== 'function') {
            done(out);
            return;
        }

        var settled = false;
        var pending = 2;
        function finish() {
            if (settled) return;
            settled = true;
            done(out);
        }
        function one() { pending -= 1; if (pending <= 0) finish(); }

        window.setTimeout(finish, 1200);

        try {
            window.dengage('getDeviceId', function (id) {
                if (id) out.deviceId = String(id);
                one();
            });
        } catch (err) { one(); }

        try {
            window.dengage('getToken', function (token) {
                if (token) out.pushToken = String(token);
                one();
            });
        } catch (err) { one(); }
    }

    window.DengageEvents = {
        pageview: pageview,
        reference: reference,
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        deleteCart: deleteCart,
        beginCheckout: beginCheckout,
        order: order,
        search: search,
        addToWishlist: addToWishlist,
        removeFromWishlist: removeFromWishlist,
        setContactKey: setContactKey,
        scenario: scenario,
        pushSupported: pushSupported,
        pushStatus: pushStatus,
        pushPrompt: pushPrompt,
        inboxMessages: inboxMessages,
        inboxImpression: inboxImpression,
        inboxOpen: inboxOpen,
        inboxClick: inboxClick,
        inboxDelete: inboxDelete,

        compact: compact,
        money: money,
        count: count,
        slug: slug
    };
})(window, document);
