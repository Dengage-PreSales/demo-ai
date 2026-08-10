# The scenario emails, from scratch

Seven HTML emails, one per journey. **One paste each and nothing else:** no Dynamic Content
asset to create, no id to send back, nothing per demo, and nothing to redo when a new demo
is built.

For the abandoned cart email, which is the Email Builder one, see
[`factory/emails/BEEFREE.md`](../emails/BEEFREE.md). For SMS and push see
[`SMS-AND-PUSH.md`](SMS-AND-PUSH.md).

---

## Step 1. Create seven emails. Content > Email > Code Editor

For each row: **New email**, editor type **Code Editor**, HTML tab, then paste the whole
file over whatever is in the box. Set Subject and Pre-header from the columns given.

| Name it | Paste this file | Subject | Pre-header |
|---|---|---|---|
| `DPS - Checkout rescue` | [`scenario-checkout.html`](content/_shared/scenario-checkout.html) | You were one step away | Your basket is still saved, and checkout is one press away. |
| `DPS - Browse abandonment` | [`scenario-browse.html`](content/_shared/scenario-browse.html) | Still thinking about it? | The pieces you were looking at, in one place. |
| `DPS - Failed search` | [`scenario-search.html`](content/_shared/scenario-search.html) | About what you were looking for | A few things close to your search. |
| `DPS - Wishlist` | [`scenario-wishlist.html`](content/_shared/scenario-wishlist.html) | Something you saved | Your saved items, and what changed since you saved them. |
| `DPS - Basket building` | [`scenario-basket.html`](content/_shared/scenario-basket.html) | Goes with what you picked | A few things that pair with your basket. |
| `DPS - Replenishment` | [`scenario-replenish.html`](content/_shared/scenario-replenish.html) | Order it again in one press | What you bought last time, ready to reorder. |
| `DPS - Win-back` | [`scenario-winback.html`](content/_shared/scenario-winback.html) | New in, and worth a look | A few of the things people are picking up right now. |

On GitHub, each is at:

```
https://github.com/Dengage-PreSales/demo-ai/blob/main/factory/panel/content/_shared/scenario-<id>.html
```

**Look at one before you paste it.** Beside each `.html` is a `.preview.html`: the same
email, rendered against a real demo's catalogue. Open it in a browser. That is the email's
own output, not a mock-up of it.

## Step 2. Nothing. There is no step 2

No asset, no id, no per demo work, no rebuild when a demo is added.

---

## What each one reads, and what it says

| Email | Reads | Personal because |
|---|---|---|
| Checkout rescue | `shopping_cart_events` | their basket, replayed, with the real subtotal, discount and total |
| Browse abandonment | `page_view_events` | the products they opened, and the category they opened most |
| Failed search | `search_events` + `dps_product` | the words they typed, and catalogue titles that contain them |
| Wishlist | `wishlist_events` + `dps_product` | what they saved, and whether it is cheaper now than when they saved it |
| Basket building | `shopping_cart_events` + `dps_product` | the categories in their basket, offering what is not in it yet |
| Replenishment | `order_events_detail` | the lines of their newest order, with the quantities |
| Win-back | `page_view_events` + `dps_product` | the demo they used, and its catalogue in the storefront's own order |

**Three of the ten journeys are deliberately not here.** Cart abandonment is the Email
Builder template and already works. Identity capture has no behaviour to draw on yet, so it
would show what Browse abandonment shows, worse. RFM is a segment: `$from` has no
aggregation, so an email cannot compute recency or frequency, and once a segment has, the
email it wants is Win-back's.

---

## How they adapt to a new demo, precisely

**The products, prices, photographs, category names and every link adapt.** They come from
`dps_product`, whose `link` and `image_link` are absolute, and the email works out which
demo the contact's newest row belongs to by joining `session_id` to `page_view_events` and
reading the slug out of `page_url`.

**The shell does not, and that is deliberate.** Dengage's mark, Dengage's palette, no store
name anywhere. Same decision as the abandoned cart email, Salil's call, 9 August 2026, and
for the same reason: the shell is fixed when this repository builds and the contents are
resolved when the email is sent, so a shell that named a store could contradict its own
products. It did once, with a Techiestore masthead around four garments.

So a demo built next month needs **nothing**. No new email, no edit, no re-import.

---

## What happens when there is nothing to show

Every one of them degrades rather than breaking, and none of them invents a value.

| Case | What sends |
|---|---|
| No history at all | the email, with copy and no products. **No button**, because no demo resolved |
| The contact used two demos | only the newest one's products, and links to only that one |
| A product has no price | the card, with no price. If it is in a basket, **the whole total is suppressed** |
| A product was withdrawn | not shown. `is_active` is the catalogue saying so |
| A photograph is `http` | no image on that card. A client blocks mixed content anyway |
| A search matched nothing | the catalogue, and the copy says these are popular rather than related |

The suppressed total is the one worth understanding. `Number(null)` is `0`, so a basket
containing one unpriced product adds up to something lower than the truth and entirely
plausible. A recipient checks the total first and can prove it wrong against their own
basket, so the block goes rather than one line of it.

---

## Why these are Code Editor and the cart email is not

| | Email Builder | Code Editor |
|---|---|---|
| A salesperson can point at blocks | **yes** | no |
| Can hold its own `{% %}` query | no | **yes** |
| Panel work per email | a template import, plus one saved asset per dynamic block, plus its id | **one paste** |

The cart email pays four saved assets and three days of round trips for a template somebody
can open and explain on a call. That is worth it once. It is not worth it seven more times,
and a Code Editor email needs none of it because raw HTML carries the query.

---

## How they were checked, and what that does not cover

`factory/emails/scenarios.test.mjs`, 109 assertions, run in CI. It **executes** each email
against synthetic event logs rather than reading it, which is the only way to check a file
that is a program. It covers: every column named exists in
[`factory/phase0/SCHEMA.md`](../phase0/SCHEMA.md), the query and the markup share no
variable, each scenario resolves what its history implies, and every degradation above.

Each was also rendered and looked at in a browser.

**What that does not cover is a send.** Dengage owns the real template engine, and the row
in Data Space is the only proof an event landed. So: paste one, send it to yourself, and if
anything renders differently from its `.preview.html`, that difference is worth a message.
