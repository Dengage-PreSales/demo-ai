/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    function settings() {
        var config = window.DEMO_CONFIG || {};
        var relay = config.relay || null;
        if (!relay || !relay.url || !relay.key) return null;
        var slug = window.DEMO_SLUG || config.slug || '';
        if (!slug) return null;
        return { url: String(relay.url).replace(/\/$/, ''), key: relay.key, slug: slug };
    }

    function sentKey(slug) { return 'dps:' + slug + ':relay'; }

    function alreadySent(SENT_KEY, intent) {
        try {
            var seen = window.sessionStorage.getItem(SENT_KEY) || '';
            return seen.split(',').indexOf(intent) !== -1;
        } catch (err) { return false; }
    }

    function remember(SENT_KEY, intent) {
        try {
            var seen = window.sessionStorage.getItem(SENT_KEY) || '';
            var list = seen ? seen.split(',') : [];
            if (list.indexOf(intent) === -1) list.push(intent);
            window.sessionStorage.setItem(SENT_KEY, list.join(','));
        } catch (err) {  }
    }

    var sentThisLoad = {};

    function basketContext() {
        var lines = [];
        try {
            lines = (window.Store && window.Store.cart()) || [];
        } catch (err) { return null; }
        if (!lines.length) return null;
        return {

            lines: lines.slice(0, 20).map(function (line) {
                return { id: line.id, qty: Math.max(1, Number(line.quantity) || 1) };
            }).filter(function (line) { return !!line.id; })
        };
    }

    function send(intent, context) {
        var config = settings();
        if (!config || !intent) return;
        var SENT_KEY = sentKey(config.slug);
        if (alreadySent(SENT_KEY, intent) || sentThisLoad[intent]) return;
        var identity = window.DemoIdentity || {};

        if (!identity.contactKey) return;

        var body;
        try {
            body = JSON.stringify({
                contact_key: identity.contactKey,
                slug: config.slug,
                intent: intent,
                context: context || {}
            });
        } catch (err) { return; }

        sentThisLoad[intent] = true;
        remember(SENT_KEY, intent);

        var url = config.url + '/rest/v1/rpc/dps_transactional';
        try {
            window.fetch(url, {
                method: 'POST',
                keepalive: true,
                headers: {
                    'content-type': 'application/json',
                    'apikey': config.key,
                    'authorization': 'Bearer ' + config.key
                },
                body: body
            }).then(function (response) {
                note(config.slug, intent, response.ok ? 'sent' : 'refused ' + response.status);
            }).catch(function () { note(config.slug, intent, 'not delivered'); });
        } catch (err) { note(config.slug, intent, 'not delivered'); }
    }

    function note(slug, intent, outcome) {
        try {
            window.dispatchEvent(new window.CustomEvent('dps:' + slug + ':relay', {
                detail: { intent: intent, outcome: outcome, at: Date.now() }
            }));
        } catch (err) {  }
    }

    function leavingWithABasket() {
        var context = basketContext();
        if (!context) return;
        send('exit-intent-basket', context);
    }

    var EXIT_ABOVE = -20;
    document.documentElement.addEventListener('mouseleave', function (event) {
        if (event.clientY >= EXIT_ABOVE) return;
        leavingWithABasket();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') leavingWithABasket();
    });
    window.addEventListener('pagehide', leavingWithABasket);

    window.Relay = {
        send: send,
        configured: function () { return !!settings(); },
        intents: ['exit-intent-basket'],
        endpoint: function () {
            var config = settings();
            return config ? config.url + '/rest/v1/rpc/dps_transactional' : null;
        }
    };
})(window, document);
