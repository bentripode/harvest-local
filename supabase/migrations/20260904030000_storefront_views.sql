-- Harvest Local — storefront view tracking for the seller dashboard's conversion rate
-- (LAUNCH.md follow-up).
--
-- A per-seller, per-day view counter — not one row per hit. The storefront page fires
-- `record_storefront_view` from the client once per browser session (see TrackStorefrontView).
-- The count is advisory: only the seller sees their own conversion rate, and there's no financial
-- effect, so the RPC is open to `anon` (buyers browse storefronts logged out) without a rate limit
-- — same posture as the unthrottled discovery reads (LAUNCH.md §7).

set search_path = public;

create table public.seller_view_counts (
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  day       date not null default (now() at time zone 'utc')::date,
  views     integer not null default 0,
  primary key (seller_id, day)
);

alter table public.seller_view_counts enable row level security;

-- The seller reads their own counts; nobody writes directly.
create policy "seller_view_counts: owner reads"
  on public.seller_view_counts for select
  using (
    seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
  );

create or replace function public.record_storefront_view(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.seller_view_counts (seller_id, day, views)
  values (p_seller_id, (now() at time zone 'utc')::date, 1)
  on conflict (seller_id, day)
    do update set views = public.seller_view_counts.views + 1;
exception
  when foreign_key_violation then
    null;  -- unknown seller id — ignore
end;
$$;

revoke all on function public.record_storefront_view(uuid) from public;
grant execute on function public.record_storefront_view(uuid) to anon, authenticated;
