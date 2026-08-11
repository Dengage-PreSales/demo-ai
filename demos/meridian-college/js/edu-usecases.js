/* THE USE CASE LAUNCHER. Twenty education scenarios, on demand, in one panel.

   HOW THESE ARE DELIVERED, WHICH IS THE WHOLE DESIGN.

   Every card does two things when it is pressed:

     1. It pushes a data layer event named demo_dengage_edu_<scenario>. That is
        the trigger a Dengage On-Site campaign listens for, so any of these can be
        answered by a real campaign later with no change to this website at all.
        The prefix is set once, in demo.config.json, and the event module builds
        the name from it.

     2. It renders the scenario in the page itself.

   Step 2 is what makes this demo work on the day it is published. Nothing has to
   be built, configured or clicked in the Dengage panel first, and no card can go
   dark mid call because a campaign was paused, a creative was edited, or an ad
   blocker refused a request. Step 1 is what makes it upgradeable: the moment a
   campaign exists for one of these names, that campaign answers the same button.

   The two do not fight. A card is a demonstration of the scenario either way.

   EVERY CARD IS RE-FIRABLE. A scenario shown once and unavailable for the rest of
   the call is worse than no scenario, so nothing here latches, suppresses or
   frequency caps. Press it as often as the conversation needs it.

   WHAT IS DELIBERATELY NOT HERE. No card invents a fee, a scholarship amount, an
   acceptance rate or a class size. The scenarios are about timing and relevance,
   which is what the platform actually does, and a number nobody can source would
   undermine every real thing on the page beside it. */
(function (window, document) {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var esc = function (value) { return window.EduSite.esc(value); };

    var content = null;

    function slug() { return window.DEMO_SLUG || 'demo'; }
    function memoryKey(name) { return 'dps:' + slug() + ':' + name; }

    function remember(name, value) {
        try { window.localStorage.setItem(memoryKey(name), String(value)); } catch (err) { /* private mode */ }
    }
    function recall(name) {
        try { return window.localStorage.getItem(memoryKey(name)); } catch (err) { return null; }
    }

    /* ------------------------------------------------------- rolling dates */

    /* The admissions round closes on the 25th, whichever 25th is next. A fixed
       date would read correctly for a fortnight and then quietly turn a demo into
       an advert for a deadline that has passed. */
    function nextDeadline() {
        var now = new Date();
        var target = new Date(now.getFullYear(), now.getMonth(), 25);
        if (target <= now) target = new Date(now.getFullYear(), now.getMonth() + 1, 25);
        return target;
    }

    function daysUntil(date) {
        return Math.max(0, Math.ceil((date - new Date()) / 86400000));
    }

    function longDate(date) {
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                      'August', 'September', 'October', 'November', 'December'];
        return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    }

    /* ---------------------------------------------------------- the surfaces */

    function surface() {
        var host = $('#usecase-surface');
        if (host) return host;
        host = document.createElement('div');
        host.id = 'usecase-surface';
        document.body.appendChild(host);
        return host;
    }

    function dismissAll() {
        $$('#usecase-surface .uc').forEach(function (el) { el.remove(); });
    }

    function frame(kind, inner, options) {
        options = options || {};
        dismissAll();
        var el = document.createElement('div');
        el.className = 'uc uc-' + kind;
        el.innerHTML =
            '<div class="uc-inner">' +
                '<button type="button" class="uc-close" aria-label="Close">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<path d="M6 6l12 12M18 6L6 18"/></svg>' +
                '</button>' + inner +
            '</div>';
        surface().appendChild(el);
        $('.uc-close', el).addEventListener('click', function () { el.remove(); });
        if (options.wire) options.wire(el);
        window.requestAnimationFrame(function () { el.classList.add('is-in'); });
        return el;
    }

    function card(config) {
        var art = config.motif
            ? '<span class="uc-motif">' + window.EduArtwork.motif(config.motif) + '</span>'
            : '';
        var actions = (config.actions || []).map(function (action, index) {
            return '<button type="button" class="btn ' + (index === 0 ? 'btn-primary' : 'btn-ghost') +
                   ' btn-sm" data-uc-action="' + index + '">' + esc(action.label) + '</button>';
        }).join('');
        return frame(config.kind || 'popup',
            '<div class="uc-head">' + art +
            '<div><span class="uc-kicker">' + esc(config.kicker || 'Meridian College') + '</span>' +
            '<h3>' + esc(config.title) + '</h3></div></div>' +
            '<div class="uc-body">' + config.body + '</div>' +
            (actions ? '<div class="uc-actions">' + actions + '</div>' : ''),
            {
                wire: function (el) {
                    $$('[data-uc-action]', el).forEach(function (button) {
                        button.addEventListener('click', function () {
                            var action = config.actions[Number(button.getAttribute('data-uc-action'))];
                            if (action && action.run) action.run(el);
                            if (!action || action.keepOpen !== true) el.remove();
                        });
                    });
                    if (config.wire) config.wire(el);
                }
            });
    }

    function formCard(config) {
        var fields = config.fields.map(function (field) {
            if (field.type === 'select') {
                return '<div class="field"><label for="uc-' + field.name + '">' + esc(field.label) + '</label>' +
                    '<select id="uc-' + field.name + '" name="' + field.name + '">' +
                    field.options.map(function (option) {
                        return '<option value="' + esc(option) + '">' + esc(option) + '</option>';
                    }).join('') + '</select></div>';
            }
            return '<div class="field"><label for="uc-' + field.name + '">' + esc(field.label) + '</label>' +
                '<input id="uc-' + field.name + '" name="' + field.name + '" type="' + (field.type || 'text') +
                '"' + (field.required === false ? '' : ' required') +
                (field.value ? ' value="' + esc(field.value) + '"' : '') +
                (field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '') + '></div>';
        }).join('');

        return frame('popup',
            '<div class="uc-head"><span class="uc-motif">' + window.EduArtwork.motif(config.motif || 'document') + '</span>' +
            '<div><span class="uc-kicker">' + esc(config.kicker || 'Meridian College') + '</span>' +
            '<h3>' + esc(config.title) + '</h3></div></div>' +
            '<div class="uc-body">' + (config.body || '') +
            '<form id="uc-form">' + fields +
            '<button type="submit" class="btn btn-primary btn-block">' + esc(config.submitLabel || 'Submit') + '</button>' +
            '</form></div>',
            {
                wire: function (el) {
                    $('#uc-form', el).addEventListener('submit', function (event) {
                        event.preventDefault();
                        var values = {};
                        config.fields.forEach(function (field) {
                            values[field.name] = $('#uc-' + field.name, el).value.trim();
                        });
                        el.remove();
                        config.submit(values);
                    });
                }
            });
    }

    function banner(html) {
        dismissAll();
        var el = document.createElement('div');
        el.className = 'uc uc-banner';
        el.innerHTML = '<div class="uc-inner">' + html +
            '<button type="button" class="uc-close" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
        surface().appendChild(el);
        $('.uc-close', el).addEventListener('click', function () { el.remove(); });
        window.requestAnimationFrame(function () { el.classList.add('is-in'); });
        return el;
    }

    /* --------------------------------------------------------- inline slots */

    /* The five inline positions a Dengage Inline campaign can target. They carry
       an edu prefix rather than the storefront's names on purpose: an inline
       campaign is targeted by selector and set to display on every URL, so
       sharing the storefront's selectors would put ecommerce creative on a
       college page the first time inline is switched on. */
    var INLINE_SLOTS = [
        { id: 'dn_inline_target_edu_below_header', label: 'Below the header', pages: 'every page' },
        { id: 'dn_inline_target_edu_below_hero', label: 'Below the hero', pages: 'home' },
        { id: 'dn_inline_target_edu_in_grid', label: 'Inside the subject grid', pages: 'academics' },
        { id: 'dn_inline_target_edu_subject_detail', label: 'On a subject, under the code', pages: 'academics' },
        { id: 'dn_inline_target_edu_above_footer', label: 'Above the footer', pages: 'every page' }
    ];

    function fillSlot(slot, html) {
        var host = document.getElementById(slot.id);
        if (!host) {
            window.EduSite.toast('The ' + slot.label.toLowerCase() + ' slot is not on this page');
            return false;
        }
        host.innerHTML = '<div class="uc-inline">' + html +
            '<button type="button" class="uc-close" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
        $('.uc-close', host).addEventListener('click', function () { host.innerHTML = ''; });
        host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }

    /* ------------------------------------------------------------- scenarios */

    function subjectsInApplication() {
        return window.Store.cart();
    }

    function firstShortlisted() {
        var list = window.Store.wishlist();
        return list.length ? list[0] : null;
    }

    function anySubject() {
        var lines = subjectsInApplication();
        if (lines.length) return window.EduJourney.subjectById(lines[0].id);
        var saved = firstShortlisted();
        if (saved) return window.EduJourney.subjectById(saved.id);
        var viewed = recall('last-subject');
        if (viewed) return window.EduJourney.subjectById(viewed);
        return content.subjects[0];
    }

    var SCENARIOS = {

        /* ------------------------------------------- the admissions funnel */

        'application-started': function () {
            var lines = subjectsInApplication();
            var names = lines.map(function (l) { return l.name; });
            card({
                motif: 'document',
                kicker: 'Admissions',
                title: names.length ? 'Your application is still open' : 'Start your application',
                body: names.length
                    ? '<p>You have <b>' + names.length + '</b> subject' + (names.length === 1 ? '' : 's') +
                      ' selected: ' + esc(names.join(', ')) + '. Applications are reviewed in the order they ' +
                      'are completed, so finishing today puts you ahead of the round.</p>'
                    : '<p>Pick the subject combination you want to study and your application is held for you ' +
                      'until you are ready to submit it.</p>',
                actions: names.length
                    ? [{ label: 'Finish my application', run: function () { window.location.href = 'apply.html'; } },
                       { label: 'Review subjects', run: function () { window.EduSite.openPanel('#application'); } }]
                    : [{ label: 'Browse subjects', run: function () { window.location.href = 'academics.html#subjects'; } }]
            });
        },

        'deadline-countdown': function () {
            var deadline = nextDeadline();
            var days = daysUntil(deadline);
            banner('<span class="uc-pill">Admissions</span>' +
                '<b>Round 2 closes in ' + days + ' day' + (days === 1 ? '' : 's') + '</b>' +
                '<span>Applications close on ' + esc(longDate(deadline)) + '. Seats are limited by design.</span>' +
                '<a class="btn btn-accent btn-sm" href="apply.html">Apply now</a>');
        },

        'document-reminder': function () {
            card({
                motif: 'document',
                kicker: 'Your application',
                title: 'One document is still outstanding',
                body: '<p>Your form is complete. Your <b>school leaving certificate</b> has not been uploaded ' +
                      'yet, and an application cannot move to screening without it.</p>' +
                      '<ul class="uc-list">' +
                      '<li>O Level result or Statement of Entry <span class="ok">Received</span></li>' +
                      '<li>B-Form or CNIC <span class="ok">Received</span></li>' +
                      '<li>School leaving certificate <span class="due">Outstanding</span></li>' +
                      '</ul>',
                actions: [{ label: 'Upload it now', run: function () { window.location.href = 'apply.html#documents'; } },
                          { label: 'Remind me tomorrow' }]
            });
        },

        'eligibility-checker': function () {
            formCard({
                motif: 'scholarship',
                kicker: 'Eligibility',
                title: 'Check where you stand',
                body: '<p>Answer two questions and the criteria on the how to apply page are applied to your ' +
                      'own result. Nothing is stored on this page.</p>',
                fields: [
                    { name: 'board', label: 'Your qualification', type: 'select',
                      options: ['O-Level', 'Matriculation', 'Federal Board', 'AKU-EB', 'Still appearing'] },
                    { name: 'passes', label: 'Passing grades achieved so far', type: 'number', value: '3' }
                ],
                submitLabel: 'Check eligibility',
                submit: function (values) {
                    var passes = Number(values.passes);
                    var appearing = values.board === 'Still appearing';
                    var meets = !appearing && isFinite(passes) && passes >= 3;
                    card({
                        motif: 'scholarship',
                        kicker: 'Eligibility',
                        title: appearing ? 'You qualify for a conditional offer'
                                         : (meets ? 'You meet the entry criteria' : 'You are close'),
                        body: appearing
                            ? '<p>Students awaiting final results apply with a Statement of Entry for the ' +
                              'subjects being taken. A conditional offer is granted now and confirmed when ' +
                              'your results arrive.</p>'
                            : (meets
                                ? '<p>Three passing grades at ' + esc(values.board) + ' meets the published ' +
                                  'requirement, so an unconditional offer is on the table. The next step is the ' +
                                  'orientation session.</p>'
                                : '<p>The published requirement is a minimum of three passing grades. Speak to ' +
                                  'admissions before you apply: a counselling session is the fastest way to find ' +
                                  'out what your options are.</p>'),
                        actions: meets || appearing
                            ? [{ label: 'Start my application', run: function () { window.location.href = 'apply.html'; } }]
                            : [{ label: 'Book a counselling session', run: function () { fire('counselling-booking'); }, keepOpen: false }]
                    });
                }
            });
        },

        'application-submitted': function () {
            var lines = subjectsInApplication();
            if (!lines.length) {
                card({
                    motif: 'document',
                    kicker: 'Admissions',
                    title: 'Nothing to submit yet',
                    body: '<p>Add a subject combination first, then this card submits the application and writes ' +
                          'the order and order detail rows a journey reads.</p>',
                    actions: [{ label: 'Browse subjects', run: function () { window.location.href = 'academics.html#subjects'; } }]
                });
                return;
            }
            var names = lines.map(function (l) { return l.name; }).join(', ');
            var result = window.EduJourney.submitApplication();
            card({
                motif: 'scholarship',
                kicker: 'Admissions',
                title: 'Application received',
                body: '<p>Your application for <b>' + esc(names) + '</b> is in. Your reference is ' +
                      '<b>' + esc(result ? result.orderId : '') + '</b>.</p>' +
                      '<p>Screening takes a few days. You will hear from us by email, and the same update ' +
                      'appears in your message inbox on this site.</p>',
                actions: [{ label: 'Open my messages', run: function () { window.EduSite.openPanel('#inbox'); } }]
            });
        },

        /* -------------------------------------------- discovery and shortlist */

        'browse-abandoned': function () {
            var subject = anySubject();
            card({
                kind: 'slidein',
                motif: subject.motif,
                kicker: 'Still deciding?',
                title: 'You were looking at ' + subject.name,
                body: '<p>' + esc(subject.name) + ' sits in the ' +
                      esc(window.EduJourney.facultyName(subject.faculty)) + ' pathway, syllabus ' +
                      esc(subject.id) + '. Shortlist it and it is waiting when you come back.</p>',
                actions: [{ label: 'Add to my application', run: function () { window.EduJourney.addSubject(subject.id); } },
                          { label: 'Shortlist it', run: function () { window.EduJourney.toggleShortlist(subject.id); } }]
            });
        },

        'shortlist-nudge': function () {
            var list = window.Store.wishlist();
            if (!list.length) {
                card({
                    kind: 'slidein',
                    motif: 'campus',
                    kicker: 'Shortlist',
                    title: 'Save the ones you like',
                    body: '<p>Shortlist a few subjects and this card becomes the nudge that turns a shortlist ' +
                          'into an application.</p>',
                    actions: [{ label: 'Browse subjects', run: function () { window.location.href = 'academics.html#subjects'; } }]
                });
                return;
            }
            card({
                kind: 'slidein',
                motif: 'document',
                kicker: 'Shortlist',
                title: list.length + ' subject' + (list.length === 1 ? '' : 's') + ' waiting on your shortlist',
                body: '<p>' + esc(list.map(function (item) { return item.name; }).join(', ')) +
                      '. A combination is normally three or four subjects, and applications are reviewed in ' +
                      'the order they are completed.</p>',
                actions: [{ label: 'Turn it into an application', run: function () {
                        list.forEach(function (item) { window.EduJourney.addSubject(item.id); });
                        window.EduSite.openPanel('#application');
                    } },
                    { label: 'See my shortlist', run: function () { window.EduSite.openPanel('#shortlist'); } }]
            });
        },

        'subject-search': function () {
            window.EduSite.openPanel('#search-panel');
            var input = $('#search-input');
            if (input) {
                input.value = 'psychology';
                window.EduJourney.runSearch(input.value);
                input.focus();
            }
        },

        'search-no-results': function () {
            window.EduSite.openPanel('#search-panel');
            var input = $('#search-input');
            if (input) {
                input.value = 'architecture';
                window.EduJourney.runSearch(input.value);
            }
        },

        'recommendations': function () {
            var subject = anySubject();
            var related = content.subjects.filter(function (candidate) {
                return candidate.faculty === subject.faculty && candidate.id !== subject.id;
            }).slice(0, 3);
            if (related.length < 3) {
                related = related.concat(content.subjects.filter(function (candidate) {
                    return candidate.faculty !== subject.faculty && related.indexOf(candidate) === -1;
                }).slice(0, 3 - related.length));
            }
            card({
                motif: subject.motif,
                kicker: 'Recommended for you',
                title: 'Students taking ' + subject.name + ' also take',
                body: '<div class="uc-rec">' + related.map(function (item) {
                    return '<button type="button" class="uc-rec-item" data-add-subject="' + esc(item.id) + '" data-keep-label="1">' +
                        window.EduArtwork.motif(item.motif) +
                        '<b>' + esc(item.name) + '</b>' +
                        '<span>' + esc(window.EduJourney.facultyName(item.faculty)) + '</span>' +
                        '</button>';
                }).join('') + '</div>' +
                '<p class="uc-note">Ranked here from the pathway structure. With the product feed connected, ' +
                'the same rail is ranked by the Dengage recommendation engine from what applicants actually do.</p>',
                actions: [{ label: 'See all subjects', run: function () { window.location.href = 'academics.html#subjects'; } }]
            });
        },

        /* ------------------------------------------- engagement and lifecycle */

        'prospectus-download': function () {
            formCard({
                motif: 'document',
                kicker: 'Prospectus',
                title: 'Get the 2026 prospectus',
                body: '<p>Subjects, pathways, societies, houses and the full admissions timetable in one ' +
                      'document. Tell us where to send it.</p>',
                fields: [
                    { name: 'name', label: 'Your name', placeholder: 'Full name' },
                    { name: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
                    { name: 'mobile', label: 'Mobile number', type: 'tel', placeholder: '03xx xxxxxxx', required: false }
                ],
                submitLabel: 'Send me the prospectus',
                submit: function (values) {
                    var key = window.EduJourney.ensureContactKey();
                    card({
                        motif: 'document',
                        kicker: 'Prospectus',
                        title: 'On its way to ' + values.email,
                        body: '<p>This browser is now attached to contact <b>' + esc(key || 'a new contact') +
                              '</b>, so everything it does from here builds one profile rather than an ' +
                              'anonymous trail.</p>'
                    });
                }
            });
        },

        'open-day-register': function () {
            var deadline = nextDeadline();
            formCard({
                motif: 'calendar',
                kicker: 'Open Day',
                title: 'Reserve a place on campus',
                body: '<p>Walk the labs and the library, sit in on a live class, and meet the faculty who ' +
                      'teach the combination you are considering.</p>',
                fields: [
                    { name: 'name', label: 'Your name', placeholder: 'Full name' },
                    { name: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
                    { name: 'session', label: 'Which session', type: 'select',
                      options: [longDate(deadline) + ', morning', longDate(deadline) + ', afternoon'] },
                    { name: 'guests', label: 'Coming with', type: 'select',
                      options: ['Just me', 'One parent or guardian', 'Two parents or guardians'] }
                ],
                submitLabel: 'Reserve my place',
                submit: function (values) {
                    window.EduJourney.ensureContactKey();
                    card({
                        motif: 'calendar',
                        kicker: 'Open Day',
                        title: 'Your place is held',
                        body: '<p>' + esc(values.session) + '. A reminder lands the day before, and again on ' +
                              'the morning, by whichever channel this contact prefers.</p>',
                        actions: [{ label: 'Add to my messages', run: function () { window.EduSite.openPanel('#inbox'); } }]
                    });
                }
            });
        },

        'counselling-booking': function () {
            formCard({
                motif: 'counselling',
                kicker: 'Counselling',
                title: 'Book a counselling session',
                body: '<p>Three pillars, one to one, and confidential. Pick the one that fits and a counsellor ' +
                      'confirms the slot.</p>',
                fields: [
                    { name: 'pillar', label: 'Which kind of session', type: 'select',
                      options: ['Career counselling', 'Academic counselling', 'Well-being counselling'] },
                    { name: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
                    { name: 'slot', label: 'Preferred time', type: 'select',
                      options: ['This week, morning', 'This week, afternoon', 'Next week, morning', 'Next week, afternoon'] }
                ],
                submitLabel: 'Request this session',
                submit: function (values) {
                    window.EduJourney.ensureContactKey();
                    card({
                        motif: 'counselling',
                        kicker: 'Counselling',
                        title: 'Requested',
                        body: '<p>' + esc(values.pillar) + ', ' + esc(values.slot.toLowerCase()) +
                              '. You will get a confirmation with the counsellor and the room.</p>',
                        actions: [{ label: 'How counselling works', run: function () { window.location.href = 'counselling.html'; } }]
                    });
                }
            });
        },

        'scholarship-nudge': function () {
            var list = content.scholarships.filter(function (item) { return item.id !== 'financial-aid'; });
            card({
                motif: 'scholarship',
                kicker: 'Scholarships',
                title: 'Four ways to be awarded a scholarship',
                body: '<p>Every one is awarded on merit, achievement and demonstrated potential. Applications ' +
                      'for the current round close with admissions.</p>' +
                      '<ul class="uc-list">' + list.map(function (item) {
                          return '<li>' + esc(item.name) + '</li>';
                      }).join('') + '</ul>',
                actions: [{ label: 'Read the criteria', run: function () { window.location.href = 'admissions.html#scholarships'; } },
                          { label: 'Talk to admissions', run: function () { fire('counselling-booking'); } }]
            });
        },

        'winback': function () {
            var started = Number(recall('application-started') || 0);
            var days = started ? Math.max(1, Math.round((Date.now() - started) / 86400000)) : 6;
            card({
                motif: 'campus',
                kicker: 'We saved your place',
                title: 'Your application has been open for ' + days + ' day' + (days === 1 ? '' : 's'),
                body: '<p>Nothing has been lost. Your subjects, your documents and your answers are exactly ' +
                      'where you left them, and the round is still open.</p>' +
                      '<p>If something is holding you up, a ten minute counselling call is usually all it takes.</p>',
                actions: [{ label: 'Pick up where I left off', run: function () { window.location.href = 'apply.html'; } },
                          { label: 'Book a call', run: function () { fire('counselling-booking'); } }]
            });
        },

        /* ------------------------------------------------ channel demonstrations */

        'app-inbox': function () {
            window.EduSite.openPanel('#inbox');
            if (window.Inbox) window.Inbox.refresh();
        },

        'push-permission': function () {
            if (!window.DengageEvents.pushSupported()) {
                window.EduSite.toast('This browser does not support web push');
                return;
            }
            window.DengageEvents.pushPrompt();
            window.EduSite.toast('The browser is asking for notification permission');
        },

        'push-status': function () {
            window.DengageEvents.reference(function (info) {
                card({
                    motif: 'calendar',
                    kicker: 'Web push',
                    title: 'This device, as Dengage sees it',
                    body: '<dl class="uc-dl">' +
                        '<dt>Permission</dt><dd>' + esc(window.DengageEvents.pushStatus()) + '</dd>' +
                        '<dt>Push token</dt><dd>' + esc(info.pushToken || 'not available yet') + '</dd>' +
                        '<dt>Device id</dt><dd>' + esc(info.deviceId || 'not available yet') + '</dd>' +
                        '<dt>Contact key</dt><dd>' + esc(info.contactKey || 'anonymous') + '</dd>' +
                        '</dl>' +
                        '<p class="uc-note">A token appears only once the browser has granted permission. ' +
                        'Sending a notification is a server side action, so it comes from a campaign or a ' +
                        'journey rather than from this page.</p>'
                });
            });
        },

        'nps': function () {
            var scores = '';
            for (var n = 0; n <= 10; n++) {
                scores += '<button type="button" class="uc-score" data-score="' + n + '">' + n + '</button>';
            }
            card({
                motif: 'counselling',
                kicker: 'After your session',
                title: 'How likely are you to recommend us?',
                body: '<div class="uc-scale">' + scores + '</div>' +
                      '<div class="uc-scale-legend"><span>Not at all likely</span><span>Extremely likely</span></div>',
                wire: function (el) {
                    $$('.uc-score', el).forEach(function (button) {
                        button.addEventListener('click', function () {
                            var score = Number(button.getAttribute('data-score'));
                            el.remove();
                            card({
                                motif: 'counselling',
                                kicker: 'Thank you',
                                title: score >= 9 ? 'That means a lot' : 'Thank you for telling us',
                                body: score >= 9
                                    ? '<p>Would you say the same thing to a friend deciding where to apply? ' +
                                      'A one line review helps more than you would think.</p>'
                                    : '<p>Your answer goes to the counselling team. If something specific went ' +
                                      'wrong, tell us and somebody will pick it up personally.</p>'
                            });
                        });
                    });
                }
            });
        },

        'survey': function () {
            formCard({
                motif: 'document',
                kicker: 'Two questions',
                title: 'What matters most in your decision?',
                body: '<p>Two questions, and the answers shape what we send you next rather than sitting in a ' +
                      'report nobody reads.</p>',
                fields: [
                    { name: 'priority', label: 'What matters most to you', type: 'select',
                      options: ['Results and faculty', 'University placement', 'Societies and campus life',
                                'Scholarships and fees', 'Location and commute'] },
                    { name: 'stage', label: 'Where are you in deciding', type: 'select',
                      options: ['Just looking', 'Shortlisting colleges', 'Ready to apply', 'Already applied'] }
                ],
                submitLabel: 'Send my answers',
                submit: function (values) {
                    card({
                        motif: 'document',
                        kicker: 'Thank you',
                        title: 'Noted',
                        body: '<p>You said <b>' + esc(values.priority.toLowerCase()) + '</b> matters most and you are ' +
                              '<b>' + esc(values.stage.toLowerCase()) + '</b>. That is enough to stop sending you ' +
                              'everything and start sending you the right thing.</p>'
                    });
                }
            });
        }
    };

    /* --------------------------------------------------- the inline five */

    INLINE_SLOTS.forEach(function (slot, index) {
        SCENARIOS['inline-' + slot.id.replace('dn_inline_target_edu_', '').replace(/_/g, '-')] = function () {
            var deadline = nextDeadline();
            var messages = [
                '<b>Admissions are open.</b> <span>Round 2 closes on ' + esc(longDate(deadline)) +
                    '.</span> <a class="btn btn-primary btn-sm" href="apply.html">Apply now</a>',
                '<b>Open Day, ' + esc(longDate(deadline)) + '.</b> <span>Walk the campus and sit in on a live class.</span>' +
                    ' <a class="btn btn-primary btn-sm" href="admissions.html">Reserve a place</a>',
                '<b>Not sure which combination?</b> <span>A counselling session settles it in ten minutes.</span>' +
                    ' <a class="btn btn-primary btn-sm" href="counselling.html">Book counselling</a>',
                '<b>Scholarships are open.</b> <span>Academic, Sports, Talent and Huffaz, all awarded on merit.</span>' +
                    ' <a class="btn btn-primary btn-sm" href="admissions.html#scholarships">See the criteria</a>',
                '<b>Questions before you apply?</b> <span>Admissions answer within one working day.</span>' +
                    ' <a class="btn btn-primary btn-sm" href="contact.html">Contact admissions</a>'
            ];
            fillSlot(slot, messages[index]);
        };
    });

    /* --------------------------------------------------------------- firing */

    function fire(name) {
        var run = SCENARIOS[name];
        if (!run) return;
        /* The data layer event first, so a campaign built for this name later
           answers the same button without this file changing. */
        window.DengageEvents.scenario(name);
        try {
            run();
        } catch (error) {
            if (window.console) console.error('[demo] scenario ' + name + ' failed', error);
            window.EduSite.toast('That scenario could not be shown. The console has the reason.');
        }
    }

    /* ------------------------------------------------------------- the panel */

    var GROUPS = [
        {
            title: 'Admissions funnel',
            cards: [
                { id: 'application-started', name: 'Application started, not submitted', note: 'The rescue message for a half finished application.' },
                { id: 'deadline-countdown', name: 'Round closing countdown', note: 'A banner that counts down to the next deadline.' },
                { id: 'document-reminder', name: 'Missing document reminder', note: 'One item outstanding, named, with the rest ticked off.' },
                { id: 'eligibility-checker', name: 'Eligibility checker', note: 'Two questions, then the published criteria applied to the answer.' },
                { id: 'application-submitted', name: 'Application submitted', note: 'Writes the order and order detail rows a journey reads.' }
            ]
        },
        {
            title: 'Discovery and shortlist',
            cards: [
                { id: 'browse-abandoned', name: 'Subject browse abandonment', note: 'The subject this visitor last looked at, brought back.' },
                { id: 'shortlist-nudge', name: 'Shortlist nudge', note: 'Turns a saved shortlist into a started application.' },
                { id: 'subject-search', name: 'Subject search', note: 'A search that finds something, recorded as a search event.' },
                { id: 'search-no-results', name: 'Search with no results', note: 'The most useful search of all: what somebody wanted and we do not offer.' },
                { id: 'recommendations', name: 'Related subjects rail', note: 'Students taking this also take, from the pathway structure.' }
            ]
        },
        {
            title: 'Engagement and lifecycle',
            cards: [
                { id: 'prospectus-download', name: 'Prospectus download', note: 'Lead capture that identifies the contact before it submits.' },
                { id: 'open-day-register', name: 'Open day registration', note: 'A dated event with a reminder behind it.' },
                { id: 'counselling-booking', name: 'Counselling session booking', note: 'Career, academic or well-being, booked from any page.' },
                { id: 'scholarship-nudge', name: 'Scholarship eligibility nudge', note: 'The four awards, in front of somebody who is deciding.' },
                { id: 'winback', name: 'Dormant applicant win-back', note: 'Nothing lost, the round is still open.' }
            ]
        },
        {
            title: 'Channels',
            cards: [
                { id: 'app-inbox', name: 'App Inbox', note: 'The messages Dengage is holding for this device.' },
                { id: 'push-permission', name: 'Web push permission', note: 'Raises the browser prompt. Only a server can send the notification.' },
                { id: 'push-status', name: 'Push and device status', note: 'Token, device id and contact key, as Dengage sees them.' },
                { id: 'nps', name: 'NPS after a counselling session', note: 'Zero to ten, with a different follow up either side of nine.' },
                { id: 'survey', name: 'Applicant survey', note: 'Two questions that change what gets sent next.' }
            ]
        },
        {
            title: 'Inline content slots',
            note: 'Five positions an Inline campaign can target on this site.',
            cards: INLINE_SLOTS.map(function (slot) {
                return {
                    id: 'inline-' + slot.id.replace('dn_inline_target_edu_', '').replace(/_/g, '-'),
                    name: slot.label,
                    note: slot.pages + ' | #' + slot.id
                };
            })
        }
    ];

    function panelMarkup() {
        var prefix = ((window.DEMO_CONFIG || {}).dengage || {}).scenarioPrefix || 'demo_dengage_edu_';
        return '<div class="launcher-head">' +
                '<h2>Dengage scenarios</h2>' +
                '<button type="button" class="icon-btn" id="launcher-close" aria-label="Close">' +
                '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
            '</div>' +
            '<div class="launcher-body">' +
            GROUPS.map(function (group) {
                return '<div class="launcher-group"><h3>' + esc(group.title) + '</h3>' +
                    (group.note ? '<p class="launcher-note">' + esc(group.note) + '</p>' : '') +
                    group.cards.map(function (item) {
                        return '<button type="button" class="launcher-card" data-scenario="' + esc(item.id) + '">' +
                            '<b>' + esc(item.name) + '</b>' +
                            '<span>' + esc(item.note) + '</span>' +
                            '<code>' + esc(prefix + item.id) + '</code>' +
                        '</button>';
                    }).join('') + '</div>';
            }).join('') +
            '</div>' +
            '<div class="launcher-foot">' +
                '<details><summary>Quick reference</summary><dl id="launcher-reference">' +
                '<dt>Loading</dt><dd>reading this device</dd></dl></details>' +
            '</div>';
    }

    function copyButton(value) {
        if (!value || value === 'not available yet') return '';
        return '<button type="button" class="link-btn" data-copy-value="' + esc(value) + '">Copy</button>';
    }

    function fillReference() {
        var host = $('#launcher-reference');
        if (!host) return;
        window.DengageEvents.reference(function (info) {
            host.innerHTML =
                '<dt>Contact key</dt><dd>' + esc(info.contactKey || 'anonymous') + copyButton(info.contactKey) + '</dd>' +
                '<dt>Device id</dt><dd>' + esc(info.deviceId || 'not available yet') + copyButton(info.deviceId) + '</dd>' +
                '<dt>Session id</dt><dd>' + esc(info.sessionId || 'not available yet') + copyButton(info.sessionId) + '</dd>' +
                '<dt>Push token</dt><dd>' + esc(info.pushToken || 'not available yet') + copyButton(info.pushToken) + '</dd>' +
                '<dt>Application</dt><dd>' + esc(info.appGuid || 'not configured') + '</dd>' +
                '<dt>Page url</dt><dd>' + esc(info.demoUrl || '') + '</dd>';
        });
    }

    function build() {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'launcher-btn';
        button.id = 'launcher-btn';
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12z"/></svg> Dengage scenarios';

        var panel = document.createElement('div');
        panel.className = 'launcher';
        panel.id = 'launcher';
        panel.innerHTML = panelMarkup();

        document.body.appendChild(button);
        document.body.appendChild(panel);

        button.addEventListener('click', function () {
            panel.classList.add('is-open');
            button.hidden = true;
            fillReference();
        });
        $('#launcher-close').addEventListener('click', function () {
            panel.classList.remove('is-open');
            button.hidden = false;
        });
        panel.addEventListener('click', function (event) {
            var scenarioCard = event.target.closest ? event.target.closest('[data-scenario]') : null;
            if (scenarioCard) {
                fire(scenarioCard.getAttribute('data-scenario'));
                return;
            }
            var copy = event.target.closest ? event.target.closest('[data-copy-value]') : null;
            if (copy && window.navigator.clipboard) {
                window.navigator.clipboard.writeText(copy.getAttribute('data-copy-value'));
                copy.textContent = 'Copied';
                window.setTimeout(function () { copy.textContent = 'Copy'; }, 1500);
            }
        });
    }

    function init(loadedContent) {
        content = loadedContent;
        build();
        if (!recall('application-started') && window.Store.cart().length) {
            remember('application-started', Date.now());
        }
    }

    window.EduUseCases = {
        init: init,
        fire: fire,
        scenarios: function () { return Object.keys(SCENARIOS); },
        groups: GROUPS,
        inlineSlots: INLINE_SLOTS,
        remember: remember
    };
})(window, document);
