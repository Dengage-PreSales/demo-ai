/* Everything a page repeats, rendered from content.json.

   The pages are ordinary HTML and keep their own section order, headings and
   prose. What they do not carry is the twenty fourth copy of a faculty card, so
   each collection is marked with data-render and filled in here. One correction
   to a subject list reaches every page that shows subjects.

   Nothing in here talks to Dengage. The buttons it draws carry data attributes,
   and js/edu-journey.js owns what those attributes mean. */
(function (window, document) {
    'use strict';

    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var esc = function (value) { return window.EduSite.esc(value); };

    var content = null;
    var art = null;

    function facultyName(id) {
        var found = content.faculties.filter(function (f) { return f.id === id; })[0];
        return found ? found.name : id;
    }

    /* The subject page is one file serving sixteen subjects. */
    function currentSubject() {
        var id = new URLSearchParams(window.location.search).get('id');
        var list = content.subjects.filter(function (subject) { return String(subject.id) === String(id); });
        return list[0] || null;
    }

    /* ------------------------------------------------------------- renderers */

    var RENDER = {

        'hero-art': function (host) {
            host.innerHTML = art.heroScene();
        },

        'campus-art': function (host) {
            host.innerHTML = art.campusArt();
        },

        pathways: function (host) {
            host.innerHTML = content.faculties.map(function (item) {
                return '<article class="card pathway">' +
                    '<div class="card-art">' + art.scene('pathway-' + item.id) + '</div>' +
                    '<h3>' + esc(item.name) + '</h3>' +
                    '<p>' + esc(item.blurb) + '</p>' +
                    '<a class="btn btn-ghost btn-sm" href="academics.html#subjects">See the subjects</a>' +
                '</article>';
            }).join('');
        },

        subjects: function (host) {
            var filter = host.getAttribute('data-filter') || 'all';
            var list = content.subjects.filter(function (subject) {
                return filter === 'all' || subject.faculty === filter;
            });
            host.innerHTML = list.map(function (subject) {
                return '<article class="card subject-card" id="subject-' + esc(subject.id) + '">' +
                    '<span class="motif">' + art.motif(subject.motif) + '</span>' +
                    '<div>' +
                        '<h3><a href="product.html?id=' + encodeURIComponent(subject.id) + '">' +
                            esc(subject.name) + '</a></h3>' +
                        '<div class="subject-code">Syllabus ' + esc(subject.id) + '</div>' +
                    '</div>' +
                    '<div class="subject-meta"><span class="tag">' + esc(facultyName(subject.faculty)) + '</span></div>' +
                    '<div class="subject-actions">' +
                        '<button type="button" class="btn btn-primary btn-sm" data-add-subject="' + esc(subject.id) + '" data-label="Add to application">Add to application</button>' +
                        '<button type="button" class="btn btn-ghost btn-sm" data-shortlist-toggle="' + esc(subject.id) + '">Shortlist</button>' +
                    '</div>' +
                '</article>';
            }).join('');
        },

        'subject-filter': function (host) {
            var target = document.querySelector('[data-render="subjects"]');
            var options = [{ id: 'all', name: 'All subjects' }].concat(content.faculties);
            host.innerHTML = options.map(function (option, index) {
                return '<button type="button" class="chip ' + (index === 0 ? 'is-active' : '') +
                    '" data-faculty="' + esc(option.id) + '">' + esc(option.name) + '</button>';
            }).join('');
            host.addEventListener('click', function (event) {
                var chip = event.target.closest ? event.target.closest('[data-faculty]') : null;
                if (!chip || !target) return;
                $$('.chip', host).forEach(function (other) { other.classList.remove('is-active'); });
                chip.classList.add('is-active');
                target.setAttribute('data-filter', chip.getAttribute('data-faculty'));
                RENDER.subjects(target);
                window.EduJourney.paint();
            });
        },

        faculty: function (host) {
            var limit = Number(host.getAttribute('data-limit') || 0);
            var list = limit ? content.faculty.slice(0, limit) : content.faculty;
            host.innerHTML = list.map(function (person) {
                return '<article class="person">' +
                    '<div class="portrait">' + art.portrait(person.name) + '</div>' +
                    '<h4>' + esc(person.name) + '</h4>' +
                    '<span>' + esc(person.subject) + '</span>' +
                '</article>';
            }).join('');
        },

        directors: function (host) {
            host.innerHTML = content.directors.map(function (person) {
                return '<article class="card">' +
                    '<div style="display:flex;gap:16px;align-items:center;margin-bottom:14px">' +
                        '<div style="width:74px;flex:0 0 74px">' + art.portrait(person.name) + '</div>' +
                        '<div><h3 style="margin:0;font-size:20px">' + esc(person.name) + '</h3>' +
                        '<span class="tag">' + esc(person.role) + '</span></div>' +
                    '</div>' +
                    '<p>' + esc(person.message) + '</p>' +
                '</article>';
            }).join('');
        },

        programs: function (host) {
            host.innerHTML = '<div class="accordion">' + content.programs.map(function (program, index) {
                return '<div class="accordion-item' + (index === 0 ? ' is-open' : '') + '">' +
                    '<button type="button" class="accordion-head" aria-expanded="' + (index === 0 ? 'true' : 'false') + '">' +
                        esc((index + 1) + '. ' + program.title) +
                        '<span class="sign">' + (index === 0 ? '-' : '+') + '</span>' +
                    '</button>' +
                    '<div class="accordion-body">' +
                        '<p>' + esc(program.summary) + '</p>' +
                        '<h4>What will you learn?</h4><p>' + esc(program.learn) + '</p>' +
                        '<h4>What will you walk away with?</h4><p>' + esc(program.outcome) + '</p>' +
                    '</div>' +
                '</div>';
            }).join('') + '</div>';
            window.EduSite.wireAccordions(host);
        },

        scholarships: function (host) {
            host.innerHTML =
                '<div data-tabs><div class="tabs">' + content.scholarships.map(function (item, index) {
                    return '<button type="button" class="tab' + (index === 0 ? ' is-active' : '') + '">' +
                        esc(item.name) + '</button>';
                }).join('') + '</div>' +
                content.scholarships.map(function (item, index) {
                    return '<div class="tab-panel"' + (index === 0 ? '' : ' hidden') + '>' +
                        '<h3>' + esc(item.name) + ' Scholarship</h3><p>' + esc(item.blurb) + '</p></div>';
                }).join('') + '</div>';
            window.EduSite.wireTabs(host);
        },

        'admission-steps': function (host) {
            host.innerHTML =
                '<div data-tabs><div class="tabs">' + content.admissionSteps.map(function (item, index) {
                    return '<button type="button" class="tab' + (index === 0 ? ' is-active' : '') + '">' +
                        esc(item.step) + '</button>';
                }).join('') + '</div>' +
                content.admissionSteps.map(function (item, index) {
                    return '<div class="tab-panel"' + (index === 0 ? '' : ' hidden') + '>' +
                        '<h3>' + esc(item.title) + '</h3><ol>' +
                        item.points.map(function (point) { return '<li>' + esc(point) + '</li>'; }).join('') +
                        '</ol></div>';
                }).join('') + '</div>';
            window.EduSite.wireTabs(host);
        },

        criteria: function (host) {
            host.innerHTML = '<ul class="timeline">' + content.criteria.map(function (item) {
                var parts = item.split(': ');
                return '<li><h4>' + esc(parts[0]) + '</h4><p>' + esc(parts.slice(1).join(': ')) + '</p></li>';
            }).join('') + '</ul>';
        },

        eligibility: function (host) {
            host.innerHTML = content.eligibility.map(function (item) {
                return '<article class="card"><h3>' + esc(item.title) + '</h3><p>' + esc(item.detail) + '</p></article>';
            }).join('');
        },

        counselling: function (host) {
            host.innerHTML = content.counselling.map(function (item) {
                return '<article class="card">' +
                    '<span class="motif" style="display:block;width:44px;height:44px;color:var(--primary);margin-bottom:12px">' +
                        art.motif('counselling') + '</span>' +
                    '<h3>' + esc(item.name) + '</h3><p>' + esc(item.blurb) + '</p>' +
                '</article>';
            }).join('');
        },

        societies: function (host) {
            host.innerHTML = content.societies.map(function (item) {
                return '<article class="card">' +
                    '<div class="card-art">' + art.scene('society-' + item.id, 'wide') + '</div>' +
                    '<h3>' + esc(item.name) + '</h3><p>' + esc(item.blurb) + '</p>' +
                '</article>';
            }).join('');
        },

        houses: function (host) {
            host.innerHTML = content.houses.map(function (house) {
                return '<article class="badge">' +
                    '<div class="crest">' + art.crest(house.id, house.name) + '</div>' +
                    '<h3>' + esc(house.name) + '</h3>' +
                    '<div class="mentor">' + esc(house.mentor) + ', mentor</div>' +
                    '<p>' + esc(house.creed) + '</p>' +
                '</article>';
            }).join('');
        },

        'house-rules': function (host) {
            host.innerHTML = content.houseRules.map(function (item) {
                return '<article class="card"><h3>' + esc(item.title) + '</h3><p>' + esc(item.blurb) + '</p></article>';
            }).join('');
        },

        showcase: function (host) {
            host.innerHTML = content.showcase.map(function (item) {
                return '<article class="card">' +
                    '<div class="card-art">' + art.scene('showcase-' + item.id, 'wide') + '</div>' +
                    '<h3>' + esc(item.name) + '</h3><p>' + esc(item.blurb) + '</p>' +
                '</article>';
            }).join('');
        },

        news: function (host) {
            var limit = Number(host.getAttribute('data-limit') || 0);
            var list = limit ? content.news.slice(0, limit) : content.news;
            host.innerHTML = list.map(function (post) {
                return '<article class="card post-card">' +
                    '<div class="card-art">' + art.scene('news-' + post.id, 'wide') + '</div>' +
                    '<div class="post-body">' +
                        '<div class="post-date">' + esc(post.date) + ' | ' + esc(post.kicker) + '</div>' +
                        '<h3>' + esc(post.title) + '</h3>' +
                        '<p>' + esc(post.summary) + '</p>' +
                        '<a class="btn btn-ghost btn-sm" href="post.html?id=' + encodeURIComponent(post.id) + '">Read more</a>' +
                    '</div>' +
                '</article>';
            }).join('');
        },

        post: function (host) {
            var id = new URLSearchParams(window.location.search).get('id');
            var post = content.news.filter(function (item) { return item.id === id; })[0] || content.news[0];
            document.title = post.title + ' | Dengage Education Demo';
            var titleHost = document.getElementById('post-title');
            if (titleHost) titleHost.textContent = post.title;
            var crumbHost = document.getElementById('post-crumb');
            if (crumbHost) crumbHost.textContent = post.title;
            host.innerHTML =
                '<div class="post-hero-art">' + art.scene('news-' + post.id, 'wide') + '</div>' +
                '<div class="post-date">' + esc(post.date) + ' | ' + esc(post.kicker) + '</div>' +
                '<p class="lede">' + esc(post.summary) + '</p>' +
                '<p>' + esc(post.body) + '</p>';
        },

        subject: function (host) {
            var subject = currentSubject();
            if (!subject) {
                host.innerHTML = '<p class="empty">That subject is not in this year\'s list. ' +
                    '<a href="academics.html#subjects">See what is offered</a>.</p>';
                return;
            }
            document.title = subject.name + ' | Dengage Education Demo';
            ['subject-title', 'subject-crumb'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.textContent = subject.name;
            });

            var teachers = content.faculty.filter(function (person) {
                return person.subject === subject.name;
            });

            host.innerHTML =
                '<div class="split">' +
                    '<div>' +
                        '<span class="tag">' + esc(facultyName(subject.faculty)) + '</span>' +
                        '<h2 style="margin-top:14px">' + esc(subject.name) + '</h2>' +
                        '<div class="subject-code">Cambridge syllabus ' + esc(subject.id) + '</div>' +
                        '<p style="margin-top:18px">' + esc(subject.name) + ' sits in the ' +
                            esc(facultyName(subject.faculty)) + ' pathway. It is taught across two years, ' +
                            'AS in the first and A2 in the second, and it is examined to the Cambridge ' +
                            'International standard.</p>' +
                        '<p>Pair it with two or three other subjects to make a combination. The ' +
                            'counselling team will talk through what your intended degree actually ' +
                            'requires before you commit.</p>' +
                        '<div class="subject-actions">' +
                            '<button type="button" class="btn btn-primary" data-add-subject="' + esc(subject.id) +
                                '" data-label="Add to application">Add to application</button>' +
                            '<button type="button" class="btn btn-ghost" data-shortlist-toggle="' + esc(subject.id) +
                                '">Shortlist</button>' +
                        '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div class="card">' +
                            '<span class="motif" style="display:block;width:56px;height:56px;color:var(--primary);margin-bottom:14px">' +
                                art.motif(subject.motif) + '</span>' +
                            '<h3>Who teaches it</h3>' +
                            (teachers.length
                                ? '<div class="rail" style="padding-bottom:6px">' + teachers.map(function (person) {
                                      return '<article class="person" style="flex:0 0 170px">' +
                                          '<div class="portrait">' + art.portrait(person.name) + '</div>' +
                                          '<h4>' + esc(person.name) + '</h4>' +
                                          '<span>' + esc(person.subject) + '</span></article>';
                                  }).join('') + '</div>'
                                : '<p>Faculty for this subject are confirmed at the start of the session.</p>') +
                        '</div>' +
                    '</div>' +
                '</div>';

            window.EduUseCases.remember('last-subject', subject.id);
        },

        'subject-related': function (host) {
            var subject = currentSubject();
            if (!subject) { host.innerHTML = ''; return; }
            var related = content.subjects.filter(function (candidate) {
                return candidate.faculty === subject.faculty && candidate.id !== subject.id;
            }).slice(0, 3);
            host.innerHTML = related.map(function (item) {
                return '<article class="card subject-card">' +
                    '<span class="motif">' + art.motif(item.motif) + '</span>' +
                    '<div><h3>' + esc(item.name) + '</h3>' +
                    '<div class="subject-code">Syllabus ' + esc(item.id) + '</div></div>' +
                    '<div class="subject-actions">' +
                        '<a class="btn btn-ghost btn-sm" href="product.html?id=' + encodeURIComponent(item.id) + '">Read more</a>' +
                        '<button type="button" class="btn btn-primary btn-sm" data-add-subject="' + esc(item.id) +
                            '" data-label="Add">Add</button>' +
                    '</div>' +
                '</article>';
            }).join('');
        },

        faqs: function (host) {
            host.innerHTML = '<div class="accordion">' + content.faqs.map(function (item, index) {
                return '<div class="accordion-item' + (index === 0 ? ' is-open' : '') + '">' +
                    '<button type="button" class="accordion-head" aria-expanded="' + (index === 0 ? 'true' : 'false') + '">' +
                        esc(item.q) + '<span class="sign">' + (index === 0 ? '-' : '+') + '</span></button>' +
                    '<div class="accordion-body"><p>' + esc(item.a) + '</p></div>' +
                '</div>';
            }).join('') + '</div>';
            window.EduSite.wireAccordions(host);
        },

        testimonials: function (host) {
            host.innerHTML = content.testimonials.map(function (item) {
                return '<blockquote class="quote">' +
                    '<p>"' + esc(item.quote) + '"</p>' +
                    '<footer><b>' + esc(item.name) + '</b>' + esc(item.role) + '</footer>' +
                '</blockquote>';
            }).join('');
        },

        universities: function (host) {
            host.innerHTML = '<ul class="uni-list">' + content.universities.map(function (name) {
                return '<li>' + esc(name) + '</li>';
            }).join('') + '</ul>';
        },

        media: function (host) {
            host.innerHTML = content.media.map(function (item) {
                return '<article class="card media-card">' +
                    '<div class="card-art">' + art.scene('media-' + item.id, 'wide') +
                        '<span class="play"><span>&#9658;</span></span></div>' +
                    '<div class="media-body"><span class="tag">' + esc(item.kicker) + '</span>' +
                    '<h3>' + esc(item.title) + '</h3></div>' +
                '</article>';
            }).join('');
        },

        'clash-body': function (host) {
            host.innerHTML = content.clash.body.map(function (para) {
                return '<p>' + esc(para) + '</p>';
            }).join('');
        }
    };

    function render(loadedContent) {
        content = loadedContent;
        art = window.EduArtwork;
        $$('[data-render]').forEach(function (host) {
            var name = host.getAttribute('data-render');
            var fn = RENDER[name];
            if (!fn) return;
            try {
                fn(host);
            } catch (error) {
                if (window.console) console.error('[demo] could not render ' + name, error);
            }
        });
    }

    window.EduPages = { render: render };
})(window, document);
