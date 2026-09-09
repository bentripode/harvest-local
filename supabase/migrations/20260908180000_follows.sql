-- Harvest Local — following a seller, a market or a product.
--
-- Nothing here brings a buyer back between purchases. A cottage seller's stock is seasonal and
-- irregular — the bread is on Saturday, the peaches are in July — so "tell me when there is
-- something" is the mechanic that fits the trade, and it is the one thing both competitors put on
-- every card.
--
-- =========================================================================
-- ONE POLYMORPHIC TABLE, WITH THE INTEGRITY PUT BACK BY HAND
-- =========================================================================
-- Sellers, markets and products are three targets and this is one table, so `target_id` carries no
-- foreign key and nothing stops a row outliving the thing it points at. That matters more than it
-- usually would because these rows are COUNTED in public — a market page showing four followers
-- when three of them followed a storefront that no longer exists is a lie, and a slow one to
-- notice. So each target table gets an AFTER DELETE trigger that clears its follows, which buys
-- back what the missing FK would have given.
--
-- =========================================================================
-- WHO FOLLOWS WHAT IS PRIVATE; HOW MANY IS NOT
-- =========================================================================
-- A follow says something about a person — which farm, which market, which product — so no row is
-- readable by anyone but its owner. The counts a storefront and a market page display come from
-- `follower_counts()`, a SECURITY DEFINER function that returns numbers and never identities, and
-- takes an array so a list of twenty markets is one query rather than twenty.

set search_path = public;

create table public.follows (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('seller', 'market', 'product')),
  target_id   uuid not null,
  created_at  timestamptz not null default now()
);

create unique index follows_unique_ux on public.follows (profile_id, target_type, target_id);
create index follows_target_ix on public.follows (target_type, target_id);
create index follows_profile_ix on public.follows (profile_id, created_at desc);

-- ===========================================================================
-- RLS — entirely private. There is no policy that lets one person read another's follows.
-- ===========================================================================
alter table public.follows enable row level security;

create policy "follows: owner reads own"
  on public.follows for select
  using (profile_id = (select auth.uid()));

create policy "follows: owner follows"
  on public.follows for insert
  with check (profile_id = (select auth.uid()));

create policy "follows: owner unfollows"
  on public.follows for delete
  using (profile_id = (select auth.uid()));

-- ===========================================================================
-- The missing foreign keys, as triggers.
-- ===========================================================================
create or replace function public.follows_clear_for_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
   where target_type = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;

create trigger seller_profiles_clear_follows
  after delete on public.seller_profiles
  for each row execute function public.follows_clear_for_target('seller');

create trigger markets_clear_follows
  after delete on public.markets
  for each row execute function public.follows_clear_for_target('market');

create trigger products_clear_follows
  after delete on public.products
  for each row execute function public.follows_clear_for_target('product');

-- ===========================================================================
-- follower_counts — numbers, never names.
--
-- SECURITY DEFINER because the rows themselves are owner-only, and it returns nothing but a count
-- per id, so it discloses no more than "four people follow this". It makes no authorization
-- decision — the counts are public — so it never consults `current_user`.
-- ===========================================================================
create or replace function public.follower_counts(
  p_target_type text,
  p_target_ids  uuid[]
)
returns table (target_id uuid, follower_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.target_id, count(*)::bigint
    from public.follows f
   where f.target_type = p_target_type
     and f.target_id = any(p_target_ids)
   group by f.target_id;
$$;

revoke all on function public.follower_counts(text, uuid[]) from public;
grant execute on function public.follower_counts(text, uuid[]) to anon, authenticated, service_role;

comment on function public.follower_counts is
  'How many people follow each of these targets. Counts only — who follows what is owner-only.';

-- ===========================================================================
-- followers_to_notify — the recipients of a "there is something new" email.
--
-- Service-role only, because it turns a target into a list of user ids, which is exactly the
-- identity disclosure `follower_counts` avoids. Only the notification jobs call it.
-- ===========================================================================
create or replace function public.followers_to_notify(
  p_target_type text,
  p_target_id   uuid
)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select f.profile_id
    from public.follows f
   where f.target_type = p_target_type
     and f.target_id = p_target_id;
$$;

revoke all on function public.followers_to_notify(text, uuid) from public, anon, authenticated;
grant execute on function public.followers_to_notify(text, uuid) to service_role;
