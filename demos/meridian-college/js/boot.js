/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    function fetchJson(url) {
        return fetch(url, { cache: 'no-store' }).then(function (response) {
            if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
            return response.json();
        });
    }

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

    function answerThemeRequests(theme) {
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.dnTheme !== 'request') return;
            if (!event.source) return;
            try {
                event.source.postMessage({ dnTheme: 'reply', theme: theme }, '*');
            } catch (err) {

            }
        });
    }

    function applyCopy(copy) {

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

        if (results[0].slug && results[0].slug !== window.DEMO_SLUG) {
            if (window.console) {
                console.error('[boot] slug mismatch. demo.config.json says "' + results[0].slug +
                    '", the page markup says "' + window.DEMO_SLUG + '". Storage, contact keys ' +
                    'and order ids use the markup value. Fix the generator so both agree.');
            }
        }

        var themed = withBrandText(results[0].theme);
        applyTheme(themed);

        answerThemeRequests(themed);
        applyCopy(results[1]);

        return window.Catalog.load('products.json');
    }).then(function () {
        window.Storefront.boot();
    }).catch(fail);
})(window, document);
