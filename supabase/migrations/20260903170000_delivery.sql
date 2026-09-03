-- Harvest Local — Phase 3: local delivery + mileage fees.
--
-- The columns already exist (seller_profiles.delivery_*, orders.delivery_*, addresses.location).
-- This adds:
--   * orders.delivery_address_text — the buyer's address FROZEN on the order (both parties see it;
--     no cross-owner RLS on `addresses` needed).
--   * upsert_address()          — the only way to write a PostGIS point through PostgREST.
--   * seller_delivery_quote()   — PostGIS straight-line check "is this point inside the seller's
--     delivery radius?" without exposing the seller's exact pickup coordinates to the buyer.
--   * a guard so delivery can't be switched on without a pickup address.

set search_path = public, extensions;

alter table public.orders add column if not exists delivery_address_text text;

-- ---------------------------------------------------------------------------
-- upsert_address — owner-scoped (SECURITY INVOKER + the "addresses: owner all" RLS policy).
-- Callers geocode first (Mapbox) and pass lng/lat.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_address(
  p_id     uuid,
  p_label  text,
  p_line1  text,
  p_line2  text,
  p_city   text,
  p_state  text,
  p_postal text,
  p_lng    double precision,
  p_lat    double precision
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_id  uuid;
  v_loc extensions.geography;
begin
  v_loc := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  if p_id is null then
    insert into public.addresses (user_id, label, line1, line2, city, state, postal_code, location)
    values ((select auth.uid()), p_label, p_line1, nullif(p_line2, ''), p_city, p_state, p_postal, v_loc)
    returning id into v_id;
  else
    update public.addresses set
      label = p_label, line1 = p_line1, line2 = nullif(p_line2, ''), city = p_city,
      state = p_state, postal_code = p_postal, location = v_loc, updated_at = now()
    where id = p_id and user_id = (select auth.uid())
    returning id into v_id;
    if v_id is null then
      raise exception 'address not found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.upsert_address(uuid, text, text, text, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.upsert_address(uuid, text, text, text, text, text, text, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- delivery_route_inputs — everything the server needs to quote a delivery fee: the PostGIS
-- straight-line "is this inside the radius?" check (ARCHITECTURE §1.2) PLUS the seller's pickup
-- coordinates so the app can ask Mapbox for the billed driving distance. SECURITY DEFINER,
-- service_role only — it's called from server actions, never the browser.
-- ---------------------------------------------------------------------------
create or replace function public.delivery_route_inputs(
  p_seller_id uuid,
  p_lng       double precision,
  p_lat       double precision
)
returns table (
  deliverable   boolean,
  straight_miles numeric,
  pickup_lng    double precision,
  pickup_lat    double precision,
  base_fee      numeric,
  per_mile_fee  numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_seller public.seller_profiles;
  v_loc    extensions.geography;
  v_geom   extensions.geometry;
  v_miles  numeric;
begin
  select * into v_seller from public.seller_profiles where id = p_seller_id;
  if not found or not v_seller.delivery_enabled or v_seller.pickup_address_id is null then
    return query select false, null::numeric, null::double precision, null::double precision,
      coalesce(v_seller.delivery_base_fee, 0::numeric), coalesce(v_seller.delivery_per_mile_fee, 0::numeric);
    return;
  end if;

  select location into v_loc from public.addresses where id = v_seller.pickup_address_id;
  if v_loc is null then
    return query select false, null::numeric, null::double precision, null::double precision,
      v_seller.delivery_base_fee, v_seller.delivery_per_mile_fee;
    return;
  end if;

  v_geom := v_loc::geometry;
  v_miles := ST_Distance(v_loc, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1609.344;

  return query select
    (v_seller.delivery_radius_miles is not null and v_miles <= v_seller.delivery_radius_miles),
    round(v_miles, 2),
    ST_X(v_geom),
    ST_Y(v_geom),
    v_seller.delivery_base_fee,
    v_seller.delivery_per_mile_fee;
end;
$$;

revoke all on function public.delivery_route_inputs(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.delivery_route_inputs(uuid, double precision, double precision) to service_role;

-- ---------------------------------------------------------------------------
-- Delivery can't be on without a pickup address to route from.
-- ---------------------------------------------------------------------------
create or replace function public.seller_profiles_delivery_guard()
returns trigger
language plpgsql
as $$
begin
  if new.delivery_enabled and new.pickup_address_id is null then
    raise exception 'delivery_enabled requires a pickup address';
  end if;
  return new;
end;
$$;

drop trigger if exists seller_profiles_delivery_guard on public.seller_profiles;
create trigger seller_profiles_delivery_guard
  before insert or update on public.seller_profiles
  for each row execute function public.seller_profiles_delivery_guard();
