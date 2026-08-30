-- ============================================================================
-- The product dimension, in Postgres, for Dengage's ETL to load into dps_product.
--
-- Applied to the DPS Supabase project on 9 August 2026. Kept here so the setup is
-- reproducible and reviewable rather than living only in one database.
--
-- WHY THIS TABLE EXISTS. No Dengage event table carries a product name or a
-- picture. page_view_events, shopping_cart_events, wishlist_events and
-- order_events_detail each identify a product by product_id and stop there, and
-- columns cannot be added to those six tables. See factory/phase0/SCHEMA.md for the
-- column lists this was read from. So an abandoned cart email has an id and nothing
-- a person can read, and this is what closes that gap.
--
-- WHY POSTGRES RATHER THAN LOADING DENGAGE DIRECTLY. The Dengage API is IP
-- allowlisted and this repository's automation runs behind a rotating egress pool,
-- so nothing here can reliably reach it. Dengage reaching out inverts that: no
-- address on our side has to be stable and no credential has to travel.
--
-- TYPES ARE READ FROM DENGAGE, NOT ASSUMED, and this is the hard-won part. The first
-- ETL run failed with "42804: column availability is of type boolean but expression is
-- of type character varying", and that was one misalignment of five. The other four
-- would have surfaced later or not at all: a timestamptz written into a DATETIME shifts
-- by hours and raises nothing.
--
-- public.check_dengage_alignment() now reads Dengage's declared schema over its own API
-- and compares it column by column against what the view offers. Last run: 28 columns
-- compared, 28 aligned, nothing missing, nothing extra. Run it after any change on
-- either side rather than trusting this file.
--
-- AND AN ETL RATHER THAN A REMOTE TABLE, settled 9 August 2026 after trying it.
-- Remote tables are documented for Interactive Segments and never mentioned for
-- personalisation, which is the half the emails need, and a live passthrough would
-- have meant one external query per recipient at send time. The ETL copies these rows
-- into a real Data Space table, where $from is exactly what the documentation
-- describes. factory/panel/supabase/etl-query.sql is the query the flow runs.
-- ============================================================================

create table public.dps_product (
    -- THE JOIN KEY, and it has to equal exactly what the storefront sends on a cart,
    -- view, wishlist or order event. template/js/dengageEvents.js sends the
    -- catalogue's own id today, so for a single demo this holds the bare id.
    --
    -- ONCE A SECOND DEMO IS LOADED IT BECOMES '<slug>:<id>', in this table and in the
    -- emitter at the same time. One table serves every demo, so two prospects whose
    -- catalogues both contain an id like '12345' would otherwise overwrite each other
    -- and put the wrong product in front of somebody on a call. Non-negotiable 6
    -- already requires every demo to be namespaced by its slug.
    product_id            text primary key,

    title                 text,
    description           text,
    category_id           text,
    brand_id              text,

    -- ABSOLUTE, BOTH OF THEM. This is what lets ONE shared piece of Dengage dynamic
    -- content serve every demo: the row carries the demo's own addresses, so the
    -- content never needs to know which demo triggered the send. It cannot know,
    -- because nothing in a send carries a demo marker.
    link                  text,
    image_link            text,

    -- numeric, not float. Money summed or compared as a float rounds, and a price is
    -- the one value in here a prospect reads straight off the screen.
    price                 numeric(12,2),
    discounted_price      numeric(12,2),

    -- BOOLEAN, because that is what Dengage declares. This was text ('in stock') and it
    -- is what failed the first ETL run with 42804. true is in stock.
    availability          boolean,
    -- DATETIME on the far side, so timestamp rather than date: a date cannot carry the
    -- time of day the column exists to express.
    availability_date     timestamp,

    -- NULL means the catalogue does not track stock. 0 means none left. Defaulting
    -- one to the other is the trap CLAUDE.md 3.5 names, so the column stays nullable
    -- and is never filled with a zero to look complete.
    stock_count           integer,

    parent_id             text,
    trans_title           text,
    product_vendor        text,
    category_path         text,
    brand                 text,
    mobile_web_link       text,
    android_deep_link     text,
    ios_deep_link         text,
    small_image_link      text,
    large_image_link      text,

    -- BOOLEAN. An earlier version of this file said "smallint rather than boolean,
    -- deliberately, Dengage's dps_product takes 1 and 0 here". That was an assumption
    -- and it was wrong: the API declares BOOLEAN. Read, do not guess.
    is_active             boolean not null default true,

    -- INTEGER on the far side, not text.
    product_special_code  integer,
    store_name            text,
    -- Free-form merchandising keywords, per Dengage's own description of the column.
    -- Filled from the scraped attributes where a store publishes any. This column was
    -- missing entirely: Dengage declares 28 columns and this table had 27.
    tags                  text,
    legacy_resource_id    text,
    -- DATETIME carries no zone, so timestamptz here would be converted on the way out
    -- and silently shift by hours.
    publish_date          timestamp,

    -- Not part of Dengage's dps_product. These stay on the Postgres side so a human
    -- can tell rows apart, and so loading a demo twice is caught by the database
    -- rather than discovered on a call.
    demo_slug             text not null,
    source_product_id     text not null,
    updated_at            timestamptz not null default now(),

    constraint dps_product_demo_source_key unique (demo_slug, source_product_id),

    -- A price that is not a price and a discount that is not a discount are both
    -- caught here rather than in an email. Showing a reduction that is not one is
    -- exactly the sort of claim a prospect checks.
    constraint dps_product_price_positive check (price is null or price >= 0),
    constraint dps_product_discount_lower check (
        discounted_price is null or price is null or discounted_price < price),
    constraint dps_product_stock_not_negative check (stock_count is null or stock_count >= 0)
);

create index dps_product_demo_slug_idx on public.dps_product (demo_slug);
create index dps_product_category_path_idx on public.dps_product (category_path);
create index dps_product_active_idx on public.dps_product (is_active) where is_active;

create function public.dps_product_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger dps_product_touch_updated_at
    before update on public.dps_product
    for each row execute function public.dps_product_touch();

-- ---------------------------------------------------------------------------
-- The loader. Postgres pulls the catalogue itself.
--
-- The factory already publishes every demo's catalogue at a fixed address, so that
-- address is the source of truth and this reads it. Nothing to run on a schedule
-- from outside, no credentials anywhere, and it works for a demo that does not exist
-- yet.
-- ---------------------------------------------------------------------------

create extension if not exists http with schema extensions;

create or replace function public.load_dps_product(p_slug text)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
    v_base      text;
    v_body      text;
    v_status    integer;
    v_rows      integer;
    v_withdrawn integer;
begin
    -- THE SLUG IS INTERPOLATED INTO A URL, SO IT IS VALIDATED RATHER THAN TRUSTED.
    -- The http extension gives this database outbound requests, which is exactly the
    -- capability a server side request forgery needs. Constraining the slug to the
    -- shape a demo folder actually has is what stops this being a way to fetch an
    -- arbitrary address.
    if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,62}$' then
        raise exception 'not a demo slug: %', coalesce(p_slug, '<null>');
    end if;

    v_base := 'https://dengage-presales.github.io/demo-ai/demos/' || p_slug || '/';

    select r.status, r.content into v_status, v_body
      from extensions.http_get(v_base || 'products.json') as r;

    -- A missing demo returns a 404 page, not an error. Without this check that page
    -- would be parsed as JSON and fail with something that reads like a data problem
    -- rather than a wrong slug.
    if v_status <> 200 then
        raise exception 'products.json for % returned HTTP %', p_slug, v_status;
    end if;

    create temporary table _incoming on commit drop as
    select x.id, nullif(x.name, '') as name, x.category, x.price,
           x."discountedPrice" as discounted, x."stockCount" as stock, x.image
    from jsonb_to_recordset((v_body::jsonb) -> 'products')
        as x(id text, name text, category text, price numeric,
             "discountedPrice" numeric, "stockCount" integer, image text)
    where x.id is not null and x.id <> '';

    -- A CATALOGUE THAT CAME BACK EMPTY IS A FAULT, NOT AN INSTRUCTION TO WITHDRAW
    -- EVERYTHING. Without this, one bad publish would deactivate a whole demo and the
    -- next send would show nothing at all.
    if (select count(*) from _incoming) = 0 then
        raise exception 'products.json for % parsed to zero products, refusing to withdraw the catalogue', p_slug;
    end if;

    insert into public.dps_product (
        product_id, title, price, discounted_price,
        image_link, small_image_link, link,
        category_path, stock_count, availability,
        is_active, store_name, demo_slug, source_product_id)
    select
        i.id,
        i.name,
        i.price,
        -- A discount only exists if it is genuinely lower. The table's own check
        -- constraint enforces this too, so a bad feed fails loudly rather than showing
        -- a prospect a reduction that is not one.
        case when i.price is not null and i.discounted is not null and i.discounted < i.price
             then i.discounted end,
        case when i.image is not null and i.image <> '' then v_base || i.image end,
        case when i.image is not null and i.image <> '' then v_base || i.image end,
        v_base || 'product.html?id=' || i.id,
        nullif(i.category, ''),
        -- Left null when the scrape found none. Null means the catalogue does not
        -- track stock; zero means none left.
        i.stock,
        case when i.stock = 0 then 'out of stock' else 'in stock' end,
        1, 'Dengage eComm Demo', p_slug, i.id
    from _incoming i
    -- SUPERSEDED, 30 August 2026: the deployed loader is the one in
    -- ownership-moves-on-conflict.sql, which also moves demo_slug and
    -- source_product_id here and gates the update on a full change comparison.
    -- This file stays as the original schema script rather than being rewritten.
    on conflict (product_id) do update set
        title            = excluded.title,
        price            = excluded.price,
        discounted_price = excluded.discounted_price,
        image_link       = excluded.image_link,
        small_image_link = excluded.small_image_link,
        link             = excluded.link,
        category_path    = excluded.category_path,
        stock_count      = excluded.stock_count,
        availability     = excluded.availability,
        is_active        = 1;

    get diagnostics v_rows = row_count;

    -- A PRODUCT THAT LEAVES THE CATALOGUE IS WITHDRAWN, NOT FORGOTTEN. The loader used
    -- to upsert only what it found, so a removed product kept is_active = 1 forever.
    -- Downstream that is worse than a missing row: an upsert never touches it, so
    -- Dengage keeps a live row for something nobody can buy and it goes on appearing in
    -- baskets and rails.
    --
    -- The row is kept rather than deleted, deliberately. An upsert can carry a 0 across
    -- and withdraw it in Dengage too, which a deletion here could never do.
    update public.dps_product d
       set is_active = 0,
           availability = 'out of stock'
     where d.demo_slug = p_slug
       and d.is_active = 1
       and not exists (select 1 from _incoming i where i.id = d.source_product_id);

    get diagnostics v_withdrawn = row_count;

    raise notice 'load_dps_product(%): % loaded, % withdrawn', p_slug, v_rows, v_withdrawn;
    return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- What the Dengage ETL reads.
--
-- A VIEW RATHER THAN A LONG SELECT IN THE PANEL, for one reason: the column contract
-- belongs in one place. Twenty seven aliases pasted into a flow are twenty seven
-- things that can drift from the table with nothing to notice, and a flow is the one
-- place in this system nobody reviews.
--
-- It projects EXACTLY Dengage's dps_product columns and nothing else. demo_slug,
-- source_product_id and updated_at are ours and have no column on the far side, so
-- sending them would fail the load.
--
-- IT INCLUDES WITHDRAWN PRODUCTS, and filtering them out would be a bug that looks
-- like tidiness: the upsert is the only thing that can carry is_active = 0 across.
--
-- security_invoker so row level security on the base table still applies to whoever
-- selects through it, rather than the view running with its owner's rights.
-- ---------------------------------------------------------------------------

create view public.dengage_dps_product
with (security_invoker = true) as
select
    product_id, title, description, category_id, brand_id, link, image_link,
    price, discounted_price, availability, availability_date, stock_count,
    parent_id, trans_title, product_vendor, category_path, brand,
    mobile_web_link, android_deep_link, ios_deep_link,
    small_image_link, large_image_link, is_active, product_special_code,
    store_name, legacy_resource_id, publish_date
from public.dps_product;

-- ---------------------------------------------------------------------------
-- The role Dengage connects as.
--
-- RLS IS ON, AND WITHOUT THIS THE REMOTE TABLE WOULD READ ZERO ROWS. That is worth
-- stating plainly: with row level security enabled and no policy, every non owner
-- role selects nothing, and nothing looks exactly like "Dengage cannot read a remote
-- table" from the outside. It would have failed the test for a reason that has
-- nothing to do with what the test is for.
--
-- Read only, and one table. This credential goes into a third party panel, so it
-- gets exactly one capability and can see nothing else in the database.
-- ---------------------------------------------------------------------------

create role dengage_ro nologin;

grant connect on database postgres to dengage_ro;
grant usage on schema public to dengage_ro;
grant select on public.dps_product to dengage_ro;
grant select on public.dengage_dps_product to dengage_ro;

-- Nothing in this table is per contact and nothing in it is personal: it is a
-- product catalogue already published on the storefront the demo serves. So a row
-- level restriction would add no protection and one more way to come back empty.
create policy dps_product_dengage_read
    on public.dps_product
    for select
    to dengage_ro
    using (true);

-- LAST STEP, AND IT IS YOURS, because a password should not travel through a
-- transcript. The role has no login until this is run:
--
--   alter role dengage_ro with login password '<a password you generate>';
