-- Harvest Local — the tables added this week were never granted to anon/authenticated.
--
-- Every table from `markets` onwards had RLS enabled and policies written, and none of them was
-- readable by a browser:
--
--     { code: "42501", message: "permission denied for table markets" }
--
-- 42501 is a GRANT failure, not an RLS one, and the difference is worth knowing because the two
-- look nothing alike in practice. RLS filters — a policy that does not match returns zero rows and
-- the page renders empty. A missing grant refuses the statement outright, so the storefront's
-- "where to collect" section, the market directory, the variant picker and the public Q&A all
-- failed loudly rather than degrading. The integration pass is what surfaced it; every browser test
-- I ran by hand was signed out looking at pages whose data had not been seeded yet, so an empty
-- section looked exactly like an empty table.
--
-- Why it happened: the older tables get their privileges from Supabase's `alter default privileges`
-- setup, which applies to objects created by the role that owns that default. Migrations pushed
-- through the CLI do not always create objects under that role, so a new table can land with RLS
-- policies and no underlying grant for the policies to gate. The existing schema never had to say
-- this out loud because every table predates the situation.
--
-- The posture below matches the rest of the schema deliberately: grant the DML, and let RLS be the
-- only thing that decides. A grant without a matching policy still denies — `anon` can be granted
-- INSERT on `markets` and remains unable to write one, because "markets: admin write" is the gate.
-- Departing from that here would leave two security models in one database, and the failure mode of
-- the quieter one is this exact 42501.

set search_path = public;

-- Readable by the world, written under RLS.
grant select on public.markets              to anon, authenticated;
grant select on public.market_hours         to anon, authenticated;
grant select on public.pickup_locations     to anon, authenticated;
grant select on public.pickup_slots         to anon, authenticated;
grant select on public.product_variants     to anon, authenticated;
grant select on public.seller_posts         to anon, authenticated;
grant select on public.seller_questions     to anon, authenticated;

-- A signed-out visitor joins a market waitlist; they can never read it back, because there is no
-- SELECT policy for them and no SELECT grant either.
grant insert on public.market_watchers      to anon, authenticated;
grant select, delete on public.market_watchers to authenticated;

-- Everything a signed-in user may attempt. RLS decides whether they may in fact.
grant insert, update, delete on public.markets          to authenticated;
grant insert, update, delete on public.market_hours     to authenticated;
grant insert, update, delete on public.pickup_locations to authenticated;
grant insert, update, delete on public.pickup_slots     to authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant insert, update, delete on public.seller_posts     to authenticated;
grant insert, update, delete on public.seller_questions to authenticated;

-- Follows are private end to end: no anon grant at all, so a signed-out visitor cannot even
-- attempt one. The counts a public page shows come from `follower_counts()`, which is a
-- SECURITY DEFINER function and needs no table grant.
grant select, insert, delete on public.follows to authenticated;

-- The trusted server role, explicitly rather than by inheritance.
grant all on public.markets            to service_role;
grant all on public.market_hours       to service_role;
grant all on public.market_watchers    to service_role;
grant all on public.pickup_locations   to service_role;
grant all on public.pickup_slots       to service_role;
grant all on public.product_variants   to service_role;
grant all on public.follows            to service_role;
grant all on public.seller_posts       to service_role;
grant all on public.seller_questions   to service_role;
