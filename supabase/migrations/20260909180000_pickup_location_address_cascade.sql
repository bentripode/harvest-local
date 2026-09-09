-- Harvest Local — a delete that could never succeed.
--
-- `pickup_locations` (20260908230000) declares:
--
--     market_id  uuid references public.markets(id)    on delete set null,
--     address_id uuid references public.addresses(id)  on delete set null,
--     constraint pickup_locations_where check (market_id is not null or address_id is not null)
--
-- Each half is right on its own and together they are impossible. Deleting an address sets
-- `address_id` to null, which leaves a row with neither a market nor an address, which the CHECK
-- refuses — so the DELETE fails and takes the whole transaction with it:
--
--     new row for relation "pickup_locations" violates check constraint "pickup_locations_where"
--
-- ===========================================================================
-- WHAT IT ACTUALLY BROKE
-- ===========================================================================
-- Deleting a PROFILE cascades to that person's `addresses`, which trips the above, so **deleting a
-- seller who has ever set a pickup address fails**. In the integration harness that is why six
-- `IT Storefront` fixtures survived a whole day of runs on a live project: `cleanupAll` calls
-- `auth.admin.deleteUser(...).catch(() => {})`, the delete failed with a generic "Database error
-- deleting user", and the `.catch` swallowed it. Silent test pollution in production, from a
-- constraint pair nobody had exercised.
--
-- It is not only a test problem. Any account deletion — a seller closing up, an admin removing
-- someone, anything a data-deletion request would need — hits the same wall.
--
-- ===========================================================================
-- THE FIX
-- ===========================================================================
-- `on delete cascade` on `address_id`. A collection point whose address has gone is not a place;
-- keeping the row by nulling the column is what created a state the CHECK exists to forbid. The
-- market FK stays `set null` because a market row being deleted is a directory edit, not the
-- disappearance of the venue — and a market-based location has its own `market_id` to stand on.
--
-- Safe as a cascade because the two are alternatives in practice, not companions: of 11 rows on
-- this project, 6 are address-only, 5 are market-only, and none carries both. A row with both would
-- lose a still-valid market booth, so if that combination ever becomes real this needs revisiting
-- as a trigger that nulls the column and deletes only when nothing is left.

set search_path = public;

alter table public.pickup_locations
  drop constraint if exists pickup_locations_address_id_fkey;

alter table public.pickup_locations
  add constraint pickup_locations_address_id_fkey
  foreign key (address_id) references public.addresses(id) on delete cascade;

comment on constraint pickup_locations_address_id_fkey on public.pickup_locations is
  'CASCADE, not SET NULL: nulling it violates pickup_locations_where and makes deleting the '
  'address — or the profile that owns it — impossible. See 20260909180000.';
