(function () {
    'use strict';
    var root = document.getElementById('dnil-head');
    if (!root || root.getAttribute('data-dnil-done')) return;

    /* The category the visitor is actually in, read from the page rather than
       guessed: the category view puts it in the query string, and a product page
       carries it on the product. Falls back to the first category so the strip
       still says something true on the home page. */
    function currentCategory(Catalog) {
        var m = /[?&]category=([^&#]*)/.exec(window.location.search);
        if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
        var id = /[?&]id=([^&#]*)/.exec(window.location.search);
        if (id) {
            var p = Catalog.get(decodeURIComponent(id[1]));
            if (p && p.category) return p.category;
        }
        var cats = Catalog.categories();
        return cats && cats.length ? cats[0] : null;
    }

    function render() {
        var Catalog = window.Catalog;
        if (!Catalog || !Catalog.categories) return false;
        var cat = currentCategory(Catalog);
        if (!cat) return false;
        var items = Catalog.inCategory(cat);
        if (!items.length) return false;

        var esc = Catalog.escapeText, escA = Catalog.escapeAttr;
        var chips = items.slice(0, 4).map(function (p) {
            return '<a class="chip" href="' + escA(p.url) + '">' +
                     '<span class="thumb">' + Catalog.media(p) + '</span>' +
                     '<span class="t">' + esc(p.name) + '</span>' +
                   '</a>';
        }).join('');

        root.innerHTML =
            '<div class="in">' +
              '<span class="msg">More in <b>' + esc(cat) + '</b></span>' +
              '<span class="row">' + chips + '</span>' +
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
