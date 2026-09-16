/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    var $ = function (sel) { return document.querySelector(sel); };

    var SCENARIOS = [

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

        { slug: 'ab-test',            name: 'A/B test',         group: 'abtest' },

        { slug: 'spin-to-win',        name: 'Spin to win',      group: 'game' },
        { slug: 'scratch-card',       name: 'Scratch card',     group: 'game' },
        { slug: 'countdown-to-win',   name: 'Countdown to win',  group: 'game' },

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

        { slug: 'story',          name: 'Story',          group: 'onsite', panel: true },

        { slug: 'video-popup',    name: 'Video popup',    group: 'onsite', panel: true,
          action: 'video-open', actionCopy: 'Plays the demo film here' },
        { slug: 'vertical-popup', name: 'Vertical popup', group: 'onsite' },

        { slug: 'web-push',       name: 'Web push',       group: 'push',
          action: 'push-prompt', actionCopy: 'actionPushPrompt' },

        { slug: 'inbox',          name: 'App inbox',      group: 'inbox',
          action: 'inbox-open', actionCopy: 'actionInboxOpen', target: 'inbox-body' }
    ];

    var GROUPS = [
        { id: 'onsite', copy: 'groupOnsite' },
        { id: 'abtest', copy: 'groupAbTest' },
        { id: 'game',   copy: 'groupGame' },
        { id: 'inline', copy: 'groupInline' },

        { id: 'push',   copy: 'groupPush' },
        { id: 'inbox',  copy: 'groupInbox' }
    ];

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

            return '<h3 class="launcher-group">' + text(g.copy) +
                   ' <span>' + members.length + '</span></h3>' +
                members.map(function (s) {

                    if (s.gesture) {
                        return '<button type="button" class="scenario gesture" ' +
                                'data-gesture="' + s.slug + '">' +
                            '<span class="name">' + s.name + '</span>' +
                            '<span class="slug">' + text(s.gesture) + '</span>' +
                        '</button>';
                    }

                    if (s.action) {
                        return '<button type="button" class="scenario action" ' +
                                'data-action="' + s.action + '">' +
                            '<span class="name">' + s.name + '</span>' +
                            '<span class="slug">' + text(s.actionCopy) + '</span>' +
                        '</button>';
                    }

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

    function esc(text) {
        return String(text === null || text === undefined ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var REF_ROWS = [
        { key: 'deviceId',   copy: 'refDevice' },
        { key: 'sessionId',  copy: 'refSession' },
        { key: 'pushToken',  copy: 'refToken' },
        { key: 'contactKey', copy: 'refContact' },

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
                    try { window[pair[0]].removeItem(pair[1]); } catch (err) {  }
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

                            if (/dengage|dn_|__dn|dnpush/i.test(key)) found.push([pair[0], key]);
                        }
                    } catch (err) {  }
                });

            if (!found.length) { log('Nothing to clear. No Dengage keys in storage.'); return; }

            armed = found;
            log('These ' + found.length + ' key(s) will be removed, and nothing else',
                found.map(function (p) { return p[0] + ': ' + p[1]; }));
            button.textContent = 'Confirm: remove ' + found.length + ' key(s)';
            button.className = 'btn btn-block';
        });
    }

    function videoBase() {
        return window.location.pathname.indexOf('/demos/') !== -1
            ? '../../assets/video/'
            : '../assets/video/';
    }

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

    function openVideo(opener) {
        ensureVideoStyles();

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

            try { media.pause(); } catch (err) {  }
            document.removeEventListener('keydown', onKey, true);
            if (root.parentNode) root.parentNode.removeChild(root);

            if (opener && opener.focus && document.body.contains(opener)) opener.focus();
        }
        root.__dpsClose = close;

        function onKey(event) {
            if (event.key === 'Escape') close();
        }

        root.addEventListener('click', function (event) {
            if (event.target === root) close();
        });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);

        soundBtn.addEventListener('click', function () {
            media.muted = !media.muted;
            soundBtn.textContent = media.muted ? 'Sound on' : 'Sound off';
            soundBtn.setAttribute('aria-pressed', media.muted ? 'false' : 'true');
        });

        document.body.appendChild(root);
        closeBtn.focus();

        media.muted = true;
        var started = media.play();
        if (started && started.catch) {
            started.catch(function () {  });
        }
    }

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

    function init() {
        renderLauncher();
        renderEventPanel();
        renderRecommendations();
        wireReset();
        renderReference();
        wireReference();

        document.addEventListener('click', function (event) {

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

                if (spec && spec.target && !document.getElementById(spec.target)) {
                    log(scenarioPrefix() + fired + ' renders into #' + spec.target +
                        ', which is not on this page. ' + text('inlineElsewhere'));
                    if (window.Storefront) window.Storefront.closeOverlays();
                    return;
                }

                var name = window.DengageEvents.scenario(fired);

                log('Fired ' + name + '. ' +
                    (fired.indexOf('inline-') === 0
                        ? 'Inline content renders into its slot in the page rather than over it.'
                        : 'If nothing appears, no campaign has that trigger name.'));

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
