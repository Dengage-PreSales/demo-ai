# The scraper

One URL in, a catalogue and a theme out. Handoff 7.

```bash
node factory/generate-demo.mjs --url https://www.example.com
node factory/generate-demo.mjs --url https://www.example.com --slug acme --currency EUR
node factory/generate-demo.mjs --url https://www.example.com --csv products.csv
node factory/scrape/scrape.test.mjs        # offline, no network, about a second
```

| File | What it owns |
|---|---|
| `fetch.mjs` | every request this repository makes to a prospect's site, and `robots.txt` |
| `catalogue.mjs` | the catalogue tiers, and the category structure |
| `theme.mjs` | brand colours, typography and corner radius |
| `render.mjs` | the headless browser tier, loaded lazily by the dispatcher when present |
| `fallback.mjs` | the generated stand-in catalogue, the one place allowed to invent |
| `scrape.test.mjs` | every judgement above, tested offline |

---

## The tiers

1. **Shopify.** `<store>/products.json`, unauthenticated, one request. Covers a
   large share of prospects and needs nothing from them.
2. **WooCommerce.** The Store API at `/wp-json/wc/store/v1/products`, public by
   default on WooCommerce, one request, with a fallthrough to the unversioned
   route older installs serve. Prices arrive as strings in minor units, so
   `"1999"` at `currency_minor_unit` 2 is 19.99: the division happens before the
   shared price logic ever sees the figure, because forgetting it ships a price
   one hundred times too large on a page that renders perfectly.
3. **Structured markup**, reported as `jsonld` in attempts. `robots.txt`, then
   the sitemap, then three readings of each product page in order: JSON-LD,
   microdata (`itemscope`/`itemprop`), and OpenGraph meta tags. One method per
   page, never more, so nothing is counted twice, and the attempts entry says
   how many products each method contributed. Covers Magento, BigCommerce and
   custom builds, including the older ones that never adopted JSON-LD.
4. **Render.** A headless browser, for stores whose markup only exists after
   JavaScript runs. It lives in `render.mjs`, the dispatcher loads it lazily and
   carries on without it if the module is absent, and `render: false` turns it
   off. It reads pages with the same `extractProductsFromHtml` the markup tier
   uses, so a fetched page and a rendered one answer identically.
5. **CSV.** Only after everything above has failed. The workflow asks for one on
   the issue rather than up front, so it stays an exception rather than a step.
6. **Generated.** Opt in, and a different kind of answer: a stand-in catalogue
   that announces itself as invented. `fallback.mjs` carries the reasoning and
   the terms.

`robots.txt` is respected. Salil's decision, handoff 7.1. It costs some sites and
those fall through to tier 3.

**A tier that finds fewer than eight products has not succeeded.** One store
blocked its feed, fell through to its product pages, and yielded three. That
built without error and was worse than a clean failure: a grid of three, rails
holding one item, and a salesperson finding out on the call.

---

## What it does not fetch

**No image bytes, but every image address.** Each product carries `imageUrl`: an
absolute `https` URL or null, never `http`, never a `data:` URI, never invented,
with relative paths resolved against the page they were found on. The scrape
records the address and fetches nothing: downloading, compressing and committing
the file is the downloader's job, and `image` stays null here until it runs.
That committed local copy is what satisfies non-negotiable 4, because a demo
must never load an asset from a third party at runtime. A product whose store
offered no usable address ships `imageUrl: null` and the demo draws its own
artwork for it.

**Never the logo or word mark.** Non-negotiable 3. Nothing here looks at images at
all. A generated demo carries the Dengage mark with the subtext "eComm Demo".

---

## The rule that shapes every mapper

**Never fabricate a number to fill a column.** `Number(null)` is `0`, and `0` in
`stock_count` announces a product out of stock, which poisons every back-in-stock
segment built on it.

The Shopify feed makes this concrete. It carries `available`, a boolean, and not
`inventory_quantity`:

| Feed says | Shipped as | Why |
|---|---|---|
| no variant available | `stockCount: 0` | out of stock is a fact |
| some variant available | `stockCount: null` | in stock is a fact, the count is not |

A product whose price cannot be read is dropped rather than shipped with a null
one, because `unit_price` is required on `ec:addToCart` and "omit the column" is
not available there.

---

## Traps already paid for

Every one of these produced a wrong result on a real site first, and each has a
case in `scrape.test.mjs`.

**Availability is any-of, never the first variant.** A clothing feed lists sizes
in order and the smallest is usually the first to sell out. Reading
`variants[0].available` reported 26 of 30 products out of stock on a store with
twelve sizes on the shelf.

**Colourways are one product.** Shopify lists each colour as its own product with
the same title, so 30 products carried 17 distinct names. The grid repeated the
same tile at the same price, which reads as a rendering fault. Appending the
colour was worse: the values are long and shouted, and unreadable at grid size.

**A category needs more than one product, and the minimum scales.** A retailer's
structured data names the shelf rather than the department, so one catalogue
produced "Custom-made Thick Veneer Worktops" as top level navigation holding one
product. A fixed minimum of three then collapsed a ten product CSV with five
sensible departments to one entry. One tenth of the catalogue, never below two.

**`categorise` is called twice and has to agree with itself.** The first pass
writes `More` onto products, and the second counted that as a real category and
appended a second `More`.

**Sitemaps are streamed, and the locale matters.** One index held 2171 entries
named `prod-en-GB_1.xml`, and a single locale sitemap exceeded 8MB. Scoring on the
word "product" missed the abbreviation, and the first entries in the index were
Estonian, so the first working version read the right site in the wrong language.

**Only the first family in a `font-family` stack is the brand's choice.** Nearly
every stylesheet ends a stack with `monospace`, and every stack ending
`sans-serif` contains the substring `serif`. Matching the whole stack mapped a
site to IBM Plex Sans while it used neither IBM Plex nor a mono face. The same
trap the artwork classifier paid for.

**A brand colour is not the most frequent colour.** Without rejecting greys and
near-black and near-white, every site resolves to `#ffffff`. Colours are weighted
by what they apply to: buttons, then the header, then links.

**Contrast is clamped, not reported.** Handoff 7.2. A demo whose Add to cart
button is white on pale yellow is unreadable on a projector, and a projector is
where these are seen. The primary is darkened until white text clears 4.5:1.

---

## Everything in a demo was written by somebody else

A product name arrives from a feed built for a browser, so it is HTML, not text.
A price arrives in whatever convention the store's country uses. A category name
arrives at whatever length the store's taxonomy happens to be. None of that is
hostile, and all of it breaks a naive reader.

The whole catalogue was driven through a fixture containing every case below at
once, and each one is now a case in `scrape.test.mjs`.

| What arrives | What happened first | What happens now |
|---|---|---|
| `Jack &amp; Jones Shirt` | shipped literally, rendered as `&amp;` on the tile | entities decoded once |
| `<b>Bold</b> Hoodie` | tags rendered as visible text | tags stripped, script and comment bodies removed |
| `Jacket, an em dash, Navy` | **the build failed**, see below | every dash variant becomes a hyphen |
| `1.299,00` | read as 1.30 | read as 1299 |
| `yes` in a stock column | **every product out of stock** | unknown |
| price `0` or `-10` | shipped, then failed the smoke test | dropped |
| stock `-5` or `2.7` | shipped, then failed the smoke test | unknown, or rounded |
| the same SKU twice | one product unreachable, carts merged | the later one dropped |
| an Arabic or Chinese name, no SKU | **the product was dropped** | a stable hashed id |
| a 120 character category | the header nav grew wider than the header | capped at 28, cut on a word |
| `"><img src=x>` as a category | nothing, the storefront escapes it | asserted, on the page |

**The dash case is the one worth reading twice.** CLAUDE.md 3.10 forbids em and
en dashes in committed text, and the guard enforces it on raw bytes across every
committed file including `.json`. A generated demo's `products.json` is committed,
and the build workflow runs the guard before publishing. So a retailer who writes
"Jacket, em dash, Navy" in a product title would not have produced a demo that
merely looked odd: it would not have built at all. A rule about this repository's
own prose would otherwise have decided which prospects can have a demo.

**None of this is a security boundary.** The storefront escapes on render, and
that was verified in a browser with a category named `"><img src=x onerror=...>`:
no alert, no injected element, no console error. The sanitising exists so a tile
is not captioned `&amp;` on a sales call.

**Nothing here trusts a number it did not understand.** The two rules are the same
one seen from both ends: an unknown value is absent, never zero, and a value that
cannot be read is refused rather than guessed at. `num()` itself had the
`Number('') === 0` bug, which is worth remembering: the trap survives inside the
function written to avoid it.
