-- Harvest Local — the collection address is approximate in public and exact once paid for.
--
-- Cottage sellers work out of their own kitchens, and for most of them the collection point is
-- their house. Publishing that street address to anonymous browsers is the objection that stops
-- people signing up, and it is not information a browsing stranger needs: the town tells them
-- whether it is near enough to bother with, and the door number only matters once they are coming.
--
-- Both halves were missing. `pickup_locations` denormalises `city` / `postal_code` precisely so a
-- buyer can be shown roughly where without reading `addresses`, which is owner-only — but nothing
-- rendered them. And nothing released the exact address either: after this migration the buyer can
-- finally find out where to collect the thing they paid for, which until now they could not.
--
-- The shape is the one Texas already forced on the label pipeline in
-- 20260907230000_address_withheld_until_payment.sql: not a substitution, a TIMING rule. The address
-- is real and required; what changes is when it is handed over.
--
-- ON CONSISTENCY WITH THE LABEL DISCLOSURE. `product_label_disclosure()` still publishes a
-- producer's street address before payment in the predisclosure states whose statutes demand it
-- (NM 25-12-3(B)(4), OK 5-4.3(B)(4), IN 16-42-5.3-5(b) and the rest). That is not an inconsistency
-- to tidy away: those states compel it, Texas expressly excuses it, and this function answers a
-- different question — where the buyer collects, which no statute requires us to publish in
-- advance. Do not "harmonise" the two by widening this one; the label rules are load-bearing.

set search_path = public;

-- ---------------------------------------------------------------------------
-- order_pickup_address — the exact collection address for a paid pickup order.
--
-- SECURITY DEFINER because `addresses` is owner-only ("addresses: owner all") and the buyer is not
-- the owner. It therefore carries its own authorization, on `auth.uid()` and `is_service_role()`
-- and never on `current_user`, which in a DEFINER body is the function owner and would authorize
-- everybody (CLAUDE.md — this is the `advance_order_status` lesson).
--
-- Two gates, both necessary:
--   * the caller is the order's buyer, or owns the seller profile it belongs to;
--   * the order is past `pending_payment` — i.e. the payment webhook has confirmed it. Before that
--     there is no sale, and the address is exactly what is being withheld.
-- ---------------------------------------------------------------------------
create or replace function public.order_pickup_address(p_order_id uuid)
returns table (
  source      text,
  label       text,
  description text,
  line1       text,
  line2       text,
  city        text,
  state       text,
  postal_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_is_buyer boolean;
  v_is_seller boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;

  v_is_buyer := v_order.buyer_id = (select auth.uid());
  v_is_seller := exists (
    select 1 from public.seller_profiles sp
     where sp.id = v_order.seller_id and sp.profile_id = (select auth.uid())
  );

  if not (v_is_buyer or v_is_seller or public.is_service_role()) then
    raise exception 'not a party to this order' using errcode = 'insufficient_privilege';
  end if;

  -- Delivery orders already carry their own frozen address; there is nothing to collect.
  if v_order.fulfillment_type <> 'pickup' then
    return;
  end if;

  -- The whole point: nothing before the money.
  if v_order.status = 'pending_payment' then
    return;
  end if;

  -- A booth at a public market — the address was never private, but it comes back here so callers
  -- have one place to ask.
  return query
  select 'market'::text, pl.label, pl.description,
         m.address_text, null::text, m.city, m.state::text, m.postal_code
    from public.pickup_locations pl
    join public.markets m on m.id = pl.market_id
   where pl.id = v_order.pickup_location_id;
  if found then
    return;
  end if;

  -- A place of the seller's own.
  return query
  select 'address'::text, pl.label, pl.description,
         a.line1, a.line2, a.city, a.state::text, a.postal_code
    from public.pickup_locations pl
    join public.addresses a on a.id = pl.address_id
   where pl.id = v_order.pickup_location_id;
  if found then
    return;
  end if;

  -- No location on the order: either it predates pickup_locations or the seller had none, in which
  -- case collection has always meant their production address.
  return query
  select 'address'::text, 'Pickup'::text, null::text,
         a.line1, a.line2, a.city, a.state::text, a.postal_code
    from public.seller_profiles sp
    join public.addresses a on a.id = sp.pickup_address_id
   where sp.id = v_order.seller_id;
end;
$$;

revoke all on function public.order_pickup_address(uuid) from public, anon;
grant execute on function public.order_pickup_address(uuid) to authenticated, service_role;

comment on function public.order_pickup_address is
  'The exact collection address for a pickup order, to its buyer or seller, only once the order is '
  'past pending_payment. Approximate location (town) is public on the storefront; the street '
  'address is not.';
