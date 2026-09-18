/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    var GRACE = 350;

    var YIELD_FOR = 8000;
    var POLL = 100;

    var CREATIVES = {
        'subscription-popup':        'subscription-popup.html',
        'survey':                    'survey.html',
        'nps-popup':                 'nps-popup.html',
        'image-popup':               'image-popup.html',
        'horizontal-popup':          'horizontal-popup.html',
        'cta-image-popup':           'cta-image-popup.html',
        'vertical-popup':            'vertical-popup.html',
        'sticky-bar':                'sticky-bar.html',
        'image-bar':                 'image-bar.html',
        'slide-in':                  'slide-in.html',
        'exit-intent':               'exit-intent.html',
        'scroll-depth':              'scroll-depth.html',
        'ab-test':                   'ab-testing/variant-a.html',
        'spin-to-win':               'gamification/spin-to-win.html',
        'scratch-card':              'gamification/scratch-card.html',
        'countdown-to-win':          'gamification/countdown-to-win.html',
        'inline-below-header':       'inline/below-header.html',
        'inline-below-hero':         'inline/below-hero.html',
        'inline-in-grid':            'inline/in-grid.html',
        'inline-pdp-below-price':    'inline/pdp-below-price.html',
        'inline-above-footer':       'inline/above-footer.html'
    };

    function slug() {
        return window.DEMO_SLUG || (window.DEMO_CONFIG && window.DEMO_CONFIG.slug) || 'demo';
    }

    function creativeBase() {
        return window.location.pathname.indexOf('/demos/') !== -1
            ? '../../factory/creatives/'
            : '../factory/creatives/';
    }

    function hostId() { return 'dps-standby-' + slug(); }
    function noteEvent() { return 'dps:' + slug() + ':standby'; }

    function overlayCount() {
        try { return document.querySelectorAll('iframe').length; }
        catch (err) { return 0; }
    }

    function slotFilled(target) {
        var el = target ? document.getElementById(target) : null;
        return !!el && el.innerHTML.length > 0;
    }

    var BARS = { 'sticky-bar': 'top', 'image-bar': 'bottom' };

    var LABEL_CSS =
        '#' + '%ID%' + '{position:fixed;inset:0;z-index:2147482700;display:flex;' +
            'align-items:center;justify-content:center;padding:24px;' +
            'background:var(--scrim);}' +

        '#%ID%.dps-at-top,#%ID%.dps-at-bottom{inset:auto;left:0;right:0;' +
            'background:transparent;padding:0;display:block;}' +
        '#%ID%.dps-at-top{top:0;}' +
        '#%ID%.dps-at-bottom{bottom:0;}' +

        '#%ID% .dps-standby-frame{width:100%;display:flex;flex-direction:column;' +
            'background:transparent;overflow:hidden;pointer-events:auto;}' +
        '#%ID%.dps-at-top .dps-standby-frame,#%ID%.dps-at-bottom .dps-standby-frame' +
            '{width:100%;max-width:none;border-radius:0;}' +

        '#%ID% .dps-standby-shut{position:absolute;top:-30px;right:0;border:0;' +
            'background:transparent;color:var(--surface);font:inherit;' +
            'font-size:22px;line-height:1;cursor:pointer;padding:2px 6px;' +
            'opacity:.85;pointer-events:auto;}' +
        '#%ID%.dps-at-top .dps-standby-shut,#%ID%.dps-at-bottom .dps-standby-shut' +
            '{display:none;}' +
        '#%ID% .dps-standby-wrap{position:relative;width:min(900px,100%);' +
            'max-height:calc(100vh - 48px);display:flex;}' +
        '#%ID%.dps-at-top .dps-standby-wrap,#%ID%.dps-at-bottom .dps-standby-wrap' +
            '{width:100%;max-width:none;}' +

        '#%ID% iframe{border:0;width:100%;min-height:160px;display:block;' +
            'background:transparent;}' +
        '';

    function styleOnce(id, css) {
        if (document.getElementById(id)) return;
        var tag = document.createElement('style');
        tag.id = id;
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    var SHIM =
        '<script>(function(){' +
        'function out(kind,detail){try{parent.postMessage(' +
            '{dpsStandby:1,kind:kind,detail:detail||null},"*");}catch(e){}}' +
        'window.Dn={' +
          'close:function(){out("close");},' +
          'sendClick:function(id){out("click",String(id||""));},' +
          'setTags:function(tags){out("tags",tags||null);},' +

          'getGameWinner:function(cb){if(typeof cb==="function"){cb(null);}' +
            'out("prize");}' +
        '};' +
        '})();<\/script>';

    function contentHeight(doc) {
        var tallest = 0;
        var kids = doc.body ? doc.body.children : null;
        for (var i = 0; kids && i < kids.length; i++) {
            var bottom = (kids[i].offsetTop || 0) + (kids[i].offsetHeight || 0);
            if (bottom > tallest) tallest = bottom;
        }

        if (!tallest && doc.body) tallest = doc.body.scrollHeight;
        return Math.ceil(tallest);
    }

    function fitFrame(frame, placement, after) {
        function fit() {
            var doc;
            try { doc = frame.contentDocument; } catch (err) { return; }
            if (!doc || !doc.documentElement) return;
            var wanted = contentHeight(doc);
            if (!wanted) return;
            var room = window.innerHeight - (placement ? 60 : 140);
            frame.style.minHeight = '0';
            frame.style.height = Math.max(48, Math.min(wanted, room)) + 'px';
            frame.style.overflow = wanted > room ? 'auto' : 'hidden';
            if (typeof after === 'function') after();
        }
        frame.addEventListener('load', function () {
            fit();

            window.setTimeout(fit, 400);
            window.setTimeout(fit, 1200);
        });
        window.addEventListener('resize', fit);
    }

    function reportBarHeight(host) {
        var px = 0;
        if (host && document.body.contains(host)) {
            px = Math.round(host.getBoundingClientRect().height);
        }
        try { window.postMessage({ dnBanner: 'height', px: px }, '*'); }
        catch (err) {  }
    }

    var watching = null;

    function stopWatching() {
        if (!watching) return;
        if (watching.timer) window.clearTimeout(watching.timer);
        if (watching.observer) watching.observer.disconnect();
        watching = null;
    }

    function removeHost() {
        var host = document.getElementById(hostId());
        if (!host) return;
        var pinned = host.className.indexOf('dps-at-') !== -1;
        if (host.parentNode) host.parentNode.removeChild(host);
        if (pinned) reportBarHeight(null);
    }

    function close() {
        stopWatching();
        removeHost();
    }

    function announce(name, how, detail) {
        try {
            window.dispatchEvent(new window.CustomEvent(noteEvent(), {
                detail: { scenario: name, how: how, note: detail || '', at: Date.now() }
            }));
        } catch (err) {  }
    }

    function renderOverlay(name, html) {
        styleOnce('dps-standby-css', LABEL_CSS.split('%ID%').join(hostId()));
        removeHost();
        var placement = BARS[name] || '';
        var host = document.createElement('div');
        host.id = hostId();

        host.className = 'dps-standby-host' +
            (placement ? ' dps-at-' + placement : '');
        host.innerHTML =
            '<div class="dps-standby-wrap">' +
              '<button type="button" class="dps-standby-shut" ' +
                'aria-label="Close">&times;</button>' +
              '<div class="dps-standby-frame" role="dialog" aria-modal="true">' +
                '<iframe title=""></iframe>' +
              '</div>' +
            '</div>';
        host.addEventListener('click', function (event) {
            if (event.target === host ||
                (event.target.className || '') === 'dps-standby-shut') close();
        });
        document.body.appendChild(host);
        var frame = host.querySelector('iframe');
        fitFrame(frame, placement, placement
            ? function () { reportBarHeight(host); }
            : null);

        frame.setAttribute('srcdoc', SHIM + html);
        return true;
    }

    function renderInline(name, target, html) {
        var slot = document.getElementById(target);
        if (!slot) return false;
        styleOnce('dps-standby-css', LABEL_CSS.split('%ID%').join(hostId()));

        var parsed = document.createElement('div');
        parsed.innerHTML = html;

        var style = parsed.querySelector('.dn-inline-style');
        var body = parsed.querySelector('.dn-inline-html');
        var script = parsed.querySelector('.dn-inline-script');
        if (!body || !body.innerHTML) return false;

        if (style) {
            var tag = document.createElement('style');
            tag.setAttribute('data-dps-standby', name);
            tag.textContent = style.textContent;
            document.head.appendChild(tag);
        }

        slot.innerHTML = '';
        slot.appendChild(body);

        if (script && script.textContent) {

            try { new window.Function(script.textContent)(); }
            catch (err) {
                if (window.console) console.error('[standby] ' + name + ' script failed', err);
            }
        }
        if (window.Slots && window.Slots.rescan) window.Slots.rescan();
        return true;
    }

    var warmed = {};

    function fetchCreative(name) {
        var file = CREATIVES[name];
        if (!file) return null;
        if (!warmed[name]) {
            warmed[name] = window.fetch(creativeBase() + file, { credentials: 'omit' })
                .then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.text();
                })
                .catch(function (err) {
                    delete warmed[name];
                    throw err;
                });
        }
        return warmed[name];
    }

    function warm(names) {
        var list = names && names.length ? names : Object.keys(CREATIVES);
        for (var i = 0; i < list.length; i++) fetchCreative(list[i]);
    }

    function render(name, spec, done, guard) {
        var pending = fetchCreative(name);
        if (!pending) {
            if (done) done(false, 'no committed creative stands in for this one');
            return;
        }
        pending
            .then(function (html) {
                if (typeof guard === 'function' && !guard()) {
                    if (done) done(false, 'it was dismissed before it could be drawn');
                    return;
                }
                var drawn = spec && spec.target
                    ? renderInline(name, spec.target, html)
                    : renderOverlay(name, html);
                if (done) done(drawn, drawn ? '' : 'the creative could not be drawn here');
            })
            .catch(function (err) {
                if (done) done(false, 'the committed creative could not be read: ' + err.message);
            });
    }

    function arm(name, spec, report) {
        if (!CREATIVES[name]) return;
        warm([name]);
        stopWatching();

        var target = spec && spec.target;
        var before = overlayCount();
        var drewOurs = false;
        var started = Date.now();
        var mine = { timer: null, observer: null };
        watching = mine;

        function engineAnswered() {
            if (target) {

                if (!drewOurs) return slotFilled(target);
                var slot = document.getElementById(target);
                return !!slot && !!slot.querySelector(':scope > :not(.dn-inline-html)');
            }

            return overlayCount() > before + (drewOurs ? 1 : 0);
        }

        function tick() {
            if (watching !== mine) return;

            if (engineAnswered()) {
                if (drewOurs) {

                    removeHost();
                    announce(name, 'dengage', 'the engine answered after the ' +
                        'standby copy was drawn, so the standby copy was removed');
                } else {
                    announce(name, 'dengage', '');
                }
                stopWatching();
                return;
            }

            var age = Date.now() - started;
            if (!drewOurs && age >= GRACE) {
                drewOurs = true;
                render(name, spec, function (drawn, why) {
                    if (!drawn) drewOurs = false;
                    announce(name, drawn ? 'standby' : 'nothing', why);
                    if (typeof report === 'function') report(drawn, why);
                }, function () { return watching === mine; });
            }
            if (age >= YIELD_FOR) { stopWatching(); return; }
            mine.timer = window.setTimeout(tick, POLL);
        }

        if (window.MutationObserver) {
            mine.observer = new window.MutationObserver(function () { tick(); });
            mine.observer.observe(document.body, { childList: true, subtree: true });
        }
        mine.timer = window.setTimeout(tick, POLL);
    }

    var EXIT_ABOVE = -20;
    var SCROLL_AT = 0.7;

    function busy() {
        try {
            if (document.querySelector('.dps-standby-host')) return true;
            return !!document.querySelector(
                '#dengage-panel.open, .drawer.open, .modal.open');
        } catch (err) { return false; }
    }

    function armGesture(name) {
        if (!CREATIVES[name] || busy()) return;
        arm(name, null);
    }

    var lastRealScroll = 0;
    function noteRealScroll() { lastRealScroll = Date.now(); }
    var SCROLL_IS_RECENT = 2000;

    function watchGestures() {
        window.addEventListener('wheel', noteRealScroll, { passive: true });
        window.addEventListener('touchmove', noteRealScroll, { passive: true });

        var firedExit = false;
        document.documentElement.addEventListener('mouseleave', function (event) {
            if (firedExit || event.clientY >= EXIT_ABOVE || busy()) return;
            firedExit = true;
            armGesture('exit-intent');
        });

        var firedScroll = false;
        window.addEventListener('scroll', function () {
            if (firedScroll) return;
            var doc = document.documentElement;
            var room = doc.scrollHeight - window.innerHeight;
            if (room <= 0) return;
            if ((window.pageYOffset || doc.scrollTop) / room < SCROLL_AT) return;
            if (Date.now() - lastRealScroll > SCROLL_IS_RECENT) return;

            if (busy()) return;
            firedScroll = true;
            armGesture('scroll-depth');
        }, { passive: true });
    }

    if (document.body) watchGestures();
    else document.addEventListener('DOMContentLoaded', watchGestures);

    window.Standby = { arm: arm, render: render, close: close, warm: warm,
                       CREATIVES: CREATIVES, GRACE: GRACE, YIELD_FOR: YIELD_FOR };

    window.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || data.dpsStandby !== 1) return;
        if (data.kind === 'close') { close(); return; }
        if (data.kind === 'click') {
            announce(data.detail || 'creative', 'click',
                'a standby creative\'s click is not counted by Dengage, because ' +
                'the engine that would count it is the thing that did not answer');
            close();
            return;
        }
        if (data.kind === 'tags') {
            announce('tags', 'click',
                'an answer captured by a standby creative is not written to the ' +
                'contact, for the same reason');
        }
    });
})(window, document);
