/* ============================================================================
   Keeps the below-header inline target slot clear of the fixed site header.

   The Story layout, and any inline campaign, injects into the page's own flow.
   The slot for it sits immediately after </header>, which on the home page is
   flow position 0, directly underneath the fixed .site-header. Without a
   clearance the injected rail renders behind the header.

   A constant will not do, for two reasons:
     - the header is 117px on desktop and 110px on mobile, and it shrinks again
       when .scrolled applies
     - js/bannerOffset.js pushes the header DOWN while a Dengage top banner is
       pinned, so the clearance has to grow with it

   So this measures the header's actual bottom edge and publishes it as
   --dn-header-clearance on :root. cantu-style.css applies it as padding-top on
   the filled slot, with a 7rem fallback if this file never runs.

   Measuring bottom rather than height is what makes it compose with
   bannerOffset.js: whatever that module does to header.style.top is already
   included.
   ========================================================================== */
(function () {
    'use strict';

    var SLOT = '#dn_inline_target_below_header';

    function sync() {
        var header = document.querySelector('.site-header');
        if (!header) return;
        var bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
        var current = document.documentElement.style.getPropertyValue('--dn-header-clearance');
        if (current !== bottom + 'px') {
            document.documentElement.style.setProperty('--dn-header-clearance', bottom + 'px');
        }
    }

    var debounce = null;
    function queueSync() {
        clearTimeout(debounce);
        /* the engine animates injected content in, and bannerOffset.js
           transitions the header, so measure once both have settled */
        debounce = setTimeout(sync, 300);
    }

    function start() {
        sync();
        /* body subtree, because the slot fills and banners appear long after
           load; the same shape bannerOffset.js uses */
        new MutationObserver(queueSync).observe(document.body, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['style', 'class']
        });
        window.addEventListener('resize', queueSync);
        /* .scrolled changes the header height, but only matters while the slot
           is on screen, which is only near the top of the page */
        window.addEventListener('scroll', function () {
            if (document.querySelector(SLOT)) queueSync();
        }, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
