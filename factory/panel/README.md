# What is left to do in the Dengage panel

**This page is the list of things to do.** Everything the repository can do is done. What
remains is panel work, and this is all of it. Nothing here is per demo: do it once and every
demo the factory generates uses it.

## The four documents, and which one you want

| | |
|---|---|
| **This page** | the numbered list of what to do, in order |
| [`SMS-AND-PUSH.md`](SMS-AND-PUSH.md) | the two live short form channels, field by field, from scratch |
| [`SCENARIO-EMAILS.md`](SCENARIO-EMAILS.md) | the seven Code Editor emails, one journey each. One paste per email and nothing else |
| [`REFERENCE.md`](REFERENCE.md) | the panel's own templates, web push explained, the App Inbox, the product feed. Background rather than steps |
| [`content/_dynamic/README.md`](content/_dynamic/README.md) | the saved Dynamic Content assets, and the six step pattern for writing another one |

Two more, one level out: [`factory/emails/BEEFREE.md`](../emails/BEEFREE.md) for the Email
Builder template, and [`supabase/README.md`](supabase/README.md) for the Postgres side.

> **Where the content actually is**, because there are three places and only one of
> them is per demo.
>
> | | |
> |---|---|
> | `content/_shared/` | the abandoned cart email. **One template for every demo** |
> | `content/_dynamic/` | the saved Dynamic Content assets. **Shared, created once** |
> | `content/<slug>/` | the only per demo part: `messages/index.html` for the push, SMS, WhatsApp, inbox and on site copy, and `dps_product.csv` |
>
> `content/<slug>/messages/index.html` is one self contained page showing every
> message rendered, with a copy button that puts the panel version on the clipboard.
> It opens straight from disk with no server, and the build regenerates it, so a new
> demo arrives with its own set.
>
> **There is no `content/<slug>/emails/`, and the ten Code Editor journey emails are
> gone.** Deleted 10 August 2026. They read product names and images from event tables,
> which have never had either, so the set was never produced for any demo. The shared
> abandoned cart email replaced them and works end to end. Anything new goes the same
> way: a Dynamic Content asset over `dps_product`, six steps, in
> `content/_dynamic/README.md`.
>
> All of it lives here rather than in `demos/<slug>/` because `pages.yml` publishes
> `demos/`, and a page naming panel locations next to sample data does not belong on
> a customer facing URL.

Last reviewed **10 August 2026**. To re-check the campaign half without opening the
panel:

```bash
bash factory/panel/live-campaigns.sh
```

That is an unauthenticated read of files the SDK already fetches in every visitor's
browser. It prints every campaign, its trigger, its status and its event name, so it
answers "is it live" faster and more reliably than looking.

---

## Do these, in order. This is the whole list

### 1. Three HTML Dynamic Content assets. Content > Dynamic Content

All three exist. **All three changed on 9 August, so paste the current file over each one.**
Type **HTML**. The Plain Text assets are step 2.

| Asset name in the panel | Paste this file |
|---|---|
| `dps abandoned cart` | `content/_dynamic/abandoned-cart.html` |
| `dps abandoned cart total` | `content/_dynamic/abandoned-cart-total.html` |
| `dps recommendations` | `content/_dynamic/recommendations.html` |

Nothing to attach and nothing to click. Their ids are recorded in `factory/sandbox.json`,
so the email template calls them by id.

### 2. SMS and web push. One page, on its own

**[`factory/panel/SMS-AND-PUSH.md`](SMS-AND-PUSH.md)** is the whole of it, from scratch: three
Plain Text assets with a link to each body, then the exact field values for the SMS and for
the push. Nothing else on this page is needed for those two channels.

The short version: three assets, `dps abandoned cart line`, `dps abandoned cart image` and
`dps abandoned cart url`. The first is copy and feeds five places, including the email subject
line and preheader. The other two are a picture and a link, which is what makes a rich push
carry the visitor's own product and land on their own basket.

### 3. Seven scenario emails. Content > Email > Code Editor

**New, 10 August 2026.** One HTML email per journey: checkout rescue, browse abandonment,
failed search, wishlist, basket building, replenishment and win-back. Each is **one paste**
with no Dynamic Content asset behind it, because a Code Editor email carries its own query.

**[`SCENARIO-EMAILS.md`](SCENARIO-EMAILS.md) is the whole of it**, with the file, the subject
and the pre-header for each. Open the `.preview.html` beside each one first: it is that
email rendered against a real catalogue rather than a drawing of it.

### 4. Re-import the email template. Content > Email > Email Builder

```
factory/panel/content/_shared/beefree-abandoned-cart.json
```

**One template for every demo, imported once.** Nine rows, and it names no storefront,
so it can never contradict the basket inside it. `factory/emails/BEEFREE.md` says why
and what is in it. Open the `.preview.html` beside it first if you want to see it
before uploading.

### 5. One abandoned cart campaign, using that template

One campaign serves every demo, for the same reason the template does. Trigger and
segment are yours; the content half is done.

### 6. Confirm the ETL runs on a schedule

Postgres reloads every demo's catalogue every ten minutes by itself. The Dengage
Automated Flow is what copies it into `dps_product`, and **if that flow is not on a
recurring schedule, a new demo's products never arrive** and its emails have nothing
to render. Set the frequency you want on the flow. `supabase/README.md` has the chain.

### 7. Five inline creatives, when support enables Inline

Written and committed, nothing to build. The table is below.

### 8. Watch the MP4 through once

Detail below. It takes a minute and it is the one thing a URL check cannot answer.

---

## The one thing that unblocks everything still parked

**Dengage needs to be told where our product list lives:**

```
https://dengage-presales.github.io/demo-ai/feed/products.csv
```

That address is live and correct now. Someone with backend settings access, not the
campaign builder, pastes it in. That single step unblocks Product Box, Smart Search,
the five recommendation cards, and the engine based half of the email rail. Nothing
else is waiting on anything.

---

## Nothing to do, listed so nobody goes looking

| | |
|---|---|
| Campaigns live and ACTIVE | **17** |
| Story | active |
| Web push | live. No campaign, by design |
| App inbox | live. No campaign, by design |
| `dps_product` | loaded, 28 of 28 columns type aligned |
| Event definitions | the six standard tables, nothing to define |
| The `.json` cart asset | written, and waiting for a push carousel to call it. Create it when that message exists, not now |

---

## Not the panel, but on the same list

| | |
|---|---|
| **Rotate the API credentials** | they were pasted into a chat. Nothing wrote them to disk here, and rotating is still the right move |
| The unsubscribe link | the shared email footer has none, because there is no one storefront to point it at. If Dengage exposes an unsubscribe URL or tag, tell me and it goes in |
| Supabase Vault secrets | `dengage_api_userkey`, `dengage_api_password`, `dengage_flow_id`, plus a password on the `dengage_ro` role. Only needed for Postgres to trigger the flow itself |
| GitHub | repository visibility and protection on `main` need your admin access |

---

## The five inline creatives, which you are re-enabling now

**Nothing to build.** All five creatives are written and committed. As support
turns them back on, create one campaign each.

| Campaign | Paste | Inline target |
|---|---|---|
| `dengage_demo_inline-below-header` | `factory/creatives/inline/below-header.html` | `#dn_inline_target_below_header` |
| `dengage_demo_inline-below-hero` | `factory/creatives/inline/below-hero.html` | `#dn_inline_target_below_hero` |
| `dengage_demo_inline-in-grid` | `factory/creatives/inline/in-grid.html` | `#dn_inline_target_in_grid` |
| `dengage_demo_inline-pdp-below-price` | `factory/creatives/inline/pdp-below-price.html` | `#dn_inline_target_pdp_below_price` |
| `dengage_demo_inline-above-footer` | `factory/creatives/inline/above-footer.html` | `#dn_inline_target_above_footer` |

Settings for all five:

```
Trigger            Data Layer Event
Event name         the campaign name above, exactly
Content type       Inline
Inline target      the selector above. Find it with the panel's Inline Target
                   Selector by searching  dn_inline_target
Where to display   /.*/
Status             Active
```

**Find the target with the selector tool rather than typing it.** An empty slot has
no height, so the tool's overlay has nothing to draw. Pick it from the node list.

On the **Custom Inline** template with three fields, paste the three files in the
matching folder instead of the single document. Both forms are generated from the
same sources so they cannot disagree. `factory/creatives/inline/FIELDS.md`.

---

## One thing to check rather than build

**The MP4.** `dengage_demo_video-popup` is live and points at

```
https://dengage-presales.github.io/demo-ai/assets/video/dn-ecomm-demo.mp4
```

Open it in Preview and **watch it through once** in the browser you drive calls
from. A URL that resolves proves the file is reachable, not that the browser
decodes it, and those are different questions.

If the template has no autoplay switch, a parameter on the URL will not give you
one: `?autoplay=1` and `#t=3` are a YouTube and Vimeo convention and a direct
video file ignores them. Use the self playing image instead, which needs no
attribute and no autoplay permission:

```
https://dengage-presales.github.io/demo-ai/assets/video/dn-ecomm-demo.svg
```

Full explanation and the tested results: `factory/panel/REFERENCE.md`.

---

## Parked, and deliberately

Every card below is currently **hidden from the launcher**, not just unbuilt. A
prospect never sees a button for any of these until they are turned back on, and
turning one back on is one line in `template/js/panels.js`, marked and easy to
find. None of this needs another visit to this page: it is written up so the work
is not lost, for whenever it is picked up.

| | Why it's parked | Written up at |
|---|---|---|
| Product Box | needs Dengage to hold this application's product list, and that is not plugged in yet | `factory/panel/REFERENCE.md` |
| Product Box, in email | same blocker, but **no longer needed for the abandoned cart email**. Its rail is real now: what the contact actually viewed, then the basket's categories, then the site's own trending. Product Box would add the engine's ranking on top, and the audience wide strategies, Others also viewed and Frequently bought together, still need it | `content/_dynamic/README.md` |
| Smart Search | same reason, plus it needs two separate setup pieces once the list is plugged in | `factory/panel/REFERENCE.md`, `factory/panel/REFERENCE.md` |
| The 5 recommendation cards | not actually blocked, but showing a working recommendations section next to two cards saying "not ready" looked inconsistent | `template/js/panels.js` |
| Typeform | it is real, but it is built differently in the panel than everything else here and deserved a second look before shipping it | see below |
| The 90 day purge | held for Phase 3 | handoff §10, and §1a before anything is armed |

**In plain terms, Product Box and Smart Search are both waiting on the same thing:**
Dengage needs to be told where our list of products lives. I already built that
list and it's ready and working right now at this address:

```
https://dengage-presales.github.io/demo-ai/feed/products.csv
```

Someone with access to Dengage's backend settings (not the regular campaign
builder, a different, more technical settings screen) needs to paste that address
in so Dengage can read it. That one step is the only thing stopping both of these
and the 5 recommendation cards. It's not something I can click for you from this
side.

**Typeform, in plain terms:** when you opened it in the panel, there was no
"Trigger" setting anywhere on that screen, which is what confused things. That's
because Typeform in your account is not a ready-made template like Story or the
Video Popup. It's a page you build yourself (Salil already built one, the content
you had open), and only once you press **Create Campaign** on that page does a
second screen appear where the Trigger setting actually lives. I'd like to see that
second screen before saying anything more definite, so for now it's parked with
the rest rather than half-explained. If you press "Create Campaign" and send me a
screenshot of what comes up, I can tell you exactly what to pick.

---

## The two capabilities that are already done

Neither needs a campaign, and neither is on the list above. They are here so nobody
goes looking for a campaign that was never meant to exist.

**Web push.** The service worker is live at the origin root. The launcher's card
raises the browser's own permission prompt, and that is the whole of what a page
can do: only a server can send a notification. To make it feel instant on a call,
point a journey at one of the storefront events. Plain language walk through:
`factory/panel/REFERENCE.md`.

To send one on demand, for a rehearsal rather than in front of a prospect:

```bash
node factory/panel/send-instant-push.mjs --segment <uuid>          # prints, sends nothing
```

**Before the first run**, build a segment in the panel matching only the demo
contacts, whose keys all begin `DPS-`, and pass its id. The script refuses to run
without one, because the platform picks the audience itself if the request does
not name one.

**App inbox.** In the storefront, reading the messages Dengage holds for the
device. It is the one capability with no panel template behind it, because nothing
in the Visual Editor draws an inbox. Send a message from a campaign or a journey
and press Refresh in the drawer.

---

## Seeing what the demo just sent

Add `?debug=1` to any demo URL:

```
https://dengage-presales.github.io/demo-ai/demos/showcase/?debug=1
```

A small readout appears bottom left listing every event the page sends, newest
first, with its full payload and **the table each one writes**. It stays on as you
click through to a product page. `?debug=0`, or the x on the panel, turns it off.

**It shows what the page SENT, not what Dengage STORED.** That is still two
different things, and the row in Data Space is still the proof. What it settles in
one glance is the question that used to take an afternoon: did pressing that
button send anything at all, and what was in it.

Nothing about it is visible on a normal demo. No query string, no readout.

## The identifiers, without retyping them

Open **Dengage scenarios** in the demo and expand **Quick reference**, just under
the scenario cards. It lists this browser's device id, session id, push token,
contact key and the application, each with a Copy button that puts the full value
on the clipboard.

Two of those legitimately read "not available yet": there is no push token until
the browser has granted notification permission, and no contact key while the
visitor is anonymous. Both are normal states rather than faults.

## Three hosts have to be reachable from the machine running the demo

A demo talks to three different Dengage hostnames, and an ad blocker, a privacy
extension or a DNS filter can block one while allowing the next. On 7 August 2026
AdGuard on a phone was blocking the event host and permitting the push host, which
cost most of a morning: the SDK loaded, the device registered, the launcher fired,
and not one event was ever stored.

| Host | Carries | If it is blocked |
|---|---|---|
| `pcdn.dengage.com` | the SDK and the creatives | **visible on a call.** No widget renders at all |
| `event.dengage.com` | every storefront event | **silent.** The demo looks perfect and records nothing |
| `push.dengage.com` | subscription and push | no push, and no device record |

**Allowlist all three on any machine used to present**, including the phone if
mobile is being shown. The silent one is the dangerous one: nothing on screen looks
wrong, so it is discovered days later when someone asks where the data went.

To tell in ten seconds, add `?debug=1` to the demo URL. Every request to a
dengage.com host is listed with its host and its outcome, and a blocked one reads
"no response, nothing reached Dengage" in amber. That works on a phone, where there
is no network panel to open.

## Checking events are landing

Worth doing once, and worth doing again any time a demo looks like it is not
recording. **An HTTP 200 from the event endpoint means accepted, not stored.**

```bash
DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
  node factory/phase0/tables.mjs --counts
```

Run it, use a demo storefront, run it again. Read the result in one direction only:
the account is shared, so a count that moved is not proof it was your event, and a
count that did not move is proof it was not.

No credential is ever written into this repository, and nothing in this repository
deletes, drops or truncates anything in Dengage. CLAUDE.md §1a.
