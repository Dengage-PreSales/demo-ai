#!/usr/bin/env python3
"""Write the pages of the education demo from one shell.

    python3 factory/education/build-pages.py

WHY A GENERATOR AND NOT THIRTEEN HAND WRITTEN FILES. Every page carries the same
head, the same overlays and the same script order, and the script order is load
bearing: js/identity.js has to resolve the contact key before the SDK snippet
initializes with it, and js/dengageEvents.js has to be present on every page or
the page view never fires and that page's rows can never be attributed to this
demo. Thirteen copies of that maintained by hand is thirteen chances to get it
wrong once and never notice.

So the shell lives here and the pages below are only their own content.

This writes into demos/meridian-college/ and nothing else. It never touches
template/, the storefront demos, or anything in factory/ other than itself.
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'demos', 'meridian-college')
ACCOUNT_ID = '28'
APP_GUID = '99d9b8fb-0c62-5a85-3e43-2402554d93a5'
SLUG = 'meridian-college'

SHELL = '''<!DOCTYPE html>
<html lang="en" data-demo-slug="{slug}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{description}">

<!--
    THE DENGAGE EDUCATION DEMO. A working college website for a conversation
    about personalization on an education account.

    It is a demonstration, not a live college. The institution, its staff and its
    students are fictional, every portrait is drawn rather than photographed, and
    the mark in the header is the Dengage one.

    ORDER IN THE HEAD IS LOAD BEARING:
      1. js/identity.js resolves the contact key synchronously and sets __dnInit
      2. the SDK snippet initializes WITH that key, so the contact is attached
         before any event goes out
      3. the page view fires later, from js/dengageEvents.js, through
         js/edu-site.js

    The page view is what makes this demo's rows findable. The SDK fills page_url
    and session_id on that row itself, and session_id is the only join from it to
    the application, shortlist and search rows the same visit writes.
-->

<link rel="icon" href="vendor/assets/dengage-logo.svg" type="image/svg+xml">

<!-- Scripts before stylesheets. A pending stylesheet blocks every script after
     it, and the font request below goes to a third party, so with it above these
     the Dengage bootstrap would wait on Google Fonts: slow on a bad network and
     indefinite on a network that blocks it. Neither script reads a style. -->
<script src="js/identity.js"></script>

<!-- DENGAGE SDK START -->
<script>
  (function (window, document) {{
    window.dengage = window.dengage || function () {{
      (window.dengage.q = window.dengage.q || []).push(arguments);
    }};
    var accountId = '{account}';
    var appGuid = '{guid}';
    if (accountId.indexOf('__') !== 0 && appGuid.indexOf('__') !== 0) {{
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://pcdn.dengage.com/p/push/' + accountId + '/' + appGuid + '/dengage_sdk_loader.js';
      document.getElementsByTagName('head')[0].appendChild(script);
    }}
    window.__dnInit ? window.dengage('initialize', window.__dnInit) : window.dengage('initialize');
  }})(window, document);
</script>
<!-- DENGAGE SDK END -->

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body data-page-type="{page_type}"{body_attrs}>

<div id="site-chrome-top"></div>
<div class="inline-slot container" id="dn_inline_target_edu_below_header"></div>

{main}

<div class="inline-slot container" id="dn_inline_target_edu_above_footer"></div>
<div id="site-chrome-bottom"></div>

<div class="scrim" id="scrim"></div>

<aside class="drawer" id="application" aria-label="Your application">
    <div class="drawer-head">
        <h2>Your application</h2>
        <button type="button" class="icon-btn" data-close="1" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
    </div>
    <div class="drawer-body" id="application-body"></div>
    <div class="drawer-foot" id="application-foot" hidden>
        <button type="button" class="btn btn-primary btn-block" data-start-application="1">Start my application</button>
    </div>
</aside>

<aside class="drawer" id="shortlist" aria-label="Shortlist">
    <div class="drawer-head">
        <h2>Your shortlist</h2>
        <button type="button" class="icon-btn" data-close="1" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
    </div>
    <div class="drawer-body" id="shortlist-body"></div>
</aside>

<aside class="drawer" id="inbox" aria-label="Messages">
    <div class="drawer-head">
        <h2>Messages</h2>
        <button type="button" class="link-btn" id="inbox-refresh">Refresh</button>
        <button type="button" class="icon-btn" data-close="1" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
    </div>
    <div class="drawer-body" id="inbox-body"></div>
</aside>

<aside class="drawer left" id="search-panel" aria-label="Search subjects">
    <div class="drawer-head">
        <h2>Find a subject</h2>
        <button type="button" class="icon-btn" data-close="1" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
    </div>
    <div class="drawer-body">
        <form id="search-form">
            <div class="field">
                <label for="search-input">Subject, syllabus code or pathway</label>
                <input id="search-input" type="search" placeholder="Physics, 9702, Commerce" autocomplete="off">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Search</button>
        </form>
        <div id="search-results" style="margin-top:20px"></div>
    </div>
</aside>

<div class="modal" id="account" aria-label="Account">
    <div class="modal-head">
        <h2>Your account</h2>
        <button type="button" class="icon-btn" data-close="1" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
    </div>
    <div id="account-body"></div>
</div>

<div class="toast-stack" id="toast-stack"></div>

<script src="js/dengageEvents.js"></script>
<script src="js/store.js"></script>
<script src="js/inbox.js"></script>
<script src="js/slots.js"></script>
<script src="js/debug.js"></script>
<script src="js/edu-artwork.js"></script>
<script src="js/edu-site.js"></script>
<script src="js/edu-pages.js"></script>
<script src="js/edu-journey.js"></script>
<script src="js/edu-usecases.js"></script>
<script src="js/edu-boot.js"></script>
</body>
</html>
'''


def page_hero(title, crumb, lede=''):
    return '''
<section class="page-hero">
    <div class="container">
        <h1>{title}</h1>
        <div class="breadcrumb"><a href="index.html">Meridian College</a><span>/</span><span>{crumb}</span></div>
        {lede}
    </div>
</section>'''.format(
        title=title, crumb=crumb,
        lede='<p class="lede">%s</p>' % lede if lede else '')


# --------------------------------------------------------------------- pages

HOME = '''
<section class="hero">
    <div class="hero-art" data-render="hero-art"></div>
    <div class="container">
        <h1><span>We Are Meridians,</span><span class="line-2">We Are The Future!</span></h1>
        <p class="hero-body">The most ambitious A Levels college in Karachi, built for students who
            intend to lead rather than to keep up.</p>
        <div class="hero-actions">
            <a class="btn btn-accent" href="apply.html">Apply Now</a>
            <a class="btn btn-light" href="life.html#campus">Discover Campus Life</a>
        </div>
    </div>
</section>

<div class="inline-slot container" id="dn_inline_target_edu_below_hero"></div>

<section class="section">
    <div class="container">
        <div class="split">
            <div>
                <span class="eyebrow">Why Meridian College?</span>
                <h2>Some colleges prepare you for exams. We prepare you for everything.</h2>
                <p>Meridian College is the most ambitious A Levels college in Karachi, with one
                    uncompromising vision: to create a space where the next generation does not just
                    study, but transforms. Founded under the leadership of the Northline Group, and led
                    by four of the city's most accomplished educators, Meridian was never built to be
                    just another college on the map. It was built to be the standard everything else is
                    measured against.</p>
                <p>This is not just a college. This is where you become who you were always meant to be.</p>
                <p class="tagline">We Are Meridians, We Are The Future!</p>
            </div>
            <div class="art" data-render="campus-art"></div>
        </div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">Beyond the classroom</span>
            <h2>Life Hits Different Beyond the Classroom</h2>
            <p class="lede">There is a version of college that exists only in textbooks, and then there is
                this one. What happens beyond the classroom here is not an afterthought. It is intentional,
                electric and completely alive. Do not just take our word for it, see it for yourself.</p>
        </div>
        <div class="grid grid-4" data-render="media"></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">Academic pathways</span>
            <h2>Every discipline. Every ambition. Covered.</h2>
        </div>
        <div class="grid grid-3" data-render="pathways"></div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">Faculty</span>
            <h2>The Minds Behind the Meridians</h2>
            <p class="lede">Karachi's sharpest academic minds. Our faculty do not just teach, they transform.</p>
        </div>
        <div class="rail" data-render="faculty" data-limit="12"></div>
        <div style="text-align:center"><a class="btn btn-ghost" href="academics.html#faculty">Meet the full faculty</a></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">Admissions</span>
            <h2>Your Meridian Era Starts Here</h2>
            <p class="lede">Seats are limited. Standards are not. If you have got what it takes, this is
                your moment.</p>
        </div>
        <div data-render="admission-steps"></div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">Our Meridians</span>
            <h2>The names that define the standard</h2>
            <p class="lede">The faces that carry the legacy.</p>
        </div>
        <div class="grid grid-3" data-render="showcase"></div>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:900px">
        <div class="section-head"><span class="eyebrow">Questions</span><h2>FAQs</h2></div>
        <div data-render="faqs"></div>
        <p style="text-align:center;margin-top:30px">Still have questions? We are one message away.
            <a href="contact.html">Contact us</a>.</p>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Testimonials</span><h2>Their Words. Our Pride.</h2></div>
        <div class="grid grid-4" data-render="testimonials"></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head left" style="display:flex;justify-content:space-between;align-items:flex-end;max-width:none">
            <div><span class="eyebrow">News</span><h2>Read Our Latest News</h2></div>
            <a class="btn btn-ghost btn-sm" href="blogs.html">View all posts</a>
        </div>
        <div class="grid grid-3" data-render="news" data-limit="3"></div>
    </div>
</section>
'''

ABOUT = page_hero('About us', 'About us',
                  'Education goes beyond textbooks and classrooms. We believe in empowering students to '
                  'explore their passions and challenge conventions.') + '''
<section class="section">
    <div class="container">
        <div class="split">
            <div>
                <span class="eyebrow">A Legacy Worth Belonging to</span>
                <h2>Some places give you a certificate. We give you an identity.</h2>
                <p>From day one, every student joins something bigger than a classroom: a community, a
                    culture, and a legacy built on nothing but excellence.</p>
                <h3>Vision</h3>
                <p>To raise intellectually developed individuals armed with the skills that let them lead
                    the world of tomorrow. We facilitate our students to embark on the journey of self
                    reliance and confidence, because those skills are what set them apart in the leading
                    markets.</p>
                <h3>Mission</h3>
                <p>We focus on modern skills taught through a combination of classroom learning and on
                    task training. Our mission is to create a simulation of practical life scenarios for
                    students to experience first and then embrace.</p>
            </div>
            <div class="art" data-render="campus-art"></div>
        </div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">A message from our founders</span>
            <h2>Meridian was never just an idea. It was a promise.</h2>
            <p class="lede">When we built this college, we built it with one question in mind: what does
                the next generation truly deserve?</p>
        </div>
        <div class="grid grid-2" data-render="directors"></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head"><span class="eyebrow">The group behind the college</span>
            <h2>A Legacy Built Across Industries</h2>
            <p class="lede">One group, multiple giants. One standard: excellence.</p></div>
        <div class="grid grid-4" data-render="house-rules"></div>
    </div>
</section>
'''

ACADEMICS = page_hero('Academics', 'Academics',
                      'Cambridge A Level subjects, taught by people who build thinkers rather than '
                      'deliver a curriculum.') + '''
<section class="section">
    <div class="container">
        <div class="section-head">
            <span class="eyebrow">The standard</span>
            <h2>Academics is not a subject, it is a standard</h2>
            <p class="lede">Forget everything you thought A Level education looked like. Here the classroom
                is not a place you sit through; it is a place where you are challenged, shaped and pushed
                beyond your own expectations. Every subject is taught with purpose, built around the world
                that actually exists right now rather than the one from a decade ago.</p>
        </div>
    </div>
</section>

<section class="section-tight section-alt" id="subjects">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Subjects offered</span>
            <h2>Sixteen Cambridge A Level subjects</h2>
            <p class="lede">Pick the combination that fits the pathway you want. Three or four subjects is
                the usual shape.</p></div>
        <div class="filter-row" data-render="subject-filter"></div>
        <div class="inline-slot" id="dn_inline_target_edu_in_grid"></div>
        <div class="grid grid-4" data-render="subjects" data-filter="all"></div>
    </div>
</section>

<section class="section" id="faculty">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Faculty</span>
            <h2>The Minds Behind the Meridians</h2>
            <p class="lede">Behind every great institution is a team that refuses to settle. Meet the
                people who set the standard.</p></div>
        <div class="grid grid-4" data-render="faculty"></div>
    </div>
</section>

<section class="section section-alt" id="programs">
    <div class="container" style="max-width:960px">
        <div class="section-head"><span class="eyebrow">Unique programs</span>
            <h2>Built for the world that actually exists</h2>
            <p class="lede">While others stick to textbooks, these four programs run alongside the A Level
                curriculum.</p></div>
        <div data-render="programs"></div>
    </div>
</section>
'''

SUBJECT = '''
<section class="page-hero">
    <div class="container">
        <h1 id="subject-title">Subject</h1>
        <div class="breadcrumb"><a href="index.html">Meridian College</a><span>/</span>
            <a href="academics.html#subjects">Subjects</a><span>/</span><span id="subject-crumb">Subject</span></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div data-render="subject"></div>
        <div class="inline-slot" id="dn_inline_target_edu_subject_detail"></div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Also in this pathway</span>
            <h2>Subjects that pair with this one</h2></div>
        <div class="grid grid-3" data-render="subject-related"></div>
    </div>
</section>
'''

ADMISSIONS = page_hero('Admissions', 'Admissions',
                       'See what you are signing up for, before you sign up.') + '''
<section class="section">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Merit, character and potential</span>
            <h2>What it takes to join</h2>
            <p class="lede">We do not just look at numbers on a paper, we look at the person behind them.
                No connections. No shortcuts.</p></div>
        <div class="split">
            <div data-render="criteria"></div>
            <div>
                <div class="house-note">
                    <h3>Applications open once a year</h3>
                    <p>Seats are limited by design, because we maintain a standard of quality that large
                        numbers compromise. Applications are reviewed in the order they are completed.</p>
                    <a class="btn btn-primary" href="apply.html">Start your application</a>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section section-alt" id="scholarships">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Scholarships</span>
            <h2>Talent should never be limited by circumstance</h2>
            <p class="lede">Each award is granted on the basis of merit, achievement and demonstrated
                potential.</p></div>
        <div data-render="scholarships"></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head"><span class="eyebrow">The process</span><h2>Three steps, start to finish</h2></div>
        <div data-render="admission-steps"></div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Success stories</span>
            <h2>They took the leap</h2></div>
        <div class="grid grid-4" data-render="testimonials"></div>
    </div>
</section>
'''

COUNSELLING = page_hero('Counselling', 'Counselling',
                        'We do not just build careers, we build the people behind them.') + '''
<section class="section">
    <div class="container" style="max-width:900px">
        <div class="section-head"><span class="eyebrow">Our manifesto</span>
            <h2>Success is never just academic</h2></div>
        <p>Being a Meridian means pushing harder than most, and we respect that completely. The pursuit of
            excellence is real here, the standards are high, and the expectations never drop. But we also
            understand something that most institutions choose to ignore: true success is mental,
            emotional, directional and deeply personal.</p>
        <p>Whether you are trying to figure out which career path is right for you, struggling with a
            subject that is not clicking, feeling the weight of exam pressure, or simply going through
            something that needs a safe space, our counsellors are here. No judgment. No pressure. No
            scripts.</p>
        <p>You do not have to have it all figured out. That is what we are here for.</p>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Three pillars</span>
            <h2>Career, academic and well-being</h2>
            <p class="lede">Each one is designed to meet students exactly where they are and guide them to
                exactly where they need to be.</p></div>
        <div class="grid grid-3" data-render="counselling"></div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Where our students go next</span>
            <h2>University placement partners</h2>
            <p class="lede">Our students do not just graduate, they get placed.</p></div>
        <div data-render="universities"></div>
    </div>
</section>
'''

LIFE = page_hero('Life at Meridian', 'Life at Meridian',
                 'This is where the real experience lives.') + '''
<section class="section" id="news">
    <div class="container">
        <div class="section-head"><span class="eyebrow">News and updates</span>
            <h2>Stay in the loop</h2>
            <p class="lede">If it is happening on campus, it starts here.</p></div>
        <div class="grid grid-3" data-render="news" data-limit="3"></div>
    </div>
</section>

<section class="section section-alt" id="campus">
    <div class="container">
        <div class="split">
            <div class="art" data-render="campus-art"></div>
            <div>
                <span class="eyebrow">Campus life</span>
                <h2>A Day in the Life</h2>
                <p>The experience does not end when the bell rings. Campus life here is everything the
                    classroom is not: loud, electric and completely alive. From the buzz of society events
                    to the roar of the sports ground, from friendships made in corridors to late study
                    sessions before boards, this is where students come into their own.</p>
                <p>Every corner of this campus has a story. Every event leaves a memory. This is not just
                    a place you attend. It is a place you belong.</p>
            </div>
        </div>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:900px">
        <div class="section-head"><span class="eyebrow">Clash of the Houses</span>
            <h2>All year long, every student fights for their house</h2></div>
        <div data-render="clash-body"></div>
    </div>
</section>

<section class="section section-alt" id="societies">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Student societies</span>
            <h2>Find your people, build your legacy</h2>
            <p class="lede">Every society is student led, purpose driven, and built to push students
                beyond the classroom.</p></div>
        <div class="grid grid-3" data-render="societies"></div>
    </div>
</section>

<section class="section" id="houses">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Student houses</span>
            <h2>You do not just join a college, you join a house</h2>
            <p class="lede">From day one, everything you do matters. Every grade, every action, every
                achievement counts.</p></div>
        <div class="badge-grid" data-render="houses"></div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">How the system works</span>
            <h2>Four ways to earn points for your house</h2></div>
        <div class="grid grid-4" data-render="house-rules"></div>
    </div>
</section>
'''

MEDIA = page_hero('Media', 'Media',
                  'Campus, competitions, classrooms and results, as they happened.') + '''
<section class="section">
    <div class="container">
        <div class="grid grid-4" data-render="media"></div>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Our students</span>
            <h2>The faces that carry the legacy</h2></div>
        <div class="grid grid-3" data-render="showcase"></div>
    </div>
</section>
'''

CONTACT = page_hero('Contact', 'Contact',
                    'Education goes beyond textbooks and classrooms. Start a conversation.') + '''
<section class="section">
    <div class="container">
        <div class="contact-grid">
            <div class="contact-tile"><h3>Support Email</h3><p>info@meridian.example</p></div>
            <div class="contact-tile"><h3>Phone Number</h3><p>(+92) 300 000 0000</p></div>
            <div class="contact-tile"><h3>Address</h3><p>49-L Block 6, Karachi</p></div>
            <div class="contact-tile"><h3>Admissions</h3><p>admissions@meridian.example<br>(+92) 337 000 0000</p></div>
        </div>
    </div>
</section>

<section class="section section-alt">
    <div class="container" style="max-width:760px">
        <div class="section-head"><span class="eyebrow">Get in touch</span>
            <h2>Ask us anything</h2>
            <p class="lede">Admissions answer within one working day.</p></div>
        <form class="form-card" id="contact-form">
            <div class="field-row">
                <div class="field"><label for="contact-name">Your name</label>
                    <input id="contact-name" name="name" type="text" required></div>
                <div class="field"><label for="contact-email">Email address</label>
                    <input id="contact-email" name="email" type="email" required></div>
            </div>
            <div class="field"><label for="contact-topic">What is this about</label>
                <select id="contact-topic" name="topic">
                    <option>Admissions</option><option>Subjects and combinations</option>
                    <option>Scholarships</option><option>Counselling</option><option>Something else</option>
                </select></div>
            <div class="field"><label for="contact-message">Your message</label>
                <textarea id="contact-message" name="message" rows="5" required></textarea></div>
            <button type="submit" class="btn btn-primary btn-block">Send message</button>
        </form>
    </div>
</section>
'''

HOW_TO_APPLY = page_hero('How to Apply', 'How to Apply',
                         'From the moment you apply, you are not just filling out a form. You are taking '
                         'the first step into an ecosystem built to push you.') + '''
<section class="section">
    <div class="container" style="max-width:900px">
        <div class="section-head"><span class="eyebrow">Begin your A Levels journey</span>
            <h2>What the process looks like</h2>
            <p class="lede">Admission begins with submitting your O Level result, B-Form or CNIC, and
                school leaving certificate. Fill out the online application form with your personal and
                academic details. Shortlisted students are invited for a counselling session at the
                campus. Our team guides you every step of the way.</p></div>
        <div data-render="admission-steps"></div>
    </div>
</section>

<section class="section section-alt" id="eligibility">
    <div class="container">
        <div class="section-head"><span class="eyebrow">Eligibility criteria</span>
            <h2>Where you need to be</h2>
            <p class="lede">A minimum of three passing grades in O Level subjects is required to apply.
                Students still appearing submit their Statement of Entry for the subjects being taken.</p></div>
        <div class="grid grid-4" data-render="eligibility"></div>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:900px">
        <div class="section-head"><span class="eyebrow">Questions</span><h2>Before you start</h2></div>
        <div data-render="faqs"></div>
    </div>
</section>
'''

APPLY = page_hero('Apply Now', 'Apply Now',
                  'Your subject combination, your details, your documents. Ten minutes, and you can '
                  'come back to it.') + '''
<section class="section">
    <div class="container" style="max-width:820px">
        <div class="steps-bar" id="apply-progress">
            <span class="is-done"></span><span></span><span></span>
        </div>
        <form class="form-card" id="apply-form">
            <h2>Your details</h2>
            <div class="field-row">
                <div class="field"><label for="apply-name">Full name</label>
                    <input id="apply-name" name="name" type="text" required></div>
                <div class="field"><label for="apply-email">Email address</label>
                    <input id="apply-email" name="email" type="email" required></div>
            </div>
            <div class="field-row">
                <div class="field"><label for="apply-mobile">Mobile number</label>
                    <input id="apply-mobile" name="mobile" type="tel"></div>
                <div class="field"><label for="apply-board">Your qualification</label>
                    <select id="apply-board" name="board">
                        <option>O-Level</option><option>Matriculation</option>
                        <option>Federal Board</option><option>AKU-EB</option><option>Still appearing</option>
                    </select></div>
            </div>

            <h2 id="documents">Your documents</h2>
            <p>Upload is switched off in this demonstration. The checklist is here because a missing
                document is the single most common reason an application stalls.</p>
            <div class="field"><label class="check"><input type="checkbox" name="doc-result" checked>
                <span>O Level result or Statement of Entry</span></label></div>
            <div class="field"><label class="check"><input type="checkbox" name="doc-id" checked>
                <span>B-Form or CNIC</span></label></div>
            <div class="field"><label class="check"><input type="checkbox" name="doc-leaving">
                <span>School leaving certificate</span></label></div>

            <h2>Your subjects</h2>
            <div id="apply-subjects"></div>

            <div class="field"><label class="check"><input type="checkbox" name="consent" required>
                <span>I agree to be contacted about my application by email, SMS and web push.</span></label></div>

            <button type="submit" class="btn btn-primary btn-block">Submit my application</button>
        </form>
    </div>
</section>
'''

BLOGS = page_hero('Blogs', 'Blogs', 'Admissions dates, campus events and everything in between.') + '''
<section class="section">
    <div class="container">
        <div class="grid grid-3" data-render="news"></div>
    </div>
</section>
'''

POST = '''
<section class="page-hero">
    <div class="container">
        <h1 id="post-title">News</h1>
        <div class="breadcrumb"><a href="index.html">Meridian College</a><span>/</span>
            <a href="blogs.html">Blogs</a><span>/</span><span id="post-crumb">Post</span></div>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width:820px">
        <div data-render="post"></div>
        <a class="btn btn-ghost" href="blogs.html">All posts</a>
    </div>
</section>

<section class="section section-alt">
    <div class="container">
        <div class="section-head"><span class="eyebrow">More news</span><h2>Read next</h2></div>
        <div class="grid grid-3" data-render="news" data-limit="3"></div>
    </div>
</section>
'''

PAGES = [
    ('index.html', 'Meridian College | Dengage Education Demo', 'home', '', HOME,
     'A working college website for a conversation about personalization.'),
    ('about.html', 'About us | Dengage Education Demo', 'other', '', ABOUT,
     'Vision, mission and the people who set the standard.'),
    ('academics.html', 'Academics | Dengage Education Demo', 'category',
     ' data-category-path="Subjects"', ACADEMICS,
     'Sixteen Cambridge A Level subjects across three pathways.'),
    ('product.html', 'Subject | Dengage Education Demo', 'product',
     ' data-item-id="query:id"', SUBJECT,
     'One subject, its pathway, its faculty and what pairs with it.'),
    ('admissions.html', 'Admissions | Dengage Education Demo', 'promotion', '', ADMISSIONS,
     'Entry criteria, scholarships and the three step admission process.'),
    ('counselling.html', 'Counselling | Dengage Education Demo', 'other', '', COUNSELLING,
     'Career, academic and well-being counselling, built into the experience.'),
    ('life.html', 'Life at Meridian | Dengage Education Demo', 'other', '', LIFE,
     'News, campus life, student societies and the house system.'),
    ('media.html', 'Media | Dengage Education Demo', 'other', '', MEDIA,
     'Campus, competitions, classrooms and results.'),
    ('contact.html', 'Contact | Dengage Education Demo', 'other', '', CONTACT,
     'Admissions, support and where to find the campus.'),
    ('how-to-apply.html', 'How to Apply | Dengage Education Demo', 'other', '', HOW_TO_APPLY,
     'The process, the eligibility criteria and the questions asked most.'),
    ('apply.html', 'Apply Now | Dengage Education Demo', 'checkout', '', APPLY,
     'Your details, your documents and your subject combination.'),
    ('blogs.html', 'Blogs | Dengage Education Demo', 'other', '', BLOGS,
     'Admissions dates, campus events and everything in between.'),
    ('post.html', 'News | Dengage Education Demo', 'other', '', POST,
     'A single news post.'),
]

DASHES = re.compile('[–—]')


def main():
    written = []
    for name, title, page_type, body_attrs, main_html, description in PAGES:
        html = SHELL.format(slug=SLUG, title=title, description=description,
                            account=ACCOUNT_ID, guid=APP_GUID,
                            page_type=page_type, body_attrs=body_attrs,
                            main=main_html.strip())
        found = DASHES.search(html)
        if found:
            sys.stderr.write('%s contains an em or en dash at offset %d\n' % (name, found.start()))
            return 2
        with io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(html)
        written.append(name)

    print('Wrote %d pages into demos/%s/' % (len(written), SLUG))
    for name in written:
        print('  ' + name)
    return 0


if __name__ == '__main__':
    sys.exit(main())
