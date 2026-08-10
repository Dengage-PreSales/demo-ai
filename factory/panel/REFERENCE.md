# Panel reference

Everything about the Dengage panel that is not a step to take today. For what to do now,
see [`README.md`](README.md), and for SMS and web push specifically see
[`SMS-AND-PUSH.md`](SMS-AND-PUSH.md).

| | |
|---|---|
| [The panel's own templates](#the-panels-own-templates) | Story, Video Popup, Vertical Popup, and the three that are parked |
| [Web push, in plain language](#web-push-in-plain-language) | how it works, what surprises people, and sending one on demand |
| [App Inbox](#app-inbox-and-it-is-built) | built, and the one capability with no panel template behind it |
| [The product feed](#the-product-feed) | the catalogue, and the one thing that unblocks what is parked |

**Merged 10 August 2026** from `NATIVE-TEMPLATES.md` and `PRODUCT-FEED.md`, which said
overlapping things about the same three parked capabilities in two places. The parked
sections are compressed here rather than deleted: what unblocks them is one line, and it is
in this same document.

---

# The panel's own templates

Some of the launcher's cards have **no creative file**, and that is deliberate. They are
Dengage's own Visual Editor templates: the template *is* the creative, configured with
settings rather than pasted HTML. There is nothing to copy into a code editor.

That does not mean there is nothing to hand over. A template still needs **content**:
images, titles, labels, a video. This document carries all of it, ready to type or paste,
alongside the settings each template needs.

Each is flagged `panel: true` in `template/js/panels.js`, and `factory/checks/launcher.js`
is told to expect a card with no file for exactly those. Any *other* card without a creative
is a defect.

Two cards in the launcher are neither creatives nor templates: **Web push** and **App
inbox**. Both are below.

---
## The content is shared, which decides what it can be

One campaign per template serves every demo. The same story circle appears on a
fashion prospect's demo and an industrial supplier's demo in the same week. So
none of the artwork or copy below names a brand, a product, a price, a season or
a vertical. It is abstract geometry in Dengage blue, and the words carry the
meaning.

Every image and the video are **committed to this repository** and served from
the published origin. A panel field needs an absolute URL, and a relative one
would resolve against Dengage rather than the demo:

```
https://dengage-presales.github.io/demo-ai/assets/...
```

Never point a panel field at a prospect's CDN. They can change it between the
build and the call.

To regenerate any of it:

```bash
node factory/creatives/native/make-assets.js    # story and popup images
node factory/creatives/native/make-video.js     # the video
```

---

## Settings common to all five templates

```
Trigger              Data Layer Event
Where to display     /.*/
Status               Active
Show every X minutes 1
Max show count       100
```

Match the frequency to the other twenty. A campaign set to a tighter cap goes
quiet after a few presses and reads on a call as a widget that broke, which is
what happened to the parked recommendation campaign at 5 minutes / max 5.

---

## 1. Story

`dengage_demo_story`

Content > Onsite > New > **Story**

Five stories, in this order. Each row is one **Story** inside the one **Story
Set**.

| # | Story Name | Story Photo (the circle) | Background Color |
|---|---|---|---|
| 1 | `Welcome` | `.../assets/story/dn-story-welcome-circle.png` | `#0A2A6E` |
| 2 | `Picked for you` | `.../assets/story/dn-story-picked-circle.png` | `#0A2A6E` |
| 3 | `Back in stock` | `.../assets/story/dn-story-restock-circle.png` | `#0A2A6E` |
| 4 | `Delivery` | `.../assets/story/dn-story-delivery-circle.png` | `#0A2A6E` |
| 5 | `Need help?` | `.../assets/story/dn-story-help-circle.png` | `#0A2A6E` |

Prefix every path with `https://dengage-presales.github.io/demo-ai`.

**If the template has a second image field for the story body**, a full bleed
portrait panel exists for each, already carrying its own title text:

```
.../assets/story/dn-story-welcome-panel.jpg
.../assets/story/dn-story-picked-panel.jpg
.../assets/story/dn-story-restock-panel.jpg
.../assets/story/dn-story-delivery-panel.jpg
.../assets/story/dn-story-help-panel.jpg
```

The circles are 400 by 400 PNG, flat artwork on white, framed so the template's
circular crop takes nothing meaningful off the edges. The panels are 1080 by 1920
JPEG, around 60 kB each.

**Stories Title:** `What this demo can do`

**CTA, on every story:**

| Field | Value |
|---|---|
| Button text | `See the scenarios` |
| Destination URL | `https://dengage-presales.github.io/demo-ai/` |
| Open in new tab | **yes** |
| Button colour | `#FFFFFF` background, `#0A2A6E` text |

**Why that URL and why a new tab.** A shared creative has no single correct
destination: there is no per demo URL it could carry, and a relative path would
resolve against Dengage. The factory index is the one absolute URL that is
correct on every demo. New tab keeps the storefront on screen, which matters
because the demo is what is being screen shared.

**Styles:** item size around 64 px, border thickness 2 px, border radius 50%,
active border `#125CFA`, passive border `#E4E7EC`.

---

## Parked: Product Box, Typeform and Smart Search

All three hidden from the launcher, Salil's call, 6 August 2026. Two of them are parked on
**one** thing, which is [the product feed](#the-product-feed) below, and the third on an
unconfirmed panel screen. None is parked on work in this repository.

| Card | Campaign | Parked on |
|---|---|---|
| Product Box | `dengage_demo_product-box` | the feed, for the **Dynamic** variant. The **Static** variant works on this application today |
| Smart Search | `dengage_demo_smart-search` | the feed, plus a Search Container key and a Recommendation Rule key once it lands |
| Typeform | `dengage_demo_typeform` | nothing external. What is unconfirmed is the second screen it needs |

**Product Box.** A small panel of product cards over the page. Static takes products typed
into the campaign and involves neither the page nor the backend, so it runs now: fill it from
`demos/<slug>/products.json` so the box matches the storefront it sits on, three or four
products, and use the **real** product id rather than a placeholder because interactions with
it can be segmented on afterwards. Dynamic asks Dengage which products to show, which needs
Web enabled in Stats, an algorithm configured, and the feed. **This one card is per demo
rather than shared**, the only exception on this page, because a product box showing another
vertical's products is worse than no product box.

**Smart Search.** Content > Onsite > New > Visual Editor > Search Widget. The target selector
is **`#search-input`**, the storefront's own search box, which already exists on both pages
and is stable, so **there is nothing to do on the page**. In order: confirm the SDK
integration and the Analytics Event Definitions, which are already done; get the feed
registered; ask a developer for a **Search Container** key; configure a **Recommendation
Rule** and note its key; create the campaign with both keys. Until the feed exists the widget
attaches and stays empty, which is not a misconfiguration and no panel work will change.
Settings once it can run: Show Results on Open `yes`, Min Query Length `3`, Max Products `6`,
`3` columns, `2` rows, Campaign Priority **High**, delivery **Show without limits** with
**Stop after engagement** off.

**Typeform.** Not one of the ready-made templates: it is a plain on-site content template
holding Typeform's own embed snippet, a script and a div, authored once in the content editor.
That content has **no trigger setting anywhere on its screen**, which is the confusing part.
The trigger lives on a separate object, created afterwards by pressing **Create Campaign**
from that content, where the conditions are defined under Campaign Targeting On Site. What is
still unconfirmed is exactly what that second screen offers.

---
## 3. Video Popup

`dengage_demo_video-popup`

Content > Onsite > New > **Video Popup**

Plays video in the popup itself rather than redirecting, which is the whole point
of the template over an image popup.

> **The launcher plays this film too, since 8 August 2026.** The Video popup card
> in every demo's scenario panel opens an on-page overlay auto playing the same
> committed video from the demo's own files, so the capability shows on a call
> even where this panel campaign is not configured. The card deliberately does
> not fire the `dengage_demo_video-popup` trigger, because on a demo where this
> campaign IS live that would stack the panel's popup on top of the overlay. The
> two coexist: the overlay is the guaranteed demonstration, this template is the
> real product.

### The video

Use the MP4:

```
https://dengage-presales.github.io/demo-ai/assets/video/dn-ecomm-demo.mp4
```

H.264, 1.7 MB. It plays in every current browser, including Safari, so it is the
one to paste into the field. The WebM is the same six titles in VP8 and stays for
anywhere an MP4 is not wanted:

```
https://dengage-presales.github.io/demo-ai/assets/video/dn-ecomm-demo.webm
```

1280 by 720, 18.2 seconds of file around 16.8 seconds of sequence, about 1.8 MB.
Six titles naming what the demo can do, in Dengage blue, no brand and no vertical.
Neither file has an audio track.

**Test the exact URL in Preview before a call.** The documentation does not state
which sources the template accepts, so whether it takes a direct file URL, a
YouTube embed or both is worth knowing before you are on a call rather than
during one. Watch it through once at the same time: it is the only way to be sure
the browser driving the call decodes the file, and it costs twenty seconds.

### Settings

| Section | Settings |
|---|---|
| Content | Layout Position `Center`, Pop-up Max Width `640px`, Dismiss on Click Outside `yes`, Keep in Place on Scroll `yes`, Close Button `yes` |
| Media | the MP4 URL above |
| Styles | Card Radius `12px`, Card Padding `16px`, Background `#FFFFFF`, Close Button Colour `#14181B` |

### Autoplay, and why the URL cannot carry it

**A parameter on the video URL will not start the video.** Query strings and hash
fragments like `?autoplay=1` and `#t=3` are a YouTube and Vimeo convention,
handled by their player code. A direct `.webm` or `.mp4` goes into a plain HTML
`<video>` element, which reads its behaviour from HTML attributes and ignores the
URL entirely. That is true of every site and every panel, so it is worth knowing
before you spend time on the field.

Tested here, every one loading a file that does play when asked properly:

| URL | Result |
|---|---|
| `...dn-ecomm-demo.webm` | paused at 0 |
| `...dn-ecomm-demo.webm?autoplay=1` | paused at 0 |
| `...dn-ecomm-demo.webm?autoplay=1&mute=1&loop=1` | paused at 0 |
| `...dn-ecomm-demo.webm#t=3` | paused at 0 |
| `...dn-ecomm-demo.webm#t=0,5` | paused at 0 |
| `...dn-ecomm-demo.mp4?autoplay=1` | paused at 0 |
| the same file with `autoplay muted` and no parameters | plays |

Only the `autoplay` attribute starts a video, and browsers only honour it when
the video is also muted. So there are two ways to get motion on open.

**1. The template's own fields.** If the Video Popup exposes Autoplay, Muted or
Loop, set Autoplay and Muted **together**. Autoplay alone will not play: Chrome,
Safari and Firefox all block an unmuted autoplay, and Chrome does it silently, so
a card that looks correctly configured still opens paused. Muting costs nothing
here, because the file has no audio track at all.

**2. The animated image.** This is the recommendation for a live call, because it
does not depend on the browser's autoplay policy at all.

```
https://dengage-presales.github.io/demo-ai/assets/video/dn-ecomm-demo.svg
```

5 kB, same six titles, same Dengage blue, 16.8 seconds, and it **loops forever**.
It is an SVG carrying its own CSS animation, which means it plays by itself in
any field that takes an image, with no attribute and no permission from the
browser's autoplay policy. Put it in an Image Popup, the Vertical Popup media
field, a Slide In, or the Video Popup if that field accepts an image URL. Six
distinct frames were confirmed rendering from a plain `<img>` tag with no
attributes on it.

The trade is that it is drawn text and shapes rather than encoded frames, so it
cannot carry a screen recording. For six lines of Dengage blue on white it is
indistinguishable from the video, and it is 340 times smaller. It also sidesteps
the codec question entirely, since every browser draws an SVG.

The WebM and the SVG come out of the same generator, from one list of titles, so
the two cannot drift apart:

```bash
node factory/creatives/native/make-video.js
```

The MP4 is the WebM re-encoded to H.264 and is committed alongside them.

---

## 4. Vertical Popup

`dengage_demo_vertical-popup`

Content > Onsite > New > **Vertical Popup**

Image, text and buttons stacked vertically. **No form**, so nothing is captured:
it is a message with up to two buttons.

### The content

**Media:**

```
https://dengage-presales.github.io/demo-ai/assets/popup/dn-vertical-popup.jpg
```

900 by 560, about 23 kB. It carries the Dengage mark and no words, because the
template supplies the title and message itself and an image with its own heading
would show two.

**Title:** `Everything here is a Dengage scenario`

**Message:** `This popup is one of them. Open the scenarios panel to fire the
rest, and watch each one arrive on the page.`

**Primary button**

| Field | Value |
|---|---|
| Text | `Got it` |
| Alignment | centre |
| Size | large, full width |
| Background | `#125CFA` |
| Text colour | `#FFFFFF` |
| Radius | `10px` |

**Secondary button**

| Field | Value |
|---|---|
| Text | `Not now` |
| Alignment | centre |
| Background | transparent, `1px` border `#E4E7EC` |
| Text colour | `#667085` |
| Radius | `10px` |

**Neither button navigates.** Both dismiss. This is the same rule the eight
pasted creatives follow: there is no destination that is correct on every demo,
so a shared creative reports the click and closes.

**Layout:** Position `Center`, Max Width `420px`, Dismiss on Click Outside `yes`,
Keep in Place on Scroll `yes`.

---

## Web push, in plain language

`Web push` in the launcher is not a campaign and pushes no data layer event. It
calls the SDK directly.

### The one thing that surprises everyone

**A web page cannot send a notification.** Not this page, not any page. Only two
parties can: the browser, and a server the browser has agreed to listen to. So
the button in the launcher does not send anything, and no amount of code on the
page could make it.

### What actually happens, in four steps

1. **The page asks.** Pressing **Web push** raises the browser's own permission
   dialog. That is the box saying "dengage-presales.github.io wants to show
   notifications".

2. **The browser answers.** If the visitor allows it, the browser mints a
   subscription: a long, unique address that only that browser on that machine
   answers to.

3. **The SDK hands that address to Dengage.** This is the step that matters and
   the one nobody sees. Dengage now has somewhere to send to. The device shows up
   in the panel as subscribed.

4. **Dengage sends.** A campaign or a journey in the panel pushes to that address.
   The browser receives it and draws the notification, even if the storefront tab
   is closed.

So the demo's job ends at step 3. Everything visible happens because of step 4,
which is panel work.

### Making it feel instant on a call

The gap between pressing a button and a notification appearing is what makes this
awkward to demo. Close it by pointing a journey at one of the storefront events
the Event panel already sends. Add something to the cart, and the journey fires a
push a moment later. Now pressing a button on the page does lead to a
notification, which is the story worth telling, and it is true rather than staged:
the event really did travel to Dengage and the push really did come back.

### Two things that will bite

**It has to be a real click.** Browsers ignore a permission prompt raised without
a user gesture. Worse, a *dismissed* prompt counts against the whole origin, so a
demo that asked on page load would quietly poison push for every later demo on
that machine. That is why this is a button and never automatic.

**Permission is remembered per origin, not per demo.** All demos share
`dengage-presales.github.io`. Once you have allowed it on one, every later demo on
that browser is already allowed, and the prompt will not appear again. To show the
prompt itself, reset notification permission for the site in browser settings, or
use a fresh profile.

The service worker that receives the notification is already live at the origin
root, `https://dengage-presales.github.io/dengage-webpush-sw.js`, in the
`dengage-presales.github.io` repository rather than this one.

### Sending one on demand, without waiting for an event

There are two ways to make a push appear on a call, and they suit different
moments.

**A journey, for the demo itself.** This is the one to use while a prospect is
watching, and it is the one described above: point a journey at a storefront event,
add something to the cart, the push arrives. It reaches exactly the device that
triggered it, it needs no credential, and the story it tells is the product's own.

**SendInstantPush, for a rehearsal or a screenshot.** When you want a push on
screen right now, without doing anything on the storefront first, there is an API:

```
POST https://api.dengage.com/rest/push/sendInstant
```

Documented at <https://dev.dengage.com/reference/sendinstantpush>. This repository
has a wrapper for it:

```bash
# print exactly what would be sent, and send nothing
node factory/panel/send-instant-push.mjs --segment <uuid>

# send it
DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
  node factory/panel/send-instant-push.mjs --segment <uuid> --send

# read the delivery numbers afterwards
DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
  node factory/panel/send-instant-push.mjs --report <trackingId>
```

The message is generic, exactly like the shared creatives, so it suits any call:
the Dengage title, one line of body, and the Dengage popup image. `--title`,
`--message` and `--url` override any of those for one send.

### Three things to know before running it

**It is not a launcher card, and it cannot be one.** The API authenticates with an
account level token. A token a public static page can read is a token anyone can
read, so the credential stays in the environment of a machine you control and
never goes near the storefront. That is why every other scenario is a button and
this one is a command.

**It selects an audience, not a device.** The request takes a `segmentId` or a
`tableId`, which is the right shape for a server side send and the wrong shape for
"push to the browser in front of me". So before the first run, build a segment in
the panel that matches the demo contacts only, whose keys all begin `DPS-`, and
pass its id. The script refuses to run without one, because the platform picks the
audience itself if the request does not.

**Check `--report` rather than assuming.** A 200 means queued. The delivery numbers
are the proof it arrived, and `--report` prints them broken down by browser and
device type. Same discipline as an event: accepted is not delivered.

The script has three habits worth knowing. It never sends without printing the
whole request first and asking for a typed confirmation. It always names this
repository's application explicitly, so a send cannot reach an application it has
nothing to do with, and there is no flag to change that. And it does not retry a
send, because a request that reached the platform and then timed out on the way
back would arrive twice.

```bash
node factory/panel/send-instant-push.mjs --self-test
```

27 assertions over the request builder, run without credentials and without
sending anything. Nine of them are the same assertion under different arguments:
the request names one application and it is ours.

---

## App Inbox, and it is built

**This is now in the storefront**, as of this change. It was the one genuine gap
on the list rather than a configuration step, because no Visual Editor template
draws an inbox: Dengage serves the messages and the site draws them. So it is
built in `template/js/inbox.js`.

### What is on the page

- A **bell in the header**, on both pages, with an unread count.
- A **Messages drawer**: the list, each message with its image, title, body,
  timestamp, any buttons the panel attached, and a dismiss.
- An **App inbox card** in the launcher, which opens the drawer and re-reads it.

### How it works

The SDK holds one inbox per **device**, and the site reads it:

| What the site calls | What it does |
|---|---|
| `InboxMessageProvider` | asks the SDK for the inbox reader |
| `getMessages` | reads this device's messages |
| `onImpression` | reports that a message was shown |
| `onOpen` | reports that it was opened |
| `onClick` | reports that a button in it was pressed |
| `onDelete` | removes it from the inbox Dengage holds |

**No push permission is needed.** The inbox is keyed on the device id the SDK
creates when it initializes, so an anonymous visitor who has never seen a prompt
still has one. That makes the inbox the better half of the messaging story on a
call: nothing to accept, nothing to reset, and the message is still there when you
come back to it.

### What to do in the panel

Send a message to the inbox from a campaign or a journey, the same way you would
send a push, then press **Refresh** in the drawer. Anything the inbox holds for
that device appears.

Until something is sent, the drawer says so, and it distinguishes an inbox that
is genuinely empty from one that has not connected yet. Those look identical in a
naive implementation and read on a call as a broken feature.

### One deliberate limitation

**Dismissing a message hides it in the browser and deletes nothing in Dengage.**
The provider does offer a real delete, and it is wired but switched off, because a
delete against an account shared with five live demo sites is not something a demo
should do on its own initiative (CLAUDE.md 1a). Setting
`dengage.inboxReportDelete` to `true` in `demos/<slug>/demo.config.json` turns the
real call on. That is a decision to make rather than a default to inherit.

# The product feed

The catalogue Dengage needs, and the one thing standing between this application and
three capabilities.

```
https://dengage-presales.github.io/demo-ai/feed/products.csv
https://dengage-presales.github.io/demo-ai/feed/products.json
```

Both are regenerated whenever a demo is built, committed alongside it, and published by
GitHub Pages. Nothing needs to be uploaded by hand.

---

## Why three things were blocked on one

| Capability | Why it was empty |
|---|---|
| Smart Search | returns products, and there were none |
| Recommendation engine | same |
| Product Box, Dynamic variant | same |

None of them was misconfigured, and no amount of event traffic would have fixed
any of them. `ec:search`, `ec:addToCart` and the rest record **behaviour**. A
recommendation needs a **catalogue**, which is a different thing, and Dengage had
no catalogue for application `99d9b8fb-0c62-5a85-3e43-2402554d93a5`.

---

## What to do

**1. Point the product integration at the feed.** In the panel, wherever product
integration is configured for this application, give it the CSV URL above. If it
offers a refresh schedule, daily is plenty: the feed only changes when a demo is
built or expires.

**2. Map the columns.** They are named to match Dengage's own filter vocabulary,
so this should be a lookup rather than a decision.

| Column | What it is | Dengage filter field |
|---|---|---|
| `product_id` | the same id every `ec:*` event sends | the join key |
| `demo_slug` | **which demo this product belongs to** | custom catalog attribute |
| `name` | product name, from the prospect's own catalogue | |
| `category` | the prospect's own category | Category |
| `brand` | where the feed published one | Brand |
| `price` | what a customer pays now | Price |
| `original_price` | what it was before any discount | Original Price |
| `discount` | the difference, `0` when there is none | Discount |
| `currency` | three letter code, per demo | |
| `in_stock` | `true` or `false` | In Stock Status |
| `stock_level` | a number, **or empty meaning unknown** | Stock Level |
| `url` | the product page on the live demo | |
| `image_url` | a shared motif tile, see below | |

**3. Create one recommendation rule per demo, scoped by `demo_slug`.** This is
the step that matters most and the reason that column exists. See below.

**4. Then the three capabilities can be configured**, in this order, because each
needs the one before it:

- a **Recommendation Rule** filtered to one demo
- a **Search Container** for Smart Search, which also needs a recommendation rule
  for the products it shows before anything is typed
- **Product Box, Dynamic**, which needs Web enabled in Stats and an algorithm

---

## The scoping problem, stated plainly

**Every demo shares one Dengage application, and an application has one product
catalogue.** So the feed is the union of every live demo. Right now that is one
demo and the question is invisible. At five to seven demos a month with ninety day
retention it will be around twenty demos and six hundred products, and a fashion
prospect being shown tyres is a real way to lose a call.

`demo_slug` is the answer: a recommendation rule filtered to `demo_slug` equals
one slug can only return that demo's products. Dengage's documentation says
Advanced Filters cover Category, Brand, Price, Original Price, Discount, Stock
Level, In Stock Status **and custom catalog attributes**, which is why the column
is there.

**This is the one thing here that could not be verified from the repository side.**
Whether the product integration accepts a custom attribute, and whether a rule can
then filter on it, is a panel and backend question. Two things follow:

- **If it works**, one rule per demo, filtered on `demo_slug`, and the problem is
  solved for good.
- **If it does not**, the feed is still correct and the question becomes yours:
  either a separate application per demo, which contradicts the single application
  design, or accepting cross-demo recommendations, which is not acceptable on a
  call. Worth settling before the second demo exists rather than the twentieth.

`category` is not a substitute. Two demos both having "Accessories" is normal.

---

## Two things about the data that are deliberate

**`stock_level` is usually empty, and empty means unknown.** A public product feed
publishes whether something is buyable, not how many are left. Shopify's
`products.json` carries `available` per variant and no quantity; schema.org carries
an availability URL. So:

- `in_stock` is a **fact**. `false` means no variant was available.
- `stock_level` is a **number only when the source published one**.

A product can therefore be in stock with no known level, and that is not a
contradiction. Writing a number there would be inventing one, and writing `0` in
particular would announce every product out of stock and poison every
back-in-stock segment built on it (CLAUDE.md 3.5).

**`image_url` is one tile per motif, not one per product.** The storefront draws
its product artwork inline as SVG so that nothing in a demo can 404 during a call.
That is right for the page and leaves a Dengage rendered widget with no image, so
each motif is rendered once to `assets/motifs/<motif>.jpg` and every product using
that motif points at it. Forty-eight files, shared by every demo, rather than
thirty per demo.

The consequence, stated so it is not a surprise on a call: **in a Dengage rendered
recommendation widget, two different jackets show the same tile.** On the demo's own
pages they also share a silhouette, so the two surfaces agree with each other. If a
specific call needs real photography, the scraping route is documented in handoff
7.3 and can be turned on for one demo.

---

## Rebuilding it by hand

```bash
node factory/make-motif-images.mjs     # motif tiles, and record each product's motif
node factory/build-feed.mjs            # the feed itself
node factory/build-feed.mjs --check    # CI: fails if the committed feed is stale
node factory/feed.test.mjs             # 45 assertions, no network
```

The motif pass needs a browser, because it asks the real classifier in
`template/js/artwork.js` rather than reimplementing it. A second copy of that
classifier would drift, and the drift would be silent: a feed whose images
disagree with the page.

**An expired demo drops out of the feed on the date**, without waiting for its
folder to be removed. Folder deletion is parked with the rest of the purge
(handoff 10), so the feed filters on `expiresAt` itself. A recommendation pointing
at a demo that has been taken down is a broken link on a live call.
