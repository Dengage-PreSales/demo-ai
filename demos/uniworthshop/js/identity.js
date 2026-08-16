/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window) {
    'use strict';

    var slug = document.documentElement.getAttribute('data-demo-slug');
    if (!slug) {
        slug = 'demo';
        if (window.console) {
            console.error('[demo] data-demo-slug is missing from the html element. ' +
                'Cart, wishlist and contact key are not namespaced, so this demo will ' +
                'collide with every other demo open in this browser.');
        }
    }
    window.DEMO_SLUG = slug;

    var STORE_KEY = 'dps:' + slug + ':ck';

    function read(store, key) {
        try { return store.getItem(key); } catch (err) { return null; }
    }
    function write(store, key, value) {
        try { store.setItem(key, value); } catch (err) {  }
    }

    function fromUrl() {
        var match = /[?&]ck=([^&#]+)/.exec(window.location.search);
        if (!match) return null;
        try { return decodeURIComponent(match[1]); } catch (err) { return match[1]; }
    }

    var key = fromUrl();
    if (key) {
        write(window.sessionStorage, STORE_KEY, key);
    } else {
        key = read(window.sessionStorage, STORE_KEY) || read(window.localStorage, STORE_KEY);
    }

    window.DemoIdentity = { contactKey: key || null, storageKey: STORE_KEY };

    if (key) window.__dnInit = { contactKey: key };

    window.DemoIdentity.mintKey = function (n) {
        return 'DPS-' + n;
    };
})(window);
