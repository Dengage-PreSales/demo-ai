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

## What is in it, and why it is this short

Seven rows. Masthead, headline, the basket, the total, the currency line, one button,
footer. That is the whole template.

It is short deliberately. A long template demonstrates BeeFree, which nobody is
buying. What is being shown is that the products in the email came out of the
visitor's own basket, and every row that is not those products competes with them for
attention on the call.

| Row | What it is |
|---|---|
| Masthead | The Dengage mark and the eComm Demo subtext, with the store's name as text beside it. Non-negotiable 3: never the prospect's logo |
| Headline | One line, and one line of copy under it |
| Basket | **Dynamic Content.** The visitor's own basket, replayed from their cart events |
| Total | **Dynamic Content.** Subtotal, discount and total, computed from that same basket |
| Currency | Stated once. See below |
| Button | Goes to the demo's cart page, because the proposition is that the basket survived |
| Footer | Unsubscribe, and the line saying this is a demonstration storefront |

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
