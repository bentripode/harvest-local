-- Harvest Local — farmers markets as a first-class entity.
--
-- A market is a real place that exists whether or not anyone on Harvest Local sells there. Giving
-- each one a permanent public page does four jobs at once: it is the discovery surface a buyer
-- searches for by name, the cold-start page that is useful with zero inventory, the place a buyer
-- can ask for sellers before any exist, and — once `pickup_locations` lands — the fulfilment
-- primitive a seller attaches a booth to.
--
-- Markets are per-state by nature, which is why this is the one high-volume public surface that
-- cannot imply a cross-state purchase (CLAUDE.md rule 1): a market page only ever lists sellers in
-- its own state, and the URL carries the state.
--
-- On data honesty. Rows are imported from the USDA Local Food Directory (public domain) by
-- `scripts/import-markets.mjs`, and NOTHING here is seeded by hand — a farmers market a buyer
-- might drive to is not a thing to guess at, and the upstream directory is missing operating times
-- for a large share of its listings. So `hours_text` keeps the source's own words when it has any,
-- and `market_hours` — the structured rows that drive "open Saturday 9-3" and next-occurrence —
-- exists separately and stays empty until a real schedule is entered. An absent schedule renders
-- as "check the market's own listing", never as an invented time.

set search_path = public, extensions;

-- ===========================================================================
-- markets
-- ===========================================================================
create table public.markets (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  name              text not null,
  state             char(2) not null,
  city              text,
  -- Single-line as the directory supplies it. A market is a public venue, so unlike a seller's
  -- pickup address there is nothing here to withhold.
  address_text      text,
  postal_code       text,
  location          extensions.geography(Point, 4326),

  season_text       text,   -- e.g. "Year Round", "May to October" — upstream's words
  hours_text        text,   -- upstream's free-text operating times, often absent
  website_url       text,
  phone             text,

  -- Provenance. `source_id` is the directory's own stable id, which is what makes a re-import an
  -- update rather than a duplicate.
  source            text not null default 'admin'
                      check (source in ('usda', 'admin', 'suggested')),
  source_id         text,
  source_updated_at timestamptz,

  status            text not null default 'published'
                      check (status in ('published', 'hidden')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint markets_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- The URL is /markets/<state>/<slug>, so the slug only has to be unique inside a state —
-- "downtown-farmers-market" exists in a dozen of them.
create unique index markets_state_slug_ux on public.markets (state, slug);
create unique index markets_source_ux
  on public.markets (source, source_id) where source_id is not null;
create index markets_state_name_ix on public.markets (state, name);
create index markets_location_gix on public.markets using gist (location);

create trigger markets_set_updated_at before update on public.markets
  for each row execute function public.set_updated_at();

comment on column public.markets.hours_text is
  'The directory''s own free-text operating times. Often null upstream — absent means unknown, not closed.';
comment on table public.markets is
  'Public farmers-market directory. Imported, never hand-seeded; see scripts/import-markets.mjs.';

-- ===========================================================================
-- market_hours — the structured schedule, entered rather than imported.
--
-- `day_of_week` is 0 = Sunday to match JS `Date.getDay()`, so the next-occurrence arithmetic in
-- src/lib/markets/schedule.ts needs no translation table.
-- ===========================================================================
create table public.market_hours (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references public.markets(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens       time not null,
  closes      time not null,
  note        text,
  created_at  timestamptz not null default now(),
  constraint market_hours_span check (closes > opens)
);
create index market_hours_market_ix on public.market_hours (market_id, day_of_week);
create unique index market_hours_slot_ux
  on public.market_hours (market_id, day_of_week, opens);

-- ===========================================================================
-- market_watchers — "tell me when sellers start selling here".
--
-- A waitlist, deliberately open to signed-out visitors: the whole value of an empty market page is
-- capturing interest before supply exists, and requiring an account first would collect nothing.
-- Rows are write-only from the client's point of view — there is no SELECT policy for the general
-- case, so the list cannot be enumerated or scraped back out.
-- ===========================================================================
create table public.market_watchers (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid not null references public.markets(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  email      text not null
               check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now()
);
create unique index market_watchers_ux on public.market_watchers (market_id, lower(email));
create index market_watchers_market_ix on public.market_watchers (market_id);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.markets enable row level security;
alter table public.market_hours enable row level security;
alter table public.market_watchers enable row level security;

create policy "markets: public read published"
  on public.markets for select
  using (status = 'published' or public.is_admin());

create policy "markets: admin write"
  on public.markets for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "market_hours: public read"
  on public.market_hours for select
  using (
    exists (
      select 1 from public.markets m
      where m.id = market_hours.market_id and (m.status = 'published' or public.is_admin())
    )
  );

create policy "market_hours: admin write"
  on public.market_hours for all
  using (public.is_admin())
  with check (public.is_admin());

-- Anyone may add themselves to a published market's waitlist, and may not claim someone else's
-- account while doing it. Throttling is `tryRateLimit` in the server action, keyed by IP.
create policy "market_watchers: anyone joins a published market"
  on public.market_watchers for insert
  with check (
    (profile_id is null or profile_id = (select auth.uid()))
    and exists (
      select 1 from public.markets m where m.id = market_id and m.status = 'published'
    )
  );

create policy "market_watchers: read own"
  on public.market_watchers for select
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy "market_watchers: remove own"
  on public.market_watchers for delete
  using (profile_id = (select auth.uid()) or public.is_admin());

-- ===========================================================================
-- upsert_market — the only way to write the PostGIS point through PostgREST, and the importer's
-- entry point. Same shape as `upsert_address`, but trusted-caller rather than owner-scoped:
-- SECURITY DEFINER, so it guards on `is_service_role()` / `is_admin()` and never on `current_user`,
-- which in a DEFINER body is the function owner and would authorize everybody (CLAUDE.md).
--
-- Keyed on (source, source_id) so re-running an import updates in place. The slug is only set on
-- insert — a published URL should not move because upstream renamed a market.
-- ===========================================================================
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
    raise exception 'upsert_market is not callable by this role'
      using errcode = 'insufficient_privilege';
  end if;

  if p_source_id is null or btrim(p_source_id) = '' then
    raise exception 'upsert_market requires a source_id to stay idempotent';
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
  on conflict (source, source_id) do update set
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
  'Idempotent market import keyed on (source, source_id). Service-role/admin only; never renames a published slug.';
