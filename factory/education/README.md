# The education demo

A working college website, themed and structured like a real one, with twenty
education use cases that fire on demand from an in page launcher.

```
https://dengage-presales.github.io/demo-ai/demos/meridian-college/
```

It is separate from the ecommerce factory in every way that matters. It shares
the repository, the Dengage application, the SDK loader and the service worker at
the origin root, and it shares nothing else: no creative, no campaign, no shared
content asset, no template module, and no file that an ecommerce demo reads.

---

## What it is

| | |
|---|---|
| Slug | `meridian-college` |
| Pages | 13, including a subject detail page and a news post page |
| Subjects | 16 Cambridge A Level subjects across 3 pathways |
| Use cases | 20 scenarios plus 5 inline content slots |
| Event prefix | `demo_dengage_edu_` |
| Application | the same sandbox application every demo in this repository uses |
| Imagery | generated inline SVG. No photographs, no third party requests |

It is a demonstration rather than a live college. The institution, its staff and
its students are fictional, every portrait is drawn rather than photographed, and
the mark in the header is the Dengage one. It is modelled on the structure of a
real prospect's website, recorded in `demo.config.json` as `sourceUrl`, and it
carries none of that institution's name, word mark, staff names or photography.

---

## The use cases, and how they are delivered

Every card in the launcher does two things when it is pressed.

1. **It pushes a data layer event** named `demo_dengage_edu_<scenario>`. That is
   the trigger a Dengage On-Site campaign listens for.
2. **It renders the scenario in the page itself.**

Step 2 is why nothing has to be built, configured or clicked in the Dengage panel
before this demo works, and why no card can go dark mid call because a campaign
was paused or a creative was edited. Step 1 is what makes it upgradeable: build a
campaign for one of these names and that campaign answers the same button, with
no change to the website.

Every card is re-firable. Nothing latches, suppresses or frequency caps, because
a scenario that can only be shown once is worse on a call than no scenario.

### Admissions funnel

| Card | Event |
|---|---|
| Application started, not submitted | `demo_dengage_edu_application-started` |
| Round closing countdown | `demo_dengage_edu_deadline-countdown` |
| Missing document reminder | `demo_dengage_edu_document-reminder` |
| Eligibility checker | `demo_dengage_edu_eligibility-checker` |
| Application submitted | `demo_dengage_edu_application-submitted` |

### Discovery and shortlist

| Card | Event |
|---|---|
| Subject browse abandonment | `demo_dengage_edu_browse-abandoned` |
| Shortlist nudge | `demo_dengage_edu_shortlist-nudge` |
| Subject search | `demo_dengage_edu_subject-search` |
| Search with no results | `demo_dengage_edu_search-no-results` |
| Related subjects rail | `demo_dengage_edu_recommendations` |

### Engagement and lifecycle

| Card | Event |
|---|---|
| Prospectus download | `demo_dengage_edu_prospectus-download` |
| Open day registration | `demo_dengage_edu_open-day-register` |
| Counselling session booking | `demo_dengage_edu_counselling-booking` |
| Scholarship eligibility nudge | `demo_dengage_edu_scholarship-nudge` |
| Dormant applicant win-back | `demo_dengage_edu_winback` |

### Channels

| Card | Event |
|---|---|
| App Inbox | `demo_dengage_edu_app-inbox` |
| Web push permission | `demo_dengage_edu_push-permission` |
| Push and device status | `demo_dengage_edu_push-status` |
| NPS after a counselling session | `demo_dengage_edu_nps` |
| Applicant survey | `demo_dengage_edu_survey` |

### Inline content slots

Five positions an Inline campaign can target, each with its own selector.

| Slot | Selector | Pages |
|---|---|---|
| Below the header | `#dn_inline_target_edu_below_header` | every page |
| Below the hero | `#dn_inline_target_edu_below_hero` | home |
| Inside the subject grid | `#dn_inline_target_edu_in_grid` | academics |
| On a subject, under the code | `#dn_inline_target_edu_subject_detail` | product |
| Above the footer | `#dn_inline_target_edu_above_footer` | every page |

They carry an `edu` prefix rather than the storefront's selector names on
purpose. An Inline campaign is targeted by selector and set to display on every
URL, so sharing the storefront's selectors would put ecommerce creative onto a
college page the first time Inline is switched on.

---

## What it writes to Dengage

The admissions funnel and a shopping funnel are the same shape, so this demo is
expressed in the platform's own vocabulary rather than in a private one. That is
what makes recommendations, abandonment journeys and the contact card work
immediately instead of needing anything new defined.

| What a visitor does | Call | Table |
|---|---|---|
| Opens any page | `pageView` | `page_view_events` |
| Adds a subject to the application | `ec:addToCart` | `shopping_cart_events` |
| Removes one | `ec:removeFromCart` | `shopping_cart_events` |
| Reaches the application form | `ec:beginCheckout` | `shopping_cart_events` |
| Submits the application | `ec:order` | `order_events`, `order_events_detail` |
| Shortlists a subject | `sendDeviceEvent` to `wishlist_events` | `wishlist_events` |
| Searches for a subject | `ec:search` | `search_events` |

Page types use the documented vocabulary: the academics listing is a `category`,
a subject is a `product`, admissions is a `promotion`, and the application form is
a `checkout`.

**No price is ever sent.** A college publishes no price per subject, and
`Number(null)` is `0` in JavaScript, so a builder that passed an empty price
through would advertise every subject as free. The event module drops the key
instead. The order carries its subjects and its reference and no amount at all,
and its payment method is `other`, because submitting an application is not a
payment.

**Every page fires a page view before anything else.** No column identifies which
demo a row came from, so `page_url` on the page view and the `session_id` join out
of it are the only route from this demo to its own rows.

---

## Running it

```bash
python3 -m http.server 8101          # from the repository root
# http://localhost:8101/demos/meridian-college/
```

Serve from the repository root rather than the demo folder, so relative paths
resolve the way they do on Pages. Web push is not testable this way: the service
worker lives at the origin root, so push is checked on the published site.

Add `?debug=1` to any page for the readout of every event the page sent, with its
full payload and the table it writes.

### Rebuilding the pages

```bash
python3 factory/education/build-pages.py
```

Thirteen pages share one shell, because the script order in the head is load
bearing and thirteen hand maintained copies of it is thirteen chances to get it
wrong once and never notice. Page content lives in that file; everything a page
repeats lives in `demos/meridian-college/content.json`.

### Checking it

```bash
python3 -m http.server 8101 &
node factory/education/check.mjs
```

196 assertions, about a minute. Every page loads clean and fires one page view of
the type it declares, every collection renders, every launcher card fires in both
directions, the funnel writes the events it claims to, and no payload carries an
invented figure.

It refuses the Dengage hosts at launch and asserts the refusal, because the real
loader is reachable from a machine with a network and replaces the stub mid check
if it is allowed to load.

---

## Two things worth knowing

**It is not listed on the repository's front page.** That list is derived from the
product feed, and the feed is built from demos that have a `products.json`. This
demo has a subject catalogue rather than a product catalogue, so it does not
appear there. The demo URL above works and is the one to use.

**It expects nothing in the panel, and it rewards anything added there.** Nothing
in this demo depends on a campaign existing. If campaigns are later created for
the event names above, they render through the Dengage engine instead, and the
same buttons drive them.
