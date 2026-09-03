-- Harvest Local — the reviews rollup trigger fired as the inserting user (authenticated), who
-- has no EXECUTE on recompute_seller_rating (it's locked to the platform). Make the trigger
-- function SECURITY DEFINER so the rollup runs with the owner's privilege.

set search_path = public;

create or replace function public.reviews_rollup_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_seller_rating(coalesce(new.seller_id, old.seller_id));
  return null;
end;
$$;
