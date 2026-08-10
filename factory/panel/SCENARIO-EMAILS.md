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

## The AMP sample

**One, and it is the browse abandonment email:**
[`scenario-browse.amp.html`](content/_shared/scenario-browse.amp.html). Paste it into the
**AMP tab** of that same email, beside the HTML.

The products the recipient actually looked at, in a carousel they swipe **inside the inbox**.
That is the thing an HTML email cannot do, which is the only reason to reach for AMP: a
carousel of a basket they have already chosen, or of one saved item, would be a carousel for
its own sake. So it is a sample rather than a set.

**Two things to know before you send it.**

**It only renders if the sending domain is registered for AMP for Email** with the mailbox
provider, Google for Gmail. Until then every provider falls back to the HTML part, which is
the same email without the swipe, so nothing breaks and nothing shows. That registration is
a Dengage and Google matter and there is nothing in this repository that can do it.

**There is no `.amp.preview.html`, on purpose.** The AMP boilerplate hides the body until the
runtime loads from `cdn.ampproject.org`, so an AMP file opened from disk is a blank page.
Checked rather than assumed. To see it before sending, paste it into the AMP playground,
which renders it live:

```
https://playground.amp.dev/?runtime=amp4email
```

**The carousel images are the 1200x600 push banners**, the same files the web push Media
field uses. `amp-img` demands explicit width and height, and a product photograph is whatever
aspect the prospect's studio shot; a banner is always 2:1 with the margin trimmed, and CI
asserts one exists beside every committed photograph. One product renders without a carousel
at all, because arrows that do nothing read as broken.

**It is validated twice, and the two validators disagree for a reason worth knowing.**

`scenarios.test.mjs` runs the official `amphtml-validator` in `AMP4EMAIL` mode against
**both artefacts**, and confusing the two was my own mistake twice over:

| Artefact | Who sees it | Why it matters |
|---|---|---|
| The file **as pasted**, tags intact | the Dengage panel, and the AMP playground | this is what gets rejected before you can publish |
| The **resolved** email | the recipient | this is what has to render |

A pass on one says nothing about the other. I validated only the resolved one for two rounds
and reported a pass while the panel was showing sixteen errors, which is how Salil came to
ask, on 10 August 2026, whether I was validating it myself at all. Both are asserted now, and
the authored check reproduces the playground's output line for line.

It also checks the validator rejects the same document with a plain `<img>` in it, because a
validator that passes everything passes nothing.

**To check any of these yourself:** paste into `https://playground.amp.dev/?runtime=amp4email`.
It runs the same validator, on the file as pasted.

**Dengage's own validator reads the file as authored, before the template engine runs**, so
it is stricter in four specific ways. The first AMP sample passed the official validator
perfectly and the panel reported thirty errors, none of which was about AMP. All four are
fixed, and all four are now asserted on the authored source:

| What the panel sees | What it reported | Fix |
|---|---|---|
| 150 lines of `{% %}` above `<!doctype html>` | `the parent tag of 'html' is '$root'`, and every head tag parsed as body | the doctype is first, and the query sits inside `<body>` |
| `i < rows.length` inside the query | nothing directly, but an HTML parser opens a tag at the `<` | **the generated query contains no `<` at all.** Every comparison is written larger side first |
| `src="{%= card.banner %}"` | `the relative URL '{%= card.banner %}' is disallowed` | a literal `https://...` prefix, then a path expression |
| A tag inside a **double quoted attribute** whose expression contains a double quote | eight invented attributes per slide: `'%}n{%'`, `'else'`, `'{'`, `'}'` | the condition goes outside the tag, not inside the attribute |

That last one took two rounds, and the second round is the useful part. The first version put
a conditional in a `style` attribute. Told about it, I moved the conditional into a `class`
attribute, which failed identically, because **the attribute's name was never the cause**. An
attribute closes at the next double quote, so `class="{% if (x === "") ...` ends inside the
comparison and everything after it is read as more attributes. `src`, `href` and `alt` keep
their tags quite happily, because their expressions use single quotes.

So the test no longer pattern matches for a list of attribute names. It consumes every tag
attribute by attribute the way a parser does and fails if anything is left over, and it
checks itself against the exact markup the panel rejected.

That last pair is why `resolve.mjs` gives every card a `bannerPath` and a `linkPath`
alongside its absolute address: the attribute has to look absolute to something reading the
text, and resolve to the same URL afterwards.

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

`factory/emails/scenarios.test.mjs`, 136 assertions, run in CI. It **executes** each email
against synthetic event logs rather than reading it, which is the only way to check a file
that is a program. It covers: every column named exists in
[`factory/phase0/SCHEMA.md`](../phase0/SCHEMA.md), the query and the markup share no
variable, each scenario resolves what its history implies, every degradation above, and the
AMP sample against the official AMP4EMAIL validator.

Each was also rendered and looked at in a browser.

**What that does not cover is a send.** Dengage owns the real template engine, and the row
in Data Space is the only proof an event landed. So: paste one, send it to yourself, and if
anything renders differently from its `.preview.html`, that difference is worth a message.
