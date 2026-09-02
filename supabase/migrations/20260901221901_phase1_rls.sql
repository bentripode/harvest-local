-- Harvest Local — Phase 1 row-level security
--
-- Principle: buyers/sellers touch only their own rows through the API. Public discovery data
-- (active products, live storefronts, categories, tags, platform settings) is world-readable.
-- Money and Stripe-mirror columns are written ONLY by the service-role key from webhook handlers.

-- ===========================================================================
-- profiles
-- ===========================================================================
alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- True for trusted server contexts (service-role key, migrations, direct admin SQL).
create or replace function public.is_platform_context()
returns boolean
language sql
stable
as $$
  select current_user in ('service_role', 'supabase_admin', 'supabase_auth_admin', 'postgres');
$$;

-- A user cannot change their own role. Only the platform may.
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_platform_context() then
    raise exception 'role changes are not permitted';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();

-- ===========================================================================
-- addresses — private to the owner
-- ===========================================================================
alter table public.addresses enable row level security;

create policy "addresses: owner all"
  on public.addresses for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ===========================================================================
-- seller_profiles — public read of live storefronts, owner reads own always,
-- owner may edit descriptive fields but NOT the pause / Stripe columns.
-- ===========================================================================
alter table public.seller_profiles enable row level security;

create policy "seller_profiles: public read live"
  on public.seller_profiles for select
  using (is_paused = false or profile_id = (select auth.uid()));

create policy "seller_profiles: owner insert"
  on public.seller_profiles for insert
  with check (profile_id = (select auth.uid()));

create policy "seller_profiles: owner update"
  on public.seller_profiles for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Protected columns: only the service role may change them.
create or replace function public.seller_profiles_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_platform_context() then
    if new.is_paused              is distinct from old.is_paused
    or new.pause_reason           is distinct from old.pause_reason
    or new.stripe_account_id      is distinct from old.stripe_account_id
    or new.connect_charges_enabled is distinct from old.connect_charges_enabled
    or new.connect_payouts_enabled is distinct from old.connect_payouts_enabled
    or new.connect_details_submitted is distinct from old.connect_details_submitted
    or new.avg_rating             is distinct from old.avg_rating
    or new.home_state             is distinct from old.home_state then
      raise exception 'protected seller_profiles columns may only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
create trigger seller_profiles_guard_columns
  before update on public.seller_profiles
  for each row execute function public.seller_profiles_guard_columns();

-- ===========================================================================
-- categories & tags — world readable, admin managed
-- ===========================================================================
alter table public.categories enable row level security;
alter table public.tags enable row level security;

create policy "categories: public read" on public.categories for select using (true);
create policy "tags: public read" on public.tags for select using (true);

create policy "categories: admin write"
  on public.categories for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "tags: admin write"
  on public.tags for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- ===========================================================================
-- products — public read of active listings, seller owns their catalog
-- ===========================================================================
alter table public.products enable row level security;

create policy "products: public read active"
  on public.products for select
  using (
    status = 'active'
    or seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

create policy "products: seller writes own"
  on public.products for all
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
-- product_tags — read public, write by the product's seller
-- ===========================================================================
alter table public.product_tags enable row level security;

create policy "product_tags: public read"
  on public.product_tags for select using (true);

create policy "product_tags: seller writes own"
  on public.product_tags for all
  using (
    product_id in (
      select pr.id from public.products pr
      join public.seller_profiles sp on sp.id = pr.seller_id
      where sp.profile_id = (select auth.uid())
    )
  )
  with check (
    product_id in (
      select pr.id from public.products pr
      join public.seller_profiles sp on sp.id = pr.seller_id
      where sp.profile_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- subscriptions — owner may read; only the service role writes (webhooks)
-- ===========================================================================
alter table public.subscriptions enable row level security;

create policy "subscriptions: owner read"
  on public.subscriptions for select
  using (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- platform_settings — world readable (launch gate, buyer discount), admin write
-- ===========================================================================
alter table public.platform_settings enable row level security;

create policy "platform_settings: public read"
  on public.platform_settings for select using (true);

create policy "platform_settings: admin write"
  on public.platform_settings for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- ===========================================================================
-- stripe_events — no policies: unreachable except via the service role
-- ===========================================================================
alter table public.stripe_events enable row level security;
