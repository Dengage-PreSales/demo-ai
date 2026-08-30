-- ---------------------------------------------------------------------------
-- load_dps_product, as deployed on 30 August 2026. Supersedes the loader in
-- dps_product.sql, which is kept as the original schema script.
--
-- WHY THIS REVISION EXISTS. One table holds every demo's catalogue, keyed on
-- the bare product id. Until this change the conflict update rewrote a row's
-- content but never its demo_slug, so a row could hold one demo's content
-- under another demo's slug. The concrete case: a generated catalogue for a
-- blocked store reused six ids that a superseded generated build had left
-- behind. The new demo re-activated those rows on every ten minute pass
-- without taking them over, the old demo's withdraw sweep, which matches on
-- demo_slug, switched them straight back off, and the change count was never
-- zero: the Dengage flow was triggered on every pass for thirteen days, 1,737
-- runs, while six of the new demo's products sat withdrawn in Dengage.
--
-- TWO CHANGES, BOTH IN THE CONFLICT CLAUSE. Ownership now moves with the
-- write: demo_slug and source_product_id are set from the incoming row, so
-- whichever demo's feed carries an id now owns its row outright and the other
-- demo's sweep can no longer see it. And the change gate compares them too,
-- so a moved row settles: the pass after the move reports nothing, and the
-- flow is only triggered when a catalogue genuinely changed.
--
-- THE COLLISION ITSELF IS REFUSED UPSTREAM NOW. factory/build-feed.mjs fails
-- any build whose catalogue claims an id another live demo already holds, and
-- factory/scrape/fallback.mjs opens every invented id with the store's own
-- name so two generated catalogues cannot mint the same one. This function's
-- ownership rule is the backstop for rows that already exist, not a licence
-- for two live demos to share an id.
-- ---------------------------------------------------------------------------

create or replace function public.load_dps_product(p_slug text)
returns integer
language plpgsql
set search_path to 'public', 'extensions'
as $function$
declare
    v_base      text;
    v_site      text := 'https://dengage-presales.github.io/demo-ai/';
    v_body      text;
    v_status    integer;
    v_rows      integer;
    v_withdrawn integer;
begin
    if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,62}$' then
        raise exception 'not a demo slug: %', coalesce(p_slug, '<null>');
    end if;

    v_base := v_site || 'demos/' || p_slug || '/';

    select r.status, r.content into v_status, v_body
      from extensions.http_get(v_base || 'products.json') as r;

    if v_status <> 200 then
        raise exception 'products.json for % returned HTTP %', p_slug, v_status;
    end if;

    drop table if exists _incoming;

    create temporary table _incoming on commit drop as
    select x.id,
           nullif(x.name, '') as name,
           nullif(x.category, '') as category,
           coalesce(nullif(x."categoryPath", ''), nullif(x.category, '')) as category_path,
           x.price, x."discountedPrice" as discounted, x."stockCount" as stock,
           nullif(x.image, '') as image,
           nullif(x.motif, '') as motif,
           nullif(x.attributes ->> 'Brand', '') as brand,
           nullif(x.description, '') as description,
           -- TAGS FROM REAL ATTRIBUTES, not invented keywords. Dengage describes the
           -- column as free-form merchandising keywords, and a store's own published
           -- attributes are exactly that: "Waxed cotton", "XS to XL". Brand is excluded
           -- because it has its own column, and the values are used rather than the
           -- key:value pairs, because a keyword list is what the column is for.
           (select string_agg(v, ', ' order by k)
              from jsonb_each_text(coalesce(x.attributes, '{}'::jsonb)) as a(k, v)
             where k <> 'Brand' and v <> '') as tags
    from jsonb_to_recordset((v_body::jsonb) -> 'products')
        as x(id text, name text, category text, "categoryPath" text, price numeric,
             "discountedPrice" numeric, "stockCount" integer, image text, motif text,
             attributes jsonb, description text)
    where x.id is not null and x.id <> '';

    if (select count(*) from _incoming) = 0 then
        raise exception 'products.json for % parsed to zero products, refusing to withdraw the catalogue', p_slug;
    end if;

    insert into public.dps_product (
        product_id, title, description, category_id, brand_id, brand,
        price, discounted_price,
        image_link, small_image_link, large_image_link,
        link, mobile_web_link,
        category_path, stock_count, availability, tags,
        is_active, store_name, publish_date, demo_slug, source_product_id)
    select
        i.id, i.name, i.description,
        nullif(nullif(regexp_replace(lower(coalesce(i.category, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''),
        nullif(nullif(regexp_replace(lower(coalesce(i.brand, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''),
        i.brand,
        i.price,
        case when i.price is not null and i.discounted is not null and i.discounted < i.price
             then i.discounted end,
        coalesce(v_base || i.image, v_site || 'assets/motifs/' || i.motif || '.jpg'),
        coalesce(v_base || i.image, v_site || 'assets/motifs/' || i.motif || '.jpg'),
        coalesce(v_base || i.image, v_site || 'assets/motifs/' || i.motif || '.jpg'),
        v_base || 'product.html?id=' || i.id,
        v_base || 'product.html?id=' || i.id,
        i.category_path,
        i.stock,
        -- BOOLEAN NOW, because that is what Dengage declares. A null stock_count means
        -- the catalogue does not track stock, which is not the same as out of stock, so
        -- it still reads as available.
        case when i.stock = 0 then false else true end,
        i.tags,
        true, 'Dengage eComm Demo', clock_timestamp(), p_slug, i.id
    from _incoming i
    on conflict (product_id) do update set
        title            = excluded.title,
        description      = excluded.description,
        category_id      = excluded.category_id,
        brand_id         = excluded.brand_id,
        brand            = excluded.brand,
        price            = excluded.price,
        discounted_price = excluded.discounted_price,
        image_link       = excluded.image_link,
        small_image_link = excluded.small_image_link,
        large_image_link = excluded.large_image_link,
        link             = excluded.link,
        mobile_web_link  = excluded.mobile_web_link,
        category_path    = excluded.category_path,
        stock_count      = excluded.stock_count,
        availability     = excluded.availability,
        tags             = excluded.tags,
        is_active        = true,
        demo_slug        = excluded.demo_slug,
        source_product_id = excluded.source_product_id,
        publish_date     = coalesce(public.dps_product.publish_date, clock_timestamp())
    where (public.dps_product.title, public.dps_product.description,
           public.dps_product.category_id, public.dps_product.brand_id,
           public.dps_product.brand, public.dps_product.price,
           public.dps_product.discounted_price, public.dps_product.image_link,
           public.dps_product.large_image_link, public.dps_product.link,
           public.dps_product.mobile_web_link, public.dps_product.category_path,
           public.dps_product.stock_count, public.dps_product.availability,
           public.dps_product.tags, public.dps_product.is_active,
           public.dps_product.demo_slug, public.dps_product.source_product_id,
           public.dps_product.publish_date is null)
       is distinct from
          (excluded.title, excluded.description,
           excluded.category_id, excluded.brand_id,
           excluded.brand, excluded.price,
           excluded.discounted_price, excluded.image_link,
           excluded.large_image_link, excluded.link,
           excluded.mobile_web_link, excluded.category_path,
           excluded.stock_count, excluded.availability,
           excluded.tags, excluded.is_active,
           excluded.demo_slug, excluded.source_product_id, false);

    get diagnostics v_rows = row_count;

    update public.dps_product d
       set is_active = false, availability = false
     where d.demo_slug = p_slug
       and d.is_active
       and not exists (select 1 from _incoming i where i.id = d.source_product_id);

    get diagnostics v_withdrawn = row_count;
    return v_rows + v_withdrawn;
end;
$function$;
