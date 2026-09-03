-- Harvest Local — Phase 3 part 1: the referral engine. See ARCHITECTURE.md §2.4 and §3.
--
-- Two Stripe surfaces: the BUYER discount is a reusable percent-off coupon on the Checkout
-- Session (our DB owns all attribution); the SELLER reward is a 100%-off coupon attached to the
-- subscription when a cycle reaches 3 active referrals. All the counting / idempotency / anti-abuse
-- logic lives in the SECURITY DEFINER functions below and runs in single transactions.
--
-- Lifecycle: seller makes a code -> buyer uses it at checkout (discount via Stripe coupon) ->
-- payment webhook creates a `pending` referral -> order reaches `completed` -> Inngest activates it
-- (status `active`, cycle count += 1) -> at the threshold, Inngest attaches FREE_MONTH_100 -> next
-- `invoice.paid` rotates the cycle (count resets, reward_granted preserved on the closed cycle).

set search_path = public;

-- ---------------------------------------------------------------------------
-- 2.4 promo_codes — a seller's custom, human-chosen code (stored UPPERCASE)
-- ---------------------------------------------------------------------------

create table public.promo_codes (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.seller_profiles(id) on delete cascade,
  code       text not null,
  is_active  boolean not null default true,
  times_used int not null default 0 check (times_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_code_format check (code ~ '^[A-Z0-9]{4,20}$')
);
create unique index promo_codes_code_ux on public.promo_codes (upper(code));
create index promo_codes_seller_ix on public.promo_codes (seller_id);
create trigger promo_codes_set_updated_at before update on public.promo_codes
  for each row execute function public.set_updated_at();

-- times_used is a platform-maintained stat.
create or replace function public.promo_codes_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_platform_context()
     and new.times_used is distinct from old.times_used then
    raise exception 'promo_codes.times_used is maintained by the platform';
  end if;
  return new;
end;
$$;
create trigger promo_codes_guard_columns
  before update on public.promo_codes
  for each row execute function public.promo_codes_guard_columns();

alter table public.promo_codes enable row level security;

-- Buyers need to resolve an active code at checkout; a seller always sees their own.
create policy "promo_codes: read active or own"
  on public.promo_codes for select
  using (
    is_active
    or seller_id in (select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid()))
  );

create policy "promo_codes: seller writes own"
  on public.promo_codes for all
  using (seller_id in (select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())))
  with check (seller_id in (select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 2.4 referral_cycles — one open bucket per seller; counting resets each billing cycle
-- ---------------------------------------------------------------------------

create table public.referral_cycles (
  id                      uuid primary key default gen_random_uuid(),
  seller_id               uuid not null references public.seller_profiles(id) on delete cascade,
  subscription_id         uuid not null references public.subscriptions(id) on delete cascade,
  period_start            timestamptz not null,
  period_end              timestamptz not null,
  active_referral_count   int not null default 0 check (active_referral_count >= 0),
  reward_granted          boolean not null default false,
  reward_stripe_coupon_id text,
  closed_at               timestamptz,
  created_at              timestamptz not null default now()
);
create unique index referral_cycles_one_open_ux
  on public.referral_cycles (seller_id) where closed_at is null;
create index referral_cycles_seller_ix on public.referral_cycles (seller_id, period_end);

alter table public.referral_cycles enable row level security;

create policy "referral_cycles: seller reads own"
  on public.referral_cycles for select
  using (seller_id in (select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())));
-- writes: service role only.

-- ---------------------------------------------------------------------------
-- 2.4 referrals — one row per buyer's use of a code
-- ---------------------------------------------------------------------------

create table public.referrals (
  id              uuid primary key default gen_random_uuid(),
  promo_code_id   uuid not null references public.promo_codes(id) on delete restrict,
  seller_id       uuid not null references public.seller_profiles(id) on delete cascade,   -- denormalised for counting
  buyer_id        uuid not null references public.profiles(id) on delete cascade,
  order_id        uuid not null unique references public.orders(id) on delete cascade,
  cycle_id        uuid references public.referral_cycles(id) on delete set null,           -- assigned at activation
  status          text not null default 'pending'
                    check (status in ('pending','active','invalidated')),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  activated_at    timestamptz,
  invalidated_at  timestamptz,
  created_at      timestamptz not null default now()
);
create index referrals_seller_ix on public.referrals (seller_id, status);
create index referrals_cycle_ix  on public.referrals (cycle_id);
-- A buyer counts once per seller per cycle (farming block — §3.4). App-level check is the primary
-- guard; this is the backstop for activated referrals.
create unique index referrals_one_per_buyer_seller_cycle
  on public.referrals (seller_id, buyer_id, cycle_id) where status <> 'invalidated';

alter table public.referrals enable row level security;

create policy "referrals: buyer or seller reads"
  on public.referrals for select
  using (
    buyer_id = (select auth.uid())
    or seller_id in (select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid()))
  );
-- writes: service role only.

-- ---------------------------------------------------------------------------
-- orders.promo_code_id — the column exists (Phase 2); wire up the FK now.
-- ---------------------------------------------------------------------------

alter table public.orders
  add constraint orders_promo_code_id_fkey
  foreign key (promo_code_id) references public.promo_codes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- platform_settings — the minimum order value for a referral to be eligible.
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value) values
  ('referral_min_order', '{"cents": 0}'::jsonb)
on conflict (key) do nothing;

-- ===========================================================================
-- Functions — all SECURITY DEFINER, service_role only. Single-transaction so the
-- count == threshold check and the reward flag can't race (§3.4).
-- ===========================================================================

-- Return the seller's open cycle, opening one from the subscription period if none exists.
create or replace function public.ensure_open_referral_cycle(p_seller_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_sub public.subscriptions;
begin
  perform pg_advisory_xact_lock(hashtext('referral_cycle:' || p_seller_id::text));

  select id into v_cycle_id
    from public.referral_cycles
    where seller_id = p_seller_id and closed_at is null;
  if found then
    return v_cycle_id;
  end if;

  select * into v_sub from public.subscriptions where seller_id = p_seller_id;
  if not found then
    return null;  -- no subscription yet — nothing to anchor a cycle to
  end if;

  insert into public.referral_cycles (seller_id, subscription_id, period_start, period_end)
  values (
    p_seller_id, v_sub.id,
    coalesce(v_sub.current_period_start, now()),
    coalesce(v_sub.current_period_end, now() + interval '30 days')
  )
  returning id into v_cycle_id;

  return v_cycle_id;
end;
$$;

-- First-cycle creation AND the reset: idempotent per (seller, period_start).
create or replace function public.open_referral_cycle(
  p_seller_id     uuid,
  p_period_start  timestamptz,
  p_period_end    timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_sub_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('referral_cycle:' || p_seller_id::text));

  select id into v_cycle_id
    from public.referral_cycles
    where seller_id = p_seller_id and closed_at is null and period_start = p_period_start;
  if found then
    return v_cycle_id;   -- this exact cycle is already open
  end if;

  select id into v_sub_id from public.subscriptions where seller_id = p_seller_id;
  if v_sub_id is null then
    return null;
  end if;

  update public.referral_cycles
    set closed_at = now()
    where seller_id = p_seller_id and closed_at is null;

  insert into public.referral_cycles (seller_id, subscription_id, period_start, period_end)
  values (p_seller_id, v_sub_id, p_period_start, p_period_end)
  returning id into v_cycle_id;

  return v_cycle_id;
end;
$$;

-- After payment clears: log a `pending` referral for the order's promo code.
create or replace function public.create_referral_for_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_cycle_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.promo_code_id is null or v_order.status = 'pending_payment' then
    return false;
  end if;

  if exists (select 1 from public.referrals where order_id = p_order_id) then
    return true;  -- idempotent
  end if;

  -- self-referral backstop
  if exists (
    select 1 from public.seller_profiles sp
    where sp.id = v_order.seller_id and sp.profile_id = v_order.buyer_id
  ) then
    return false;
  end if;

  v_cycle_id := public.ensure_open_referral_cycle(v_order.seller_id);

  begin
    insert into public.referrals
      (promo_code_id, seller_id, buyer_id, order_id, cycle_id, status, discount_amount)
    values
      (v_order.promo_code_id, v_order.seller_id, v_order.buyer_id, p_order_id, v_cycle_id,
       'pending', coalesce(v_order.discount_total, 0));
  exception when unique_violation then
    return false;  -- buyer already has a non-invalidated referral for this seller + cycle
  end;

  update public.promo_codes
    set times_used = times_used + 1, updated_at = now()
    where id = v_order.promo_code_id;

  return true;
end;
$$;

-- Order reached `completed`: activate the referral, count it toward the open cycle, and report
-- whether this pushed the cycle over the threshold (so the caller can attach FREE_MONTH_100).
create or replace function public.activate_referral_for_order(p_order_id uuid)
returns table (
  granted               boolean,
  reward_cycle_id       uuid,
  reward_seller_id      uuid,
  reward_subscription   text,
  cycle_count           int,
  cycle_threshold       int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_threshold int := coalesce(
    (select (value ->> 'threshold')::int from public.platform_settings where key = 'seller_referral_reward'),
    3
  );
  v_target uuid;
  v_count int;
  v_already boolean;
  v_granted boolean := false;
  v_seller uuid := (select seller_id from public.orders where id = p_order_id);
  v_sub text;
begin
  select stripe_subscription_id into v_sub from public.subscriptions where seller_id = v_seller;

  select * into v_ref from public.referrals where order_id = p_order_id for update;
  if not found then
    return query select false, null::uuid, v_seller, v_sub, 0, v_threshold;
    return;
  end if;

  if v_ref.status <> 'pending' then
    select active_referral_count into v_count from public.referral_cycles where id = v_ref.cycle_id;
    return query select false, v_ref.cycle_id, v_ref.seller_id, v_sub, coalesce(v_count, 0), v_threshold;
    return;
  end if;

  -- Count toward the referral's cycle if it's still open, otherwise the currently-open one.
  if v_ref.cycle_id is not null
     and exists (select 1 from public.referral_cycles where id = v_ref.cycle_id and closed_at is null) then
    v_target := v_ref.cycle_id;
  else
    v_target := public.ensure_open_referral_cycle(v_ref.seller_id);
  end if;

  if v_target is null then
    return query select false, null::uuid, v_ref.seller_id, v_sub, 0, v_threshold;
    return;
  end if;

  update public.referrals
    set status = 'active', activated_at = now(), cycle_id = v_target
    where id = v_ref.id;

  update public.referral_cycles
    set active_referral_count = active_referral_count + 1
    where id = v_target
    returning active_referral_count, reward_granted into v_count, v_already;

  if v_count >= v_threshold and not coalesce(v_already, false) then
    update public.referral_cycles set reward_granted = true where id = v_target;
    v_granted := true;
  end if;

  return query select v_granted, v_target, v_ref.seller_id, v_sub, coalesce(v_count, 0), v_threshold;
end;
$$;

-- Clawback: a qualifying order was cancelled. Invalidate + decrement; NEVER revoke an issued
-- coupon (§3.4) — the caller flags an admin when a granted reward drops below threshold.
create or replace function public.invalidate_referral_for_order(p_order_id uuid, p_reason text default null)
returns table (was_active boolean, reward_at_risk boolean, ref_seller_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_threshold int := coalesce(
    (select (value ->> 'threshold')::int from public.platform_settings where key = 'seller_referral_reward'),
    3
  );
  v_count int;
  v_granted boolean;
  v_was_active boolean := false;
  v_at_risk boolean := false;
begin
  select * into v_ref from public.referrals where order_id = p_order_id for update;
  if not found or v_ref.status = 'invalidated' then
    return query select false, false, (select seller_id from public.orders where id = p_order_id);
    return;
  end if;

  v_was_active := (v_ref.status = 'active');

  update public.referrals
    set status = 'invalidated', invalidated_at = now()
    where id = v_ref.id;

  if v_was_active and v_ref.cycle_id is not null then
    update public.referral_cycles
      set active_referral_count = greatest(0, active_referral_count - 1)
      where id = v_ref.cycle_id
      returning active_referral_count, reward_granted into v_count, v_granted;
    v_at_risk := coalesce(v_granted, false) and coalesce(v_count, 0) < v_threshold;
  end if;

  return query select v_was_active, v_at_risk, v_ref.seller_id;
end;
$$;

create or replace function public.set_referral_reward_coupon(p_cycle_id uuid, p_coupon_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.referral_cycles set reward_stripe_coupon_id = p_coupon_id where id = p_cycle_id;
$$;

do $$
begin
  execute 'revoke all on function public.ensure_open_referral_cycle(uuid) from public, anon, authenticated';
  execute 'revoke all on function public.open_referral_cycle(uuid, timestamptz, timestamptz) from public, anon, authenticated';
  execute 'revoke all on function public.create_referral_for_order(uuid) from public, anon, authenticated';
  execute 'revoke all on function public.activate_referral_for_order(uuid) from public, anon, authenticated';
  execute 'revoke all on function public.invalidate_referral_for_order(uuid, text) from public, anon, authenticated';
  execute 'revoke all on function public.set_referral_reward_coupon(uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.ensure_open_referral_cycle(uuid) to service_role';
  execute 'grant execute on function public.open_referral_cycle(uuid, timestamptz, timestamptz) to service_role';
  execute 'grant execute on function public.create_referral_for_order(uuid) to service_role';
  execute 'grant execute on function public.activate_referral_for_order(uuid) to service_role';
  execute 'grant execute on function public.invalidate_referral_for_order(uuid, text) to service_role';
  execute 'grant execute on function public.set_referral_reward_coupon(uuid, text) to service_role';
end $$;
