-- ============================================================================
-- The chain that runs itself. Applied 9 August 2026.
--
--   the factory publishes demos/<slug>/products.json and feed/products.json
--     -> Postgres notices, within ten minutes, and reloads what changed
--        -> Postgres triggers the Dengage Automated Flow, but only if something did
--           -> the flow copies Postgres into dps_product
--              -> email, push and on-site read dps_product with $from
--
-- NOTHING IN GITHUB ACTIONS. That is not a preference, it is the only thing that
-- works: the Dengage API is allowlisted per address and a GitHub runner sits behind a
-- rotating pool. Attempts from CI-like environments were refused from 34.29.237.63,
-- 146.148.98.137, 35.239.245.65 and 35.253.239.132, a different address almost every
-- time, so no allowlist entry can cover it.
--
-- THIS DATABASE PRESENTS ONE ADDRESS, AND IT IS ALREADY ACCEPTED. Measured, not
-- assumed: repeated outbound requests from the http extension all came from
-- 13.231.95.28, this project's egress in ap-northeast-1, and a real login to
-- api.dengage.com from here returned 200 with a token while a flow trigger returned
-- code 0 with HasError false. So the Dengage side of the chain belongs here.
--
-- NOTHING NEEDS TELLING ABOUT A NEW DEMO. The demo list is read from the factory's own
-- feed/products.json, which every build regenerates, so a demo created five minutes ago
-- is discovered without being registered anywhere.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Where a scheduled job's history lives.
--
-- A cron job that fails quietly is worse than no cron job, because the failure looks
-- like "the data has not changed". This is the first place to look when a demo has no
-- products in Dengage.
-- ---------------------------------------------------------------------------

create table public.dengage_sync_log (
    id             bigserial primary key,
    ran_at         timestamptz not null default now(),
    demos          integer,
    changed_rows   integer,
    triggered      boolean not null,
    transaction_id text,
    problems       text
);

-- ---------------------------------------------------------------------------
-- THREE BUGS THIS FUNCTION HAD, all found by running it and none of them visible in
-- the code. Recorded because each one failed in a way that looked like success.
--
-- 1. text[] || <bare literal> makes Postgres parse the literal AS an array, so three
--    of the four problem appends failed at runtime while the one built from
--    concatenated variables worked.
--
-- 2. ON COMMIT DROP is per TRANSACTION, not per call. The loop calls the loader once
--    per demo inside one transaction, so the second demo found the first demo's temp
--    table and failed with "relation _incoming already exists". Every demo after the
--    first was silently skipped, and the pass still reported rows changed. The loader
--    now drops the table first. This could not have been caught by calling the loader
--    once, which is how it was tested before the loop existed.
--
-- 3. The change gate was welded shut. It compared max(updated_at) before and after,
--    and updated_at came from now(), which in Postgres is TRANSACTION start time and
--    constant for the whole transaction. Every update in a pass got an identical
--    timestamp, so the comparison was never true and the ETL would never have fired.
--    Two consecutive passes reporting zero looked exactly like correct change
--    detection. It now sums what the loader returns, which is exact and cannot be
--    defeated by transaction semantics, and the touch trigger uses clock_timestamp()
--    so updated_at is the real time a row changed.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_dengage_catalogues()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
    v_feed      text;
    v_status    integer;
    v_slugs     text[];
    v_slug      text;
    v_one       integer;
    v_changed   integer := 0;
    v_problems  text[] := '{}';
    v_triggered boolean := false;
    v_txn       text;
    v_userkey   text;
    v_password  text;
    v_flow_id   text;
    v_login     extensions.http_response;
    v_trigger   extensions.http_response;
    v_body      jsonb;
    v_token     text;
begin
    select r.status, r.content into v_status, v_feed
      from extensions.http_get('https://dengage-presales.github.io/demo-ai/feed/products.json') as r;
    if v_status <> 200 then
        raise exception 'the feed manifest returned HTTP %', v_status;
    end if;

    select array_agg(value::text) into v_slugs
      from jsonb_array_elements_text((v_feed::jsonb) -> 'demos') as value;

    if v_slugs is null or array_length(v_slugs, 1) = 0 then
        raise exception 'the feed manifest lists no demos';
    end if;

    -- ONE BAD DEMO MUST NOT STOP THE OTHERS. A demo listed in the feed whose
    -- products.json has not published yet is an ordinary race, not a fault: it is
    -- recorded and the pass continues, because aborting would leave every later demo
    -- stale over a folder that will exist in a minute.
    foreach v_slug in array v_slugs loop
        begin
            select public.load_dps_product(v_slug) into v_one;
            v_changed := v_changed + coalesce(v_one, 0);
        exception when others then
            v_problems := array_append(v_problems, v_slug || ': ' || sqlerrm);
        end;
    end loop;

    -- ONLY WHEN SOMETHING ACTUALLY CHANGED. Firing every pass would run the ETL every
    -- ten minutes forever to copy identical rows.
    if v_changed > 0 then
        select decrypted_secret into v_userkey
          from vault.decrypted_secrets where name = 'dengage_api_userkey';
        select decrypted_secret into v_password
          from vault.decrypted_secrets where name = 'dengage_api_password';
        select decrypted_secret into v_flow_id
          from vault.decrypted_secrets where name = 'dengage_flow_id';

        if v_userkey is null or v_password is null or v_flow_id is null then
            v_problems := array_append(v_problems,
                'rows changed but vault secrets are missing, so Dengage was not told'::text);
        else
            select * into v_login from extensions.http((
                'POST', 'https://api.dengage.com/rest/login',
                array[extensions.http_header('Content-Type', 'application/json')],
                'application/json',
                json_build_object('userkey', v_userkey, 'password', v_password)::text
            )::extensions.http_request);

            if v_login.status <> 200 then
                v_problems := array_append(v_problems,
                    ('login returned HTTP ' || v_login.status)::text);
            else
                v_token := (v_login.content::jsonb) ->> 'access_token';
                select * into v_trigger from extensions.http((
                    'POST', 'https://api.dengage.com/rest/dataspace/triggerAutomatedFlow',
                    array[
                        extensions.http_header('Content-Type', 'application/json'),
                        extensions.http_header('Authorization', 'Bearer ' || v_token)
                    ],
                    'application/json',
                    json_build_object('id', v_flow_id)::text
                )::extensions.http_request);

                v_body := case when coalesce(v_trigger.content, '') = ''
                               then '{}'::jsonb else v_trigger.content::jsonb end;

                -- A 200 IS NOT SUCCESS ON THIS ENDPOINT. HasError is nested inside the
                -- body, so the status alone reports a flow that never started as one
                -- that did.
                if v_trigger.status = 200
                   and not coalesce((v_body -> 'data' ->> 'HasError')::boolean, false)
                   and coalesce((v_body ->> 'code')::integer, 0) = 0 then
                    v_triggered := true;
                    v_txn := v_body ->> 'transactionId';
                else
                    v_problems := array_append(v_problems,
                        ('flow refused: HTTP ' || v_trigger.status || ' ' ||
                         left(coalesce(v_trigger.content, ''), 200))::text);
                end if;
            end if;
        end if;
    end if;

    insert into public.dengage_sync_log
        (demos, changed_rows, triggered, transaction_id, problems)
    values (array_length(v_slugs, 1), v_changed, v_triggered, v_txn,
            case when array_length(v_problems, 1) > 0
                 then array_to_string(v_problems, ' | ') end);

    -- ACCEPTED IS NOT LOADED, and the return value says so rather than implying
    -- otherwise. The flow runs asynchronously and nothing in its reply describes the
    -- outcome.
    return jsonb_build_object(
        'demos', array_length(v_slugs, 1),
        'changed_rows', v_changed,
        'flow_triggered', v_triggered,
        'transaction_id', v_txn,
        'problems', v_problems,
        'note', 'Accepted is not loaded. dengage_sync_log keeps the history.');
end;
$$;

-- SERVICE ROLE ONLY. This function reads Vault, so anything able to call it has to be
-- treated as the Dengage credential itself. anon is public by design and ships in
-- browsers, so it is explicitly revoked rather than left to a default.
revoke all on function public.refresh_dengage_catalogues() from public, anon, authenticated;
grant execute on function public.refresh_dengage_catalogues() to service_role;

-- ---------------------------------------------------------------------------
-- The schedule.
--
-- Ten minutes is chosen for the case that matters rather than for steady state: a demo
-- built shortly before a call needs its products in Dengage within minutes. It is cheap
-- because a quiet pass is a handful of HTTP GETs and no write at all, and the ETL is
-- only triggered on real change.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
    'refresh-dengage-catalogues',
    '*/10 * * * *',
    $$select public.refresh_dengage_catalogues()$$
);

-- ---------------------------------------------------------------------------
-- THE LAST STEP, AND IT IS YOURS. The job is armed and will keep recording
-- "vault secrets are missing" until these exist. Credentials do not travel through a
-- transcript, and these should be freshly rotated ones rather than any that have.
--
--   select vault.create_secret('<api user key>', 'dengage_api_userkey');
--   select vault.create_secret('<api password>', 'dengage_api_password');
--   select vault.create_secret('<flow uuid>',    'dengage_flow_id');
--
-- To confirm it is working after that:
--
--   select public.refresh_dengage_catalogues();
--   select * from public.dengage_sync_log order by id desc limit 5;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ALIGNMENT IS CHECKED, NOT PROMISED.
--
-- Added 9 August 2026, after the first ETL run failed on
--
--   42804: column "availability" is of type boolean but expression is of type
--          character varying
--
-- and that turned out to be one misalignment of five. availability was text where
-- Dengage declares BOOLEAN, is_active was smallint against BOOLEAN,
-- product_special_code was text against INTEGER, availability_date was date against
-- DATETIME, and tags did not exist here at all: Dengage declares 28 columns and this
-- side had 27.
--
-- ONLY ONE OF THE FIVE ANNOUNCED ITSELF. The load failed on availability and stopped,
-- so the rest were invisible. Two of them would never have raised anything at all: a
-- timestamptz written into a DATETIME is converted on the way out and shifts by hours,
-- and a missing column simply never arrives. Both are the kind of fault found weeks
-- later by someone wondering why a date is wrong.
--
-- So this reads Dengage's declared schema over its own API and compares it, column by
-- column, against what the view actually offers. It reads only, and it needs the same
-- vault secrets as the refresh.
--
--   select * from public.check_dengage_alignment();
--
-- Anything other than 'ok' in the verdict column is a load waiting to fail. Last run:
-- 28 columns compared, 28 aligned, nothing missing, nothing extra, and every type
-- family pairing confirmed: TEXT to text, DECIMAL to numeric, INTEGER to integer,
-- BOOLEAN to boolean, DATETIME to timestamp without time zone.
--
-- The function body is in the database. To read it back:
--
--   select pg_get_functiondef('public.check_dengage_alignment'::regproc);
-- ---------------------------------------------------------------------------
