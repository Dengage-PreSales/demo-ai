/* ============================================================================
   The scenario launcher and the event panel.

   THE EVENT PANEL IS THE ONE TO UNDERSTAND. Handoff 5.3.

   The reference build's eventModal.js renders a FREE-TEXT INPUT for the table
   name and sends to whatever is typed into it. Every guard in this design is
   static analysis, and that input routes around all of it at demo time, in the
   hands of a pre-sales person who will not know why it matters. It passes every
   CI check and writes to whichever table someone types, in front of a prospect.

   The fix here is structural rather than defensive: there is no table field at
   all. The operator picks an EVENT from a fixed list, and the event determines
   its own table, because that is how the SDK works. A name cannot be typed
   because nothing accepts typing. Combined with the guard's event-single-source
   check, every write on this page goes through DengageEvents and every one of
   them is one of the nine calls below.

   The demo loses nothing. What the panel demonstrates is that a storefront
   action lands in Dengage as a real ecommerce event, not that the operator may
   name a table freely.

   The card copy names the table each event actually writes, because a card that
   announces one table while writing to another is worse than no card.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel) { return document.querySelector(sel); };

    /* EVERY CAMPAIGN IN factory/creatives/ GETS A BUTTON HERE, and that is the
       whole contract of this list. Twenty campaigns across four groups, plus
       the five recommendation strategies rendered separately below, which is the
       twenty five scenarios the launcher is expected to offer.

       The list and the folder must not drift. A creative with no button cannot be
       demonstrated at all, and a button with no creative fires an event nothing
       listens for, which looks identical to a broken widget. Both directions are
       checked in factory/checks/launcher.js, against the file names on disk.

       The one exception is marked 'panel: true', for a campaign whose content is
       authored in the panel's own builder rather than pasted from this repository.
       It gets a card and no file, and the check is told to expect exactly that.
       Anything else with no file is a defect.

       Spellings are the corrected ones. The reference build carries three
       deliberate misspellings it cannot fix without taking live widgets dark;
       this is a fresh contract, so these are the corrected names and the panel is
       set up to match.

       GROUPING IS NOT DECORATION. Twenty flat buttons is a wall, and on a call
       the operator is looking for one specific thing while talking. The groups are
       the ones a prospect asks about by name.

       'gesture' MARKS THE TWO THE LAUNCHER CANNOT FIRE, and they are still listed.
       Exit intent listens for the pointer leaving the window and scroll depth for a
       scroll position, so neither has a data layer event to push. Leaving them out
       would suggest the factory does not build them; making them look like the
       others would produce a button that does nothing. So they carry the gesture
       instead, and clicking one says what to do. */
    var SCENARIOS = [
        /* On-site messaging, 11 */
        { slug: 'subscription-popup', name: 'Subscription',     group: 'onsite' },
        { slug: 'survey',             name: 'Survey',           group: 'onsite' },
        { slug: 'nps-popup',          name: 'NPS',              group: 'onsite' },
        { slug: 'image-popup',        name: 'Image popup',      group: 'onsite' },
        { slug: 'horizontal-popup',   name: 'Horizontal popup', group: 'onsite' },
        { slug: 'cta-image-popup',    name: 'CTA image popup',  group: 'onsite' },
        { slug: 'sticky-bar',         name: 'Sticky bar',       group: 'onsite' },
        { slug: 'image-bar',          name: 'Image bar',        group: 'onsite' },
        { slug: 'slide-in',           name: 'Slide in',         group: 'onsite' },
        { slug: 'exit-intent',        name: 'Exit intent',      group: 'onsite',
          gesture: 'gestureExitIntent' },
        { slug: 'scroll-depth',       name: 'Scroll depth',     group: 'onsite',
          gesture: 'gestureScrollDepth' },

        /* A/B testing, 1 campaign. Three variants and a control arm live inside it,
           so there is one trigger name and one button. Which arm appears is the
           engine's decision, and pressing this repeatedly is how the split gets
           demonstrated. */
        { slug: 'ab-test',            name: 'A/B test',         group: 'abtest' },

        /* Gamification, 3. Salil's call, 5 August 2026: pick a box, the slot machine
           and the mystery coupon are gone, and countdown to win replaces all three.
           Five mechanics was more than a call needs and each one carried the same
           three second draw and the same fallback state, so the marginal one added
           setup time rather than anything a prospect had not already seen.

           COUNTDOWN TO WIN HAS A FILE NOW, and until 7 August 2026 it did not.
           It was built in the panel's own game builder and carried panel: true, which
           is what tells factory/checks/launcher.js to expect a card with no creative
           on disk. Salil asked for a file so the panel's stock template could be
           replaced with one that matches the rest of the set and takes the demo's
           theme, so the flag is gone and the check now expects a creative like any
           other card. 'panel: true' still means exactly what it says for the cards
           below that keep it. */
        { slug: 'spin-to-win',        name: 'Spin to win',      group: 'game' },
        { slug: 'scratch-card',       name: 'Scratch card',     group: 'game' },
        { slug: 'countdown-to-win',   name: 'Countdown to win',  group: 'game' },

        /* Inline, 5. These render into a slot in the page rather than over it, so
           the launcher closes and the page is where to look. js/slots.js owns the
           five targets.

           'target' NAMES THE SLOT, and it is checked before firing. Three of the
           five slots exist on one page only: below hero and in grid are home page,
           below price is a product page. Firing one from the wrong page pushes an
           event the campaign answers correctly, into a target that is not in the
           document, so nothing renders and the log would say it fired. That is the
           most expensive kind of wrong on a call, because it looks like the
           product failing rather than the operator being on the wrong page. */
        { slug: 'inline-below-header',    name: 'Below header',    group: 'inline',
          target: 'dn_inline_target_below_header' },
        { slug: 'inline-below-hero',      name: 'Below hero',      group: 'inline',
          target: 'dn_inline_target_below_hero' },
        { slug: 'inline-in-grid',         name: 'In grid',         group: 'inline',
          target: 'dn_inline_target_in_grid' },
        { slug: 'inline-pdp-below-price', name: 'Below price',     group: 'inline',
          target: 'dn_inline_target_pdp_below_price' },
        { slug: 'inline-above-footer',    name: 'Above footer',    group: 'inline',
          target: 'dn_inline_target_above_footer' },

        /* DENGAGE'S OWN RECOMMENDATION ENGINE IS PARKED, Salil's call, 5 August 2026.
           The campaign is live in the panel but renders nothing on the page, and the
           most likely reason is that this application has no product feed: a
           recommendation campaign needs a catalogue to recommend from, and the
           storefront's ec:* events give it behaviour rather than products. A card
           that fires into an empty widget is worse than no card, because on a call
           it reads as the engine failing rather than as a feed that was never
           configured.

           TO TURN IT BACK ON, put this line back and re-add { id: 'engine',
           copy: 'groupEngine' } to GROUPS below. Nothing else is needed: the slot
           #dn_inline_target_reco is still in both pages and js/slots.js still
           documents it, because an empty slot collapses to nothing and costs
           nothing to keep.

           { slug: 'reco-engine', name: 'Dengage engine', group: 'engine',
             panel: true, target: 'dn_inline_target_reco' } */

        /* DENGAGE'S OWN NO-CODE TEMPLATES. Grouped with on-site messaging from
           6 August 2026, Salil's call, because that is what they are: a prospect
           sees a popup and does not care whether its HTML was pasted from this
           repository or drawn in the Visual Editor. They had their own heading
           while there were five of them and two said "not ready", which made the
           grouping a description of our build process rather than of the product.

           panel: true still marks them, and it still means there is no file in
           factory/creatives/: the template IS the creative and the settings live in
           factory/panel/REFERENCE.md. That flag is what tells
           factory/checks/launcher.js not to expect a creative on disk.

           They exist as cards because a capability nobody can fire is a capability
           the demo does not have. Handoff 2.2c.

           VERTICAL POPUP LEFT THIS GROUP ON 7 AUGUST 2026, which is why the flag is
           worth keeping honest rather than treating as decoration. It is now an HTML
           creative in factory/creatives/vertical-popup.html, carrying the same
           anatomy, copy and button labels as the panel template it replaces. The
           reason for the move is the one thing a native template cannot do: its look
           is set by fields in the panel, so it is one fixed palette on every demo,
           and it renders in a cross origin iframe where the page's custom properties
           do not reach. A pasted file can ask the page what the theme is.

           The panel template itself is still documented and still works. If it is
           ever preferred again, put panel: true back and delete the file, because
           factory/checks/launcher.js checks the two lists in both directions and
           will fail if a slug claims a file that is not there or has one it did not
           declare. */
        { slug: 'story',          name: 'Story',          group: 'onsite', panel: true },

        /* VIDEO POPUP KEEPS panel: true AND GAINS AN ACTION, 8 August 2026, and
           the two flags together are the design rather than a contradiction.

           panel: true stays because it states a fact about disk:
           factory/checks/launcher.js reads it as "expect no creative in
           factory/creatives/", and there is still none. The native Video Popup
           template is still documented in factory/panel/REFERENCE.md and
           still streams this same film when its campaign fires.

           The action is here because that campaign cannot be triggered cleanly
           in the middle of a call, so pressing this card plays the same film
           locally, from this repository's own committed files, in the themed
           overlay built further down this file. What a prospect sees is the
           same film either way.

           IT MUST NOT PUSH TO THE DATA LAYER. The panel campaign may be bound
           to the dengage_demo_video-popup trigger, and pushing that trigger
           would stack the platform's own popup over this overlay, mid call,
           playing the film twice at once. So this is an action card like web
           push and the inbox: it never reaches DengageEvents and the log never
           claims a campaign fired.

           actionCopy IS THE LABEL ITSELF rather than a copy.json key. text()
           falls back to the key when copy.json has no entry, so the label
           travels with this file, which is the only file the local player
           lives in. A copy.json entry under this exact string would override
           it, which is the correct direction for a second language. */
        { slug: 'video-popup',    name: 'Video popup',    group: 'onsite', panel: true,
          action: 'video-open', actionCopy: 'Plays the demo film here' },
        { slug: 'vertical-popup', name: 'Vertical popup', group: 'onsite' },

        /* PRODUCT BOX AND SMART SEARCH ARE PARKED, Salil's call, 6 August 2026.
           Both need a product catalogue inside Dengage for this application, and
           this application does not have one yet: factory/panel/REFERENCE.md
           has the feed itself (built, live) and what still has to happen with it,
           which is backend work, not a panel setting. A card that opens onto
           something with nothing to show is worse than no card.

           TO TURN EITHER BACK ON, put its line back below. Nothing else changes:
           product-box needs no target, smart-search's is the search input,
           #search-input, on both pages.

           { slug: 'product-box',  name: 'Product box',  group: 'onsite', panel: true },
           { slug: 'smart-search', name: 'Smart search', group: 'onsite', panel: true,
             target: 'search-input' }, */

        /* TYPEFORM IS ALSO PARKED, Salil's call, 6 August 2026, the same day it was
           turned on. It is built differently in the panel than the other five
           no-code templates above: its content is a plain on-site template holding
           Typeform's own embed snippet (script and div), authored once in the
           panel's content editor, and a SEPARATE Campaign Targeting On Site object
           is then attached to that content to carry the trigger. The single
           Trigger dropdown this repository documented for every other template does
           not exist on the content screen itself, only on the campaign attached to
           it, so the setup is two steps rather than one and the first attempt at
           documenting it undersold that. factory/panel/REFERENCE.md has the
           corrected version once this is picked back up.

           TO TURN IT BACK ON, put this line back.

           { slug: 'typeform', name: 'Typeform', group: 'onsite', panel: true }, */

        /* WEB PUSH IS NOT A CAMPAIGN AND DOES NOT PUSH A DATA LAYER EVENT.
           'action' marks a card that calls the SDK directly instead. A page can ask
           the browser for permission and hand the token to Dengage, which subscribes
           the device; it cannot send a notification, because sending is a campaign
           or a journey. So this button subscribes and the notification arrives
           because something in the panel is listening.

           It has to be a real click. Browsers ignore a permission prompt raised
           without a gesture, and a dismissed prompt counts against the origin, so
           asking on page load would quietly poison push for every later call on
           that machine. */
        { slug: 'web-push',       name: 'Web push',       group: 'push',
          action: 'push-prompt', actionCopy: 'actionPushPrompt' },

        /* THE APP INBOX IS BUILT HERE, NOT IN THE PANEL, which makes it the only
           entry in this list that is neither a creative nor a template. No Visual
           Editor template draws an inbox, so js/inbox.js is the inbox and this
           card opens it. Like web push it is an action rather than a trigger:
           there is no campaign to fire, only a list to read.

           It needs no push permission. The inbox is keyed on the device id the
           SDK creates at initialize, so an anonymous visitor who has never seen
           a prompt still has one. Messages arrive in it from a campaign or a
           journey in the panel. */
        { slug: 'inbox',          name: 'App inbox',      group: 'inbox',
          action: 'inbox-open', actionCopy: 'actionInboxOpen', target: 'inbox-body' }
    ];

    /* Group order is display order. The heading copy is in copy.json with
       everything else, so a second language stays cheap. */
    var GROUPS = [
        { id: 'onsite', copy: 'groupOnsite' },
        { id: 'abtest', copy: 'groupAbTest' },
        { id: 'game',   copy: 'groupGame' },
        { id: 'inline', copy: 'groupInline' },
        /* 'native' was here until 6 August 2026, when Story, Video popup and
           Vertical popup moved into 'onsite'. Left out rather than kept empty:
           renderLauncher skips a group with no members, so an unused entry is
           invisible on screen and misleading in the source. groupNative stays in
           copy.json, unused, so restoring the heading is one line in each place. */
        { id: 'push',   copy: 'groupPush' },
        { id: 'inbox',  copy: 'groupInbox' }
    ];

    /* Fixed. No free text anywhere. Each entry names the table it writes so the
       audience sees the truth. */
    var EVENTS = [
        { id: 'pageView',              label: 'Page view',         table: 'page_view_events' },
        { id: 'ec:addToCart',          label: 'Add to cart',        table: 'shopping_cart_events' },
        { id: 'ec:removeFromCart',     label: 'Remove from cart',   table: 'shopping_cart_events' },
        { id: 'ec:beginCheckout',      label: 'Begin checkout',     table: 'shopping_cart_events' },
        { id: 'ec:order',              label: 'Order',              table: 'order_events, order_events_detail' },
        { id: 'ec:search',             label: 'Search',             table: 'search_events' },
        { id: 'ec:addToWishlist',      label: 'Add to wishlist',    table: 'wishlist_events' },
        { id: 'ec:removeFromWishlist', label: 'Remove from wishlist', table: 'wishlist_events' }
    ];

    var ALLOWED = EVENTS.map(function (e) { return e.id; });

    /* ------------------------------------------------------------------ */
    /* Recommendations, restored 6 August 2026, Salil's call                */

    /* THESE ARE NOT CAMPAIGNS, and that is the point of the group. No creative to
       paste, no target selector, no panel setup, because nothing here comes from
       Dengage: js/recommend.js computes all five from the demo's own catalogue.

       Which means they are always the prospect's vertical. A mobile retailer on
       Monday and a fashion retailer on Thursday each see their own products, from
       the same code, with no edit. Handoff 2.2c.

       DENGAGE'S OWN ENGINE IS A SEPARATE DECISION AND STAYS PARKED, above. These
       five were briefly parked alongside it because a working Recommendations
       section beside two cards reading "not yet set up" looked inconsistent on a
       call. That was a presentation judgement rather than a technical one: these
       never depended on the product catalogue inside Dengage, which is what the
       engine, Product Box and Smart Search are waiting on. */
    function renderRecommendations() {
        var host = $('#rec-grid');
        if (!host || !window.Recommend) return;
        host.innerHTML = window.Recommend.strategies.map(function (s) {
            return '<button type="button" class="scenario" data-reco="' + s.id + '">' +
                '<span class="name">' + s.label + '</span>' +
                '<span class="slug">' + s.note + '</span>' +
            '</button>';
        }).join('');
    }

    function log(message, detail) {
        var pane = $('#panel-log');
        if (!pane) return;
        var time = new Date().toTimeString().slice(0, 8);
        pane.textContent = time + '  ' + message +
            (detail ? '\n' + JSON.stringify(detail, null, 2) : '') +
            '\n\n' + pane.textContent;
    }

    /* ------------------------------------------------------------------ */
    /* Launcher                                                            */

    function scenarioPrefix() {
        return (window.DEMO_CONFIG && window.DEMO_CONFIG.dengage &&
                window.DEMO_CONFIG.dengage.scenarioPrefix) || 'dengage_demo_';
    }

    function text(key) {
        return (window.Storefront && window.Storefront.t) ? window.Storefront.t(key) : key;
    }

    function renderLauncher() {
        var host = $('#launcher-grid');
        if (!host) return;
        var prefix = scenarioPrefix();

        host.innerHTML = GROUPS.map(function (g) {
            var members = SCENARIOS.filter(function (s) { return s.group === g.id; });
            if (!members.length) return '';

            /* The heading spans the grid, so it stays a heading rather than
               becoming a third column of one. */
            return '<h3 class="launcher-group">' + text(g.copy) +
                   ' <span>' + members.length + '</span></h3>' +
                members.map(function (s) {
                    /* A gesture card is not a fire button and must not look like
                       one, because pressing it can never make the widget appear.
                       It is still a button so it is reachable by keyboard and can
                       say what to do instead. */
                    if (s.gesture) {
                        return '<button type="button" class="scenario gesture" ' +
                                'data-gesture="' + s.slug + '">' +
                            '<span class="name">' + s.name + '</span>' +
                            '<span class="slug">' + text(s.gesture) + '</span>' +
                        '</button>';
                    }
                    /* An action card calls the SDK rather than pushing an event,
                       so it shows what it does instead of a trigger name. */
                    if (s.action) {
                        return '<button type="button" class="scenario action" ' +
                                'data-action="' + s.action + '">' +
                            '<span class="name">' + s.name + '</span>' +
                            '<span class="slug">' + text(s.actionCopy) + '</span>' +
                        '</button>';
                    }
                    /* A slot that is not on this page is shown as unavailable
                       here rather than discovered by pressing it. */
                    var here = !s.target || document.getElementById(s.target);
                    return '<button type="button" class="scenario' + (here ? '' : ' elsewhere') +
                            '" data-scenario="' + s.slug + '">' +
                        '<span class="name">' + s.name + '</span>' +
                        '<span class="slug">' +
                            (here ? prefix + s.slug : text('inlineElsewhere')) +
                        '</span>' +
                    '</button>';
                }).join('');
        }).join('');
    }

    /* Clearing the SDK's local display state, which is what makes a widget
       appear again after it has been fired a few times. Names every key before
       removing anything and asks a second time: a destructive control that says
       what it is about to do is better behaviour whether or not the blast radius
       is contained. Handoff 2.5a, 2.6. */
    /* ------------------------------------------------------------------ */
    /* Quick reference                                                     */

    /* Local rather than Catalog.escapeAttr, because the launcher renders before
       the catalogue has necessarily loaded and a missing helper would take the
       whole panel down. These values are uuids and tokens from the SDK, so this
       is belt and braces rather than a real injection surface, but a value that
       reaches innerHTML gets escaped on principle. */
    function esc(text) {
        return String(text === null || text === undefined ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* The identifiers a call needs pasted into the panel, each with a copy
       button, because reading a uuid aloud or retyping it from a screen is how
       the wrong device gets targeted.

       Values come from js/dengageEvents.js reference(), which owns the SDK calls.
       Two of them arrive asynchronously and one has no accessor at all, so this
       renders placeholders first and fills them in, rather than blocking the
       launcher on the SDK.

       A DASH IS A REAL ANSWER HERE, not a failure. No push token until the
       browser has granted notification permission; no contact key while the
       visitor is anonymous. Both are ordinary states, so each says what it means
       rather than showing an empty box. */
    var REF_ROWS = [
        { key: 'deviceId',   copy: 'refDevice' },
        { key: 'sessionId',  copy: 'refSession' },
        { key: 'pushToken',  copy: 'refToken' },
        { key: 'contactKey', copy: 'refContact' },
        /* Last, and the one to reach for when a row cannot be found. No column
           identifies a demo, so filtering page_view_events on this is the only way
           back to its rows, and session_id on the row found is the only join to
           the other five tables. CLAUDE.md 1b. */
        { key: 'demoUrl',    copy: 'refPageUrl' },
        { key: 'accountId',  copy: 'refAccount' },
        { key: 'appGuid',    copy: 'refApp' }
    ];

    function renderReference() {
        var host = $('#ref-grid');
        if (!host || !window.DengageEvents || !window.DengageEvents.reference) return;

        function paint(values) {
            host.innerHTML = REF_ROWS.map(function (row) {
                var value = values[row.key];
                var missing = !value;
                var shown = missing ? window.Storefront.t('refNone') : String(value);
                return '<div class="ref-row' + (missing ? ' empty' : '') + '">' +
                    '<span class="ref-label">' + window.Storefront.t(row.copy) + '</span>' +
                    '<code class="ref-value"' + (missing ? '' : ' title="' + esc(String(value)) + '"') +
                        '>' + esc(shown) + '</code>' +
                    (missing ? '' :
                      '<button type="button" class="ref-copy" data-ref-copy="' + esc(String(value)) + '" ' +
                      'aria-label="' + esc(window.Storefront.t('refCopy')) + '">' +
                      window.Storefront.t('refCopy') + '</button>') +
                '</div>';
            }).join('');
        }

        paint({});
        window.DengageEvents.reference(paint);
    }

    function wireReference() {
        var host = $('#ref-grid');
        if (!host) return;
        host.addEventListener('click', function (event) {
            var button = event.target.closest
                ? event.target.closest('[data-ref-copy]') : null;
            if (!button) return;
            var value = button.getAttribute('data-ref-copy');
            if (!window.navigator || !window.navigator.clipboard) {
                log('This browser did not offer a clipboard. Select the value instead.');
                return;
            }
            window.navigator.clipboard.writeText(value).then(function () {
                var was = button.textContent;
                button.textContent = window.Storefront.t('refCopied');
                window.setTimeout(function () { button.textContent = was; }, 1200);
            }, function () {
                log('The browser refused the clipboard. Select the value instead.');
            });
        });
    }

    function wireReset() {
        var button = $('#reset-display');
        if (!button) return;
        var armed = null;

        button.addEventListener('click', function () {
            if (armed) {
                armed.forEach(function (pair) {
                    try { window[pair[0]].removeItem(pair[1]); } catch (err) { /* noop */ }
                });
                log('Cleared ' + armed.length + ' display state key(s)',
                    armed.map(function (p) { return p[0] + ': ' + p[1]; }));
                armed = null;
                button.textContent = window.Storefront.t('launcherReset');
                button.className = 'btn btn-quiet btn-block';
                return;
            }

            var found = [];
            [['localStorage', window.localStorage], ['sessionStorage', window.sessionStorage]]
                .forEach(function (pair) {
                    try {
                        for (var i = 0; i < pair[1].length; i++) {
                            var key = pair[1].key(i);
                            /* Only the SDK's own keys. This demo's cart and
                               wishlist are namespaced dps:<slug>: and are
                               deliberately not touched. */
                            if (/dengage|dn_|__dn|dnpush/i.test(key)) found.push([pair[0], key]);
                        }
                    } catch (err) { /* private mode */ }
                });

            if (!found.length) { log('Nothing to clear. No Dengage keys in storage.'); return; }

            armed = found;
            log('These ' + found.length + ' key(s) will be removed, and nothing else',
                found.map(function (p) { return p[0] + ': ' + p[1]; }));
            button.textContent = 'Confirm: remove ' + found.length + ' key(s)';
            button.className = 'btn btn-block';
        });
    }

    /* ------------------------------------------------------------------ */
    /* Video popup, played locally                                         */

    /* THE FILM IS SERVED FROM THIS REPOSITORY, at assets/video/, committed like
       every other demo asset. Non-negotiable 4: a demo never depends on a third
       party host at runtime, and that covers its own walkthrough film too.

       THE PATH IS RELATIVE, AND DERIVED, because the same tree is served under
       two prefixes. Locally the site is served from the repository root, so a
       demo page is /demos/<slug>/ and the template page is /template/. On
       GitHub Pages the whole tree sits under /demo-ai/ instead. An absolute
       path has to commit to one prefix and breaks on the other host; a
       relative one resolves against the page on both. A demo page is two
       levels below the root and the template page is one, which is the only
       difference this function has to know. */
    function videoBase() {
        return window.location.pathname.indexOf('/demos/') !== -1
            ? '../../assets/video/'
            : '../assets/video/';
    }

    /* Scoped under dps-video, the same namespace pattern the ?debug readout
       uses for dps-debug, so nothing here can collide with a storefront rule,
       a Dengage widget, or another module. Non-negotiable 6.

       The styles are injected from this file rather than added to style.css
       because the integrator syncs template JS into the demo folders: this
       file has to carry everything the overlay needs to render. Theme tokens
       only, no colour literals, so the frame takes each demo's brand exactly
       as every other surface does.

       The z-index sits just below the ?debug readout's, so the readout stays
       watchable while the film plays, and above everything else. */
    var VIDEO_CSS =
        '#dps-video{position:fixed;inset:0;z-index:2147482800;display:flex;' +
            'align-items:center;justify-content:center;padding:24px;' +
            'background:var(--scrim);}' +
        '#dps-video .dps-video-frame{width:min(860px,100%);display:flex;' +
            'flex-direction:column;background:var(--surface);color:var(--ink);' +
            'border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;}' +
        '#dps-video .dps-video-head{display:flex;align-items:center;' +
            'justify-content:space-between;gap:8px;padding:12px 16px;' +
            'border-bottom:1px solid var(--line);font-family:var(--display-font);}' +
        '#dps-video .dps-video-head strong{font-size:14px;}' +
        '#dps-video .dps-video-close{border:0;background:transparent;' +
            'color:var(--muted);font:inherit;font-size:20px;line-height:1;' +
            'cursor:pointer;padding:2px 8px;border-radius:6px;}' +
        '#dps-video .dps-video-close:hover,#dps-video .dps-video-close:focus{' +
            'color:var(--ink);background:var(--tint);}' +
        /* The letterbox behind the film is the ink token rather than a hard
           black, so a brand with warm dark tones stays coherent around it. */
        '#dps-video .dps-video-media{display:block;width:100%;' +
            'max-height:min(62vh,480px);background:var(--ink);}' +
        '#dps-video .dps-video-foot{display:flex;align-items:center;gap:12px;' +
            'padding:10px 16px;}' +
        '#dps-video .dps-video-sound{border:0;border-radius:var(--radius);' +
            'background:var(--primary);color:var(--on-primary);font:inherit;' +
            'font-size:13px;font-weight:600;padding:8px 16px;cursor:pointer;}' +
        '#dps-video .dps-video-note{font-size:12px;color:var(--muted);}';

    function ensureVideoStyles() {
        if (document.getElementById('dps-video-style')) return;
        var style = document.createElement('style');
        style.id = 'dps-video-style';
        style.textContent = VIDEO_CSS;
        document.head.appendChild(style);
    }

    /* Opens the overlay, built from nothing on every press. On close the whole
       node is REMOVED rather than hidden, so the card can be pressed all call
       long without stacking players: a hidden video element still holds its
       decoder and its playback position, and the second press would draw a new
       frame over a paused old one. Done item 5 is re-fired repeatedly without
       going dark, and removal is what makes that true here. */
    function openVideo(opener) {
        ensureVideoStyles();

        /* One at a time. A second press while the overlay is open starts the
           film over rather than layering a second frame. */
        var previous = document.getElementById('dps-video');
        if (previous && previous.__dpsClose) previous.__dpsClose();

        var base = videoBase();
        var root = document.createElement('div');
        root.id = 'dps-video';
        root.innerHTML =
            '<div class="dps-video-frame" role="dialog" aria-modal="true" ' +
                'aria-label="Demo video">' +
              '<div class="dps-video-head">' +
                '<strong>Dengage eComm demo</strong>' +
                '<button type="button" class="dps-video-close" aria-label="Close">' +
                    '&times;</button>' +
              '</div>' +
              /* Autoplay only works muted: every browser blocks audible
                 autoplay, and a film that silently refuses to start reads as a
                 broken demo. So it starts muted and the control below turns the
                 sound on, because a silent film with no way to hear it reads as
                 broken too. playsinline keeps a phone from pulling it into its
                 own full screen player mid screen share, and the native
                 controls stay on so a browser that blocks even muted autoplay
                 is one visible press from playing. */
              '<video class="dps-video-media" autoplay muted playsinline controls ' +
                'poster="' + base + 'dn-ecomm-demo.svg">' +
                '<source src="' + base + 'dn-ecomm-demo.webm" type="video/webm">' +
                '<source src="' + base + 'dn-ecomm-demo.mp4" type="video/mp4">' +
              '</video>' +
              '<div class="dps-video-foot">' +
                '<button type="button" class="dps-video-sound" aria-pressed="false">' +
                    'Sound on</button>' +
                '<span class="dps-video-note">Played from this demo\'s own files.</span>' +
              '</div>' +
            '</div>';

        var media = root.querySelector('.dps-video-media');
        var closeBtn = root.querySelector('.dps-video-close');
        var soundBtn = root.querySelector('.dps-video-sound');

        function close() {
            /* Pause before removal, so playback and audio stop with the node
               rather than lingering until the element is collected. */
            try { media.pause(); } catch (err) { /* already gone */ }
            document.removeEventListener('keydown', onKey, true);
            if (root.parentNode) root.parentNode.removeChild(root);
            /* Focus goes back where it came from, so a keyboard operator is
               not dropped at the top of the document. The card lives in the
               launcher modal, which hides with opacity rather than display,
               so it accepts focus while the modal is closed. */
            if (opener && opener.focus && document.body.contains(opener)) opener.focus();
        }
        root.__dpsClose = close;

        function onKey(event) {
            if (event.key === 'Escape') close();
        }

        /* The scrim closes and the frame does not: a click on the film or its
           controls must never dismiss the overlay mid sentence. */
        root.addEventListener('click', function (event) {
            if (event.target === root) close();
        });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);

        /* The label names what pressing does rather than the current state,
           the same way a play control says play while paused. aria-pressed
           carries the state for a screen reader. */
        soundBtn.addEventListener('click', function () {
            media.muted = !media.muted;
            soundBtn.textContent = media.muted ? 'Sound on' : 'Sound off';
            soundBtn.setAttribute('aria-pressed', media.muted ? 'false' : 'true');
        });

        document.body.appendChild(root);
        closeBtn.focus();

        /* The muted attribute is not always honoured on an element created
           after load, so the property is set as well and play() is called
           explicitly. A rejected play() means the browser blocked even muted
           autoplay; the native controls recover from that with one press, so
           the rejection is swallowed rather than reported as a failure. */
        media.muted = true;
        var started = media.play();
        if (started && started.catch) {
            started.catch(function () { /* the controls are the recovery */ });
        }
    }

    /* ------------------------------------------------------------------ */
    /* Event panel                                                         */

    function renderEventPanel() {
        var select = $('#event-select');
        if (!select) return;
        select.innerHTML = EVENTS.map(function (e) {
            return '<option value="' + e.id + '">' + e.label + '</option>';
        }).join('');
        describeEvent();
        select.addEventListener('change', describeEvent);
    }

    function describeEvent() {
        var select = $('#event-select');
        var note = $('#event-note');
        if (!select || !note) return;
        var chosen = EVENTS.filter(function (e) { return e.id === select.value; })[0];
        note.innerHTML = chosen
            ? 'Writes <code>' + chosen.table + '</code>.'
            : '';
    }

    /* Validation at the call site, against the same fixed list the dropdown was
       built from. Belt and braces on purpose: the dropdown is what a person
       sees, and this is what runs. Handoff 5.3 requires both halves. */
    function fire(eventId) {
        if (ALLOWED.indexOf(eventId) === -1) {
            log('Refused: ' + eventId + ' is not one of the storefront events', { allowed: ALLOWED });
            return false;
        }

        var product = window.Catalog.all()[0];
        var lines = window.Store.cart();
        var events = window.DengageEvents;
        var sent;

        switch (eventId) {
            case 'pageView':
                sent = events.pageview(document.body.getAttribute('data-page-type') || 'other');
                break;
            case 'ec:addToCart':
                sent = events.addToCart({ id: product.id, quantity: 1, price: product.price,
                                          discountedPrice: product.discountedPrice }, lines);
                break;
            case 'ec:removeFromCart':
                sent = events.removeFromCart({ id: product.id, quantity: 1, price: product.price,
                                               discountedPrice: product.discountedPrice }, lines);
                break;
            case 'ec:beginCheckout':
                sent = events.beginCheckout(lines);
                break;
            case 'ec:order':
                sent = events.order({
                    orderId: 'DPS-' + events.slug + '-panel-' + Date.now(),
                    itemCount: 1,
                    totalAmount: window.Catalog.effectivePrice(product),
                    paymentMethod: 'credit_card'
                }, lines.length ? lines : [{ id: product.id, quantity: 1, price: product.price }]);
                break;
            case 'ec:search':
                sent = events.search(product.category, window.Catalog.inCategory(product.category).length);
                break;
            case 'ec:addToWishlist':
                sent = events.addToWishlist({ id: product.id, price: product.price,
                                              discountedPrice: product.discountedPrice,
                                              stockCount: product.stockCount }, 'favorites');
                break;
            case 'ec:removeFromWishlist':
                sent = events.removeFromWishlist({ id: product.id }, 'favorites');
                break;
            default:
                return false;
        }

        log('Sent ' + eventId, sent);
        return true;
    }

    /* ------------------------------------------------------------------ */

    function init() {
        renderLauncher();
        renderEventPanel();
        renderRecommendations();
        wireReset();
        renderReference();
        wireReference();

        document.addEventListener('click', function (event) {
            /* Handled before the fire path, and deliberately never reaching
               DengageEvents: there is no data layer event that triggers these two,
               so pushing one would put a misleading line in the log and a request
               on the wire for a campaign that is not listening. */
            var hint = event.target.closest ? event.target.closest('[data-gesture]') : null;
            if (hint) {
                var slug = hint.getAttribute('data-gesture');
                var entry = SCENARIOS.filter(function (s) { return s.slug === slug; })[0];
                log(scenarioPrefix() + slug + ' is not fired from here. ' +
                    (entry ? text(entry.gesture) : ''));
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }

            var act = event.target.closest ? event.target.closest('[data-action]') : null;
            if (act && act.getAttribute('data-action') === 'inbox-open') {
                /* Closing the launcher first, then opening the drawer, because
                   both are overlays and closeOverlays would shut the drawer if it
                   ran second. The refresh is fired alongside rather than awaited:
                   the drawer should be on screen while the inbox is read, not
                   after, so an empty list is visibly replaced rather than
                   appearing out of nothing. */
                if (window.Storefront) {
                    window.Storefront.closeOverlays();
                    window.Storefront.openOverlay('#inbox');
                }
                if (window.Inbox) {
                    window.Inbox.refresh().then(function (status) {
                        if (status === 'ok') {
                            log('Inbox read. ' + window.Inbox.unreadCount() +
                                ' unread of the messages Dengage holds for this device.');
                        } else if (status === 'starting') {
                            log('The inbox needs a device id, which the application ' +
                                'creates a moment after it loads. Press Refresh in the drawer.');
                        } else {
                            log('Dengage could not return this inbox. The console has the reason.');
                        }
                    });
                }
                return;
            }
            if (act && act.getAttribute('data-action') === 'video-open') {
                /* Local playback rather than a campaign trigger: see the card's
                   note in SCENARIOS for why no data layer event goes out. The
                   launcher closes first so its scrim is not stacked with the
                   film's, and the card itself is handed over so focus can
                   return to it when the overlay closes. */
                if (window.Storefront) window.Storefront.closeOverlays();
                openVideo(act);
                log('Playing the demo film from this demo\'s own files. The panel\'s ' +
                    'native Video Popup template streams the same film when its ' +
                    'campaign fires; nothing was fired here, so the two never stack.');
                return;
            }
            if (act) {
                var events = window.DengageEvents;
                if (!events.pushSupported()) {
                    log('Web push is not available in this browser. It needs a secure ' +
                        'origin and a service worker, so it will not work from a file:// page.');
                    return;
                }
                log('Permission before asking: ' + (events.pushStatus() || 'unknown'));
                events.pushPrompt();
                /* The browser dialog is modal and the answer is asynchronous, so
                   report the outcome rather than guessing it. */
                setTimeout(function () {
                    log('Permission now: ' + (events.pushStatus() || 'unknown') +
                        '. Granted means the device is subscribed and a campaign or ' +
                        'journey in the panel can reach it.');
                }, 1500);
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }

            var el = event.target.closest ? event.target.closest('[data-scenario]') : null;
            if (el) {
                var fired = el.getAttribute('data-scenario');
                var spec = SCENARIOS.filter(function (s) { return s.slug === fired; })[0];

                /* Refuse rather than fire into a slot that is not in this
                   document. The campaign would answer correctly and nothing would
                   appear, which reads as the product failing. */
                if (spec && spec.target && !document.getElementById(spec.target)) {
                    log(scenarioPrefix() + fired + ' renders into #' + spec.target +
                        ', which is not on this page. ' + text('inlineElsewhere'));
                    if (window.Storefront) window.Storefront.closeOverlays();
                    return;
                }

                var name = window.DengageEvents.scenario(fired);
                /* Inline lands in the page, not over it, so say where to look.
                   Otherwise an inline campaign that worked perfectly reads as one
                   that did nothing: the operator is watching the middle of the
                   screen for an overlay that was never going to appear. */
                log('Fired ' + name + '. ' +
                    (fired.indexOf('inline-') === 0
                        ? 'Inline content renders into its slot in the page rather than over it.'
                        : 'If nothing appears, no campaign has that trigger name.'));
                /* Close this modal, or its scrim covers the widget that was just
                   fired. A widget that rendered underneath an overlay is
                   indistinguishable from one that never rendered, and the log
                   line above would be actively misleading. */
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }
            var reco = event.target.closest ? event.target.closest('[data-reco]') : null;
            if (reco) {
                var id = reco.getAttribute('data-reco');
                var result = window.Recommend.render(id, '#rec-rail', 6);
                var strategy = window.Recommend.get(id);
                log('Rendered ' + (strategy ? strategy.label : id) +
                    ': ' + (result ? result.count : 0) + ' item(s) from this demo\'s catalogue.',
                    strategy ? { strategy: id, how: strategy.explain } : null);
                /* Close the panel and put the rail on screen, or the operator is
                   looking at a log line describing something they cannot see. */
                if (window.Storefront) window.Storefront.closeOverlays();
                var section = document.getElementById('recommendations');
                if (section && section.scrollIntoView) {
                    setTimeout(function () {
                        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 220);
                }
                return;
            }
            if (event.target.id === 'event-send') {
                var select = $('#event-select');
                if (select) fire(select.value);
            }
        });
    }

    window.Panels = { init: init, SCENARIOS: SCENARIOS, GROUPS: GROUPS,
                      EVENTS: EVENTS, fire: fire };
})(window, document);
