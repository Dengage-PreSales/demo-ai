/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    var WAIT = 2600;
    var POLL = 150;

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
        '#%ID% .dps-standby-frame{width:min(900px,100%);max-height:calc(100vh - 48px);' +
            'display:flex;flex-direction:column;background:var(--surface);' +
            'border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden;' +
            'pointer-events:auto;}' +
        '#%ID%.dps-at-top .dps-standby-frame,#%ID%.dps-at-bottom .dps-standby-frame' +
            '{width:100%;max-width:none;border-radius:0;}' +
        '#%ID% .dps-standby-note{display:flex;align-items:center;gap:10px;' +
            'padding:9px 14px;border-bottom:1px solid var(--line);' +
            'background:var(--tint);color:var(--muted);font-size:12px;line-height:1.4;}' +
        '#%ID%.dps-at-bottom .dps-standby-note{order:2;border-bottom:0;' +
            'border-top:1px solid var(--line);}' +
        '#%ID% .dps-standby-note b{color:var(--ink);font-weight:600;}' +
        '#%ID% .dps-standby-close{margin-left:auto;border:0;background:transparent;' +
            'color:var(--muted);font:inherit;font-size:20px;line-height:1;' +
            'cursor:pointer;padding:0 4px;}' +

        '#%ID% iframe{border:0;width:100%;min-height:160px;display:block;' +
            'background:var(--surface);}' +
        '.dps-standby-inline-note{display:block;padding:6px 20px;font-size:11.5px;' +
            'color:var(--muted);background:var(--tint);' +
            'border-bottom:1px solid var(--line);}' +
        '.dps-standby-inline-note b{color:var(--ink);font-weight:600;}';

    function styleOnce(id, css) {
        if (document.getElementById(id)) return;
        var tag = document.createElement('style');
        tag.id = id;
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    function noteText(name) {
        var copy = window.Storefront && window.Storefront.t
            ? window.Storefront.t('standbyNote')
            : '';
        var line = copy && copy !== 'standbyNote'
            ? copy
            : 'Drawn by this demo, not by Dengage. The engine did not answer, ' +
              'so the storefront rendered its own committed copy of this creative.';
        return '<span><b>Standby copy</b> ' + line + '</span>';
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

    function close() {
        var host = document.getElementById(hostId());
        if (!host) return;
        var pinned = host.className.indexOf('dps-at-') !== -1;
        if (host.parentNode) host.parentNode.removeChild(host);
        if (pinned) reportBarHeight(null);
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
        close();
        var placement = BARS[name] || '';
        var host = document.createElement('div');
        host.id = hostId();

        host.className = 'dps-standby-host' +
            (placement ? ' dps-at-' + placement : '');
        host.innerHTML =
            '<div class="dps-standby-frame" role="dialog" aria-modal="true">' +
              '<div class="dps-standby-note">' + noteText(name) +
                '<button type="button" class="dps-standby-close" ' +
                  'aria-label="Close">&times;</button>' +
              '</div>' +
              '<iframe title="Standby creative"></iframe>' +
            '</div>';
        host.addEventListener('click', function (event) {
            if (event.target === host ||
                (event.target.className || '') === 'dps-standby-close') close();
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

        slot.innerHTML =
            '<span class="dps-standby-inline-note"><b>Standby copy</b> ' +
            'drawn by this demo, not by Dengage.</span>';
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

    function render(name, spec, done) {
        var file = CREATIVES[name];
        if (!file) { if (done) done(false, 'no committed creative stands in for this one'); return; }
        window.fetch(creativeBase() + file, { credentials: 'omit' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then(function (html) {
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
        var before = overlayCount();
        var target = spec && spec.target;
        var waited = 0;

        function look() {
            var answered = target ? slotFilled(target) : overlayCount() > before;
            if (answered) {
                announce(name, 'dengage', '');
                return;
            }
            waited += POLL;
            if (waited < WAIT) { window.setTimeout(look, POLL); return; }
            render(name, spec, function (drawn, why) {
                announce(name, drawn ? 'standby' : 'nothing', why);
                if (typeof report === 'function') report(drawn, why);
            });
        }
        window.setTimeout(look, POLL);
    }

    window.Standby = { arm: arm, render: render, close: close,
                       CREATIVES: CREATIVES, WAIT: WAIT };

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
