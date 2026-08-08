(function () {
    'use strict';
    var root = document.getElementById('dnil-foot');
    if (!root || root.getAttribute('data-dnil-done')) return;

    function render() {
        var Catalog = window.Catalog, Store = window.Store;
        if (!Catalog || !Catalog.get || !Store || !Store.cart) return false;

        /* Cart first, then saved items, deduplicated. Both come from Store so the
           storage namespace is never rebuilt here. */
        var seen = {}, picks = [];
        [].concat(Store.cart(), Store.wishlist()).forEach(function (line) {
            if (!line || seen[line.id]) return;
            var p = Catalog.get(line.id);
            if (!p) return;
            seen[line.id] = 1;
            picks.push(p);
        });
        /* ALWAYS RENDER SOMETHING. This used to return here when the cart and the
           wishlist were both empty, which is the state of every fresh browser and
           therefore the state at the start of most calls. The campaign fired, the
           engine counted it as displayed, and the page showed nothing: on screen
           that is indistinguishable from a broken widget, and it is the presenter
           who has to explain it.

           The fallback must not claim history the visitor does not have, so the
           heading changes with the case rather than the products changing to fit
           the heading. No "popular" or "trending" wording either: that is a claim
           about numbers this demo does not have. CLAUDE.md 3.5. */
        var resumed = picks.length > 0;
        if (!resumed) {
            picks = Catalog.all().slice(0, 6);
            if (!picks.length) return false;
        }

        var esc = Catalog.escapeText, escA = Catalog.escapeAttr;
        var items = picks.slice(0, 6).map(function (p) {
            return '<a class="item" href="' + escA(p.url) + '">' +
                     '<span class="shot">' + Catalog.media(p) + '</span>' +
                     '<span class="n2">' + esc(p.name) + '</span>' +
                   '</a>';
        }).join('');

        root.innerHTML =
            '<div class="head">' +
              '<h2>' + (resumed ? 'Pick up where you left off' : 'Browse the collection') + '</h2>' +
              '<span class="n">' + (resumed ? picks.length + ' waiting' : 'Add something to see this change') + '</span>' +
            '</div>' +
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
