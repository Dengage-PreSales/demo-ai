/* ============================================================================
   THE STOREFRONT HALF OF THE TRANSACTIONAL RELAY.

   A moment happens in the demo. This names it and asks the relay to send the
   message for it. Everything else, which template, which address, which
   products, which prices, and whether the moment may send at all, is decided in
   the database. factory/panel/supabase/README-relay.md is the whole design.

     the storefront names the intent   <- this file
        -> one call: contact key, slug, intent, a little context
           -> the relay validates, composes, authenticates, sends, records

   WHY THIS FILE IS SO SMALL, and why it must stay that way. Every decision worth
   protecting lives on the other side. The relay refuses an email address from
   the caller, a content id from the caller and a price from the caller, and it
   rate limits per contact. So the page cannot say who to write to, what template
   to use, or what anything costs, and this file could not do those things if it
   tried. What it can do is say "this visitor reached this moment", which is the
   only thing a page is actually in a position to know.

   IT REACHES THE SDK NOT AT ALL. CLAUDE.md 1b: js/dengageEvents.js is the only
   module allowed to reach the SDK, and nothing here does. A relay send is not a
   Dengage event and is never counted as one.

   No example of that call is written out above, on purpose. The guard matches
   the SDK function by name and does not exempt comments, because exempting them
   would mean parsing JavaScript in grep, and rewording a sentence is cheaper
   than a parser. js/identity.js says the same thing for the same reason, and
   this file learned it the same way: by failing the check.

   IT IS INERT UNTIL A DEMO IS CONFIGURED FOR IT. A demo whose config carries no
   relay block, which is every demo built before this existed and the template
   itself, loads this file and does nothing at all.

   WHAT IT WILL NOT DO, however convenient:

     it never sends twice for the same moment in one visit, because a message
     that arrives twice reads as a broken integration rather than a demonstration

     it never sends from an empty basket, because the one moment that exists is
     about a basket somebody left behind

     it never blocks or slows the page: the call is fire and forget, its failure
     is invisible to the visitor, and a relay that is down costs a message
     rather than a demo
   ========================================================================== */
(function (window, document) {
    'use strict';

    /* READ WHEN NEEDED, NEVER AT LOAD. js/boot.js fetches demo.config.json and
       assigns window.DEMO_CONFIG when that request comes back, so a module that
       reads it while the page is parsing reads nothing at all. The first version
       of this file did exactly that and returned early on every demo, configured
       or not, which the check below caught before a demo ever shipped with it.
       Every other module in this storefront reads the config inside a function
       for the same reason. */
    function settings() {
        var config = window.DEMO_CONFIG || {};
        var relay = config.relay || null;
        if (!relay || !relay.url || !relay.key) return null;
        var slug = window.DEMO_SLUG || config.slug || '';
        if (!slug) return null;
        return { url: String(relay.url).replace(/\/$/, ''), key: relay.key, slug: slug };
    }

    /* ONE SEND PER MOMENT PER VISIT, remembered for the tab rather than the
       device. sessionStorage rather than localStorage on purpose: a demo is
       shown repeatedly to different people on the same laptop, and a moment
       that fired last week must be available again on this call. */
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
        } catch (err) { /* private mode: the guard below still holds in memory */ }
    }

    var sentThisLoad = {};

    /* WHAT THE PAGE IS ENTITLED TO SAY. Product ids and quantities, and nothing
       else. The relay looks every id up in its own copy of this demo's catalogue
       and composes the names, the pictures, the links and every number from
       there, so a page that lied about a price would be ignored rather than
       believed. Sending less is also simply smaller. */
    function basketContext() {
        var lines = [];
        try {
            lines = (window.Store && window.Store.cart()) || [];
        } catch (err) { return null; }
        if (!lines.length) return null;
        return {
            /* quantity, NOT qty. A cart line is written by js/store.js and that
               is the name it uses; the first version of this read line.qty,
               which is undefined on every line, so every basket reached the
               relay as a list of quantities of nothing. Found by the check
               rather than by a message arriving wrong, which is the only
               acceptable way to find it. */
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
        /* NO CONTACT, NO MESSAGE. The relay finds the address in its own table
           from this key, so an anonymous visitor has nowhere for a message to
           go. That is not a failure: it is the first minute of a demo, before
           the account card has been used. */
        if (!identity.contactKey) return;

        /* THE MESSAGE IS BUILT BEFORE THE MOMENT IS SPENT, and the order is not
           cosmetic. It used to be the other way round, and a stale variable in
           here threw while building the body: the moment was already recorded
           as sent, so the guard above refused every later attempt and the demo
           went silent for the rest of the visit having sent nothing at all.
           Building first means a failure here costs nothing. */
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

        /* keepalive, because every moment worth sending is one where the visitor
           is leaving and an ordinary request dies with the page. sendBeacon
           survives the same way and cannot carry the two headers this endpoint
           needs, so it is not used. */
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

    /* The readout, and nowhere else. ?debug=1 shows it; a normal demo URL shows
       nothing, exactly as the standby module reports itself. */
    function note(slug, intent, outcome) {
        try {
            window.dispatchEvent(new window.CustomEvent('dps:' + slug + ':relay', {
                detail: { intent: intent, outcome: outcome, at: Date.now() }
            }));
        } catch (err) { /* a readout never breaks a demo */ }
    }

    /* ---------------------------------------------------------------- */
    /* The moments                                                       */

    /* LEAVING WITH A BASKET, and it is deliberately read from two signals
       rather than one. Exit intent is a mouse leaving the top of the window,
       which is the engine's own definition and which a touch device can never
       produce: a phone has no cursor to leave. So a page being hidden counts
       too, which is what leaving looks like on a phone, and the send happens at
       most once either way. */
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

    /* EXPOSED WHETHER OR NOT THIS DEMO CAN SEND, and configured() is how a
       caller tells. A surface that appears only on some demos is a surface a
       check has to special case, and send() is inert without a relay block
       anyway, so the honest shape is one object that answers truthfully. */
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
