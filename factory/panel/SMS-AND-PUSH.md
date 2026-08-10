# SMS and web push, from scratch

Seven scenarios, two channels, one page. **Nothing here is per demo:** create the assets
once, write the seven SMS and the seven push messages once, and every demo the factory
generates afterwards uses them with nothing to redo.

For the emails see [`SCENARIO-EMAILS.md`](SCENARIO-EMAILS.md) and
[`factory/emails/BEEFREE.md`](../emails/BEEFREE.md). Nothing here depends on either.

---

## The one idea worth reading before the tables

**The asset carries the data. The message field carries the words.**

An email is one paste of raw HTML that carries its own query, which is why a scenario email
needs nothing in the panel. Neither SMS nor push has anywhere to put a query: the SMS
Message field counts every character of one against **450**, and a push Title is a title. So
both channels take a **reference to a saved Dynamic Content asset**, and the asset emits one
value with no sentence around it.

`Still in your basket: ` is typed into the field. `Copper Saucepan and 3 more items` comes
out of the asset. The field knows which channel it is; the asset does not, which is what lets
one asset serve five channels.

**The assets are per table, not per scenario.** Seven scenarios read five tables between
them: checkout rescue and basket building both read the cart, browse abandonment and win-back
both read page views. One asset per scenario would be twenty one objects to create instead of
fourteen, and three copies of the basket replay.

---

## Step 1. The assets. Content > Dynamic Content

**Three already exist**, created for the abandoned cart, and two of the seven scenarios use
them. Leave them alone:

| It exists as | Type | Body is | Emits |
|---|---|---|---|
| `dps abandoned cart line` | Plain Text | [`abandoned-cart.txt`](content/_dynamic/abandoned-cart.txt) | `Copper Saucepan and 3 more items` |
| `dps abandoned cart image` | Plain Text | [`abandoned-cart-image.txt`](content/_dynamic/abandoned-cart-image.txt) | the 1200x600 banner of the newest basket product |
| `dps abandoned cart url` | Plain Text | [`abandoned-cart-url.txt`](content/_dynamic/abandoned-cart-url.txt) | `https://.../demos/<slug>/index.html?open=cart` |

**Eleven to create.** For each: **New**, Type **Plain Text**, open the file, press **Copy raw
file**, paste the whole thing in as the body.

| Name it | Body is | Reads | Emits | Used by |
|---|---|---|---|---|
| `dps view line` | [`view-line.txt`](content/_dynamic/view-line.txt) | `page_view_events` | `Copper Saucepan and 3 more items` | browse, win-back |
| `dps view image` | [`view-image.txt`](content/_dynamic/view-image.txt) | `page_view_events` | the newest viewed product's banner | browse, win-back |
| `dps saved line` | [`saved-line.txt`](content/_dynamic/saved-line.txt) | `wishlist_events` | `Copper Saucepan and 3 more items` | wishlist |
| `dps saved image` | [`saved-image.txt`](content/_dynamic/saved-image.txt) | `wishlist_events` | the newest saved product's banner | wishlist |
| `dps order line` | [`order-line.txt`](content/_dynamic/order-line.txt) | `order_events_detail` | `Copper Saucepan and 2 more items` | replenishment |
| `dps order image` | [`order-image.txt`](content/_dynamic/order-image.txt) | `order_events_detail` | a banner from the newest order | replenishment |
| `dps search term` | [`search-term.txt`](content/_dynamic/search-term.txt) | `search_events` | `wireless mouse` | failed search |
| `dps url home` | [`url-home.txt`](content/_dynamic/url-home.txt) | `page_view_events` | `https://.../demos/<slug>/index.html` | browse, replenishment, win-back |
| `dps url checkout` | [`url-checkout.txt`](content/_dynamic/url-checkout.txt) | `page_view_events` | the same with `?open=checkout` | checkout rescue |
| `dps url wishlist` | [`url-wishlist.txt`](content/_dynamic/url-wishlist.txt) | `page_view_events` | the same with `?open=wishlist` | wishlist |
| `dps url search` | [`url-search.txt`](content/_dynamic/url-search.txt) | `page_view_events` | the same with `?open=search` | failed search |

On GitHub each is at:

```
https://github.com/Dengage-PreSales/demo-ai/blob/main/factory/panel/content/_dynamic/<file>
```

**Send the ids back, and say which is which.** They go in `factory/sandbox.json`, which is
the only place in this repository a snippet id is written down. On 10 August one id arrived
on its own, was recorded as the line asset, and the email preheader called the **url** asset
for a day: every send put `https://.../index.html?open=cart, one press from checkout.` in the
inbox preview line. Nothing failed and nothing could, because a snippet id is valid or
invalid and never wrong. So one sentence per id saying what it is.

### See what they say before you paste anything

```bash
node factory/build-snippets.mjs --preview
```

It resolves **every asset and every message below** against a committed demo's real catalogue
and prints them. That is the SMS and push equivalent of the `.preview.html` beside each
scenario email, and it answers "what will this actually say" without a panel open.

It is still not a send. Dengage owns the real engine and the real rows.

---

## Step 2. The seven SMS messages. Content > SMS

Same settings on all seven:

| Field | Value |
|---|---|
| Message Type | SMS |
| Sender Name | `DENGAGE - ecomm-codec` |
| Concatenated SMS | Enabled |

Then per scenario. **Insert each snippet with the tag control on the Message field**, never by
typing the tag: the SMS designer writes its own form, `<snippet snippet_id="4870" ... />`,
which is not the form the email builder writes.

| Name it | Message | Alternate Message |
|---|---|---|
| `DPS - Checkout rescue` | `Still in your basket: ` **cart line** `. Finish checkout: ` **url checkout** | Your basket is still saved. Finish checkout whenever you are ready. |
| `DPS - Browse abandonment` | `Still thinking about it? ` **view line** `. Take another look: ` **url home** | The things you were looking at are still here. |
| `DPS - Failed search` | `Still looking for ` **search term** `? Search again here: ` **url search** | Search again and we will help you find it. |
| `DPS - Wishlist` | `Still saved for you: ` **saved line** `. Open your list: ` **url wishlist** | Your saved items are waiting whenever you want them. |
| `DPS - Basket building` | `In your basket: ` **cart line** `. See what goes with it: ` **cart url** | A few things pair well with what is in your basket. |
| `DPS - Replenishment` | `Order it again in one press: ` **order line** `. ` **url home** | What you bought last time is ready to reorder. |
| `DPS - Win-back` | `New in since you were last here: ` **view line** `. Take a look: ` **url home** | There is new stock in the range since you were last here. |

**All seven resolve to between 139 and 194 characters** against a real 30 product catalogue,
so there is at least 256 characters of room in the 450 field. Measured rather than estimated:
`--preview` prints the number beside each one. The URL is 88 characters of it, and it grows
with the demo's slug.

**The Alternate Message is a real message, not a footer.** The panel sends it *instead of* the
body when the body's tags expand past the limit, so a contact genuinely receives it. That is
why each one above says the same thing without the personal part, rather than saying
"message too long".

### Every snippet follows a colon or a question mark, and that is not a style choice

`Copper Saucepan and 3 more items are waiting for you` reads correctly.
`Copper Saucepan are waiting for you` does not, and only the recipient knows which of the two
they are getting. So no sentence here puts a verb after a snippet. One item and nine items
have to read equally well.

---

## Step 3. The seven web push messages. Content > Push

Platform **WEB** on all seven. Badge URL empty, Icon Default, No Action Buttons, and leave
Custom Parameters as they are: the App Inbox reads whatever Dengage holds for the device, so
nothing extra is needed to reach it.

| Name it | Title | Message | Media | Target URL |
|---|---|---|---|---|
| `DPS - Checkout rescue` | You were one step away | `Still in your basket: ` **cart line** | **cart image** | **url checkout** |
| `DPS - Browse abandonment` | Still thinking about it? | `You were looking at: ` **view line** | **view image** | **url home** |
| `DPS - Failed search` | Still looking? | `Your search: ` **search term** | none | **url search** |
| `DPS - Wishlist` | Something you saved | `Still saved for you: ` **saved line** | **saved image** | **url wishlist** |
| `DPS - Basket building` | Goes with what you picked | `In your basket: ` **cart line** | **cart image** | **cart url** |
| `DPS - Replenishment` | Order it again | `Last time you bought: ` **order line** | **order image** | **url home** |
| `DPS - Win-back` | Worth another look | `Still here: ` **view line** | **view image** | **url home** |

**Notification Type is Rich for six of them and Standard for the failed search**, which is
the one with no Media. A failed search resolved no product, so there is nothing honest to put
in the band: padding it with a popular product under a personal headline is exactly what the
search email refuses to do in its own copy.

**Media takes URL mode and the image snippet on its own**, nothing else in the field. Same
for Target URL and the url snippet. Both fields take a text snippet, which is what makes this
work at all.

**The title is fixed copy in all seven, deliberately.** A title is where a truncated product
name looks worst, and the message line under it has room for the same phrase.

### Two pairs look alike, and saying so is better than inventing a difference

**Checkout rescue and basket building** share the cart line and the cart image. They differ in
the title and in where they land: checkout rescue opens the checkout, basket building opens
the basket so the storefront's own recommendation rail can do the pairing. The email version
of basket building queries the catalogue by the basket's categories to show what is *not* in
it yet, which is a grid, and a notification has nowhere to put a grid.

**Browse abandonment and win-back** share the view line and the view image. What makes a
message a win-back is the **trigger**, which is how long it has been, so the wording differs
and the data does not. The win-back email says the same thing about itself: a message that
restates its trigger's threshold goes wrong the day the threshold changes.

---

## What happens when there is nothing to show

Every asset degrades rather than breaking, and none of them invents a value.

| Case | What the recipient gets |
|---|---|
| No history at all | the line assets emit a general phrase, the image and url assets emit nothing |
| No page view attributes the events to a demo | an empty Target URL and an empty Media |
| The newest product was withdrawn from the catalogue | the next one down, and it is not counted in "and 3 more" |
| No product in the set has a picture | the push, without an image. A standard notification |
| The picture is `http` | the same. A browser blocks a mixed content push image |
| The contact used two demos | the newer demo's products, and links to only that demo |
| Two demos happen to use the same product id | this demo's product. See below |

**An empty Target URL is deliberate.** There is no address that is correct for every demo, and
a push that lands on another prospect's storefront is worse on a call than a push nobody sent.

**A product id is the prospect's own SKU**, taken off their site by the scrape, so nothing
makes it unique across demos: two prospects numbering their products 1, 2, 3 collide
completely. `dps_product` holds every catalogue in one table, so a lookup by id can return
two rows. Every asset now compares each product's `link` to the demo it resolved and drops
anything from elsewhere, which was open until 10 August 2026 and would have shown another
prospect's product name and photograph in a notification.

**A product name longer than 48 characters is cut**, with `...` on the end and no attempt to
find a word boundary, so a long model number can end mid-token. That is what the live
abandoned cart asset has always done, and matching it exactly is what lets CI prove the two
have not drifted apart. Worth a message if it reads badly on a call: the fix is one line, and
it moves all fourteen assets together.

---

## The image is optimized for the band already, so leave the field alone

The image assets do not hand the push the product tile. They hand it a **1200x600 crop made
for that band**, generated at build time and committed with the demo:

| | |
|---|---|
| **2:1** | the ratio the editor asks for, so no client has to pad or crop it and guess |
| **The photograph's own margin is trimmed first** | a studio product shot is mostly background. Fitting the file fits its whitespace too, which is why the first push showed the battery at about a third of the height it could have had |
| **The background is sampled from the photograph** | a white cutout gets a white band and looks full bleed, rather than a white rectangle on a grey field |
| **40 to 70KB** | well inside the 600KB the editor warns about. Size was never the problem, the ratio was |

For a demo whose scrape found no product photography at all, the same is true of the shared
motif artwork it falls back to: a 2:1 copy of each of the 48 drawings, rendered from the
vector rather than enlarged.

Nothing to set and nothing to upload. The build writes them, and a picture committed without
a banner fails CI rather than becoming a broken image in somebody's notification.

**Media, Icon and Badge URL do not render in Safari on macOS**, per the note in the editor.
Check the push on Chrome.

---

## Three things about the panel that will waste an afternoon each

**"Please add variables to your template first. No variables found"** is the Preview and Test
dialog asking for **variables**, which a snippet is not. It says nothing about your snippet.
To get past it, either add one contact variable from the field's own list, or skip the dialog
and send a real test message, which is the only thing that proves anything anyway.

**The preview pane never resolves snippets.** It echoes the body, so it always shows the raw
tag. Only a real send resolves. Ignore the pane and use `--preview` above instead.

**A message field takes a reference, never an asset body.** Pasting a body counts every
character of the query against the 450 character limit, so a 1200 character asset reads as a
1200 character SMS and the field goes red. The tag that belongs there is about ninety
characters.

**And nothing anywhere uses `$Contact`.** A demo sets the contact key and no attributes, so
every other contact field is empty for every contact a demo creates, and a name renders as
"Hi ," on a call. `$Contact.name` is not even a column: `master_contact` has `first_name`.
What a demo genuinely has is behaviour, which is what all fourteen assets use.

---

## One thing worth trying, which would turn four assets into one

The four `dps url ...` assets are the same block with a different literal on the end. If the
push **Target URL** field accepts literal text *after* a snippet, the way the SMS Message
field accepts text around one, then one `dps url home` asset plus `?open=checkout` typed into
the field replaces all four.

The Message field certainly concatenates, which is what Step 2 relies on. Whether a URL field
does was never tested, so four assets is the version that is known to work. To find out: put
`dps url home` in a Target URL field, type `?open=cart` after it, send one test push and see
where it lands. If it works, three of the four can be deleted and this page gets shorter.

---

## When an asset body changes here, re-paste it

That is the only standing obligation, and it is rare. The ids never change, so nothing else
comes back to me.

CI fails if a committed asset is not what the generator produces, so the way to know is that
I say so. `node factory/build-snippets.mjs --check` is the check, and
`node factory/snippets.test.mjs` runs all fourteen against synthetic event logs, including
the empty case, the two demo case, the withdrawn product case and the colliding id case.

The one that has changed since it was created is `dps abandoned cart image`: it now asks for
the 2:1 banner rather than the square product tile. If a push still shows the product small in
a white box, that body is the old one.
