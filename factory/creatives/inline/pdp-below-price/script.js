(function () {
    'use strict';
    var root = document.getElementById('dnil-pdp');
    if (!root || root.getAttribute('data-dnil-done')) return;

    function money(value) {
        var cfg = window.DEMO_CONFIG || {};
        var sym = (cfg.locale && cfg.locale.currencySymbol) || '$';
        if (value === null || value === undefined || value === '') return '';
        var n = Number(value);
        return isFinite(n) ? sym + n.toFixed(2) : '';
    }

    function render() {
        var Catalog = window.Catalog;
        if (!Catalog || !Catalog.get) return false;

        var m = /[?&]id=([^&#]*)/.exec(window.location.search);
        if (!m) return true;               /* not a product page: nothing to do */
        var id;
        try { id = decodeURIComponent(m[1]); } catch (e) { id = m[1]; }
        var product = Catalog.get(id);
        if (!product) return false;

        var others = Catalog.similar ? Catalog.similar(product, 5) : [];
        /* Same rule as above-footer: never render nothing. A category holding one
           product is unusual but a catalogue of twenty from a small prospect can
           easily produce it, and the presenter would be looking at a slot that
           stayed empty for a reason nobody in the room can see. Fall back to
           anything else in the catalogue, and say plainly that it is the wider
           catalogue rather than the same category. */
        var wider = false;
        if (!others.length) {
            wider = true;
            others = Catalog.all().filter(function (p) { return p.id !== product.id; }).slice(0, 5);
            if (!others.length) return false;
        }

        var esc = Catalog.escapeText, escA = Catalog.escapeAttr;
        var items = others.map(function (p) {
            var price = money(Catalog.effectivePrice ? Catalog.effectivePrice(p) : p.price);
            return '<a class="item" href="' + escA(p.url) + '">' +
                     '<span class="shot">' + Catalog.media(p) + '</span>' +
                     '<span class="n">' + esc(p.name) + '</span>' +
                     (price ? '<span class="p">' + price + '</span>' : '') +
                   '</a>';
        }).join('');

        root.innerHTML =
            '<span class="cap">' +
              (wider ? 'Also in this store' : 'Often bought with <b>' + esc(product.name) + '</b>') +
            '</span>' +
            '<div class="row">' + items + '</div>';
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
