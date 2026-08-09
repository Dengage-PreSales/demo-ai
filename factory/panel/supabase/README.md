# The product dimension, and how Dengage reads it

`dps_product.sql` is applied to the DPS Supabase project. It is here so the setup is
reviewable rather than living only inside one database.

**Why any of this exists.** No Dengage event table carries a product name or a
picture. Every one identifies a product by `product_id` and stops, and columns cannot
be added to the six standard tables. `factory/phase0/SCHEMA.md` has the column lists.
So this table is what turns an id back into something a person can read, and it is
the difference between an abandoned cart email that shows a basket and one that shows
three broken images.

**Why Postgres rather than loading Dengage directly.** The Dengage API is IP
allowlisted, and this repository's automation runs behind a rotating egress pool.
Forty consecutive attempts from a session got nothing through. A remote table
inverts the direction: Dengage connects out and queries this database, so no address
on our side has to be stable and no credential has to travel.

---

## State on 9 August 2026

| | |
|---|---|
| Table | `public.dps_product`, 27 Dengage columns plus 3 for our own bookkeeping |
| Rows | 30, the whole `techiestore-in` catalogue |
| Keys | natural catalogue ids, not namespaced. **One demo only**, see below |
| Loader | `select public.load_dps_product('techiestore-in');` |
| Read role | `dengage_ro`, read only, **no password set yet** |

Verified rather than assumed: the loader run twice leaves 30 rows and 30 distinct
ids, `dengage_ro` reads all 30 through RLS, and an `UPDATE` as `dengage_ro` is
refused.

---

## Loading a demo

```sql
select public.load_dps_product('<slug>');
```

Postgres fetches that demo's published `products.json` and upserts it. Idempotent, so
running it again refreshes prices and images rather than duplicating anything. A slug
that is not a demo raises rather than inserting a parsed 404 page.

To keep it current without anyone remembering, `pg_cron` is available in this project:

```sql
select cron.schedule('refresh-techiestore', '0 3 * * *',
                     $$select public.load_dps_product('techiestore-in')$$);
```

---

## Connecting Dengage to it

1. **Give the role a password.** It has no login until you do, and this is deliberate:
   a password should not travel through a transcript.

   ```sql
   alter role dengage_ro with login password '<generate one>';
   ```

2. **Use the connection string from Supabase's own Connect dialog**, not one typed
   from memory. Two things there are easy to get wrong:

   - **IPv4.** Direct connections to `db.<ref>.supabase.co` resolve over IPv6 on
     current projects. If Dengage's connector is IPv4 only, use the **pooler**
     hostname instead, or add Supabase's dedicated IPv4 add-on. This is the single
     most likely reason a connection that should work does not.
   - **Session mode, not transaction mode.** If you go through the pooler, take the
     session mode port. A remote table issues ad hoc queries, and transaction mode
     does not support prepared statements.

3. **Data Space > Tables > New > Remote Data Table**, pick the connection, pick
   `public.dps_product`, select the columns. Leave the contact key unset: it is
   optional, and a product table has none.

4. **Relate it to the event tables on `product_id`.** Four of the six carry that
   column: `shopping_cart_events`, `page_view_events`, `wishlist_events` and
   `order_events_detail`. `order_events` reaches products through
   `order_events_detail` on `order_id`, and `search_events` records `keywords` rather
   than a product.

---

## Settled 9 August 2026: the ETL, not a remote table

Salil's call, after trying it. Dengage's ETL copies this table into a real Data Space
`dps_product`, and content queries that.

**Nothing above changes.** The column names, the types, the constraints, the loader
and the read only role are all exactly what an ETL source needs. Only the direction
changes: instead of Dengage querying Postgres per recipient, the ETL copies rows in
on a schedule and content reads local storage.

**What it buys, and it is the reason the doubt existed.** Remote tables are
documented for Interactive Segments and never mentioned for personalisation, which is
the half the emails need. A remote table is also a live passthrough, so a `$from`
inside an email would have meant one external query per recipient: fine for five
contacts on a demo, not fine for a real send. Against a stored table, `$from` is
exactly what the documentation describes, so the uncertainty is gone.

**What it costs.** Freshness is now the ETL's schedule rather than live. That makes
the order of the chain matter:

```
factory publishes demos/<slug>/products.json
   -> load_dps_product('<slug>') in Postgres        (pg_cron, or by hand)
   -> the Dengage ETL copies Postgres to dps_product
   -> content reads dps_product with $from
```

Put the Postgres refresh comfortably before the ETL window, not alongside it. A price
that changed in the catalogue after the ETL ran shows the old figure until the next
pass, and a price on screen is the one value a prospect checks.

A remote table is still worth keeping alongside for **segments** if live matters
there, since that use is documented. The two can point at the same table.

---

## The one thing to fix before a second demo

`product_id` holds the **bare catalogue id** right now, because that is what
`template/js/dengageEvents.js` sends and the join is only correct when both sides
agree.

That does not survive a second demo. One table serves all of them, so two prospects
whose catalogues both contain an id like `12345` overwrite each other, and the demo
on the call shows the other one's product. `demo_slug` and the
`(demo_slug, source_product_id)` unique constraint make the collision visible in
Postgres, but they cannot fix the join: a shared piece of dynamic content has no way
to filter by demo, because nothing in a send says which demo triggered it.

The fix is `<slug>:<id>` as the key, in this table and in the emitter together. That
changes what the storefront writes to a shared production table, so it is Salil's
call before it is made. `factory/panel/dps-product.mjs` already writes the namespaced
form by default and takes `--natural-ids` for the single demo case.
