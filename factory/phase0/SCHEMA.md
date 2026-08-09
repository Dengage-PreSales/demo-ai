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

## Two things this read cannot tell anyone

- **A table existing is not proof anything writes to it.** Use `--counts` before
  and after using a storefront. Handoff §12.5.
- **Which rows belong to which demo.** No endpoint reads rows, so that is panel
  work: find `page_view_events` where `page_url` contains the slug, then follow
  `session_id` into the other five. CLAUDE.md §1b.
