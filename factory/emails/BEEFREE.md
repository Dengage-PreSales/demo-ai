# The Email Builder template

**One file, for every demo, imported once ever:**

```
factory/panel/content/_shared/beefree-abandoned-cart.json
factory/panel/content/_shared/beefree-abandoned-cart.preview.html
```

Open the preview first. It is what the email looks like, filled with real products from
a real catalogue, so a wrong colour or a wrong typeface shows in one glance before
anything is uploaded.

## Setting it up, once, for all demos

1. **Content > Dynamic Content > New**, type **HTML**, name it `dps abandoned cart`,
   and paste `factory/panel/content/_dynamic/abandoned-cart.html`. Save.
2. Same again for `dps abandoned cart total`, from `abandoned-cart-total.html`.
3. Same again for `dps recommendations`, from `recommendations.html`. Save.
4. **Content > Email > New > Email Builder**, and import the JSON.
5. Build the campaign. **One campaign serves every demo**, so this is the last time.

**There is no step for attaching any of them.** All three ids are recorded in
`factory/sandbox.json`, so the imported template already calls all three and there is
nothing to click.

**The ids are UUIDs, not numbers.** Dengage's documentation shows `snippet_id="8835"`,
which is what this repository assumed; the panel actually issues
`5178aafe-5bec-4326-b3ed-890aff1ec867`. Both go in the same attribute as a string, so
nothing had to change to accept one, but the numeric example is worth not copying.

Any of them can be overridden for a second account or a renamed asset:

```bash
DPS_SNIPPET_CART=<id> DPS_SNIPPET_CART_TOTAL=<id> \
  DPS_SNIPPET_RECOMMENDATIONS=<id> DPS_SNIPPET_CART_LINE=<id> \
  node factory/emails/build-beefree.mjs
```

**If a block imports empty**, the tag form is what to check first. Attach one block by
hand with **Insert > Dynamic Content**, then read what the panel wrote into that HTML
block. That string is authoritative and this file should match it.

## Why one shared template rather than one per demo

Settled 9 August 2026, Salil's call, after a real send showed the problem.

**The chrome is baked at build time. The basket is resolved at send time.** An email
carries no custom properties and no stylesheet, so a colour or a store name in the
template is a literal, fixed when the demo is built. The basket inside it is worked out
when the email is sent, from whichever storefront the visitor last touched. Those two
can disagree, and they did: a Techiestore masthead and a laptop keyboard nav wrapped
around four garments, above the line "All prices in (INR)" against dollar prices. The
currency was the worst of it. A wrong symbol beside a real price is more damaging on a
call than a wrong name.

**A shell that names no store cannot contradict a basket.** So everything that
identified a storefront is gone:

| Gone | Why |
|---|---|
| The store's name in the masthead | It is a claim about whose email this is |
| The category nav | Its links pointed at one demo's filtered pages |
| The currency line | The sharpest contradiction of the three |
| The link to the store in the footer | Same reason |
| The per demo brand colour and typeface | A brand colour is as much a claim as a name |
| The per demo hero | Drawn in the standard Dengage palette instead |

What is left is what was always the point: real products, at real prices, out of the
visitor's own basket. Those come from the saved assets, which resolve the demo
themselves, so they are always right.

**The button moved into the summary asset**, and that is forced rather than chosen. A
basket link needs a demo in it, and a BeeFree button module holds one literal href, so
in a shared template it could only ever point at the wrong storefront or at nothing. The
asset already works out which demo the basket belongs to, so it is the only thing in the
email that can address the right basket. It builds the URL from the page the visitor was
actually on rather than from a hardcoded origin.

**What this costs.** The email is Dengage blue rather than the prospect's colour. If a
particular call wants the prospect's own theming, duplicate the campaign for that demo
and point it at a per demo template: `make-hero.mjs --slug <slug>` still draws the
themed hero, and the per demo path is one function argument away. That is a deliberate
exception, not the default, and it comes with the mismatch risk back in.

## If it imports as an empty canvas

That is this format's failure mode, and it happened on the first attempt: the builder
drew "Drop content blocks here" and reported nothing at all. A template BeeFree cannot
read arrives blank rather than complaining, so an empty canvas means a structural
mismatch and never an empty template.

The cause was the rows. They were nested under `page.body`, and the builder reads
`page.rows`. They are now emitted at `page.rows` and mirrored under `page.body`, so
either reading finds them.

**The mirror is still here**, because the import works and nothing has proved which path
the builder reads. Removing it needs the builder's **JSON**, and that is worth being
precise about, because an export was tried on 9 August 2026 and did not answer it.

**What the builder's HTML export does and does not give.** A template exported as HTML is
the rendered message: `<table class="row row-2">` bands, `row-content` at a fixed width,
`column-1` cells, and `heading_block`, `paragraph_block`, `text_block`, `button_block`,
`image_block`, `icons_block`, `social_block` and `spacer_block` inside them. That is
genuinely useful, and it confirmed the shape this repository's preview renderer
approximates. What it contains none of is the JSON: no module type strings, no `page`
object, and no `<snippet>` tag, because a rendered export has already resolved or dropped
it. So it cannot settle either of the two open questions.

Both need the **JSON** specifically, whichever control saves or downloads that rather
than the HTML:

1. The mirror goes, and `beefree.mjs` matches the real shape rather than a documented one.
2. **The Dynamic Content block becomes native.** That block is in the builder's own
   content panel, so there is a proper module type for it, and the HTML module used here
   is a workaround. Nothing found so far names that type.

Neither is urgent. The import works, both blocks resolve, and guessing further at this
engine is the wrong move: five rounds were spent guessing at the template syntax and every
one was settled by being shown something that worked.

## What is in it

Nine rows:

| Row | What it is |
|---|---|

| Masthead | The Dengage mark and the eComm Demo subtext, and nothing else. Non-negotiable 3: never the prospect's logo, and now not their name either |
| Hero | Drawn in the standard Dengage palette by `make-hero.mjs --shared`. Full bleed, and carries no text |
| Headline | One line, and one line of copy under it |
| Basket | **Dynamic Content.** The visitor's own basket, replayed from their cart events |
| Summary | **Dynamic Content.** Subtotal, total, and the button back to that basket |
| Recommendations | **Dynamic Content.** The storefront's own rail. See below |
| Urgency | One line, and it is true. See below |
| Footer | The mark again, the disregard line, and the line saying this is a demonstration storefront |

**Short on purpose.** A long template demonstrates BeeFree, which nobody is buying. What
is being shown is that the products came out of the visitor's own basket, so every row
that is not those products has to justify itself.

## The product cards

Rebuilt on 9 August 2026 against a reference SaleCycle abandoned cart email, which made
the gap obvious: **a 96px thumbnail beside left-aligned text reads as an order
confirmation.** The reference merchandises instead, and that is the whole difference.

**Cards, two across, centred.** A large image, then the category, the name and the price
all centred under it. An odd last row pads its empty cell so the table cannot reflow. The
cells are percentage width rather than fixed, so on a phone they land at about 160px each,
which is what the reference deliberately targets with its own media query rather than
something to avoid.

**Two things keep a row aligned, and neither is optional.**

The image sits in a **fixed 200px frame**, centred in it, because the catalogue's images
run 1.00 to 1.50 aspect. The reference gets away with no frame only because every one of
its images is the same 270x203; ours are not, so without it the left card's text started
40px below the right card's. The image itself is given a width and never a height, so a
wide photograph is never squashed.

The name is **clamped at 60 characters**. A real product name here is 95 characters, which
is four lines in a 290px card, so the price under it landed somewhere different in every
card. Same rule the SMS asset already used, and it is a display truncation of a real name
rather than an invented one.

**Hierarchy.** The name leads at 15px bold, the price supports at 14px with the reduction
bold and the original struck through at 45%, and the category is a 10px letter spaced
eyebrow at 45%. It is the leaf category only, so "FASHION > SHIRTS" reads "SHIRTS" and
stops competing with the name.

## The subject line and the preheader

**Both are fields in the email editor**, Subject and **Pre-header**, sitting together under
Sender Profiles with a personalization control each. Neither is in the template, so both are
copy this repository cannot set for you, and both take a Dynamic Content snippet.

### What can actually be personalized, and what cannot

A demo sets **only the contact key**. `template/js/identity.js` sends `contactKey` and no
attributes at all, so `$Contact.first_name` is empty for every contact a demo creates. A
subject line with a name in it renders as `Hi ,` on a call, which is the most visible
failure an email has. **Do not personalize on the name.**

What a demo genuinely has is the basket. So that is what to personalize on, and the only
thing that can reach it from a subject field is a Dynamic Content asset.

### The one worth using, which names the basket in the inbox

**Everything consumes Dynamic Content snippets**, Salil, 9 August 2026: the Pre-header field
does, and so do push text, push image, SMS and on site content. So a subject line and a
preheader can both name the visitor's own products, before the email is opened at all.

One asset does it, and it is one you want anyway for SMS.
`content/_dynamic/abandoned-cart.txt` emits exactly one line and nothing around it:

```
Oxford Shirt and 3 more items
```

Which reads correctly whether the basket holds one item, two or six. So:

| Field | What to put in it |
|---|---|
| **Subject** | `Still yours: ` then the snippet |
| **Pre-header** | the snippet, then `, one press from checkout.` |

reads in an inbox as

> **Still yours: Oxford Shirt and 3 more items**
> Oxford Shirt and 3 more items, one press from checkout.

**Corrected 10 August 2026, and the template changed with it.** The preheader used to be the
first row of this template: a hidden block with the tag inside it, padded with a run of zero
width non joiners so the masthead could not leak into the preview line. That was doing by
trick what the platform does by design. A field is better in every way that matters: it is
visible in the editor, it can be edited on a call, and it needs none of the padding. So the
row is gone and `beefree.test.mjs` asserts nothing in the template is hidden, because a
reinstated preheader would send twice and nobody would see either copy.

### Three that need no asset at all. Paste and go

| Subject | Pre-header |
|---|---|
| **Your basket is still saved** | Everything you added is one press away from checkout. |
| **You left something behind** | Your basket is saved and waiting whenever you are. |
| **Still thinking it over?** | Your basket is exactly as you left it. |

Use a pair, not one from each row.

**The preheader never repeats the subject.** That line is the one extra piece of inbox real
estate you get, and restating the subject wastes it. Both rules are asserted, for the
static sentence and for the snippet.

### If you want the name as well

The storefront would have to send one. Signing up in a demo currently sets a contact key
and nothing else, so a first name would mean the account overlay collecting it and the
emitter sending it. That is a small change to `identity.js` and the storefront, not a
panel setting, and it is worth doing only if a named greeting is part of the story you
tell on the call.

## The recommendations at the bottom

They are **the storefront's own rail**, not a new idea and not the Dengage engine.
`template/js/recommend.js` computes five strategies in the browser from the demo's own
catalogue, and it explains why they are local: the engine is fed per application, every
demo shares one application, so an engine rail would offer a fashion prospect phones. An
email cannot run that JavaScript, so `recommendations.html` runs the same strategy against
`dps_product` at send time and carries the same label the site uses.

**Three passes, and the first one is real behaviour rather than a computation.**

**Recently viewed** first: the products this contact actually looked at, out of
`page_view_events`, newest first, minus what is already in the basket. It spans sessions
and devices, because it is anchored on the same key set the basket uses, which makes it
better than the storefront's own version of the same rail, which reads `sessionStorage` and
forgets everything when the tab closes.

Then **More like this**, the same categories the basket is in. Then **Trending now**, the
site's own `seeded()` over that demo's rows. Each falls through when it cannot produce at
least two products, so the rail always fills and always prefers the most real thing
available.

The fallback is not hypothetical. It was added because a real send rendered nothing: one
demo's catalogue holds exactly **one** product in each of the four categories its basket
covered, so excluding the basket left nothing to offer. A catalogue shaped like that is not
unusual.

**The ordering is the storefront's, not merely similar to it.** `dps_product.product_id` is
the catalogue's own id, unprefixed, so the same function over the same ids gives the same
order. The test lifts `seeded()` out of `template/js/recommend.js` and compares.

That comparison found a real defect in the storefront, now fixed in all three copies:
`seeded()` broke no ties, so two ids of the same length starting with the same character
were fully tied and the result depended on the order the list arrived in. That is fine on a
page, where the catalogue array is always in the same order, and wrong anywhere the same
catalogue arrives differently, which is exactly what a Dengage query does. It now decides
ties on the id, so the ordering is a property of the ids and the seed alone.

`factory/panel/content/_dynamic/README.md` has the table of which of the five are
reproducible in an email and which need the engine, and why scoping to one demo goes
through `link` rather than `store_name`.

## The hero image

`node factory/emails/make-hero.mjs --shared` writes `assets/email-hero-cart.jpg`,
600x240 at 2x, about 24KB. The per demo variants still build with `--slug` or `--all`,
because a per demo template is one duplicated campaign away and the artwork should be
ready if that is ever wanted.

It is **drawn, not sourced**, and that is forced rather than stylistic: a demo carries
the prospect's product names and never their imagery, and it may not depend on a third
party CDN at runtime. A stock library breaks both rules at once. So the hero is flat
geometry in the demo's own brand colour, which themes itself for every prospect with
nothing to license and nothing that can be taken down between the build and the call.

It carries no text. Text baked into an image cannot be read by a screen reader, does
not reflow on a phone, and is invisible to a recipient with images blocked. Every word
in the email is a real module.

The template references it only when the file is on disk, so a build that skipped the
hero produces a template with no image rather than one with a broken image in it.

## Two lines of copy that every serious abandoned cart email has

> Prices and availability can change, and a basket is not a reservation.

> If you have already completed your purchase, please disregard this email.

The second was missing until 9 August 2026 and is in the reference. It costs a line and it
is the difference between an email that reads as automated and one that reads as
considered.

## The urgency line, and what is not in it

> Prices and availability can change, and a basket is not a reservation.

No countdown, no "reserved for 24 hours", no expiring discount, no "only 2 left". Every
one of those would be invented, a prospect can see through all of them, and non
negotiable 5 is about exactly this. What is genuinely true of any store is that a
basket is not a reservation, so that is what it says. The test asserts the absence of
the other six phrasings.

## Where the buttons go

`index.html?open=cart`, not `cart.html`, and it is the saved asset that builds it.

A demo is two pages, `index.html` and `product.html`. The basket, the checkout, the
search and the saved items are overlays on the first one, so `cart.html` has never
existed. Every generator in this repository linked to it anyway, which meant the
primary button in ten emails, the AMP variant and all five short form channels landed
on a GitHub Pages 404. `factory/demo-links.mjs` is now the only place that spells these
URLs, `template/js/storefront.js` opens an overlay from `?open=`, and
`factory/panel/links.test.mjs` resolves every link in the panel content back to a file
on disk so it cannot happen again.

The footer of the shared template carries **no link at all**, for the same reason the
masthead carries no name: until the email is sent there is no one storefront it belongs
to. That leaves it with no unsubscribe, which is the one link that genuinely should be
there. It goes in the moment an unsubscribe URL or tag for this account is known.

The generated Code Editor emails still have a footer link, and there it says "Manage your
preferences" and opens the account overlay, because those are built per demo and there is
no `unsubscribe.html` to point at.

## Does it adapt to a new demo on its own

Mostly. Precisely:

| Step | Automatic? |
|---|---|
| The template file, themed to the new demo | yes, the build runs `build-beefree.mjs` |
| Its hero image | yes, the build runs `make-hero.mjs` |
| Brand colour, typeface, categories, currency, store name, links | yes, all from `demo.config.json` |
| `dps_product` rows for the new demo | yes, within ten minutes. `refresh_dengage_catalogues()` reads the published `feed/products.json`, which every build regenerates, so it discovers a new slug with nothing to tell it |
| The Dynamic Content assets | nothing to do. They are shared, and they work out which demo a basket belongs to by themselves |
| The template and the campaign | nothing to do. Both are shared now |
| The snippet ids in the file | **once ever.** They live in `factory/sandbox.json`, so a rebuild needs nothing remembered. `DPS_SNIPPET_CART`, `DPS_SNIPPET_CART_TOTAL`, `DPS_SNIPPET_RECOMMENDATIONS` and `DPS_SNIPPET_CART_LINE` override them for a second account |

**So there is no per demo panel work left for this email.** Publish a demo, wait ten
minutes for its products to reach `dps_product`, and the campaign that already exists
sends the right basket with the right prices and a button that lands on the right
storefront.

## What the demo's own theme supplies

Nothing here is styled by hand. Every value comes from that demo's
`demo.config.json`, through `emailPalette`, which is the same pass the generated HTML
emails use, so the two never disagree:

- the brand colour on the button, and the label colour checked to 4.5 against it
- the demo's typeface, with a Google Fonts entry so the builder previews the real face
  rather than its fallback
- the card and canvas grounds, and a tint of the brand behind the total
- the currency symbol and code from `locale`

**A BeeFree row is a full width band**, so the floating card the HTML emails draw with
a border and a radius cannot be reproduced. What reproduces it is the band ground:
masthead and footer on the canvas, everything between them on the card, so the colour
change is the card's edge. A theme whose page and surface are the same colour gets
hairlines instead, because on such a theme the bands would all be one colour and the
whole email would run together.

## Why the currency is a line of text

**Neither Dynamic Content asset can print a currency symbol.** Both are shared by
every demo, and `dps_product` has no currency column, so at send time neither one
knows which currency it is printing. Rather than guess a symbol and put it beside a
real price, both emit bare numbers and the template says it once:

> All prices in ₹ (INR).

Which is what an international retailer does anyway. It is omitted entirely when a
demo's locale names neither a symbol nor a code.

If a snippet can be passed a parameter from the template that calls it, this stops
being necessary and the symbol can go beside each number. Nothing found so far
documents that it can, and guessing at this engine has already cost five rounds, so
it is a question for Dengage rather than something to try.

## The preview is an approximation

`beefree-preview.mjs` renders the same row data to HTML: a row becomes a full width
table, a column becomes a cell, a module becomes what its descriptor describes. It
answers whether the colours, the typeface and the proportions came out right, which is
what a preview is for. It does not answer how a given mail client will render the
export, and BeeFree owns the real one.

The basket, the summary and the rail are filled with real products from the demo's
catalogue rather than shown as dashed boxes, because a dashed box proves the block is
in the right place and only a filled one shows whether the email looks right. Four in the
basket, because four is the number that exposed the old three product cap. Prices are the
scraped prices, and a product the scrape gave no price shows none.

**Each block is found by the name of the asset in it, not by counting.** The preview used
to take them in document order, first, second, third, which was correct until the preheader
became a Dynamic Content block and moved to the front of the document. Counting would then
have filled the basket with the rail and drawn a plausible email in the wrong order without
failing anything, so `dynamicModules()` matches on the asset name instead. Three of the four
names are a prefix of another, so it matches the delimiter after the name as well.

---

# How BeeFree treats a block, which is the part that caused two real defects

**Moved here 10 August 2026** from `factory/panel/content/_dynamic/README.md`. It is about
how the Email Builder renders, so it belongs beside the template rather than beside the
saved assets, and it was the only email specific material in that file.

## BeeFree decorates a block, but not an HTML block

**One fact, and it caused both of the things that looked wrong in real sends.** BeeFree
writes a typeface inline on every block and puts a block's padding on a `td` around it. It
does neither for raw HTML: an HTML block is passed through untouched. So a module's own
`descriptor.style` is not an ancestor of what an HTML module contains.

Two consequences, and each shipped once:

1. These assets declare `font-family: inherit`, so with nothing above them declaring one,
   every client fell back to its default and the product names arrived in Times under a
   sans headline.
2. The module's 24px of side padding never applied either, so the totals table sat flush
   against both edges of the email while the text blocks were inset. The product cards hid
   it, because their content is centred, so they looked inset when they were not.

**Both are fixed the same way: the generated template puts them inside the block's own
content**, in one wrapper div per snippet, which IS an ancestor:

```html
<div style="font-family:...;font-size:15px;line-height:1.6;color:...;padding:0 24px;">
  <snippet snippet_id="..." snippet_name="..."></snippet>
</div>
```

The module itself now declares no side padding at all, so there is one source for each
rather than two that can disagree about which one a client honoured. `beefree.test.mjs`
asserts the wrapper carries both, that the module carries neither, and that the gutter and
the typeface match the ones the text blocks use.

**The preview was flattering this**, which is why it went unnoticed twice. It replaced the
whole block including the wrapper and then supplied the font and padding from the module
style, so it looked right while the send did not. It now substitutes only inside the
wrapper and takes nothing from the module but vertical padding, exactly as BeeFree does.

## The typeface, and why `inherit` is not enough on its own

**These assets never name a font, and they cannot.** One asset serves every demo and
every template, so an explicit family in here would beat whatever the surrounding email
said. They declare `font-family: inherit` and take what is around them.

**Which is nothing, in BeeFree.** Read out of a real export from this account: all 67 of
its `font-family` declarations are inline on individual blocks. Not one global CSS rule,
and none on the `<body>`. BeeFree sets a typeface on every block and never on the email.
So `inherit` inside an HTML block has nothing above it to inherit from, and every mail
client falls back to its default, which is a serif. That is why the first real send put
every product name in Times under a sans headline.

**So the template supplies it, in the block's own content.** The generated template wraps
each `<snippet>` tag in

```html
<div style="font-family:...;font-size:15px;line-height:1.6;color:...;">
```

which is inside the snippet's own document, so `inherit` resolves to it. The module's own
`style.font-family` does not carry: BeeFree treats an HTML block as raw HTML and puts no
typography around it, which is exactly why the first attempt failed.

**It is the same face the text blocks use, and that is pinned.** `beefree.test.mjs`
asserts every wrapper declares the identical family the headline and copy declare, so a
change to one of them fails rather than shipping an email whose products are in a
different typeface from its words.

**One consequence worth knowing.** Change the template's typeface by hand in the Email
Builder and the wrapper does not follow, because it is content rather than a block style.
Change it in `template/style.css` and rebuild instead, which is where the standard
palette lives and where both halves read it from. Pasting one of these assets into a
template that has no wrapper gives the client default for the same reason.

## Styling: inline, and as little as possible

Earlier these used `dps-` class names on the assumption that each generated email would
carry a `<style>` block to theme them. **That is wrong for how this is actually used.**
The asset drops into a Dengage system template in the Email Builder, and the builder owns
that template's CSS: there is nowhere to add a class definition.

So the HTML asset is inline styled and deliberately plain. No background, no border, no
heading, no button, and `font-family: inherit` with `color: inherit` so it takes the
surrounding template's typography instead of imposing its own. It is a product list and
nothing else, because the template already supplies the heading above it and the call to
action below it.

**What each row is, and why.** The first pass was correct and looked like a receipt.
The proportions are now the storefront's own, so the email and the site it came from
read as one thing:

| Part | Treatment | Why |
|---|---|---|
| image | 96px square in a 112px cell | 72px read as a thumbnail in a list. A product photograph is the reason the email works |
| category | 11px, uppercase, letter spaced, 60% opacity | the same eyebrow the storefront puts above a product name |
| name | 16px bold, inheriting the template's colour | not the client's default link blue, which is the single most common way an email looks unfinished |
| price | 16px bold, reduction first, original struck through at 14% smaller and 55% opacity | a reduction shown honestly, and only when `discounted_price` is genuinely set |
| quantity | `Qty 2`, and only above one | a quantity of one on every row is noise |
| row spacing | 22px below each row | three products at 72px with 12px gaps was a dense block rather than a list |

Nothing here sets a colour, a face or a background, so it themes itself from whatever
template it is dropped into. Opacity does the work a grey would have done, which is
what keeps it neutral against a dark template as well as a light one.

The old class contract, kept only as a record of what it was:

| Class | What it is |
|---|---|
| `dps-items` | the wrapper around all rows |
| `dps-row` | one product |
| `dps-thumbcell` | the table cell holding the image, for its width and padding |
| `dps-thumb` | the image itself |
| `dps-text` | the cell holding everything beside the image |
| `dps-name` | the product name |
| `dps-namelink` | the anchor around the name, so it is not the client's default blue |
| `dps-meta` | the category, and the quantity when there is more than one |
| `dps-price` | the price |
| `dps-was` | the old price, when there is a genuine reduction |
| `dps-empty` | the fallback when the basket has nothing in it |

A generated email styles all eleven. `dps-namelink` and `dps-thumb` are the two worth
not forgetting: an unstyled link is blue and underlined in every client, and an
unstyled image has no border radius or background while it loads.

Outlook on Windows honours `color`, `font-family`, `font-size` and `background-color`
from a `<style>` block. It does not honour everything, so the shell around these rows
stays fully inline in the generated email. A worst case is product rows in the default
face inside a correctly branded email, not a broken layout.

**It does a two step lookup.** `shopping_cart_events` records that something happened
to a `product_id` and carries no name or picture, so the id is looked up in
`dps_product`. `factory/phase0/SCHEMA.md` has the column lists and the reasoning.

`is_active` is checked rather than trusted: a product withdrawn from the catalogue
still has cart rows from before it went, and a basket reminder for something nobody can
buy is worse than one item short.
