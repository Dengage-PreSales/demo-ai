# Phase 0: bringing the Dengage panel up

Everything in this folder exists to answer one question: does the panel side
work? Nothing else in the repository is built on top of it until the answer is
yes, because everything else assumes it.

Work through this once. It is the only panel work there will ever be. Once it
is done, every demo the factory generates uses the same application, the same
two tables and the same eight campaigns, and none of it is repeated.

Allow about an hour, most of it in step 4.

---

## What Phase 0 has to prove

Two things, and the second is the one that gets skipped.

1. A scenario fired from the probe page makes a widget **appear on screen**.
2. The click for it is visible **as a row in Data Space**, under
   `contact_key = ddemo-phase0-probe-1`.

A response code is not the second one. An HTTP 200 from the event endpoint
means the event was accepted, not that it was stored, and the row is the only
proof it landed. Two confident and wrong claims that something was working have
already come from stopping at the response code.

---

## Before you start

Three values are needed and only the first two block anything:

| What | Where it goes | Blocks |
|---|---|---|
| The Dengage account id | `factory/sandbox.json` | steps 4 to 7 |
| The sandbox application's app guid | `factory/sandbox.json` | steps 4 to 7 |
| A REST API bearer token | passed on the command line, never committed | step 3 only |

The token needs the **`dataSpace.manage`** permission. Without it the table
creation call is refused with a 403 that names the permission it wanted.

The token is used once, to create two tables, and again in Phase 3 for the
scheduled purge. It is never written into a file in this repository.

---

## 1. Turn GitHub Pages on

Repository Settings, then Pages, source set to the **`main` branch, root
folder**. It publishes in a minute or two.

This is step zero and it is easy to skip past, because every other step assumes
the site is already reachable. Until it is on,
`https://dengage-presales.github.io/demo-ai/` returns not found, no demo can be
live, and the icon URL in step 2 points at nothing and may be rejected.

Check it worked:

    https://dengage-presales.github.io/demo-ai/factory/phase0/probe/

That page should load and say it is in dry run.

---

## 2. Create the web application

A **new web application in account 28**, separate from the BFSI application the
core demo sites use.

| Field | Value |
|---|---|
| Name | `DND - eComm DemoFactory [Salil]` |
| Site Domain URL | `https://dengage-presales.github.io` |
| Icon/Badge URL | `https://dengage-presales.github.io/demo-ai/assets/dengage-push-icon.png` |

**Site Domain URL takes the origin only.** No path, no trailing slash. Every
demo ever built sits underneath that one address, so it is filled in once and
covers all of them. Putting the full path to one demo there would scope the
application to that demo alone.

The icon is optional on the first pass. It resolves to nothing until step 1 has
published, so if the panel refuses it, come back after that. Push works without
it.

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

That file is the single place they are recorded. The probe page, the generator,
the smoke test and the CI guardrails all read them from there, so filling it in
is the whole of wiring this repository to the panel.

The guardrails treat the app guid as an allowlist of one. Any other application
identifier appearing anywhere in the repository is rejected, which is how the
BFSI application is kept out without its identifier ever being written down
here.

---

## 3. Create the two tables

Review what will be sent first. This needs no token and no account:

    node factory/phase0/create-tables.mjs --dry-run

Then create them:

    DENGAGE_API_TOKEN=... node factory/phase0/create-tables.mjs

Safe to run twice. A table that already exists is reported as such and left
alone, so re-running after a partial failure finishes the job.

Two tables are created:

| Table | One row per |
|---|---|
| `sandbox_onsite_events` | widget fired from the launcher |
| `sandbox_events` | storefront interaction |

**These two are the whole of what any demo may write to.** Everything the
reference build sent to `shopping_cart_events`, `order_events`,
`order_events_detail`, `wishlist_events` and `search_events` comes here
instead.

That matters more than it looks. The sandbox application is a new application
inside account 28, so it has its own campaigns and its own push configuration,
but the **Data Space, every table and every contact are shared** with the five
core demo sites and the two mobile apps. A separate GitHub account gives this
project its own browser origin. It does not give it its own Dengage account.
Fake-brand rows in a standard table would skew segments and recommendation
output on assets used to close real deals, and nothing structural prevents it.

---

## 4. Create the eight campaigns

By hand, in the panel. This cannot be scripted: the API can create tables but
it cannot create on-site campaigns, and this is the step that the whole shared
prefix design exists to make you do only once.

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

The service worker is `dengagewebpushsw.js` at the **repository root**, not
inside a demo folder. A service worker's scope is its path, so one worker at
the root serves every demo on the origin.

One property worth knowing and worth telling the pre-sales team: **push
subscriptions belong to the origin, and every demo shares one origin.** A
browser that subscribed while looking at demo A is subscribed for the whole
sandbox. For composing a push in the panel during a call and having it arrive
on screen, that is the behaviour you want. It is not a bug, so please do not
try to fix it.

---

## 6. Run the probe

Serve from the **repository root**, not from the probe folder, so the service
worker at the root resolves:

    python3 -m http.server 8101

Then open `http://localhost:8101/factory/phase0/probe/`, or the published
address from step 1.

The page should say **Live** and show the account and app guid. If it says dry
run, `factory/sandbox.json` has not been filled in.

Press a card in section 1. A widget should appear.

If nothing appears:

| Check | |
|---|---|
| Is there a campaign with that exact trigger name? | Step 4. A missing campaign is silent |
| Is the campaign Active? | |
| Has the same widget already been fired several times? | Use the reset control in section 4 |
| Does the log show the `dataLayer` push? | If not, the page is not running its JavaScript |

---

## 7. Find the row

This is the step that gets skipped and it is the entire point.

Open Data Space, open **`sandbox_onsite_events`**, and filter on

    contact_key = ddemo-phase0-probe-1

There should be one row per card you pressed, each carrying `demo_slug`,
`event_name`, `scenario_group`, `widget_name`, `page_type` and `page_url`. The
probe's log pane shows exactly what it sent, so compare the two.

Then press a card in section 2 of the probe and find that row in
**`sandbox_events`** the same way.

**When both rows are there, Phase 0 is done.** Not before.

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
