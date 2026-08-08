/* ============================================================================
   Loads and normalises the catalogue, and generates product artwork.

   THE NORMALISATION RULE, which is the whole reason this file is careful:

     an unreadable price is null, never 0.

   The reference build's productCatalog.js does the opposite:

       price: Number.isFinite(price) ? price : 0

   three lines away from handling stock correctly. Every downstream module
   inherits it: the grid, the cart, pageView, and every row carrying unit_price.
   Handoff 5.3, non-negotiable 8. It is the Number(null) === 0 trap, and it has
   shipped twice on the reference build.

   The generator only ships products whose price it genuinely scraped, because
   unit_price and discounted_price are REQUIRED on ec:addToCart, so "omit the
   column" is not available there. This still guards the case, because a
   hand-written or hand-edited catalogue can always reintroduce it.

   ARTWORK. A demo never hotlinks a third-party CDN: the prospect can change or
   remove an image between the build and the call, and a broken tile on screen
   is worse than no image. Handoff 1.4, 7.3.

   The template itself ships no product images at all. It generates a
   self-contained SVG placeholder from the theme, which is also the failure path
   a generated demo falls back to when an image cannot be fetched. Nothing can
   404 at demo time.

   Gradient ids carry a per-product prefix. Inline several SVGs with the same
   gradient id in one document and they all resolve to the first definition.
   Handoff 7.3.
   ========================================================================== */
(function (window) {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Normalisation                                                       */

    /* null when the value is absent or unreadable. Never 0 as a stand-in. */
    function num(value) {
        if (value === null || value === undefined || value === '') return null;
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    function normalise(raw) {
        if (!raw || !raw.id) return null;

        var price = num(raw.price);
        var discounted = num(raw.discountedPrice);
        var stock = num(raw.stockCount);

        return {
            id: String(raw.id),
            name: raw.name || String(raw.id),
            category: raw.category || '',
            categoryPath: raw.categoryPath || raw.category || '',
            /* null, not 0. Everything downstream tests for null. */
            price: price,
            /* A discount only exists if it is genuinely lower. */
            discountedPrice: (discounted !== null && price !== null && discounted < price) ? discounted : null,
            /* null means the catalogue does not track stock, which is different
               from zero meaning none left. Both are rendered, differently. */
            stockCount: stock,
            attributes: raw.attributes || {},
            image: raw.image || null,
            url: 'product.html?id=' + encodeURIComponent(String(raw.id))
        };
    }

    /* The price a customer pays, or null if unknown. */
    function effectivePrice(product) {
        if (product.discountedPrice !== null) return product.discountedPrice;
        return product.price;
    }

    /* ------------------------------------------------------------------ */
    /* Artwork                                                             */

    /* A deterministic hue per product, so the same product always gets the same
       placeholder and a grid looks composed rather than random. */
    function hash(text) {
        var h = 0, i;
        for (i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    function placeholder(product) {
        var seed = hash(product.id);
        var gid = 'g' + seed.toString(36);
        var rotate = seed % 60 - 30;
        var initials = (product.name || '?').split(/\s+/).slice(0, 2)
            .map(function (w) { return w.charAt(0); }).join('').toUpperCase();

        /* currentColor picks up the theme, so the placeholder is themed without
           the SVG naming a colour. */
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" ' +
            'aria-label="' + escapeAttr(product.name) + '">' +
            '<defs><linearGradient id="' + gid + '" gradientTransform="rotate(' + rotate + ' .5 .5)">' +
            '<stop offset="0" stop-color="currentColor" stop-opacity=".16"/>' +
            '<stop offset="1" stop-color="currentColor" stop-opacity=".05"/>' +
            '</linearGradient></defs>' +
            '<rect width="400" height="300" fill="url(#' + gid + ')"/>' +
            '<text x="200" y="150" text-anchor="middle" dominant-baseline="central" ' +
            'font-family="system-ui, sans-serif" font-size="64" font-weight="700" ' +
            'fill="currentColor" fill-opacity=".28">' + escapeText(initials) + '</text>' +
            '</svg>';
        return svg;
    }

    function escapeText(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(text) {
        return escapeText(text).replace(/"/g, '&quot;');
    }

    /* Inline SVG rather than an <img src="data:...">, so it inherits
       currentColor from the page and needs no encoding round trip. */
    function media(product) {
        if (product.image) {
            return '<img src="' + escapeAttr(product.image) + '" alt="' +
                   escapeAttr(product.name) + '" loading="lazy">';
        }
        /* js/artwork.js draws a motif for the product's own vertical, so a jacket
           looks like a jacket rather than like the letters QF. The guard falls
           back to the initials tile below if that module did not load, which is
           the same output this line produced before artwork existed. Handoff 7.4. */
        if (window.Artwork) {
            return '<span class="art" aria-hidden="false">' + window.Artwork.svg(product) + '</span>';
        }
        return '<span class="art" aria-hidden="false">' + placeholder(product) + '</span>';
    }

    /* ------------------------------------------------------------------ */
    /* Loading                                                             */

    var products = [];
    var byId = {};
    var categories = [];

    function load(url) {
        return fetch(url, { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                products = (data.products || []).map(normalise).filter(Boolean);
                byId = {};
                products.forEach(function (p) { byId[p.id] = p; });

                /* Category order follows first appearance in the catalogue,
                   which is the prospect's own order once the generator writes
                   it. Handoff 7.1a. */
                categories = [];
                products.forEach(function (p) {
                    if (p.category && categories.indexOf(p.category) === -1) categories.push(p.category);
                });
                return products;
            });
    }

    window.Catalog = {
        load: load,
        all: function () { return products; },
        get: function (id) { return byId[id] || null; },
        categories: function () { return categories.slice(); },
        inCategory: function (category) {
            if (!category) return products.slice();
            return products.filter(function (p) { return p.category === category; });
        },
        /* "More in this category" and "others also viewed", rendered from the
           demo's own catalogue. The reference build feeds its rails from Dengage
           recommendations, which need a per-application product feed that does
           not exist for this application yet. A rail calling a container that
           does not exist fails silently and leaves an empty strip on the page
           mid-call, so until recommendations land the data source is local and
           the rails look identical. Handoff 5.0, 2.7. */
        similar: function (product, limit) {
            return products
                .filter(function (p) { return p.id !== product.id && p.category === product.category; })
                .slice(0, limit || 6);
        },
        alsoViewed: function (product, limit) {
            var seed = hash(product.id);
            return products
                .filter(function (p) { return p.id !== product.id; })
                .sort(function (a, b) { return ((hash(a.id) + seed) % 97) - ((hash(b.id) + seed) % 97); })
                .slice(0, limit || 6);
        },
        search: function (term) {
            var q = String(term || '').trim().toLowerCase();
            if (!q) return [];
            return products.filter(function (p) {
                return p.name.toLowerCase().indexOf(q) !== -1 ||
                       p.categoryPath.toLowerCase().indexOf(q) !== -1 ||
                       p.id.toLowerCase().indexOf(q) !== -1;
            });
        },
        effectivePrice: effectivePrice,
        media: media,
        placeholder: placeholder,
        escapeAttr: escapeAttr,
        escapeText: escapeText
    };
})(window);
