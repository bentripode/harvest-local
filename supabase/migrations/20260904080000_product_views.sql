-- Harvest Local — per-product view tracking (extends the storefront-view rollup, #11).
--
-- The storefront lists all of a seller's products inline (no product detail page), so a "product
-- view" is an impression: when the per-session `record_storefront_view` beacon fires it now also
-- passes the ids of the products shown, and each gets a daily-rollup bump. Advisory, seller-only —
-- same posture as `seller_view_counts` (unthrottled, anon-callable).

set search_path = public;

create table public.product_view_counts (
  product_id uuid not null references public.products(id) on delete cascade,
  day        date not null default (now() at time zone 'utc')::date,
  views      integer not null default 0,
  primary key (product_id, day)
);

alter table public.product_view_counts enable row level security;

create policy "product_view_counts: seller reads own"
  on public.product_view_counts for select
  using (
    product_id in (
      select p.id
      from public.products p
      join public.seller_profiles sp on sp.id = p.seller_id
      where sp.profile_id = (select auth.uid())
    )
  );

-- Replace the single-arg RPC with one that also takes the visible product ids.
drop function if exists public.record_storefront_view(uuid);

create function public.record_storefront_view(
  p_seller_id   uuid,
  p_product_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.seller_view_counts (seller_id, day, views)
  values (p_seller_id, (now() at time zone 'utc')::date, 1)
  on conflict (seller_id, day) do update set views = public.seller_view_counts.views + 1;

  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    insert into public.product_view_counts (product_id, day, views)
    select pid, (now() at time zone 'utc')::date, 1
    from unnest(p_product_ids) as pid
    on conflict (product_id, day) do update set views = public.product_view_counts.views + 1;
  end if;
exception
  when foreign_key_violation then
    null;  -- unknown ids — ignore
end;
$$;

revoke all on function public.record_storefront_view(uuid, uuid[]) from public;
grant execute on function public.record_storefront_view(uuid, uuid[]) to anon, authenticated;
