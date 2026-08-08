/* ============================================================================
   Loads the three data files, then starts the storefront.

   demo.config.json, copy.json and products.json are fetched rather than inlined
   so that a generated demo is the template plus data, with no build step. A
   demo that needs a compile is a demo that can fail to compile fifteen minutes
   before a call. Handoff 5.0, 7.4.

   ORDERING, which matters and is easy to get wrong:

     1. js/identity.js runs FIRST, as a blocking script in the head, and sets
        window.__dnInit if a contact key is known.
     2. The SDK snippet in the head calls initialize with that key, so the
        contact is attached before any event goes out. Handoff 6.2.
     3. This file loads the data, then Storefront.boot() fires pageView.

   So identity precedes initialize, and initialize precedes pageView, which is
   the invariant the reference build got wrong: it initialized anonymously and
   set the contact key up to five seconds later, by which point pageView had
   already landed on the anonymous device profile.
   ========================================================================== */
(function (window, document) {
    'use strict';

    function fetchJson(url) {
        return fetch(url, { cache: 'no-store' }).then(function (response) {
            if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
            return response.json();
        });
    }

    /* THE BRAND COLOUR MADE SAFE TO USE AS TEXT, derived once here and handed to
       everything that needs it. Added 7 August 2026.

       WHY A SECOND BRAND TOKEN EXISTS AT ALL. The generator already guarantees that
       --primary and --on-primary are a readable PAIR, because resolveOnPrimary in
       factory/scrape/theme.mjs darkens the brand colour until white or near-black is
       readable ON it. That makes every button safe on every theme, and it says
       nothing at all about using the brand colour ITSELF as text on a white card.

       Those are different questions and the difference is not academic. Measured
       across twelve brand colours the factory can really produce:

         navy    #001f3f   16.56 on white     fine
         blue    #125cfa    5.33 on white     fine
         gold    #b4975a    2.79 on white     fails
         orange  #ff6b35    2.84 on white     fails
         yellow  #ffe600    1.27 on white     fails

       Seven of the twelve failed. The reason it went unnoticed is the last thing
       anybody would test: the standard palette's own blue passes, so every check
       written against the showcase demo was green.

       SO THIS DARKENS THE BRAND COLOUR UNTIL IT CLEARS 4.5:1 AGAINST THE SURFACE,
       and leaves it completely alone when it already does. A dark brand keeps its
       exact colour; a pale one gets a deeper version of itself rather than a
       different hue. Multiplying the channels is what keeps the hue: scaling all
       three by the same factor preserves their ratios, so the colour darkens without
       drifting, which repeated HSL lightness steps do not quite manage on a
       saturated colour.

       ONE PLACE, FOURTEEN CREATIVES. It is set on the page as --brand-text and sent
       over the theme bridge, so no creative carries contrast arithmetic in an inline
       attribute and none of them can disagree about the answer. */
    function parseHex(value) {
        var text = String(value || '').trim().replace(/^#/, '');
        if (text.length === 3) {
            text = text.charAt(0) + text.charAt(0) + text.charAt(1) +
                   text.charAt(1) + text.charAt(2) + text.charAt(2);
        }
        if (!/^[0-9a-fA-F]{6}$/.test(text)) return null;
        return [
            parseInt(text.slice(0, 2), 16),
            parseInt(text.slice(2, 4), 16),
            parseInt(text.slice(4, 6), 16)
        ];
    }

    function toHex(rgb) {
        return '#' + rgb.map(function (channel) {
            var n = Math.min(255, Math.max(0, Math.round(channel)));
            return (n < 16 ? '0' : '') + n.toString(16);
        }).join('');
    }

    /* WCAG relative luminance, which is not the same as brightness: the sRGB
       transfer curve has to be undone first, and the three channels are weighted
       very unevenly. Green carries most of it. */
    function luminance(rgb) {
        var parts = rgb.map(function (channel) {
            var c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    }

    function contrastRatio(a, b) {
        var la = luminance(a);
        var lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    /* 4.5 AGAINST TWO SURFACES, RATHER THAN A PADDED NUMBER AGAINST ONE.

       Several creatives put this colour on a panel that is itself a faint wash of the
       brand colour: a selected chip, an eyebrow pill. A colour derived to clear 4.5:1
       against the white card clears rather less against a wash of itself, so the first
       version of this asked for 5.2:1 against the card and spent the difference on the
       tint.

       That number was a guess, and it was not quite enough: an eyebrow on a 14 percent
       wash of a blue brand measured 4.19:1. Raising the guess again would darken the
       brand colour everywhere, including the many places it sits on plain white and
       needs no help at all.

       So the tint is modelled instead of padded around. The strongest wash any creative
       puts text on is 14 percent, so this asks for a plain 4.5:1 against BOTH the card
       and that wash, and takes whichever binds. On a light brand the wash binds and the
       colour goes a step darker than it used to; on a dark brand the wash is
       indistinguishable from the card and nothing changes. The gold brand derives to the
       same value either way, which is the reassurance that this is a tightening rather
       than a redesign.

       TINT tracks the creatives. If one ever paints this colour on a heavier wash than
       14 percent, that number moves and every creative is re derived from one place. */
    var TEXT_CONTRAST = 4.5;
    var TINT = 0.14;

    function washed(brand, surface) {
        return surface.map(function (channel, index) {
            return channel * (1 - TINT) + brand[index] * TINT;
        });
    }

    function brandTextColour(theme) {
        var brand = parseHex(theme.primary);
        var surface = parseHex(theme.surface) || [255, 255, 255];
        var fallback = theme.ink || '#14181b';
        if (!brand) return fallback;

        var wash = washed(brand, surface);

        /* Twenty steps of 12 percent reaches about 8 percent of the original, which
           clears 4.5:1 against white from any starting colour. The loop is bounded
           rather than trusted: a guard that cannot run forever is worth more than
           one that should not need to. */
        var colour = brand;
        for (var step = 0; step < 20; step++) {
            if (contrastRatio(colour, surface) >= TEXT_CONTRAST &&
                contrastRatio(colour, wash) >= TEXT_CONTRAST) {
                return toHex(colour);
            }
            colour = colour.map(function (channel) { return channel * 0.88; });
        }
        return fallback;
    }

    /* Returned as a new object rather than mutated, so the config in
       window.DEMO_CONFIG keeps exactly what was fetched and the derived value is
       visibly derived. */
    function withBrandText(theme) {
        if (!theme) return theme;
        var out = {};
        Object.keys(theme).forEach(function (key) { out[key] = theme[key]; });
        out.brandText = brandTextColour(theme);
        return out;
    }

    function applyTheme(theme) {
        if (!theme) return;
        var root = document.documentElement;
        var map = {
            primary: '--primary', onPrimary: '--on-primary', accent: '--accent',
            ink: '--ink', muted: '--muted', surface: '--surface', page: '--page',
            line: '--line', radius: '--radius', brandText: '--brand-text'
        };
        Object.keys(map).forEach(function (key) {
            if (theme[key]) root.style.setProperty(map[key], theme[key]);
        });
        if (theme.displayFont) {
            root.style.setProperty('--display-font', theme.displayFont + ', Inter, ui-sans-serif, system-ui, sans-serif');
        }
        if (theme.bodyFont) {
            root.style.setProperty('--body-font', theme.bodyFont + ', ui-sans-serif, system-ui, sans-serif');
        }
    }

    /* ANSWERING A DENGAGE POPUP THAT ASKS WHAT THE THEME IS.
       Added 7 August 2026, and it is the parent half of a bridge whose other half
       lives in the creative files under factory/creatives.

       Written without a glob on purpose: the characters that spell one are also the
       characters that open a comment, and factory/scrub-demo.py counts those to
       decide whether it can trust the comment spans it is about to remove. It
       refused this file until the glob went, which is the check working.

       WHY A POPUP HAS TO ASK. An inline campaign renders in this document, so it
       reads var(--primary) and needs nothing. A popup renders in a cross-origin
       iframe: custom properties do not cross, and the frame cannot reach this
       document at all. So a popup was always the standard blue on top of a themed
       storefront, and the seam was the most visible thing on screen.

       WHY IT CANNOT WORK OUT THE ANSWER FOR ITSELF. The first attempt had the
       creative read document.referrer, find the demo folder in it and fetch
       demo.config.json. That fails for a reason no amount of care in the creative
       fixes: Chrome's default referrer policy is strict-origin-when-cross-origin,
       so a cross-origin frame is told the ORIGIN and never the path. The creative
       built https://dengage-presales.github.io/demo.config.json and got a 404. The
       page is the only thing that knows which demo this is.

       WHAT IT SENDS. The theme block, which is already public: it is served as part
       of demo.config.json from a public URL on a public site. So targetOrigin '*'
       gives nothing away, and it is necessary rather than lazy, because this side
       cannot know which host Dengage will serve a creative from.

       WHAT IT REFUSES TO DO. It reads exactly one field of the message, to check a
       constant, and then replies. It never runs anything the message contains, never
       reads a URL out of it, and never sends anything but the theme. A listener that
       accepts messages from any frame has to be judged on what it does with them,
       and this one does nothing at all. */
    function answerThemeRequests(theme) {
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.dnTheme !== 'request') return;
            if (!event.source) return;
            try {
                event.source.postMessage({ dnTheme: 'reply', theme: theme }, '*');
            } catch (err) {
                /* A frame that has already gone is not an error worth reporting. */
            }
        });
    }

    function applyCopy(copy) {
        /* Static strings in the markup carry data-copy, so no label is written
           twice and none is hard coded inside a module. Handoff 14.5. */
        Array.prototype.slice.call(document.querySelectorAll('[data-copy]')).forEach(function (el) {
            var key = el.getAttribute('data-copy');
            if (copy[key]) el.textContent = copy[key];
        });
        Array.prototype.slice.call(document.querySelectorAll('[data-copy-attr]')).forEach(function (el) {
            var spec = el.getAttribute('data-copy-attr').split(':');
            if (spec.length === 2 && copy[spec[1]]) el.setAttribute(spec[0], copy[spec[1]]);
        });
    }

    function fail(err) {
        if (window.console) console.error('[boot]', err);
        var main = document.querySelector('main');
        if (main) {
            main.innerHTML = '<div class="container"><p class="empty">' +
                'This demo could not load its catalogue. Serve the repository root and reload.' +
                '</p></div>';
        }
    }

    Promise.all([
        fetchJson('demo.config.json'),
        fetchJson('copy.json'),
        fetchJson('products.json')
    ]).then(function (results) {
        window.DEMO_CONFIG = results[0];
        window.DEMO_COPY = results[1];

        /* VERIFY, DO NOT SET. This line used to call setAttribute, which looked
           harmless and hid a real bug for as long as it existed: every module
           that namespaced storage read the attribute before this ran, got
           nothing, and fell back to a shared default, so all demos collided.
           Setting it here made the attribute look correct to anything that
           checked afterwards, including a person reading the DOM in DevTools.

           The generator writes data-demo-slug into the markup, so by the time
           this runs the value is already in use. All this can usefully do is say
           so when the two sources disagree, which would mean the generator wrote
           one and not the other and the demo has split its namespace in half. */
        if (results[0].slug && results[0].slug !== window.DEMO_SLUG) {
            if (window.console) {
                console.error('[boot] slug mismatch. demo.config.json says "' + results[0].slug +
                    '", the page markup says "' + window.DEMO_SLUG + '". Storage, contact keys ' +
                    'and order ids use the markup value. Fix the generator so both agree.');
            }
        }
        /* Derived once, then used for both halves, so the page and every popup are
           working from the same numbers. */
        var themed = withBrandText(results[0].theme);
        applyTheme(themed);
        /* Registered right after the theme is applied to this document, so the two
           can never disagree about what the theme is. A popup fires from a click,
           long after this, so the listener is always in place before anything asks. */
        answerThemeRequests(themed);
        applyCopy(results[1]);

        /* products.json is already fetched, so hand it straight to the catalogue
           rather than fetching twice. */
        return window.Catalog.load('products.json');
    }).then(function () {
        window.Storefront.boot();
    }).catch(fail);
})(window, document);
