-- Harvest Local — distance, and the map.
--
-- `/shop` has been an alphabetical, state-wide list: a buyer in El Paso sees a seller in Texarkana
-- with nothing to say they are 800 miles apart. In a local marketplace distance IS the primary sort
-- signal, and it is the one headline feature ("a Zillow-style map") still unbuilt.
--
-- =========================================================================
-- COORDINATES ARE ROUNDED, AND THAT IS THE POINT
-- =========================================================================
-- 20260908240000 established that a cottage seller's collection point is usually their house, so
-- the town is public and the street is not. A map pin is a street address expressed differently —
-- dropping an exact pin on a home undoes that decision with a nicer interface.
--
-- So every point this function returns for a seller-owned location is rounded to two decimal
-- places, roughly a 1km cell: enough to show which part of town, not enough to show which house.
-- A booth at a market in the public directory is returned exactly, because a market is a public
-- venue whose address is already on its own page.
--
-- The rounding is deliberately visible rather than a random offset: several sellers in one
-- neighbourhood land on the same point, which reads as "approximate" instead of quietly implying a
-- precision we are not offering.
--
-- The function is SECURITY DEFINER only because it has to see past "addresses: owner all" to
-- measure from a location it must never disclose. It makes no authorization decision — the data is
-- public, live storefronts in one state — so it never consults `current_user`, and it selects no
-- column that could carry a street.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- nearby_sellers — live storefronts in one state, nearest first.
--
-- `p_lng` / `p_lat` may be null: with no origin the list still comes back (alphabetically, with
-- null distances) so discovery never depends on the buyer surrendering a location.
--
-- The state filter lives HERE rather than in the caller. It is the discovery layer of rule 1, and a
-- filter a client applies is a filter a client can drop.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_sellers(
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
  is_market       boolean
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
    select sp.id, sp.business_name, sp.storefront_slug, sp.avg_rating
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
         coalesce(is_market, false)
    from nearest
   order by miles nulls last, business_name
   limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.nearby_sellers(text, double precision, double precision, int)
  from public;
grant execute on function public.nearby_sellers(text, double precision, double precision, int)
  to anon, authenticated, service_role;

comment on function public.nearby_sellers is
  'Live storefronts in one state, nearest first. Coordinates are rounded to ~1km for anywhere a '
  'seller might live and exact only for public market venues; no street is ever returned.';
