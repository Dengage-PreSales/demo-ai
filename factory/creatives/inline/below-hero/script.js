/* Runs in page scope. Guarded on every side, because an inline creative that
   throws leaves a blank strip in the middle of the page during a call, and the
   SDK reports the error where nobody is looking. */
(function () {
    'use strict';
    var root = document.getElementById('dnil-hero');
    if (!root || root.getAttribute('data-dnil-done')) return;

    function render() {
        var Catalog = window.Catalog;
        if (!Catalog || !Catalog.categories) return false;
        var cats = Catalog.categories();
        if (!cats || !cats.length) return false;

        var esc = Catalog.escapeText, escA = Catalog.escapeAttr;
        var tiles = cats.slice(0, 4).map(function (cat) {
            var items = Catalog.inCategory(cat);
            if (!items.length) return '';
            /* Catalog.media returns the committed image, or a generated
               placeholder when the scrape produced none. Never hand build an
               <img>: a product without artwork would render broken. */
            return '<a class="tile" href="index.html?category=' + encodeURIComponent(cat) + '">' +
                     '<span class="shot">' + Catalog.media(items[0]) + '</span>' +
                     '<span class="label">' +
                       '<span class="name">' + esc(cat) + '</span>' +
                       '<span class="n">' + items.length + ' to browse</span>' +
                     '</span>' +
                   '</a>';
        }).join('');
        if (!tiles) return false;

        root.innerHTML =
            '<div class="head">' +
              '<h2>Browse by category</h2>' +
              '<span class="by">Chosen for you</span>' +
            '</div>' +
            '<div class="tiles">' + tiles + '</div>';
        root.hidden = false;
        root.setAttribute('data-dnil-done', '1');
        return true;
    }

    /* The SDK can inject before boot.js has finished fetching the catalogue, so
       retry briefly rather than render an empty strip. Bounded: ten tries at
       300ms, then give up silently and leave nothing on the page, which is the
       right failure for a creative nobody asked for. */
    if (render()) return;
    var tries = 0;
    var timer = setInterval(function () {
        if (render() || ++tries > 10) clearInterval(timer);
    }, 300);
})();
