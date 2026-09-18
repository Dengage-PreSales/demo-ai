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

<h1>Still thinking it over?</h1>
<p>{%= $Current.greeting %}, everything you added at {%= $Current.store_name %} is saved.</p>

<table><tr>
  <td><img src="{%= $Current.product_image %}" width="200" alt="{%= $Current.product_name %}"></td>
  <td>
    <div>{%= $Current.product_category %}</div>
    <div><b>{%= $Current.product_name %}</b></div>
    <div>{%= $Current.price_line %}</div>
    <a href="{%= $Current.product_url %}">View item</a>
  </td>
</tr></table>

<p>{%= $Current.basket_line %}</p>
<p><a href="{%= $Current.basket_url %}">Go to cart</a></p>

<h2>You might also like</h2>
<table><tr>
  <td><a href="{%= $Current.reco_1_url %}"><img src="{%= $Current.reco_1_image %}" width="150" alt="{%= $Current.reco_1_name %}"></a>
      <div>{%= $Current.reco_1_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_1_price %}</div></td>
  <td><a href="{%= $Current.reco_2_url %}"><img src="{%= $Current.reco_2_image %}" width="150" alt="{%= $Current.reco_2_name %}"></a>
      <div>{%= $Current.reco_2_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_2_price %}</div></td>
  <td><a href="{%= $Current.reco_3_url %}"><img src="{%= $Current.reco_3_image %}" width="150" alt="{%= $Current.reco_3_name %}"></a>
      <div>{%= $Current.reco_3_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_3_price %}</div></td>
</tr></table>

<p>Prices and availability can change, and a basket is not a reservation.</p>
<p>A demonstration storefront built for a sales conversation.</p>
```

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
<h1>You were one step away</h1>
<p>{%= $Current.greeting %}, your order at {%= $Current.store_name %} is not finished yet.</p>
<p>{%= $Current.basket_line %}</p>
<p><a href="{%= $Current.basket_url %}">Finish checkout</a></p>
<p>A demonstration storefront built for a sales conversation.</p>
```

### 4. Order placed

**Email**

```
Subject    Order {%= $Current.order_id %} confirmed
Preheader  Thank you. {%= $Current.item_count %} items on the way.
```

```html
<h1>{%= $Current.greeting %}, thank you</h1>
<p>Order <b>{%= $Current.order_id %}</b> at {%= $Current.store_name %} is confirmed.</p>
<p>{%= $Current.item_count %} items, {%= $Current.currency %} {%= $Current.order_total %}</p>
<h2>You might also like</h2>
<table><tr>
  <td><a href="{%= $Current.reco_1_url %}"><img src="{%= $Current.reco_1_image %}" width="150" alt=""></a>
      <div>{%= $Current.reco_1_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_1_price %}</div></td>
  <td><a href="{%= $Current.reco_2_url %}"><img src="{%= $Current.reco_2_image %}" width="150" alt=""></a>
      <div>{%= $Current.reco_2_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_2_price %}</div></td>
</tr></table>
<p>A demonstration storefront built for a sales conversation.</p>
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
<h1>{%= $Current.greeting %}, welcome to {%= $Current.store_name %}</h1>
<p>Your account is ready.</p>
<h2>Popular right now</h2>
<table><tr>
  <td><a href="{%= $Current.reco_1_url %}"><img src="{%= $Current.reco_1_image %}" width="150" alt=""></a>
      <div>{%= $Current.reco_1_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_1_price %}</div></td>
  <td><a href="{%= $Current.reco_2_url %}"><img src="{%= $Current.reco_2_image %}" width="150" alt=""></a>
      <div>{%= $Current.reco_2_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_2_price %}</div></td>
  <td><a href="{%= $Current.reco_3_url %}"><img src="{%= $Current.reco_3_image %}" width="150" alt=""></a>
      <div>{%= $Current.reco_3_name %}</div><div>{%= $Current.currency %} {%= $Current.reco_3_price %}</div></td>
</tr></table>
<p>A demonstration storefront built for a sales conversation.</p>
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
