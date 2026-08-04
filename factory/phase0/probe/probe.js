/* ============================================================================
   Phase 0 probe. Handoff 13.

   Proves the panel side works before anything is built on top of it. It brings
   up the sandbox application, fires each of the eight shared scenarios, writes
   to each of the two sandbox tables, and shows exactly what it sent so the row
   can be found in Data Space afterwards.

   It runs in one of two modes, decided by factory/sandbox.json:

     dry run    accountId or appGuid is blank. Every payload is composed and
                printed and nothing is sent. This is the mode the page is in
                today, and it is what makes the event shapes reviewable before
                anyone holds a token.
     live       both are filled in. The SDK loads, initialize runs with the
                contact key already resolved, and the payloads go out.

   The same composition and validation used here is what the storefront
   template will use, so this file is the reference for two things that must
   not drift: the payload shapes, and the rule that a table name is never
   anything other than one of the two literals below.
   ========================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* The only two tables anything in this repository may write to.

       Handoff 1.3 and 14.4. This is an allowlist, not a denylist, and the
       distinction is the whole design: a denylist of the standard ecommerce
       tables passes a module that writes onsite_events, which is a core
       account table shared with the five live demo sites and the two mobile
       apps. It also passes any table nobody has invented yet.

       The check below is the runtime half. The CI guardrails are the static
       half, and neither is redundant with the other: CI reads source code and
       cannot see a value chosen while a demo is running. Handoff 5.3.        */
    var ONSITE_TABLE = 'sandbox_onsite_events';
    var EVENTS_TABLE = 'sandbox_events';
    var ALLOWED_TABLES = [ONSITE_TABLE, EVENTS_TABLE];

    var DEMO_SLUG = 'phase0-probe';
    var SCENARIO_PREFIX = 'dengage_demo_';

    /* Handoff 13 names this contact key as the acceptance criterion: the row
       in Data Space is looked up by it. Handoff 6.2 forbids the core account's
       own demo contact, so nothing here ever resolves to it. */
    var DEFAULT_CONTACT_KEY = 'ddemo-phase0-probe-1';

    var SANDBOX_CONFIG_URL = '../../sandbox.json';

    /* The eight campaigns from handoff 2.2, with the corrected spellings. The
       core repository's equivalents carry three deliberate misspellings that
       it cannot fix without taking live widgets dark. This is a fresh contract
       with nothing depending on it, so the names here are the corrected ones
       and the panel must be set up to match. */
    var SCENARIOS = [
        { slug: 'survey',              name: 'Survey',              kind: 'Popup' },
        { slug: 'nps-popup',           name: 'NPS',                 kind: 'Popup' },
        { slug: 'subscription-popup',  name: 'Subscription',        kind: 'Popup' },
        { slug: 'image-popup',         name: 'Image popup',         kind: 'Popup' },
        { slug: 'horizontal-popup',    name: 'Horizontal popup',    kind: 'Popup' },
        { slug: 'cta-image-popup',     name: 'CTA image popup',     kind: 'Popup' },
        { slug: 'sticky-bar',          name: 'Sticky bar',          kind: 'Banner, top' },
        { slug: 'image-bar',           name: 'Image bar',           kind: 'Banner, bottom' }
    ];

    /* The storefront event vocabulary from handoff 2.3, in full. Every one of
       these replaces something the reference build sent to a standard
       ecommerce table.

       Read the last two carefully. They deliberately leave out a price and a
       stock figure, because the scrape did not produce one, and leaving a
       column out is the required behaviour rather than sending zero.
       Number(null) is 0 in JavaScript and that trap has shipped the same bug
       twice on the core repository: every product announced as out of stock,
       poisoning every back in stock segment. Handoff 1.8.                    */
    var STOREFRONT_EVENTS = [
        {
            label: 'Add to cart',
            payload: {
                event_name: 'demo_add_to_cart',
                product_id: 'PROBE-001',
                product_name: 'Probe product',
                category_path: 'Probe',
                quantity: 1,
                unit_price: 24.5,
                currency: 'USD'
            }
        },
        {
            label: 'Remove from cart',
            payload: { event_name: 'demo_remove_from_cart', product_id: 'PROBE-001', quantity: 1 }
        },
        {
            label: 'Begin checkout',
            payload: { event_name: 'demo_begin_checkout', total_value: 24.5, currency: 'USD', quantity: 1 }
        },
        {
            label: 'Order completed',
            payload: {
                event_name: 'demo_order_completed',
                order_id: 'PROBE-ORDER-1',
                total_value: 24.5,
                currency: 'USD',
                quantity: 1
            }
        },
        {
            label: 'Search',
            payload: { event_name: 'demo_search', search_term: 'probe', result_count: 3 }
        },
        {
            label: 'Wishlist add',
            payload: {
                event_name: 'demo_wishlist_add',
                product_id: 'PROBE-002',
                product_name: 'Probe product without a price',
                list_name: 'default'
            }
        },
        {
            label: 'Wishlist remove',
            payload: { event_name: 'demo_wishlist_remove', product_id: 'PROBE-002', list_name: 'default' }
        },
        {
            label: 'Product view, no price',
            note: 'unit_price is left out rather than sent as zero',
            payload: {
                event_name: 'demo_product_view',
                product_id: 'PROBE-002',
                product_name: 'Probe product without a price',
                category_path: 'Probe',
                unit_price: null
            }
        }
    ];

    /* ------------------------------------------------------------------ */
    /* Small helpers                                                       */

    var $ = function (id) { return document.getElementById(id); };

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    /* Drops every key whose value is null, undefined or an empty string.

       This is the mechanism behind "omit the column, never fabricate a
       number". A payload builder that leaves unit_price as null and hands it
       straight to the SDK sends a zero, because that is what the value becomes
       on the way. Dropping the key is what actually keeps the column empty.   */
    function compact(payload) {
        var out = {};
        Object.keys(payload).forEach(function (key) {
            var value = payload[key];
            if (value === null || value === undefined || value === '') return;
            out[key] = value;
        });
        return out;
    }

    function pageType() {
        return (document.body && document.body.dataset && document.body.dataset.pageType) || 'probe';
    }

    /* ------------------------------------------------------------------ */
    /* The log                                                             */

    function log(tag, title, detail) {
        var pane = $('log');
        var entry = el('div', 'entry');
        var time = new Date().toTimeString().slice(0, 8);

        entry.appendChild(el('span', 'time', time + '  '));
        entry.appendChild(el('span', 'tag ' + tag, tag.toUpperCase()));
        entry.appendChild(document.createTextNode('  ' + title));
        if (detail !== undefined) {
            entry.appendChild(el('div', 'body', JSON.stringify(detail, null, 2)));
        }

        pane.appendChild(entry);
        pane.scrollTop = pane.scrollHeight;
    }

    /* ------------------------------------------------------------------ */
    /* Sending                                                             */

    var state = { live: false, accountId: '', appGuid: '', contactKey: DEFAULT_CONTACT_KEY };

    /* The runtime half of the table allowlist.

       Nothing on this page lets an operator type a table name, so today this
       can only ever pass. It is here because the storefront's event panel does
       render a control for choosing a table, and this is the shape that
       control's call site has to have: validate against the allowlist, and
       refuse anything else visibly rather than silently. Handoff 5.3.

       The two call sites below name their table as a literal on one line.
       That is not a style preference. CI reads the argument at the call site,
       so a variable there is unresolvable and is rejected, which is what makes
       the static half of this guarantee work at all.                          */
    function send(table, payload) {
        if (ALLOWED_TABLES.indexOf(table) === -1) {
            log('bad', 'Refused: ' + table + ' is not a sandbox table', { allowed: ALLOWED_TABLES });
            return false;
        }

        var body = compact(payload);
        body.contact_key = state.contactKey;
        body.demo_slug = DEMO_SLUG;
        body.page_url = window.location.href;

        if (!state.live) {
            log('dry', 'Would send to ' + table, body);
            return true;
        }

        try {
            if (table === ONSITE_TABLE) {
                window.dengage('sendDeviceEvent', 'sandbox_onsite_events', body);
            } else {
                window.dengage('sendDeviceEvent', 'sandbox_events', body);
            }
            log('sent', 'Sent to ' + table, body);
            return true;
        } catch (err) {
            log('bad', 'Send failed: ' + err.message, body);
            return false;
        }
    }

    function fireScenario(scenario) {
        var eventName = SCENARIO_PREFIX + scenario.slug;

        /* The SDK watches window.dataLayer itself, so a campaign whose trigger
           is a Data Layer Event fires from this push with no tag manager
           anywhere on the page. Handoff 5.1, 12.1. */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: eventName, actionType: eventName });
        log(state.live ? 'sent' : 'dry', 'dataLayer push', { event: eventName, actionType: eventName });

        send(ONSITE_TABLE, {
            event_name: eventName,
            scenario_group: 'Default Scenarios',
            widget_name: scenario.name,
            page_type: pageType()
        });

        if (state.live) {
            log('info', 'If nothing appears, check that a campaign exists with the trigger name ' + eventName);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Identity, then the SDK, in that order                               */

    /* The contact key is resolved before initialize runs, never after it.

       The core repository learned this the expensive way: it initialized
       anonymously and then set the contact key up to five seconds later, by
       which point pageView had already gone out, so page views landed on the
       anonymous device profile and the contact card showed nothing. Dengage's
       own guidance is to pass the identifiers to initialize when you have them
       first, and here we always do. Handoff 6.2.                              */
    function resolveContactKey() {
        var match = /[?&]ck=([^&#]+)/.exec(window.location.search);
        if (match) {
            try { return decodeURIComponent(match[1]); } catch (err) { return match[1]; }
        }
        return DEFAULT_CONTACT_KEY;
    }

    function bootSdk(accountId, appGuid, contactKey) {
        window.dengage = window.dengage || function () {
            (window.dengage.q = window.dengage.q || []).push(arguments);
        };

        var loader = 'https://pcdn.dengage.com/p/push/' + accountId + '/' + appGuid + '/dengage_sdk_loader.js';
        var script = document.createElement('script');
        script.async = true;
        script.src = loader;
        script.onerror = function () {
            log('bad', 'The SDK loader could not be fetched', { src: loader });
        };
        document.head.appendChild(script);

        /* Queued ahead of the loader arriving, which is what the queue on
           window.dengage is for. The contact key is already in hand. */
        window.dengage('initialize', { contactKey: contactKey });
        log('sent', 'initialize', { contactKey: contactKey });

        /* pageView is the one standard call that stays, and it is not kept for
           analytics. It is the documented trigger for On-Site messages: the
           eight scenarios have no local code and appear only when a pageView
           has fired and the targeting matches. Remove it and every widget goes
           dark, which is the entire product. Handoff 6.1.

           Panel setting that this depends on: Trigger Page View on Initialize
           must be OFF, or every page view is counted twice. Handoff 2.1.      */
        window.dengage('pageView', { page_type: pageType() });
        log('sent', 'pageView', { page_type: pageType() });
    }

    /* ------------------------------------------------------------------ */
    /* Status panel                                                        */

    function renderStatus(mode, rows, message) {
        var box = $('status');
        box.className = 'card status ' + mode;
        box.innerHTML = '';

        var badge = el('span', 'badge ' + mode,
            mode === 'live' ? 'Live' : mode === 'dry' ? 'Dry run' : 'Not configured');
        box.appendChild(badge);

        if (message) box.appendChild(el('p', null, message));

        var dl = document.createElement('dl');
        rows.forEach(function (row) {
            dl.appendChild(el('dt', null, row[0]));
            dl.appendChild(el('dd', null, row[1]));
        });
        box.appendChild(dl);
    }

    /* ------------------------------------------------------------------ */
    /* Push                                                                */

    function wirePush() {
        $('push-ask').addEventListener('click', function () {
            if (!('Notification' in window)) {
                $('push-state').innerHTML = '<span class="bad">This browser has no Notification API.</span>';
                return;
            }
            Notification.requestPermission().then(function (result) {
                $('push-state').innerHTML = 'Permission is now <strong>' + result + '</strong>.';
                log('info', 'Notification permission: ' + result);
                if (result === 'denied') {
                    $('push-state').innerHTML +=
                        ' Clearing it again is a browser setting, not something this page can undo.';
                }
            });
        });

        $('push-check').addEventListener('click', function () {
            var out = $('push-state');
            if (!('serviceWorker' in navigator)) {
                out.innerHTML = '<span class="bad">This browser has no service worker support.</span>';
                return;
            }
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                if (!registrations.length) {
                    out.innerHTML = 'No service worker is registered yet. The SDK registers one itself ' +
                        'once it initializes, so this stays empty in dry run.';
                    return;
                }
                var list = el('ul');
                registrations.forEach(function (reg) {
                    list.appendChild(el('li', null, reg.scope));
                });
                out.innerHTML = 'Registered, at these scopes:';
                out.appendChild(list);
                out.appendChild(el('p', null,
                    'The worker is served from the repository root so that one copy covers every ' +
                    'demo on this origin. A scope ending in the root is what you want to see here.'));
                log('info', 'Service worker scopes', registrations.map(function (r) { return r.scope; }));
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Reset                                                               */

    /* Names every key before removing anything, and asks a second time.

       The first version of this control wiped every Dengage looking key in
       storage. On a shared origin that reached the live demo sites' stored
       identity. This repository now has an origin of its own, so it can no
       longer do that harm, and the behaviour stays regardless: a destructive
       control that says what it is about to do is better whether or not the
       blast radius happens to be contained. Handoff 2.5a.                    */
    function wireReset() {
        var button = $('reset');
        var detail = $('reset-detail');
        var armed = null;

        function findKeys() {
            var found = [];
            [['localStorage', window.localStorage], ['sessionStorage', window.sessionStorage]]
                .forEach(function (pair) {
                    var store = pair[1];
                    if (!store) return;
                    try {
                        for (var i = 0; i < store.length; i++) {
                            var key = store.key(i);
                            if (/dengage|dn_|__dn|dnpush/i.test(key)) found.push([pair[0], key]);
                        }
                    } catch (err) { /* private mode, nothing readable */ }
                });
            return found;
        }

        button.addEventListener('click', function () {
            if (armed) {
                armed.forEach(function (pair) {
                    try { window[pair[0]].removeItem(pair[1]); } catch (err) { /* noop */ }
                });
                log('info', 'Cleared ' + armed.length + ' key(s)', armed.map(function (p) {
                    return p[0] + ': ' + p[1];
                }));
                detail.innerHTML = '<span class="ok">Cleared ' + armed.length +
                    ' key(s). Fire a scenario again.</span>';
                button.textContent = 'Show what would be cleared';
                button.className = 'btn btn-warn';
                armed = null;
                return;
            }

            var keys = findKeys();
            if (!keys.length) {
                detail.textContent = 'Nothing to clear. No Dengage keys are in storage for this origin.';
                return;
            }

            armed = keys;
            detail.innerHTML = 'These ' + keys.length + ' key(s) will be removed, and nothing else:';
            var list = el('ul');
            keys.forEach(function (pair) { list.appendChild(el('li', null, pair[0] + ': ' + pair[1])); });
            detail.appendChild(list);
            detail.appendChild(el('p', null, 'Press again to remove them.'));

            button.textContent = 'Confirm: remove these ' + keys.length + ' key(s)';
            button.className = 'btn btn-danger';
        });
    }

    /* ------------------------------------------------------------------ */
    /* Build the page                                                      */

    function renderLauncher() {
        var box = $('launcher');
        SCENARIOS.forEach(function (scenario) {
            var button = el('button', 'scenario');
            button.type = 'button';
            button.appendChild(el('span', 'name', scenario.name));
            button.appendChild(el('span', 'slug', SCENARIO_PREFIX + scenario.slug));
            button.appendChild(el('span', 'kind', scenario.kind));
            button.addEventListener('click', function () { fireScenario(scenario); });
            box.appendChild(button);
        });
    }

    function renderStorefrontEvents() {
        var box = $('events');
        STOREFRONT_EVENTS.forEach(function (item) {
            var button = el('button', 'scenario');
            button.type = 'button';
            button.appendChild(el('span', 'name', item.label));
            button.appendChild(el('span', 'slug', item.payload.event_name));
            if (item.note) button.appendChild(el('span', 'kind', item.note));
            button.addEventListener('click', function () {
                send(EVENTS_TABLE, item.payload);
            });
            box.appendChild(button);
        });
    }

    function start(config, error) {
        state.contactKey = resolveContactKey();

        var accountId = (config && config.accountId) || '';
        var appGuid = (config && config.appGuid) || '';

        var rows = [
            ['Contact key', state.contactKey],
            ['Demo slug', DEMO_SLUG],
            ['Onsite table', ONSITE_TABLE],
            ['Events table', EVENTS_TABLE]
        ];

        if (error) {
            renderStatus('err', rows,
                'factory/sandbox.json could not be read (' + error + '). Serve the repository root, ' +
                'not this folder, so the path resolves: python3 -m http.server 8101, then open ' +
                '/factory/phase0/probe/. Running in dry run until then.');
            $('log-intro').textContent = 'Every payload is printed here and nothing is sent.';
            log('info', 'Dry run. The sandbox configuration could not be read.');
        } else if (!accountId || !appGuid) {
            renderStatus('dry', rows,
                'factory/sandbox.json has no accountId and appGuid yet, so nothing is sent. Every ' +
                'payload below is composed exactly as it would go out and printed to the log. Fill ' +
                'the two values in once the sandbox application exists, then reload.');
            $('log-intro').textContent = 'Every payload is printed here and nothing is sent.';
            log('info', 'Dry run. Fill in factory/sandbox.json to go live.');
        } else {
            state.live = true;
            state.accountId = accountId;
            state.appGuid = appGuid;
            rows.unshift(['Application', accountId + ' / ' + appGuid]);
            renderStatus('live', rows,
                'Live. Payloads are sent to the sandbox application. Firing a scenario should make a ' +
                'widget appear, and the click should appear as a row in sandbox_onsite_events against ' +
                'the contact key below. The row is the acceptance criterion, not the response code.');
            $('log-intro').textContent =
                'Everything sent is printed here. Compare it against the row in Data Space.';
            bootSdk(accountId, appGuid, state.contactKey);
        }

        renderLauncher();
        renderStorefrontEvents();
        wirePush();
        wireReset();
        $('log-clear').addEventListener('click', function () { $('log').innerHTML = ''; });
    }

    /* The configuration is read before anything else happens, and the contact
       key is resolved before the SDK is asked to do anything, which is the
       ordering that matters. A generated demo has both values substituted into
       its page at build time and so keeps the SDK snippet in the head, exactly
       as the reference build does. The probe reads them at runtime instead
       because it is one page that has to work before those values exist. */
    fetch(SANDBOX_CONFIG_URL, { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function (config) { start(config, null); })
        .catch(function (err) { start(null, err.message); });
})();
