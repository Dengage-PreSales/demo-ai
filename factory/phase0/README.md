# Phase 0: bringing the Dengage panel up

Everything in this folder exists to answer one question: does the panel side
work? Nothing else in the repository is built on top of it until the answer is
yes, because everything else assumes it.

Work through this once. It is the only panel work there will ever be. Once it
is done, every demo the factory generates uses the same application, the same
tables and the same campaigns, and none of it is repeated.

Allow about an hour, most of it in step 4.

---

## What Phase 0 has to prove

Two things, and the second is the one that gets skipped.

1. A scenario fired from a demo storefront makes a widget **appear on screen**.
2. The click for it is visible **as a row in Data Space**, under
   `contact_key = ddemo-phase0-probe-1`.

A response code is not the second one. An HTTP 200 from the event endpoint
means the event was accepted, not that it was stored, and the row is the only
proof it landed. Two confident and wrong claims that something was working have
already come from stopping at the response code.

---

## Before you start

| What | Where it goes | Blocks |
|---|---|---|
| The Dengage account id | `factory/sandbox.json` | steps 6 and 7 |
| The sandbox application's app guid | `factory/sandbox.json` | steps 6 and 7 |
| An API user's key and password | the environment, never committed | the optional check in step 3 |

**There is no bearer token to be issued.** Authentication is an **API user**,
created in the panel under Configuration, Users, New User. The platform
generates a user key and shows the password once, and also emails it. Those two
are exchanged at `POST /rest/login` for an access token that lasts an hour.

They are only needed for the optional verification in step 3 and later for the
Phase 3 purge. Nothing in Phase 0 requires them, because the tables are created
by hand.

**The API is IP allowlisted.** It refuses on the calling address before it
looks at the credentials, and the message it returns names the address. If a
call is refused with a 403 mentioning whitelisting, the credentials are not the
problem and re-issuing them will not help. This has a consequence for Phase 3
that is recorded in the handoff: a stock GitHub Actions runner draws from a
large, changing pool of addresses, so there is nothing stable to allowlist and
the purge needs a different home.

> **Never delete or truncate anything in Dengage without written approval.**
> Dropping a table, truncating one, deleting rows or contacts. Every time, for
> that specific object, agreed beforehand. The Data Space is shared with five
> live demo sites and two mobile apps, and a drop cannot be undone from this
> side. CLAUDE.md section 1a.

---

## 1. Turn GitHub Pages on

Repository Settings, then Pages, source set to the **`main` branch, root
folder**. It publishes in a minute or two.

This is step zero and it is easy to skip past, because every other step assumes
the site is already reachable. Until it is on,
`https://dengage-presales.github.io/demo-ai/` returns not found, no demo can be
live, and the icon URL in step 2 points at nothing and may be rejected.

Check it worked:

    https://dengage-presales.github.io/demo-ai/demos/showcase/

That page should load and say it is in dry run.

---

## 2. Create the web application

A **new web application in account 28**, separate from the BFSI application the
core demo sites use.

| Field | Value |
|---|---|
| Name | `DND - PreSales eComm [Salil]` |
| Site Domain URL | `https://dengage-presales.github.io` |
| Icon/Badge URL | `https://dengage-presales.github.io/demo-ai/assets/dengage-push-icon.png` |

**Site Domain URL takes the origin only.** No path, no trailing slash. Every
demo ever built sits underneath that one address, so it is filled in once and
covers all of them. Putting the full path to one demo there would scope the
application to that demo alone.

**The icon is a required field**, and the panel rejects a URL that does not
resolve, so this only works once step 1 has published. It wants a square HTTPS
image of at least 256px. `assets/dengage-push-icon.png` is the Dengage mark at
1200x1200, which clears that comfortably.

It is live and returns 200, so this can be pasted in as it stands.

### The four advanced settings

| Setting | Value |
|---|---|
| Trigger Initialize on Install | **off** |
| Trigger Page View on Initialize | **off** |
| Disable `setNavigation` | **on** |
| Allow connecting multiple contacts to single device | off |

The first two are not preferences. The page calls `initialize()` itself, and
`pageView` is sent by the page with real parameters. Leaving either on produces
double counted page views, which nobody notices until a prospect asks why the
numbers look odd.

### Then write the two values down

Put the account id and the app guid into **`factory/sandbox.json`** and commit.

That file is the single place they are recorded. The generator,
the smoke test and the CI guardrails all read them from there, so filling it in
is the whole of wiring this repository to the panel.

The guardrails treat the app guid as an allowlist of one. Any other application
identifier appearing anywhere in the repository is rejected, which is how the
BFSI application is kept out without its identifier ever being written down
here.

---

## 3. The tables. There is nothing to create

> **Changed 4 August 2026, and this step went away entirely.** It used to say
> "create the two tables, by hand, as Big Data tables", and described
> `sandbox_onsite_events` and `sandbox_events`. Salil reversed that design after
> the two tables had been built and inspected. Handoff §1.3 and §15a have the
> full reasoning; the short version is that the Dengage recommendation engine
> feeds off the standard ecommerce tables, so sandbox tables would have meant a
> demo could never show recommendations, which is one of the things a prospect
> most wants to see.

A demo writes to the **six standard ecommerce tables**, using the SDK's own
calls. They already exist, their schemas belong to the platform, and they are
already related to `master_contact`, so the contact card, segmentation and
profile enrichment work with no wiring at all.

    node factory/phase0/tables.mjs

That reaches nothing. It prints which call writes to which table:

| Call | Table |
|---|---|
| `pageView` | `page_view_events` |
| `ec:addToCart`, `ec:removeFromCart`, `ec:deleteCart`, `ec:beginCheckout` | `shopping_cart_events` |
| `ec:order`, `ec:cancelOrder` | `order_events`, `order_events_detail` |
| `ec:addToWishlist`, `ec:removeFromWishlist` | `wishlist_events` |
| `ec:search` | `search_events` |

### The one rule this leaves you with

**Every page fires `pageView`, before anything else.** No column tags a demo's
rows, because columns cannot be added to these six. `pageView` is the only route
back to them: the SDK fills `page_url`, `page_title` and `session_id` on that row
itself, and `session_id` is the only join to the other five.

    page_view_events where page_url contains the slug   ->  session_ids
         ->  those session_ids find its cart, order, wishlist and search rows

A page that skips it writes cart, order, wishlist and search rows whose
`session_id` appears in no page view, so nothing can ever attribute them to a
demo. The guard's `pageview-required` check exists for exactly that, and
`event-single-source` refuses an SDK call from anywhere except
`template/js/dengageEvents.js`. Neither alone is sufficient.

### Confirm they are reachable

Optional, and needs the API user from above:

    DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
      node factory/phase0/tables.mjs --verify

It confirms all six exist and prints each one's columns and row count. It writes
nothing: the only request that is not a `GET` is the login.

### And whether events are actually landing

    DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
      node factory/phase0/tables.mjs --counts

Run it, use the storefront, run it again. **An HTTP 200 from the event endpoint
means accepted, not stored**, and the row is the only proof. Two confident and
wrong "it is working" claims on the reference build came from skipping this.

Read the result in one direction only. The account is shared, so a count that
moved is not proof it was your event. A count that did not move is proof it was
not.

### What this costs, stated plainly

Demo rows sit in the same six tables as the five core demo sites and the two
mobile apps. There is no structural separation and there is no tag. The
application is a new one inside account 28, so it has its own campaigns and its
own push configuration, but **the Data Space, every table and every contact are
shared**. A separate GitHub account gives this project its own browser origin. It
does not give it its own Dengage account.

Which is why nothing here deletes anything. Dropping or truncating a table, or
deleting rows or contacts, needs Salil's written approval first, every time, for
that specific object. CLAUDE.md §1a. Reading is always fine.

---

## 4. Create the campaigns

By hand, in the panel, like step 3. The API cannot create on-site campaigns at
all: the published reference exposes an id for updating an existing one and
nothing for creating one.

Everything panel side is manual, and all of it is one time. That is the shape
of the design, and the promise it protects is not "no manual setup", it is **no
per demo panel work**. This step is where that promise is earned.

Settings common to all eight:

| Field | Value |
|---|---|
| Trigger | **Data Layer Event** |
| Event name | the trigger name below, exactly |
| Where to display | `/.*/` |
| Status | Active |
| Show every X minutes | 1 |
| Max show count | 100 |

`/.*/` is what lets one campaign serve every demo on the shared origin. Do not
narrow it per demo.

`Show every X minutes = 1` and `Max show count = 100` are set the way they are
so that firing the same widget repeatedly during one call keeps working. They
are not arbitrary values, so please do not tidy them.

| Trigger name | Layout | Design |
|---|---|---|
| `dengage_demo_survey` | Popup | width 460 to 480, padding 0, transparent background |
| `dengage_demo_nps-popup` | Popup | width 460 to 480, padding 0, transparent background |
| `dengage_demo_subscription-popup` | Popup | width 460 to 480, padding 0, transparent background |
| `dengage_demo_image-popup` | Popup | width 460 to 520, padding 0, transparent background |
| `dengage_demo_horizontal-popup` | Popup | width 640 to 720, padding 0, transparent background |
| `dengage_demo_cta-image-popup` | Popup | width 440 to 480, padding 0, transparent background |
| `dengage_demo_sticky-bar` | **Banner**, position Top, keep in place on scroll | padding 0, transparent background |
| `dengage_demo_image-bar` | **Banner**, position Bottom, keep in place on scroll | padding 0, transparent background |

**Copy these names exactly.** A campaign whose trigger name does not match is
not an error anywhere: that widget is simply dark. Nothing logs and nothing
fails, so when a widget does not appear, check this list before suspecting the
code.

Three settings that are not style choices:

**Padding 0 and a transparent background.** The engine's own container
otherwise draws a white box around the card, which reads as an unwanted frame
on screen. Each creative supplies its own white, corner radius and shadow.

**The two bars are Banner, not Popup.** The Banner container is already fixed
and full width, so the content just fills it.

**The six popups get their close button from the panel**, under Layout, Close
Button, "Add close button to outside". The creatives do not draw their own. The
two banners keep theirs, because the Banner layout is not offered that setting.

### Content for the Phase 0 check

The eight standardized creatives are Phase 1 work, deliberately. They are
written once a widget has visibly rendered at least once, because their
mechanics rest on how the engine actually behaves rather than on how it is
documented to behave, and Phase 0 is what turns that from documentation into
observation.

For now, paste **`factory/phase0/creative/phase0-check.html`** into whichever
popup you set up first. It is a generic card that proves the trigger reaches
the panel, that a click is reported and that the card dismisses.

---

## 5. Configure web push

Point the push domain on the new application at the Pages origin.

**The service worker lives at the origin root, which is a different repository
from this one.** A service worker's scope is its path, so the file has to sit
above every demo it serves.

| | |
|---|---|
| Repository | `Dengage-PreSales/dengage-presales.github.io` |
| Served at | `https://dengage-presales.github.io/dengage-webpush-sw.js` |
| Scope | `/`, the whole origin, so it covers every demo |

This corrects the handoff, which said the worker sits at the root of *this*
repository. That was written assuming this repository served the origin root.
It does not: `demo-ai` is a project Pages site published under `/demo-ai/`, so
a worker here would be scoped to `/demo-ai/` only. The origin root belongs to
the `dengage-presales.github.io` repository, and the worker is already there.

The file is account agnostic. It reads the account id and app guid from its own
query string and imports the real worker from the Dengage CDN, so one copy
serves any application and nothing in it needs changing per demo.

One property worth knowing and worth telling the pre-sales team: **push
subscriptions belong to the origin, and every demo shares one origin.** A
browser that subscribed while looking at demo A is subscribed for the whole
sandbox. For composing a push in the panel during a call and having it arrive
on screen, that is the behaviour you want. It is not a bug, so please do not
try to fix it.

---

## 6. Check it against a demo storefront

> **The probe page was retired on 6 August 2026.** It existed to prove the panel
> worked before any demo did, and it had been broken for days without anyone
> noticing: it wrote to two tables that the 4 August design reversal removed
> before they were ever created, so its own acceptance step could not succeed. A
> real demo storefront does everything it did and is the thing that actually
> ships, so it replaces it. Everything below uses a demo instead.

Open any live demo with the event readout on:

    https://dengage-presales.github.io/demo-ai/demos/showcase/?debug=1

Locally, serve from the **repository root** so relative paths and the service
worker resolve the way they do when published:

    python3 -m http.server 8101
    # http://localhost:8101/demos/showcase/?debug=1

Open **Dengage scenarios** and press a card. A widget should appear.

If nothing appears:

| Check | |
|---|---|
| Is there a campaign with that exact trigger name? | Step 4. A missing campaign is silent |
| Is the campaign Active? | `bash factory/panel/live-campaigns.sh` prints every one |
| Is the campaign's trigger type the one the card sends? | Handoff 12.14. A mismatch produces no error anywhere |
| Has the same widget already fired several times? | Use the reset control in the launcher |
| Did the event leave the page at all? | The `?debug=1` readout lists every event sent, with its payload |

---

## 7. Find the row

This is the step that gets skipped and it is the entire point.

**A response code means accepted, not stored.** The readout in step 6 proves the
browser sent something. Only a row proves Dengage kept it.

Open **Dengage scenarios > Quick reference** in the demo and copy two values:
the **Contact key**, if you signed in, and the **Page URL**.

Then in Data Space open **`page_view_events`** and filter `page_url` on that
value. No column identifies which demo a row came from, so this is the only route
back to a demo's rows. CLAUDE.md 1b.

**Copy the `session_id` from the row you find.** That value is the only join to
the rest. Add something to the cart on the demo, then find the matching
`session_id` in **`shopping_cart_events`**.

**When both rows are there, the panel is proven end to end.** Not before. To watch
counts move rather than hunt individual rows:

    DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
      node factory/phase0/tables.mjs --counts

---

## What comes next

Phase 1 builds the storefront template from the reference build in `seed/`, and
writes the eight standardized creatives.

The part of it to be careful with is not the layout. Five modules in the
reference build write to the standard ecommerce tables, and a copy of them that
looks perfect on screen while writing to `shopping_cart_events` is the worst
outcome available, because nothing about the page reveals it. The guardrails in
`factory/guard/` exist to catch exactly that, and they are already in place and
tested. Run them:

    ./factory/guard/run.sh
    ./factory/guard/test.sh
