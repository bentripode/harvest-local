-- Harvest Local — tell the buyer whether a seller can actually reach them.
--
-- `/shop` sorts by distance, which works until a state is thin. Then the nearest storefront is 84
-- miles away, the page ranks it first, and the number under it reads as a result rather than as the
-- problem. Nobody drives 84 miles for a loaf of bread.
--
-- Distance alone cannot answer it, because a seller 40 miles off who delivers within 50 IS reachable
-- and one 12 miles off who only does pickup at a market you will never attend may not be. So the
-- function returns the two columns the reachability question needs, and `src/lib/geo/density.ts`
-- does the judging.
--
-- ===========================================================================
-- DROP THEN CREATE, NOT `create or replace`
-- ===========================================================================
-- Postgres will not let `create or replace function` change a return type, and this adds two columns
-- to the returns-table. Replacing in place fails outright — better than the sibling trap that bit
-- `finalize_paid_order`, where changing the ARGUMENTS silently creates a second overload and leaves
-- the old one being called forever. Dropping first is the only way, and the grants have to be
-- reapplied because they go with the dropped function.

set search_path = public, extensions;

drop function if exists public.nearby_sellers(text, double precision, double precision, int);

create function public.nearby_sellers(
  p_state text,
  p_lng   double precision default null,
  p_lat   double precision default null,
  p_limit int default 200
)
returns table (
  seller_id       uuid,
  business_name   text,
  storefront_slug text,
  avg_rating      numeric,
  distance_miles  numeric,
  approx_lng      double precision,
  approx_lat      double precision,
  location_label  text,
  is_market       boolean,
  /** Whether this seller offers local delivery at all. */
  delivery_enabled boolean,
  /** How far they will drive. Null when they deliver but have not said how far. */
  delivery_radius_miles int
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origin as (
    select case
             when p_lng is null or p_lat is null then null
             else ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
           end as g
  ),
  live as (
    select sp.id, sp.business_name, sp.storefront_slug, sp.avg_rating,
           sp.delivery_enabled, sp.delivery_radius_miles
      from public.seller_profiles sp
     where sp.is_paused = false
       and sp.home_state = upper(p_state)
       -- A storefront with nothing to sell is not a discovery result.
       and exists (
         select 1 from public.products p
          where p.seller_id = sp.id and p.status = 'active'
       )
  ),
  -- Every point a seller can be found at: their active collection points, plus the production
  -- address as the fallback for a seller who has not added any.
  points as (
    select pl.seller_id,
           pl.label,
           true  as is_market,
           m.location as loc
      from public.pickup_locations pl
      join public.markets m on m.id = pl.market_id
     where pl.is_active and m.location is not null

    union all

    select pl.seller_id,
           pl.label,
           false as is_market,
           a.location as loc
      from public.pickup_locations pl
      join public.addresses a on a.id = pl.address_id
     where pl.is_active and a.location is not null

    union all

    select sp.id,
           'Pickup'::text,
           false as is_market,
           a.location as loc
      from public.seller_profiles sp
      join public.addresses a on a.id = sp.pickup_address_id
     where a.location is not null
       and not exists (
         select 1 from public.pickup_locations pl
          where pl.seller_id = sp.id and pl.is_active
       )
  ),
  nearest as (
    select l.id,
           l.business_name,
           l.storefront_slug,
           l.avg_rating,
           l.delivery_enabled,
           l.delivery_radius_miles,
           n.label,
           n.is_market,
           n.loc,
           n.miles
      from live l
      left join lateral (
        select p.label, p.is_market, p.loc,
               case when o.g is null then null
                    else ST_Distance(p.loc, o.g) / 1609.344
               end as miles
          from points p, origin o
         where p.seller_id = l.id
         -- With no origin there is nothing to be nearest to; take a stable pick instead.
         order by case when o.g is null then 0 else ST_Distance(p.loc, o.g) end, p.label
         limit 1
      ) n on true
  )
  select id,
         business_name,
         storefront_slug,
         avg_rating,
         round(miles::numeric, 1),
         -- Exact for a public market, ~1km cell for anywhere a person might live.
         case when loc is null then null
              when is_market then ST_X(loc::extensions.geometry)
              else round(ST_X(loc::extensions.geometry)::numeric, 2)::double precision
         end,
         case when loc is null then null
              when is_market then ST_Y(loc::extensions.geometry)
              else round(ST_Y(loc::extensions.geometry)::numeric, 2)::double precision
         end,
         label,
         coalesce(is_market, false),
         coalesce(delivery_enabled, false),
         delivery_radius_miles
    from nearest
   order by miles nulls last, business_name
   limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.nearby_sellers(text, double precision, double precision, int)
  from public;
grant execute on function public.nearby_sellers(text, double precision, double precision, int)
  to anon, authenticated, service_role;

comment on function public.nearby_sellers is
  'Live storefronts in one state, nearest first, with each seller''s delivery reach so a caller can '
  'tell "near you" from "can actually get it to you". Coordinates are rounded to ~1km for anywhere a '
  'seller might live and exact only for public market venues; no street is ever returned.';
