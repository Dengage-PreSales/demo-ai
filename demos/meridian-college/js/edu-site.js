/* The site chrome, and the plumbing every page shares.

   Header, navigation, footer, overlays and toasts are rendered here from
   content.json, so eleven pages carry one copy of the chrome rather than eleven
   copies that drift.

   THE ONE THING IN HERE THAT IS NOT COSMETIC. Every page fires a page view, and
   it fires before the content fetch resolves rather than after it. That call is
   what makes this demo's rows findable at all: the SDK writes page_url and
   session_id onto the row itself, and session_id is the only join from a page
   view to the application, shortlist and search rows the same visit produces. A
   page that skipped it would still look perfect and would write rows nobody can
   attribute to anything. So it does not wait for the network. */
(function (window, document) {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var state = { config: null, content: null };
    var waiting = [];
    var loaded = false;

    function esc(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* The page type the SDK understands, taken from the body rather than guessed
       from the file name. The vocabulary is fixed by the platform, so an
       admissions page is a promotion and a subject page is a product: the shape
       of the funnel is the same even though the words are not. */
    function pageType() {
        return document.body.getAttribute('data-page-type') || 'other';
    }

    /* An attribute of the form query:name takes its value from the query string
       instead. A subject page is one file serving sixteen subjects, and the page
       view has to carry which one, or every subject view is indistinguishable
       from every other in the table. */
    function attr(name) {
        var value = document.body.getAttribute(name);
        if (!value) return null;
        if (value.indexOf('query:') !== 0) return value;
        try {
            return new URLSearchParams(window.location.search).get(value.slice(6));
        } catch (error) {
            return null;
        }
    }

    function firePageView() {
        var detail = {};
        var category = attr('data-category-path');
        var item = attr('data-item-id');
        if (category) detail.categoryPath = category;
        if (item) detail.productId = item;
        window.DengageEvents.pageview(pageType(), detail);
    }

    /* ---------------------------------------------------------------- chrome */

    function navLink(item, current) {
        var isCurrent = current && item.href.split('#')[0] === current;
        var children = '';
        if (item.children) {
            children = '<ul class="submenu">' + item.children.map(function (child) {
                return '<li><a href="' + esc(child.href) + '">' + esc(child.label) + '</a></li>';
            }).join('') + '</ul>';
        }
        var caret = item.children
            ? '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>'
            : '';
        return '<li class="' + (isCurrent ? 'is-current' : '') + '">' +
               '<a href="' + esc(item.href) + '">' + esc(item.label) + caret + '</a>' + children + '</li>';
    }

    var LOGO_MARK =
        '<svg viewBox="0 0 38 38" aria-hidden="true" focusable="false">' +
        '<path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/>' +
        '<path d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/>' +
        '</svg>';

    /* The Dengage mark, always, and never the institution's own. This is a
       demonstration storefront for a sales conversation, not a live college
       site, and the header is where that has to be unambiguous. */
    function logo() {
        return '<a href="index.html" class="logo">' + LOGO_MARK +
            '<span><span class="logo-word">Dengage</span>' +
            '<span class="logo-sub">Education Demo</span></span></a>';
    }

    function renderHeader() {
        var host = $('#site-chrome-top');
        if (!host) return;
        var content = state.content;
        var org = content.institution;
        var current = (window.location.pathname.split('/').pop() || 'index.html');

        host.innerHTML =
            '<div class="topbar"><div class="container">' +
                '<ul>' +
                    '<li>' + esc(org.phone) + '</li>' +
                    '<li>' + esc(org.email) + '</li>' +
                    '<li>' + esc(org.address) + '</li>' +
                '</ul>' +
                '<ul class="topbar-links">' + content.utilityNav.map(function (item) {
                    return '<li><a href="' + esc(item.href) + '">' + esc(item.label) + '</a></li>';
                }).join('') + '</ul>' +
            '</div></div>' +
            '<header class="site-header"><div class="container"><div class="header-inner">' +
                '<button type="button" class="icon-btn nav-toggle" id="nav-toggle" aria-controls="site-nav" aria-expanded="false" aria-label="Menu">' +
                    '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>' +
                '</button>' +
                logo() +
                '<nav class="site-nav" id="site-nav" aria-label="Main"><ul>' +
                    content.nav.map(function (item) { return navLink(item, current); }).join('') +
                '</ul></nav>' +
                '<div class="header-actions">' +
                    '<button type="button" class="icon-btn" data-open="#search-panel" aria-label="Search subjects">' +
                        '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>' +
                    '</button>' +
                    '<button type="button" class="icon-btn has-count" data-open="#shortlist" aria-label="Shortlist">' +
                        '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.6c0 5-7 9.4-7 9.4z"/></svg>' +
                        '<span class="pill-count" id="shortlist-count" hidden>0</span>' +
                    '</button>' +
                    '<button type="button" class="icon-btn has-count" data-open="#inbox" aria-label="Messages">' +
                        '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg>' +
                        '<span class="pill-count" id="inbox-count" hidden>0</span>' +
                    '</button>' +
                    '<button type="button" class="icon-btn has-count" data-open="#application" aria-label="Your application">' +
                        '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>' +
                        '<span class="pill-count" id="application-count" hidden>0</span>' +
                    '</button>' +
                    '<button type="button" class="icon-btn" data-open="#account" aria-label="Account">' +
                        '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.7 3.5-5.6 7-5.6s6.4 1.9 7 5.6"/></svg>' +
                    '</button>' +
                    '<a class="btn btn-primary btn-sm" href="apply.html">Apply Now</a>' +
                '</div>' +
            '</div></div></header>';

        var toggle = $('#nav-toggle');
        toggle.addEventListener('click', function () {
            var nav = $('#site-nav');
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    function renderFooter() {
        var host = $('#site-chrome-bottom');
        if (!host) return;
        var content = state.content;
        var org = content.institution;

        host.innerHTML =
            '<footer class="site-footer"><div class="container">' +
            '<div class="footer-grid">' +
                '<div class="footer-brand">' + logo() +
                    '<p style="margin-top:18px">' + esc(org.name) + ' is a fictional college built to demonstrate ' +
                    'Dengage on an education website. Every page, message and journey here is a demonstration.</p>' +
                    '<div class="social">' + content.footer.social.map(function (name) {
                        return '<span title="' + esc(name) + '">' + esc(name.slice(0, 2)) + '</span>';
                    }).join('') + '</div>' +
                '</div>' +
                '<div><h4>Our Campus</h4><ul>' + content.footer.campus.map(function (item) {
                    return '<li><a href="' + esc(item.href) + '">' + esc(item.label) + '</a></li>';
                }).join('') + '</ul></div>' +
                '<div><h4>Useful Links</h4><ul>' + content.footer.useful.map(function (item) {
                    return '<li><a href="' + esc(item.href) + '">' + esc(item.label) + '</a></li>';
                }).join('') + '</ul></div>' +
                '<div>' +
                    '<h4>Newsletter</h4>' +
                    '<p>Admissions dates, open days and results, straight to your inbox.</p>' +
                    '<form class="newsletter" id="footer-newsletter">' +
                        '<input type="email" name="email" placeholder="Your email address" aria-label="Your email address" required>' +
                        '<button type="submit" class="btn btn-accent btn-sm">Join</button>' +
                    '</form>' +
                    '<p style="margin-top:12px;font-size:13px">Email: ' + esc(org.email) + '<br>Phone: ' + esc(org.phone) + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="footer-note">Copyright ' + esc(org.copyright) + '</div>' +
            '</div></footer>';
    }

    /* -------------------------------------------------------------- overlays */

    function openPanel(selector) {
        var panel = $(selector);
        if (!panel) return;
        panel.classList.add('is-open');
        $('#scrim').classList.add('is-open');
        document.body.classList.add('has-overlay');
        document.body.style.overflow = 'hidden';
    }

    function closePanels() {
        $$('.drawer.is-open, .modal.is-open').forEach(function (panel) { panel.classList.remove('is-open'); });
        var scrim = $('#scrim');
        if (scrim) scrim.classList.remove('is-open');
        document.body.classList.remove('has-overlay');
        document.body.style.overflow = '';
    }

    function wireOverlays() {
        document.addEventListener('click', function (event) {
            var opener = event.target.closest ? event.target.closest('[data-open]') : null;
            if (opener) {
                event.preventDefault();
                openPanel(opener.getAttribute('data-open'));
                return;
            }
            var closer = event.target.closest ? event.target.closest('[data-close]') : null;
            if (closer) {
                event.preventDefault();
                closePanels();
            }
        });
        var scrim = $('#scrim');
        if (scrim) scrim.addEventListener('click', closePanels);
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closePanels();
        });
    }

    /* ---------------------------------------------------------------- toasts */

    function toast(message, action) {
        var stack = $('#toast-stack');
        if (!stack) return;
        var el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = '<b>' + esc(message) + '</b>';
        if (action) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'link-btn';
            button.textContent = action.label;
            button.addEventListener('click', function () {
                action.run();
                if (el.parentNode) el.parentNode.removeChild(el);
            });
            el.appendChild(button);
        }
        stack.appendChild(el);
        window.setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, action ? 9000 : 4500);
    }

    /* ------------------------------------------------------------- accordion */

    function wireAccordions(root) {
        $$('.accordion-head', root || document).forEach(function (head) {
            if (head.getAttribute('data-wired')) return;
            head.setAttribute('data-wired', '1');
            head.addEventListener('click', function () {
                var item = head.parentNode;
                var open = item.classList.toggle('is-open');
                head.setAttribute('aria-expanded', open ? 'true' : 'false');
                var sign = $('.sign', head);
                if (sign) sign.textContent = open ? '-' : '+';
            });
        });
    }

    /* Tab groups: one container with .tabs and one with .tab-panel per index. */
    function wireTabs(root) {
        $$('[data-tabs]', root || document).forEach(function (group) {
            if (group.getAttribute('data-wired')) return;
            group.setAttribute('data-wired', '1');
            var buttons = $$('.tab', group);
            var panels = $$('.tab-panel', group);
            buttons.forEach(function (button, index) {
                button.addEventListener('click', function () {
                    buttons.forEach(function (b) { b.classList.remove('is-active'); });
                    panels.forEach(function (p) { p.hidden = true; });
                    button.classList.add('is-active');
                    if (panels[index]) panels[index].hidden = false;
                });
            });
        });
    }

    /* ------------------------------------------------------------------ boot */

    function ready(fn) {
        if (loaded) { fn(state); return; }
        waiting.push(fn);
    }

    function load() {
        return Promise.all([
            fetch('demo.config.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
            fetch('content.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
        ]).then(function (results) {
            state.config = results[0];
            state.content = results[1];

            /* The event module reads this at call time, so the scenario prefix
               and the application are in place before any launcher card fires. */
            window.DEMO_CONFIG = state.config;
            window.DEMO_COPY = {
                inboxTitle: 'Messages',
                inboxRefresh: 'Refresh',
                inboxEmpty: 'No messages yet.',
                inboxEmptyHint: 'Send one from a Dengage campaign or journey and press Refresh.',
                inboxStarting: 'Connecting this browser to Dengage. Press Refresh in a moment.',
                inboxNoSdk: 'The inbox needs the Dengage application, which is not loaded on this page.',
                inboxError: 'Dengage could not return this inbox. The console has the reason.',
                inboxOpen: 'Open',
                inboxDismiss: 'Dismiss',
                inboxUntitled: 'Message',
                inboxJustNow: 'now',
                inboxMinutes: '{n} min',
                inboxHours: '{n} h',
                inboxUnread: '{n} unread',
                close: 'Close'
            };

            renderHeader();
            renderFooter();
            loaded = true;
            waiting.forEach(function (fn) { fn(state); });
            waiting = [];
            return state;
        });
    }

    function init() {
        /* Before anything else, and before the fetch. */
        firePageView();
        wireOverlays();
        load().then(function () {
            wireAccordions();
            wireTabs();
            if (window.Slots) window.Slots.init();
            if (window.Inbox) window.Inbox.boot();
        }).catch(function (error) {
            if (window.console) console.error('[demo] the site content could not be loaded', error);
        });
    }

    window.EduSite = {
        init: init,
        ready: ready,
        esc: esc,
        toast: toast,
        openPanel: openPanel,
        closePanels: closePanels,
        wireAccordions: wireAccordions,
        wireTabs: wireTabs,
        state: state,
        $: $,
        $$: $$
    };
})(window, document);
