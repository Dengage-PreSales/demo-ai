# The Email Builder template

One file per demo, imported rather than pasted:

```
factory/panel/content/<slug>/emails/beefree-abandoned-cart.json
factory/panel/content/<slug>/emails/beefree-abandoned-cart.preview.html
```

Open the preview first. It is what the email looks like, filled with real products
from that demo's catalogue, so a wrong colour or a wrong typeface shows in one glance
before anything is uploaded.

## Setting it up, once

1. **Content > Dynamic Content > New**, type **HTML**, name it `dps abandoned cart`,
   and paste `factory/panel/content/_dynamic/abandoned-cart.html`. Save.
2. Same again for `dps abandoned cart total`, from `abandoned-cart-total.html`.
3. **Content > Email > New > Email Builder**, and import the JSON.
4. The template arrives with two dashed boxes where the products and the total go.
   Click each one, clear it, then **Insert > Dynamic Content** and pick the asset the
   box names.

Step 4 exists because Dengage assigns `snippet_id` when an asset is saved, so nothing
in this repository can know it in advance. Once the panel has told you the two ids, a
rebuild puts the real tags straight into the file and there is nothing to click:

```bash
DPS_SNIPPET_CART=8835 DPS_SNIPPET_CART_TOTAL=8836 \
  node factory/emails/build-beefree.mjs --slug <slug>
```

The ids are per account, not per demo, so once they are known every demo built
afterwards imports finished.

## If it imports as an empty canvas

That is this format's failure mode, and it happened on the first attempt: the builder
drew "Drop content blocks here" and reported nothing at all. A template BeeFree cannot
read arrives blank rather than complaining, so an empty canvas means a structural
mismatch and never an empty template.

The cause was the rows. They were nested under `page.body`, and the builder reads
`page.rows`. They are now emitted at `page.rows` and mirrored under `page.body`, so
either reading finds them.

**The mirror is temporary.** It exists because nothing in this repository can validate
this format offline, so a wrong guess would cost another round trip. The way to remove
it is an export from the account: build a template by hand in the Email Builder with a
title, a button and a **Dynamic Content** block in it, export or download the JSON, and
that file is the schema. Two things follow from having it:

1. The mirror goes, and `beefree.mjs` matches the real shape rather than a documented
   one.
2. **The Dynamic Content block becomes native.** That block is in the builder's own
   content panel, so there is a proper module type for it and the HTML module used here
   is a workaround. Its type name is not in any documentation this repository could
   find, and an export contains it.

Until then, guessing further at this engine is the wrong move. Five rounds have already
been spent guessing at the template syntax, and every one of them was resolved by being
shown something that worked rather than by reasoning about it.

## What is in it

Eleven rows, and every one of them is doing a job an abandoned cart email is expected
to do:

| Row | What it is |
|---|---|
| Preheader | Hidden. The grey line an inbox shows beside the subject. Without it the client shows the first words it finds, which would be "Dengage eComm Demo" |
| Masthead | The Dengage mark and the eComm Demo subtext, with the store's name as text beside it. Non-negotiable 3: never the prospect's logo |
| Category nav | The demo's own categories, each linking to the storefront filtered to it. Four at most, because five wrap on a phone and stop reading as a nav |
| Hero | Drawn per demo from its brand colour by `make-hero.mjs`. Full bleed, and carries no text |
| Headline | One line, and one line of copy under it |
| Basket | **Dynamic Content.** The visitor's own basket, replayed from their cart events |
| Total | **Dynamic Content.** Subtotal, discount and total, computed from that same basket |
| Currency | Stated once. See below |
| Button | Centred, opens the demo's basket, with a quiet second choice under it rather than a second button |
| Urgency | One line, and it is true. See below |
| Footer | The mark again, manage preferences, and the line saying this is a demonstration storefront |

**Still short on purpose.** A long template demonstrates BeeFree, which nobody is
buying. What is being shown is that the products came out of the visitor's own basket,
so every row that is not those products has to justify itself.

## The hero image

`node factory/emails/make-hero.mjs --slug <slug>` writes
`demos/<slug>/images/email-hero.jpg`, 600x240 at 2x, about 20KB.

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

## The urgency line, and what is not in it

> Prices and availability can change, and a basket is not a reservation.

No countdown, no "reserved for 24 hours", no expiring discount, no "only 2 left". Every
one of those would be invented, a prospect can see through all of them, and non
negotiable 5 is about exactly this. What is genuinely true of any store is that a
basket is not a reservation, so that is what it says. The test asserts the absence of
the other six phrasings.

## Where the buttons go

`index.html?open=cart`, not `cart.html`.

A demo is two pages, `index.html` and `product.html`. The basket, the checkout, the
search and the saved items are overlays on the first one, so `cart.html` has never
existed. Every generator in this repository linked to it anyway, which meant the
primary button in ten emails, the AMP variant and all five short form channels landed
on a GitHub Pages 404. `factory/demo-links.mjs` is now the only place that spells these
URLs, `template/js/storefront.js` opens an overlay from `?open=`, and
`factory/panel/links.test.mjs` resolves every link in the panel content back to a file
on disk so it cannot happen again.

The footer link says "Manage your preferences" rather than "Unsubscribe" and goes to the
account overlay, because there is no `unsubscribe.html` either. If Dengage injects its
own unsubscribe URL or exposes a tag for it, that is the right value and it is one line
to change.

## Does it adapt to a new demo on its own

Mostly. Precisely:

| Step | Automatic? |
|---|---|
| The template file, themed to the new demo | yes, the build runs `build-beefree.mjs` |
| Its hero image | yes, the build runs `make-hero.mjs` |
| Brand colour, typeface, categories, currency, store name, links | yes, all from `demo.config.json` |
| `dps_product` rows for the new demo | yes, within ten minutes. `refresh_dengage_catalogues()` reads the published `feed/products.json`, which every build regenerates, so it discovers a new slug with nothing to tell it |
| The two Dynamic Content assets | nothing to do. They are shared, and they now work out which demo a basket belongs to by themselves |
| Importing the template into the Email Builder | **no. One upload per demo** |
| The snippet ids in the file | **once ever.** Set `DPS_SNIPPET_CART` and `DPS_SNIPPET_CART_TOTAL` and every demo built afterwards imports finished |

So the per demo manual work is one import. Everything the repository can do without the
panel, it does.

**Why the import cannot be avoided.** The theming is literal hex in the JSON, because an
email cannot carry custom properties or a stylesheet. One shared email campaign would
therefore be one colour for every prospect. The parts that CAN theme themselves at send
time are exactly the parts inside a Dynamic Content asset, and a button's background is
not one of them.

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

The two Dynamic Content blocks are filled with four real products from the demo's
catalogue rather than shown as dashed boxes, because a dashed box proves the block is
in the right place and only a filled one shows whether the email looks right. Four,
because four is the number that exposed the old three product cap. Prices are the
scraped prices, and a product the scrape gave no price shows none.
