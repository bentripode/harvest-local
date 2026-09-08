-- Harvest Local — snapshot the reviewer's display name onto the review.
--
-- Opening the marketplace to signed-out visitors makes them the primary audience for a
-- storefront's reviews, and `profiles` is owner-read-only (`profiles: read own`) — so the embedded
-- `reviewer:profiles(display_name)` join resolves to null for every signed-out reader and every
-- review on a public storefront renders as "Buyer". The alternative fix, widening the profiles
-- policy, would publish every user's display name to `anon` in order to satisfy one screen.
--
-- So the name is snapshotted at insert, the same way `orders` freezes `buyer_state` and
-- `label_print_runs` freezes its rendered lines: a review shows the name the reviewer had when
-- they wrote it, and the public read stops depending on a private table.

set search_path = public;

alter table public.reviews
  add column if not exists reviewer_name text check (char_length(reviewer_name) <= 120);

comment on column public.reviews.reviewer_name is
  'Display name captured at insert. Public reads use this instead of joining the owner-only profiles table.';

-- Existing rows, filled while we are in a trusted context.
update public.reviews r
   set reviewer_name = p.display_name
  from public.profiles p
 where p.id = r.reviewer_id
   and r.reviewer_name is null
   and p.display_name is not null;

-- ---------------------------------------------------------------------------
-- Capture on insert.
--
-- SECURITY DEFINER only so the lookup can see past `profiles: read own` — a service-role job or
-- an admin inserting on someone's behalf would otherwise record a null name. It makes no
-- authorization decision, so it never consults `current_user` (CLAUDE.md). Whatever the client
-- sent in this column is discarded: the name is ours to record, not theirs to claim.
--
-- Fires alongside `reviews_verify_buyer`; Postgres runs BEFORE INSERT triggers in name order, so
-- capture runs first and the verified-buyer gate still decides whether the row lands at all.
-- ---------------------------------------------------------------------------
create or replace function public.reviews_capture_reviewer_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.display_name
    into new.reviewer_name
    from public.profiles p
   where p.id = new.reviewer_id;
  return new;
end;
$$;

create trigger reviews_capture_reviewer_name
  before insert on public.reviews
  for each row execute function public.reviews_capture_reviewer_name();

-- ---------------------------------------------------------------------------
-- `reviews_guard_columns` is a freeze-list, so a column added later is editable by default — and
-- the "reviews: seller responds" UPDATE policy would let a seller rename their own reviewers.
-- Freeze it with the rest; only the response columns stay editable.
-- ---------------------------------------------------------------------------
create or replace function public.reviews_guard_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_platform_context() then
    return new;
  end if;
  if new.id             is distinct from old.id
     or new.order_id      is distinct from old.order_id
     or new.reviewer_id   is distinct from old.reviewer_id
     or new.reviewer_name is distinct from old.reviewer_name
     or new.seller_id     is distinct from old.seller_id
     or new.rating        is distinct from old.rating
     or new.body          is distinct from old.body
     or new.created_at    is distinct from old.created_at then
    raise exception 'only a review''s response may be edited'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
