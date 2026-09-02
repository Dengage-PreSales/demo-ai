/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window) {
    'use strict';

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

            price: price,

            discountedPrice: (discounted !== null && price !== null && discounted < price) ? discounted : null,

            stockCount: stock,
            attributes: raw.attributes || {},
            image: raw.image || null,
            url: 'product.html?id=' + encodeURIComponent(String(raw.id))
        };
    }

    function effectivePrice(product) {
        if (product.discountedPrice !== null) return product.discountedPrice;
        return product.price;
    }

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

    function media(product) {
        if (product.image) {
            return '<img src="' + escapeAttr(product.image) + '" alt="' +
                   escapeAttr(product.name) + '" loading="lazy">';
        }

        if (window.Artwork) {
            return '<span class="art" aria-hidden="false">' + window.Artwork.svg(product) + '</span>';
        }
        return '<span class="art" aria-hidden="false">' + placeholder(product) + '</span>';
    }

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
