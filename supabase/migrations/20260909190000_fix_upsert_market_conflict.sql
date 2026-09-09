-- Harvest Local — `upsert_market` has never successfully inserted a market.
--
-- `markets_source_ux` is a PARTIAL unique index:
--
--     create unique index markets_source_ux
--       on public.markets (source, source_id) where source_id is not null;
--
-- and `upsert_market` says `on conflict (source, source_id) do update`. Postgres will not match a
-- conflict target against a partial index unless the statement repeats the index's predicate, so
-- every call failed with:
--
--     there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- The function is granted to `service_role` alone and the only caller is `scripts/import-markets.mjs`,
-- which had never completed a run — the portal was returning 403 to its user-agent, which was read
-- as the portal being down. Two independent faults on the same path, and the second one was hidden
-- behind the first: fixing the fetch is what finally surfaced this.
--
-- The fix is to state the predicate, which is what makes the index usable as an arbiter. The
-- partial index is right and stays: `source_id` is null for a hand-entered market, and several of
-- those must be able to coexist without colliding on (source, null).

set search_path = public, extensions;

create or replace function public.upsert_market(
  p_source     text,
  p_source_id  text,
  p_slug       text,
  p_name       text,
  p_state      text,
  p_city       text,
  p_address    text,
  p_postal     text,
  p_lng        double precision,
  p_lat        double precision,
  p_season     text,
  p_hours      text,
  p_website    text,
  p_phone      text,
  p_source_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id  uuid;
  v_loc extensions.geography;
begin
  if not (public.is_service_role() or public.is_admin()) then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if p_source_id is null or btrim(p_source_id) = '' then
    raise exception 'upsert_market needs a source_id to key on'
      using errcode = 'null_value_not_allowed';
  end if;

  v_loc := case
             when p_lng is null or p_lat is null then null
             else ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
           end;

  insert into public.markets as m (
    source, source_id, slug, name, state, city, address_text, postal_code,
    location, season_text, hours_text, website_url, phone, source_updated_at
  )
  values (
    p_source, p_source_id, p_slug, p_name, upper(p_state), p_city, p_address, p_postal,
    v_loc, p_season, p_hours, p_website, p_phone, p_source_updated_at
  )
  -- The predicate is what lets Postgres pick `markets_source_ux` as the arbiter. Without it the
  -- statement does not match any index and the whole call fails.
  on conflict (source, source_id) where source_id is not null do update set
    -- slug deliberately absent: the URL is published and must not move.
    name              = excluded.name,
    state             = excluded.state,
    city              = excluded.city,
    address_text      = excluded.address_text,
    postal_code       = excluded.postal_code,
    location          = excluded.location,
    season_text       = excluded.season_text,
    hours_text        = excluded.hours_text,
    website_url       = excluded.website_url,
    phone             = excluded.phone,
    source_updated_at = excluded.source_updated_at,
    updated_at        = now()
  returning m.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_market(
  text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.upsert_market(
  text, text, text, text, text, text, text, text,
  double precision, double precision, text, text, text, text, timestamptz
) to service_role;

comment on function public.upsert_market is
  'Importer entry point, service-role only. The ON CONFLICT target carries the partial index''s '
  'predicate; without it no arbiter matches and every call fails (see 20260909190000). Also '
  'refuses a null source_id outright, since a row keyed on nothing cannot be upserted.';
