-- Harvest Local — pre-orders against a limited bake.
--
-- A cottage baker's core problem is baking to demand rather than to guess. "Twenty loaves for
-- Saturday, order by Thursday" is how the trade already works, and nothing here could express it:
-- `quantity_available` is an open-ended shelf, not a batch with a deadline attached.
--
-- A drop is one batch of one listing: an order window, a collection date, and a hard cap.
--
-- =========================================================================
-- WHEN THIS GOES WRONG IT MUST UNDER-SELL, NEVER OVER-SELL
-- =========================================================================
-- The cap is not a stock level, it is a physical fact. A seller handed a twenty-first order for a
-- twenty-loaf bake cannot solve it at 6am on Saturday; a seller who sold nineteen can take the
-- twentieth by hand. So every mechanism here is arranged so that a failure leaves units unsold
-- rather than oversold:
--
--   * `units_claimed` is a counter with a CHECK against the cap, incremented under a row lock. Two
--     buyers racing for the last loaf serialise, and the second is refused by the constraint rather
--     than by a count that was read a moment ago and is now stale. Counting live rows instead would
--     be prettier and would lose that race, because the order rows are written in a later statement
--     than the count.
--   * a claim is taken BEFORE the order is written. If the order then fails, the release path runs;
--     if the release is somehow missed, the drop reads as sold out and a person can fix it. The
--     opposite arrangement — write the order, then claim — fails the other way.
--
-- One drop at a time per product, enforced by an exclusion constraint rather than by a convention:
-- two overlapping order windows on one listing have no answer to "which batch is this order for",
-- and that ambiguity would reach the buyer as a wrong collection date.

set search_path = public, extensions;

create extension if not exists btree_gist with schema extensions;

create table public.product_drops (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.seller_profiles(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,

  /** What the buyer sees it called: "Saturday 14 December bake". */
  name         text not null check (char_length(name) between 1 and 80),

  /** When orders may be placed. `opens_at` null = open from creation. */
  opens_at     timestamptz,
  closes_at    timestamptz not null,

  /** When they collect. A date plus the seller's own words for the time. */
  fulfillment_date date not null,
  pickup_window    text check (pickup_window is null or char_length(pickup_window) <= 120),
  pickup_location_id uuid references public.pickup_locations(id) on delete set null,

  unit_cap      int not null check (unit_cap > 0 and unit_cap <= 10000),
  units_claimed int not null default 0 check (units_claimed >= 0),

  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- The whole point, at the data layer.
  constraint product_drops_within_cap check (units_claimed <= unit_cap),
  constraint product_drops_window check (opens_at is null or closes_at > opens_at)
);

create index product_drops_product_ix on public.product_drops (product_id, closes_at desc);
create index product_drops_seller_ix on public.product_drops (seller_id, fulfillment_date desc);

-- One live drop at a time per listing. `tstzrange` with a null lower bound is unbounded below,
-- which is what "open from creation" means.
alter table public.product_drops
  add constraint product_drops_no_overlap
  exclude using gist (
    product_id with =,
    tstzrange(coalesce(opens_at, '-infinity'::timestamptz), closes_at) with &&
  )
  where (cancelled_at is null);

create trigger product_drops_set_updated_at before update on public.product_drops
  for each row execute function public.set_updated_at();

comment on table public.product_drops is
  'One batch of one listing: an order window, a collection date, a hard cap. Claims are counted in '
  'units_claimed under a row lock so a race under-sells rather than over-sells.';

-- The order's link back, frozen like every other order fact.
alter table public.order_items
  add column if not exists drop_id uuid references public.product_drops(id) on delete set null,
  add column if not exists drop_snapshot text
    constraint order_items_drop_snapshot_len check (
      drop_snapshot is null or char_length(drop_snapshot) <= 160
    );

-- ===========================================================================
-- claim_drop_units — the only way units leave a drop.
--
-- SECURITY DEFINER because it is called by the checkout path with the service role and must hold a
-- row lock; it makes no authorization decision of its own (the caller has already established whose
-- order this is) and therefore never consults `current_user`.
--
-- Raises rather than returns false, so a caller that forgets to check still cannot oversell.
-- ===========================================================================
create or replace function public.claim_drop_units(p_drop_id uuid, p_units int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.product_drops;
begin
  if p_units is null or p_units < 1 then
    raise exception 'a claim needs at least one unit';
  end if;

  -- The lock is what makes two buyers racing for the last loaf serialise.
  select * into v_drop from public.product_drops where id = p_drop_id for update;
  if not found then
    raise exception 'no such drop' using errcode = 'no_data_found';
  end if;

  if v_drop.cancelled_at is not null then
    raise exception 'this batch was cancelled' using errcode = 'check_violation';
  end if;
  if v_drop.opens_at is not null and now() < v_drop.opens_at then
    raise exception 'orders for this batch have not opened yet' using errcode = 'check_violation';
  end if;
  if now() >= v_drop.closes_at then
    raise exception 'orders for this batch have closed' using errcode = 'check_violation';
  end if;
  if v_drop.units_claimed + p_units > v_drop.unit_cap then
    raise exception 'only % left in this batch', v_drop.unit_cap - v_drop.units_claimed
      using errcode = 'check_violation';
  end if;

  update public.product_drops
     set units_claimed = units_claimed + p_units
   where id = p_drop_id
     returning units_claimed into v_drop.units_claimed;

  return v_drop.units_claimed;
end;
$$;

revoke all on function public.claim_drop_units(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_drop_units(uuid, int) to service_role;

-- ===========================================================================
-- release_drop_units_for_order — give the units back.
--
-- Keyed on the ORDER rather than on a number, and idempotent: it clears `drop_id` off the items as
-- it goes, so a second call finds nothing to release. That matters because the callers are a Stripe
-- webhook and a status transition, both of which can run twice (CLAUDE.md rule 2).
-- ===========================================================================
create or replace function public.release_drop_units_for_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_total   int := 0;
begin
  for v_row in
    select drop_id, sum(quantity)::int as units
      from public.order_items
     where order_id = p_order_id and drop_id is not null
     group by drop_id
  loop
    update public.product_drops
       set units_claimed = greatest(0, units_claimed - v_row.units)
     where id = v_row.drop_id;
    v_total := v_total + v_row.units;
  end loop;

  -- Idempotence: the link is what a release consumes.
  update public.order_items
     set drop_id = null
   where order_id = p_order_id and drop_id is not null;

  return v_total;
end;
$$;

revoke all on function public.release_drop_units_for_order(uuid) from public, anon, authenticated;
grant execute on function public.release_drop_units_for_order(uuid) to service_role;

-- ===========================================================================
-- RLS — a drop is as public as the listing it belongs to.
-- ===========================================================================
alter table public.product_drops enable row level security;

grant select on public.product_drops to anon, authenticated;
grant insert, update, delete on public.product_drops to authenticated;
grant all on public.product_drops to service_role;

create policy "drops: public read live"
  on public.product_drops for select
  using (
    exists (
      select 1 from public.products p
       where p.id = product_drops.product_id
         and (
           p.status = 'active'
           or p.seller_id in (
             select sp.id from public.seller_profiles sp
              where sp.profile_id = (select auth.uid())
           )
         )
    )
  );

create policy "drops: seller writes own"
  on public.product_drops for all
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

-- ===========================================================================
-- A seller may not move the counter by hand.
--
-- `units_claimed` is the record of real orders. An UPDATE policy wide enough to let a seller edit
-- the name and the cap is wide enough to let them zero the count, which would oversell the batch —
-- so the column is frozen outside a trusted context, the same shape as `reviews_guard_columns`.
-- The cap itself stays editable, because a seller who decides to bake five more should be able to
-- say so; the CHECK stops them setting it below what is already claimed.
-- ===========================================================================
create or replace function public.product_drops_guard_claims()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_platform_context() then
    return new;
  end if;
  if new.units_claimed is distinct from old.units_claimed
     or new.product_id is distinct from old.product_id
     or new.seller_id is distinct from old.seller_id then
    raise exception 'units_claimed is maintained by the platform'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger product_drops_guard_claims
  before update on public.product_drops
  for each row execute function public.product_drops_guard_claims();
