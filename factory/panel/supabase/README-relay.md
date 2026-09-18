# The transactional relay

**What it is.** The storefront names a moment. This decides everything else:
which template, which address, which products, which prices, and whether the
moment is allowed to send at all. It runs in the Supabase database that already
holds the catalogue sync, because that is where the Dengage credentials are and
because a static demo page cannot hold a credential at all.

```
the storefront detects the intent
     ->  one call: contact key, demo slug, intent name, a little context
          ->  the relay validates, composes, authenticates, sends
               ->  transactional email, transactional push, both recorded
```

## Why a new demo needs nothing doing to it

Everything a message prints comes from facts the factory already publishes.

| What the message needs | Where it comes from |
|---|---|
| store name, brand colours, logo, currency, language, home address | `feed/demos.json`, written by `factory/build-feed.mjs` on every build |
| product names, images, links, real prices | `dps_product`, which the catalogue sync already fills per demo |
| the visitor's name and address | `dps_demo_contact`, written when the visitor uses the demo's account card |
| which template a moment uses | `dps_intent`, one row per moment, shared by every demo |

`dps_demo_refresh()` reads `feed/demos.json` and brings the index up to date. A
demo becomes reachable by a message the moment it is built, and a demo that has
expired out of the feed is removed, so nothing keeps messaging a retired store.

## What it refuses, and why each one matters

The endpoint is reachable from a public page, so every one of these is a rule
rather than a precaution.

| Refused | Because |
|---|---|
| an email address from the caller | the address comes from `dps_demo_contact`. A stranger with the endpoint can only reach someone a demo registered, never an address they chose |
| a content id from the caller | content ids come from `dps_intent`, so the endpoint cannot be pointed at an arbitrary template |
| a price from the caller | everything numeric is composed from `dps_product`. A page can say what is in the basket; it cannot say what anything costs |
| an unknown demo or intent | refused before anything is sent |
| more than a few sends per contact | 12 an hour and 40 a day, and the refusal is recorded like any other outcome |

It never returns the address it sent to, so the endpoint cannot be used to ask
whether a contact key has an address on file.

## The three functions

| Function | What it does |
|---|---|
| `dps_demo_refresh()` | brings `dps_demo` up to date from the published feed |
| `dps_compose(slug, contact_key, context)` | builds the whole parameter vocabulary from the demo's own catalogue. Read only, sends nothing, so a message can be inspected without being delivered |
| `dps_transactional(contact_key, slug, intent, context)` | validates, composes, authenticates, sends, records |

`dps_compose` is separate on purpose: it is the half that decides what a message
says, and it can be read and checked without anything reaching anybody.

## What is never invented

`free_shipping_line`, `coupon_code` and `coupon_line` are empty strings, because
no delivery threshold and no coupon scheme exist for these demos yet and a
sentence naming either would be a number this factory made up. `stock_line` is
empty unless the catalogue genuinely carries a stock count. CLAUDE.md
non-negotiable 5.

## Where the code lives, and what is not yet here

The four functions and four tables are applied as Supabase migrations, which are
themselves versioned on that side. **They are not mirrored into this repository
yet, and that is a gap worth naming rather than leaving implied**: a reader with
no database access can read the design above and not the code. Mirroring them
here, with a check that the two agree, is the right next step.

To read the live definitions:

```sql
select proname, prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname like 'dps_%'
 order by proname;
```

Any change goes through a migration, never a hand edit, so the history stays
readable.

## Verified, and on what

| | |
|---|---|
| Both channels, one call | `code 0` on email and push together, 18 September 2026 |
| Recommendations, prices and basket maths | composed from `dps_product`, never from the caller |
| A store the relay had never seen | `sharbatly-club`, built from a URL and composed correctly twenty minutes later with no setup: SAR, its own brand colour, its own flowers, real prices |
| Units against lines | a basket holding two of one product says the product's name and nothing else. Conflating the two made it read "and 1 more item" with nothing else in the basket, which is the same double counting that once reached a push notification |
