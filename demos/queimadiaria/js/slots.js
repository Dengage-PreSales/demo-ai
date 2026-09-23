/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    function looksLikeBanner(el, header) {
        if (!el || el === header || el.contains(header) || header.contains(el)) return false;
        var style = window.getComputedStyle(el);
        if (style.position !== 'fixed' || style.display === 'none') return false;
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        var box = el.getBoundingClientRect();
        if (box.top > 2 || box.height <= 0 || box.height > 200) return false;
        return box.width >= window.innerWidth * 0.9;
    }

    function findBanner(header) {
        var children = document.body.children;
        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            if (looksLikeBanner(el, header)) return el;
            var inner = el.children;
            for (var j = 0; j < inner.length; j++) {
                if (looksLikeBanner(inner[j], header)) return inner[j];
            }
        }
        return null;
    }

    var banner = null;

    var reported = null;

    function readBannerReport(event) {
        if (!event.data || event.data.dnBanner !== 'height') return;
        var px = Number(event.data.px);
        if (!isFinite(px) || px < 0 || px > 240) return;
        reported = Math.round(px);
        measure();
    }

    function bannerBottom(header) {

        if (reported !== null && reported > 0) return reported;
        if (banner && !document.body.contains(banner)) banner = null;
        if (banner && !looksLikeBanner(banner, header)) banner = null;
        if (!banner) return 0;
        var box = banner.getBoundingClientRect();
        return Math.round(box.bottom);
    }

    function rescan() {
        var header = document.querySelector('.site-header');
        if (!header) return;
        banner = findBanner(header);
        measure();
    }

    function measure() {
        var header = document.querySelector('.site-header');
        if (!header) return;

        document.documentElement.style.setProperty(
            '--dn-banner-height', bannerBottom(header) + 'px');

        var bottom = header.getBoundingClientRect().bottom;

        if (bottom < 0 || bottom > 400) return;
        document.documentElement.style.setProperty('--dn-header-clearance', Math.round(bottom) + 'px');
    }

    function init() {
        rescan();

        window.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure, { passive: true });

        window.addEventListener('message', readBannerReport);

        if (window.MutationObserver) {
            var observer = new MutationObserver(function () { rescan(); });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        var ticks = 0;
        var timer = setInterval(function () {
            rescan();
            if (++ticks > 10) clearInterval(timer);
        }, 200);
    }

    window.Slots = { init: init, measure: measure, rescan: rescan };
})(window, document);
