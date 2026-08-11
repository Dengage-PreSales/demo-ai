/* The applicant's journey: shortlist, application, search and identity.

   WHY THIS SITS ON TOP OF THE STOREFRONT MODULES RATHER THAN BESIDE THEM.

   An admissions funnel and a shopping funnel are the same shape. A prospective
   student browses subjects, saves the ones they like, assembles a combination,
   starts an application and submits it, and every one of those steps is a step a
   marketing platform already understands. So the journey here is expressed in the
   platform's own vocabulary rather than in a private one:

       subject added to the application      shopping_cart_events
       application started                   shopping_cart_events, begin checkout
       application submitted                 order_events, order_events_detail
       subject shortlisted                   wishlist_events
       subject search                        search_events
       every page                            page_view_events

   That is what makes recommendations, abandonment journeys and the contact card
   work on day one instead of needing anything new configured.

   NOTHING HERE INVENTS A FIGURE. A college publishes no price per subject, so no
   price is sent. Empty is the honest value and the event module drops the key
   rather than sending a zero, because a zero is a claim and an absent key is not. */
(function (window, document) {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var esc = function (value) { return window.EduSite.esc(value); };

    var content = null;

    function subjects() { return (content && content.subjects) || []; }

    function subjectById(id) {
        return subjects().filter(function (s) { return String(s.id) === String(id); })[0] || null;
    }

    function facultyName(id) {
        var found = ((content && content.faculties) || []).filter(function (f) { return f.id === id; })[0];
        return found ? found.name : id;
    }

    /* The shape the storefront modules expect. Price and stock are deliberately
       absent rather than zero. */
    function asItem(subject) {
        return {
            id: subject.id,
            name: subject.name,
            categoryPath: facultyName(subject.faculty),
            price: null,
            discountedPrice: null,
            stockCount: null,
            image: null
        };
    }

    function motifFor(subject) {
        return '<span class="motif">' + window.EduArtwork.motif(subject.motif) + '</span>';
    }

    /* ------------------------------------------------------------- shortlist */

    function toggleShortlist(id) {
        var subject = subjectById(id);
        if (!subject) return;
        var saved = window.Store.toggleWishlist(asItem(subject));
        window.EduSite.toast(saved
            ? subject.name + ' added to your shortlist'
            : subject.name + ' removed from your shortlist');
        paint();
    }

    function renderShortlist() {
        var host = $('#shortlist-body');
        if (!host) return;
        var list = window.Store.wishlist();
        if (!list.length) {
            host.innerHTML = '<p class="empty">Nothing shortlisted yet. Save the subjects you are ' +
                'considering and they stay here while you decide.</p>';
            return;
        }
        host.innerHTML = list.map(function (saved) {
            var subject = subjectById(saved.id);
            return '<div class="line-item">' +
                (subject ? motifFor(subject) : '') +
                '<div style="flex:1">' +
                    '<h4>' + esc(saved.name) + '</h4>' +
                    '<div class="meta">' + esc(subject ? facultyName(subject.faculty) : '') + '</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-add-subject="' + esc(saved.id) + '">Add</button>' +
                    '<button type="button" class="link-btn" data-drop-shortlist="' + esc(saved.id) + '">Remove</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    /* ----------------------------------------------------------- application */

    function addSubject(id) {
        var subject = subjectById(id);
        if (!subject) return;
        var already = window.Store.cart().some(function (l) { return String(l.id) === String(id); });
        if (already) {
            window.EduSite.toast(subject.name + ' is already in your application');
            return;
        }
        window.Store.addToCart(asItem(subject), 1);
        window.EduSite.toast(subject.name + ' added to your application', {
            label: 'Review',
            run: function () { window.EduSite.openPanel('#application'); }
        });
        paint();
    }

    function dropSubject(id) {
        window.Store.removeFromCart(id);
        paint();
    }

    function renderApplication() {
        var host = $('#application-body');
        if (!host) return;
        var lines = window.Store.cart();
        var foot = $('#application-foot');

        if (!lines.length) {
            host.innerHTML = '<p class="empty">Your application is empty. Pick the subject combination ' +
                'you want to study and it is held here until you submit.</p>';
            if (foot) foot.hidden = true;
            return;
        }

        host.innerHTML =
            '<p class="result-note">A Cambridge A Level combination is normally three or four subjects. ' +
            'You have selected ' + lines.length + '.</p>' +
            lines.map(function (line) {
                var subject = subjectById(line.id);
                return '<div class="line-item">' +
                    (subject ? motifFor(subject) : '') +
                    '<div style="flex:1">' +
                        '<h4>' + esc(line.name) + '</h4>' +
                        '<div class="meta">' + esc(line.categoryPath || '') +
                        (subject ? ' | Syllabus ' + esc(subject.id) : '') + '</div>' +
                    '</div>' +
                    '<button type="button" class="link-btn" data-drop-subject="' + esc(line.id) + '">Remove</button>' +
                '</div>';
            }).join('');
        if (foot) foot.hidden = false;
    }

    /* Starting the application is its own event, because the gap between
       starting and submitting is the single most valuable moment in an
       admissions funnel and the one a journey is built to rescue. */
    function startApplication() {
        if (!window.Store.cart().length) {
            window.EduSite.toast('Add at least one subject before you start');
            return;
        }
        window.Store.beginCheckout();
        window.EduSite.closePanels();
        window.location.href = 'apply.html';
    }

    function submitApplication(details) {
        var result = window.Store.placeOrder('other');
        paint();
        return result;
    }

    /* ---------------------------------------------------------------- search */

    function runSearch(term) {
        var host = $('#search-results');
        var query = String(term || '').trim();
        if (!host) return;
        if (!query) { host.innerHTML = ''; return; }

        var needle = query.toLowerCase();
        var hits = subjects().filter(function (subject) {
            return subject.name.toLowerCase().indexOf(needle) !== -1 ||
                   String(subject.id).indexOf(needle) !== -1 ||
                   facultyName(subject.faculty).toLowerCase().indexOf(needle) !== -1;
        });

        window.DengageEvents.search(query, hits.length);

        if (!hits.length) {
            host.innerHTML = '<p class="empty">Nothing matched <b>' + esc(query) + '</b>. ' +
                'A search that finds nothing is worth as much as one that finds something: it is the ' +
                'clearest signal of what somebody wanted and could not get.</p>' +
                '<a class="btn btn-ghost btn-sm" href="academics.html#subjects">Browse all subjects</a>';
            return;
        }
        host.innerHTML = '<p class="meta" style="margin-bottom:10px">' + hits.length +
            ' subject' + (hits.length === 1 ? '' : 's') + ' for "' + esc(query) + '"</p>' +
            hits.map(function (subject) {
                return '<div class="line-item">' + motifFor(subject) +
                    '<div style="flex:1"><h4>' + esc(subject.name) + '</h4>' +
                    '<div class="meta">' + esc(facultyName(subject.faculty)) + ' | Syllabus ' + esc(subject.id) + '</div></div>' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-add-subject="' + esc(subject.id) + '">Add</button>' +
                '</div>';
            }).join('');
    }

    /* -------------------------------------------------------------- identity */

    function currentKey() {
        return (window.DemoIdentity && window.DemoIdentity.contactKey) || null;
    }

    function identify(key) {
        if (!key) return false;
        if (!window.DengageEvents.setContactKey(key)) return false;
        window.DemoIdentity.contactKey = key;
        try { window.sessionStorage.setItem(window.DemoIdentity.storageKey, key); } catch (err) { /* private mode */ }
        window.DengageEvents.pageview('login');
        paint();
        return true;
    }

    function signOut() {
        window.DemoIdentity.contactKey = null;
        try { window.sessionStorage.removeItem(window.DemoIdentity.storageKey); } catch (err) { /* private mode */ }
        try { window.localStorage.removeItem(window.DemoIdentity.storageKey); } catch (err) { /* private mode */ }
        window.DengageEvents.pageview('logout');
        paint();
    }

    function renderAccount() {
        var host = $('#account-body');
        if (!host) return;
        var key = currentKey();
        if (key) {
            host.innerHTML =
                '<p>This browser is attached to contact <b>' + esc(key) + '</b>. Everything it does from ' +
                'here lands on that contact card in Dengage.</p>' +
                '<button type="button" class="btn btn-ghost btn-block" id="account-signout">Sign out</button>';
            $('#account-signout').addEventListener('click', signOut);
            return;
        }
        host.innerHTML =
            '<p>Signing in identifies a contact, it does not authenticate one. Enter a contact key and ' +
            'every event this browser sends is attributed to it.</p>' +
            '<div class="field"><label for="account-key">Contact key</label>' +
            '<input id="account-key" type="text" value="DPS-1" autocomplete="off">' +
            '<span class="hint">Demo contacts all begin DPS- so they can be told apart from real ones.</span></div>' +
            '<button type="button" class="btn btn-primary btn-block" id="account-signin">Continue</button>';
        $('#account-signin').addEventListener('click', function () {
            var value = $('#account-key').value.trim();
            if (!value) return;
            if (identify(value)) window.EduSite.toast('Signed in as ' + value);
        });
    }

    /* Used by the lead capture widgets: a visitor who hands over an email is a
       contact, and they need a key before the form is sent rather than after,
       or the platform mints one of its own and the demo contact is unfindable. */
    function ensureContactKey() {
        var key = currentKey();
        if (key) return key;
        var minted = window.DemoIdentity.mintKey(Date.now());
        return identify(minted) ? minted : null;
    }

    /* ------------------------------------------------------------------ paint */

    function counter(id, value) {
        var el = $(id);
        if (!el) return;
        el.textContent = value;
        el.hidden = !value;
    }

    /* --------------------------------------------------------- the apply page */

    function renderApplySubjects() {
        var host = $('#apply-subjects');
        if (!host) return;
        var lines = window.Store.cart();
        if (!lines.length) {
            host.innerHTML = '<p class="result-note">No subjects selected yet. ' +
                '<a href="academics.html#subjects">Pick your combination</a> and it appears here.</p>';
            return;
        }
        host.innerHTML = '<div class="result-note" style="margin-bottom:14px">' + lines.length +
            ' subject' + (lines.length === 1 ? '' : 's') + ' selected. Three or four is the usual shape.</div>' +
            lines.map(function (line) {
                var subject = subjectById(line.id);
                return '<div class="line-item">' + (subject ? motifFor(subject) : '') +
                    '<div style="flex:1"><h4>' + esc(line.name) + '</h4>' +
                    '<div class="meta">' + esc(line.categoryPath || '') + '</div></div>' +
                    '<button type="button" class="link-btn" data-drop-subject="' + esc(line.id) + '">Remove</button>' +
                '</div>';
            }).join('');
    }

    function wireApplyForm() {
        var form = $('#apply-form');
        if (!form) return;

        /* Reaching this page with subjects selected is the moment the funnel
           calls a checkout, so it is recorded once per arrival rather than on
           every keystroke. */
        if (window.Store.cart().length) {
            window.Store.beginCheckout();
            window.EduUseCases.remember('application-started', Date.now());
        }

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!window.Store.cart().length) {
                window.EduSite.toast('Pick your subject combination first');
                window.location.href = 'academics.html#subjects';
                return;
            }
            ensureContactKey();
            var result = submitApplication();
            var progress = $('#apply-progress');
            if (progress) $$('span', progress).forEach(function (bar) { bar.classList.add('is-done'); });
            form.innerHTML =
                '<h2>Application received</h2>' +
                '<p>Your reference is <b>' + esc(result ? result.orderId : '') + '</b>. Screening takes a ' +
                'few days, and you will hear from us by email. The same update appears in your message ' +
                'inbox on this site.</p>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
                '<a class="btn btn-primary" href="index.html">Back to the college</a>' +
                '<a class="btn btn-ghost" href="counselling.html">Book a counselling session</a></div>';
            window.EduSite.toast('Application submitted');
        });
    }

    function wireContactForm() {
        var form = $('#contact-form');
        if (!form) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            ensureContactKey();
            var topic = $('#contact-topic').value;
            form.reset();
            window.EduSite.toast('Message sent. Admissions reply within one working day.');
            window.DengageEvents.pageview('other', { categoryPath: 'Contact/' + topic });
        });
    }

    function paint() {
        counter('#application-count', window.Store.cart().length);
        counter('#shortlist-count', window.Store.wishlist().length);
        renderApplication();
        renderShortlist();
        renderAccount();
        renderApplySubjects();

        $$('[data-shortlist-toggle]').forEach(function (button) {
            var saved = window.Store.isSaved(button.getAttribute('data-shortlist-toggle'));
            button.classList.toggle('is-active', saved);
            button.textContent = saved ? 'Shortlisted' : 'Shortlist';
        });
        $$('[data-add-subject]').forEach(function (button) {
            if (button.hasAttribute('data-keep-label')) return;
            var inCart = window.Store.cart().some(function (l) {
                return String(l.id) === button.getAttribute('data-add-subject');
            });
            if (button.classList.contains('btn')) {
                button.textContent = inCart ? 'Added' : (button.getAttribute('data-label') || 'Add to application');
            }
        });
    }

    /* ------------------------------------------------------------------- wire */

    function wire() {
        document.addEventListener('click', function (event) {
            var el = event.target.closest ? event.target.closest('[data-add-subject], [data-drop-subject], [data-shortlist-toggle], [data-drop-shortlist], [data-start-application]') : null;
            if (!el) return;
            event.preventDefault();
            if (el.hasAttribute('data-add-subject')) return addSubject(el.getAttribute('data-add-subject'));
            if (el.hasAttribute('data-drop-subject')) return dropSubject(el.getAttribute('data-drop-subject'));
            if (el.hasAttribute('data-shortlist-toggle')) return toggleShortlist(el.getAttribute('data-shortlist-toggle'));
            if (el.hasAttribute('data-drop-shortlist')) return toggleShortlist(el.getAttribute('data-drop-shortlist'));
            if (el.hasAttribute('data-start-application')) return startApplication();
        });

        var searchForm = $('#search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', function (event) {
                event.preventDefault();
                runSearch($('#search-input').value);
            });
        }

        var newsletter = $('#footer-newsletter');
        if (newsletter) {
            newsletter.addEventListener('submit', function (event) {
                event.preventDefault();
                var email = newsletter.querySelector('input').value.trim();
                if (!email) return;
                ensureContactKey();
                newsletter.reset();
                window.EduSite.toast('You are on the list. Admissions updates will reach ' + email);
            });
        }

        window.Store.onChange(function () {
            counter('#application-count', window.Store.cart().length);
            counter('#shortlist-count', window.Store.wishlist().length);
        });
    }

    function init(loadedContent) {
        content = loadedContent;
        wire();
        wireApplyForm();
        wireContactForm();
        paint();
    }

    window.EduJourney = {
        init: init,
        paint: paint,
        addSubject: addSubject,
        toggleShortlist: toggleShortlist,
        startApplication: startApplication,
        submitApplication: submitApplication,
        runSearch: runSearch,
        identify: identify,
        ensureContactKey: ensureContactKey,
        currentKey: currentKey,
        subjectById: subjectById,
        facultyName: facultyName,
        asItem: asItem
    };
})(window, document);
