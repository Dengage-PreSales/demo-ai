# The six tables, as they actually are

Read from the live account on **9 August 2026**. Recorded here because this is the
one thing in the factory that was guessed at rather than checked, and the guess was
wrong in six places at once. Every column name any generated content uses has to
appear in a list below, or it resolves to nothing at send time and the message goes
out with an empty row in it.

To re-read it, from a machine whose address is on the Dengage allowlist:

```bash
DENGAGE_API_USERKEY=... DENGAGE_API_PASSWORD=... \
  node factory/phase0/tables.mjs --verify
```

That is a read. It writes nothing and deletes nothing (CLAUDE.md §1a).

---

## The columns

**page_view_events**, 13 columns

```
key  event_date  session_id  page_type  page_url  page_title
product_id  category_id  promotion_id  price  discounted_price
stock_count  category_path
```

**shopping_cart_events**, 11 columns

```
key  event_date  id  session_id  event_type  event_id
product_variant_id  quantity  unit_price  discounted_price  product_id
```

**order_events**, 13 columns

```
key  event_date  event_type  session_id  order_id  item_count
total_amount  payment_method  shipping  camp_id  send_id
discounted_price  coupon_code
```

**order_events_detail**, 11 columns

```
key  event_date  order_id  product_id  product_variant_id
quantity  unit_price  discounted_price  session_id  event_type
payment_method
```

**wishlist_events**, 13 columns

```
key  event_date  session_id  event_id  event_type  product_id
expire_date  is_used  stock_count  price  discounted_price
list_name  product_variant_id
```

**search_events**, 6 columns

```
key  event_date  session_id  keywords  result_count  filters
```

---

## The finding that matters most

**No table carries a product name, a product image, or a category name.** Every one
of them identifies a product by `product_id` and nothing else. `page_view_events`
has `category_id` and `category_path`, which are an identifier and a path rather
than a label, and no other table has anything category shaped at all.

So a message cannot render a product's name or picture from these rows. The id is
all there is. Resolving an id into a name, a price and an image is what the
**product feed** is for, and it is what `Product Box` does. Until the feed is
registered against this application, personalised product content in email, push
or on-site has nothing to render. `factory/panel/PRODUCT-FEED.md` covers the
registration, and `factory/panel/README.md` records it as parked.

This also settles a documentation conflict. Dengage's ecommerce events reference
carries the comment `// ... extra columns in shopping_cart_events table, can be
added here`, which reads as though a payload may carry anything. It cannot: the
parameter has to correspond to a column that already exists, and columns cannot be
added to the six standard tables (CLAUDE.md §1b, confirmed by Salil). Sending
`product_name` does not create the column, it discards the value, and the send
still returns 200.

## What was wrong before this was read

Recorded so the same guesses are not made again. `factory/emails/data.mjs` named
these:

| It used | The column is | Effect at send time |
|---|---|---|
| `event_time` | `event_date` | every `orderByDescending` referenced a column that does not exist, on all five queries |
| `search_query` | `keywords` | the searched words never appeared |
| `unit_price` on wishlist | `price` | the saved item's price never appeared |
| `category` on page views | `category_path` | the browsed category never appeared |
| `product_name` | nothing | no product name is available from any table |
| `product_image` | nothing | no product image is available from any table |

The first four are name errors and are corrected. The last two are not errors in
naming, they are absences, and no correction to a query can fix them.

## dps_product, the product dimension

Added 9 August 2026. This is the table that unblocks product personalisation, and it
is an ordinary Data Space table rather than one of the six, so this repository can
be told about its columns and they can be relied on.

Its **`product_id` is the join to the star schema**, and it needs one relationship
per event table that carries that column. Four of the six do:

| Event table | Joins on | What the join produces |
|---|---|---|
| `shopping_cart_events` | `product_id` | the abandoned basket, with names and pictures |
| `page_view_events` | `product_id` | products viewed, for browse abandonment |
| `wishlist_events` | `product_id` | saved items, price drops, back in stock |
| `order_events_detail` | `product_id` | order lines, reorder and replenishment |

The other two do not, and neither is an omission:

- `order_events` is one row per order rather than per line. It reaches products
  through `order_events_detail` on `order_id`.
- `search_events` records `keywords`, not a product. What was typed is not
  necessarily anything in the catalogue, which is the entire point of a failed
  search programme.

`category_id` is a second, weaker join: `page_view_events` carries `category_id` and
`category_path` too, so category level personalisation can work without touching a
product row.

**The columns worth naming**, because each one turns on a specific message:

| Column | Used for |
|---|---|
| `title` | the product name, which no event table has |
| `image_link`, `small_image_link`, `large_image_link` | the picture. Email wants a fixed size, so prefer a sized variant |
| `price`, `discounted_price` | a price, and a reduction that can be shown honestly rather than implied |
| `link`, `mobile_web_link` | where the product is. Email uses `link`, push can use the mobile one |
| `availability`, `availability_date`, `stock_count` | back in stock, and low stock urgency that is true |
| `category_path`, `brand` | category and brand copy, as labels rather than ids |
| `is_active` | so a withdrawn product cannot appear in a send |
| `publish_date` | new arrivals, without inventing a sort order |

### The one thing to settle before rows are loaded

**`product_id` is the primary key, and the table is shared by every demo.** Two demos
holding a product with the same id would overwrite each other's row, and the demo on
a call would show the other one's picture. The storefront currently sends the
catalogue's own id (`String(line.id)` in `template/js/dengageEvents.js`), so ids from
different prospects will collide as soon as two are loaded.

There is a `store_name` column, which looks like the intended separator, but a shared
dynamic content asset cannot filter on it: nothing in a send tells the asset which
demo triggered it (CLAUDE.md §1b, there is no demo marker in the data). So the
separation has to be in the key itself, which also matches non-negotiable 6, that
every demo is namespaced by its slug.

That means `product_id` becomes `<slug>:<id>` in both places, the table and the
emitter, and it is a change to what the storefront writes, so it is Salil's call
before it is made.

### Why this removes the Product Box dependency

A dynamic content asset can resolve everything itself, in two steps, with no product
feed registered and no engine:

```
{% var lines = $from("shopping_cart_events")
     .where("contact_key", "=", $Contact.contact_key)
     .orderByDescending("event_date").take(3).get(); %}
{% for (var i = 0; i < lines.length; i++) {
     var p = $from("dps_product")
       .where("product_id", "=", lines[i].product_id).take(1).get()[0];
     if (!p || p.is_active != 1) continue; %}
       ... p.title, p.image_link, p.price, p.link ...
{% } %}
```

It also settles the problem that a shared asset cannot know a demo's image base: the
row carries `image_link` and `link` as absolute addresses, so the asset stays
brand neutral and demo neutral while each demo's email supplies the styling.

## Two things this read cannot tell anyone

- **A table existing is not proof anything writes to it.** Use `--counts` before
  and after using a storefront. Handoff §12.5.
- **Which rows belong to which demo.** No endpoint reads rows, so that is panel
  work: find `page_view_events` where `page_url` contains the slug, then follow
  `session_id` into the other five. CLAUDE.md §1b.
