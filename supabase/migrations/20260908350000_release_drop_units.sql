-- Harvest Local — the exact counterpart to claim_drop_units.
--
-- 20260908340000 shipped `release_drop_units_for_order`, which is keyed on an ORDER and made
-- idempotent by clearing `drop_id` off the items as it goes. That is the right shape for the two
-- callers that can run twice — the Stripe webhook's unwind and a cancellation — but it cannot serve
-- the checkout path, which claims units BEFORE the order rows exist:
--
--   claim → insert order → insert order_items(drop_id) → Stripe session
--
-- If any step after the claim fails there is no order to key a release on, and the units are stranded.
-- The drop then reads as sold out with nothing behind it — the under-sell the design prefers to an
-- oversell, but a phantom nobody should have to unpick by hand when we know exactly what to give back.
--
-- So: a release by (drop, units), symmetric with the claim, for compensating a failed write.
--
-- It is deliberately NOT idempotent — it cannot be, having no record to consume — and that is the
-- whole reason it is not the function the webhook calls. Retrying it hands back units twice and
-- oversells the batch. One claim, one release, in the same request that made the claim.
--
-- `greatest(0, ...)` floors it: a double release under-counts what has been sold, which shows up as
-- a batch with room in it, rather than a negative count that would read as extra capacity.

set search_path = public;

create or replace function public.release_drop_units(p_drop_id uuid, p_units int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left int;
begin
  if p_units is null or p_units < 1 then
    raise exception 'a release needs at least one unit';
  end if;

  update public.product_drops
     set units_claimed = greatest(0, units_claimed - p_units)
   where id = p_drop_id
   returning units_claimed into v_left;

  if not found then
    raise exception 'no such drop' using errcode = 'no_data_found';
  end if;

  return v_left;
end;
$$;

revoke all on function public.release_drop_units(uuid, int) from public, anon, authenticated;
grant execute on function public.release_drop_units(uuid, int) to service_role;

comment on function public.release_drop_units(uuid, int) is
  'Compensates a claim_drop_units call whose order failed to write. NOT idempotent — for the '
  'webhook and cancellation paths use release_drop_units_for_order, which is.';
