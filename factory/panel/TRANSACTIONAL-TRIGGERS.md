# Transactional triggers: instant email and web push on intent

**What this is.** The demo storefront reacts to a visitor's behaviour in the moment: they
drift toward closing the tab and their phone buzzes, an email lands. Marketing campaigns
cannot do that, because they compute an audience on a schedule. Dengage's transactional
API can, and this page is the whole design: what fires, what each message says, and the
exact parameter names that carry the personalisation.

**Verified against the live account on 18 September 2026**, not assumed, over three rounds.
What was proven and what was not is in the last section, along with the two traps the rounds
found: one prints template code into a delivered email, the other makes a correct push
template indistinguishable from a missing one. Both shaped the rules in section 1, so read
section 6 before writing a template.

---

## 1. The two endpoints, and the one fact that shapes everything

| | |
|---|---|
| Email | `POST /rest/transactional/email` |
| Web push | `POST /rest/transactional/push` |

Both on the account's API host, with a bearer token from `/rest/login`.

**`$Contact` is empty on a transactional send.** This is a property of the lane rather
than a fault, and it is the single fact that shapes every message below: a transactional
template cannot read the contact card, so **every value a message prints has to travel in
the send call**, in the `current` object. `{%= $Current.first_name %}` prints what the call
passed under `first_name`, and nothing else resolves.

Three consequences, all load bearing:

1. **One vocabulary for every message.** Every send carries the same parameter names, so a
   template can be moved between triggers without rewriting its tags. Section 3 is that
   vocabulary and it is the contract: the relay always sends these keys, the templates only
   ever print these keys.
2. **Every key is sent on every send, always.** Not "when there is a value": always. A
   plain tag whose key the call did not pass renders as empty, which is safe, and that is
   measured rather than assumed. Sending every key anyway costs nothing and removes the
   question.
3. **The templates carry no logic whatsoever.** No `||` fallback, no conditional block, no
   expression. A tag is a plain `{%= $Current.key %}` and nothing else. **The engine does
   evaluate logic**, so this is not a limitation being worked around: it is that an
   expression referring to a key the call did not pass prints **its own source code into the
   delivered message**, where the same missing key in a plain tag would have printed
   nothing. Section 6 has the measurements. So every default, every fallback and every
   sentence that would otherwise need an `if` is composed **in the relay**, where it is
   ordinary code that can be unit tested offline and fixed without touching the panel. The
   greeting arrives already reading `Hello Ana` or `Hello`, and the template prints
   `{%= $Current.greeting %}`.

**Numbers arrive bare.** A price passes as `299.99` and prints as `299.99`, so the currency
goes in the template immediately before the tag, or in a parameter of its own. Never inside
the number.

**Anything that would need a conditional arrives pre-composed.** A struck through was-price
exists on some products and not others, and a template cannot ask. So the relay sends
`price_line`, already reading either `R$ 299.99` or `R$ 299.99, was R$ 379.99`, and the
template prints one tag. The same goes for `basket_line`. This is not a workaround, it is the
better place for that decision: one implementation, covered by tests, rather than logic
duplicated across eight templates in a panel nobody reviews.

---

## 2. Where the send is made from, and why not from the page

The storefront never calls Dengage. A transactional send is an authenticated call, this
repository is public, and a demo is a static site: a key in the page is a key anyone can
read and send with. So the browser calls a relay of ours, and the relay holds the
credentials.

The relay is the Supabase database that already runs the product sync. It is the only
address of ours the Dengage API accepts, its vault already holds the credentials, and the
same function pattern is already proven there twice over.

```
the storefront detects the intent
     ->  one call to the relay: contact key, demo slug, intent name, product context
          ->  the relay validates against allowlists, reads the vault, sends
               ->  transactional email, transactional push, both logged
```

**What the relay refuses, by design.** It addresses a contact only by a `DPS-` contact key,
never by an email address the caller supplies, so the worst a stranger can do with the
endpoint is message a demo contact. Intent names and template ids come from a server side
allowlist rather than from the request. Sends are rate limited per contact and per day, and
every attempt is recorded with the answer the API gave.

**The recommendation parameters are computed in the relay**, from the same catalogue the
storefront ranks, so the rail in the email is provably the rail the visitor saw. This is
also the only way to personalise a transactional message with products: a `$from()` lookup
keyed on a contact column cannot resolve in this lane.

---

## 3. The parameter vocabulary

Every send carries these. A trigger that has no value for one sends it empty rather than
omitting it, so a template never meets a missing key.

| Parameter | Example | Always sent |
|---|---|---|
| `greeting` | `Hello Ana`, or `Hello` for a visitor with no name | yes, already composed |
| `first_name` | `Ana`, empty for an anonymous visitor | yes |
| `store_name` | `Di Santinni` | yes |
| `currency` | `R$` | yes |
| `home_url` | the demo's own address | yes |
| `product_name` | `Tenis Feminino Raiden Asics Azul` | yes, empty when no product is in context |
| `product_price` | `299.99` | yes |
| `price_line` | `R$ 299.99`, or `R$ 299.99, was R$ 379.99` on a real reduction | yes, already composed |
| `product_image` | an https address on our origin | yes |
| `product_url` | that product's page on this demo | yes |
| `product_category` | `Tenis` | yes |
| `item_count` | `3` | yes |
| `basket_total` | `898.97` | yes |
| `basket_line` | `3 items, R$ 898.97` | yes, already composed |
| `basket_summary` | `Barbie Dourada and 1 more item`, or the product alone when it is the only one | yes, already composed |
| `basket_url` | the demo's cart, opened | yes |
| `search_term` | `sandalia dourada` | yes |
| `order_id` | `DPS-10041` | yes |
| `order_total` | `898.97` | yes |
| `reco_1_name` … `reco_3_name` | | yes, always three |
| `reco_1_price` … `reco_3_price` | | yes |
| `reco_1_image` … `reco_3_image` | | yes |
| `reco_1_url` … `reco_3_url` | | yes |

**Always three recommendations, never two.** A template cannot hide a card it has no product
for, so the relay guarantees three by falling through the same ladder the storefront uses,
ending at trending, which always fills for a catalogue of this size. It fills with real
products or it does not send the message at all: a duplicated card to pad a row would be a
fabrication of a different kind.

**Nothing in this table is invented.** Every value is read from the demo's own committed
catalogue or from what the visitor actually did, which is the same rule the rest of the
factory follows: a price that was never scraped is never printed.

---

## 4. The use cases

Eight triggers, ordered by how well each one demonstrates the platform on a call. Each names
the channel, when it fires, and why it earns a message. The copy is in section 5.

| | Trigger | Channel | Fires when |
|---|---|---|---|
| 1 | **Exit intent, basket has items** | push + email | the pointer leaves toward the browser chrome, or the tab is hidden, with items in the basket |
| 2 | **Exit intent, product page, empty basket** | push | the same gesture on a product page with nothing in the basket |
| 3 | **Checkout started, abandoned in session** | push + email | checkout was opened and no order followed within the dwell window |
| 4 | **Order placed** | email + push | an order is completed. The most legitimate transactional message there is |
| 5 | **Account created** | email | the subscription card or the account modal creates a contact |
| 6 | **Wishlist save** | push | a product is saved, and the saved set is not empty |
| 7 | **Search returned nothing** | push | a search resolved zero products |
| 8 | **Deep product interest** | push | one product held on screen past the dwell window with no add to cart |

**Why some of these are push only.** An email for every gesture is how a demo account gets
its sending reputation ruined and how a prospect concludes the platform is noisy. Push is
instant, dismissible and free; email is reserved for the moments that carry real intent: a
basket, a checkout, an order, an account.

**What is deliberately absent.** Back in stock and price drop are the two obvious misses,
and both need a stock or price history this factory does not have. Inventing either would
print a number no scrape produced, which is the one rule this repository never bends. When a
demo carries real stock counts, back in stock becomes a ninth trigger with no new plumbing.

---

## 5. The exact content, with every parameter in place

Paste these into the panel as they stand. Each push needs **Transactional content** ticked,
each email is a transactional template, and the tags are already written the way the relay
sends them.

**No tag below carries any logic**, because a tag the engine cannot resolve prints its own
source code into the delivered message. Every greeting, every default and every sentence
that varies arrives already composed by the relay.

### 1. Exit intent, basket has items

**Push**

```
Title    Leaving already?
Message  {%= $Current.basket_summary %}, still waiting at {%= $Current.store_name %}.
Image    {%= $Current.product_image %}
Target   {%= $Current.basket_url %}
```

**Email**

```
Subject    Your basket at {%= $Current.store_name %} is still here
Preheader  {%= $Current.basket_summary %}, waiting for you.
```

Body, with the preheader in a hidden span because **the panel's Preheader field does not
resolve tags**:

```html
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{%= $Current.basket_summary %}, waiting for you.</span>
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>

<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141414">
  <div style="padding:18px 0;border-bottom:1px solid #eee">
    <img src="THE DEMO'S OWN LOGO, see the note below" width="180" alt="{%= $Current.store_name %}">
  </div>

  <h1 style="font-size:24px;margin:26px 0 8px">Still thinking it over?</h1>
  <p style="font-size:15px;line-height:1.6">{%= $Current.greeting %}, everything you added at {%= $Current.store_name %} is saved.</p>

  <table cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0"><tr>
    <td width="140" valign="top">
      <img src="{%= $Current.product_image %}" width="140" style="border-radius:8px;display:block" alt="{%= $Current.product_name %}">
    </td>
    <td valign="top" style="padding-left:16px">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.5">{%= $Current.product_category %}</div>
      <div style="font-size:15px;font-weight:bold;line-height:1.35;padding:6px 0">{%= $Current.product_name %}</div>
      <div style="font-size:15px">{%= $Current.price_line %}</div>
      <div style="padding-top:12px">
        <a href="{%= $Current.product_url %}" style="display:inline-block;white-space:nowrap;font-size:12px;text-transform:uppercase;border:1px solid #141414;color:#141414;text-decoration:none;padding:9px 14px;border-radius:4px">View item</a>
      </div>
    </td>
  </tr></table>

  <div style="border:1px solid #eee;border-radius:8px;padding:18px;text-align:center">
    <div style="font-size:16px;font-weight:bold">Your cart is waiting</div>
    <div style="font-size:14px;padding:6px 0 14px">{%= $Current.basket_line %}</div>
    <a href="{%= $Current.basket_url %}" style="display:inline-block;white-space:nowrap;background:#141414;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:8px">Go to cart</a>
  </div>

  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.5;padding:34px 0 6px;text-align:center">More like this</div>
  <div style="font-size:19px;font-weight:bold;text-align:center;padding-bottom:18px">You might also like</div>

  <table cellpadding="0" cellspacing="0" width="100%"><tr>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_1_url %}"><img src="{%= $Current.reco_1_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_1_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_1_price %}</div>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_2_url %}"><img src="{%= $Current.reco_2_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_2_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_2_price %}</div>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_3_url %}"><img src="{%= $Current.reco_3_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_3_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_3_price %}</div>
    </td>
  </tr></table>

  <p style="font-size:12px;opacity:.6;padding-top:28px;border-top:1px solid #eee;margin-top:28px">Prices and availability can change, and a basket is not a reservation.</p>
  <p style="font-size:12px;opacity:.6">A demonstration storefront built for a sales conversation.</p>
</div>
```

**This exact body was sent and read on a phone**, which is the only way the three notes
below were found. They are the difference between a body that looks right in a panel preview
and one that looks right in a hand.

| | |
|---|---|
| **Every button carries `white-space:nowrap`** | the first version let `View item` wrap inside its own border, so the text sat outside the box on a 360px screen. A panel preview at desktop width never shows this |
| **The product image is 140px, not 200px** | a 200px image beside text in a 600px email leaves about 140px for the text column on a phone, which wraps a product name to five lines and squeezes the button |
| **The recommendation images are `width="100%"` with `max-width:150px`** | fixed widths in a three column row overflow the screen instead of shrinking |

**The logo line is the one thing to change per demo.** Point it at that demo's own committed
logo where the exception in CLAUDE.md 3.3 applies, and at the Dengage mark otherwise. It is a
literal address rather than a parameter because a template belongs to a demo, and a wrong
logo is worse than a missing one.

**Those three recommendation cards are the same products the storefront showed**, because
the relay computes them from the same catalogue with the same ranking. That is the claim this
whole design exists to make, and it is checkable rather than asserted.

### 2. Exit intent, product page, empty basket

**Push**

```
Title    {%= $Current.product_name %}
Message  Still on your mind? It is {%= $Current.price_line %} at {%= $Current.store_name %}.
Image    {%= $Current.product_image %}
Target   {%= $Current.product_url %}
```

### 3. Checkout started, abandoned in session

**Push**

```
Title    You were one step away
Message  {%= $Current.basket_line %}. Finish when you are ready.
Image    {%= $Current.product_image %}
Target   {%= $Current.basket_url %}
```

**Email**

```
Subject    One step from done at {%= $Current.store_name %}
Preheader  {%= $Current.basket_line %}, ready when you are.
```

```html
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{%= $Current.basket_line %}, ready when you are.</span>
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>

<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141414">
  <div style="padding:18px 0;border-bottom:1px solid #eee">
    <img src="THE DEMO'S OWN LOGO" width="180" alt="{%= $Current.store_name %}">
  </div>

  <h1 style="font-size:24px;margin:26px 0 8px">You were one step away</h1>
  <p style="font-size:15px;line-height:1.6">{%= $Current.greeting %}, your order at {%= $Current.store_name %} is not finished yet.</p>

  <table cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0"><tr>
    <td width="140" valign="top">
      <img src="{%= $Current.product_image %}" width="140" style="border-radius:8px;display:block" alt="{%= $Current.product_name %}">
    </td>
    <td valign="top" style="padding-left:16px">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.5">{%= $Current.product_category %}</div>
      <div style="font-size:15px;font-weight:bold;line-height:1.35;padding:6px 0">{%= $Current.product_name %}</div>
      <div style="font-size:15px">{%= $Current.price_line %}</div>
    </td>
  </tr></table>

  <div style="border:1px solid #eee;border-radius:8px;padding:18px;text-align:center">
    <div style="font-size:16px;font-weight:bold">{%= $Current.basket_line %}</div>
    <div style="padding:14px 0 10px">
      <a href="{%= $Current.basket_url %}" style="display:inline-block;white-space:nowrap;background:#141414;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:8px">Finish checkout</a>
    </div>
    <a href="{%= $Current.basket_url %}" style="font-size:13px;color:#5a6375">or look at your basket first</a>
  </div>

  <p style="font-size:12px;opacity:.6;padding-top:28px;border-top:1px solid #eee;margin-top:28px">Nothing has been charged, and a basket is not a reservation.</p>
  <p style="font-size:12px;opacity:.6">A demonstration storefront built for a sales conversation.</p>
</div>
```

**No recommendation rail here, deliberately.** At this point the only useful action is
finishing, and a row of other products is an invitation to browse away from it.

### 4. Order placed

**Email**

```
Subject    Order {%= $Current.order_id %} confirmed
Preheader  Thank you. {%= $Current.item_count %} items on the way.
```

```html
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Order {%= $Current.order_id %}, {%= $Current.basket_line %}.</span>
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>

<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141414">
  <div style="padding:18px 0;border-bottom:1px solid #eee">
    <img src="THE DEMO'S OWN LOGO" width="180" alt="{%= $Current.store_name %}">
  </div>

  <h1 style="font-size:24px;margin:26px 0 8px">{%= $Current.greeting %}, thank you</h1>
  <p style="font-size:15px;line-height:1.6">Order <b>{%= $Current.order_id %}</b> at {%= $Current.store_name %} is confirmed.</p>

  <div style="border:1px solid #eee;border-radius:8px;padding:18px">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="font-size:14px;padding:0 0 6px">Order</td>
          <td align="right" style="font-size:14px;padding:0 0 6px">{%= $Current.order_id %}</td></tr>
      <tr><td style="font-size:14px;padding:0 0 6px">Items</td>
          <td align="right" style="font-size:14px;padding:0 0 6px">{%= $Current.item_count %}</td></tr>
      <tr><td style="font-size:16px;font-weight:bold;padding:10px 0 0;border-top:1px solid #eee">Total</td>
          <td align="right" style="font-size:16px;font-weight:bold;padding:10px 0 0;border-top:1px solid #eee">{%= $Current.currency %} {%= $Current.order_total %}</td></tr>
    </table>
  </div>

  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.5;padding:34px 0 6px;text-align:center">More like this</div>
  <div style="font-size:19px;font-weight:bold;text-align:center;padding-bottom:18px">You might also like</div>
  <table cellpadding="0" cellspacing="0" width="100%"><tr>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_1_url %}"><img src="{%= $Current.reco_1_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_1_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_1_price %}</div>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_2_url %}"><img src="{%= $Current.reco_2_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_2_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_2_price %}</div>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_3_url %}"><img src="{%= $Current.reco_3_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_3_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_3_price %}</div>
    </td>
  </tr></table>

  <p style="font-size:12px;opacity:.6;padding-top:28px;border-top:1px solid #eee;margin-top:28px">A confirmation of a demonstration order. Nothing has been charged and nothing will ship.</p>
  <p style="font-size:12px;opacity:.6">A demonstration storefront built for a sales conversation.</p>
</div>
```

**Push**

```
Title    Order {%= $Current.order_id %} confirmed
Message  Thank you. {%= $Current.item_count %} items, {%= $Current.currency %} {%= $Current.order_total %}.
Target   {%= $Current.home_url %}
```

### 5. Account created

**Email**

```
Subject    Welcome to {%= $Current.store_name %}
Preheader  Your account is ready.
```

```html
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your account at {%= $Current.store_name %} is ready.</span>
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>

<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141414">
  <div style="padding:18px 0;border-bottom:1px solid #eee">
    <img src="THE DEMO'S OWN LOGO" width="180" alt="{%= $Current.store_name %}">
  </div>

  <h1 style="font-size:24px;margin:26px 0 8px">{%= $Current.greeting %}, welcome to {%= $Current.store_name %}</h1>
  <p style="font-size:15px;line-height:1.6">Your account is ready, and your basket now follows you between visits and devices.</p>

  <div style="padding:6px 0 4px">
    <a href="{%= $Current.home_url %}" style="display:inline-block;white-space:nowrap;background:#141414;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:8px">Start shopping</a>
  </div>

  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.5;padding:34px 0 6px;text-align:center">Trending now</div>
  <div style="font-size:19px;font-weight:bold;text-align:center;padding-bottom:18px">Popular across the store</div>
  <table cellpadding="0" cellspacing="0" width="100%"><tr>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_1_url %}"><img src="{%= $Current.reco_1_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_1_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_1_price %}</div>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_2_url %}"><img src="{%= $Current.reco_2_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_2_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_2_price %}</div>
    </td>
    <td width="33%" align="center" valign="top" style="padding:0 5px">
      <a href="{%= $Current.reco_3_url %}"><img src="{%= $Current.reco_3_image %}" width="100%" style="max-width:150px;border-radius:8px;display:block;margin:0 auto" alt=""></a>
      <div style="font-size:12px;font-weight:bold;line-height:1.35;padding:8px 0 3px">{%= $Current.reco_3_name %}</div>
      <div style="font-size:12px">{%= $Current.currency %} {%= $Current.reco_3_price %}</div>
    </td>
  </tr></table>

  <p style="font-size:12px;opacity:.6;padding-top:28px;border-top:1px solid #eee;margin-top:28px">Prices and availability can change.</p>
  <p style="font-size:12px;opacity:.6">A demonstration storefront built for a sales conversation.</p>
</div>
```

### 6. Wishlist save

**Push**

```
Title    Saved for later
Message  {%= $Current.product_name %} is in your saved items at {%= $Current.store_name %}.
Image    {%= $Current.product_image %}
Target   {%= $Current.product_url %}
```

### 7. Search returned nothing

**Push**

```
Title    Nothing for "{%= $Current.search_term %}"
Message  Try {%= $Current.reco_1_name %} instead, at {%= $Current.currency %} {%= $Current.reco_1_price %}.
Image    {%= $Current.reco_1_image %}
Target   {%= $Current.reco_1_url %}
```

### 8. Deep product interest

**Push**

```
Title    Taking a closer look?
Message  {%= $Current.product_name %} at {%= $Current.price_line %}. Yours in two taps.
Image    {%= $Current.product_image %}
Target   {%= $Current.product_url %}
```

---

## 6. What was verified, and the one trap

Verified against the live account, twice, on 18 September 2026.

| Step | Result |
|---|---|
| Login from the relay's address | accepted |
| `GET /rest/email/froms` | answers, and the account holds a demo sender identity |
| `POST /rest/transactional/email`, real send | **code 0**, with a per recipient tracking id. A real message, delivered |
| Personalisation by `current` parameters | carried on that send, printed by `$Current` tags in the body |
| `POST /rest/transactional/push` | route reachable, authenticated and permitted: it answers by naming the field it wants |
| Push content resolution | proven to be the only remaining gate. See the trap below |

**THE FIRST TRAP, AND IT REACHES THE INBOX.** An expression that refers to a key the call
did not pass prints **its own source code into the delivered message**. Found by a real send
on 18 September 2026, whose body arrived in a mail client reading, in bold, exactly as a
recipient would have seen it:

```
Fallback test, this should read Hello: {%= $Current.missing_value || 'Hello' %}
```

Three values on that same send resolved perfectly, so this was never a bad token or a broken
account. A third round then isolated the mechanism, one question per line, and the engine is
more capable than the failure suggests:

| Asked | Answer |
|---|---|
| A key sent as an empty string | prints empty. Safe |
| A key never sent at all, in a plain tag | prints empty. Safe |
| An or-fallback on a key that **is** sent | evaluates, prints the value |
| A code block, `{% if (1 > 0) { %}` | **runs.** The engine does execute logic |
| A greeting composed by the relay | prints, which is the pattern this page uses |

So the hazard is narrow and specific: **logic plus a key the call did not pass**. A plain tag
in the same situation prints nothing. Since a template cannot know which keys a future
trigger will omit, the rule is the blunt one: no logic in any template, every key sent on
every send, and everything conditional composed in the relay where a test can reach it.

**THE SECOND TRAP, and it is worth the capitals too.** A transactional push send only sees
push content that was created with **Transactional content ticked**. Aimed at an ordinary
push content the account really holds, the send answers:

```
code 11   <the content id> content is null
```

which is **the same answer a content id that does not exist gives**. So a template that
exists, is spelled correctly and is simply not flagged transactional is indistinguishable
from a missing one, and the error names neither cause. If a push send reports `content is
null`, check the flag before checking anything else.

**The one thing this page cannot verify from here.** A transactional push content does not
exist in the account yet, so the final link, an accepted push carrying a real template, is
proven only up to content resolution. Creating one closes it, and a first send answers in one
of two ways, both of which are good news:

- `code 0`, accepted for delivery
- `code 11`, token not found for that contact key, which means the template and the routing
  are correct and no browser has subscribed under that key yet

**Where a sample or a test send goes.** `salil@dengage.com`, Salil's instruction on 18
September 2026. Never an address this repository invented, and never a prospect's: a made up
address either bounces or reaches a stranger, and the account is shared.

**Two preconditions that belong to the demo script rather than to the code.** The email leg
needs an identified visitor, because there is no address to send to otherwise, and the
account creation card produces one in a few seconds. The push leg needs notification
permission granted on the published origin. Both are already the first minute of a demo.
