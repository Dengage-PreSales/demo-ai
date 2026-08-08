(function () {
    'use strict';
    var root = document.getElementById('dnil-grid');
    if (!root || root.getAttribute('data-dnil-done')) return;

    function money(value) {
        var cfg = window.DEMO_CONFIG || {};
        var sym = (cfg.locale && cfg.locale.currencySymbol) || '$';
        if (value === null || value === undefined || value === '') return null;
        var n = Number(value);
        return isFinite(n) ? sym + n.toFixed(2) : null;
    }

    function render() {
        var Catalog = window.Catalog;
        if (!Catalog || !Catalog.all) return false;
        var all = Catalog.all();
        if (!all || !all.length) return false;

        /* Promote something with a discount if the catalogue has one, because
           that is the more interesting story to tell. Otherwise the first item. */
        var p = all.filter(function (x) {
            return x.discountedPrice !== null && x.discountedPrice !== undefined;
        })[0] || all[0];

        var esc = Catalog.escapeText, escA = Catalog.escapeAttr;
        var now = money(Catalog.effectivePrice ? Catalog.effectivePrice(p) : p.price);
        var was = (p.discountedPrice !== null && p.discountedPrice !== undefined)
                  ? money(p.price) : null;

        root.innerHTML =
            '<div class="promo">' +
              '<span class="shot">' + Catalog.media(p) + '</span>' +
              '<span class="body">' +
                '<span class="flag">Picked for you</span>' +
                '<span class="cat">' + esc(p.categoryPath || p.category || '') + '</span>' +
                '<h3>' + esc(p.name) + '</h3>' +
                '<span class="price">' +
                  (now === null
                    ? '<span class="none">Price on request</span>'
                    : now + (was ? '<span class="was">' + was + '</span>' : '')) +
                '</span>' +
                '<a class="go" href="' + escA(p.url) + '">Take a look</a>' +
              '</span>' +
            '</div>';
        root.hidden = false;
        root.setAttribute('data-dnil-done', '1');
        return true;
    }

    if (render()) return;
    var tries = 0;
    var timer = setInterval(function () {
        if (render() || ++tries > 10) clearInterval(timer);
    }, 300);
})();
