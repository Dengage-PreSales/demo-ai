# The product feed

The catalogue Dengage needs, and the one thing standing between this application
and three capabilities.

```
https://dengage-presales.github.io/demo-ai/feed/products.csv
https://dengage-presales.github.io/demo-ai/feed/products.json
```

Both are regenerated whenever a demo is built, committed alongside it, and
published by GitHub Pages. Nothing needs to be uploaded by hand.

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
