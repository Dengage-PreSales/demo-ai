/* ============================================================================
   Site search, and the ec:search event behind it.

   BYTE-IDENTICAL across all four demo sites. Per-site values arrive on the
   script tag and the interface language is read from <html lang>, so this one
   file serves the Portuguese CantuPneus site and the three English sites:

     <script src="js/searchPanel.js"
             data-ns="cantupneus"
             data-catalog="CantuCatalogData"></script>

   ---------------------------------------------------------------------------
   The event contract, from https://dev.dengage.com/docs/ecommerce-events

   ec:search              -> search_events
       keywords             "text in the searchbox"
       result_count         number of matches the visitor was shown
       filters              optional, the filters the visitor picked

   ---------------------------------------------------------------------------
   WHEN the event fires is the part worth getting right, and it is a judgement
   call rather than something the docs decide for you.

   Results update on every keystroke, because that is what a visitor expects.
   ec:search does NOT. Firing per keystroke would write "m", "ma", "mar",
   "mars", "marsh" into search_events and the table would describe typing
   rather than intent: every "no results" prefix on the way to a word that does
   match would look like a failed search.

   So one event per SETTLED query. Settled means the visitor stopped typing for
   SETTLE_MS, or pressed Enter, or changed a filter while a query was present.
   The same keywords plus filters combination is not sent twice in a row, so
   opening the panel and re-reading results does not inflate the table.

   The upshot is that a zero-result row in search_events is a real gap in the
   catalogue, which is the whole reason to collect the table: it is the input
   to a "we do not stock what you asked for" campaign.
   ========================================================================== */
(function () {
    'use strict';

    var el = document.currentScript;
    var cfg = (el && el.dataset) || {};

    var NS = cfg.ns || 'site';
    var CATALOG = cfg.catalog || '';

    /* how long the visitor has to stop typing before the query counts */
    var SETTLE_MS = Number(cfg.settleMs || 700);
    /* below this, a query is a prefix, not a search */
    var MIN_CHARS = Number(cfg.minChars || 2);
    var MAX_RESULTS = Number(cfg.maxResults || 8);

    /* Interface language from the document, so it cannot drift from the page.
       Three sites share this file byte for byte, so the copy lives here keyed
       by language rather than in three near-identical forks. */
    var LANG = /^(pt|ru)/i.test(document.documentElement.lang || '')
        ? document.documentElement.lang.slice(0, 2).toLowerCase()
        : 'en';

    var COPY = {
        pt: {
            openLabel: 'Buscar produtos',
            placeholder: 'Busque por medida, marca ou linha',
            close: 'Fechar busca',
            hint: 'Digite uma medida (195/65 R15), uma marca ou uma linha.',
            noResults: 'Nada encontrado para',
            noResultsHelp: 'Tente a medida sem a barra, ou fale com um consultor.',
            resultsOne: 'resultado',
            resultsFew: 'resultados',
            resultsMany: 'resultados',
            allFilter: 'Tudo',
            view: 'Ver detalhes',
            locale: 'pt-BR'
        },
        en: {
            openLabel: 'Search products',
            placeholder: 'Search by size, brand or line',
            close: 'Close search',
            hint: 'Try a size (195/65 R15), a brand, or a product line.',
            noResults: 'Nothing found for',
            noResultsHelp: 'Try the size without the slash, or talk to an advisor.',
            resultsOne: 'result',
            resultsFew: 'results',
            resultsMany: 'results',
            allFilter: 'All',
            view: 'View details',
            locale: 'en-US'
        },
        ru: {
            openLabel: 'Поиск товаров',
            placeholder: 'Поиск по типоразмеру, бренду или линейке',
            close: 'Закрыть поиск',
            hint: 'Введите типоразмер (195/65 R15), бренд или линейку.',
            noResults: 'Ничего не найдено по запросу',
            noResultsHelp: 'Попробуйте типоразмер без косой черты или свяжитесь с консультантом.',
            resultsOne: 'результат',
            resultsFew: 'результата',
            resultsMany: 'результатов',
            allFilter: 'Все',
            view: 'Подробнее',
            locale: 'ru-RU'
        }
    };

    var T = COPY[LANG] || COPY.en;

    /* Russian needs three count forms, not two: 1 результат, 2 результата,
       5 результатов, and the teens all take the third.

       The rule is applied ONLY to Russian. Portuguese and English keep the
       plain "one or many" they always had. Applying the Slavic rule to them
       looks harmless because resultsFew equals resultsMany, and it is not: the
       Slavic rule returns the SINGULAR for 21, 31, 41, so English would have
       started printing "21 result". */
    function plural(n, one, few, many) {
        if (LANG !== 'ru') return n === 1 ? one : many;
        var mod10 = n % 10, mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        + '<path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21Z"></path>'
        + '</svg>';

    var MAGNIFIER = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        + '<path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"></path>'
        + '</svg>';

    var products = [];
    var activeFilter = '';        /* '' means no filter, which sends filters: '' */
    var settleTimer = null;
    var lastReported = null;      /* keywords + filters of the last event sent */

    function catalog() { return (CATALOG && window[CATALOG]) || null; }

    /* Search results carry the wishlist's own heart, so a result can be saved
       without this file knowing which global the wishlist lives under. The tell
       that the wishlist is on the page is the stylesheet wishlistUi.js injects:
       without it the heart would be an unstyled button that does nothing, so
       the heart is left off entirely instead. */
    function wishlistPresent() { return !!document.getElementById('dnw-styles'); }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function money(value, currency) {
        try {
            return new Intl.NumberFormat(T.locale, {
                style: 'currency',
                currency: currency || 'USD'
            }).format(Number(value) || 0);
        } catch (err) {
            return String(value);
        }
    }

    /* --------------------------------------------------------------- matching
       Sizes are the thing people actually type here, and they type them
       inconsistently: "195/65 R15", "195 65 r15", "19565r15". Fold every
       separator away on both sides so all three find the same tyre. */
    function fold(value) {
        return String(value || '').toLowerCase().replace(/[\s/.\-_]+/g, '');
    }

    function haystack(product) {
        return [product.name, product.brand, product.category, product.id,
            (product.colors || []).join(' '), product.desc].join(' ');
    }

    /* The filter axis is the middle segment of the category path, which is the
       useful one on every site: Truck / Passenger / Agricultural on CantuPneus,
       Cards / Savings / Investing on the other two. */
    function group(product) {
        var parts = String(product.category || '').split('>').map(function (part) {
            return part.trim();
        }).filter(Boolean);
        return parts.length > 1 ? parts[1] : (parts[0] || '');
    }

    function search(query) {
        var needle = fold(query);
        if (!needle) return [];

        return products.filter(function (product) {
            if (activeFilter && group(product) !== activeFilter) return false;
            return fold(haystack(product)).indexOf(needle) !== -1;
        });
    }

    /* ------------------------------------------------------------- the event */
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

    /* filters is typed as a string, so the picked filter is described rather
       than serialised as JSON: readable in the table, and empty when the
       visitor picked nothing */
    function filtersValue() {
        return activeFilter ? 'category=' + activeFilter : '';
    }

    function reportSearch(keywords, resultCount) {
        var filters = filtersValue();
        var signature = keywords + ' ' + filters;

        /* re-reading the same results is not a second search */
        if (signature === lastReported) return;
        lastReported = signature;

        call('ec:search', {
            keywords: keywords,
            result_count: resultCount,
            filters: filters
        });

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'search',
            search_term: keywords,
            result_count: resultCount,
            filters: filters
        });
    }

    /* ------------------------------------------------------------- rendering */
    function resultRow(product) {
        var url = catalog() ? catalog().buildProductUrl(product.id) : '#';
        var was = product.oldPrice && product.oldPrice > product.price
            ? '<span class="dns-was">' + escapeHtml(money(product.oldPrice, product.currency)) + '</span>'
            : '';

        var heart = !wishlistPresent() ? '' : ''
            /* the wishlist's own hook: its delegated handler picks this up */
            + '<button class="dnw-heart dns-result-heart" type="button" data-dnw-toggle'
            + '  data-product-id="' + escapeHtml(product.id) + '"'
            + '  data-product-variant-id="' + escapeHtml(product.id) + '"'
            + '  data-product-name="' + escapeHtml(product.name) + '"'
            + '  data-product-price="' + escapeHtml(product.price) + '"'
            + '  data-product-old-price="' + escapeHtml(product.oldPrice || '') + '"'
            + '  data-product-currency="' + escapeHtml(product.currency) + '"'
            + '  data-product-image="' + escapeHtml(product.image) + '"'
            + '  data-product-category="' + escapeHtml(product.category) + '"'
            + '  data-product-stock="' + escapeHtml(product.stock == null ? '' : product.stock) + '"'
            + '>' + HEART + '</button>';

        return ''
            + '<article class="dns-result">'
            + '  <a class="dns-result-media" href="' + escapeHtml(url) + '" tabindex="-1" aria-hidden="true">'
            + '    <img src="' + escapeHtml(product.image) + '" alt="" loading="lazy">'
            + '  </a>'
            + '  <div class="dns-result-body">'
            + '    <p class="dns-result-group">' + escapeHtml(group(product)) + '</p>'
            + '    <h3 class="dns-result-name"><a href="' + escapeHtml(url) + '">'
            + escapeHtml(product.name) + '</a></h3>'
            + '    <p class="dns-result-price">' + escapeHtml(money(product.price, product.currency)) + was + '</p>'
            + '  </div>'
            + heart
            + '</article>';
    }

    function renderResults(query, matches) {
        var resultsEl = document.querySelector('[data-dns-results]');
        var countEl = document.querySelector('[data-dns-count]');
        if (!resultsEl) return;

        if (!query || query.length < MIN_CHARS) {
            resultsEl.innerHTML = '<p class="dns-hint">' + escapeHtml(T.hint) + '</p>';
            if (countEl) countEl.textContent = '';
            return;
        }

        if (countEl) {
            countEl.textContent = matches.length + ' '
                + plural(matches.length, T.resultsOne, T.resultsFew, T.resultsMany);
        }

        if (!matches.length) {
            resultsEl.innerHTML = ''
                + '<div class="dns-none">'
                + '  <p class="dns-none-title">' + escapeHtml(T.noResults) + ' &ldquo;'
                + escapeHtml(query) + '&rdquo;</p>'
                + '  <p class="dns-hint">' + escapeHtml(T.noResultsHelp) + '</p>'
                + '</div>';
            return;
        }

        resultsEl.innerHTML = matches.slice(0, MAX_RESULTS).map(resultRow).join('');

        /* let the wishlist paint saved state onto the hearts it just inherited */
        window.dispatchEvent(new CustomEvent(NS + ':wishlist:updated', {
            detail: { action: 'rerender' }
        }));
    }

    function renderFilters() {
        var wrap = document.querySelector('[data-dns-filters]');
        if (!wrap) return;

        var groups = [];
        products.forEach(function (product) {
            var name = group(product);
            if (name && groups.indexOf(name) === -1) groups.push(name);
        });
        groups.sort();

        wrap.innerHTML = [''].concat(groups).map(function (name) {
            var active = name === activeFilter ? ' is-active' : '';
            return '<button class="dns-chip' + active + '" type="button"'
                + ' data-dns-filter="' + escapeHtml(name) + '">'
                + escapeHtml(name || T.allFilter) + '</button>';
        }).join('');
    }

    /* -------------------------------------------------------------- the panel */
    function injectStyles() {
        if (document.getElementById('dns-styles')) return;

        var style = document.createElement('style');
        style.id = 'dns-styles';
        style.textContent = [
            /* ------------------------------------------------------ header room
               Measured before touching anything: the header sat at exactly zero
               horizontal slack. At both 1280 and 1440 the nav's right edge met
               its container's right edge to the pixel, because the gap between
               nav items is 4rem and there were already eight of them. Adding a
               search button and a saved-items button therefore pushed the cart
               button off the right of the screen.

               So room is made rather than taken: the gap tightens and the two
               new buttons are a size down from the cart button. Scoped to a
               .dns-nav-compact class this file adds only to a nav it has
               actually put a button in, so a header carrying neither control
               keeps its original 4rem spacing. A class rather than :has(), so
               the rule does not depend on selector support. */
            '.nav-main.dns-nav-compact{gap:2.4rem;}',
            '.dns-open-btn,.dnw-open-btn{width:38px;height:38px;}',
            '.dns-open-btn svg,.dnw-open-btn svg{width:18px;height:18px;}',
            /* 1200, not the site's own 1100 breakpoint. Between 1100 and
               about 1200 the widest of the four navs (CantuPneus English)
               already overflowed its container BEFORE any of this was added,
               measured at 1232px against a 1088px container. The site's compact
               rules had simply not engaged yet. Tightening from 1200 closes
               that gap as well, so the header now fits at every width rather
               than at the two that happened to be clean. */
            '@media (max-width:1200px){.nav-main.dns-nav-compact{gap:1.4rem;}',
            '.dns-open-btn,.dnw-open-btn{width:34px;height:34px;}}',
            /* One more step for 861 to 1000, the last stretch where the desktop
               nav is still shown before .nav-main is hidden at 860 and the
               burger takes over. The CantuPneus English nav overflowed here too,
               for the same reason: longest labels plus a language switch. */
            '@media (max-width:1000px){.nav-main.dns-nav-compact{gap:1rem;}}',

            '.dns-panel{position:fixed;inset:0;z-index:3080;display:none;}',
            '.dns-panel.is-open{display:block;}',
            '.dns-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);}',
            '.dns-sheet{position:absolute;top:0;left:0;right:0;background:var(--color-warm-white);',
            'max-height:88vh;display:flex;flex-direction:column;',
            'box-shadow:0 18px 44px rgba(0,0,0,.2);animation:dns-drop .28s ease;}',
            '@keyframes dns-drop{from{transform:translateY(-18px);opacity:.5;}to{transform:none;opacity:1;}}',
            '.dns-head{display:flex;align-items:center;gap:.8rem;padding:1.2rem 1.4rem;',
            'border-bottom:1px solid var(--color-ivory);}',
            '.dns-head svg{width:22px;height:22px;flex-shrink:0;fill:var(--color-taupe);}',
            '.dns-input{flex:1;min-width:0;border:0;background:transparent;font-size:1.1rem;',
            'color:var(--color-charcoal);padding:.3rem 0;}',
            '.dns-input:focus{outline:none;}',
            /* type=search draws its own clear button, which sat right next to
               this panel's close button and read as two ways to dismiss */
            '.dns-input::-webkit-search-cancel-button{display:none;}',
            '.dns-input::-webkit-search-decoration{display:none;}',
            '.dns-close{width:36px;height:36px;flex-shrink:0;border:0;background:transparent;',
            'font-size:1.6rem;line-height:1;cursor:pointer;color:var(--color-charcoal);}',
            '.dns-meta{display:flex;align-items:center;justify-content:space-between;gap:1rem;',
            'padding:.75rem 1.4rem;border-bottom:1px solid var(--color-ivory);flex-wrap:wrap;}',
            '.dns-chips{display:flex;gap:.4rem;overflow-x:auto;padding-bottom:.15rem;}',
            '.dns-chip{flex-shrink:0;padding:.4rem .8rem;cursor:pointer;font-size:.72rem;',
            'letter-spacing:.05em;text-transform:uppercase;font-weight:600;',
            'border:1px solid var(--color-taupe-light);background:transparent;',
            'color:var(--color-charcoal-soft);transition:all .22s ease;}',
            '.dns-chip:hover{border-color:var(--color-charcoal);}',
            '.dns-chip.is-active{background:var(--color-gold);border-color:var(--color-gold);',
            'color:var(--color-warm-white);}',
            '.dns-count{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;',
            'color:var(--color-taupe);white-space:nowrap;}',
            '.dns-results{flex:1;overflow-y:auto;padding:.6rem 1.4rem 1.6rem;}',
            '.dns-hint{margin:0;padding:.9rem 0;color:var(--color-taupe);font-size:.88rem;}',
            '.dns-none{padding:1rem 0;}',
            '.dns-none-title{margin:0 0 .3rem;font-weight:600;color:var(--color-charcoal);}',
            /* auto, not a fixed third column, so the row closes up on a site
               where the wishlist is not loaded and there is no heart */
            '.dns-result{position:relative;display:grid;grid-template-columns:64px 1fr auto;',
            'align-items:center;gap:.9rem;padding:.8rem 0;',
            'border-bottom:1px solid var(--color-ivory);}',
            '.dns-result:last-child{border-bottom:0;}',
            '.dns-result-media{display:block;width:64px;height:64px;background:var(--color-ivory);}',
            '.dns-result-media img{width:100%;height:100%;object-fit:cover;}',
            '.dns-result-body{min-width:0;}',
            '.dns-result-group{margin:0 0 .15rem;font-size:.66rem;letter-spacing:.12em;',
            'text-transform:uppercase;color:var(--color-taupe);}',
            '.dns-result-name{margin:0 0 .2rem;font-size:.95rem;font-weight:600;line-height:1.3;}',
            '.dns-result-name a{color:var(--color-charcoal);text-decoration:none;}',
            '.dns-result-name a:hover{text-decoration:underline;}',
            '.dns-result-price{margin:0;font-size:.88rem;color:var(--color-charcoal);}',
            '.dns-was{margin-left:.4rem;font-size:.76rem;color:var(--color-taupe);',
            'text-decoration:line-through;}',
            /* the heart is positioned inside cards, but here it is a grid cell */
            '.dns-result-heart{position:static;}',
            '@media (max-width:640px){.dns-result{grid-template-columns:52px 1fr auto;}',
            '.dns-result-media{width:52px;height:52px;}.dns-sheet{max-height:100vh;bottom:0;}}'
        ].join('');

        document.head.appendChild(style);
    }

    function injectButton() {
        var nav = document.querySelector('.nav-main');
        if (nav && !nav.querySelector('[data-dns-open]')) {
            var button = document.createElement('button');
            /* the cart button's look, none of its behaviour */
            button.className = 'cart-icon-btn dns-open-btn';
            button.type = 'button';
            button.setAttribute('aria-label', T.openLabel);
            button.setAttribute('data-dns-open', '');
            button.innerHTML = MAGNIFIER;

            var first = nav.querySelector('.login-icon-btn, .cart-icon-btn');
            if (first) nav.insertBefore(button, first);
            else nav.appendChild(button);

            /* see the header-room note in injectStyles: this nav now carries
               two controls it was not laid out for, so it opts in to the
               tighter spacing that makes them fit */
            nav.classList.add('dns-nav-compact');
        }

        var mobile = document.querySelector('.mobile-nav-cta');
        if (mobile && !mobile.querySelector('[data-dns-open]')) {
            var mobileButton = document.createElement('button');
            mobileButton.className = 'btn-primary dns-mobile-btn';
            mobileButton.type = 'button';
            mobileButton.setAttribute('data-dns-open', '');
            mobileButton.textContent = T.openLabel;
            mobile.insertBefore(mobileButton, mobile.firstChild);
        }
    }

    function injectPanel() {
        if (document.getElementById('dnsPanel')) return;

        var panel = document.createElement('div');
        panel.className = 'dns-panel';
        panel.id = 'dnsPanel';
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = ''
            + '<div class="dns-overlay" data-dns-close></div>'
            + '<div class="dns-sheet" role="search">'
            + '  <div class="dns-head">'
            + MAGNIFIER
            + '    <input class="dns-input" type="search" autocomplete="off"'
            + '      placeholder="' + escapeHtml(T.placeholder) + '"'
            + '      aria-label="' + escapeHtml(T.openLabel) + '" data-dns-input>'
            + '    <button class="dns-close" type="button" aria-label="' + escapeHtml(T.close) + '" data-dns-close>&times;</button>'
            + '  </div>'
            + '  <div class="dns-meta">'
            + '    <div class="dns-chips" data-dns-filters></div>'
            + '    <span class="dns-count" data-dns-count></span>'
            + '  </div>'
            + '  <div class="dns-results" data-dns-results></div>'
            + '</div>';

        document.body.appendChild(panel);
    }

    function openPanel() {
        var panel = document.getElementById('dnsPanel');
        if (!panel) return;

        ['mobileNav', 'mobileOverlay'].forEach(function (id) {
            var node = document.getElementById(id);
            if (node) node.classList.remove('active');
        });

        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        var input = panel.querySelector('[data-dns-input]');
        if (input) input.focus();

        if (!products.length) loadCatalog();
    }

    function closePanel() {
        var panel = document.getElementById('dnsPanel');
        if (!panel) return;

        clearTimeout(settleTimer);
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    /* ---------------------------------------------------------------- queries */
    function currentQuery() {
        var input = document.querySelector('[data-dns-input]');
        return input ? input.value.trim() : '';
    }

    /* Re-render now; report only when the query has settled. */
    function runQuery(options) {
        var query = currentQuery();
        var matches = search(query);
        renderResults(query, matches);

        clearTimeout(settleTimer);
        if (query.length < MIN_CHARS) return;

        if (options && options.immediate) {
            reportSearch(query, matches.length);
            return;
        }

        settleTimer = setTimeout(function () {
            reportSearch(query, search(currentQuery()).length);
        }, SETTLE_MS);
    }

    function loadCatalog() {
        var source = catalog();
        if (!source) return;

        source.loadProducts().then(function (list) {
            products = list || [];
            renderFilters();
            runQuery();
        }).catch(function (err) {
            console.error('search catalog load failed', err);
        });
    }

    function bind() {
        document.body.addEventListener('click', function (event) {
            if (event.target.closest('[data-dns-open]')) {
                event.preventDefault();
                openPanel();
                return;
            }

            if (event.target.closest('[data-dns-close]')) {
                closePanel();
                return;
            }

            var chip = event.target.closest('[data-dns-filter]');
            if (chip) {
                var picked = chip.dataset.dnsFilter || '';
                activeFilter = picked === activeFilter ? '' : picked;
                renderFilters();
                /* changing a filter with a query present IS a new search, and
                   it is deliberate rather than mid-typing, so report at once */
                runQuery({ immediate: currentQuery().length >= MIN_CHARS });
            }
        });

        var panel = document.getElementById('dnsPanel');
        var input = panel && panel.querySelector('[data-dns-input]');
        if (input) {
            input.addEventListener('input', function () { runQuery(); });
            input.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    runQuery({ immediate: true });
                } else if (event.key === 'Escape') {
                    closePanel();
                }
            });
        }

        window.addEventListener('keydown', function (event) {
            var open = document.getElementById('dnsPanel');
            if (event.key === 'Escape' && open && open.classList.contains('is-open')) {
                closePanel();
            }
        });
    }

    function init() {
        if (!catalog()) return;   /* no catalogue on this page: add nothing */

        injectStyles();
        injectButton();
        injectPanel();
        bind();
        renderResults('', []);
        loadCatalog();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
