-- Harvest Local — the same fix at the state level: unclear is missing data, not a prohibition.
--
-- `20260906010000` fixed `seller_allows_online_food_sales`, which consults a seller's chosen
-- programme. `state_allows_online_food_sales` is the fallback for a seller who has not chosen one,
-- and it had the same defect in the same direction:
--
--     select exists (... where online_orders = 'allowed')
--
-- That is "at least one programme expressly permits it", so a state whose programmes are all
-- `unclear` is blocked from listing food at all. CLAUDE.md describes this predicate as "true unless
-- every program in the state bans it", which is the intended rule and not what the code did.
--
-- Hawaii is the live case. Checking every ban against primary text
-- (`20260906030000_verify_online_bans.sql`) found nothing behind Hawaii's: Haw. Admin. Rules
-- 11-50-3(c) attaches four conditions to a homemade-food operation — food safety certification, a
-- handwashing sink, labelling, and "Distribute food products only directly to the consumer" — and
-- none of them concerns selling channel. So the row became `unclear`, and Hawaii sellers stayed
-- blocked anyway, now by this function instead. A gap in our reference data was doing the work of a
-- state prohibition.
--
-- The predicate now reads: permitted unless the state has programmes and every one of them is
-- `banned`. A state with no programme rows at all is also permitted, because an absence of data has
-- never been evidence of a prohibition.
--
-- The five states with real, textual blanket bans — DE, MI, MS, NV, WA — carry `banned` on every
-- row and stay blocked. That is checked by `state-programs.test.ts`.

set search_path = public;

create or replace function public.state_allows_online_food_sales(p_state_code char(2))
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.state_food_programs
    where state_code = p_state_code
      and online_orders = 'banned'
  )
  or exists (
    select 1 from public.state_food_programs
    where state_code = p_state_code
      and online_orders <> 'banned'
  );
$$;

comment on function public.state_allows_online_food_sales(char) is
  'True unless the state has cottage-food programs and every one of them bans taking orders '
  'online. An unclear program is missing data on our side, not a prohibition by the state, so it '
  'does not block — only a recorded ban does.';
