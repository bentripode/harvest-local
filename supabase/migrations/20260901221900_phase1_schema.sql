-- Harvest Local — Phase 1 schema
-- Foundation & Seller Onboarding: identity, storefronts, geo, catalog, subscription mirror,
-- platform settings, and a Stripe event ledger for idempotent webhooks.
--
-- See ARCHITECTURE.md §2. RLS lives in the next migration; every table here gets policies there.
--
-- PostGIS is enabled ahead of this migration (20260901221859_enable_postgis.sql) and lives in the
-- `extensions` schema. Put `extensions` on the search_path so unqualified PostGIS names resolve —
-- in particular the `gist` operator class used by the geography index below. The geography column
-- type is also schema-qualified explicitly (`extensions.geography`).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2.1 Identity, storefronts & geo
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'buyer' check (role in ('buyer','seller','admin')),
  display_name text not null default '',
  phone        text,
  home_state   char(2),                -- snapshot of the user's state, drives geofencing
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

comment on column public.profiles.home_state is
  'Two-letter US state. Authoritative for buyers; sellers use seller_profiles.home_state.';

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case
      when coalesce(new.raw_user_meta_data ->> 'role', 'buyer') = 'seller' then 'seller'
      else 'buyer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text,
  line1       text not null,
  line2       text,
  city        text not null,
  state       char(2) not null,
  postal_code text not null,
  country     char(2) not null default 'US',
  location    extensions.geography(Point, 4326),  -- geocoded at save time (Mapbox); GiST index below
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index addresses_user_ix on public.addresses (user_id);
create index addresses_geo_gix on public.addresses using gist (location extensions.gist_geography_ops);
create trigger addresses_set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

create table public.seller_profiles (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null unique references public.profiles(id) on delete cascade,
  business_name         text not null,
  storefront_slug       text not null unique,
  bio                   text,
  home_state            char(2) not null,          -- authoritative selling state
  pickup_address_id     uuid references public.addresses(id) on delete set null,
  is_paused             boolean not null default true,   -- paused until onboarding completes
  pause_reason          text,                            -- 'onboarding_incomplete' | 'revenue_cap' | 'license_expired' | 'admin'
  delivery_enabled      boolean not null default false,
  delivery_radius_miles numeric(5,1),
  delivery_base_fee     numeric(8,2) not null default 0,
  delivery_per_mile_fee numeric(8,2) not null default 0,
  avg_rating            numeric(2,1),
  -- Stripe Connect (Express) — mirror of the connected account
  stripe_account_id     text unique,
  connect_charges_enabled boolean not null default false,
  connect_payouts_enabled boolean not null default false,
  connect_details_submitted boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint seller_profiles_slug_format check (storefront_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
create index seller_profiles_state_ix on public.seller_profiles (home_state);
create trigger seller_profiles_set_updated_at before update on public.seller_profiles
  for each row execute function public.set_updated_at();

comment on column public.seller_profiles.is_paused is
  'When true the storefront accepts no checkouts and drops off the map. Starts paused until Connect '
  'onboarding + an active/trialing subscription exist.';

-- ---------------------------------------------------------------------------
-- 2.2 Catalog & filtering
-- ---------------------------------------------------------------------------

create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  parent_id uuid references public.categories(id) on delete cascade,  -- null = top-level, set = sub-category
  tax_code  text,                                                     -- default Stripe tax code
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_parent_ix on public.categories (parent_id);

create table public.tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.seller_profiles(id) on delete cascade,
  title              text not null,
  description        text,
  price              numeric(10,2) not null check (price >= 0),
  category_id        uuid not null references public.categories(id),
  subcategory_id     uuid references public.categories(id),
  status             text not null default 'draft'
                       check (status in ('draft','active','sold_out','archived')),
  quantity_available int check (quantity_available is null or quantity_available >= 0),
  images             jsonb not null default '[]'::jsonb,
  tax_code           text,                     -- overrides the category tax_code when set
  search_tsv         tsvector,                 -- maintained by trigger
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index products_seller_ix     on public.products (seller_id);
create index products_category_ix   on public.products (category_id, subcategory_id, status);
create index products_search_gix    on public.products using gin (search_tsv);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.products_tsv_refresh()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B');
  return new;
end;
$$;
create trigger products_tsv_refresh
  before insert or update of title, description on public.products
  for each row execute function public.products_tsv_refresh();

create table public.product_tags (
  product_id uuid references public.products(id) on delete cascade,
  tag_id     uuid references public.tags(id) on delete cascade,
  primary key (product_id, tag_id)
);
create index product_tags_tag_ix on public.product_tags (tag_id);

-- ---------------------------------------------------------------------------
-- 2.3 Subscriptions — Stripe Billing mirror
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  seller_id              uuid not null unique references public.seller_profiles(id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  status                 text not null default 'incomplete'
                           check (status in ('trialing','active','past_due','canceled',
                                             'unpaid','incomplete','incomplete_expired','paused')),
  trial_start            timestamptz,
  trial_end              timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_status_ix on public.subscriptions (status);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2.9 Platform settings (launch phasing toggle, buyer discount value, ...)
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger platform_settings_set_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Stripe event ledger — the backbone of idempotent webhook handling.
-- Every webhook records its event id here first; repeats are no-ops.
-- ---------------------------------------------------------------------------

create table public.stripe_events (
  id            text primary key,          -- Stripe event id (evt_...)
  type          text not null,
  account_id    text,                      -- Connect account id for connected-account events
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);
create index stripe_events_type_ix on public.stripe_events (type);
