-- Harvest Local — sales caps that aren't annual totals.
--
-- `record_order_revenue` has always read one number: `state_cottage_food_rules.revenue_cap`, treated
-- as an annual total. Three of the seeded programs don't work that way:
--
--   * Colorado caps $10,000 PER PRODUCT, not overall. A baker with six products has six caps.
--   * Virginia has no general cap but caps acidified and pickled foods at $3,000 — a cap on one
--     CATEGORY of food, with everything else uncapped.
--   * Minnesota ($7,665) and Vermont ($6,500 / $10,000) use thresholds that trigger LICENSING
--     rather than stopping sales. Pausing a seller who crosses one would be wrong: they are still
--     entitled to trade, they just need a permit.
--
-- So the cap now resolves from the seller's chosen program, and the basis decides how it is
-- counted. `seller_revenue_tracking` keeps the annual total it always had — it is what the seller's
-- compliance page shows — and per-product and per-category tallies live in their own buckets.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Buckets: one row per (seller, year, basis, key). Only used by the non-annual bases.
-- ---------------------------------------------------------------------------
create table public.seller_revenue_buckets (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.seller_profiles(id) on delete cascade,
  period_year   int not null,
  basis         text not null check (basis in ('per_product', 'per_category')),
  -- A product id for per_product; a regulatory axis ('acidified', …) for per_category.
  bucket_key    text not null,
  gross_revenue numeric(12,2) not null default 0 check (gross_revenue >= 0),
  cap_amount    numeric(12,2),
  is_over_cap   boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (seller_id, period_year, basis, bucket_key)
);

create index seller_revenue_buckets_over_ix on public.seller_revenue_buckets (seller_id, is_over_cap);

comment on table public.seller_revenue_buckets is
  'Per-product and per-category revenue tallies, for the states whose cap is not an annual total. '
  'The annual total stays in seller_revenue_tracking.';

alter table public.seller_revenue_buckets enable row level security;

create policy "revenue buckets: seller reads own"
  on public.seller_revenue_buckets for select
  using (seller_id in (
    select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
  ));

-- No client write policy: every writer is record_order_revenue, running as the service role.

-- ---------------------------------------------------------------------------
-- Crossing a licensing threshold is a prompt, not a pause. Recorded so it prompts once.
-- ---------------------------------------------------------------------------
alter table public.seller_revenue_tracking
  add column if not exists license_threshold_crossed_at timestamptz;

comment on column public.seller_revenue_tracking.license_threshold_crossed_at is
  'When the seller passed their program''s license_threshold. Minnesota and Vermont use a number '
  'that requires a licence above it rather than stopping sales, so this prompts once and never '
  'pauses the storefront.';

-- ---------------------------------------------------------------------------
-- record_order_revenue, rewritten.
--
-- Same contract and same idempotency guard (`orders.revenue_recorded_at`); what changes is where
-- the cap comes from and how it is counted.
-- ---------------------------------------------------------------------------
create or replace function public.record_order_revenue(p_order_id uuid)
returns table (gross numeric, cap numeric, over boolean, paused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order     public.orders;
  v_year      int := extract(year from now())::int;
  v_amount    numeric(12,2);
  v_cap       numeric(12,2);
  v_basis     text := 'annual_total';
  v_cap_cat   text;
  v_threshold numeric(12,2);
  v_program   uuid;
  v_gross     numeric(12,2);
  v_was_over  boolean;
  v_over      boolean;
  v_paused    boolean := false;
  v_crossed   timestamptz;
  v_ratio     numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found
     or v_order.status <> 'completed'
     or v_order.revenue_recorded_at is not null then
    select srt.gross_revenue, srt.cap_amount, srt.is_over_cap
      into v_gross, v_cap, v_over
      from public.seller_revenue_tracking srt
      where srt.seller_id = v_order.seller_id
        and srt.state = v_order.seller_state
        and srt.period_year = v_year;
    return query select coalesce(v_gross, 0)::numeric, v_cap, coalesce(v_over, false), false;
    return;
  end if;

  v_amount := greatest(coalesce(v_order.subtotal, 0) - coalesce(v_order.discount_total, 0), 0);

  -- The cap comes from the seller's chosen program; without one, the state's legacy figure.
  select sp.food_program_id into v_program
    from public.seller_profiles sp where sp.id = v_order.seller_id;

  if v_program is not null then
    select fp.revenue_cap, fp.cap_basis, fp.cap_category, fp.license_threshold
      into v_cap, v_basis, v_cap_cat, v_threshold
      from public.state_food_programs fp where fp.id = v_program;
  else
    select revenue_cap into v_cap
      from public.state_cottage_food_rules where state_code = v_order.seller_state;
  end if;

  -- The annual tally is kept regardless of basis: it is what the compliance page shows.
  insert into public.seller_revenue_tracking (seller_id, state, period_year, gross_revenue, cap_amount)
  values (v_order.seller_id, v_order.seller_state, v_year, v_amount,
          case when v_basis = 'annual_total' then v_cap else null end)
  on conflict (seller_id, state, period_year) do update
    set gross_revenue = public.seller_revenue_tracking.gross_revenue + excluded.gross_revenue,
        cap_amount    = excluded.cap_amount,
        updated_at    = now()
  returning gross_revenue, is_over_cap, license_threshold_crossed_at
    into v_gross, v_was_over, v_crossed;

  -- Proportional share of the order's discounted total, so a bucket never counts more than the
  -- seller was actually paid.
  v_ratio := case when coalesce(v_order.subtotal, 0) > 0 then v_amount / v_order.subtotal else 0 end;

  if v_basis = 'per_product' then
    insert into public.seller_revenue_buckets (seller_id, period_year, basis, bucket_key, gross_revenue, cap_amount)
    select v_order.seller_id, v_year, 'per_product', oi.product_id::text,
           round(sum(oi.line_total) * v_ratio, 2), v_cap
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
      group by oi.product_id
    on conflict (seller_id, period_year, basis, bucket_key) do update
      set gross_revenue = public.seller_revenue_buckets.gross_revenue + excluded.gross_revenue,
          cap_amount    = excluded.cap_amount,
          updated_at    = now();

  elsif v_basis = 'per_category' then
    -- Only the capped category is tallied; Virginia leaves everything else uncapped.
    insert into public.seller_revenue_buckets (seller_id, period_year, basis, bucket_key, gross_revenue, cap_amount)
    select v_order.seller_id, v_year, 'per_category', axis,
           round(sum(oi.line_total) * v_ratio, 2), v_cap
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      join public.categories c on c.id = p.category_id
      cross join lateral unnest(c.food_axes) as axis
      where oi.order_id = p_order_id
        and (v_cap_cat is null or axis = v_cap_cat)
      group by axis
    on conflict (seller_id, period_year, basis, bucket_key) do update
      set gross_revenue = public.seller_revenue_buckets.gross_revenue + excluded.gross_revenue,
          cap_amount    = excluded.cap_amount,
          updated_at    = now();
  end if;

  -- Over the cap?
  if v_basis = 'annual_total' then
    v_over := v_cap is not null and v_gross >= v_cap;
    update public.seller_revenue_tracking
      set is_over_cap = v_over, updated_at = now()
      where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
  else
    update public.seller_revenue_buckets
      set is_over_cap = (cap_amount is not null and gross_revenue >= cap_amount), updated_at = now()
      where seller_id = v_order.seller_id and period_year = v_year and basis = v_basis;

    select exists (
      select 1 from public.seller_revenue_buckets
      where seller_id = v_order.seller_id and period_year = v_year and basis = v_basis and is_over_cap
    ) into v_over;

    v_was_over := coalesce(v_was_over, false);
    update public.seller_revenue_tracking
      set is_over_cap = v_over, updated_at = now()
      where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
  end if;

  if v_over and not coalesce(v_was_over, false) then
    update public.seller_profiles
      set is_paused = true, pause_reason = 'revenue_cap'
      where id = v_order.seller_id;
    v_paused := true;
  end if;

  -- A licensing threshold is NOT a cap: record the crossing once, never pause.
  if v_threshold is not null and v_gross >= v_threshold and v_crossed is null then
    update public.seller_revenue_tracking
      set license_threshold_crossed_at = now()
      where seller_id = v_order.seller_id and state = v_order.seller_state and period_year = v_year;
  end if;

  update public.orders set revenue_recorded_at = now() where id = p_order_id;

  return query select v_gross, v_cap, v_over, v_paused;
end;
$$;

revoke all on function public.record_order_revenue(uuid) from public, anon, authenticated;
grant execute on function public.record_order_revenue(uuid) to service_role;
