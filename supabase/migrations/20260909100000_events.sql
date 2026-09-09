-- Harvest Local — where to actually find a seller, on a date.
--
-- Markets, pickup locations and drops all answer "where and when" for an ORDER. None of them
-- answers the question a buyer asks first: what is on near me this weekend. A market page can say
-- "open Saturdays 9–3" and still not tell you that the baker you follow is only there on the second
-- Saturday of the month, or that there is a holiday market on the 14th.
--
-- An event is one appearance: a seller, a date, and usually a market to be at.
--
-- ===========================================================================
-- WALL CLOCK, NOT INSTANTS
-- ===========================================================================
-- `event_date` is a DATE and `starts_at`/`ends_at` are TIMEs, exactly like `market_hours` — because
-- "Saturday, 9am" at a market in Denton is 9am in Denton whatever the server thinks. Storing a
-- timestamptz would force us to invent a time zone per market, which we do not have and would get
-- wrong. The cost is that "is this today?" cannot be answered on a server running UTC, and that is
-- the caller's job — see `src/lib/events/schedule.ts`, and the identical note in `markets/schedule.ts`.
--
-- ===========================================================================
-- EVERY EVENT HAS A HOST SELLER
-- ===========================================================================
-- `seller_id` is NOT NULL on purpose. A market's own programme — opening day, a harvest festival —
-- is a real thing and this table could carry it, but nothing would write those rows: markets are
-- imported from the USDA directory and admin-owned, and there is no admin surface that creates
-- events. Shipping a nullable owner that no code path ever fills is the same mistake as seeding a
-- deadline nobody checked: it looks supported and is not. When a market-run event has an author,
-- that is a migration and an admin form, together.
--
-- `market_id` is the venue and IS optional — a farm open day or a driveway pop-up has no market.

set search_path = public, extensions;

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.seller_profiles(id) on delete cascade,
  /** The market this happens at, when it happens at one. */
  market_id     uuid references public.markets(id) on delete set null,

  /**
   * Frozen at write time and kept in step by trigger. Denormalised so the state-wide calendar can
   * filter without joining seller_profiles, which RLS scopes differently.
   */
  state         char(2) not null,

  title         text not null check (char_length(title) between 1 and 120),
  description   text check (description is null or char_length(description) <= 2000),

  event_date    date not null,
  starts_at     time,
  ends_at       time,

  /** Where, when it isn't a market. Free text — a pop-up address is the seller's to phrase. */
  location_text text check (location_text is null or char_length(location_text) <= 200),

  status           text not null default 'published'
                     check (status in ('published', 'hidden', 'cancelled')),
  /** Why it was called off. Shown to buyers — a cancelled event with no reason reads as a mistake. */
  cancelled_note   text check (cancelled_note is null or char_length(cancelled_note) <= 300),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint events_span check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  -- An end time with no start is not a time.
  constraint events_end_needs_start check (ends_at is null or starts_at is not null),
  constraint events_venue check (market_id is not null or location_text is not null)
);

create index events_state_date_ix on public.events (state, event_date) where status = 'published';
create index events_market_ix on public.events (market_id, event_date) where status = 'published';
create index events_seller_ix on public.events (seller_id, event_date desc);

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

comment on table public.events is
  'One seller appearance: a date, a wall-clock time, and usually a market. event_date/starts_at are '
  'local to the venue and must never be compared against a UTC server clock — see lib/events/schedule.ts.';

-- ===========================================================================
-- The event stays in one state, and so does its venue.
--
-- Same shape as `pickup_locations_guard_market_state`, and for the same reason: the discovery layer
-- is the third place CLAUDE.md rule 1 is enforced. A calendar that advertises an out-of-state seller
-- at a local market invites an order that the data layer will then refuse — better to make the
-- listing impossible than the disappointment.
--
-- `state` is derived, never supplied: taking it from the seller means it cannot drift from the
-- storefront it belongs to, and a seller who moves state takes their future events with them.
-- ===========================================================================
create or replace function public.events_set_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_seller_state char(2);
  v_market_state char(2);
begin
  select home_state into v_seller_state
    from public.seller_profiles where id = new.seller_id;
  if v_seller_state is null then
    raise exception 'no such seller' using errcode = 'foreign_key_violation';
  end if;

  new.state := v_seller_state;

  if new.market_id is not null then
    select state into v_market_state from public.markets where id = new.market_id;
    if v_market_state is distinct from v_seller_state then
      raise exception 'an event must be at a market in the seller''s own state (% is in %)',
        new.market_id, coalesce(v_market_state, 'nowhere')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger events_set_state
  before insert or update on public.events
  for each row execute function public.events_set_state();

-- ===========================================================================
-- RLS
--
-- Reads are public for a published event on a live storefront — a calendar nobody can read is a
-- diary. A seller closed for a holiday keeps their events visible (`vacation`), the same exception
-- the storefront page makes; one closed by us does not, because that storefront is not trading.
-- ===========================================================================
alter table public.events enable row level security;

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

create policy "events: public read published"
  on public.events for select
  using (
    (
      status = 'published'
      and exists (
        select 1 from public.seller_profiles sp
         where sp.id = events.seller_id
           and (sp.is_paused = false or sp.pause_reason = 'vacation')
      )
    )
    or seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
    -- `is_admin()` is revoked from anon by design, so admins are matched inline.
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy "events: seller writes own"
  on public.events for all
  using (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );
