-- Harvest Local — market coordinates for the directory's map view.
--
-- `markets.location` is a PostGIS geography, which PostgREST returns as hex EWKB — unusable in a
-- browser without a decoder. The queries module has said since 20260908220000 that "the map view
-- will add an RPC for that"; computed fields are the lighter version of the same idea. PostgREST
-- treats a function taking the table's row type as a column, so `select=id,name,lng,lat` works in
-- the ordinary query and needs no second round trip or parallel read path.
--
-- SECURITY INVOKER (the default) on purpose: the function receives a row the caller could already
-- read, so the "markets: public read published" policy still decides which markets have
-- coordinates at all. A hidden market cannot be located through these.
--
-- A market is a public venue, so unlike a seller's pickup point there is nothing to round here —
-- the map pins it exactly, and the seller map's legend already says so.

set search_path = public, extensions;

create or replace function public.lng(m public.markets)
returns double precision
language sql
stable
set search_path = public, extensions
as $$
  select extensions.st_x(m.location::extensions.geometry);
$$;

create or replace function public.lat(m public.markets)
returns double precision
language sql
stable
set search_path = public, extensions
as $$
  select extensions.st_y(m.location::extensions.geometry);
$$;

revoke all on function public.lng(public.markets) from public;
revoke all on function public.lat(public.markets) from public;
grant execute on function public.lng(public.markets) to anon, authenticated, service_role;
grant execute on function public.lat(public.markets) to anon, authenticated, service_role;

comment on function public.lng(public.markets) is
  'PostgREST computed field: the market''s longitude. Invoker rights, so RLS on markets applies.';
comment on function public.lat(public.markets) is
  'PostgREST computed field: the market''s latitude. Invoker rights, so RLS on markets applies.';
