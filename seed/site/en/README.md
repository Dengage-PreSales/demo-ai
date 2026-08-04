# CantuPneus demo, English version

> Shared platform knowledge lives two levels up:
> [repository README](../../README.md) ·
> [`docs/DENGAGE-INTEGRATION.md`](../../docs/DENGAGE-INTEGRATION.md) ·
> [`docs/PANEL-SETUP.md`](../../docs/PANEL-SETUP.md) ·
> [`docs/DECISIONS-AND-GOTCHAS.md`](../../docs/DECISIONS-AND-GOTCHAS.md)

A full standalone copy of the Portuguese demo site, translated to English.
Live at:
`https://salil-dengage.github.io/dengage-demos/cantu-pneus/en/`

## What is different from the Portuguese site

Everything a visitor reads is English: pages, product catalog
(`cantu_prod_example.json`), all 17 locally coded widgets, the scenario
launcher, the cart, the sign-up flow and the event panel.

The 8 Default Scenarios stay Portuguese on purpose: their content lives in
the Dengage panel, not in this repository.

## What is deliberately identical

Nothing in the Dengage panel needs to change for this version to work:

- Same SDK snippet (account 28, app guid c8d2da44-...), same GTM container.
- Same dataLayer event names and scenario slugs, so every campaign
  configured for the Portuguese site fires here too. Campaign display
  conditions are `/.*/`, which already covers the `/en/` path.
- Same Big Data table names and column names (`survey_responses`,
  `nps_responses`, `subscription_signups`), same `ec:*` and `pageView`
  payload shapes.

Values inside payloads are translated where they are content rather than
schema, for example `category_path` is `Tires > Truck > Lug` here and
`Pneus > Carga > Borrachudo` on the Portuguese site.

## Independence

This folder carries its own copies of `js/`, `images/`, `vendor/`,
`cantu-style.css` and the product feed, so editing the English site can
never affect the Portuguese one, and the reverse is also true. The two
sites share only the Dengage account.

A `PT` link in the header and footer switches back to the Portuguese site.

## Search and saved items

Both are real site behaviour, not buttons in the event panel, and both write to
standard Data Space tables. The header carries a magnifier and a heart; every
product card carries a heart; the product page carries a save button.

| Action | Event | Table |
|---|---|---|
| a settled search query | `ec:search` | `search_events` |
| saving a product | `ec:addToWishlist` | `wishlist_events` |
| unsaving, or Clear list | `ec:removeFromWishlist` | `wishlist_events` |

### The talk track

**Search.** Type a size the shop stocks, `195/65 R15` or `19565r15`, both find
the same tyre. Then type something the shop does not stock. The interesting row
is the second one: `result_count` is 0, and that is the trigger for a campaign
that says "we do not carry that, here is the nearest size we do". Point out that
the event fires once per *settled* query rather than once per keystroke, so the
table records what people wanted and not what they typed on the way there. A
prospect who has built this before will recognise the difference immediately.

**Saved items.** Save two or three tyres, open the drawer, then note what went
into `wishlist_events` with each save: list price and the discounted price, so a
price-drop campaign has something to compare against, an `expire_date` 90 days
out so the campaign stops chasing a stale save, and `stock_count`, which is the
field a back-in-stock alert needs. The low-stock lines in the drawer come from
the same figure.

### One honest note

`stock_count` is only sent here and on the Portuguese site, because this
catalogue tracks units. The NovaPay and Meridian catalogues do not send it: a
card or a mortgage has no unit count, and the field is optional. If a prospect in
financial services asks about back-in-stock, the equivalent for them is the
price against discounted price pair, driving a rate-drop alert.

Exact payloads: `docs/DENGAGE-INTEGRATION.md` §5.11.
Verify with `node tools/verify/searchwishtest.js`.
