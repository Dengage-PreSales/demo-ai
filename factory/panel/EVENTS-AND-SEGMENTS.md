# Event definitions and segments

Two halves, in the order they have to be built:

1. **Event definitions.** Twenty nine of them, each one a name a campaign can
   reference, mapped to a real column. Created once, in Campaign Configuration >
   Event Definitions.
2. **Segments.** Seven behavioural segments and three consent overlays, which
   between them address all twenty one messages already built: seven emails, seven
   SMS and seven web push.

Nothing here needs a storefront change. Every filter and every attribute below
names a column the demo already fills, and [the ground truth table](#what-the-demo-actually-fills)
is what makes that checkable rather than asserted.

**Read [`../phase0/SCHEMA.md`](../phase0/SCHEMA.md) first if you are changing anything
in this file.** It is the column list read from the live account, and it exists
because the columns were guessed once and the guess was wrong in six places at
once.

---

## What the demo actually fills

The six tables have 67 columns between them and the demo fills 59. **The eight it
never fills are the important part of this table**, because a filter or an attribute
pointed at one of them is not an error anyone will see: the definition saves, the
segment builds, it matches nobody, and the campaign reports zero without ever saying
why. They are `category_id` and `promotion_id` on page views, `shipping`,
`coupon_code`, `camp_id` and `send_id` on orders, `expire_date` on wishlist rows and
`filters` on searches.

Two more are filled on every row and still useless as dimensions, which is worse than
empty because they look usable: `payment_method` is always `credit_card` and
`list_name` is always `favorites`.

### page_view_events

| Column | Filled | By what |
|---|---|---|
| `key` | yes | the SDK. **The device id, always.** See [what `key` actually holds](#what-key-actually-holds) |
| `event_date` | yes | the SDK |
| `session_id` | yes | the SDK. The only join to the other five tables |
| `page_type` | yes | `home`, `category`, `product`, `other`, `login`, `logout` |
| `page_url` | yes | the SDK. Carries the demo slug, which is how a demo's rows are found at all |
| `page_title` | yes | the SDK |
| `product_id` | product pages only | |
| `price` | product pages only | |
| `discounted_price` | product pages, and only when the product really is discounted | |
| `stock_count` | product pages, and only when the scrape read one | |
| `category_path` | yes | top level name on home and category, full path on a product |
| `category_id` | **never** | the emitter does not send it. `category_path` is the category signal |
| `promotion_id` | **never** | the demo has no promotion surface |

`page_type` never takes `cart`, `checkout`, `promotion` or `pricing`. The cart and
checkout are overlays on the page that is already open rather than pages of their
own, so no page view fires for them. **Cart and checkout intent comes from
`shopping_cart_events`, not from a page type.**

### shopping_cart_events

| Column | Filled | By what |
|---|---|---|
| `key`, `event_date`, `session_id`, `event_id`, `id` | yes | the SDK |
| `event_type` | yes | set by the SDK from the `ec:` call. **See [the one thing to verify](#the-one-thing-to-verify)** |
| `product_id`, `product_variant_id` | yes, except on empty-cart rows | variant falls back to the product id when a product has no variants |
| `quantity`, `unit_price`, `discounted_price` | yes, except on empty-cart rows | |

**Two row shapes carry no product columns, and a definition that assumes they do
matches nothing.** The begin-checkout call sends the basket as `cartItems` with no
top level product, and the empty-cart call sends nothing at all. So a Checkout
Started definition can report a cart value and an item count, and an Cart Emptied
definition can only report that it happened.

### order_events

| Column | Filled | By what |
|---|---|---|
| `key`, `event_date`, `session_id`, `event_type` | yes | |
| `order_id`, `item_count`, `total_amount`, `discounted_price` | yes | |
| `payment_method` | yes, but always the same value | the demo has one payment path, so this is `credit_card` on every row. **Do not build a segment on it**: it looks like a real dimension and has exactly one value |
| `shipping` | **never** | |
| `coupon_code` | **never** | the demo has no coupon entry |
| `camp_id`, `send_id` | **never** | so order rows cannot be attributed back to a campaign from this side. See [revenue](#revenue-mapping) |

### order_events_detail

Every column filled: `key`, `event_date`, `order_id`, `product_id`,
`product_variant_id`, `quantity`, `unit_price`, `discounted_price`, `session_id`,
`event_type`, `payment_method`. One row per purchased line, which makes this the
only table that answers "what did they actually buy".

### wishlist_events

| Column | Filled | By what |
|---|---|---|
| `key`, `event_date`, `session_id`, `event_id` | yes | |
| `event_type` | yes | `add` or `remove`, and these two are confirmed against stored rows |
| `product_id`, `product_variant_id` | yes | |
| `price`, `discounted_price`, `stock_count` | yes | same rules as a product page view |
| `list_name` | yes, but always the same value | `favorites`. The other three documented names have never appeared in a stored row on this account, so the demo stops sending them. Turn them on with `dengage.wishlistLists` in `demo.config.json` once one is observed landing |
| `is_used` | yes, always `false` | required for the row to store. Not a dimension |
| `expire_date` | **never** | it made no difference to a stored row |

### search_events

| Column | Filled | By what |
|---|---|---|
| `key`, `event_date`, `session_id` | yes | |
| `keywords` | yes | the settled query, once per search rather than once per keystroke |
| `result_count` | yes | `0` when the search found nothing, which is a real zero rather than a missing value |
| `filters` | **never** | the demo's search has no facets |

### What `key` actually holds

**The device id, on every row, signed in or not.** Corrected 17 August 2026,
against rows read from the live account. This table used to say "contact key when
identified, device id when not", which was inferred from the column's name and
never checked.

It cost a real failure. A message template joined `key` to
`$Contact.contact_key`, matched nothing, and fell through to a default while the
contact was signed in and its rows sat in the table under a device uuid. Nothing
errored, because an empty result is not an error.

**Segments and event definitions are unaffected, and that is why this survived.**
The Star Schema hangs the six event tables off `master_device`, and
`master_device.contact_key` reaches `master_contact`, so Dengage performs that
hop itself whenever a segment or an event definition is evaluated. Everything in
Part 1 and Part 2 of this document works exactly as written.

**A `$from` query in a piece of content gets no such help.** It reads one table
and joins nothing, so content that wants a contact's own events has to walk both
steps by hand:

```
$from('$db.master_device').where('contact_key', '=', $Contact.contact_key)
   -> the device ids
      -> $from('$db.page_view_events').where('key', '=', <each device id>)
```

Two things fall out of that and neither is optional. A contact with a laptop and
a phone has more than one device, so take the newest row across all of them
rather than the first device returned. And the column naming a device in
`master_device` is not documented, so read it off a row rather than assuming
`device_id`.

### The one thing to verify

`event_type` on `shopping_cart_events` and `order_events` is set by the SDK rather
than by the demo, so this document infers four of its values rather than having seen
them in a row:

| Table | Values used below | Confirmed? |
|---|---|---|
| `wishlist_events` | `add`, `remove` | **yes**, against stored rows, 6 August 2026 |
| `shopping_cart_events` | `add_to_cart`, `remove_from_cart` | **yes**, named from observed rows |
| `shopping_cart_events` | `delete_cart`, `begin_checkout` | **no**, inferred from the call names |
| `order_events` | `order`, `cancel_order` | **no**, inferred from the call names |

**Confirm the four before you rely on a filter that uses one.** The account is IP
allowlisted, so the panel is the place to do it: add this to
[`content/_dynamic/_diagnostic.html`](content/_dynamic/_diagnostic.html) and preview
it, which is a read and needs no campaign.

```
{% var carts = $from('$db.shopping_cart_events').take(50).get(); %}
{% var orders = $from('$db.order_events').take(50).get(); %}
```

Then print each row's `event_type`. Fifty rows across a shared account is enough to
see every value in use. Until then, treat a Cart Emptied or Order Cancelled segment
that matches nobody as an unconfirmed value rather than an absence of behaviour.

---

## Part 1. The event definitions

An event definition takes a **name**, one **source table**, a **filter** as column,
operator and value, the **date column** to measure recency against, and the
**attributes** to expose for personalisation and for segment criteria. The date
column is `event_date` on all six tables, every time.

Attributes are named exactly as the column, on purpose. A friendly alias saves one
reading and costs every later one, because the panel shows the alias and
[`SCHEMA.md`](../phase0/SCHEMA.md) shows the column.

### From page_view_events, nine

| # | Name | Filter | Attributes | What a marketer does with it |
|---|---|---|---|---|
| 1 | `Page Viewed` | none | `page_url`, `page_type`, `session_id` | The base signal for active, dormant and lapsed. Every recency segment in Part 2 rests on this one |
| 2 | `Product Viewed` | `page_type` equals `product` | `product_id`, `category_path`, `price`, `discounted_price`, `stock_count`, `page_url` | Browse abandonment, category affinity, and the single most used definition of the nine |
| 3 | `Category Browsed` | `page_type` equals `category` | `category_path` | Category level sends for people who never reached a product, which is most of the traffic |
| 4 | `Homepage Visited` | `page_type` equals `home` | `page_url` | Separates "came back and looked around" from "came back for something specific" |
| 5 | `Discounted Product Viewed` | `page_type` equals `product` AND `discounted_price` is set | `product_id`, `price`, `discounted_price` | The discount responsive audience. Worth having because the inverse is more useful: full price viewers are who you do **not** send a code to |
| 6 | `Low Stock Product Viewed` | `page_type` equals `product` AND `stock_count` less than or equal to `5` | `product_id`, `stock_count` | Urgency copy that is true. Covers only products whose stock the scrape actually read, and a product with no stock count is correctly absent rather than counted as zero |
| 7 | `High Value Product Viewed` | `page_type` equals `product` AND `price` greater than or equal to *the demo's own threshold* | `product_id`, `price`, `category_path` | Premium tier. **Set the number from the catalogue in front of you**, not from a habit: the generator writes real scraped prices, so the same figure means different things on a fashion demo and an electronics one |
| 8 | `Signed In` | `page_type` equals `login` | `page_url` | The identification moment. Fires the instant a contact key is attached, which is what makes a welcome journey possible |
| 9 | `Signed Out` | `page_type` equals `logout` | `page_url` | Suppression, and a clean end to a demonstrated session on a call |

Definition 5 uses "is set" because `discounted_price` is absent rather than zero when
a product has no discount. If the panel's operator list has no such option, use
`greater than 0`: the emitter refuses to write a zero into a price column, so the two
select the same rows.

### From shopping_cart_events, six

| # | Name | Filter | Attributes | What a marketer does with it |
|---|---|---|---|---|
| 10 | `Added to Cart` | `event_type` equals `add_to_cart` | `product_id`, `product_variant_id`, `quantity`, `unit_price`, `discounted_price` | Cart abandonment, and the exclusion that keeps browse abandonment honest |
| 11 | `Removed from Cart` | `event_type` equals `remove_from_cart` | `product_id`, `quantity`, `unit_price` | A negative signal, and the one most demos ignore. Someone who took an item out does not want a message about that item |
| 12 | `Cart Emptied` | `event_type` equals `delete_cart` | `session_id` only | The strongest negative in the set. Carries no product columns, so it can only suppress, never personalise |
| 13 | `Checkout Started` | `event_type` equals `begin_checkout` | `quantity`, `unit_price`, `discounted_price` | The highest intent signal available. Small volume, best conversion, and worth separating from cart abandonment for exactly that reason |
| 14 | `Multiple Units Added` | `event_type` equals `add_to_cart` AND `quantity` greater than or equal to `2` | `product_id`, `quantity` | Bulk and gift buyers, and a different tone of message |
| 15 | `Discounted Item Added` | `event_type` equals `add_to_cart` AND `discounted_price` is set | `product_id`, `unit_price`, `discounted_price` | Pairs with definition 5. Together they tell you who needs an incentive and who does not |

### From order_events, five

| # | Name | Filter | Attributes | What a marketer does with it |
|---|---|---|---|---|
| 16 | `Order Placed` | `event_type` equals `order` | `order_id`, `total_amount`, `item_count`, `discounted_price` | The suppression that belongs in every segment in Part 2, and the conversion event for every report |
| 17 | `Order Cancelled` | `event_type` equals `cancel_order` | `order_id`, `total_amount` | Win-back with the reason known, and suppression from anything congratulatory |
| 18 | `High Value Order` | `event_type` equals `order` AND `total_amount` greater than or equal to *the demo's own threshold* | `order_id`, `total_amount`, `item_count` | The top tier worth treating differently. Same warning as definition 7 about the number |
| 19 | `Single Item Order` | `event_type` equals `order` AND `item_count` equals `1` | `order_id`, `total_amount` | The clearest cross sell audience in the whole set: they bought exactly one thing and saw nothing else |
| 20 | `Multi Item Order` | `event_type` equals `order` AND `item_count` greater than or equal to `2` | `order_id`, `item_count`, `total_amount` | The basket you already know how to build. Useful as the contrast that makes 19 worth acting on |

`payment_method` is deliberately absent from every attribute list above. It is
filled on every row and always with `credit_card`, so exposing it invites a segment
that looks meaningful and divides nobody.

### From order_events_detail, three

| # | Name | Filter | Attributes | What a marketer does with it |
|---|---|---|---|---|
| 21 | `Product Purchased` | none | `product_id`, `product_variant_id`, `quantity`, `unit_price`, `order_id` | Replenishment, reorder, and the exclusion that stops you advertising something they own |
| 22 | `Repeat Quantity Purchased` | `quantity` greater than or equal to `2` | `product_id`, `quantity` | Consumables and refills, found from behaviour rather than from a category guess |
| 23 | `Discounted Line Purchased` | `discounted_price` is set | `product_id`, `unit_price`, `discounted_price` | Whether the revenue came at full price. The answer changes how you value every programme above |

### From wishlist_events, four

| # | Name | Filter | Attributes | What a marketer does with it |
|---|---|---|---|---|
| 24 | `Saved to Wishlist` | `event_type` equals `add` | `product_id`, `price`, `discounted_price`, `stock_count`, `list_name` | Intent with no purchase, and the cleanest signal in the demo: nobody saves by accident |
| 25 | `Removed from Wishlist` | `event_type` equals `remove` | `product_id` | Suppression. They changed their mind, and a reminder now is worse than silence |
| 26 | `Saved Item Running Low` | `event_type` equals `add` AND `stock_count` less than or equal to `5` | `product_id`, `stock_count` | The most convincing message the demo can send, because it is true, timely and about something they chose |
| 27 | `Saved Item Discounted` | `event_type` equals `add` AND `discounted_price` is set | `product_id`, `price`, `discounted_price` | A price drop on a saved item. Reads as a favour rather than as marketing |

### From search_events, two

| # | Name | Filter | Attributes | What a marketer does with it |
|---|---|---|---|---|
| 28 | `Search Performed` | none | `keywords`, `result_count` | Demand in the shopper's own words, which is the one thing no catalogue tells you |
| 29 | `Search Returned Nothing` | `result_count` equals `0` | `keywords` | Two jobs at once: a recovery message to the shopper, and a merchandising gap report for the buying team |

A "search returned few" definition on `result_count` between 1 and 3 is tempting and
deliberately left out. The demo's catalogue is 15 to 30 products, so a low count is
normal rather than a failure, and the segment would describe the demo instead of the
shopper.

### From master_contact, the criteria that are not events

These are contact attributes rather than event definitions, so they need no setup.
They are listed because every segment in Part 2 uses at least one:

| Field | Values in this demo | Used for |
|---|---|---|
| `contact_status` | `Active` | the first criterion of every segment |
| `email_permission` | `Active` after the subscription form | the email consent overlay |
| `gsm_permission` | `Active` after the subscription form | the SMS consent overlay |
| `whatsapp_permission` | `Active` after the subscription form | reserved. No WhatsApp message is built yet |
| `contact_key` | `DPS-` and a timestamp, or one a colleague typed | telling demo contacts apart from everything else on a shared account |
| `source` | `subscription_form` | where the contact came from, and the only value the demo produces |
| `created_at` | | tenure, and a welcome window |
| `rfm_segment`, `rfm_score` | empty until Dengage computes them | lifecycle. Needs order history to exist first, so it is the last thing to arrive on a new demo |

### Four things that are not event definitions, and why

The four most useful audiences in ecommerce cannot be event definitions at all,
because each one is the **absence** of a second event. A definition describes one
table with one filter. An absence is a comparison between two, and that belongs in
the segment:

| The audience | Built as |
|---|---|
| Viewed but never added | `Product Viewed` present AND `Added to Cart` absent, same window |
| Added but never bought | `Added to Cart` present AND `Order Placed` absent, same window |
| Reached checkout but never paid | `Checkout Started` present AND `Order Placed` absent, same window |
| Searched but never viewed | `Search Performed` present AND `Product Viewed` absent, same window |

Trying to express one of these as a definition is the mistake worth naming once,
because the panel will let you save something that looks close and matches the wrong
people.

---

## Part 2. The segments

**Seven behavioural segments, three consent overlays and one suppression: eleven
objects for twenty one messages.** The behaviour that selects an audience is
identical for the email, the
SMS and the push of the same journey. Only the reachability differs, so the consent
test is a separate overlay that all three read, instead of being rebuilt twenty one
times with twenty one chances to disagree.

### The three consent overlays

| Segment | Criteria |
|---|---|
| `DPS - Email reachable` | `contact_status` equals `Active` AND `email_permission` equals `Active` AND `email` is set |
| `DPS - SMS reachable` | `contact_status` equals `Active` AND `gsm_permission` equals `Active` AND `gsm` is set |
| `DPS - Push reachable` | `contact_status` equals `Active` AND the contact has a device with a push token |

### The seven behavioural segments

Every one of them also excludes `Order Placed` in its own window, because a message
about something the shopper has already bought is the one failure a prospect on a
call will notice immediately.

| Segment | Include | Exclude | Window |
|---|---|---|---|
| `DPS - Checkout not completed` | `Checkout Started` | `Order Placed` | 1 day |
| `DPS - Browsed no cart` | `Product Viewed` | `Added to Cart`, `Order Placed` | 3 days |
| `DPS - Search found nothing` | `Search Returned Nothing` | `Order Placed` | 3 days |
| `DPS - Saved not purchased` | `Saved to Wishlist` | `Removed from Wishlist`, `Order Placed` | 7 days |
| `DPS - Cart open, no checkout` | `Added to Cart` | `Checkout Started`, `Cart Emptied`, `Removed from Cart`, `Order Placed` | 2 days |
| `DPS - Due to reorder` | `Product Purchased` between 60 and 30 days ago | `Order Placed` in the last 30 days | 30 to 60 days |
| `DPS - Lapsed browser` | `Page Viewed` between 90 and 30 days ago | `Page Viewed` in the last 30 days, `Order Placed` in the last 30 days | 30 to 90 days |

Three of these deserve a sentence each:

**`DPS - Cart open, no checkout` excludes `Checkout Started` deliberately.** Anyone
who reached checkout belongs in the first segment, which is a different message with
a different tone. Without this exclusion the two overlap and the same shopper gets
both, which is the most common way a good cart programme reads as spam.

**`DPS - Due to reorder` and `DPS - Lapsed browser` use a window with two ends**, not
a "last N days". "Bought in the last 60 days" includes yesterday's buyer, who is the
wrong person entirely. The pattern is include the older window, exclude the recent
one.

**`DPS - Saved not purchased` cannot check per product.** It excludes anyone who
bought anything, not anyone who bought the saved item, because a segment compares
events rather than joining their product ids. It is the honest simplification, and
the cost is that someone who saved two items and bought one hears nothing about the
other.

### Which segment each of the twenty one messages uses

| Journey | Email | SMS | Push | Behavioural segment |
|---|---|---|---|---|
| Checkout rescue | You were one step away | `DPS - Checkout rescue` | `DPS - Checkout rescue` | `DPS - Checkout not completed` |
| Browse abandonment | Still thinking about it? | `DPS - Browse abandonment` | `DPS - Browse abandonment` | `DPS - Browsed no cart` |
| Failed search | About what you were looking for | `DPS - Failed search` | `DPS - Failed search` | `DPS - Search found nothing` |
| Wishlist | Something you saved | `DPS - Wishlist` | `DPS - Wishlist` | `DPS - Saved not purchased` |
| Basket building | Goes with what you picked | `DPS - Basket building` | `DPS - Basket building` | `DPS - Cart open, no checkout` |
| Replenishment | Order it again in one press | `DPS - Replenishment` | `DPS - Replenishment` | `DPS - Due to reorder` |
| Win-back | New in, and worth a look | `DPS - Win-back` | `DPS - Win-back` | `DPS - Lapsed browser` |

Each message reads its journey's behavioural segment **and** the overlay for its own
channel. Twenty one messages, eleven objects.

### One consequence of standing segments, stated once

A standing segment is refreshed on a schedule, so the fastest it can react is one
refresh interval. For six of the seven journeys that is the right tool and the
interval barely matters, because the windows are days.

**Checkout rescue is the exception.** The value of that message is that it arrives
while the card is still on the table, and a segment refreshed hourly delivers it up
to an hour late. Set that one to the shortest refresh the panel allows, and know
that an Automated Flow triggered by `Checkout Started` with a 20 minute wait and a
decision split on `Order Placed` is the version that arrives on time. The segment is
what is built here; the flow is worth naming on a call as the production shape.

### Suppression worth adding once

One more segment, read as an exclusion by all seven:

`DPS - Recently messaged`: anyone who received any of these campaigns in the last 2
days. Seven journeys with overlapping windows will otherwise reach the same shopper
three times in a morning, and nothing undoes that impression on a call.

---

## Revenue mapping

**Point Revenue Mapping at `Order Placed` and its `total_amount` attribute before any
of this goes live**, in Settings > Revenue Mapping. Until it exists, every report
shows opens and clicks and no money.

The honest limit: `order_events.camp_id` and `send_id` are never filled by the demo,
so attribution from the order side is not available. Revenue mapping still works,
because Dengage attributes on its own send and click records rather than on those two
columns. It is worth knowing which of the two mechanisms is doing the work if a
prospect asks how the attribution is done.

---

## Order of work

1. Confirm the four `event_type` values, using the diagnostic asset above
2. Create the twenty nine event definitions
3. Set Revenue Mapping to `Order Placed` and `total_amount`
4. Create the three consent overlays
5. Create the seven behavioural segments, and `DPS - Recently messaged`
6. Attach each of the twenty one messages to its behavioural segment and its channel overlay

Steps 2 and 4 are one time for the account. Steps 5 and 6 are one time as well,
because the segments read event definitions rather than naming a demo, so a demo
built next month is picked up by all seven with nothing to change.
