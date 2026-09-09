-- Harvest Local — a seller collects from more than one place.
--
-- A cottage seller works two or three markets plus their own porch, and `seller_profiles` could
-- only express one address. This adds the collection points as their own entity, each with its own
-- schedule, its own lead time and — where the seller has a booth at a market in the directory — a
-- link to that market, which is what finally puts sellers on a market page.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: replace `seller_profiles.pickup_address_id`.
--
-- That column looks like a pickup address and is not one. `product_label_disclosure()` joins it in
-- fourteen migrations to print `producer_address`, `municipality` and `county_of_preparation` — the
-- label element whose caption is "Address where the food was made". A farmers-market booth is not
-- where the food was made. Folding it into a collection of pickup points would make a seller whose
-- only booth is at a market print that market's address as their production address, onto food,
-- under a statute that requires the real one. It is also the origin `delivery_route_inputs()`
-- measures the delivery radius from, which is the kitchen and not the booth.
--
-- So the two facts stay separate: `pickup_address_id` is where the food is MADE, and
-- `pickup_locations` is where a buyer COLLECTS it. Existing sellers are backfilled with one
-- collection point at their production address, which is what they have today.

set search_path = public, extensions;

comment on column public.seller_profiles.pickup_address_id is
  'The seller''s PRODUCTION address: the label''s "made at" element and the delivery-radius origin. '
  'Not a collection point — those are rows in pickup_locations.';

-- ===========================================================================
-- pickup_locations
-- ===========================================================================
create table public.pickup_locations (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.seller_profiles(id) on delete cascade,

  -- A booth at a market in the public directory. When set, the market supplies the place and the
  -- seller appears on that market's page.
  market_id    uuid references public.markets(id) on delete set null,
  -- Anywhere else: a farmstand, a porch, a car park. Owner-only, like every `addresses` row.
  address_id   uuid references public.addresses(id) on delete set null,

  label        text not null check (char_length(label) between 1 and 80),
  -- "White tent by the north entrance." What the buyer needs to find you once they're there.
  description  text check (char_length(description) <= 400),

  -- Denormalised so a buyer can be shown roughly where this is without reading `addresses`, which
  -- is owner-only for good reason: for a home-based seller it is their house.
  city         text,
  postal_code  text,

  /**
   * Hours of notice the seller needs before a slot. An order placed inside the window is offered
   * the next slot instead, so a baker is never handed an order for a loaf due in twenty minutes.
   */
  prep_hours   int not null default 0 check (prep_hours between 0 and 336),

  is_active    boolean not null default true,
  sort_order   int not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- It has to be somewhere.
  constraint pickup_locations_where check (market_id is not null or address_id is not null)
);

create index pickup_locations_seller_ix on public.pickup_locations (seller_id, sort_order);
-- The market page's read: who collects here.
create index pickup_locations_market_ix
  on public.pickup_locations (market_id) where market_id is not null and is_active;
-- One booth per market per seller; two would be two entries in the same list.
create unique index pickup_locations_seller_market_ux
  on public.pickup_locations (seller_id, market_id) where market_id is not null;

create trigger pickup_locations_set_updated_at before update on public.pickup_locations
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- pickup_slots — when the seller is actually standing there.
--
-- `day_of_week` is 0 = Sunday, matching Date.getDay() and `market_hours`, so the arithmetic in
-- src/lib/orders/pickup-schedule.ts needs no translation table.
--
-- `weeks_of_month` is the reason this is not just a weekly rule: "first and third Saturdays" is an
-- ordinary way to run a stall, and neither a weekly slot nor free text can express it. Empty means
-- every week.
--
-- `specific_date` covers the one-off — a holiday fair, a pop-up — which would otherwise be a
-- recurring slot the seller has to remember to delete.
-- ===========================================================================
create table public.pickup_slots (
  id             uuid primary key default gen_random_uuid(),
  location_id    uuid not null references public.pickup_locations(id) on delete cascade,

  day_of_week    smallint check (day_of_week between 0 and 6),
  specific_date  date,

  opens          time not null,
  closes         time not null,
  weeks_of_month smallint[] not null default '{}',

  created_at     timestamptz not null default now(),

  constraint pickup_slots_when check (
    (day_of_week is not null and specific_date is null)
    or (day_of_week is null and specific_date is not null)
  ),
  constraint pickup_slots_span check (closes > opens),
  constraint pickup_slots_weeks check (
    weeks_of_month <@ array[1, 2, 3, 4, 5]::smallint[]
    and (specific_date is null or cardinality(weeks_of_month) = 0)
  )
);

create index pickup_slots_location_ix on public.pickup_slots (location_id);

-- ===========================================================================
-- The order's snapshot.
--
-- Frozen like every other order fact: `pickup_location_text` keeps the order readable after the
-- seller renames or deletes the location, exactly as `delivery_address_text` does for delivery.
-- `pickup_window` is the pickup-side counterpart of `delivery_window`.
-- ===========================================================================
alter table public.orders
  add column if not exists pickup_location_id uuid
    references public.pickup_locations(id) on delete set null,
  add column if not exists pickup_location_text text
    constraint orders_pickup_location_text_len check (
      pickup_location_text is null or length(pickup_location_text) <= 300
    ),
  add column if not exists pickup_window text
    constraint orders_pickup_window_len check (
      pickup_window is null or length(pickup_window) <= 120
    );

comment on column public.orders.pickup_location_text is
  'Snapshot of where the buyer collects. Survives the location being renamed or deleted.';

-- ===========================================================================
-- Backfill: every seller with a production address gets one collection point there, which is what
-- they have today. Named "Pickup" to match the label the settings form has always written.
-- ===========================================================================
insert into public.pickup_locations (seller_id, address_id, label, city, postal_code, sort_order)
select sp.id, sp.pickup_address_id, 'Pickup', a.city, a.postal_code, 0
  from public.seller_profiles sp
  join public.addresses a on a.id = sp.pickup_address_id
 where sp.pickup_address_id is not null;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.pickup_locations enable row level security;
alter table public.pickup_slots enable row level security;

-- A buyer has to see where they'd collect before they order, so these are readable exactly when
-- the storefront is: live sellers only, plus the owner and admins.
create policy "pickup locations: public read live"
  on public.pickup_locations for select
  using (
    exists (
      select 1 from public.seller_profiles sp
      where sp.id = pickup_locations.seller_id
        and (
          (sp.is_paused = false and pickup_locations.is_active)
          or sp.profile_id = (select auth.uid())
        )
    )
    or public.is_admin()
  );

create policy "pickup locations: seller writes own"
  on public.pickup_locations for all
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

create policy "pickup slots: public read"
  on public.pickup_slots for select
  using (
    exists (
      select 1
        from public.pickup_locations pl
        join public.seller_profiles sp on sp.id = pl.seller_id
       where pl.id = pickup_slots.location_id
         and (
           (sp.is_paused = false and pl.is_active)
           or sp.profile_id = (select auth.uid())
         )
    )
    or public.is_admin()
  );

create policy "pickup slots: seller writes own"
  on public.pickup_slots for all
  using (
    location_id in (
      select pl.id
        from public.pickup_locations pl
        join public.seller_profiles sp on sp.id = pl.seller_id
       where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    location_id in (
      select pl.id
        from public.pickup_locations pl
        join public.seller_profiles sp on sp.id = pl.seller_id
       where sp.profile_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- A booth may only be attached to a market in the seller's own selling state.
--
-- Not a cosmetic check. A market page lists the sellers who collect there, and an out-of-state
-- booth would put a seller in front of buyers who cannot lawfully order from them
-- (CLAUDE.md rule 1). Refused at the data layer so no request handler can forget.
-- ===========================================================================
create or replace function public.pickup_locations_guard_market_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_seller_state char(2);
  v_market_state char(2);
begin
  if new.market_id is null then
    return new;
  end if;

  select home_state into v_seller_state
    from public.seller_profiles where id = new.seller_id;
  select state into v_market_state
    from public.markets where id = new.market_id;

  if v_market_state is distinct from v_seller_state then
    raise exception 'a pickup location must be at a market in the seller''s own state (% is in %)',
      new.market_id, coalesce(v_market_state, 'nowhere')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger pickup_locations_guard_market_state
  before insert or update on public.pickup_locations
  for each row execute function public.pickup_locations_guard_market_state();
