-- Harvest Local — seller responses to reviews (LAUNCH.md follow-up).
--
-- A seller can post one public reply to a review of their storefront, and edit or clear it. The
-- reply is the ONLY thing they may change — rating / body / links stay frozen, enforced by a
-- BEFORE UPDATE column guard (same pattern as `seller_profiles_guard_columns`). The verified-buyer
-- INSERT trigger and the rating rollup (AFTER INSERT/DELETE, not UPDATE) are untouched.

set search_path = public;

alter table public.reviews
  add column if not exists response      text check (char_length(response) <= 2000),
  add column if not exists responded_at  timestamptz;

comment on column public.reviews.response is 'Seller''s public reply. Null = no reply.';

-- The seller who owns `seller_id` may UPDATE their reviews...
create policy "reviews: seller responds"
  on public.reviews for update
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

-- ...but only the response columns. Everything else is immutable outside a trusted context.
create or replace function public.reviews_guard_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_platform_context() then
    return new;
  end if;
  if new.id          is distinct from old.id
     or new.order_id     is distinct from old.order_id
     or new.reviewer_id  is distinct from old.reviewer_id
     or new.seller_id    is distinct from old.seller_id
     or new.rating       is distinct from old.rating
     or new.body         is distinct from old.body
     or new.created_at   is distinct from old.created_at then
    raise exception 'only a review''s response may be edited'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger reviews_guard_columns
  before update on public.reviews
  for each row execute function public.reviews_guard_columns();
