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
| `logo_url` | that demo's own committed logo, or the Dengage mark | yes |
| `brand_primary` | `#141414`, read from that demo's own theme | yes |
| `brand_on_primary` | `#ffffff`, the contrast clamped partner of `brand_primary` | yes |
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
| `free_shipping_line` | `You are R$ 30.02 from free delivery`, or `Your order qualifies for free delivery` | yes, already composed |
| `stock_line` | `Only 3 left`. **Empty whenever the catalogue does not genuinely track stock** | yes |
| `coupon_code` | `DPS10`, and empty when no incentive applies | yes |
| `coupon_line` | `10 percent off with code DPS10` | yes, already composed |
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

### Twelve objects, every demo, forever

**A new demo needs no new templates and no panel work at all.** Eight push contents and four
email bodies are created once, and every demo the factory builds afterwards is served by the
same twelve, the same way one abandoned cart campaign and one set of on site creatives already
serve all of them. CLAUDE.md 0 promises a live demo in thirty minutes with no clicks in the
panel, and 3.2 says the campaign set does not grow when a demo is built. Twelve objects per
store would break both.

What makes that work is that **nothing demo specific is written into a template**. Every
value above is read at send time from the demo the visitor was actually on:

| What varies per demo | Where the relay reads it |
|---|---|
| store name, currency, addresses | that demo's `demo.config.json` and its slug |
| products, prices, categories, photographs | that demo's own committed `products.json` |
| the recommendations | the same catalogue, ranked the way that demo's storefront ranks it |
| the logo | that demo's `brandLogo` where CLAUDE.md 3.3 applies, the Dengage mark otherwise |
| the brand colour of the call to action | that demo's own extracted theme, with its clamped partner |

So a store scraped tomorrow in a different country, currency and palette sends the same
twelve messages, carrying its own products at its own prices under its own mark, with no
template touched.

### Language, which the demo now knows about itself

**Every request names a language, and the field is mandatory**, added 18 September 2026 on
Salil's direction. The form offers English, Portuguese and Russian, the build records the
answer in `demo.config.json` as `locale.language`, and the storefront ships that language's
translation of all of its own words. So a Brazilian store's demo is a Portuguese storefront
carrying Portuguese product names, rather than an English storefront with Portuguese
products in it.

**The messages follow the same value, and still without a second set of twelve.** Both
endpoints take multiple languages inside one content object, so each trigger stays one
object:

| | |
|---|---|
| A push content | `contentDetail.defaultLanguage` plus one entry per language in `contentDetail.contents`, each with its own title and message |
| A transactional push send | `language`, which picks the entry. The relay passes `locale.language` from the demo the visitor was on |
| An email template, or inline content | `multiLangContent`, with `defaultLanguage` and a `contents` array. **It cannot be combined with `content`**, so a body is one or the other |
| An email send | `send.toLanguage` for the recipient |

So the set stays fifteen push contents and eight email bodies, each holding three languages,
and a demo picks its column at send time. A language the content does not carry falls back to
`defaultLanguage`, which is why English is always present.

**The number is not translated with the words**, and that is deliberate. `numberLocale`
follows the currency rather than the language, because a Brazilian store priced in BRL writes
`R$ 1.234,56` whether its demo is being shown in Portuguese or in English, and the figure on
the page has to match the figure on the prospect's own site.

**Adding a fourth language is a piece of work rather than a line.** It means a committed
translation of every string in `template/copy.json`, 104 of them, and a fourth column in
fifteen push contents and eight email bodies. `factory/copy.test.mjs` is what keeps the three
honest: it refuses a build where a key is missing from a translation, where a translation
invented or dropped a `{n}`, `{q}` or `{prefix}`, or where a file was copied and never
translated at all. It was proven by breaking a translation three ways and watching it name
each fault.

---

## 4. The use cases

**Fifteen triggers in two groups.** The first eight are the moments a demo has to be able to
show. The next seven are the ones that move revenue, and they are the reason this page exists
rather than a lifecycle checklist. Each names its channel, when it fires and what it needs.
The copy is in section 5.

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

**Those eight are the moments. These seven are the conversion levers**, added 18 September
2026 after Salil's point that account created and order placed are hygiene rather than
revenue. In a real deployment every one of these is a marketing journey with waits and
frequency caps. We fire them transactionally so a prospect sees the moment land on a call,
and the pre-sales person should say so out loud: **in production this is a journey with a one
hour wait, and we are firing it instantly so you can watch it arrive.** That sentence is the
difference between a demonstration and a misrepresentation.

| | Trigger | Channel | Fires when | Needs |
|---|---|---|---|---|
| 9 | **Free delivery gap** | push + email | the basket is below the demo's delivery threshold | a threshold in `demo.config.json`, shown in the storefront's own cart |
| 10 | **Something you wanted is on sale** | push + email | a viewed or saved product genuinely carries a reduced price | a real `discountedPrice`. Ten of Di Santinni's thirty have one |
| 11 | **Only a few left** | push | a carted or viewed product's real stock count is low | a real `stockCount`. Twelve of the showcase's fifteen have one |
| 12 | **Category browse abandonment** | push + email | three or more products viewed in one category with nothing carted | nothing |
| 13 | **Complete the look** | push | a product is added to the cart | nothing |
| 14 | **A friendlier price** | push | a premium product viewed twice, not carted, with a cheaper sibling on the same shelf | nothing |
| 15 | **Exit intent with an incentive** | push + email | exit intent on a basket above a value the store cares about | **a decision from you.** See the note under 15 |

**Why these convert and the first eight mostly confirm.** Nine raises basket value, which is
the only lever here that grows an order rather than rescuing it. Ten and eleven are the two
highest performing messages in retail because both are true facts about the thing the person
already wanted, rather than a reminder that they wanted it. Twelve reads intent at the shelf
rather than the item, which is where a shopper who has not decided yet actually is. Thirteen
catches the one moment engagement is already at its peak. Fourteen answers the commonest
silent objection, price, without discounting anything.

**What is deliberately refused, and it is the fashionable half of this list.** No "twelve
people bought this today", no "three others are viewing this now", no countdown timer, and no
stock number the scrape did not produce. Every one of those is a number nobody measured, they
are the first thing a sharp prospect tests, and CLAUDE.md 3.5 forbids them. Scarcity in this
set is only ever a real count from a real catalogue, which is why trigger eleven simply does
not fire for a store whose stock we could not read.

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

**What the panel actually needs, corrected on 18 September 2026 after the first pair of
content ids was tested.** Section 6.1 has the measurement: the call can supply the subject
and the whole HTML body, so a content created in the panel and left completely empty works.
The only thing the panel has to carry is **Transactional content, ticked**, and its own id.

So there are two ways to run each message and they can be mixed per trigger:

| | Where the copy lives | What the panel needs |
|---|---|---|
| **The call supplies it** | in this repository, next to the relay, under review | an empty content with the flag ticked |
| **The panel supplies it** | in the content, editable by anyone on the team | the body pasted in, plus a subject, plus a From identity |

The second way is better for anything a non-developer should be able to change mid quarter.
The first is better for everything else, and it means fourteen more contents is fourteen
clicks rather than fourteen paste-and-check rounds.

**One panel step has no alternative: the From identity.** It is not a request field, so a
send against an empty content arrives from the account default. Set it on the content to
**Dengage Team, `dps.demo@e.dengage.com`**.

### The content ids, as they are created

| Trigger | Email content | Push content | State |
|---|---|---|---|
| 1. Exit intent, basket has items | `2c20bf23-7870-44ff-ac2d-17bffd0e1399` | `d8a320fd-133e-4fbc-b1b4-b4b126c2acfd` | email sent and read, push resolves and waits for a subscribed device. Both flagged transactional. From identity not set yet |

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
    <img src="{%= $Current.logo_url %}" width="180" alt="{%= $Current.store_name %}">
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
    <a href="{%= $Current.basket_url %}" style="display:inline-block;white-space:nowrap;background:{%= $Current.brand_primary %};color:{%= $Current.brand_on_primary %};text-decoration:none;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:8px">Go to cart</a>
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

**Nothing in this body names a demo**, which is what lets one template serve all of them.
The logo arrives as `logo_url`, the filled button takes the demo's own `brand_primary` with
its contrast clamped `brand_on_primary`, and a tag inside a `style` attribute resolves the
same way one inside text does: the engine substitutes before any mail client parses the
markup, which the saved recommendation asset in this repository has relied on for weeks.

**The outlined button stays near black on purpose.** A brand colour is safe as a button
background against its clamped partner, which is the pair `demo.config.json` already holds,
and it is not safe as text on white: a store whose primary is a pale yellow would render an
unreadable link. So each message carries one brand coloured call to action and keeps
everything else neutral.

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
    <img src="{%= $Current.logo_url %}" width="180" alt="{%= $Current.store_name %}">
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
      <a href="{%= $Current.basket_url %}" style="display:inline-block;white-space:nowrap;background:{%= $Current.brand_primary %};color:{%= $Current.brand_on_primary %};text-decoration:none;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:8px">Finish checkout</a>
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
    <img src="{%= $Current.logo_url %}" width="180" alt="{%= $Current.store_name %}">
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
    <img src="{%= $Current.logo_url %}" width="180" alt="{%= $Current.store_name %}">
  </div>

  <h1 style="font-size:24px;margin:26px 0 8px">{%= $Current.greeting %}, welcome to {%= $Current.store_name %}</h1>
  <p style="font-size:15px;line-height:1.6">Your account is ready, and your basket now follows you between visits and devices.</p>

  <div style="padding:6px 0 4px">
    <a href="{%= $Current.home_url %}" style="display:inline-block;white-space:nowrap;background:{%= $Current.brand_primary %};color:{%= $Current.brand_on_primary %};text-decoration:none;font-size:15px;font-weight:bold;padding:14px 30px;border-radius:8px">Start shopping</a>
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

### 9. Free delivery gap

**Push**

```
Title    Almost there
Message  {%= $Current.free_shipping_line %}. Add one more thing and delivery is on us.
Image    {%= $Current.product_image %}
Target   {%= $Current.basket_url %}
```

**Email**: the frame below, with `Your basket, and one step to free delivery` as the subject,
`{%= $Current.free_shipping_line %}` as the hero line under the heading, and the three
recommendations introduced as **Add one of these** rather than You might also like. The rail
is doing real work in this message rather than decorating it, because the recipient needs a
reason to add and these are the products the relay ranked for them.

**This one needs a threshold, and the storefront has to agree with it.** A delivery threshold
is the store's own policy rather than a scraped fact, so it is set once per demo in
`demo.config.json` and the storefront's cart prints the same sentence from the same number.
An email promising free delivery over a figure the cart does not recognise is the single most
embarrassing failure available on a call.

### 10. Something you wanted is on sale

**Push**

```
Title    Now {%= $Current.price_line %}
Message  {%= $Current.product_name %}, the one you were looking at, has come down.
Image    {%= $Current.product_image %}
Target   {%= $Current.product_url %}
```

**Email**: subject `{%= $Current.product_name %} is on sale`, hero line
`The one you saved has come down to {%= $Current.price_line %}.`

**It says on sale, never price dropped.** The catalogue holds a real reduced price beside a
real full price, which is a fact. It holds no history, so nothing here knows the price changed
after the visit, and claiming it did would be inventing the interesting part. `price_line`
already carries both figures in the shape a shopper expects.

### 11. Only a few left

**Push**

```
Title    {%= $Current.stock_line %}
Message  {%= $Current.product_name %} at {%= $Current.price_line %}, still in your basket.
Image    {%= $Current.product_image %}
Target   {%= $Current.basket_url %}
```

**This trigger does not fire at all unless the count is real.** `stock_line` is empty for
every store whose stock the scrape could not read, and an empty title is not a message, so
the relay refuses to send rather than reaching for a number. For a demo on a catalogue with
real counts it is the strongest message in this document.

### 12. Category browse abandonment

**Push**

```
Title    Still looking at {%= $Current.product_category %}?
Message  {%= $Current.reco_1_name %} from {%= $Current.currency %} {%= $Current.reco_1_price %}, and two more picked for you.
Image    {%= $Current.reco_1_image %}
Target   {%= $Current.reco_1_url %}
```

**Email**: subject `Still looking at {%= $Current.product_category %}?`, hero line
`You have been through a few. Here are the three worth a second look.`, and the rail
introduced as **Picked from {%= $Current.product_category %}**.

**Why the shelf beats the item.** A visitor who looked at one product may have been passing.
A visitor who looked at three in one category is shopping and has not decided, which is the
one moment a suggestion is genuinely useful rather than a reminder.

### 13. Complete the look

**Push**

```
Title    Goes with that
Message  {%= $Current.reco_1_name %} at {%= $Current.currency %} {%= $Current.reco_1_price %}, chosen for what you just added.
Image    {%= $Current.reco_1_image %}
Target   {%= $Current.reco_1_url %}
```

Fires at the add to cart, which is the peak of engagement in any session, and the relay fills
the rail from the categories the basket does **not** already cover, so it suggests an addition
rather than a duplicate of what was just chosen.

### 14. A friendlier price

**Push**

```
Title    A friendlier price
Message  {%= $Current.reco_1_name %} at {%= $Current.currency %} {%= $Current.reco_1_price %}, on the same shelf as the one you were viewing.
Image    {%= $Current.reco_1_image %}
Target   {%= $Current.reco_1_url %}
```

The mirror image of Step up, and the one that answers the objection nobody types. The relay
puts the cheaper sibling in the first recommendation slot, so no new parameter is needed, and
it fires only when a genuinely cheaper product exists on the same shelf.

### 15. Exit intent with an incentive

**Push**

```
Title    Before you go
Message  {%= $Current.coupon_line %}, on the {%= $Current.basket_line %} in your basket.
Image    {%= $Current.product_image %}
Target   {%= $Current.basket_url %}
```

**Email**: subject `{%= $Current.coupon_line %}`, hero line
`{%= $Current.greeting %}, here is {%= $Current.coupon_line %} on everything in your basket.`
with the code shown large above the Go to cart button.

**THIS ONE NEEDS A DECISION FROM YOU, and it is the strongest message here.** An incentive at
exit is the highest converting message in this whole document, and it is also the only one
that promises something the storefront must honour. A code in an email that the checkout does
not recognise is worse than no email, so there are two honest ways to ship it and they are
yours to choose:

| | |
|---|---|
| **The storefront honours the code** | I build the demo checkout to accept a code from that demo's config and take the amount off. The prospect gets the email, pastes the code, and watches the total drop on screen. It is a real end to end story and the best thing on this list |
| **The code is shown and not used** | no storefront work, and a message that reads exactly right, but a code nobody should type. Fine for a screenshot, weak on a live call |

Dengage also has its own coupon management, which issues a unique code per recipient rather
than one shared code, and that is the right answer for a real deployment. Whether this
account has it enabled is worth a question to support before we build either version.

---

## 6. The exact request, what was verified, and the traps

### 6.1 The request bodies, field by field

**Read out of the API rather than out of a manual.** Every field below was found by posting
a deliberately wrong shape and reading which field the API named, which is the only
description of this lane that exists: the published documentation does not carry it. A field
the API silently ignores is recorded as ignored, because a parameter that looks accepted and
does nothing is the expensive kind of wrong.

```
POST /rest/transactional/email

{
  "content": {
    "contentId": "<the content's publicId>",
    "subject":   "Your basket at Di Santinni is still here",
    "html":      "<the whole body, with {%= $Current.key %} tags>"
  },
  "current": { "greeting": "Hello Ana", "basket_line": "2 items, R$ 441.98", ... },
  "send":    { "to": "someone@example.com" }
}
```

| Field | What it is |
|---|---|
| `content.contentId` | required. The content's `publicId`, and it must be flagged transactional |
| `content.subject` | **supplied by the call, and it overrides the panel.** Without it the API refuses the send with `Subject cannot be empty` when the content has none |
| `content.html` | **supplied by the call.** Without it, and with an empty content, the API refuses with `Html content must be filled` |
| `current` | **top level, not inside `content`.** Put it under `content` and it is silently ignored, which is the worst of the three places it could go. `current` at the top level with a bad shape answers `Not a valid Current data`, which is how its position was found |
| `send.to` | a single address as a **string**. An array answers with a deserialiser error naming `send.to`, and an empty `send` answers `Send can not be null` |

**THE SUBJECT AND THE BODY CAN COME FROM HERE, AND THAT CHANGES THE PANEL WORK.** A content
created in the panel and left completely empty still works, as long as **Transactional
content is ticked**: the call supplies the subject and the whole HTML. So the templates in
section 4 do not have to be pasted into the panel at all. They live in this repository, under
review, with the relay that composes their parameters, and the panel holds one empty shell
per trigger whose only job is to carry the transactional flag and its own id.

Pasting them into the panel still works and is the right choice for anything a
non-developer should be able to edit mid quarter. The two are not exclusive: a subject or a
body on the call simply wins.

**THE SENDER IS NOT A REQUEST FIELD.** `senderId`, `emailFromId`, `send.from` and
`send.fromId` were each posted and each silently ignored, so the From address is whatever
the content or the account default carries. A send against an empty content therefore
arrives from the account default, which on this account reads `Dengage <hello@e.dengage.com>`
rather than the demo identity. `GET /rest/email/froms` lists the account's identities and
the demo one is **Dengage Team, `dps.demo@e.dengage.com`**. Setting it is a panel step on
the content, once per content, and there is nothing this side can do about it.

```
POST /rest/transactional/push

{
  "contentId":  "<the content's id, FLAT, not nested under content>",
  "contactKey": "DPS-1041",
  "current":    { "store_name": "Di Santinni", ... }
}
```

| Field | What it is |
|---|---|
| `contentId` | required, and **top level**. Nested under `content` it answers `ContentId can not be empty` |
| `contactKey` | or `token` with `appId`. Neither answers `Either contactKey or token must be provided` |
| `current` | top level, as for email |
| `appId` | accepted and makes no difference when `contactKey` is given |

### 6.2 What was verified

Verified against the live account on 18 September 2026, over four rounds.

| Step | Result |
|---|---|
| Login from the relay's address | accepted |
| `GET /rest/email/froms` | answers, and the account holds a demo sender identity |
| `POST /rest/transactional/email`, real send | **code 0**, with a per recipient tracking id. A real message, delivered and read |
| Personalisation by `current` parameters | carried on that send, printed by `$Current` tags in the body |
| Subject and body supplied by the call | **accepted**, against a content record that is completely empty |
| `GET /rest/contents/email`, `GET /rest/contents/push` | both list the account's contents with their transactional flag, which is the only way to check the flag without a send |
| `POST /rest/transactional/push` | content **resolves**: it answers `Token not found with given ContactKey`, which is the good answer. The template and the routing are correct |
| A device token bound to a contact key | **not reachable from here.** See 6.4 |

### 6.3 THE DUPLICATE SEND TRAP, AND IT IS OURS RATHER THAN DENGAGE'S

A verification send arrived **four times**. Nothing retried and Dengage did nothing wrong:
the send was written as

```sql
select (extensions.http(...)).* from token
```

and expanding a composite returning function with `.*` **in a select list calls it once per
column of the composite**. `http_response` has four columns, so the POST was made four
times, four sends were accepted, and four identical messages were delivered. Called in the
FROM clause instead it runs exactly once per row:

```sql
select r.status, r.content from token t,
  extensions.http((...)::extensions.http_request) r
```

The catalogue refresh function had always used the safe form, `select * into v_login from
extensions.http(...)`, which is why this had never been seen before. **Anything that sends
uses the FROM clause form**, and a send that is written the other way is a defect whose
symptom is a number of duplicates equal to the number of columns being expanded, which is a
very hard thing to guess at from an inbox.

### 6.4 The one thing this page cannot verify from here

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

**A device token bound to a contact key.** The push content now exists and is flagged, so
content resolution is proven and what is left is one browser that has subscribed under a
`DPS-` key. That cannot be produced from this container, and the reason is worth writing
down because two rounds were spent on it:

| Attempt | What happened |
|---|---|
| An ordinary automated browser context | Chromium refuses the Push API in incognito, and every ordinary automated context is incognito. The SDK throws inside its own subscribe path |
| A persistent browser profile, which is not incognito | the Push API works and the browser really does subscribe: a genuine FCM endpoint is created. The SDK still throws before it registers that token against the contact key, so Dengage never learns of it |

So the last link is closed by a person at a keyboard, in about twenty seconds, and the
contact key is set by the URL rather than by signing in:

```
https://dengage-presales.github.io/demo-ai/demos/<slug>/?ck=DPS-777001
```

Open that, press **Dengage scenarios**, press **Web push**, allow the browser's prompt. The
token is then bound to `DPS-777001` and a transactional push to that key answers `code 0`.

**Where a sample or a test send goes.** `salil@dengage.com`, Salil's instruction on 18
September 2026. Never an address this repository invented, and never a prospect's: a made up
address either bounces or reaches a stranger, and the account is shared.

**Two preconditions that belong to the demo script rather than to the code.** The email leg
needs an identified visitor, because there is no address to send to otherwise, and the
account creation card produces one in a few seconds. The push leg needs notification
permission granted on the published origin. Both are already the first minute of a demo.
