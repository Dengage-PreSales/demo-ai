/* ============================================================================
   Dengage pageView

   This is the SDK's first-class page view action, not a custom table write.
   It matters twice over:

     1. It populates page_view_events with the columns Dengage expects.
     2. It is the documented trigger for On-Site messages. The eight Default
        Scenarios have no local code and appear only when a pageView fires and
        the scenario's page targeting matches.

   Because the site calls pageView itself, "Trigger Page View on Initialize"
   must be turned OFF in the web application's advanced settings, otherwise
   every page reports twice.

   The product page waits for the product to load so the call can carry
   product_id, category_path and price rather than an empty shell.
   ========================================================================== */
(function () {
    'use strict';

    function detectPageType() {
        if (document.body && document.body.dataset && document.body.dataset.pageType) {
            return document.body.dataset.pageType;
        }
        var path = (window.location.pathname || '').toLowerCase();
        if (!path || path === '/' || path.indexOf('index.html') !== -1) return 'home';
        if (path.indexOf('product.html') !== -1) return 'product';
        var match = path.match(/([^\/]+)\.html?$/);
        return match ? match[1] : 'other';
    }

    function send(payload) {
        try {
            if (typeof window.dengage === 'function') {
                window.dengage('pageView', payload);
            } else {
                console.log('Dengage pageView (mock):', payload);
            }
        } catch (err) {
            console.error('pageView failed', err);
        }
    }

    function num(value) {
        var n = Number(value);
        return isFinite(n) ? n : undefined;
    }

    /* True only when the catalogue actually carries a stock figure. Deliberately
       not written with num(): Number(null) is 0, and a 0 stock_count means out
       of stock rather than "not tracked". */
    function hasStock(value) {
        if (value === null || value === undefined || value === '') return false;
        var n = Number(value);
        return isFinite(n) && n >= 0;
    }

    /* Feed category paths already use the "A > B > C" shape Dengage wants. */
    function productPayload(product) {
        var payload = {
            page_type: 'product',
            product_id: String(product.id || ''),
            category_path: product.category || '',
            price: num(product.oldPrice) || num(product.price),
            discounted_price: num(product.price),
            /* The real figure where the catalogue tracks stock, which the two
               CantuPneus feeds now do. Where it does not, the docs are explicit
               that 1 or 0 is an acceptable stand-in for plain availability:
               "If stock count is not available you can give 1 or 0 as stock
               availability info, or you can omit". The fintech and banking
               catalogues are in that case, since a card or a mortgage has no
               unit count. This used to send a hardcoded 1 everywhere, which
               threw away a real number on the sites that had one.

               The null check is explicit and NOT num(), because Number(null) is
               0 and 0 here would announce every card and mortgage as out of
               stock. The same trap already produced a wrong stock_count on
               every wishlist event earlier today. */
            stock_count: hasStock(product.stock)
                ? Number(product.stock)
                : (product.availability === false ? 0 : 1)
        };
        Object.keys(payload).forEach(function (k) {
            if (payload[k] === undefined) delete payload[k];
        });
        return payload;
    }

    function start() {
        var pageType = detectPageType();

        if (pageType === 'product') {
            var fired = false;
            window.addEventListener('cantupneus:product:loaded', function (e) {
                if (fired) return;
                fired = true;
                var product = e && e.detail && e.detail.product;
                send(product ? productPayload(product) : { page_type: 'product' });
            });
            /* If the product never resolves, still report the page rather than
               leaving the visit and any page-load scenario unrecorded. */
            setTimeout(function () {
                if (!fired) { fired = true; send({ page_type: 'product' }); }
            }, 4000);
            return;
        }

        send({ page_type: pageType });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
