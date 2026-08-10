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
   else.** The campaigns exist once, in one dedicated Dengage web application,
   with standardized creatives shared by every demo. A demo never gets its own
   campaigns, and the set does not grow when a demo is built. This is what makes
   per-demo panel work zero, and it is the single decision the whole design rests
   on. For how many there are, read `factory/checks/launcher.js`, which counts
   the launcher against the creatives on disk in both directions. A number
   written into prose here has been wrong twice.

3. **REVERSED. Demos use the SDK's `ec:*` calls and write the standard
   ecommerce tables. Every page fires `pageView`.**

   > **CORRECTED, 5 August 2026.** The `demo_slug` column referred to below does
   > not exist and never did: columns cannot be added to the six standard tables,
   > confirmed by Salil. The code never sent one. Wherever this item says a row is
   > tagged with `demo_slug`, read instead: a demo's rows are found only through
   > `pageView`, whose `page_url` carries the slug and whose `session_id` is the
   > only join to the other five tables. §10 already describes this correctly, and
   > CLAUDE.md §1b now does too. The text below is kept as the record of the
   > reversal itself, which stands.

   The original rule read "No `ec:*` calls. Ever", and routed everything into
   two private sandbox tables. Salil reversed it on 4 August 2026 after the
   sandbox tables were built and inspected. His reasoning, which is sound:

   - **The recommendation engine feeds off the standard tables.** Sandbox tables
     would have meant a demo could never show recommendations, which is among
     the things a prospect most wants to see. §2.7 deferred recommendations to
     Phase 2 partly for feed reasons; this removes the harder half of that.
   - **Those tables are already related to `master_contact`**, so the contact
     card, Interactive Segment and profile enrichment work with no wiring.
   - **Nothing critical consumes them today.** Checked explicitly: no regularly
     used segment, feed or report depends on them, so demo rows arriving
     alongside live ones was judged acceptable.

   **What this costs, and it is not small.** Demo rows now sit in the same six
   tables as five live demo sites and two mobile apps. Nothing structural
   separates them, and nothing tags them either. See the correction above: the
   only route back to a demo's rows is the `pageView` join.

   So the rigour moves rather than relaxes:

   1. **Every page fires `pageView`.** (Originally "every event carries
      `demo_slug`"; see the correction above.) A page that skips it writes cart,
      order and wishlist rows whose `session_id` appears in no page view, so
      nothing can attribute them to a demo. This is now the most consequential
      rule in the document.
   2. **One module emits every event.** Nothing else calls `dengage('ec:...')`
      or `dengage('pageView')`. That module is the only surface CI has to audit. Without this, rule 1 is a hope
      rather than a check. Same architectural move the table allowlist relied
      on, aimed at the new risk.
   3. **The purge now deletes from production tables.** §1.11 applies in full:
      written approval, for that exact filter, every time.

   The six tables and the calls that write them are in §2.3. `pageView` is no
   longer an exception to anything; it is simply the first of the set.

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
   `DPS-<slug>-<n>`. **Corrected 6 August 2026:** this used to add "both sandbox
   tables carry a `demo_slug` column", which is wrong twice over. The sandbox
   tables were abandoned on 4 August (§1.3), and `demo_slug` never existed at all
   because columns cannot be added to the six standard tables. Nothing tags an
   event row. `pageView` is the only route back to a demo's rows, through
   `page_url` and the `session_id` join. CLAUDE.md §1b.

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
| Icon/Badge URL | `https://dengage-presales.github.io/demo-ai/assets/dengage-push-icon.png` |

**The icon is a required field and the panel rejects a URL that does not
resolve**, so this only works once §2.0 has published. It is live and returns
200. The image is the Dengage mark at 1200x1200, which clears the panel's
256px square minimum.

A brief detour worth recording, because it will look odd in the history: while
this repository's Pages was still off, the icon was moved to the origin root in
the sibling `dengage-presales.github.io` repository, which was published
already. That is no longer needed. Keeping the icon in this repository, beside
the code that references it, is the simpler arrangement and it is the one that
survives a demo being rebuilt.

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

> **CORRECTED, 4 August 2026, and this is the largest scoping error in this
> document.** "The eight" is one group out of six. The reference build carries
> **27 scenarios**, and this section described only the first group of them.
> Everything about the eight below is still correct; it is simply not the whole
> job. See §2.2c for the full set and what each group needs.
>
> The gap was not visible from inside this document, because §2.2 through §2.2b
> are internally consistent and never claimed to be exhaustive. It surfaced when
> Salil asked where the other scenarios were.

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
they are not applied on real-time On-Site Targeting triggers. See §12.8. That
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

### 2.2c The full scenario set: 27, in six groups

Recovered 4 August 2026 from the reference build's own launcher, after §2.2 was
found to cover only the first group. Counts are the reference's.

| Group | Count | What it is | State here |
|---|---|---|---|
| Default scenarios | 8 | popups and banners, Data Layer Event triggered | **6 written, 5 passing, 2 blocked** |
| A/B testing | 1 | one campaign, three designs, 10/30/30/30 split | not started |
| Inline scenarios | 5 | injected **into** the page content | targets exist, creatives not written |
| On-site scenarios | 3 | overlaid on the content, layout untouched | not started |
| Gamification | 5 | engagement mechanics with prizes | not started |
| Product recommendations | 5 | driven by the catalogue | **deferred to Phase 2 by §2.7, now reopened** |

Every one of these is a real platform capability rather than an aspiration. The
SDK bundle carries the machinery for all six groups, which is how the list was
confirmed without reading the reference repository:

| Group | Evidence in the SDK |
|---|---|
| A/B testing | `AB_CONTROL_GROUP`, `isAbCampaign`, `$d="AB"` |
| Inline | `inlineTarget`, `inlineTargetSelector`, `dnInlineId`, `dnInlineIndex`, `dnInlineReserved` |
| On-site variants | `SLIDE`, `EXIT_INTENT`, `ON_SCROLL`, `scrollBreakPoints`, `popupCooldown` |
| Gamification | `getGameWinner`, `gameWinnerResult`, `/coupon/game/` + `/onsite/draw` |
| Recommendations | `getRecommendedItems`, `recommendationContainerKey`, `maxRecommendationCount`, `/recommendations/`, `/reco-events/batch` |

And several capabilities beyond even those 27, worth knowing exist before anyone
designs the launcher: story sets (`storySet`, `DengageStoryEngine`, Instagram
style), site search (`searchContainerKey`, `minCharsToSearch`), countdown
(`dn-countdown-settings`), Typeform embedding, a rating field type, and the app
inbox (`/api/inbox/events`).

#### The three capture creatives, and how each submits

`survey`, `nps-popup` and `subscription-popup` all capture through the engine's
native form mechanism rather than writing a table, so their results are read on the
contact card and segmented on tags. Handoff 12.4.

`survey` and `nps-popup` validate their own single question and submit with
`Dn.setTags`, which is the call that writes contact tags. `subscription-popup` uses
the subscription form contract. All three are verified against the engine's own
published handler by `factory/checks/creative.js`, which asserts the exact payload
each one sends.

#### Inline is not a popup, and the difference is dangerous

Handoff 12.3, restated because it now matters for five scenarios rather than a
footnote. A popup renders in a cross-origin iframe and is sandboxed. **An inline
creative is not.** The SDK lifts its `<style>` into `document.head`, clones its
HTML into the target, and runs its `<script>` through `new Function()` in page
scope.

So one unscoped selector in an inline creative restyles the entire storefront,
and it will look like the storefront is broken rather than like the creative is.
Every inline creative scopes all CSS under its own root id, and
`factory/checks/creative.js` refuses one that does not.

#### How an inline creative finds its target

The panel has an **Inline Target Selector**: it scans every node on the page for
the search word in a `class` or an `id`, then generates an optimised selector,
**preferring an id** (`#footer-container`) and falling back to tag plus class.

The template's five targets are therefore plain ids, which is the form the tool
prefers:

```
#dn_inline_target_below_header       immediately after </header>
#dn_inline_target_below_hero         after the hero block, home page
#dn_inline_target_in_grid            inside the product grid
#dn_inline_target_pdp_below_price    product page, under the price block
#dn_inline_target_above_footer       immediately before <footer>
```

Search `dn_inline_target` in the panel's selector tool and all five appear. They
exist even when empty, on purpose: the tool cannot select a node that is not
there, and the campaign is configured before any content is injected.

One consequence worth stating: an empty target has no height, so the tool's blue
overlay has nothing to draw. Pick from the node list rather than from the page.

---

### 2.3 The two tables

> ### SUPERSEDED, 4 AUGUST 2026. NOTHING IN THIS SECTION IS STILL BUILT.
>
> **Read §1.3 and §15a instead, and CLAUDE.md §1b.** Salil reversed this design
> after the two tables had been built and inspected: demos now write to the six
> standard ecommerce tables using the SDK's own `ec:*` calls, because the
> recommendation engine feeds off those tables and a demo that cannot show
> recommendations is missing one of the things a prospect most wants to see.
>
> So `sandbox_onsite_events` and `sandbox_events` are not what a demo writes to,
> the `demo_slug` column below **never existed** and could not have (columns
> cannot be added to the six standard tables), and there is nothing here to enter
> in the panel.
>
> `factory/phase0/tables.mjs` was rewritten on 6 August to match. It now names
> the six real tables and what writes to each, and `--counts` reads their row
> counts so you can tell whether events are landing at all.
>
> The section is kept rather than deleted because §2.4, §5.3 and §6 still argue
> against it, and an argument whose subject has been removed is unreadable. Treat
> everything below as the record of a decision that was reversed.
>
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
> at the top of the reference build's launcher module instructing the reader to create a Big Data
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

> **SUPERSEDED, 4 AUGUST 2026, along with §2.3. Do not do any of this.** The six
> standard ecommerce tables already exist and are already related to
> `master_contact`, so there is no table to create and no relation to build. See
> §1.3, §15a and CLAUDE.md §1b. Kept as the record of a reversed decision.

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

### 2.5b Sending a sample push without waiting for an event

Added 6 August 2026. A journey pointed at a storefront event is the right way to
show push to a prospect, because it reaches the device that triggered it and needs
no credential. For a rehearsal, a screenshot, or a push on screen with nothing
touched on the storefront first, there is `SendInstantPush`:

```
POST https://api.dengage.com/rest/push/sendInstant
```

`factory/panel/send-instant-push.mjs` wraps it. Panel doc:
`factory/panel/REFERENCE.md`, "Sending one on demand".

**Why it is a command and not a launcher card.** Two properties of the API decide
this, and neither is worked around:

1. It authenticates with an account level token. A public static page cannot hold
   one, because a token the page can read is a token any visitor can read.
2. It targets an audience, `segmentId` or `tableId`, not a device. A button on the
   page would push to every subscribed device rather than to the browser that
   pressed it.

So the credential lives in the environment of a machine the operator controls, and
the send is a deliberate act rather than a click during a demo.

**The rail that matters, and why it is tested.** `applicationIds` is optional in
the API, and **omitting it prepares the send for every application in the
account**. Account 28 is shared with the core demo sites and the two mobile apps
(§14.4, CLAUDE.md §1), so an omitted array is a push into other people's work,
with no symptom visible from this side. The script therefore always sends
`applicationIds`, always reads it from `factory/sandbox.json`, and has no flag to
change or omit it. `--self-test` asserts that over nine different argument sets and
has been checked against three deliberately broken versions of the builder.

Three further habits, each paid for elsewhere in this document:

- **It prints the whole request and asks for a typed word before sending.** §12
  and CLAUDE.md §1a: an outward facing action names exactly what it will do first.
- **It does not retry a send.** A request that reached the platform and then timed
  out on the way back would arrive twice, and two notifications look like a fault
  in the product. Login and the report do retry, because they change nothing.
- **A 200 is queued, not delivered.** `--report <trackingId>` reads
  `GET /rest/push/sendInstant` and prints delivered, opened and bounced, broken
  down by browser and device. Same rule as §12.5 for events.

The API is IP allowlisted, so this runs from a machine on the list. A stock CI
runner is not, and its address changes, so there is nothing stable to add. That is
one more reason this is not automated.

**Nothing here deletes anything, and nothing here creates the segment.** Both are
conversations, not script behaviour. CLAUDE.md §1a.

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
      tables.mjs                names the six tables a demo writes to, and
                                reads their row counts. Read only. §1.3
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
  site/en/           = <reference-build>/en/                the reference storefront
  panel-content/en/  = <reference-build>/panel-content/en/  the reference creatives
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

Start from **`seed/site/en/`** (§3.1), which is a copy of the reference build's English
site, the reference build in the core repository. Strip it to a brand-free
`template/`. Salil confirmed there is nothing in that machinery to exclude, so
this is a de-branding job rather than a selection job.

The de-brand, concretely:

1. Replace every brand token from the reference build, meaning its name in title
   case, lower case and concatenated form, and its SKU prefix, across the HTML, the modules and the stylesheet with the demo slug.
   This is what keeps element ids, CSS classes, the localStorage cart key and
   the custom event names from colliding between two demos open in one browser
   (§1.6). Rename its launcher module accordingly.
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

> **Amended by Salil, 4 August 2026: a category page, and a multi-vertical
> catalogue.**
>
> **The category page is a filtered view of `index.html`, not a third file.**
> `index.html?category=Fashion` renders the grid filtered and fires
> `pageView` with `page_type: 'category'` and the hierarchical
> `category_path`. That is the whole Dengage value of a category page:
> category targeting, `category_path` segmentation, and a `page_type` that
> reads correctly in `page_view_events`. Two pages remains the whole site.
>
> A third file would only be warranted for a visually distinct category
> landing page, with its own hero and subcategory tiles. Not built.
>
> **The template is developed against fashion plus electronics plus a third
> vertical, deliberately.** The reference build is a tyre distributor and its
> five categories are tyre shaped, so building against it risks baking in
> assumptions that hold for one vertical only. Three consequences, all of
> which are cheap now and expensive to retrofit:
>
> - **Category count is variable.** §7.1a caps the header at what fits and
>   groups the rest. A mixed-vertical catalogue is what makes that cap real.
> - **`category_path` is hierarchical**, `Electronics > Laptop`, not a flat
>   list. Adding depth later touches the nav, the grid, the filters and every
>   `pageView`.
> - **Product cards render what the scrape produced and omit the rest.** A
>   jacket has sizes and colours, a laptop has specs, a tyre has a load index.
>   No fixed attribute set.
>
> None of this is what a prospect sees: §7.1a takes the real category
> structure from their own site. It is about the template not assuming a shape.

| Feature | Where it lives |
|---|---|
| Home page: hero, category rails, product grid | `index.html` |
| Product listing and filtering | `index.html` |
| Category page | `index.html?category=<name>`, `page_type: 'category'` |
| Product detail | `product.html` |
| Cart | drawer, not a page |
| Checkout | modal flow, not a page. See §5.3 |
| Search | slide-in panel. See §5.3 |
| Wishlist / saved items | drawer. See §5.3 |
| Scenario launcher, all 27 scenarios | in-page panel, §5.1 |
| Five inline slots | §5.2 |
| Event panel | in-page, the six standard ecommerce tables, §1b |

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

The in-page panel that lets a pre-sales person fire any widget on demand during a
call. This is the single most important piece of the demo and it is what the whole
panel setup in §2.2 exists to serve.

**Twenty two cards, in four groups, plus the five recommendation strategies below
them, which is the twenty seven scenarios of §2.2c.** Recommendations are not
campaigns and get no card here: `js/recommend.js` computes them locally, so they
appear in their own group with no trigger name.

> **CORRECTED, 4 August 2026.** This section described eight cards, which was the
> same scoping error as §2.2 and outlived it: the other fourteen creatives were
> written, committed and documented while `js/panels.js` still listed eight, so
> fourteen campaigns had no way to be fired. Nothing failed, because a scenario
> with no button is not an error anywhere. `factory/checks/launcher.js` now counts
> the launcher against `factory/creatives/` in both directions, and
> `factory/checks/test.sh` proves that count fails when they drift.

Grouping is not decoration. Twenty two flat buttons is a wall, and on a call the
operator is reading the panel while talking, looking for one named thing.

Per card it pushes to `window.dataLayer`:

```js
window.dataLayer.push({
  event:      'dengage_demo_' + slug,
  actionType: 'dengage_demo_' + slug
});
```

The SDK watches `window.dataLayer` itself, so campaigns set to Data Layer Event
fire with **no GTM involvement**. See §12 for why that matters.

> **CORRECTED.** This section used to specify a second call recording each click
> into a sandbox table. Those tables no longer exist: §1.3 was reversed and a demo
> now writes only through the SDK's own `ec:*` and `pageView` calls, from
> `js/dengageEvents.js` alone. A launcher press is a data layer push and nothing
> else. The campaign's own impression and click reporting is what measures it,
> which is also what makes the creatives' "report the click, then dismiss" rule in
> §6.3 matter.

**Three cards cannot push anything, and are still listed.** Two are gestures:
exit intent listens for the pointer leaving the window, scroll depth for a scroll
position. Neither has a data layer event, so both are drawn as dashed cards that
name the gesture, and pressing one says what to do instead of firing. Leaving them
out would suggest the factory does not build them; drawing them like the others
would produce a button that does nothing.

The third case is per page rather than permanent. Three of the five inline slots
exist on one page only (`below_hero` and `in_grid` are home, `pdp_below_price` is a
product page), so the launcher checks the target is in the document before firing
and refuses when it is not. Firing anyway is answered correctly by the campaign and
renders nowhere, which on screen is the product failing rather than the operator
being on the wrong page. That is the most expensive kind of wrong on a call.

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

#### 5.2a The header moves for a top bar, and the bar is what says how far

**Corrected 7 August 2026, after two fixes that both shipped broken.** The header
is pushed down by `--dn-banner-height`, and the first two attempts worked that
number out from the page by looking for a fixed, full-width, short element at the
top of the document. Both passed their tests and both left the header covered.

The reason is worth writing down, because it generalises past this one bug. A
Dengage banner is a **cross-origin iframe sized by the engine, not by its
content.** A bar 56px tall can sit at the top of a frame that is as tall as the
viewport with nothing but transparency below it, and from outside that frame
there is no way to tell it from a modal scrim: the only difference is inside it.
Any height ceiling narrow enough to exclude a scrim also excludes that bar, and
any ceiling wide enough to admit it also admits the scrim.

So the bar reports its own height over the same `postMessage` bridge the theme
uses, and `template/js/slots.js` clamps the number and applies it. The shape test
stays as the fallback for the campaigns authored in the panel, which have no file
in this repository to add a reporter to. `factory/checks/banner.mjs` drives the
iframe shape first, and asserts where the header's top edge ends up rather than
whether the variable was written.

The general lesson: **a test fixture you invented is not evidence about markup you
cannot see.** Both earlier fixes were verified against a short fixed div, which is
the shape that is easy to imagine rather than the shape that arrives.

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
| **the launcher module** | the scenario launcher. Writes `onsite_events` through `sendDeviceEvent` | retarget to `sandbox_onsite_events`, and add `demo_slug` |
| `eventModal.js` | the event panel. Both mechanisms, plus a runtime hole. Writes `page_view_events`, `shopping_cart_events`, `wishlist_events`, `order_events` and `events` | see the subsection below. This is more than a copy rewrite |

> **The reference build's modules are described by role rather than named, as of
> 6 August 2026.** This repository is public and the reference build belongs to a
> customer. `factory/guard/fixtures/naive-copy/` reproduces every construct under
> invented names, so the guard still has something concrete to reject.

**Why the launcher module is the dangerous one to miss.** It makes no `ec:` call
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
sends a zero anyway. `template/js/dengageEvents.js` has the `compact()`
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
2. a key already stored on this browser, namespaced by slug (§12.11)
3. nothing, and the visitor stays anonymous

Anonymous visitors stay anonymous: the module returns `null`, `window.__dnInit`
stays undefined, and the SDK initializes with no contact key. That is correct
behaviour, not a bug to fix. Their events still land, because the row's key
column is the device id rather than the contact key, which Phase 0 established.

Signups on a generated demo create contacts with key `DPS-<slug>-<n>`.
Never use `salil-demo`, which is Salil's own contact on the core account.

The head order this depends on, all of it load bearing, and in this order for
reasons in both directions (§12.12):

```
js/identity.js          resolves the key, publishes window.DEMO_SLUG
the SDK snippet         initialize, carrying the key when there is one
stylesheets             below both, because a pending one blocks scripts
```

#### 6.2a Sign in, which identifies rather than authenticates

**There is no lookup, and that shapes the whole feature.** The Web SDK exposes
`setContactKey` and no way to ask whether a contact exists. So a page cannot
verify a key before using it, there is no "not found" to report, and there is no
failure path. An unknown key does not error: **it creates that contact.** That is
how `ddemo-phase0-probe-1` came into being in Phase 0, from nothing but a `?ck=`
parameter.

So the risk is not a wrong password, it is a **typo**. Account 28 is shared with
five live demo sites, and a mistyped key mints a junk contact there that nothing
can find later, because everything that looks for demo contacts filters on
`DPS-<slug>-`.

The sign-in modal therefore shows the prefix as **fixed text** and accepts only
the remainder, so a key outside the namespace is not validated and rejected, it
is untypeable. Whitespace is collapsed and the input is lowercased, because those
are the two things a person typing a key on a call gets wrong and both are silent.

Same reasoning as the event panel having no table name field (§5.3): structural
beats defensive, because the person using it live will not know why it matters.

`?ck=` stays unconstrained, and the asymmetry is deliberate. A URL is typed once
by someone who knows what they are doing; a form is used in front of a prospect.

Two more details that are easy to get wrong:

- **A `pageView` fires after identification**, with `page_type: login`, so there
  is a row on the contact rather than only on the anonymous device. This is the
  moment worth showing on a call: the contact card fills in while the prospect
  watches.
- **Sign out has to reload the page.** The SDK has no method to detach a contact
  key from a device, so the key stays on that page's SDK instance until the
  document is replaced. Clearing storage alone leaves the UI saying signed out
  while events keep arriving on the contact. The reload strips `ck=` from the
  query, or the reloaded page reads it straight back out of the URL, and it waits
  a moment first because an event sent as navigation begins can be cancelled
  before it leaves the browser.

**Registration is not part of this.** It cannot be: the SDK cannot write a
contact's name, email, phone or permissions. The Register button fires the
`subscription-popup` creative, whose native form can (§12.4). It closes the modal
first, because our own scrim would otherwise cover the widget it just fired and a
widget that rendered underneath an overlay is indistinguishable from one that
never rendered.

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

### 7.1 Catalogue, six tiers, tried in order

**Widened 8 August 2026, Salil's instruction:** asking a colleague for a CSV had
become routine, and a factory that stops for a spreadsheet is not automatic. Two
platform tiers and a rendering tier were added so the engine reads Shopify,
WooCommerce, Magento, BigCommerce and custom builds by whichever door the store
actually leaves open. Every tier now also carries each product's image URL out,
for §7.3.

1. **Shopify.** `<store>/products.json` returns the full catalogue
   unauthenticated on most Shopify stores: titles, variants, prices,
   categories, image URLs. This covers a large share of ecommerce prospects and
   needs nothing from the prospect.
2. **WooCommerce Store API.** `/wp-json/wc/store/v1/products` is public on most
   WooCommerce stores and answers with names, prices, sale prices, categories
   and images. Its prices arrive as strings in minor units with a
   `currency_minor_unit` field, and dividing by the wrong power of ten is a
   silent 100x error, so the tier tests pin that conversion both ways.
3. **Structured markup.** Read `robots.txt`, then the sitemap, collect product
   URLs, and parse each page three ways in order: `schema.org/Product` JSON-LD,
   then microdata (`itemscope`/`itemprop`, which older Magento and custom builds
   emit instead), then OpenGraph product meta as a one-product-per-page floor.
   Almost every serious ecommerce site emits at least one of these for Google.
4. **Rendered.** `factory/scrape/render.mjs`. A storefront built as a JavaScript
   application can serve empty HTML to a plain fetch and only inject its
   structured data after rendering. This tier loads the page in headless
   Chromium under the factory's own honest user agent, waits for it to settle,
   and runs the same three extractors on what actually rendered. It never
   scrapes visible priced text off the layout: structured data after rendering,
   or nothing, because a wrong number is worse than no number. It degrades to
   `render-unavailable` on a machine without a browser. **It does not evade:**
   no fingerprint games, no pretending to be a person. A store that blocks the
   honest agent falls through to tier 5, and that is designed, not accepted.
5. **CSV fallback.** Only when everything above fails: login wall, bot
   blocking. The issue form takes an optional CSV attachment, and the workflow
   only asks for one after the automated tiers have failed, so it stays an
   exception path rather than a step.
6. **Generated stand-in catalogue.** Added 7 August 2026, `factory/scrape/fallback.mjs`.
   Roughly fifty products in five categories, chosen for the vertical the web
   address and the issue title appear to name, with invented prices. Reached only
   when no CSV was attached and every automated tier found nothing.

   **Why the fourth tier exists.** Tier 3 was written as the exception and turned
   out to be the norm: several stores in a row refused every automated reader, and
   each one became a request that stopped and waited for a person to produce a
   spreadsheet. A demo factory that cannot finish without one is not automatic,
   which is the whole point of phase 3.

   **What it costs, stated plainly.** Every price in it is invented, which
   non-negotiable 5 otherwise forbids outright. The exception is narrow and the
   boundary is the thing to protect: inventing a figure for a **real** product
   stays forbidden everywhere, because nothing downstream can tell it from a
   scraped one. What is allowed is inventing a **whole catalogue that announces
   itself**, through `tier: 'generated'`, `catalogueSource: 'generated'` in the
   demo config, and the first line of the issue comment. `stockCount` is still
   never invented. No name in it may be a real brand or model, which is why every
   name is a description: "All Season Touring Tyre 185/65 R15" and never a
   manufacturer's line.

   **A CSV always wins.** The generator passes `generateIfUnreadable` only when no
   CSV was supplied, so a real catalogue can never be displaced by a made up one.
   `--no-generate` turns the tier off for a run that would rather fail.

**Respect `robots.txt`.** Salil's decision. It costs some sites and those fall
through to the CSV tier.

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
block cloud ranges outright. Tiers 3 and 4 are the answer, and the message on
the issue should say which one was used in plain language rather than printing a
stack trace at a salesperson.

**A store blocking us is not the same as a store having no structured data, and
mistaking the two cost a whole class of prospect.** Until 7 August 2026 tier 2
collected only `@type: Product`, so any store publishing `ProductGroup` with its
variants under `hasVariant`, which is what schema.org added the type for and what
current Shopify themes and most clothing retailers emit, yielded nothing and was
reported unreadable. One measured example served `robots.txt`, a sitemap index, a
product sitemap and 1,961 product pages, all 200, all with valid JSON-LD. Two
things follow for anything added here later: a group hands its **price** to its
variants and keeps the **category** for itself, so a variant read without its
group's context arrives categoryless and the catalogue collapses into one bucket;
and a limit counted in JSON-LD nodes rather than distinct product names fills up
on sizes of the same garment.

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

> **AMENDED, 8 August 2026, by Salil, deliberately.** Two changes, both off one
> store. This section used to say the neutrals were never extracted and that no
> browser was needed. Both are now the opposite, and the old text is kept below
> the list so the trade stays visible rather than being quietly rewritten.
>
> **A browser reads the theme, and it outranks the text.** Reading HTML and
> stylesheets as text is still the first answer and is still usually right. It
> cannot work at all for a store whose server sends only a CSS framework and whose
> real design arrives with its JavaScript. A national denim retailer serves one
> stylesheet, `bootstrap.min.css`, so every text channel could only ever see
> Bootstrap's palette: the demo shipped in Bootstrap blue on white while the store
> is black. Nothing was missed and nothing errored. The evidence in the text was
> Bootstrap's. A rendered pass now runs last and wins where it answers, and the
> browser it needs is already installed for images and the render tier, so the
> original cost argument against it no longer applies. See
> `factory/scrape/theme-rendered.mjs`.
>
> **A framework's untouched default is not a brand colour.** `--bs-primary` at
> `#0d6efd` is Bootstrap as shipped; `--bs-primary` at anything else is a decision
> somebody made. The token name cannot be the test, because a customised Bootstrap
> compiles the store's own colour into that same name, so only the exact shipped
> default values are refused. The counted channel refuses them too: Bootstrap
> paints those hexes across its utility classes, so frequency alone lets an
> untouched framework outvote the store.
>
> **The neutrals are extracted now.** `page`, `surface`, `ink`, `muted` and `line`
> come from the rendered page, so a black store gets a dark demo. The original
> reasoning was that guessed neutrals produce grey text on a grey card, which was
> true while they could only be guessed from text. What protects readability now is
> measurement: the neutrals are adopted as a SET or not at all, and only when the
> text on them clears the same contrast bar as everything else. A partial adoption
> is the one outcome that produces grey on grey, since a dark page with the
> template's dark ink is unreadable, so they move together or not at all.
> `MIN_INK` and `applyRendered` in `factory/scrape/theme.mjs` are where this lives.

From the prospect's site, derive the `theme` block in §4:

- primary and accent colours, in two channels that must not share a filter.
  **A custom property whose name ends in primary, brand or accent is the site
  answering directly** and outranks everything counted; it may be black, which
  frequency counting must never pick and which luxury retail uses constantly.
  A name mentioning text, bg, border or another role is describing where a
  colour goes rather than what the brand is, and shade or inverse variants
  (`-light`, `-reverse`) never match. Only when nothing is declared do the most
  frequent non-neutral colours decide, weighted toward buttons, links and the
  header. Corrected 8 August 2026, off a store whose declared black brand was
  discarded and replaced by a framework grey from the platform's utility CSS
- display and body font families, mapped to the nearest Google Font that is
  already loaded by the template
- corner radius, from button and card styles

Never extract or use the prospect's logo or word mark. The generated demo shows
the Dengage logo with the subtext "eComm Demo".

Sanity-check the result: a theme with insufficient contrast between `ink` and
`surface`, or between `onPrimary` and `primary`, produces an unreadable demo.
Clamp to an accessible pair rather than shipping what the scrape found.

### 7.3 Product imagery: real photographs first, artwork as the floor

> **REVERSED, 8 August 2026, by Salil, deliberately.** The 5 August decision below
> chose generated artwork over scraping the prospect's photography, and three
> demos later the cost was visible on screen: a tyre retailer whose every tile was
> a grey pair of initials, and a leather goods store where half the grid was
> placeholders. A demo sells the prospect their own store, and their own product
> photography is most of what makes it theirs. Non-negotiable 4 in CLAUDE.md
> always said images are downloaded, compressed and committed; this section was
> the override, and the override is what ends here.
>
> **What ships now.** The scraper tiers carry each product's image URL out of the
> same feed or markup that named the product, and `factory/scrape/images.mjs`
> downloads them at build time, compresses them to JPEG capped at 900px, and
> commits them into `demos/<slug>/img/`. `products.json` carries only relative
> `img/` paths, so nothing in a published demo can 404 mid call and nothing
> depends on the prospect's CDN staying put, which was the whole reason the 5
> August decision existed. A product whose image cannot be fetched, or whose
> store refuses the fetch, falls back to the artwork below, exactly as before.
>
> **What did not change.** The artwork library stays, as the floor rather than
> the face: it is what an image-less product shows, and what a whole demo shows
> when a store blocks image requests. The original decision text is kept below
> because the reasoning about zero-request tiles still governs the fallback.

> **Superseded, 5 August 2026.** Salil chose **generated artwork, drawn per product
> from its own vertical**, over scraping the prospect's photography. Built and
> live: `template/js/artwork.js`, checked by `factory/checks/artwork.js`.

**What ships.** `js/artwork.js` holds a library of motifs, one per common
ecommerce category, and picks one by keyword from the product's name, category and
attributes. A jacket draws a jacket, a camera draws a camera. Every motif is
inline SVG in `currentColor`, so:

- **zero requests.** Nothing can be slow or blocked mid call, which is the same
  property non-negotiable 4 exists to protect
- **the prospect's palette.** One rule, `.art` in `style.css`, decides the colour
  for the whole catalogue. It resolves to `--ink` rather than `--primary` on
  purpose: a grid of accent coloured silhouettes reads as icons rather than as
  products, and leaves the accent to mean "act on this"
- **stable per product.** Variation is seeded from the product id, never
  `Math.random`, or a product would change appearance between two rails on one
  page and read as a rendering fault
- **an honest floor.** An unclassifiable product falls back to the initials tile,
  so an unexpected vertical is plain rather than broken

Two traps, both already paid for:

**Match whole words, and accept plurals.** Plain substring matching put `top`
inside "laptop", `phone` inside "headphones", `mat` inside the attribute name
"Material" and `cap` inside "Capacity": four wrong motifs in a fifteen product
catalogue, two of them caused by the words a catalogue uses for its own column
headings. Whole word matching then broke every plural name, because it correctly
refuses to see `trouser` inside "Trousers", and plural names are the norm. The
pattern needs both a word boundary and an optional `s` or `es`.

**The head noun wins, not the list order.** English puts it last in a compound, so
the match furthest through the product NAME decides: "Table Lamp" is a lamp,
"Camera Bag" is a bag. Score the match END and break ties on the longer keyword,
or "Fitness Watch" picks the watch motif over the smartwatch motif because
`watch` starts later than `fitness watch`.

**If a call ever needs the real photography**, the scraping route is:

- download at build time, never hotlink (non-negotiable 4)
- one image per product, resized to a maximum width of about 800px and
  compressed to WebP, which is where the few-megabytes-per-demo figure in §7.1
  comes from
- commit the result under `demos/<slug>/images/`
- when an image cannot be fetched, fall back to the generated motif, which is
  already what `js/catalog.js` does when a product carries no `image` field

The core repository generates all its artwork as self-contained SVG for exactly
this reason: nothing can 404 at demo time. If you generate SVG with gradients,
give every gradient id a per-file prefix, otherwise inlining several in one
document makes them all resolve to the first definition. `js/artwork.js` derives
its prefix from the product id hash for this reason.

### 7.4 Build

Copy `template/`, write `demo.config.json`, write `products.json`, substitute
the namespace, drop in the artwork, done. No compile step.

**BUILT, 5 August 2026.** `factory/generate-demo.mjs`, which calls
`factory/build-demo.sh` for the copy and the identity substitution rather than
repeating it. One URL in, one demo folder out.

Two corrections to this section, both from building it:

**The `:root` block is not written by the generator.** `js/boot.js` applies the
theme from `demo.config.json` at runtime, so `style.css` is untouched and stays
identical in every demo. The `:root` block is the default and the config
overrides it. That is better than rewriting the stylesheet per demo, because a
generated stylesheet is a second thing that can drift from the template.

**The Google Fonts link is rewritten, and it has to be.** `boot.js` names the
families but cannot download them. If the `<link>` still asks for Sora and Inter
while the config asks for Playfair Display, the browser silently renders the
fallback and the theme looks like it did not apply. Only families in
`theme.mjs`'s `LOADABLE` set are ever chosen, so the weights requested are known
to exist and the stylesheet request cannot fail on a missing weight.

### 7.5 What the generator decides, and where the traps were

All of this is tested offline in `factory/scrape/scrape.test.mjs`, and every case
named below is one the code got wrong first.

**Availability is any-of, never the first variant.** A Shopify feed lists sizes
in order and the smallest is very often the one that sold out first, so reading
`variants[0].available` reported products out of stock that had twelve sizes on
the shelf: 26 of 30 on one real store. The price comes from an available variant
for the same reason, because a sold out variant can carry a stale clearance
price.

**In stock products are preferred when capping to 30.** Selection, not
invention: every number still comes from the scrape. It earns its place because a
catalogue that is mostly sold out is faithful and useless, with nothing that can
be added to a cart and therefore no cart, checkout, abandonment or half the
launcher to demonstrate. A sold out product still ships when its category has
nothing else, because "Out of stock" is a state worth showing once.

**A category needs more than one product to become navigation, and the minimum
scales.** A large retailer's structured data names the shelf rather than the
department, so one catalogue produced "3 Seater Sofa Beds" and "Custom-made Thick
Veneer Worktops" as top level navigation, each holding a single product. A fixed
minimum of three then collapsed a ten product CSV with five sensible departments
down to one entry plus More. One tenth of the catalogue, never below two, holds
in both directions.

**The navigation order comes from product order.** `js/catalog.js` builds its
category list by walking products and taking each new name as it meets it, so the
`categories` array in `demo.config.json` is a record rather than an instruction.
The shipped product list is sorted by category rank for that reason, which is
also what puts the tail group last.

**Sitemaps are streamed, and the locale matters.** One national retailer's
sitemap index holds 2171 entries named `prod-en-GB_1.xml`, and a single locale
sitemap exceeds 8MB. Scoring on the word "product" missed the abbreviation
entirely, and the first entries in the index were Estonian, so the first working
version read the right site in the wrong language. Sitemaps are now read as a
stream and abandoned once enough URLs are collected, and an `en` marker outranks
everything else in the scoring.

### 7.6 Everything in a demo was written by somebody else

A product name arrives from a feed built for a browser, so it is HTML rather than
text. A price arrives in whatever convention its country uses. A category name is
whatever length the store's taxonomy happens to be. None of it is hostile and all
of it breaks a naive reader, so the whole catalogue was driven through one fixture
carrying every case at once. The table is in `factory/scrape/README.md`; three of
them are worth stating here because they are not obvious.

**A prospect's em dash would have failed the build, not just looked odd.**
Non-negotiable 10 forbids em and en dashes in committed text, the guard enforces
it on raw bytes across every committed file including `.json`, a generated demo's
`products.json` is committed, and the build workflow runs the guard before
publishing. Retailers use em dashes in titles constantly. So a rule about this
repository's own prose was, until it was found, deciding which prospects could
have a demo at all. Every dash variant is normalised to a hyphen during the
scrape, and the entity forms with it.

**`num()` had the `Number(null)` trap inside the function written to avoid it.**
Stripping every character that is not a digit leaves the empty string for the text
"yes", and `Number('')` is `0`, not `NaN`. A stock column containing a word
therefore announced every product out of stock: §1.8's trap, reintroduced by the
sanitising step meant to prevent it. Worth remembering as a shape rather than as
one bug.

**A non-Latin catalogue lost its products silently.** Deriving an id by stripping
everything outside A to Z leaves nothing at all of an Arabic or Chinese title, so
any product whose feed omitted a SKU was dropped without a message. Dengage sells
into Turkish and Arabic speaking markets, so that is the normal case rather than
an edge one. A hash of the original text stands in now: an opaque id is worse than
a readable one and far better than a missing product.

None of this is a security boundary. The storefront escapes on render, verified in
a browser with a category named `"><img src=x onerror=...>`: no alert, no injected
element, no console error. The sanitising exists so that a tile is not captioned
`&amp;` on a sales call.

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
2. run the guard in §11, over the tree **with the new demo in it**
3. run the smoke test in §9
4. on success: push to `main`, comment on the issue with the live URL and the
   expiry date, close the issue
5. on failure: comment on the issue with a plain-language reason and what to do
   next, and leave it open

**BUILT, 5 August 2026.** `.github/ISSUE_TEMPLATE/new-demo.yml` and
`.github/workflows/build-demo.yml`, with the form parser in
`.github/scripts/parse-request.mjs` and its tests beside it.

**Step 4 replaced "commit to a branch, open a PR, auto merge", deliberately.**
Two reasons. Auto merge depends on repository settings that can be turned off
without anyone noticing, and a demo sitting unmerged is a demo that is not there
when the call starts. And verifying before the push is stronger than merging and
reviewing after it: `main` is what Pages serves, so `main` is what must never
receive a broken demo. Nothing reaches it that has not passed both the guard and
the smoke test. The issue is the audit trail the pull request would have been.

**The parser is a separate file with its own tests, and that is not
over-engineering.** It turns text a stranger wrote into command line arguments.
Every field is validated against a narrow pattern and dropped if it fails: a URL
must parse as http or https, a slug is lowercase letters, digits and hyphens, a
currency is exactly three letters, and a CSV link must be on a GitHub attachment
host. That last one matters most: a workflow that fetches whatever URL appears in
a comment is a download client for anyone who can comment on the repository.

**The CSV is read from a comment and never from the issue body.** Tier 3 stays an
exception path. Reading it from the body would let a first submission skip tiers 1
and 2, and then the normal route would quietly become the one that needs a
salesperson to prepare a file.

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
5. **every outgoing payload is emitted by `js/dengageEvents.js` and nothing
   else.** Stub `window.dengage`, drive the page, and assert every recorded call
   came through the emitter. `ec:*` calls are expected now rather than forbidden,
   so this replaced the old two-table allowlist when §1.3 was reversed
5a. the event panel **offers no way to name a table**. Drive it and assert there
   is no free-text field and that the fixed list is the only thing that can be
   submitted. §11 is static analysis and cannot see this (§5.3)
6. **the launcher offers every campaign in `factory/creatives/` and nothing
   else**, and each card pushes the correct `dengage_demo_<slug>` event. Derive
   the expected list from the folder rather than writing it out, because a list
   written out in the check is a third copy to drift. Two cards are asserted
   **not** to push: exit intent and scroll depth listen for a gesture and a
   scroll position, so neither has a data layer event, and a card that pushed one
   anyway would log that it fired. The three inline slots that exist on one page
   only are asserted to refuse from the other page rather than push into a target
   that is not in the document. `factory/checks/launcher.js`, and §5.1
7. all five `dn_inline_target_*` slots exist at the right anchors
8. `dn_inline_target_below_header` is not overlapped by the header
9. every product tile has an image that resolves locally, none pointing off-origin
10. no product carries a fabricated `price` or `stock_count`
11. no console errors
12. the cart key and element ids carry the demo slug

Numbers 5, 9 and 10 are the ones that protect the core assets and the demo's
credibility. Do not let them be skipped for speed.

### 9.1 The template check is a different thing, and it is not disposable

`factory/checks/` holds a browser check of `template/` itself. Keep the two
apart: a generated demo is thrown away in 90 days and earns thirty seconds of
assertions, but `template/` is the thing every future demo is copied from, so a
defect in it ships five to seven times a month until somebody notices.

**It exists because reading a diff missed two real bugs that a browser found in
one run.** Both were invisible in one tab and in review:

- every demo's cart, wishlist and contact key collapsed into one shared
  namespace, because modules read `data-demo-slug` before `boot.js` set it
  (§12.11)
- an unreachable Google Fonts stylesheet stalled `identity.js`, and therefore
  `initialize`, indefinitely (§12.12)

**One tab is not enough.** The namespace bug looked perfectly correct in a single
demo: keys were present, storage worked, a reload kept the identity. It is only
visible with two demos open on one origin, which is exactly how they sit on
Pages. The check opens two, signs in on one, fills a cart on one, and asserts the
other sees neither. Anything that claims to prove isolation has to open two.

**Assertions that hard code a key name can pass by checking nothing.** The first
version asserted against `dps:template:ck` while the code was really using
`dps:demo:ck`, so it read `null`, compared it to `null`, and passed. Derive the
name from the page and assert the derived value, or the check fails open in
exactly the situation it exists for.

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
3. post a summary issue listing what was removed

**Steps 3 and 4 of the original plan are gone, and the row deletion is parked.**
Salil's instruction, 4 August 2026: demo data stays where it is, and if it ever
grows enough to matter he raises a ticket with the backend support team to remove
it. That is the right call and it removes the most dangerous piece of automation
in this design.

The reason it was dangerous is worth keeping written down. When §1.3 was
reversed, demo rows moved into the six standard ecommerce tables, which are
shared with five live demo sites and two mobile apps. Columns cannot be added to
those tables, so there is no `demo_slug` to filter on. A demo's rows are found
only indirectly:

```
page_view_events where page_url contains the slug   ->  a list of session_id
     ->  those session_ids find its cart, order, wishlist and search rows
```

A scheduled job issuing deletes against production tables, keyed on a
**join it computed itself**, is a bad thing to arm. One wrong join and it deletes
a live demo's rows during a sales call, silently, and this side cannot restore
them. §1.11 would require written approval for that specific filter on every run
anyway, which a daily cron cannot honour by definition.

So the folder deletion stays automatic, because a folder is in git and is
recoverable. The row deletion is a human asking the backend team. **Do not
re-automate it** without reopening §1.11 with Salil first.

Warn seven days ahead on the original issue, so a demo that is still needed can
be extended by editing `expiresAt` rather than rebuilt.

---

## 11. CI guardrails

`workflows/guard.yml`, on every PR:

- **one module emits, and nothing else does.** Every reference to the SDK
  function must sit in `js/dengageEvents.js`, or in the `initialize` call in a
  page head. Anywhere else fails.

  > **This replaced the original table allowlist** when §1.3 was reversed on
  > 4 August 2026. `ec:*` calls are now expected, so a check that forbade them
  > would fail on every correct demo. What is left to enforce is that all of them
  > come from one auditable place.

  **The check must match the call, not a shape of the call.** This is the
  guard's own worst bug so far, and it failed open twice:

  1. the first version matched `dengage('<literal>'`, so it saw two comment
     lines and passed, never noticing the real dispatch `window.dengage(action,
     body)` where the action is a variable
  2. the fix excluded `.` from the preceding character class, so
     `window.dengage(` still never matched

  Both versions reported PASS while checking nothing. The working pattern is
  `(^|[^A-Za-z0-9_])dengage[[:space:]]*\(`: any call, whatever precedes it and
  whatever the arguments are. There are now regression tests for both failures,
  including a variable-argument call and a bare `dengage(`.

  It does not exempt comments, and that is deliberate. Exempting them means
  parsing JavaScript in grep, and rewording a comment is cheaper than a parser.

  > **Corrected.** The check was originally scoped to `demos/` and `template/`.
  > That is one directory too narrow: the Phase 0 probe sits outside both and
  > makes real SDK calls, so the narrower scope would not police the one page
  > that exists before any demo does. It now runs over every committed file.

- **every page loads the emitter.** A page that does not cannot fire `pageView`,
  and without `page_view_events` a demo's rows are unfindable in the six shared
  tables (§10). This is the check that keeps §10's join possible at all.
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

8. **Customization tags are not applied on real-time On-Site Targeting campaigns.**
   `{%= ... %}` personalization tags resolve correctly in Preview and are not
   applied on a real-time trigger. The tags are not wrong, the trigger type is
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

11. **Anything a module reads at script-evaluation time must exist before the
    script does.** Found here, in a browser, 4 August 2026, and it is the third
    instance of the same shape.

    `js/identity.js` and `js/store.js` read the slug from `data-demo-slug`, and
    `js/boot.js` set that attribute asynchronously after fetching
    `demo.config.json`. Both modules therefore read it before it existed and fell
    back to a literal default, so **every demo the factory built used the same
    storage namespace**:

    ```
    dps:demo:ck      dps:demo:cart      dps:demo:wishlist
    ```

    Two demos open in one browser shared a cart, a wishlist and a contact. That
    is CLAUDE.md non-negotiable 6, broken silently, in code that looks correct.

    The fix is not lazier reads. `identity.js` is a blocking script in the head
    and must resolve the contact key **before** `initialize`, so it cannot wait
    for a fetch. The slug is a build-time fact, so the generator writes
    `data-demo-slug` into the markup, `identity.js` publishes `window.DEMO_SLUG`
    synchronously, and every module reads that one value. `boot.js` now
    **verifies** the attribute against `demo.config.json` and reports a mismatch
    instead of setting it.

    The `setAttribute` call is the part worth staring at. It made the attribute
    look correct to everything that checked afterwards, including a person
    reading the DOM in DevTools, which is why the bug survived. The two earlier
    instances were `var COPY = window.DEMO_COPY || {}` at module scope, which
    rendered every label as its own key, and the reference build setting the
    contact key up to five seconds after `initialize` (§6.2).

12. **A pending stylesheet blocks every script after it.** Also found in a
    browser here, and it had the SDK bootstrap waiting on a third party.

    The font `<link>` sat above `js/identity.js` in the head. A browser will not
    execute a script while a stylesheet is still loading, because the script
    might ask for computed styles. So an unreachable `fonts.googleapis.com`
    left the page at `readyState: "loading"` with `identity.js` never having run,
    and therefore no `initialize`, no `pageView` and no widget that could ever
    fire. Observed: `document.scripts.length` of 1 and an empty `<body>` several
    seconds in.

    Corporate networks do block Google Fonts, so this is a live-call failure
    mode, not a sandbox artifact, and what a prospect would see is a storefront
    where nothing works. `identity.js` and the SDK snippet now sit **above** every
    stylesheet. Neither reads a style, so nothing is lost.

    The general rule: the head order in §6.2 is load bearing in both directions.
    Things that must run early go above things that block.

12.13 **`survey` and `nps-popup` submit with `Dn.setTags`, and that is deliberate.**

    `Dn.setTags` is the call that writes contact tags, which is what a question
    creative produces. Both files validate their own single question and then call
    it with the payload the tag contract expects:

    ```
    [ { tag: "<data-dn-name>", value: "<the chosen input value>" } ]
    ```

    Every native attribute the question contract documents is present and correct in
    both files, so the engine's own validation and state stamping apply on top.

    **DO NOT CHANGE EITHER FILE TO A DIFFERENT SUBMIT CALL** without re-running
    `bash factory/checks/run.sh` and reading its output for that creative. That check
    drives the real markup against the engine's published handler and asserts the
    payload, the invalid state and the confirmation state. It is the only thing that
    will tell you whether a change actually works, because a capture creative that
    does not submit looks exactly like one that does until you check the contact.

    That is the whole rule. It is short on purpose: the reasoning belongs in a
    message to Salil rather than in this repository. Non-negotiable 9.

12.14 **Not every template offers Data Layer Event, and a trigger mismatch is
    completely silent.** Added 6 August 2026, found on the Typeform card: the
    campaign was correct, the launcher card was correct, and nothing happened.

    The SDK supports five trigger types. Three of them are "an event with this
    name", all reading `triggerSettings.eventName`, all labelled "Event name" in
    the panel. They differ only in where the SDK listens:

    | `triggerBy` | Where it listens |
    |---|---|
    | `DATA_LAYER_EVENT` | wraps `window.dataLayer.push`, watches for `{ event: <name> }` |
    | `CUSTOM_EVENT` | `window.addEventListener(<name>)` |
    | `DENGAGE_EVENT` | `window.addEventListener(<name>)`, the same handler |
    | `NAVIGATION` | `dengageNavigation`, after `triggerSettings.delay` |
    | `ON_SCROLL` | `scroll`, at `triggerSettings.scrollPercentage` |
    | `EXIT_INTENT` | `mouseleave` on the document with `clientY < -20` |

    So a card that only pushed to the data layer was dead for any template that
    does not offer that trigger, and dead in the way §12.6 describes: nothing
    errors, nothing logs, the widget simply never appears. It reads as a broken
    demo rather than as a setting, and it gets found on a call.

    **`DengageEvents.scenario` therefore fires both**, with the same name: a data
    layer push and a `CustomEvent` dispatched on `window`. A campaign has exactly
    one trigger, so one of the two is listened for and the browser discards the
    other at no cost. `factory/checks/triggers.mjs` asserts both go out and, just
    as importantly, that each goes out **exactly once**: sending the same signal
    twice would show a prospect the same widget twice, which is worse than not
    showing it.

    The one thing to avoid is two campaigns sharing one event name on different
    trigger types, which would genuinely fire twice.
    `factory/panel/live-campaigns.sh` reports duplicates for exactly this reason,
    and prints the trigger type for every campaign, which makes it the first thing
    to run when a card does nothing.

12.15 **A field missing from ONE emitter is invisible everywhere you would look
    for it.** Added 6 August 2026. `wishlist_events` took no rows for four days
    while `shopping_cart_events`, `order_events` and `order_events_detail` filled
    normally, out of the same module and the same `send()`.

    The cause was one line. `addToWishlist` resolved `product_variant_id` to
    `undefined` when a product had no variant, and `compact()` drops undefined
    keys by design (§1.8), so the key never went out. The cart and order emitters
    have always fallen back to the product id, so they carried it. The demo
    catalogue has no variants at all, so this was not intermittent: it was every
    wishlist event this repository ever sent.

    **Why it survived so long.** Three places that should have caught it could
    not:

    - **A diff.** The wishlist line looked deliberate, and it was. Omitting rather
      than fabricating is the rule (§1.8). What was wrong is that a product which
      is its own only variant is a fact, not a gap, so a fallback was right and an
      omission was not. The rule was applied to the wrong kind of value.
    - **The page.** A demo that sends nothing looks exactly like a demo that sends
      everything. There was no way to see what had been sent.
    - **The panel.** The six tables are shared and carry no column identifying the
      demo (§1b), so "newest row" is a fact about eight properties. The row that
      finally identified the problem was a product id belonging to another property on
    the account, which is what
      proved nothing had written a wishlist row from ANY property since 2 August.

    Two tools came out of it and both exist to stop the next one taking an
    afternoon:

    - **`?debug=1`** puts an on-page readout of every event sent, with its
      payload and the table it writes. `js/debug.js`. It listens for a namespaced
      custom event that `js/dengageEvents.js` dispatches, rather than wrapping
      `window.dengage`, because wrapping would route around the
      `event-single-source` guard that keeps writes auditable.
    - **Quick reference** in the launcher: device id, session id, push token,
      contact key and application, each with a copy button, so the identifiers
      that isolate a row are one click rather than a retype.

    `factory/checks/tools.mjs` asserts the payload shape of both wishlist calls
    directly. **Assert the field, not the call.** That a call fired was never in
    doubt here.

    **AMENDED THE SAME EVENING, because the variant id was not the whole story.**
    With the fallback shipped and the payload matching the documentation field for
    field, verified against the live page, the table still took no rows.

    A stored wishlist row carries three fields that no documented payload lists:
    `event_id`, `event_type` and `is_used`. All three are required, and for this
    family they are the caller's to supply. So the emitter writes the row with
    `sendDeviceEvent` to `wishlist_events` and sets all three, which is the same
    mechanism §5.3's own table records the reference build's wishlist module using.
    Same endpoint, same table, same fields, and the stored row matches the rows
    already in the table.

    Two fields are deliberately not sent, established the same way rather than
    assumed: `expire_date` changes nothing about a stored row, and prices store
    identically as numbers and as two-decimal strings, so the catalogue's own
    numbers go out unchanged.

    **Which sharpens the lesson into the form worth keeping: assert the stored row,
    not the sent payload.** A payload can match the documentation perfectly, look
    complete in a diff, on the page and in the `?debug=1` readout, and still not be
    the row. §4 already says an HTTP 200 from the event endpoint means accepted
    rather than stored; this is what that costs when it is forgotten. The two things
    that count are every field the row needs and a row that actually landed.
    `factory/checks/tools.mjs` pins the outgoing row field by field, including the
    three fields above, and a change to any of them is verified against a stored row.

---

## 13. Build plan

Four phases. Each has an acceptance criterion that is a demonstration, not a
green test run.

**Phase 0: the panel. COMPLETE, 4 August 2026.** Both halves observed:

- **A widget rendered on screen.** `dengage_demo_survey` fired from the probe's
  launcher, matched its campaign, and drew the Phase 0 check card. Confirmed at
  the same time: padding 0 and a transparent background leave no frame around
  the card, the panel supplies the close button outside it, and the creative
  renders correctly inside the cross-origin iframe.
- **The event landed as a row.** `pageView` from the published probe produced a
  row in `page_view_events` carrying the full `page_url`. Not a 200, the row.

What Phase 0 established that the specification had wrong or unknown:

| Finding | Consequence |
|---|---|
| `key` on every standard table is the **device id**, not the contact key | there is no contact-based row tag. The device id was `4f2b8888-b54d-4b0f-8e3a-dd69a9221995` |
| `?ck=` genuinely attaches identity before `initialize` | contact `ddemo-phase0-probe-1` was created and linked to the device. §6.2 confirmed by observation |
| `page_type` is free text in practice | `probe` was accepted although undocumented. Generated demos still use documented values so segmentation keeps working |
| There is **no API to read table data** | four plausible endpoints all 404. Row cleanup is a panel Export plus a support ticket, not a script |
| `page_view_events` is the per-demo manifest | it carries `page_url`, and `session_id` joins it to the other five tables. No extra table, column or relation needed |

*Original acceptance criterion, for the record:* the probe page makes a widget
appear on screen, and the event is visible as a row in Data Space. A 200 is not
acceptance; the row is (§12.5).

Five steps, and only the first two need Salil:

1. Create the web application, four advanced settings, push domain. §2.0 first.
2. **No longer a step.** This said "create the two tables". The six standard
   ecommerce tables already exist and are already related to `master_contact`,
   so there is nothing to create. §2.3 is superseded. To confirm they are
   reachable and see their row counts: `DENGAGE_API_USERKEY=...
   DENGAGE_API_PASSWORD=... node factory/phase0/tables.mjs --verify`, which
   reads and writes nothing.
3. Create the campaigns by hand. This cannot be automated (§2.4) and it is the
   only panel work there will ever be. `factory/checks/launcher.js` is the
   count. Phase 0 needs content in one of them;
   `factory/phase0/creative/phase0-check.html` is a generic card to paste.
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
- **`tables.mjs`**, which names the six tables a demo writes to and reads their
  row counts. Read only, and the row count before and after using a demo is the
  cheapest honest answer to "did the event land" (§12.5).
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
3. **Product images: SETTLED, 5 August 2026.** Salil chose generated artwork per
   vertical rather than scraping. See §7.3. The paragraph below described the
   scraping route and the confirmation it needed; neither applies now, and the
   route is kept in §7.3 only as the higher fidelity fallback. The original text
   follows for the record.

   The decision was to download
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
| 18 | Contact marker | `DPS-<slug>-<n>` | §1.7, §6.2 |
| 19 | Tables | `sandbox_onsite_events`, `sandbox_events`, both with `demo_slug` | §2.3 |
| 20 | Standard tables | **REVERSED 4 Aug 2026, corrected 5 Aug 2026.** Was option (iii), none except `pageView`. Now all six standard ecommerce tables through `ec:*`. Not tagged: `demo_slug` cannot exist, rows are found through the `pageView` join | §1.3, §10, §15a |
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
| H | Module count | Five, not four. The launcher module writes `onsite_events` and no denylist would have caught it | §5.3 |
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
The reference build's launcher module opens with an instruction to create a Big Data table with
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

### A third round: the sandbox tables were abandoned entirely

**Salil's decision, 4 August 2026, and it reverses the single decision the rest
of the design rested on.** Decision 20 in §15 read "Option (iii), none, except
`pageView`". It is now the opposite: demos write **all six standard ecommerce
tables** through the SDK's own `ec:*` calls. They are not tagged: see the
correction at §1.3, `demo_slug` does not exist and the rows are reachable only
through the `pageView` join.

The sequence matters, because it is a good example of a specification being
right in its reasoning and wrong in its conclusion.

The original rule existed to stop fake-brand rows skewing segments and
recommendation output on live sales assets. That reasoning was never wrong. What
it missed is that **the recommendation engine feeds off those same tables**, so
the protection also guaranteed that no generated demo could ever show
recommendations. The rule prevented a harm nobody had measured at the cost of a
feature every prospect asks about.

Checking that cost is what settled it. Salil confirmed nothing regularly used
consumes those six tables, so the harm the rule guarded against was largely
theoretical, while the feature it blocked was not.

**What was thrown away, and what replaced it.** §14.4 named three protections
and said none was optional: the `ec:*` prohibition, the table allowlist in CI,
and the event panel runtime fix. All three were about *which table* a write
lands in, and all three are now meaningless, because the answer is always a
real one.

One thing replaced them, and the whole design now rests on it:

> **`pageView` on every page, every event emitted from a single module, both
> verified statically in CI.**
>
> (This read "`demo_slug` on every event" until 5 August 2026. That column cannot
> exist, so the guarantee is weaker still than the paragraph below allows: rows
> are not tagged at write time, only reachable afterwards through the `pageView`
> join. §1.3, §10.)

That is a weaker guarantee than three independent checks and it is worth being
honest about. The failure mode has changed shape rather than gone away: it used
to be "wrote to the wrong table", caught by a grep. It is now "forgot the tag",
which produces rows that look exactly like live traffic and cannot be found
again. Hence the single emitting module: it is the only way to make one rule
cover every call site.

Two consequences to design around rather than discover:

- **`unit_price`, `discounted_price` and `total_amount` are required
  parameters** on `ec:addToCart`, `ec:removeFromCart` and `ec:order`. "Omit the
  column" is no longer available, so non-negotiable 8 needs a different answer:
  the generator drops any product whose price it could not scrape, rather than
  inventing one. At a 30 product cap, losing a few costs nothing.
- **`ec:order` writes two tables**, `order_events` and `order_events_detail`. It
  is not yet confirmed whether a custom column passed once reaches both. If it
  reaches only the header, the per-item rows cannot be purged by slug and need a
  different handle. Verify before Phase 3.

---

## 16. Sources

- CreateTable: https://dev.dengage.com/reference/createtable
- On-Site Targeting campaigns: https://dev.dengage.com/docs/on-site-1
- Web SDK: https://dev.dengage.com/docs/web-sdk
