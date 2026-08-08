# What Dengage offers, and where this demo stands against it

**Built from evidence, not memory.** Every row below was checked on 6 August 2026
against three sources rather than recollection:

- the Web SDK bundle in the browser, 2.5.0, for the client side surface
- the platform API reference, 116 endpoints, for the server side surface
- this repository, for what is actually built

Read it as four questions: what works, what is deliberately switched off, what is
blocked and by what, and what has never been touched at all.

---

## 1. Working now

| Capability | Where |
|---|---|
| On-site messaging: popups, banners, slide in, exit intent, scroll depth | 19 creatives in `factory/creatives/`, 17 campaigns live |
| A/B testing, 3 variants plus control in one campaign | `factory/creatives/ab-testing/` |
| Gamification: spin to win, scratch card, countdown to win | `factory/creatives/gamification/` |
| Inline content, 5 slots rendered into the page rather than over it | `factory/creatives/inline/` |
| Dengage no-code templates: Story, Video Popup, Vertical Popup | `NATIVE-TEMPLATES.md` |
| Web push: subscribe from the page, service worker at the origin root | launcher card |
| App Inbox, reading the messages Dengage holds for the device | `template/js/inbox.js` |
| The six standard ecommerce tables, via the SDK's own `ec:*` calls | `template/js/dengageEvents.js` |
| Contact identification and registration | `template/js/identity.js` |
| Contact tags, from the survey and NPS creatives | `Dn.setTags` in those two files |
| Product feed, generated per build and published | `feed/products.csv` |
| Diagnostics: on-page event readout, identifier quick reference | `?debug=1`, launcher |

---

## 2. Parked on purpose

Every one of these is **hidden from the launcher**, not merely unbuilt, so a
prospect never sees a button for something that will not fire. Each is one line in
`template/js/panels.js` to restore.

| Parked | Why | Decision |
|---|---|---|
| Product Box | needs a catalogue inside Dengage | Salil, 6 Aug |
| Smart Search | same, plus two container keys | Salil, 6 Aug |
| 5 recommendation strategy cards | not blocked, but sat inconsistently beside two cards that said "not ready" | Salil, 6 Aug |
| Typeform | built differently from the other templates, trigger lives on a separate campaign object | Salil, 6 Aug |
| 90 day purge | Phase 3, and §1a before anything is armed | Salil |

---

## 3. Blocked, and all three on the same thing

Dengage's **own** recommendation engine, Product Box Dynamic, and Smart Search all
need one thing: a product catalogue inside Dengage for this application. Behaviour
is not a catalogue. No amount of `ec:*` traffic produces one.

**There is an API for it**, and this corrects the earlier assumption that it needed
a backend ticket:

```
POST /rest/dataspace/ecomm/product/upsert
```

It writes into Dengage's `product` table, and variants into `product_variant`, up
to 1000 products per call. Required fields are `product_id`, `title`,
`category_path`, `price`, `discounted_price`, `link`, `image_link`, and
`feed/products.csv` already carries every one of them.

**The cost, which is a decision rather than a task.** That `product` table is
shared with the other properties on account 28. Pushing this demo's fictional
products into it means they can surface in those properties' recommendations. That
is the same shared-account exposure as CLAUDE.md §1, so it is not done, and it is
not something to do quietly. Reopen it with Salil.

Two smaller notes on the same route: `discounted_price` must be **less than or
equal to** `price`, so the feed's `price` and `original_price` map the opposite way
round to how they read; and the API is IP allowlisted, which rules out a stock CI
runner.

---

## 4. Never touched

Whole areas of the platform this demo has never used. Nothing here is broken, and
some of it is correctly out of scope; the point is to know it exists.

### Channels

| Channel | State | Note |
|---|---|---|
| **Email** | never used | Full content, sender, transactional and bulk API. The single biggest gap: a prospect asking "show me an email journey" cannot be shown one today |
| **SMS** | never used | Same shape as email, plus sender lists |
| **WhatsApp** | never used | Transactional and chat message send, plus logs |
| **In-App messaging** | out of scope | Mobile only, and this factory builds web storefronts |
| **Live Activity** | out of scope | iOS only |
| **Transactional, all channels** | never used | Including `send-with-fallback`, which tries a channel and falls back, and `push/sendByTag` |

### Features

| Feature | State | Note |
|---|---|---|
| **Journeys and automation** | **never built** | `/dataspace/triggerAutomatedFlow`. Referenced all through our own docs as the way to make push feel instant on a call, and never actually built. Probably the highest value gap after email |
| **Coupons and voucher lists** | never used | Create a list, import codes, hand one out. This is what the `expire_date` and `is_used` columns in `wishlist_events` are for |
| **Segments** | never used programmatically | `/dataspace/segments`. Needed anyway before the sample push script can target anything |
| **Reporting and send logs** | never used | Per channel logs and send lists. Everything has been verified by reading raw table rows instead |
| **Contact extensions** | never used | Extra addressable channels per contact |
| **Contact unification** | never used | Merging an anonymous visitor into a known contact, which is a common ecommerce question |
| **IYS consent** | never used | Turkish consent registry, likely relevant for Turkish prospects |
| **GDPR erasure, OpenDSR** | never used | Worth knowing exists when a prospect asks about deletion rights |
| **Folders** | never used | Organising content in the panel |
| **Order records** | never used | We write order EVENTS. `/dataspace/ecomm/orders_detail/upsert` writes order RECORDS, which is a different thing and feeds different reporting |

### Client side capabilities the SDK offers and this demo does not call

| Call | What it would add |
|---|---|
| `setCountry`, `setLanguage`, `setCurrency`, `setLocation` | Localisation signals for targeting. The demo knows its locale and never tells Dengage |
| `setUserPermission`, `setTrackingPermission` | Consent state. Relevant to any prospect with a cookie banner |
| `sendCustomEvent` | Events beyond the ecommerce vocabulary, for anything a storefront does that is not a standard event |
| `setNavigation` | Single page app navigation. Not needed here, needed by most real prospects |
| `ec:viewCart`, `ec:setCart`, `ec:cancelOrder` | Three ecommerce events not implemented. `cancelOrder` in particular drives win-back journeys |
| `showCustomPrompt` | A branded push permission prompt instead of the browser's own, which converts better |
| `RecommendationProvider`, `SearchProvider` | The headless providers behind the two parked cards |

---

## Reading this as priorities

If the question is "what would most change what a prospect can be shown", the
order is:

1. **Journeys**, because they connect everything already built. A cart event
   reaching a journey that sends a push is the story the demo currently tells with
   words rather than with the product.
2. **Email**, because it is the channel most prospects ask about first and there is
   nothing to show at all today.
3. **The product catalogue decision**, because one call unblocks three cards, and
   because the answer might reasonably be no.
4. **Coupons**, because it is small, self contained, and demonstrates something the
   storefront can already display.

Everything else is either genuinely out of scope, or a footnote worth knowing when
a prospect names it.
