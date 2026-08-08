# The templates built in the panel, and the content to put in them

Five of the launcher's cards have **no creative file**, and that is deliberate.
They are Dengage's own Visual Editor templates: the template *is* the creative,
configured with settings rather than pasted HTML. There is nothing to copy into a
code editor.

That does not mean there is nothing to hand over. A template still needs
**content**: images, titles, labels, a video. This document carries all of it,
ready to type or paste, alongside the settings each template needs.

Each is flagged `panel: true` in `template/js/panels.js`, and
`factory/checks/launcher.js` is told to expect a card with no file for exactly
those. Any *other* card without a creative is a defect.

Two cards in the launcher are neither creatives nor templates: **Web push** and
**App inbox**. Both are explained at the end.

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

## 2. Product Box, PARKED 6 August 2026

`dengage_demo_product-box`

**Hidden from the launcher for now.** Everything below is still accurate and is
what to follow once this is picked back up: `factory/panel/PRODUCT-FEED.md` has
the one thing blocking it.

Content > Onsite > New > **Product Box**

### How it works

A small panel of product cards, laid over the page, in two variants.

**Static** takes products you type into the campaign. The panel holds the image,
id, name, price and destination for each, and shows exactly those. Nothing on the
page and nothing in the backend is involved, so it works on this application
today.

**Dynamic** asks Dengage which products to show, through a recommendation
algorithm. That needs Web enabled in Stats, an algorithm configured, and a
product integration feeding the catalogue in. None of those exist for this
application, which is the same missing feed that parked the recommendation engine
card.

### What to do

**Use the Static variant.** Fill it from the demo's own catalogue so the box
matches the storefront it is sitting on: `demos/<slug>/products.json` has the ids,
names, categories and prices. Take three or four products from it.

Per product: image, **Product ID**, name, price, discount price, button text,
target URL. The Product ID matters beyond display, because interactions with it
can be segmented on afterwards, so use the real id from `products.json` rather
than a placeholder.

Layout settings: position, max width, dismiss on click outside, keep in place on
scroll, CTA visibility, price and discount visibility, price direction, close
button.

**This one card is per demo rather than shared**, because the products in it come
from that demo's catalogue. It is the only exception on this page, and it is worth
the two minutes: a product box showing another vertical's products is worse than
no product box.

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

## 5. Typeform, PARKED 6 August 2026

`dengage_demo_typeform`

**Hidden from the launcher for now.** Corrected the same day it was documented, so
the correction is recorded here rather than left silently wrong.

### It is not one of the ready-made templates above

Story, Video Popup and Vertical Popup are each a single screen: Content > Onsite >
New > the template name, and the trigger (when it should appear) is a setting on
that same screen.

Typeform is different. What Salil built is a plain **on-site content template**
holding Typeform's own embed snippet, a normal script and a div, authored once in
the content editor. That content on its own has no trigger setting anywhere on
screen, which is the confusing part: **the trigger lives on a separate object**,
created afterwards by pressing **Create Campaign** from that content. Screenshot
evidence, 6 August: opening the content shows no Trigger field at all, and the
panel's own assistant confirms the two-step shape, content first, then "attach it
to a targeting campaign under Campaign Targeting On Site, where you define the
trigger conditions."

**What is still unconfirmed** is exactly what that second screen offers. The
Trigger table below, and the advice to pick Custom Event, was written assuming
Typeform's trigger setting works the same as every other template's. That may
still be right, since the underlying SDK has no idea which visual template a
campaign's content came from, but it was written before seeing the actual screen,
so treat it as a strong guess rather than a confirmed setting until someone has
looked at it.

| Trigger | The SDK listens on |
|---|---|
| Data Layer Event | `window.dataLayer.push({ event: <name> })` |
| **Custom Event**, the expected pick here | `window.addEventListener(<name>)` |
| Dengage Event | `window.addEventListener(<name>)`, the same handler |

If picked up again: open the content, press **Create Campaign**, and see what the
next screen actually offers before assuming either of the above. Whatever the
trigger type, the event name should be `dengage_demo_typeform`, and the launcher
card already sends both a data layer push and a matching window event on every
press, so it works whichever trigger type turns out to be right. Handoff 12.14 has
the full trigger table, and it applies to every card, not just this one: a trigger
mismatch produces no error anywhere, and `bash factory/panel/live-campaigns.sh`
prints the trigger for every live campaign without opening the panel.

**One thing to avoid whenever this comes back:** two campaigns sharing one event
name on different triggers. Both would fire and the prospect would see the widget
twice. `live-campaigns.sh` reports duplicates for exactly this reason.

To turn the card back on once this is sorted: one line in
`template/js/panels.js`, marked and easy to find.

---

## 6. Smart Search, PARKED 6 August 2026

`dengage_demo_smart-search`

**Hidden from the launcher for now**, for the same reason as Product Box, and it
needs the extra steps below on top once that reason is gone.

Content > Onsite > New > Visual Editor > **Search Widget**

The one with a real page side dependency, and the one with a prerequisite that is
not met yet.

### How it works

The widget attaches to a search input on the page and answers keystrokes with
products. Underneath, the SDK exposes it as a headless provider that the template
draws the results for, and reading that provider is what makes the requirements
below concrete rather than guessed. It is configured with a
**`searchContainerKey`** and a **`recommendationContainerKey`**, and it does two
different things:

**Before anything is typed**, it shows initial products, and it gets them from the
**recommendation** container rather than the search one. That is why a
recommendation rule is required even though this is a search widget.

**Once typing starts**, it waits for the input to settle, roughly 400 ms by
default, checks the query is at least `minChars` long, and asks the **search**
container for up to `maxResultCount` products. Answers are cached for five
minutes, so the same query typed twice on a call does not go back to the server.

It reports a search open and each settled query to Dengage with a request id, so
what people searched for is measurable afterwards.

Two things follow from that, and they are the whole problem:

- **Both containers need a product catalogue in Dengage.** The widget returns
  products, not pages. This application has no product feed, so both containers
  have nothing to return.
- **The storefront's own events do not supply it.** `ec:search` and the rest
  record *behaviour*, which is a different thing from a *catalogue*. Sending more
  events will never make this widget fill.

### What to do

**On the page: nothing.** The target selector is **`#search-input`**, the
storefront's search box in the search drawer, on both pages. It already exists
and is stable.

**In the panel and the backend, in this order:**

1. Confirm the SDK integration and the Analytics Event Definitions, both of which
   are already done for this application.
2. **Get a product integration configured for application
   `99d9b8fb-0c62-5a85-3e43-2402554d93a5`.** This is the blocker and it is a
   backend task, not a panel setting. It is the same feed the recommendation
   engine and Product Box Dynamic need, so one piece of work unblocks three
   cards.
3. Ask a developer to configure a **Search Container** and note its key.
4. Configure a **Recommendation Rule** for the initial products and note its key.
5. Create the campaign with both keys, target `#search-input`.

**Until step 2 exists, expect the widget to attach and stay empty.** That is not
a misconfiguration and no amount of panel work will change it. The card is in the
launcher anyway, because a capability nobody can fire is a capability the demo
does not have, and because the moment the feed lands this becomes a five minute
job rather than a discovery.

### Settings, once it can run

Show Results on Open `yes`, Min Query Length `3`, Max Products `6`, columns `3`,
rows `2`, then the container, title, card, image, price, discounted price and CTA
styling. Campaign Priority **High**, delivery **Show without limits** with **Stop
after engagement** off.

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
