-- Harvest Local — a public policy may not call is_admin().
--
--     { code: "42501", message: "permission denied for function is_admin" }
--
-- `is_admin()` is revoked from `public` and `anon` on purpose (20260903210000, line 83). Every
-- policy I wrote this week reached for it anyway, including on tables a signed-out visitor is
-- supposed to read — so `markets`, `pickup_locations`, `pickup_slots` and `seller_questions` were
-- unreadable to exactly the audience they were built for.
--
-- TWO THINGS MADE IT WORSE THAN IT LOOKS.
--
-- First, `for all` includes SELECT. The admin-write policies were not only evaluated on writes:
-- Postgres ORs every permissive SELECT policy together, so an anonymous read of `markets`
-- evaluated "markets: admin write" too and hit the revoked function there even when the public-read
-- policy would have matched.
--
-- Second, this is invisible from the browser. A missing SELECT policy renders an empty section; a
-- refused function renders an empty section as well, because the query errors and the reader falls
-- back to `?? []`. Every page I checked by hand looked plausible because the tables were empty
-- anyway.
--
-- The fix is the pattern phase1 already used before `is_admin()` existed — the admin test written
-- inline against `profiles`, which `anon` may evaluate and which simply returns false for them
-- (`profiles: read own` yields no row when auth.uid() is null). `is_admin()` stays exactly as it
-- is, and stays right for the admin-only tables it was written for.

set search_path = public;

-- The admin test, spelled out. Same predicate as `is_admin()`, no EXECUTE required.
--   exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')

-- ===========================================================================
-- markets
-- ===========================================================================
drop policy if exists "markets: public read published" on public.markets;
create policy "markets: public read published"
  on public.markets for select
  using (
    status = 'published'
    or exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists "markets: admin write" on public.markets;
create policy "markets: admin insert"
  on public.markets for insert
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "markets: admin update"
  on public.markets for update
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "markets: admin delete"
  on public.markets for delete
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- ===========================================================================
-- market_hours
-- ===========================================================================
drop policy if exists "market_hours: public read" on public.market_hours;
create policy "market_hours: public read"
  on public.market_hours for select
  using (
    exists (
      select 1 from public.markets m
       where m.id = market_hours.market_id
         and (
           m.status = 'published'
           or exists (
             select 1 from public.profiles p
              where p.id = (select auth.uid()) and p.role = 'admin'
           )
         )
    )
  );

drop policy if exists "market_hours: admin write" on public.market_hours;
create policy "market_hours: admin insert"
  on public.market_hours for insert
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "market_hours: admin update"
  on public.market_hours for update
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
create policy "market_hours: admin delete"
  on public.market_hours for delete
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- ===========================================================================
-- market_watchers — only ever read by its owner or an admin, both signed in.
-- ===========================================================================
drop policy if exists "market_watchers: read own" on public.market_watchers;
create policy "market_watchers: read own"
  on public.market_watchers for select
  using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

drop policy if exists "market_watchers: remove own" on public.market_watchers;
create policy "market_watchers: remove own"
  on public.market_watchers for delete
  using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- ===========================================================================
-- pickup_locations / pickup_slots
-- ===========================================================================
drop policy if exists "pickup locations: public read live" on public.pickup_locations;
create policy "pickup locations: public read live"
  on public.pickup_locations for select
  using (
    exists (
      select 1 from public.seller_profiles sp
      where sp.id = pickup_locations.seller_id
        and (
          (sp.is_paused = false and pickup_locations.is_active)
          or sp.pause_reason = 'vacation'
          or sp.profile_id = (select auth.uid())
        )
    )
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists "pickup slots: public read" on public.pickup_slots;
create policy "pickup slots: public read"
  on public.pickup_slots for select
  using (
    exists (
      select 1
        from public.pickup_locations pl
        join public.seller_profiles sp on sp.id = pl.seller_id
       where pl.id = pickup_slots.location_id
         and (
           (sp.is_paused = false and pl.is_active)
           or sp.pause_reason = 'vacation'
           or sp.profile_id = (select auth.uid())
         )
    )
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ===========================================================================
-- seller_questions — a question is public once answered.
-- ===========================================================================
drop policy if exists "questions: answered are public" on public.seller_questions;
create policy "questions: answered are public"
  on public.seller_questions for select
  using (
    status = 'answered'
    or asker_id = (select auth.uid())
    or seller_id in (
      select sp.id from public.seller_profiles sp where sp.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
