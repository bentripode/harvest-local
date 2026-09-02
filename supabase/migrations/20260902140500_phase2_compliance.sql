-- Harvest Local — Phase 2 part 2: compliance guardrails (revenue caps, license/ID expiry) + the
-- notifications queue. See ARCHITECTURE.md §2.8, §2.9, §4. These are LEGAL requirements, so the
-- enforcement (revenue over cap => storefront paused; license expired => storefront paused) is
-- atomic in SQL, the same way the geofence lives in the `orders_same_state_only` CHECK. Inngest
-- (src/lib/inngest/) only orchestrates — fires on the event, calls these functions, queues
-- notifications.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 2.9 Notifications queue. Phase 2 only QUEUES rows; Resend/Twilio fan-out is Phase 3.
-- in_app notifications are surfaced now (seller compliance page + dashboard bell).
-- ---------------------------------------------------------------------------

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  channel    text not null check (channel in ('email','sms','in_app')),
  template   text not null,                     -- 'revenue_cap_reached' | 'license_expiring' | 'license_expired' | ...
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'queued' check (status in ('queued','sent','failed')),
  read_at    timestamptz,                       -- in_app only
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_ix on public.notifications (user_id, created_at desc);

-- Dedupe license reminders: one row per (license, milestone). The job inserts with
-- ON CONFLICT DO NOTHING and treats a successful insert as "send this reminder".
create unique index notifications_license_milestone_ux
  on public.notifications ((payload->>'license_id'), (payload->>'milestone'))
  where template = 'license_expiring';

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select
  using (user_id = (select auth.uid()));
-- No INSERT/UPDATE/DELETE policies: the queue is written by the service role (Inngest);
-- marking in_app notifications read goes through mark_notifications_read().

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
    set read_at = now()
    where user_id = auth.uid() and channel = 'in_app' and read_at is null;
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- 2.8 Per-state cottage-food rules (reference data).
--
--   ⚠️  THE SEEDED CAPS BELOW ARE PLACEHOLDERS — NOT LEGAL ADVICE.  ⚠️
--   Every state is seeded with the same obviously-fake $50,000 figure so the feature works
--   end to end. An admin must replace each row with the verified cap + license rules for that
--   state before this is relied on in production.
-- ---------------------------------------------------------------------------

create table public.state_cottage_food_rules (
  state_code         char(2) primary key,
  revenue_cap        numeric(12,2),             -- annual gross; null = no cap
  requires_license   boolean not null default false,
  allowed_categories jsonb,
  notes              text,
  updated_by         uuid references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);
create trigger state_cottage_food_rules_set_updated_at before update on public.state_cottage_food_rules
  for each row execute function public.set_updated_at();

alter table public.state_cottage_food_rules enable row level security;

create policy "cottage rules: public read"
  on public.state_cottage_food_rules for select using (true);

create policy "cottage rules: admin write"
  on public.state_cottage_food_rules for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

insert into public.state_cottage_food_rules (state_code, revenue_cap, requires_license, notes)
select code, 50000.00, false,
       'PLACEHOLDER — not legal advice. Replace with the verified cottage-food revenue cap and license rules for this state.'
from unnest(array[
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
]) as code
on conflict (state_code) do nothing;

-- ---------------------------------------------------------------------------
-- 2.8 Seller licenses / IDs. Sellers add these; verification is an admin job (Phase 5), so
-- `verification_status` is platform-only. A daily Inngest scan handles reminders + expiry.
-- ---------------------------------------------------------------------------

create table public.seller_licenses (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references public.seller_profiles(id) on delete cascade,
  license_type        text not null
                        check (license_type in ('cottage_food','food_handler','business_license','id','other')),
  license_number      text,
  issuing_state       char(2) not null,
  issued_date         date,
  expiration_date     date not null,
  document_path       text,                     -- object key in the private `seller-docs` bucket
  verification_status text not null default 'pending'
                        check (verification_status in ('pending','verified','rejected','expired')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index seller_licenses_seller_ix on public.seller_licenses (seller_id);
create index seller_licenses_expiry_ix on public.seller_licenses (verification_status, expiration_date);
create trigger seller_licenses_set_updated_at before update on public.seller_licenses
  for each row execute function public.set_updated_at();

alter table public.seller_licenses enable row level security;

create policy "licenses: seller reads own"
  on public.seller_licenses for select
  using (seller_id in (
    select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
  ));

create policy "licenses: seller inserts own"
  on public.seller_licenses for insert
  with check (seller_id in (
    select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
  ));

create policy "licenses: seller updates own"
  on public.seller_licenses for update
  using (seller_id in (
    select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
  ))
  with check (seller_id in (
    select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
  ));

create policy "licenses: admin all"
  on public.seller_licenses for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- verification_status is set only by the platform (admin review / the expiry job).
create or replace function public.seller_licenses_guard_status()
returns trigger
language plpgsql
as $$
begin
  if not public.is_platform_context()
     and new.verification_status is distinct from old.verification_status then
    raise exception 'license verification_status may only be changed by the platform';
  end if;
  return new;
end;
$$;
create trigger seller_licenses_guard_status
  before update on public.seller_licenses
  for each row execute function public.seller_licenses_guard_status();

-- ---------------------------------------------------------------------------
-- 2.8 Rolling gross-revenue tally, one row per (seller, state, year). Auto-pause at the cap.
-- ---------------------------------------------------------------------------

create table public.seller_revenue_tracking (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.seller_profiles(id) on delete cascade,
  state         char(2) not null,
  period_year   int not null,
  gross_revenue numeric(12,2) not null default 0 check (gross_revenue >= 0),
  cap_amount    numeric(12,2),
  is_over_cap   boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (seller_id, state, period_year)
);
create index seller_revenue_tracking_over_ix on public.seller_revenue_tracking (is_over_cap);

alter table public.seller_revenue_tracking enable row level security;

create policy "revenue: seller reads own"
  on public.seller_revenue_tracking for select
  using (seller_id in (
    select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
  ));
-- writes: service role only (the record_order_revenue function).

-- ---------------------------------------------------------------------------
-- Idempotency for the revenue tally — an order's goods total is counted exactly once,
-- even if the Inngest function retries.
-- ---------------------------------------------------------------------------

alter table public.orders add column revenue_recorded_at timestamptz;

comment on column public.seller_profiles.pause_reason is
  'Why the storefront is paused: onboarding_incomplete | revenue_cap | license_expired | admin. '
  'A compliance pause (revenue_cap / license_expired / admin) is never lifted by the Stripe '
  'webhook reconcile — only by an admin or the next-year revenue reset.';

-- ---------------------------------------------------------------------------
-- record_order_revenue — called by the revenue-cap Inngest function on `order -> completed`.
-- Adds the order's goods total to the yearly tally and, if that crosses the state cap,
-- pauses the storefront in the SAME transaction. Idempotent per order.
-- ---------------------------------------------------------------------------

create or replace function public.record_order_revenue(p_order_id uuid)
returns table (gross numeric, cap numeric, over boolean, paused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_year     int := extract(year from now())::int;
  v_amount   numeric(12,2);
  v_cap      numeric(12,2);
  v_gross    numeric(12,2);
  v_was_over boolean;
  v_over     boolean;
  v_paused   boolean := false;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found
     or v_order.status <> 'completed'
     or v_order.revenue_recorded_at is not null then
    -- Nothing to record. Report the current tally so callers still get useful state.
    select srt.gross_revenue, srt.cap_amount, srt.is_over_cap
      into v_gross, v_cap, v_over
      from public.seller_revenue_tracking srt
      where srt.seller_id = v_order.seller_id   -- null when the order wasn't found => matches nothing
        and srt.state = v_order.seller_state
        and srt.period_year = v_year;
    return query select coalesce(v_gross, 0)::numeric, v_cap, coalesce(v_over, false), false;
    return;
  end if;

  v_amount := greatest(coalesce(v_order.subtotal, 0) - coalesce(v_order.discount_total, 0), 0);

  select revenue_cap into v_cap
    from public.state_cottage_food_rules
    where state_code = v_order.seller_state;

  insert into public.seller_revenue_tracking (seller_id, state, period_year, gross_revenue, cap_amount)
  values (v_order.seller_id, v_order.seller_state, v_year, v_amount, v_cap)
  on conflict (seller_id, state, period_year) do update
    set gross_revenue = public.seller_revenue_tracking.gross_revenue + excluded.gross_revenue,
        cap_amount    = excluded.cap_amount,
        updated_at    = now()
  returning gross_revenue, is_over_cap into v_gross, v_was_over;

  v_over := v_cap is not null and v_gross >= v_cap;

  update public.seller_revenue_tracking
    set is_over_cap = v_over, updated_at = now()
    where seller_id = v_order.seller_id
      and state = v_order.seller_state
      and period_year = v_year;

  -- Newly over the cap => hard stop. Revenue cap supersedes any other pause reason.
  if v_over and not coalesce(v_was_over, false) then
    update public.seller_profiles
      set is_paused = true, pause_reason = 'revenue_cap'
      where id = v_order.seller_id;
    v_paused := true;
  end if;

  update public.orders set revenue_recorded_at = now() where id = p_order_id;

  return query select v_gross, v_cap, v_over, v_paused;
end;
$$;

revoke all on function public.record_order_revenue(uuid) from public, anon, authenticated;
grant execute on function public.record_order_revenue(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- expire_seller_license — called by the daily scan when a verified license reaches expiry.
-- ---------------------------------------------------------------------------

create or replace function public.expire_seller_license(p_license_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
begin
  update public.seller_licenses
    set verification_status = 'expired', updated_at = now()
    where id = p_license_id and verification_status <> 'expired'
    returning seller_id into v_seller;

  if v_seller is null then
    return false;  -- already expired, or gone
  end if;

  update public.seller_profiles
    set is_paused = true,
        pause_reason = case when pause_reason = 'revenue_cap' then 'revenue_cap' else 'license_expired' end
    where id = v_seller;

  return true;
end;
$$;

revoke all on function public.expire_seller_license(uuid) from public, anon, authenticated;
grant execute on function public.expire_seller_license(uuid) to service_role;
