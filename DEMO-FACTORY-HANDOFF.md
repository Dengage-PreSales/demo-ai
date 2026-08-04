# Demo Factory: build specification and handoff

> **Read this first, in full, before writing any code.** This document is the
> complete brief for a new repository. It was written in a session on
> `salil-dengage/dengage-demos` (the five core demo sites) by reading that
> repository end to end, and it carries forward every contract and trap that
> applies here. The session that executes this will not have access to that
> repository, so everything needed is restated below.
>
> Owner: Salil. Anything this document leaves open is listed in §14 and needs
> his answer, not a guess. §15 is a decision log mapping every question asked
> during the design to the section that implements it.

---

## 0. What you are building, in one paragraph

A **demo factory**: a pre-sales person pastes a prospect's ecommerce website
URL into a GitHub issue form, and roughly ten minutes later a working demo
storefront is live on GitHub Pages, themed to that prospect, wired to a real
Dengage web application, with eight preset on-site personalization widgets that
fire on demand from an in-page launcher. No developer involved, no Dengage
panel work per demo, and nothing that can touch the five core demo sites or the
two mobile apps that the sales team already relies on.

Target: **5 to 7 demos a month**, each live for **90 days**, then purged
automatically.

| | |
|---|---|
| GitHub account | `Dengage-PreSales`, deliberately separate from `salil-dengage`. See §2.5a |
| Repository | `Dengage-PreSales/demo-ai` |
| Origin | `https://dengage-presales.github.io` |
| Demo URL | `https://dengage-presales.github.io/demo-ai/demos/<slug>/` |
| Core repository, which this one never touches | `salil-dengage/dengage-demos` |

The Pages hostname is **lowercase** even though the account is capitalised
`Dengage-PreSales`. Use the lowercase form everywhere. The path after the
hostname is case sensitive; the hostname is not.

---

## 1. Non-negotiables

Break any of these and you either break a live sales asset or you build
something the pre-sales team cannot use.

1. **This repository never touches `salil-dengage/dengage-demos`.** No shared
   branch, no shared workflow, no shared Pages deploy, no cross-repo imports.
   That repo hosts five customer-facing demo sites and two mobile apps that are
   used on live calls.

   **Corrected, and this matters more than the original wording did.** An
   earlier draft called this isolation structural. It is not. The GitHub
   identity a session here runs as **can read and write that repository**,
   because Claude Code supports one GitHub connection per account. That was
   accepted deliberately.

   So the separate repository keeps the two codebases apart, and it does
   nothing to stop a write. **The boundary is enforced by instruction only.**
   Do not read from, write to, clone, or add `salil-dengage/dengage-demos`.
   The `core-repo-isolation` guard check catches a reference that gets
   committed here, which is a much smaller thing than the rule it serves.

2. **Every generated demo fires the `dengage_demo_` event prefix and nothing
   else.** Eight campaigns exist once, in one dedicated Dengage web
   application, with standardized creatives shared by every demo. A demo never
   gets its own campaigns. This is what makes per-demo panel work zero, and it
   is the single decision the whole design rests on.

3. **No `ec:*` calls. Ever.** The generated demos must not write
   `shopping_cart_events`, `order_events`, `order_events_detail`,
   `wishlist_events` or `search_events`. Those are account-level standard
   tables shared with the core demos, and fake-brand rows in them can skew
   segments and recommendation output on assets that are used to close real
   deals. Everything a generated demo records goes to the two sandbox tables in
   §2.3. The single deliberate exception is `pageView`, explained in §6.1.

4. **No external asset hosting at runtime.** Product images scraped from a
   prospect are downloaded, compressed and committed. A demo must never
   hotlink a third-party CDN: the prospect can change or remove that image
   between the build and the call, and a broken image on screen during a demo
   is worse than no image.

5. **Demos carry the Dengage logo, not the prospect's.** The storefront is
   branded "Dengage" with the subtext "eComm Demo". The prospect's colors,
   typography and product catalogue are used; their logo and word mark are
   not. This is Salil's decision and it is not yours to relax, whatever a
   prospect asks for on a call.

6. **Every demo is namespaced.** Element ids, CSS classes, the localStorage
   cart key and custom events all carry the demo slug. All demos share one
   GitHub Pages origin, so two demos open in one browser must not collide.

7. **Contacts created by a demo carry a marker.** Contact key form
   `ddemo-<slug>-<n>`. Both sandbox tables carry a `demo_slug` column. A purge
   must be one filter, not an archaeology exercise.

8. **`stock_count` is never fabricated.** If the scrape did not produce a real
   stock figure, omit the column. Do not send `0` and do not send `1`.
   `Number(null)` is `0` in JavaScript, and that exact trap has shipped a bug
   twice on the core repository: every product announced as out of stock,
   poisoning every back-in-stock segment. Same rule for `price` on any product
   whose price could not be read.

9. **Everything in this repository is customer-facing.** Code comments, UI
   strings, commit messages, test output, issue templates. Write all of it as
   product documentation. Internal notes and vendor correspondence go to Salil
   directly, not into a file here.

10. **No em dashes or en dashes** in anything written here. Commas, periods,
    colons, or rephrase.

11. **Never delete or truncate anything in Dengage without written approval
    from Salil, obtained beforehand, for that specific object.** Dropping a
    table, truncating one, deleting rows, deleting or merging contacts,
    removing a campaign or a creative. All of it, every time, no exceptions
    and no inference from context. An offer to handle something manually is
    not an approval.

    The Data Space is shared with five live demo sites and two mobile apps, a
    drop cannot be undone from this side, and nothing about a demo reveals that
    it happened. Reading is always fine: inspect, count, report what you would
    remove, then ask.

    **This binds the 90 day purge in §10**, which is this same action on a
    timer. See CLAUDE.md §1a, which is the copy that gets read at the start of
    every session.

---

## 2. The Dengage side: one-time setup

**None of this is automatable except the tables, and nothing works until it is
done.** Do this first, before building the generator, because it is also how
you will test.

### 2.0 Turn GitHub Pages on, before anything else

Repository Settings, then Pages, source set to the **`main` branch, root
folder**. It takes a minute or two to publish.

This is step zero and it is easy to miss, because every other page in this
document assumes the site is already reachable. Until Pages is on:
`https://dengage-presales.github.io/demo-ai/` returns not found, no demo can be
live, and the push icon URL in §2.5 will be rejected by the panel for pointing
at nothing.

The web application form in §2.1 can be filled in before the site is live. The
panel accepts the domain either way. It just has to be live before a real demo
is.

### 2.1 The web application

Create a **new web application in account 28**, separate from the BFSI
application that the core demos use. Salil has confirmed this is possible.

You need from Salil:

- the account id (the core demos use `28`)
- the new application's **app guid**
- the resulting SDK loader URL, which follows the pattern
  `https://pcdn.dengage.com/p/push/<accountId>/<appGuid>/dengage_sdk_loader.js`

Form values, so this is filling in a form rather than a decision:

| Field | Value |
|---|---|
| Name | `DND - PreSales eComm [Salil]` |
| Site Domain URL | `https://dengage-presales.github.io` |
| Icon/Badge URL | `https://dengage-presales.github.io/dengage-push-icon.png` |

**Corrected: the icon sits at the origin root, not under `/demo-ai/`.** It is a
required field, the panel rejects a URL that does not resolve, and this
repository's Pages site is published under `/demo-ai/` rather than at the root.
The origin root is the `Dengage-PreSales/dengage-presales.github.io`
repository, which is already published, so an icon there resolves immediately
and stays valid however this repository's Pages setting changes. The same file
is kept here at `assets/dengage-push-icon.png` as the source of truth.

**Site Domain URL takes the origin only, with no path and no trailing slash.**
Every demo ever built sits underneath that one address, so it is filled in once
and covers all of them. Putting the full path to one demo there would scope the
application to that demo alone.

The icon is optional on the first pass and the panel may reject it until **both**
§2.0 is done and the file exists at `assets/dengage-push-icon.png`, since the
URL resolves to nothing before then. Push works without it. Come back and paste
it once the site is live.

Advanced settings on the new application, all four of them:

| Setting | Value | Why |
|---|---|---|
| Trigger Initialize on Install | **off** | the page snippet calls `initialize()` itself |
| Trigger Page View on Initialize | **off** | `js/pageView.js` sends the page view with real parameters; leaving this on double-counts every page |
| Disable `setNavigation` | **on** | |
| Allow connecting multiple contacts to single device | off | |

The first two are not preferences. Getting them wrong produces double-counted
page views that nobody notices until a prospect asks why the numbers look odd.

### 2.2 The eight campaigns

One campaign per slug, built once, serving every demo forever.

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

| Trigger name | Layout | Design settings |
|---|---|---|
| `dengage_demo_survey` | Popup | width 460 to 480, padding 0, transparent background |
| `dengage_demo_nps-popup` | Popup | width 460 to 480, padding 0, transparent background |
| `dengage_demo_subscription-popup` | Popup | width 460 to 480, padding 0, transparent background |
| `dengage_demo_image-popup` | Popup | width 460 to 520, padding 0, transparent background |
| `dengage_demo_horizontal-popup` | Popup | width 640 to 720, padding 0, transparent background |
| `dengage_demo_cta-image-popup` | Popup | width 440 to 480, padding 0, transparent background |
| `dengage_demo_sticky-bar` | **Banner**, position Top, keep in place on scroll | padding 0, transparent background |
| `dengage_demo_image-bar` | **Banner**, position Bottom, keep in place on scroll | padding 0, transparent background |

> **On the spellings.** The core repository's campaigns carry three deliberate
> misspellings (`subscripton-popup`, `stickey-bar`, `horizonal-popup`) because
> its panel contract was set that way years ago and correcting them would take
> live widgets dark. This is a fresh contract with nothing depending on it, so
> the spellings above are **corrected**, on Salil's instruction. Do not copy the
> misspellings across from any core-repo document you may be shown.

**Why padding 0 and a transparent background:** the engine's own container
otherwise draws a white box around the card, which reads as an unwanted frame
on screen. The creative supplies its own white, corner radius and shadow.

**Why the two bars are Banner and not Popup:** the Banner container is already
fixed and full width, so the content just fills it. Do not switch them to Popup
and do not add `position: fixed` to the creative.

**Popups draw no close button of their own.** The panel supplies it, via
Layout > Close Button > "Add close button to outside". A second one inside the
card reads as a duplicate. The two banners keep their own, because the Banner
layout is not offered that setting.

### 2.2a What the eight creatives can actually say

**The hardest constraint in this design, and the one most likely to be
discovered late.** One creative serves every demo, forever. So a creative
cannot name a brand, a product, a price, a currency or a vertical. It cannot
say "20% off outdoor jackets" because next week the same campaign renders on a
demo selling industrial fasteners.

It also cannot use `{%= ... %}` customization tags to fill the gap, because
those are refused on real-time On-Site Targeting triggers. See §12.8. That
closes the obvious escape route, so design around it from the start rather than
discovering it in Phase 1.

What is left is genuinely enough, because **the point of these widgets is to
demonstrate the mechanism, not to sell the product.** A prospect watching a
demo is evaluating whether Dengage can put the right message in front of the
right person at the right moment. Write to that.

| Slug | What it demonstrates | Copy direction |
|---|---|---|
| `survey` | native input capture into contact tags | one question, three or four generic interest options, no vertical wording |
| `nps-popup` | NPS capture and tag-based segmentation | the standard 0 to 10 scale, "How likely are you to recommend us" |
| `subscription-popup` | contact creation with permissions | email field, marketing permission checkbox, generic welcome offer with **no number in it** |
| `image-popup` | rich creative, full-bleed image | brand-neutral lifestyle artwork, generic headline |
| `horizontal-popup` | a wider layout, image beside copy | same, landscape composition |
| `cta-image-popup` | image plus a single measured CTA | one clear action, `Dn.sendClick` on it |
| `sticky-bar` | persistent top-of-page messaging | one line, generic, dismissible |
| `image-bar` | bottom banner with artwork | one line plus a small image |

Three consequences to design in:

- **Artwork must be brand-neutral and committed**, same rule as the storefront:
  the creatives are pasted into the panel, so any image they reference must be
  a stable absolute URL on your Pages origin, never a prospect's CDN.
- **The offer must be non-specific.** "A welcome offer for new subscribers" is
  demonstrable on any vertical. "10% off your first order" invites a prospect
  to ask why the discount does not match their margins.
- **The CTA cannot navigate anywhere.** See below. This one is not obvious and
  it was found by reading the reference creatives rather than by reasoning.

#### The CTA problem, and why report-and-dismiss is the only answer

Every CTA in the reference creatives is an **absolute URL to one specific
site**. That cannot survive a creative shared across every demo: the link would
send a prospect looking at their own themed storefront to a tyre distributor in
Brazil.

The obvious fix does not work. A **relative `href` resolves against the
iframe's origin, not the host page's**, because popups and banners render in a
cross-origin iframe (§12.2). So a relative link inside a popup does not point
at the demo it appears on. There is no URL that is correct for every demo,
because the whole point of the shared campaign is that it does not know which
demo it is rendering on.

So the six popups and two banners get a CTA that **reports the click and
dismisses**, rather than one that navigates:

```html
<button onclick="Dn.sendClick('<scenario>__cta'); Dn.close();">…</button>
```

The click is still counted, the campaign report still shows engagement, and the
prospect stays on the storefront they were looking at, which is where you want
them during a demo anyway.

**The five inline slots are unaffected.** Inline creatives are not sandboxed
(§12.3): they are cloned into the host page and their anchors resolve against
the page, so an inline CTA can link normally and its clicks are counted without
`Dn.sendClick()` at all.

If a prospect wants a creative that speaks to their business specifically, that
is a bespoke campaign someone builds in the panel for that call. It is not a
change to the shared eight, and changing one of the eight changes it for every
live demo at once.

### 2.3 The two tables

> ### CORRECTED: these are NOT automatable, and the reason is the table type
>
> An earlier draft opened this section with "These **are** automatable", and
> built the §2.4 argument on it. That is wrong, and it was found by creating
> them and looking at the result.
>
> **Dengage has five table types.** The panel offers Regular, Big Data,
> Sendable Contact List, Sendable Token List, and Remote. Event and analytics
> data belongs in **Big Data**: the panel's own description is "used for
> storing external event and analytics data, create relations with these tables
> and use them for segmentation". The reference build says so too, in a comment
> at the top of `cantuCatalog.js` instructing the reader to create a Big Data
> table with that name.
>
> **`CreateTable` cannot make one.** The request body has exactly five fields,
> `name`, `columns`, `contactKeyColumn`, `description` and `folderId`, and
> **none of them selects a type**. The API decides for you: with
> `contactKeyColumn` set it creates a **Sendable** table, without it a
> standalone one. There is no third outcome.
>
> A Sendable table is a send list, an audience you can mail or push to. Using
> one to collect launcher clicks is the wrong shape, and in a shared account it
> puts two fake audiences in front of everyone else using it.
>
> **So the two tables are created by hand, in the panel, as Big Data tables,
> once.** §2.4's conclusion survives intact and its reasoning does not: it is
> not that tables are automatable and campaigns are not, it is that
> **everything panel side is manual and all of it is one time.** No per demo
> panel work, which is the promise that actually matters, is unaffected.
>
> `factory/phase0/tables.mjs` no longer creates anything. It prints the
> exact specification to enter, and it can verify what exists afterwards. See
> §2.3a for the panel steps and the relations.

Reference: https://dev.dengage.com/reference/createtable

Four things about the API, all confirmed by calling it rather than by reading
about it. They matter for the verify and purge paths, which do use it.

- **There is no bearer token to be handed.** Authentication is an **API user**,
  created in the panel under Configuration, Users, New User, which yields a
  **user key and a password**. Those are exchanged at
  `POST /rest/login`, body `{"userkey": ..., "password": ...}`, for an
  `access_token` good for 3600 seconds, then sent as
  `Authorization: Bearer <access_token>`. Dengage's guidance is explicit that
  logging in before every call is wrong and can get the requests blocked, so
  log in once and reuse.

- **The API is IP allowlisted**, and it refuses on the address *before* it
  looks at the credentials, with HTTP 403 and the reason in `actionResult`
  rather than in `message`. The default reading of a 403 on a login call is
  "wrong password", so this is worth detecting precisely. §14.2 flagged this as
  a risk to confirm. It is confirmed, and see §10 for what it costs the purge.

- **The accepted column types** are `TEXT`, `INTEGER`, `DATE`, `BOOLEAN`,
  `EMAIL`, `PHONE` and `DECIMAL`.

- **Useful read and cleanup endpoints**, for the verify step and for §10:
  `GET /rest/dataspace/tables`, `GET /rest/dataspace/tables/{tableId}`,
  `DELETE .../{tableId}/truncate`, `DELETE .../{tableId}/drop`, and
  `DELETE /rest/dataspace/sync/delete` or `/async/delete` for rows. **Every one
  of the deleting endpoints is covered by §1.11 and needs written approval
  first.** `drop` also requires the table to already be empty.

Both tables need a **`contact_key` column of type TEXT, named as the
`contactKeyColumn`**. The API requires that column to be text, and without it
the rows cannot be joined to a contact, which is most of what you are
demonstrating. `key`, `event_date`, `session_id`, `event_type`, `event_id` are
filled by the SDK or the platform, never by the site, so do not declare them.

**Table 1, `sandbox_onsite_events`.** One row per widget fired from the
launcher.

```json
{
  "name": "sandbox_onsite_events",
  "columns": [
    { "name": "contact_key",    "type": "TEXT" },
    { "name": "demo_slug",      "type": "TEXT" },
    { "name": "event_name",     "type": "TEXT" },
    { "name": "scenario_group", "type": "TEXT" },
    { "name": "widget_name",    "type": "TEXT" },
    { "name": "page_type",      "type": "TEXT" },
    { "name": "page_url",       "type": "TEXT" }
  ],
  "contactKeyColumn": "contact_key",
  "description": "Demo Factory: scenario launcher clicks, all demos"
}
```

**Table 2, `sandbox_events`.** One row per storefront interaction. This is the
table that replaces every standard ecommerce table, so it has to carry the
union of what those interactions need. Deliberately wide and mostly nullable:
one table for every event is what keeps the purge to a single filter.

```json
{
  "name": "sandbox_events",
  "columns": [
    { "name": "contact_key",  "type": "TEXT" },
    { "name": "demo_slug",    "type": "TEXT" },
    { "name": "event_name",   "type": "TEXT" },
    { "name": "product_id",   "type": "TEXT" },
    { "name": "product_name", "type": "TEXT" },
    { "name": "category_path","type": "TEXT" },
    { "name": "quantity",     "type": "INTEGER" },
    { "name": "unit_price",   "type": "DECIMAL" },
    { "name": "total_value",  "type": "DECIMAL" },
    { "name": "currency",     "type": "TEXT" },
    { "name": "order_id",     "type": "TEXT" },
    { "name": "search_term",  "type": "TEXT" },
    { "name": "result_count", "type": "INTEGER" },
    { "name": "list_name",    "type": "TEXT" },
    { "name": "page_type",    "type": "TEXT" },
    { "name": "page_url",     "type": "TEXT" }
  ],
  "contactKeyColumn": "contact_key",
  "description": "Demo Factory: storefront events, all demos"
}
```

The `event_name` values written into it, which is the full vocabulary:

| `event_name` | Fired by | Columns it fills beyond the common four |
|---|---|---|
| `demo_add_to_cart` | cart | `product_id`, `product_name`, `category_path`, `quantity`, `unit_price`, `currency` |
| `demo_remove_from_cart` | cart | `product_id`, `quantity` |
| `demo_begin_checkout` | checkout | `total_value`, `currency`, `quantity` |
| `demo_order_completed` | checkout | `order_id`, `total_value`, `currency`, `quantity` |
| `demo_search` | search panel | `search_term`, `result_count` |
| `demo_wishlist_add` | wishlist | `product_id`, `product_name`, `list_name` |
| `demo_wishlist_remove` | wishlist | `product_id`, `list_name` |
| `demo_product_view` | product page | `product_id`, `product_name`, `category_path` |

Common four on every row: `contact_key`, `demo_slug`, `event_name`,
`page_url`.

**`unit_price` and `total_value` are omitted, not zeroed, when the scrape did
not produce a price.** Non-negotiable 8. `Number(null)` is `0`, and a table
full of zero-value orders is worse than a table with gaps.

Both tables are shared by every demo. `demo_slug` is what separates them and
what the 90 day purge filters on.

### 2.3a Creating the two tables in the panel, and relating them

Done once, by hand, because §2.3 above establishes that the API cannot produce
the right type.

**For each of the two tables:** Data Space, Tables, New, and pick **Big Data**.
Not Regular, which is for data linked on primary keys rather than for events.
Not either Sendable type, which are send lists. Enter the name, the description
and the columns exactly as the two definitions above give them.

**`contact_key` is nullable on a Big Data table, and should be left nullable.**
This is the opposite of what the API forced, and the difference is the type. A
Sendable table is an audience, so its contact key cannot be empty; the API
refuses one with `ContactKey or PrimaryKey column cannot be nullable!`. A Big
Data table has no such requirement, and Dengage's own star schema documentation
says `contact_key` is nullable there precisely so that **anonymous,
unauthenticated devices can still record rows**.

That matters more than it sounds. §6.2 has anonymous visitors staying anonymous
as correct behaviour. Had these stayed Sendable, every event from an anonymous
visitor would have been rejected, and the demo would silently record nothing
until someone signed up.

**Then relate each table to `master_contact`.** Dengage is a star schema built
around `master_contact` and `master_device`, and a custom table earns its place
in segmentation by being related to it.

| | |
|---|---|
| Where | the **Connect Toolbox**, upper right of the table, then **New Relation** |
| From | `sandbox_onsite_events.contact_key`, and separately `sandbox_events.contact_key` |
| To | `master_contact.contact_key` |
| Cardinality | one to many. One contact, many event rows |

Relations are created in the panel only. There is no API for them, which is the
same shape as the campaigns in §2.2 and for the same reason: it is one time
setup, not per demo work.

**What the relation buys**, and why it is not optional: without it the two
tables are inert stores. With it, the Interactive Segment tools can build
segments across them, which is the thing a prospect is actually being shown.
"Everyone who fired the NPS widget and did not complete checkout" is a segment
only if the relation exists.

Reference: https://dev.dengage.com/docs/star-schema-relational-database

### 2.4 What the API cannot do

I checked the published API reference. **On-site campaigns cannot be created by
API.** The documentation exposes a Public Id for *updating* an existing on-site
campaign and nothing for creating one. The categories published are
Authorization, Contact, Dataspace, Content, Settings, Logs and Transactional.

This is precisely why §1.2 matters: if campaigns had to be created per demo,
the whole "no panel work" promise would collapse. Do not design anything that
assumes campaign creation can be scripted.

### 2.5 Web push, phase 1

In scope. Configure the push domain on the new web application, pointed at the
Pages origin.

**Corrected: the service worker is not in this repository.** An earlier draft
put it at "the repository root", which assumed this repository served the
origin root. It does not. `demo-ai` is a *project* Pages site published under
`https://dengage-presales.github.io/demo-ai/`, so a worker committed here is
scoped to `/demo-ai/` and covers nothing above it.

| | |
|---|---|
| Repository | `Dengage-PreSales/dengage-presales.github.io` |
| Served at | `https://dengage-presales.github.io/dengage-webpush-sw.js` |
| Scope | `/`, the whole origin, so it covers every demo |

That is the correct arrangement and it is already in place. A service worker's
scope is its path, so the file has to sit above every demo it serves, and the
origin root is the only place that is true. Note the filename, which is
`dengage-webpush-sw.js` rather than the `dengagewebpushsw.js` the reference
build uses.

The file is account agnostic: it reads the account id and app guid from its own
query string and imports the real worker from the Dengage CDN, so one copy
serves any application and nothing in it changes per demo.

One property to know and to tell pre-sales: **push subscriptions are per
origin, and every demo shares one origin.** A browser that subscribed while
looking at demo A is subscribed for the whole sandbox. For the intended use,
which is composing a push in the panel during a call and having it arrive on
screen, this is fine and arguably better. It is not a bug, so do not try to fix
it.

### 2.5a Why the GitHub account is separate

**Resolved. Recorded so nobody consolidates the accounts later for tidiness.**

The factory was originally specified to live at
`https://salil-dengage.github.io/demo-ai/`, alongside the core demos at
`https://salil-dengage.github.io/dengage-demos/`. Decision 12 recorded "use the
default Pages address" as settled, on the unexamined assumption that the
address belonged to this project alone. It did not.

**A browser does not care about the path.** Both of those are one origin, and
an origin is the unit of isolation for the things that matter here:

| | Scoped by path, so genuinely separate | Shared across the whole origin |
|---|---|---|
| Service worker file | yes | |
| Push subscriptions | yes | |
| `localStorage` and `sessionStorage` | | **yes** |
| Notification permission | | **yes** |

The second column is the problem. The Dengage SDK keeps its device id, contact
key and display state in browser storage. Two web applications sharing one
origin share that storage, so a prospect browsing a factory demo could
overwrite the stored identity the live demo sites depend on. Silent, and it
touches the assets the team actually sells with. Separately, anyone pressing
"Block" on a factory demo blocks push on the core demos in that browser.

**The fix was a separate origin, not a mitigation.** The factory now lives
under a separate GitHub account, `Dengage-PreSales`, giving it its own
`github.io` subdomain. Different origin, so the browser itself enforces the
separation and none of the above is reachable.

Two consequences that must not be undone:

1. **Nothing for this project is ever published under `salil-dengage`.** An
   earlier `salil-dengage/demo-ai` was abandoned rather than migrated; it must
   be deleted, or at minimum have Pages left off, because the moment it
   publishes it serves from the shared origin and reintroduces the whole
   problem. If anyone proposes recreating it, this section is why they should
   not.
2. **A destructive control still names what it clears.** The Phase 0 probe's
   "reset widget display state" button originally wiped every Dengage-looking
   key in storage, which on a shared origin reached the core sites' state. It
   now lists exactly what it will clear and requires a second press. On a
   separate origin it can no longer do harm, and it stays that way regardless:
   a destructive control that says what it is about to do is better behaviour
   whether or not the blast radius is contained.

**What a separate GitHub account does NOT separate: Dengage.** The sandbox web
application still sits inside account 28, so the Data Space, every table and
every contact are still shared with the five core demo sites and the two mobile
apps. The `ec:*` prohibition (§1.3), the table allowlist (§11) and the event
panel fix (§5.3) remain the only things protecting them. Do not let the account
split create a false sense of safety. See §14.4.

### 2.6 Re-running a widget during a call

Operationally the most important thing pre-sales will hit, and the reason for
two of the settings in §2.2.

A campaign has a display frequency. Fire the same widget twice in a demo and
the second one may not appear, which on a call looks like a broken product.
`Show every X minutes = 1` and `Max show count = 100` are set the way they are
to make repeat firing survivable, not as arbitrary values. Do not "tidy" them.

Even with those settings, the SDK holds local display state in the browser. If
a widget stops appearing mid-demo, the fix is clearing that state, not
rebuilding the campaign. Build a small reset control into the scenario launcher
so a pre-sales person can do it themselves without a console. The core
repository has an equivalent and it is used constantly.

### 2.7 Deliberately out of scope for phase 1

Named here so nobody rediscovers them as gaps.

| Out of scope | Why, and what it would take |
|---|---|
| **Recommendations** | Phase 2, Salil's call. Needs a product feed uploaded per application in the panel, per demo, which reintroduces exactly the per-demo panel work the shared-prefix design exists to eliminate. Solving that is its own design problem |
| **A/B testing** | The creatives are standardized and shared across every demo, so there is no per-demo variant to test. The core repository's A/B campaign is not carried over |
| **Mobile apps** | Web only. No Android or iOS surface in this repository, in any phase |
| **A second language** | English only. See §14.5 for the one thing to get right now so adding one later is not a rewrite |
| **Post-generation editing** | A generated demo is not hand-edited. If a demo needs a different headline or price, that is a generator feature or a config field, never a manual edit under `demos/` |

---

## 3. Repository layout

```
demo-ai/
  DEMO-FACTORY-HANDOFF.md       this file
  README.md                     what this is, how a pre-sales person uses it
  CLAUDE.md                     the operating rules, short, pointing here
  .nojekyll

  seed/                         TEMPORARY, see §3.1. Delete at end of phase 1
    site/en/                    reference storefront
    panel-content/en/           reference creatives, the easy one to forget

  template/                     the storefront, brand-free, never served
    index.html
    product.html
    style.css                   all brand decisions live in the :root block
    js/                         the modules, see §5
    vendor/

  demos/
    <slug>/                     one generated demo, self-contained
      index.html
      product.html
      style.css
      demo.config.json          §4, the only file that differs by brand
      products.json             the catalogue
      images/                   committed, compressed, local
      js/
      vendor/

  assets/
    dengage-push-icon.png       the push badge, 1200x1200, referenced by §2.1

  factory/
    sandbox.json                the account id and app guid, the only copy
    phase0/                     the panel bring-up kit, built in Phase 0
      README.md                 the panel checklist, step by step
      tables.mjs         §2.3, idempotent, safe to run twice
      probe/                    the page that proves the panel works
      creative/                 a generic card to paste for the Phase 0 check
    guard/                      §11, the CI guardrails. Build these early
      run.sh                    the checks
      test.sh                   the checks, checked against known-bad input
      fixtures/naive-copy/      that known-bad input
      README.md                 what each check is for, and which three matter
    scrape/                     §7.1, the three-tier catalogue reader
    theme/                      §7.2, brand token extraction
    art/                        §7.3, placeholder generation
    build/                      §7.4, template plus config to a demo folder
    smoke/                      §9, the acceptance check
    purge/                      §10

  .github/
    ISSUE_TEMPLATE/new-demo.yml §8, the pre-sales dialog box
    workflows/
      build-demo.yml            issue opened, build, commit, merge, comment
      purge.yml                 scheduled, 90 day retention
      guard.yml                 §11, CI guardrails
```

`template/` is never served and never has a brand in it. A demo is
`template/` plus `demo.config.json` plus a catalogue plus artwork. If you find
yourself hand-editing a file under `demos/`, the generator is missing a
feature.

### 3.1 `seed/`, and why it exists

`seed/` holds two folders copied from the core repository and committed here by
Salil before this work started:

```
seed/
  site/en/           = cantu-pneus/en/                the reference storefront
  panel-content/en/  = cantu-pneus/panel-content/en/  the reference creatives
```

Note the `en/` level on both. An earlier draft of this document wrote them as
`seed/site/` and `seed/panel-content/`, which is one directory short of where
the files actually are.

**Both are needed, and the second is the one that is easy to miss.** The eight
creatives do not live inside the site folder; they live in a sibling directory,
because they are pasted into the Dengage panel rather than served by the site.
Phase 1 requires authoring eight standardized creatives (§2.2a), and these
eight are working reference implementations of every rule in §12: the
cross-origin iframe constraints, `Dn.sendClick` placement, `Dn.close()` on the
dismiss control, the `data-dn-form-id` capture mechanism, and the
visually-hidden class that §12.7 warns against deleting. Writing them from
prose alone, with those files one directory away and uncopied, is a wasted day.

Ignore `seed/panel-content/en/ab-testing/`: A/B testing is out of scope (§2.7).

**What `seed/site/en/` already contains**, verified rather than assumed: its own
stylesheet, 25 JavaScript modules, a main script, product artwork, `vendor/`, a
product feed and a service worker. It references no file outside itself. The
only external hosts it calls are Google Fonts, the Dengage SDK CDN, and a tag
manager that must be removed (§12.9).

**One thing in `seed/site/en/` will break here and must be fixed during the
de-brand:** six links to `../index.html` and `../product.html`, the language
switcher pointing at the Portuguese site. There is no parent site in this
repository, so all six 404. Remove the language switcher entirely; the demos
are English only (§2.7).

It exists because **a session building this must not open
`salil-dengage/dengage-demos`, even though it can.** See §1.1: the boundary is
instruction, not structure. Reaching into the repository that holds the live
sales assets, purely to copy one folder out of it, is exactly the kind of
"just this once" that the rule exists to refuse. Copying the folder in ahead of
time costs one commit and removes the temptation entirely.

**Delete `seed/` once `template/` is built.** It is scaffolding. If it is still
present at the end of Phase 1, something in the fork was left unfinished, and a
stale copy of another repository's brand assets sitting in a public repository
is exactly the kind of thing nobody notices for a year.

---

## 4. The demo config contract

One file per demo, and the only place a brand decision is allowed to live.
Everything downstream reads from it.

```json
{
  "slug": "northfield-outdoor",
  "displayName": "Dengage eComm Demo",
  "sourceUrl": "https://www.example.com",
  "createdAt": "2026-08-03",
  "expiresAt": "2026-11-01",

  "theme": {
    "primary":    "#1F5C3D",
    "onPrimary":  "#FFFFFF",
    "accent":     "#E4A11B",
    "ink":        "#14181B",
    "muted":      "#6B7280",
    "surface":    "#FFFFFF",
    "page":       "#F6F7F8",
    "radius":     "12px",
    "displayFont": "Sora",
    "bodyFont":    "Inter"
  },

  "locale":   { "language": "en", "currency": "USD", "currencySymbol": "$" },

  "dengage": {
    "accountId":     "28",
    "appGuid":       "<sandbox app guid>",
    "scenarioPrefix": "dengage_demo_",
    "onsiteTable":   "sandbox_onsite_events",
    "eventsTable":   "sandbox_events"
  },

  "categories": ["Jackets", "Footwear", "Packs"],
  "productCount": 28
}
```

Rules:

- `slug` is the namespace. Element ids, CSS classes, the localStorage cart key
  and custom event names all derive from it. Two demos in one browser must not
  see each other's cart.
- `theme` maps one to one onto the `:root` custom property block at the top of
  `style.css`. Nothing downstream in the stylesheet hard-codes a color.
- `displayName` is always the Dengage demo name, never the prospect's. It is in
  the config only so the template has one source for it.
- `sourceUrl` is recorded for traceability and for the purge report. It is not
  rendered on the page.

---

## 5. The storefront template

Start from **`seed/site/en/`** (§3.1), which is a copy of the CantuPneus English
site, the reference build in the core repository. Strip it to a brand-free
`template/`. Salil confirmed there is nothing in that machinery to exclude, so
this is a de-branding job rather than a selection job.

The de-brand, concretely:

1. Replace every `CantuPneus`, `cantupneus`, `Cantu`, `cantu` and `CANTU-`
   token across the HTML, the modules and the stylesheet with the demo slug.
   This is what keeps element ids, CSS classes, the localStorage cart key and
   the custom event names from colliding between two demos open in one browser
   (§1.6). Rename `cantuCatalog.js` accordingly.
2. Reduce the stylesheet's brand surface to the `:root` token block.
3. Remove the tag manager entirely (§12.9).
4. Remove the language switcher (§3.1).
5. **Retarget all five modules in §5.3**, including the runtime fix to the
   event panel. Do this before any of them runs even once.
6. **Strip `KNOWN_CONTACTS` from `identity.js`.** The reference copy maps
   `salil@dengage.com` to the contact key `salil-demo`, which is Salil's own
   contact on the core account and which §6.2 says never to use. Left in place,
   anyone signing up on a generated demo with that address attaches their test
   traffic to it. Remove the mapping, keep the resolution order.
7. The service worker needs no de-branding: the reference copy is already
   account agnostic.

### 5.0 The agreed feature set

Signed off by Salil. Anything not on this list is out of scope unless he adds
it.

| Feature | Where it lives |
|---|---|
| Home page: hero, category rails, product grid | `index.html` |
| Product listing and filtering | `index.html` |
| Product detail | `product.html` |
| Cart | drawer, not a page |
| Checkout | modal flow, not a page. See §5.3 |
| Search | slide-in panel. See §5.3 |
| Wishlist / saved items | drawer. See §5.3 |
| Scenario launcher, all eight widgets | in-page panel, §5.1 |
| Five inline slots | §5.2 |
| Event panel | in-page, writes `sandbox_events` |

Shape of it:

- **Two pages.** `index.html` (home, hero, category rails, product grid) and
  `product.html` (detail, gallery, add to cart, similar products). Cart,
  checkout, search and wishlist are all overlays on those two pages, which is
  how the reference build does it. Two pages is the whole site.
- **A stylesheet** whose entire brand surface is the `:root` token block. If a
  color appears anywhere below that block, the theming will not work.
- **Roughly 25 JavaScript modules**, all vanilla, no build step, no framework.
  The core repository's set covers: catalogue loading, product list, product
  detail, cart, cart UI, search panel, wishlist, wishlist UI, identity, page
  view, similar products, product rails, the scenario launcher, the event
  panel, several banner and slot offset helpers.

  > **On the rails, and this is a real contradiction to resolve rather than a
  > detail.** The reference build's rails are fed by **Dengage
  > recommendations**, which are out of scope until Phase 2 (§2.7). In Phase 1
  > the rails must render from the demo's **own local catalogue**: "similar in
  > this category", "also viewed", picked in the generator, shipped in
  > `products.json`. They look identical on screen and they demo well. What they
  > must not do is call a recommendation container that does not exist for this
  > application, which fails silently and leaves an empty rail on the page
  > mid-call. When recommendations land in Phase 2, the rails swap their data
  > source and nothing else changes.
- **No build step at all.** Static files served directly by Pages. This is
  deliberate. A demo that needs a compile is a demo that can fail to compile
  fifteen minutes before a call.

### 5.1 The scenario launcher

The in-page panel that lets a pre-sales person fire any of the eight widgets on
demand during a call. This is the single most important piece of the demo and
it is what the whole panel setup in §2.2 exists to serve.

Per card it pushes to `window.dataLayer`:

```js
window.dataLayer.push({
  event:      'dengage_demo_' + slug,
  actionType: 'dengage_demo_' + slug
});
```

and separately records the click to the sandbox table:

```js
window.dengage('sendDeviceEvent', 'sandbox_onsite_events', {
  demo_slug:      config.slug,
  event_name:     'dengage_demo_' + slug,
  scenario_group: group,
  widget_name:    name,
  page_type:      pageType,
  page_url:       location.href
});
```

The SDK watches `window.dataLayer` itself, so campaigns set to Data Layer Event
fire with **no GTM involvement**. See §12 for why that matters.

### 5.2 The five inline slots

Inline campaigns inject into the page's own flow at a target selector. Five
slots, at these anchors, on every demo:

| Slot id | Anchor |
|---|---|
| `dn_inline_target_below_header` | immediately after `</header>` |
| `dn_inline_target_below_hero` | after the hero block, home page |
| `dn_inline_target_in_grid` | inside the product grid |
| `dn_inline_target_pdp_below_price` | product page, under the price block |
| `dn_inline_target_above_footer` | immediately before `<footer>` |

`dn_inline_target_below_header` sits directly beneath a fixed header and will
render *behind* it without a clearance. The clearance cannot be a constant: the
header changes height on scroll and again when a Dengage top banner is pinned.
Carry over the core repository's `js/inlineSlotOffset.js` approach, which
measures the header's actual bottom edge and publishes it as
`--dn-header-clearance` on `:root`, with a fallback in CSS in case the module
never runs.

### 5.3 Five modules that CANNOT be copied across as they are

**This is the most consequential implementation note in this document.** The
reference build is an ecommerce site that uses the Dengage ecommerce API. This
repository must not. Copying these five modules unchanged silently violates
non-negotiable 3 on day one, and the violation is invisible from the rendered
page: the demo will look perfect while writing rows into tables shared with the
live sales assets.

This list is **exhaustive**, verified by enumerating every `sendDeviceEvent`
call, every table-name literal and every `ec:` call in the reference build.
There is no sixth module. It was four in an earlier draft of this document, and
the fifth is the one that proves the point: it was found by reading the code
rather than trusting the specification.

| Module | What it does today | What it must do here |
|---|---|---|
| `cartManager.js` | calls `ec:addToCart`, `ec:removeFromCart`, `ec:deleteCart`, `ec:beginCheckout`, `ec:order`, writing `shopping_cart_events`, `order_events` and `order_events_detail` | `sendDeviceEvent` to `sandbox_events` with `event_name` of `demo_add_to_cart`, `demo_remove_from_cart`, `demo_begin_checkout`, `demo_order_completed` |
| `searchPanel.js` | calls `ec:search`, writing `search_events` | `sendDeviceEvent` to `sandbox_events`, `event_name` `demo_search` |
| `wishlist.js` | writes `wishlist_events` directly by `sendDeviceEvent` | same mechanism, retargeted to `sandbox_events`, `event_name` `demo_wishlist_add` and `demo_wishlist_remove` |
| **`cantuCatalog.js`** | the scenario launcher. Writes `onsite_events` through `sendDeviceEvent` | retarget to `sandbox_onsite_events`, and add `demo_slug` |
| `eventModal.js` | the event panel. Both mechanisms, plus a runtime hole. Writes `page_view_events`, `shopping_cart_events`, `wishlist_events`, `order_events` and `events` | see the subsection below. This is more than a copy rewrite |

**Why `cantuCatalog.js` is the dangerous one to miss.** It makes no `ec:` call
and names none of the five standard ecommerce tables, so a denylist grep for
those five passes it cleanly. It writes to `onsite_events`, a core-account
table, from the first demo onwards, silently. This is the single reason §11
uses an allowlist rather than a denylist.

So checkout, search, the wishlist and the launcher all still work and still
look exactly like an ecommerce demo. They simply report to the sandbox.

#### `eventModal.js` has a runtime hole that CI cannot close

An earlier draft described this module's fix as "rewritten copy". That is wrong
and understating it is dangerous. The event panel renders a **free-text input
for the table name** and sends to whatever is typed into it:

```js
const tableName = tableInput.value.trim();
...
window.dengage('sendDeviceEvent', tableName, payload);
```

**Every guard in this design is static analysis, and this input routes around
all of it at demo time.** CI greps source code. It cannot catch a pre-sales
person typing `order_events` into a text box during a live call, which is a
plausible thing to do while demonstrating "I can write to any table". It passes
every check in §11 and writes to a core-account table, in front of a prospect,
in the hands of the person least likely to know why it matters.

The fix has to be at runtime. Do both halves:

1. Replace the free-text input with a **hard-coded dropdown** offering only
   `sandbox_events` and `sandbox_onsite_events`.
2. **Validate again at the call site** against the same two names, and refuse
   anything else visibly rather than silently.

Then rewrite the card copy, which currently describes `ec:*` calls and the
standard tables to the audience on screen. A card that announces `order_events`
while writing `sandbox_events` is worse than no card.

The demo loses nothing. What the panel demonstrates is that a custom event
lands in a custom table, not that the operator may name it freely.

§9 asserts this, and §11 cannot.

#### A sixth module, for a different reason: `productCatalog.js`

**Added after reading the reference build rather than this document.** The list
above is exhaustive for what it claims to cover, which is table writes and
`ec:` calls. `productCatalog.js` makes neither, so it is correctly absent from
it. It still cannot be copied across unchanged, and the reason is
non-negotiable 8 rather than non-negotiable 3.

It normalizes a product whose price could not be read to a price of zero:

```js
price: Number.isFinite(price) ? price : 0,     productCatalog.js
price: Number.isFinite(price) && price > 0 ? price : 0,   wishlist.js
```

That is the `Number(null) === 0` trap, already shipped, sitting in the file the
whole storefront reads its catalogue through. Every downstream module inherits
it: the grid, the cart, `pageView`, and every `sandbox_events` row carrying
`unit_price` or `total_value`.

The same file gets `stock` right, returning `null` when the catalogue does not
track it, with a comment explaining why. Price and stock are handled
differently three lines apart, which is exactly what makes this easy to read
past.

**Both must become `null`, and every payload builder must drop null keys rather
than send them.** Dropping the key is the part that actually keeps the column
empty: a builder that leaves `unit_price` as `null` and hands it to the SDK
sends a zero anyway. `factory/phase0/probe/probe.js` has the `compact()`
helper this needs, and a probe card that exercises it.

The general lesson, which is worth more than the fix: §5.3 is exhaustive
against the criterion it states, and that criterion is narrower than "modules
you can copy across safely". Read the reference build for the other
non-negotiables too.

One behaviour to preserve while rewriting `searchPanel.js`: search fires **once
per settled query**, never per keystroke. Settled means a 700ms pause, or
Enter, or a filter change. Firing per keystroke records "m", "ma", "mar",
"mars" and the table ends up describing typing rather than intent.

> The core repository keeps five of its modules byte-identical across all five
> of its sites under a contract enforced by its own test suite. **That contract
> does not extend here.** This repository has one `template/`, which is the
> single source, and no cross-repo relationship of any kind. If you are shown a
> core-repo document referring to five shared modules, it does not apply.

---

## 6. The event contract

### 6.1 `pageView`, and the one exception to "no standard tables"

Salil chose option (iii) on standard tables: route everything to the sandbox
tables. **`pageView` is the one call that stays. Salil has confirmed this
explicitly.** It is a settled decision, not an open question.

The reason is not analytics, it is that **`pageView` is the documented trigger
for On-Site messages.** The eight Default Scenarios have no local code. They
appear only when a `pageView` fires and the scenario's page targeting matches.
Remove it and every widget in the demo goes dark, which is the entire product.

What it carries:

```js
window.dengage('pageView', { page_type: 'home' });
```

On a product page it waits for the product to resolve, then sends `page_type`,
`product_id` and `category_path`. It sends **no `price`**, **no
`discounted_price`** and **no `stock_count`** unless the scrape produced a real
figure for that product. See non-negotiable 8: the `Number(null) === 0` trap
has shipped this bug twice on the core repository.

Everything else the demo records goes to `sandbox_onsite_events` or
`sandbox_events` through `sendDeviceEvent`.

### 6.2 Identity

The contact key resolves **synchronously, in the `<head>`, before
`dengage('initialize')` runs**. Dengage's own guidance: if you have the
identifiers before calling initialize, pass them to initialize.

The core repository learned this the expensive way. Its earlier wiring
initialized anonymously and then polled `setContactKey` up to five seconds
later, by which point `pageView` had already gone out, so page views landed on
the anonymous device profile and the contact card showed nothing.

Order, first hit wins:

1. `?ck=<key>` in the URL, which then persists for the session. This is how a
   pre-sales person demos as any contact without touching code.
2. a key already stored on this browser
3. the email itself

Anonymous visitors stay anonymous: the module returns `null`, `window.__dnInit`
stays undefined, and the SDK initializes with no contact key. That is correct
behaviour, not a bug to fix.

Signups on a generated demo create contacts with key `ddemo-<slug>-<n>`.
Never use `salil-demo`, which is Salil's own contact on the core account.

### 6.3 Clicks only count if the creative reports them

Inside a popup or banner creative, the CTA must call

```js
Dn.sendClick('<scenario>__<action>')
```

exactly once per file, and a close control must call `Dn.close()` and **never**
`sendClick`, so a dismissal is not counted as a conversion.

Without this the campaign reads **0 clicks** in the panel. That matters here
even though A/B testing is out of scope (§2.7): opening the campaign report in
front of a prospect and showing impressions with zero engagement is a bad
moment, and it is caused entirely by a missing line in the creative rather than
by anything the prospect did.

---

## 7. The generator pipeline

Input: one URL. Output: a folder under `demos/` and a live page.

### 7.1 Catalogue, three tiers, tried in order

1. **Shopify.** `<store>/products.json` returns the full catalogue
   unauthenticated on most Shopify stores: titles, variants, prices,
   categories, image URLs. This covers a large share of ecommerce prospects and
   needs nothing from the prospect.
2. **JSON-LD.** Read `robots.txt`, then the sitemap, collect product URLs,
   parse `schema.org/Product` markup. Almost every serious ecommerce site emits
   this for Google. Covers custom builds, Magento, WooCommerce, BigCommerce.
3. **CSV fallback.** Only when 1 and 2 both fail: login wall, bot blocking, or
   heavy JavaScript with no structured data. The issue form takes an optional
   CSV attachment, and the workflow only asks for one after tiers 1 and 2 have
   failed, so it stays an exception path rather than a step.

**Respect `robots.txt`.** Salil's decision. It costs some sites and those fall
through to tier 3.

**Cap at roughly 30 products.** A demo does not need 500 SKUs to be convincing,
and repository size compounds. At 30 products, one image each, roughly 60KB
after compression, a demo is a few megabytes. At 5 to 7 a month with 90 day
retention there are around 20 demos live at any time, so the repository settles
somewhere under 100MB rather than growing without limit. That is the whole
reason the cap and the purge exist, and it is why raising either one is a joint
decision rather than a tweak.

**Slug collisions.** Two demos requested for the same domain, which will happen
when a demo expires and is rebuilt for a second call, must not overwrite each
other silently. Suffix the slug and say so in the issue comment.

Note for the workflow: the scrape runs from a GitHub Actions IP, and some sites
block cloud ranges outright. Tier 3 is the answer, and the failure message on
the issue should say so in plain language rather than printing a stack trace at
a salesperson.

### 7.1a Category structure

Salil's brief was that the demo's **structure** follows the prospect's look and
feel, while the storefront machinery stays standard for everyone. Concretely
that means the scrape produces more than a flat product list:

- the prospect's top-level **category names**, in their order, which become the
  demo's navigation and its home page rails
- each product's category assignment, so the grid and the filters are shaped
  like the prospect's own catalogue

Cap the navigation at what fits the header. The site header has no horizontal
slack, and a prospect with fourteen top-level categories will break the layout.
Take the largest few by product count and group the rest.

### 7.2 Theme extraction

From the prospect's site, derive the `theme` block in §4:

- primary and accent colors, from the most frequent non-neutral colors in the
  rendered CSS, weighted toward buttons, links and the header
- display and body font families, mapped to the nearest Google Font that is
  already loaded by the template
- corner radius, from button and card styles

Never extract or use the prospect's logo or word mark. The generated demo shows
the Dengage logo with the subtext "eComm Demo".

Sanity-check the result: a theme with insufficient contrast between `ink` and
`surface`, or between `onPrimary` and `primary`, produces an unreadable demo.
Clamp to an accessible pair rather than shipping what the scrape found.

### 7.3 Product artwork

Salil's decision: **use the prospect's real product images where available.**

- download at build time, never hotlink (non-negotiable 4)
- one image per product, resized to a maximum width of about 800px and
  compressed to WebP, which is where the few-megabytes-per-demo figure in §7.1
  comes from
- commit the result under `demos/<slug>/images/`
- when an image cannot be fetched, fall back to a **generated SVG placeholder**
  in the demo's own theme colors, so the grid never shows a broken tile

The core repository generates all its artwork as self-contained SVG for exactly
this reason: nothing can 404 at demo time. Keep that property for the fallback
path. If you generate SVG with gradients, give every gradient id a per-file
prefix, otherwise inlining several in one document makes them all resolve to
the first definition.

### 7.4 Build

Copy `template/`, write `demo.config.json`, write `products.json`, substitute
the namespace, write the `:root` token block, drop in the artwork, done. No
compile step.

---

## 8. The intake

Salil asked for something as close to a dialog box as possible. A GitHub issue
form is exactly that: labelled fields, no install, no terminal, and an audit
trail of who asked for what.

`.github/ISSUE_TEMPLATE/new-demo.yml` fields:

| Field | Required | Notes |
|---|---|---|
| Prospect website URL | yes | the only genuinely required field |
| Demo slug | no | derived from the domain if blank |
| Vertical | no | inferred from the catalogue, override available |
| Currency | no | inferred from the store, override available |
| Product CSV | no | only needed when the scrape fails |
| Notes for the build | no | free text |

`workflows/build-demo.yml`, triggered on issue open with the right label:

1. run the pipeline in §7
2. run the smoke test in §9
3. on success: commit to a branch, open a PR, **auto merge**, comment on the
   issue with the live URL and the expiry date, close the issue
4. on failure: comment on the issue with a plain-language reason and what to do
   next, and leave it open

The failure message is a product surface. It is read by a salesperson, not an
engineer. "We could not read this store's product catalogue automatically.
Attach a CSV of 20 to 30 products and I will retry" is right. A stack trace is
not.

---

## 9. The smoke test

Thirty seconds, not ten minutes. A generated demo is disposable and does not
earn a full regression suite.

Assert, headless, against the built demo:

1. both pages return 200 and render
2. the Dengage SDK loader script is present with the sandbox app guid
3. `dengage('initialize')` runs before any `pageView`
4. `pageView` fires exactly once per page, with a `page_type`
5. no `ec:` call is made anywhere on either page, **and** every
   `sendDeviceEvent` target is on the two-table allowlist. Both checks, for the
   reason in §11
5a. the event panel **cannot be made to emit a non-sandbox table name**. Drive
   it, attempt to select or submit anything outside the allowlist, and assert
   it is refused. §11 is static analysis and cannot see this (§5.3)
6. all eight launcher cards push the correct `dengage_demo_<slug>` event
7. all five `dn_inline_target_*` slots exist at the right anchors
8. `dn_inline_target_below_header` is not overlapped by the header
9. every product tile has an image that resolves locally, none pointing off-origin
10. no product carries a fabricated `price` or `stock_count`
11. no console errors
12. the cart key and element ids carry the demo slug

Numbers 5, 9 and 10 are the ones that protect the core assets and the demo's
credibility. Do not let them be skipped for speed.

---

## 10. Purge

> **Read §1.11 before building any of this.** Steps 2, 3 and 4 below are
> deletions, on a schedule, against a Data Space shared with five live demo
> sites and two mobile apps. The purge is designed and reviewed with Salil
> before it is ever armed. Until then it runs in report only mode: it lists
> exactly what it would remove and removes nothing. A scheduled job is not
> exempt from the approval rule, it is the reason the rule exists.

`workflows/purge.yml`, scheduled daily:

1. read `expiresAt` from every `demos/*/demo.config.json`
2. for anything past it: delete the folder, commit
3. delete the matching rows from `sandbox_onsite_events` and `sandbox_events`
   by `demo_slug`, using the Dataspace API (`DeleteData` is published alongside
   `CreateTable`)
4. delete contacts whose key matches `ddemo-<slug>-`
5. post a summary issue listing what was removed

Warn seven days ahead on the original issue, so a demo that is still needed can
be extended by editing `expiresAt` rather than rebuilt.

---

## 11. CI guardrails

`workflows/guard.yml`, on every PR:

- **no `ec:` calls** anywhere. One grep, and it is not sufficient on its own:
  see the next check.
- **every table name is on an ALLOWLIST**, not absent from a denylist. The only
  two names that may appear as a `sendDeviceEvent` target are
  `sandbox_events` and `sandbox_onsite_events`. Anything else fails.

  **The target must be a string literal at the call site.** A variable, a
  template literal or a concatenation fails, because CI cannot see what it
  resolves to, and every one of the five modules in §5.3 uses a variable. This
  is what makes the check unwalkaroundable rather than merely present, and it
  is the reason a module that reads its table name from `demo.config.json`
  would not pass: put the two literals in one module that owns them and have
  the rest of the storefront call that.

  > **Corrected.** These first two checks were originally scoped to `demos/`
  > and `template/`. That is one directory too narrow: the Phase 0 probe sits
  > outside both and makes real `sendDeviceEvent` calls, so the narrower scope
  > would not police the one page that exists before any demo does. Both now
  > run over every committed file.

  This is an allowlist for a reason that cost real time to learn. A denylist of
  the five standard ecommerce tables catches `wishlist.js`, which writes
  `wishlist_events` with no `ec:` call anywhere in the file, but **it misses
  `cantuCatalog.js` completely**, because that module writes `onsite_events`,
  which is a core-account table that was not on anybody's denylist (§5.3). An
  allowlist catches both, and it also catches the table nobody has invented
  yet. Same single grep, strictly better failure mode.
- **no off-origin asset references** in any committed HTML, CSS or JS, meaning
  any host outside a short allowlist rather than any absolute URL at all. Three
  hosts are unavoidable and none of them is a prospect's CDN, which is what the
  rule is actually about: `pcdn.dengage.com`, where the SDK necessarily lives,
  and `fonts.googleapis.com` with `fonts.gstatic.com`, which §7.2 requires
  because the extracted fonts are mapped onto a Google Font the template
  already loads. This origin and `localhost` are allowed too. Everything else
  fails.

  The check covers what a browser loads. It does not cover the `.mjs` tooling
  under `factory/`, because a build script calling the Dengage REST API is not
  a page fetching an asset.
- **no prospect logo files** committed outside the expected product image path
- **no em dashes or en dashes** in committed text
- **the app guid in every demo matches the sandbox app guid**, never the BFSI
  one
- **template purity**: no brand name, color literal or slug in `template/`
- **`seed/` is gone** once Phase 1 is complete (§3.1). Until then, exclude it
  from the checks above: it is a verbatim copy of another repository's site and
  will fail every one of them, which is expected and is not something to fix in
  place

### 11.1 Two things about the guard itself

**A guard that passes on an empty repository proves nothing.** Test it against
known-bad input: a naive copy of the five modules in §5.3 must be rejected, and
rejected on every count, not just the first. Keep that test as part of the
guard's own suite. It is the only evidence the guard works.

**Match raw UTF-8 bytes for the dash check, not a PCRE code point.** A pattern
like `\x{2014}` requires a UTF-8 locale and **silently errors out without one,
reporting every file clean**. It passed on a file containing a real em dash.
That is the worst failure mode a guard can have, because it is
indistinguishable from success. Any check that can fail open needs a test that
would catch it failing open.

---

## 12. Traps carried over, and why they exist

These cost the core repository real debugging time. None are obvious from
reading code.

1. **Never load the Dengage SDK from a tag manager.** The SDK goes on the page
   directly. A GTM copy double-initializes it. If this repository uses a GTM
   container at all, it must stay free of Dengage tags. The SDK watches
   `window.dataLayer` by itself, so Data Layer Event campaigns fire with no GTM
   involvement whatsoever.

2. **Popup and Banner creatives render in a cross-origin iframe.** Consequences,
   all of them non-obvious:
   - every link inside a creative needs `target="_top"`
   - host-page JavaScript cannot see events inside the creative, so a listener
     on the page will never fire
   - the panel strips `<script>` on save, so interactivity is pure CSS plus
     inline `onclick`
   - input capture must use the engine's `data-dn-form-id` mechanism, not a
     form post

3. **Inline creatives are NOT sandboxed.** Opposite of the above. The SDK puts
   the `<style>` in `document.head`, clones the HTML into the target selector,
   and runs the `<script>` through `new Function()` in page scope. So anchor
   clicks are counted without `Dn.sendClick()`, and **CSS leaks page-wide**
   unless every selector is namespaced under its own root id.

4. **Data capture from the three capture widgets does not go to a table.**
   `survey`, `nps-popup` and `subscription-popup` use the engine's native form
   mechanism, which writes a **contact** and **contact tags**, not table rows.
   `Dn.postSubscription()` creates a contact with email and permissions;
   `Dn.postQuestion()` writes contact tags. So survey and NPS results are read
   on the contact card and segmented on the tags. There is nothing to create in
   Data Space for these three, and building a host-page bridge for them does
   not work, because of trap 2.

5. **HTTP 200 from the event endpoint means accepted, not stored.** The row in
   Data Space is the only proof an event landed. This has produced two
   confident and wrong "it is working" claims on the core repository. When you
   verify the sandbox tables for the first time, fire with a distinctive marker
   contact key and go look at the row.

6. **A missing campaign is silent.** A scenario only appears if a campaign
   exists with that exact trigger name. If one is missing, that widget is dark:
   nothing errors, nothing logs, it simply never shows. When a widget does not
   appear, check §2.2 before you suspect the code.

7. **The visually-hidden class in the survey and NPS creatives is load-bearing.**
   Both creatives hide their real radio inputs behind styled score buttons using
   a visually-hidden class. It looks like dead markup and it is not: remove it
   and the entire score row unstyles. This has been mistaken for cruft before.
   It matters here because you are authoring these two creatives from scratch in
   Phase 1.

8. **Customization tags are refused on real-time On-Site Targeting campaigns.**
   `{%= ... %}` personalization tags resolve correctly in Preview and are then
   rejected on a real-time trigger. The tags are not wrong, the trigger type is
   the restriction. Do not spend an afternoon "fixing" a template over this, and
   do not design a standardized creative that depends on one.

9. **No tag manager in generated demos.** The core repository carries a GTM
   container for unrelated analytics and has a standing rule that it must never
   contain Dengage tags. Simplest correct answer here: **generated demos ship no
   GTM container at all.** There is nothing for it to do, and its only possible
   contribution is a second SDK load that double-initializes everything.

10. **If you ever screenshot a demo, scroll it section by section.** These pages
    reveal content on scroll, so a full-page screenshot captures the revealed
    sections at opacity 0 and looks half empty. That is a screenshot artifact,
    not a broken page, and it has been reported as a bug before.

---

## 13. Build plan

Four phases. Each has an acceptance criterion that is a demonstration, not a
green test run.

**Phase 0: the panel.** §2 in full, starting with §2.0. Pages on, web
application created with its four advanced settings, two tables, eight
campaigns, push domain. *Accept when:* the probe page makes a widget appear on
screen, and the launcher click is visible **as a row in Data Space** under
`contact_key = ddemo-phase0-probe-1`. A 200 is not acceptance; the row is
(§12.5).

Five steps, and only the first two need Salil:

1. Create the web application, four advanced settings, push domain. §2.0 first.
2. Create the two tables: `DENGAGE_API_TOKEN=... node
   factory/phase0/tables.mjs`. Safe to run twice.
3. Create the eight campaigns by hand. This cannot be automated (§2.4) and it
   is the only panel work there will ever be. Phase 0 needs content in one of
   them; `factory/phase0/creative/phase0-check.html` is a generic card to
   paste.
4. Run the probe from the repository root.
5. Confirm the row in Data Space. This is the step that gets skipped and it is
   the entire point.

**Build these before the credentials arrive, because none of them needs an
account:**

- **The probe page.** With the config blank it should log the payload it would
  send instead of sending it, so the shape is verifiable today and the same
  harness becomes the §9 smoke test later.

  It reads the account id and app guid from `factory/sandbox.json` at runtime,
  which is **not** what a generated demo does. A demo has both substituted into
  its page at build time and keeps the SDK snippet in the head, exactly as the
  reference build does. The probe reads them because it is one page that has to
  work before those values exist, and the invariant that matters is preserved
  either way: the contact key is resolved before `initialize`, and `initialize`
  before `pageView` (§6.2).
- **The guard and its workflow** (§11). Build it early, not after Phase 1: it
  is what catches the five modules in §5.3 if one slips through. Test it
  against a naive copy of `seed/site/en/js/`, which it must reject on every count
  (§11.1).
- **`tables.mjs`** for §2.3, idempotent so it is safe to run twice.
- **Scaffolding**: `.nojekyll`, the service worker at the repository root, and
  the push icon at `assets/dengage-push-icon.png` at 1200x1200, which clears
  the 256px minimum and is what §2.1 points at.
- **`factory/phase0/README.md`**, the panel checklist, so step 1 is a checklist
  Salil works through rather than a conversation.

**Phase 1: the template.** Strip `seed/site/en/` to a brand-free `template/`,
everything driven by `demo.config.json`, with the five modules in §5.3
retargeted to the sandbox tables. Write the eight standardized creatives
(§2.2a). Delete `seed/`. *Accept when:* one hand-written config produces a
working themed storefront with all eight widgets firing, all five inline slots
present, and `seed/` gone from the tree.

**Phase 2: the generator.** §7, all three catalogue tiers, theme extraction,
artwork, build, smoke test. *Accept when:* one command turns a Shopify URL and
one non-Shopify URL into two live demos that pass §9.

**Phase 3: the factory.** Issue form, build workflow, auto merge, purge, guard
workflows. *Accept when:* a pre-sales person who has never seen the repository
opens an issue and gets a live URL back, with no help.

On timing, two separate numbers that are easy to confuse:

**Building the factory:** roughly three to four focused working sessions to a
usable v1, with the first demo generated end to end around the close of Phase
2. Phase 0 is blocked on Salil (§14.1) and is mostly panel clicking rather than
engineering. Phase 1 is the bulk of the work, because de-branding the reference
build into a template where every brand decision comes from one config file is
more work than the scraper is.

**Running one demo, once the factory exists:** 8 to 15 minutes wall clock, of
which 2 to 4 is the scrape and 2 to 3 is the Pages deploy. That fits inside the
20 to 30 minute expectation with room for the pre-sales person to look at the
result before the call.

The second number is the one that was promised to the pre-sales team. The first
is what it costs to get there, and it is paid once.

---

## 14. Open items for Salil

Everything else in this document is decided. These three are not.

1. **Account id and sandbox app guid.** Blocks Phase 0 entirely. Nothing can be
   tested without them.
2. **A REST API bearer token** for the Dataspace endpoints: table creation in
   Phase 0, row deletion in the Phase 3 purge. It needs the
   **`dataSpace.manage`** permission specifically, per §2.3. Published rate
   limit is 30 requests per second per IP. The core repository's notes mention
   the REST API being IP-allowlisted in at least one context, so confirm a
   GitHub Actions runner can reach it, or the purge job needs a different home.

   The token is never committed. `tables.mjs` takes it from the
   environment and has a `--dry-run` that needs no token at all, so the two
   requests can be reviewed before anyone holds one.
3. **Product images, one explicit confirmation.** The decision is to download
   and commit the prospect's real product images. This is the one place a
   prospect's own material is republished on a public repository under your org,
   and it sits slightly against the decision to use the Dengage logo rather than
   theirs. The generated SVG fallback already exists as the failure path and
   could become the default if the answer changes. Not a blocker: build against
   the current decision and this can flip with a config change.

### 14.4 The Dengage account stays shared, and what that costs

**Decided: account 28, with a new web application inside it.** Not a separate
Dengage account.

Record the consequence plainly, because the GitHub account split invites the
opposite conclusion. The factory now has its own GitHub account, its own
repository and its own browser origin. It does **not** have its own Dengage
account. The Data Space, every table, every contact and every segment are
shared with the five core demo sites and the two mobile apps.

So the isolation looks like this:

| Layer | Separate? | Enforced by |
|---|---|---|
| Repository contents | yes | different account entirely |
| **Repository write access** | **no** | **instruction only. One GitHub connection per account** |
| Browser origin, storage, notification permission | yes | the browser (§2.5a) |
| Dengage web application, campaigns, push config | yes | a distinct app guid |
| **Dengage account, Data Space, tables, contacts** | **no** | **instruction only** |

**Two rows are the risk surface, not one.** The repository write access row was
added after the fact: the GitHub identity a session runs as can write
`salil-dengage/dengage-demos`, because Claude Code supports one GitHub
connection per account, and that was accepted deliberately. See §1.1.

Three things stand on the Data Space row: the `ec:*` prohibition (§1.3), the
table allowlist (§11), and the event panel runtime fix (§5.3). None of them is
optional and none is defence in depth for the others. They are the only
protection there is.

Nothing at all stands on the write access row except not doing it.

The practical rule that follows: **a change that touches how this repository
writes to Dengage deserves more scrutiny than a change to how it looks.** A
broken layout costs a demo. A row in `order_events` costs something you cannot
see and cannot easily undo.

**Settled, recorded here so they are not reopened:** the repository is
`Dengage-PreSales/demo-ai`, on a separate GitHub account, and demos serve from
`https://dengage-presales.github.io/demo-ai/demos/<slug>/` (§0, §2.5a); the
Dengage account is 28 with a new web application inside it (§14.4); the template is
forked from `seed/`, not fetched from the core repository (§3.1); `pageView`
stays (§6.1, confirmed); slug spellings are corrected, not inherited (§2.2); the prospect's
real product names are used (§7.1); the Dengage logo is used, never the
prospect's (§1.5); English only (§2.7); recommendations are Phase 2 (§2.7); web
push is Phase 1 (§2.5); `robots.txt` is respected (§7.1); vertical and currency
are inferred with an override (§8); nothing is excluded from the reference build
when forking the template (§5).

### 14.5 The one thing to get right now for a future second language

English only was the decision, with "we will see if we need another" left open.
That is cheap to honour later **only** if UI copy is not scattered through
twenty-five modules. Keep every user-facing string in one place per demo, read
at runtime. Do not hard-code a label inside a module.

The core repository learned this the expensive way and now runs a dedicated
copy sweep in both directions to catch strings left in the wrong language,
including inside `aria-label`, `placeholder`, `alt` and `title`, which is
exactly where leaks hide. You do not need that sweep today. You need the
structure that would make it unnecessary.

---

## 15. Decision log

Every question put to Salil across this design, his answer, and where it is
implemented. This exists so the executing session can confirm coverage without
re-deriving the conversation.

| # | Question | Decision | Section |
|---|---|---|---|
| 1 | Who operates it | Pre-sales, minimal dev setup, as close to a dialog box as possible | §8 |
| 2 | Submission surface | GitHub issue form | §8 |
| 3 | Approval step | Full build, auto merge, no human gate | §8 |
| 4 | Volume | 5 to 7 per month | §0 |
| 5 | Target time | 20 to 30 minutes; estimate is 8 to 15 min runtime | §13 |
| 6 | Clone fidelity | Prospect's colors, typography and category structure. Not a lookalike | §7.1a, §7.2 |
| 7 | Catalogue source | Shopify JSON, then JSON-LD, then CSV fallback | §7.1 |
| 8 | Branding | Dengage logo, subtext "eComm Demo". Never the prospect's mark | §1.5, §7.2 |
| 9 | Language | English only, second language deferred | §2.7, §14.5 |
| 10 | Repo | Separate repository, `Dengage-PreSales/demo-ai`, on a separate GitHub account | §0, §1.1, §3 |
| 10a | Template source | `seed/`, committed by Salil. No access to the core repo is requested or granted | §3.1 |
| 11 | Origin | One Pages origin shared by all demos, and by nothing else | §1.6, §2.5 |
| 12 | URL | **Reopened, then re-settled.** Originally "default Pages URL", which unexamined meant sharing an origin with the core demos. Now a separate GitHub account, so `https://dengage-presales.github.io` | §2.5a |
| 13 | Dengage app | New web application in **account 28**. Not a separate Dengage account, so the Data Space stays shared and §14.4 is the consequence | §2.1, §14.4 |
| 14 | Campaign strategy | One shared `dengage_demo_` set, standardized creatives | §1.2, §2.2 |
| 15 | Unprefixed campaigns | Moot, superseded by the new prefix | §2.2 |
| 16 | Recommendations | Phase 2 | §2.7 |
| 17 | Web push | Phase 1 | §2.5 |
| 18 | Contact marker | `ddemo-<slug>-<n>` | §1.7, §6.2 |
| 19 | Tables | `sandbox_onsite_events`, `sandbox_events`, both with `demo_slug` | §2.3 |
| 20 | Standard tables | Option (iii), none, except `pageView` | §1.3, §6.1 |
| 21 | Management API | Tables yes, campaigns no | §2.3, §2.4 |
| 22 | Feature set | Home, PLP, PDP, cart, checkout, search, wishlist, launcher, 5 slots, event panel | §5.0 |
| 23 | Post-generation editing | Not supported, by design | §2.7, §4 |
| 24 | Mobile | Web only | §2.7 |
| 25 | Lifecycle | 90 days, auto purge | §10 |
| 26 | Ownership guard | Not applicable, new repo. CI guards added anyway | §11 |
| 27 | Verification | Smoke test, not a full suite | §9 |
| 28 | Scope of edits | Nothing in the core repository | §1.1 |
| 29 | Public hosting | Resolved by the branding decision | §1.5 |
| A | Logo | Dengage | §1.5 |
| B | Product names | The prospect's real names, and real images where available | §7.1, §7.3 |
| C | Slug spellings | Corrected, not inherited | §2.2 |
| D | Vertical and currency | Inferred, with an override field | §8 |
| E | `robots.txt` | Respected | §7.1 |
| F | Template exclusions | None. Fork the reference build whole | §5 |
| G | `pageView` | Stays. Confirmed | §6.1 |
| H | Module count | Five, not four. `cantuCatalog.js` writes `onsite_events` and no denylist would have caught it | §5.3 |
| I | Guard shape | Allowlist of the two sandbox tables, never a denylist of standard ones | §11 |
| J | Event panel | Free-text table input replaced by a fixed dropdown plus call-site validation. A runtime hole CI cannot close | §5.3, §9 |
| K | Shared creative CTAs | Report and dismiss, never navigate. No URL is correct for every demo | §2.2a |
| L | GitHub Pages | Enabled on the new repo, main branch root. Step zero of Phase 0 | §2.0 |

---

## 15a. Corrections made to this document while executing it

A specification that has silently diverged from the code is worse than no
specification, because the next person trusts it. Each of these was found by
reading the reference build or by building the thing described, and each was
corrected in place rather than worked around.

| What was wrong | Where | Now |
|---|---|---|
| The file was committed as `DEMOFACTORYHANDOFF.md` while `CLAUDE.md`, `README.md` and §3 all linked to `DEMO-FACTORY-HANDOFF.md` | filename | renamed, three broken links fixed |
| `seed/site/` and `seed/panel-content/`, one directory short of the files | §3, §3.1, §5, §13 | `seed/site/en/`, `seed/panel-content/en/` |
| "these four modules", left from an earlier draft, beside a table of five | §5.3, §13 | five |
| The `ec:` and allowlist checks scoped to `demos/` and `template/`, which does not cover the probe page | §11 | every committed file |
| "no off-origin asset references", which is unbuildable: the SDK loader is necessarily off origin and §7.2 requires Google Fonts | §11 | a host allowlist, stated |
| `productCatalog.js` normalizes an unreadable price to `0`, and is a sixth module needing a Phase 1 fix for a different non-negotiable | §5.3 | new subsection |

Also added: the requirement that a `sendDeviceEvent` target be a literal at the
call site, in §11, which is what makes that check unwalkaroundable; and the
note in §13 on the probe reading its configuration at runtime where a demo has
it substituted at build time.

### A second round, from calling the API and looking at the panel

The corrections above came from reading. These came from doing, and they are
larger.

| What was wrong | Where | Now |
|---|---|---|
| "These **are** automatable", and §2.4's reasoning built on it | §2.3, §2.4 | the API cannot make a **Big Data** table, so both are created by hand. See below |
| Authentication described as "a REST API bearer token" | §2.3, §14.2 | an **API user's key and password**, exchanged at `POST /rest/login` for a one hour token |
| The REST API being IP allowlisted listed as a risk to confirm | §14.2 | **confirmed**, and it refuses on the address before it checks credentials |
| The service worker "sits at the repository root" | §2.5, §3 | the origin root, in the `dengage-presales.github.io` repository. This one is a *project* Pages site under `/demo-ai/` |
| The push icon URL under `/demo-ai/assets/` | §2.1 | the origin root, published today and valid regardless of this repository's Pages setting |
| Isolation from the core repository described as structural | §1.1, §14.4 | instruction only. The GitHub identity can write it |
| Nothing said about destructive Dengage operations | §1 | new non-negotiable 11, and CLAUDE.md §1a |

**The table type is the one to understand rather than skim.** Dengage has five
table types and `CreateTable` has no field for choosing one. Given a
`contactKeyColumn` it produces a **Sendable** table, which is a send list.
Event data belongs in **Big Data**. The reference build knew this:
`cantuCatalog.js` opens with an instruction to create a Big Data table with
that name. The specification did not carry it across.

It was found by creating both tables, seeing them appear as Sendable, and then
checking what the API can actually express. The two wrong tables were empty and
have been removed.

There is a second consequence that is easy to miss. The API refused a nullable
contact key on those Sendable tables with `ContactKey or PrimaryKey column
cannot be nullable!`, which reads like a rule about contact keys and is really
a rule about send lists. On a Big Data table the contact key **is** nullable,
and Dengage's star schema documentation says that is deliberate, so that
anonymous devices can still record rows. Had the Sendable tables stayed, every
event from an anonymous visitor would have been refused. §6.2 has anonymous
visitors staying anonymous as correct behaviour, so the demo would have
recorded nothing until somebody signed up, and nothing on screen would have
shown it.

Added rather than corrected: §2.3a, the panel steps and the `master_contact`
relations that make the two tables usable in segmentation.

---

## 16. Sources

- CreateTable: https://dev.dengage.com/reference/createtable
- On-Site Targeting campaigns: https://dev.dengage.com/docs/on-site-1
- Web SDK: https://dev.dengage.com/docs/web-sdk
