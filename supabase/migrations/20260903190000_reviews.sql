-- Harvest Local — Phase 4: reviews (verified buyers only). ARCHITECTURE.md §2.7, CLAUDE.md rule 4.
--
-- A review is insertable ONLY when the reviewer is the buyer of a `completed` order for that
-- seller, one review per order. Enforced at the DATA LAYER: a BEFORE INSERT trigger that fires for
-- every insert (RLS bypass included) + the `order_id` unique constraint. `seller_profiles.avg_rating`
-- (a platform-protected column) is rolled up by a SECURITY DEFINER trigger.

set search_path = public;

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.orders(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id   uuid not null references public.seller_profiles(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  body        text check (char_length(body) <= 2000),
  created_at  timestamptz not null default now()
);
create index reviews_seller_ix on public.reviews (seller_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Verified-buyer gate — runs for EVERY insert, whoever the caller is.
-- ---------------------------------------------------------------------------
create or replace function public.reviews_verify_buyer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.orders o
    where o.id = new.order_id
      and o.buyer_id = new.reviewer_id
      and o.seller_id = new.seller_id
      and o.status = 'completed'
  ) then
    raise exception 'a review requires a completed order by this buyer for this seller'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reviews_verify_buyer
  before insert on public.reviews
  for each row execute function public.reviews_verify_buyer();

-- ---------------------------------------------------------------------------
-- Rating rollup. SECURITY DEFINER so the write to the protected `avg_rating`
-- column passes `seller_profiles_guard_columns` (same pattern as record_order_revenue).
-- ---------------------------------------------------------------------------
create or replace function public.recompute_seller_rating(p_seller_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.seller_profiles
    set avg_rating = (
      select round(avg(rating)::numeric, 1) from public.reviews where seller_id = p_seller_id
    )
    where id = p_seller_id;
$$;

create or replace function public.reviews_rollup_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.recompute_seller_rating(coalesce(new.seller_id, old.seller_id));
  return null;
end;
$$;

create trigger reviews_rollup_rating
  after insert or delete on public.reviews
  for each row execute function public.reviews_rollup_rating();

-- ---------------------------------------------------------------------------
-- RLS — reviews are public to read; a buyer writes / retracts only their own.
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy "reviews: public read"
  on public.reviews for select
  using (true);

create policy "reviews: reviewer inserts own"
  on public.reviews for insert
  with check (reviewer_id = (select auth.uid()));

create policy "reviews: reviewer deletes own"
  on public.reviews for delete
  using (reviewer_id = (select auth.uid()));

do $$
begin
  execute 'revoke all on function public.recompute_seller_rating(uuid) from public, anon, authenticated';
end $$;
