/* ============================================================================
   STANDBY: THE DEMO DRAWS THE CREATIVE ITSELF WHEN DENGAGE DOES NOT ANSWER.

   Dengage renders every on-site widget in this storefront, and that is the
   demonstration. Nothing here changes that. This module does nothing at all
   while the engine is answering, which on a normal call is every time.

   WHAT IT IS FOR. A widget that does not appear looks the same to a prospect
   whatever the reason, and the reasons are not all ours:

     a campaign is deactivated, deleted or renamed in the panel
     its frequency cap is reached, and the panel's caps are per minute
     the prospect's network or their own device blocks pcdn.dengage.com
     the manifest a browser cached is older than the campaign

   In each of those the call goes dark at the worst possible moment, on screen,
   in front of the person being sold to. So after firing the trigger this waits,
   and only if nothing has appeared does it draw the same committed creative
   itself, labelled as the demo's own copy.

   THREE RULES IT DOES NOT BEND.

   1. DENGAGE FIRST, AND DENGAGE WINS EVEN AFTER THE FACT. The trigger is pushed
      exactly as before. The engine gets GRACE milliseconds, which is short enough
      that nobody sees a pause, because its decision is local: the manifest and
      the message list are already in the browser from page load, so a campaign
      that exists renders in tens of milliseconds rather than after a round trip.

      GRACE ALONE WOULD NOT BE ENOUGH, so it is not the whole rule. A slow frame,
      a busy page or a campaign with its own delay can arrive after the standby
      copy is already up, and two widgets on screen at once is worse than either
      failure this module exists for. So the page keeps watching for YIELD_FOR
      milliseconds afterwards, and the moment anything the engine drew appears,
      the standby copy is taken off the screen. The engine is always the one left
      standing.

   2. NOTHING ON SCREEN SAYS IT IS A STANDBY COPY, and the record lives in the
      readout instead. This carried a visible grey strip reading "Standby copy"
      until 18 September 2026, on the reasoning that a demo must never let a call
      claim Dengage rendered something it did not. Salil's direction, and it is
      the better answer: a prospect is watching a storefront, and a strip of
      internal plumbing across the top of a creative is the one thing that makes
      the demonstration feel like a rehearsal. The honesty requirement is real and
      it is met where it belongs, at ?debug=1 and in the launcher's own log, which
      are the two places anyone asking "did Dengage draw that" would look. Both
      still name every standby render, and factory/checks/standby.js asserts both
      halves: nothing on screen, everything in the readout.

   3. IT CLAIMS NO EVENT IT CANNOT SEND. Nothing here emits anything, so the
      guard's event-single-source rule is untouched and js/dengageEvents.js is
      still the only module that reaches the SDK. A click inside a standby
      creative is listed in ?debug=1 and nowhere else, because Dn.sendClick is
      the ENGINE reporting engagement on its own creative and there is no engine
      to report it. Counting it locally would put a number in front of a
      prospect that Dengage never recorded, which is the overstatement the
      readout's own note in js/debug.js exists to refuse. The storefront's own
      events, the views and carts and orders, are unaffected and keep flowing
      whenever the SDK is present at all.

   WHY AN IFRAME FOR THE OVERLAYS AND NOT FOR THE INLINE SLOTS. Because that is
   what the engine does, and handoff 12.3 is the reason it matters: the engine
   sandboxes popups and banners in an iframe, and does NOT sandbox inline
   creatives, whose <style> it lifts into document.head. The overlay creatives are
   whole HTML documents written for that sandbox, so their CSS would leak
   page-wide if it were inlined, and the storefront would visibly break. They go
   in an iframe of our own with srcdoc. The inline creatives are already authored
   to the engine's documented three-wrapper contract, every selector namespaced
   under their own root id, so they are rendered exactly the way the engine
   renders them and nothing has to be reinterpreted.

   WHAT THE Dn SHIM DELIBERATELY DOES NOT PROVIDE. The engine injects a Dn object
   into its frames. Inside a standby frame this file provides close, sendClick,
   setTags and getGameWinner, and deliberately omits postQuestion and
   postSubscription: every creative that uses those already carries a documented
   path for the engine not having injected them, and that path is better tested
   than anything invented here would be. See the notes in
   factory/creatives/survey.html and subscription-popup.html.

   WHY IT CANNOT SIMPLY ASK WHETHER A CAMPAIGN EXISTS, which would be the
   obvious design and was tried first. The SDK loads a campaign manifest whose
   filename is published on window.dn_onsite_filename, and it does list every
   live trigger name, so reading it would let this module know in advance and
   never draw at all when a campaign is live. It cannot be read: the CDN serves
   it without an Access-Control-Allow-Origin header, so a fetch from the page is
   blocked by the browser, measured on 18 September 2026. Loading it as a script
   would work and is refused, because the file calls the SDK's own callback and
   running it a second time is not this module's business. Watching what actually
   appears needs no permission from anybody and cannot go stale.

   COVERAGE IS DERIVED, NOT COUNTED. CREATIVES below maps a launcher slug to the
   committed file that stands in for it, and a slug with no entry gets no standby
   copy rather than a guess. factory/checks/standby.js holds the map against the
   files on disk in both directions, so a creative added or renamed fails a check
   instead of silently losing its fallback.
   ========================================================================== */
(function (window, document) {
    'use strict';

    /* HOW LONG THE ENGINE GETS BEFORE ANYTHING IS DRAWN. This was 2600ms, on a
       guess that the engine needed time for a manifest fetch and a getMessages
       round trip. It does not: both happen at PAGE LOAD, and the decision when a
       trigger fires is local. 2600ms was therefore a dead pause on every single
       fire, felt on a call as the demo hesitating.

       350ms is under the threshold where a person reads a pause as a delay
       rather than as the widget simply appearing, and it is many times longer
       than a local match needs. It is not load bearing either way, because
       anything the engine draws later still displaces the standby copy. */
    var GRACE = 350;

    /* And how long it keeps watching afterwards. Long enough to cover a campaign
       that carries its own delay setting, short enough that a widget the visitor
       dismissed minutes ago cannot be replaced under them. */
    var YIELD_FOR = 8000;
    var POLL = 100;

    /* Slug to committed creative, relative to factory/creatives/. Everything
       here is shared across every demo, exactly as the campaigns are, so a
       correction to a creative reaches every live demo's standby copy at once. */
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

    /* The same two depths js/panels.js resolves the demo film at, and for the
       same reason: a demo sits one directory deeper than the template does, and
       the shared assets are above both. */
    function creativeBase() {
        return window.location.pathname.indexOf('/demos/') !== -1
            ? '../../factory/creatives/'
            : '../factory/creatives/';
    }

    /* Namespaced by slug, non-negotiable 6: all demos share one origin and two
       open in one browser must not collide. */
    function hostId() { return 'dps-standby-' + slug(); }
    function noteEvent() { return 'dps:' + slug() + ':standby'; }

    /* ------------------------------------------------------------------ */
    /* Did the engine answer                                               */

    /* MEASURED BY SHAPE, NOT BY SELECTOR, the same decision js/slots.js made and
       for the same reason: the engine's class names are its own to change and
       this file cannot see them. What it can see is that something arrived.
       Popups and banners arrive as an iframe, which nothing else on these pages
       adds, and an inline creative arrives as content inside its slot, which is
       empty until it does. */
    function overlayCount() {
        try { return document.querySelectorAll('iframe').length; }
        catch (err) { return 0; }
    }

    function slotFilled(target) {
        var el = target ? document.getElementById(target) : null;
        return !!el && el.innerHTML.length > 0;
    }

    /* ------------------------------------------------------------------ */
    /* The frame, which looks like the engine's own and says nothing        */

    /* PLACEMENT, BECAUSE A BAR IS NOT A POPUP. The engine pins a top or bottom
       bar to the edge of the viewport and centres a popup, so a standby copy that
       centred everything would show a sticky bar as a floating card. That is not
       a fidelity nicety: it is the difference between a widget a prospect
       recognises and one they ask about. Two placements cover every creative the
       map names, and anything unlisted centres. */
    var BARS = { 'sticky-bar': 'top', 'image-bar': 'bottom' };

    var LABEL_CSS =
        '#' + '%ID%' + '{position:fixed;inset:0;z-index:2147482700;display:flex;' +
            'align-items:center;justify-content:center;padding:24px;' +
            'background:var(--scrim);}' +
        /* A BAR IS PINNED AND SHORT, NOT A FULL VIEWPORT OVERLAY, and that is what
           makes js/slots.js push the storefront header down for it. That module
           finds a pinned banner BY SHAPE rather than by selector: fixed,
           touching the top edge, essentially full width, and under 200px tall.
           A host at inset:0 fails the height test, so the first version of this
           rendered a standby bar straight over the header, logo and navigation,
           which is exactly the failure slots.js was written to fix for the
           engine's own banners. Given the same shape, it fixes this one too and
           needs no special case for it. */
        '#%ID%.dps-at-top,#%ID%.dps-at-bottom{inset:auto;left:0;right:0;' +
            'background:transparent;padding:0;display:block;}' +
        '#%ID%.dps-at-top{top:0;}' +
        '#%ID%.dps-at-bottom{bottom:0;}' +
        '#%ID% .dps-standby-frame{width:100%;display:flex;flex-direction:column;' +
            'background:var(--surface);border-radius:var(--radius);' +
            'box-shadow:var(--shadow-lg);overflow:hidden;pointer-events:auto;}' +
        '#%ID%.dps-at-top .dps-standby-frame,#%ID%.dps-at-bottom .dps-standby-frame' +
            '{width:100%;max-width:none;border-radius:0;}' +
        /* THE CLOSE CONTROL SITS OUTSIDE THE CREATIVE, where the engine puts its
           own: several creatives have no dismiss of their own and relied on the
           label strip's button, so removing the strip without this would have
           left a popup a prospect could not shut. Deliberately plain, because
           anything else on this frame is a thing to notice. */
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
        /* Height is MEASURED, not guessed: see fitFrame. The value here is only
           what is shown for the moment before the frame has loaded, and a
           min-height rather than a height so a creative is never clipped if the
           measurement cannot be taken at all. */
        '#%ID% iframe{border:0;width:100%;min-height:160px;display:block;' +
            'background:var(--surface);}' +
        '';

    function styleOnce(id, css) {
        if (document.getElementById(id)) return;
        var tag = document.createElement('style');
        tag.id = id;
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ------------------------------------------------------------------ */
    /* The shim the creatives expect inside an engine frame                */

    /* Injected into the standby frame as source text rather than passed across,
       because a srcdoc frame is a separate realm and there is nothing to pass.
       reportClick posts out to this page, which is the only place allowed to
       reach js/dengageEvents.js. Rule 3. */
    var SHIM =
        '<script>(function(){' +
        'function out(kind,detail){try{parent.postMessage(' +
            '{dpsStandby:1,kind:kind,detail:detail||null},"*");}catch(e){}}' +
        'window.Dn={' +
          'close:function(){out("close");},' +
          'sendClick:function(id){out("click",String(id||""));},' +
          'setTags:function(tags){out("tags",tags||null);},' +
          /* The engine draws a prize from its own coupon endpoint. With no
             engine there is no coupon to draw, so this answers with the frame's
             own first prize and says so rather than inventing a code that no
             campaign would honour. Non-negotiable 5: nothing numeric here is
             fabricated, because nothing numeric is claimed. */
          'getGameWinner:function(cb){if(typeof cb==="function"){cb(null);}' +
            'out("prize");}' +
        '};' +
        '})();<\/script>';

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */

    /* AN IFRAME HAS NO INTRINSIC CONTENT HEIGHT, which is the whole reason this
       exists. The first version let flex size the frame, and since flex-basis
       auto on an iframe resolves to nothing the frame collapsed to its
       min-height and every popup taller than that was cut off mid sentence. A
       srcdoc frame inherits this page's origin, so its document is readable and
       its own height can simply be asked for.

       Bounded by the viewport, because a long creative must scroll inside the
       frame rather than run off the screen, and re-measured on resize since a
       phone rotating changes both numbers. */
    /* MEASURED FROM THE CREATIVE'S OWN ELEMENTS, NOT FROM THE DOCUMENT, and that
       distinction is the difference between this working and not. documentElement
       inside an iframe stretches to fill the frame, so its scrollHeight can never
       be smaller than the height the frame already has: the first version
       measured it, the frame never shrank below its own starting height, and a
       sticky bar sixty pixels tall rendered as a bar with a white slab under it
       covering the storefront header. Every creative here is content sized, its
       root is the one element in body, so its own box is the answer. */
    function contentHeight(doc) {
        var tallest = 0;
        var kids = doc.body ? doc.body.children : null;
        for (var i = 0; kids && i < kids.length; i++) {
            var bottom = (kids[i].offsetTop || 0) + (kids[i].offsetHeight || 0);
            if (bottom > tallest) tallest = bottom;
        }
        /* A creative that puts everything in text nodes, or has not painted yet,
           still gets a usable number rather than zero. */
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
            /* Again after a beat: a creative that draws itself from script, and
               the games all do, is taller once it has run than at load. */
            window.setTimeout(fit, 400);
            window.setTimeout(fit, 1200);
        });
        window.addEventListener('resize', fit);
    }

    /* THE HEADER HAS TO CLEAR THE WHOLE THING, LABEL INCLUDED, and this is the
       documented way to tell it. js/slots.js accepts a height a pinned bar reports
       about itself, on a postMessage, and prefers it over anything it can measure
       from outside, for the reasons written above its readBannerReport.

       The creative inside the standby frame sends that report itself, because it is
       the same file a live campaign pastes. It reports its own height and knows
       nothing about the label strip above it, so the header cleared the bar and
       stayed behind the label: the logo and navigation were half covered. So this
       reports the host's real height afterwards and the last word wins.

       Sent on every fit, because both messages are asynchronous and the creative's
       may arrive second on a slow frame. Zero on close, which is the same signal a
       dismissed bar sends, so the header comes back rather than staying pushed. */
    function reportBarHeight(host) {
        var px = 0;
        if (host && document.body.contains(host)) {
            px = Math.round(host.getBoundingClientRect().height);
        }
        try { window.postMessage({ dnBanner: 'height', px: px }, '*'); }
        catch (err) { /* a fallback is never allowed to break a demo */ }
    }

    /* The watch a press set up, so a later press or an explicit close can end it.
       Declared here rather than beside arm() because close() is above and calls
       it: a function declaration hoists, a var assignment does not. */
    var watching = null;

    function stopWatching() {
        if (!watching) return;
        if (watching.timer) window.clearTimeout(watching.timer);
        if (watching.observer) watching.observer.disconnect();
        watching = null;
    }

    /* REMOVING THE ELEMENT AND ENDING THE WATCH ARE TWO DIFFERENT THINGS, and
       conflating them cost a round. Drawing replaces any copy already on screen,
       so it removes the element, and for a moment close() did both: the module
       cancelled its own watch the instant it drew, and could then never notice
       the engine arriving late. Dismissing is the opposite case and must end the
       watch, or a render already in flight lands afterwards and the widget the
       visitor just shut comes back by itself. */
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
        } catch (err) { /* a readout is never allowed to break a demo */ }
    }

    /* AN OVERLAY, IN AN IFRAME OF OUR OWN. srcdoc rather than a src, so no
       second request is made and the creative is exactly the file that was
       fetched, and sandboxed the way the engine sandboxes it. */
    function renderOverlay(name, html) {
        styleOnce('dps-standby-css', LABEL_CSS.split('%ID%').join(hostId()));
        removeHost();
        var placement = BARS[name] || '';
        var host = document.createElement('div');
        host.id = hostId();
        /* A CLASS AS WELL AS THE ID, because the id is namespaced by slug and
           the injected <style> shares its prefix, so an id-prefix selector finds
           the stylesheet first. Anything looking for the standby overlay looks
           for this class. */
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
        /* The shim goes in before the creative's own markup so Dn exists by the
           time an inline onclick attribute is parsed. */
        frame.setAttribute('srcdoc', SHIM + html);
        return true;
    }

    /* AN INLINE CREATIVE, THE WAY THE ENGINE DOES IT. The three wrapper classes
       are the engine's documented contract, read from the SDK rather than
       guessed, and factory/creatives/inline/README.md is where they are written
       down: .dn-inline-style is appended to document.head, .dn-inline-html is
       inserted into the target, and .dn-inline-script is run in page scope. */
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
            /* new Function rather than eval, which is what the engine uses, so
               the creative's script runs in page scope exactly as it would
               under a live campaign. A creative that throws must not take the
               storefront with it. */
            try { new window.Function(script.textContent)(); }
            catch (err) {
                if (window.console) console.error('[standby] ' + name + ' script failed', err);
            }
        }
        if (window.Slots && window.Slots.rescan) window.Slots.rescan();
        return true;
    }

    /* ------------------------------------------------------------------ */

    /* FETCHED BEFORE IT IS NEEDED, because a network round trip at the moment of
       drawing is a pause the visitor sees, and it is the one part of the delay
       that no grace period can hide. js/panels.js calls warm() when the launcher
       opens, which is several seconds before any card is pressed, and again on
       the press itself for anything that missed it.

       A promise per creative rather than the text, so two calls in flight never
       become two requests, and a failed one is dropped rather than cached so the
       next attempt can retry. */
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

    /* THE GUARD IS CHECKED IMMEDIATELY BEFORE DRAWING, not before fetching, and
       that is the whole point of it. Deciding to draw and actually drawing are
       separated by a promise, and in that gap the visitor can dismiss the widget
       or the operator can reopen the launcher. Closing used to leave the pending
       render untouched, so a standby copy that had been shut reappeared a
       fraction of a second later, over whatever had been opened in its place.
       Found on 18 September 2026 by the launcher check, which closes and reopens
       faster than any person would and is therefore the only thing that was ever
       going to see it. */
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

    /* ARMED AFTER THE TRIGGER, NEVER INSTEAD OF IT. js/panels.js pushes the data
       layer event first and calls this straight afterwards.

       Three phases, and the third is what makes the first two safe:

         watch     GRACE milliseconds. If the engine renders, stand down and draw
                   nothing at all, which is the normal case on a healthy account
         draw      the committed creative, from the copy warm() already fetched,
                   so there is no request between deciding and appearing
         yield     keep watching for YIELD_FOR. Anything the engine draws after
                   the fact takes the screen and the standby copy is removed

       Re-armable. Pressing the same card twice cancels the first watch rather
       than running two, which otherwise raced each other to draw. */
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
                /* Our own render fills the same slot, so once we have drawn, the
                   question becomes whether anything ELSE was added to it. */
                if (!drewOurs) return slotFilled(target);
                var slot = document.getElementById(target);
                return !!slot && !!slot.querySelector(':scope > :not(.dn-inline-html)');
            }
            /* Our overlay contains exactly one iframe of its own, so it is
               counted out rather than mistaken for the engine answering. */
            return overlayCount() > before + (drewOurs ? 1 : 0);
        }

        function tick() {
            if (watching !== mine) return;

            if (engineAnswered()) {
                if (drewOurs) {
                    /* DENGAGE WINS, EVEN LATE. Taking ours off the screen the
                       moment the engine draws is the whole reason the grace
                       period is allowed to be short. */
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

        /* An observer as well as the poll, so a render between two ticks is seen
           at once rather than up to POLL later. The poll stays because an inline
           slot can be filled by a script rather than by a node insertion. */
        if (window.MutationObserver) {
            mine.observer = new window.MutationObserver(function () { tick(); });
            mine.observer.observe(document.body, { childList: true, subtree: true });
        }
        mine.timer = window.setTimeout(tick, POLL);
    }

    /* ------------------------------------------------------------------ */
    /* The two gestures, which no launcher card can stand in for           */

    /* EXIT INTENT AND SCROLL DEPTH ARE NOT PRESSED, THEY ARE PERFORMED, so the
       launcher deliberately refuses to fake them and nothing was arming a
       standby copy for either. With their campaigns deactivated they were the
       two scenarios that stayed dark, which is exactly what this module exists
       to prevent.

       The thresholds are the engine's own, read out of the SDK bundle rather
       than guessed: its exit intent handler is a mouseleave listener whose body
       is `e.clientY < -20 && fire()`, and the scroll campaign is configured at
       70 percent. Matching them means the standby copy appears on the same
       gesture the campaign would have answered, not on a different one. */
    var EXIT_ABOVE = -20;
    var SCROLL_AT = 0.7;

    /* NOT WHILE SOMETHING OF OURS IS ALREADY OPEN, and this is a product rule
       rather than a defensive one. A gesture is performed while the visitor is
       doing something else: scrolling a page with the cart drawer open, or
       reaching for the launcher. A widget that lands on top of an open drawer,
       the scenarios panel or another widget covers the thing the person was
       using and cannot be dismissed without losing their place.

       Found by the launcher check on 18 September 2026: clicking through the
       cards scrolled the page past the threshold, a standby copy was drawn over
       the panel, and every later click hit the overlay instead of the button. On
       a call the same sequence is an operator being interrupted mid sentence.

       The launcher already closes itself before firing a card for exactly this
       reason, so this is the same rule applied to the two scenarios that are not
       fired from a button. */
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

    /* A SCROLL THE VISITOR MADE, NOT A SCROLL THE PAGE MADE. scrollIntoView is
       used all over this storefront, by the recommendation rails, the inline
       slots and the launcher, and every one of those moves the scroll position
       without anybody having read anything. Watching the scroll position alone
       therefore fires "you read this far" when the page simply jumped, which is
       both wrong and, on 18 September 2026, the thing that put a widget on top
       of the open launcher panel and made every later click land on it.

       A wheel or a touch move is the visitor. Neither is produced by
       scrollIntoView, by an anchor jump or by a click's own scroll, so requiring
       one is the honest definition of scroll depth rather than a workaround. */
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
            /* Latched only on a gesture that actually arms, so a scroll made
               while a drawer was open does not use up the one chance the visitor
               had to see it. */
            if (busy()) return;
            firedScroll = true;
            armGesture('scroll-depth');
        }, { passive: true });
    }

    if (document.body) watchGestures();
    else document.addEventListener('DOMContentLoaded', watchGestures);

    window.Standby = { arm: arm, render: render, close: close, warm: warm,
                       CREATIVES: CREATIVES, GRACE: GRACE, YIELD_FOR: YIELD_FOR };

    /* The frame talks back here, because it is a separate realm and this page is
       the only one allowed to reach the event module. */
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
