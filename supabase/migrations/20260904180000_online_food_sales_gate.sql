-- Harvest Local — a seller in a state that bans online cottage-food sales may not list food.
--
-- Delaware, Hawaii, Michigan, Mississippi and Nevada prohibit taking cottage-food orders online
-- under every program they run (`state_food_programs.online_orders = 'banned'`). Six more states
-- ban it under one program and allow it under another. A seller in a fully-banned state can still
-- run a storefront for candles, soap and cut flowers — but every food listing they publish is a
-- violation of their own state's law, made through our marketplace.
--
-- This is the smallest change with the largest legal exposure, so it sits at the data layer next to
-- the other guardrails rather than in a request handler: the rule holds no matter which code path
-- writes the row.
--
-- Deliberately NOT a storefront pause. Pausing would take down the legal candle listings alongside
-- the illegal bread, which punishes the seller for a rule they didn't break. The food listing is
-- what's prohibited, so the food listing is what's blocked.

set search_path = public;

-- ---------------------------------------------------------------------------
-- The predicate. Derived from the seeded programs, never a hardcoded state list — when an admin
-- verifies or corrects a program, the gate follows automatically.
-- ---------------------------------------------------------------------------
create or replace function public.state_allows_online_food_sales(p_state_code char(2))
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.state_food_programs
    where state_code = p_state_code
      and online_orders = 'allowed'
  );
$$;

comment on function public.state_allows_online_food_sales(char) is
  'True when at least one of the state''s cottage-food programs permits taking orders online. '
  'False for the states that ban it outright, which is what blocks food listings there.';

revoke all on function public.state_allows_online_food_sales(char) from public, anon;
-- Readable by signed-in users: the product form asks before offering a food category, and the
-- answer is public reference data anyway (state_food_programs is world-readable).
grant execute on function public.state_allows_online_food_sales(char) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The gate.
--
-- Blocks a food-category product from reaching a publicly visible status. `draft` is allowed
-- through on purpose: it keeps a seller's work if their state's law changes, and it gives the
-- backfill below somewhere to park existing listings without deleting anyone's data.
-- ---------------------------------------------------------------------------
create or replace function public.products_guard_online_food_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state char(2);
  v_is_food boolean;
begin
  if new.status = 'draft' or new.status = 'archived' then
    return new;
  end if;

  select requires_food_permit into v_is_food
    from public.categories where id = new.category_id;
  if not coalesce(v_is_food, false) then
    return new;
  end if;

  select home_state into v_state
    from public.seller_profiles where id = new.seller_id;
  if v_state is null then
    return new;
  end if;

  if not public.state_allows_online_food_sales(v_state) then
    raise exception
      'online food sales are not permitted for sellers in %', v_state
      using errcode = 'check_violation',
            hint = 'This state prohibits taking cottage-food orders online. Non-food listings are unaffected.';
  end if;

  return new;
end;
$$;

create trigger products_guard_online_food_sales
  before insert or update of status, category_id, seller_id on public.products
  for each row execute function public.products_guard_online_food_sales();

-- ---------------------------------------------------------------------------
-- Backfill: park anything already published in a banned state.
--
-- `draft` rather than `archived` — the listing stops being purchasable immediately (products RLS
-- only exposes `active` publicly), and nothing the seller wrote is destroyed. Runs before any
-- notification so the violation stops first.
-- ---------------------------------------------------------------------------
with parked as (
  update public.products p
    set status = 'draft'
    from public.categories c, public.seller_profiles sp
    where c.id = p.category_id
      and sp.id = p.seller_id
      and c.requires_food_permit
      and p.status in ('active', 'sold_out')
      and not public.state_allows_online_food_sales(sp.home_state)
    returning sp.profile_id, sp.home_state
)
insert into public.notifications (user_id, channel, template, payload)
select
  parked.profile_id,
  ch.channel,
  'state_bans_online_food',
  jsonb_build_object('state', parked.home_state)
from (select distinct profile_id, home_state from parked) as parked
cross join (values ('in_app'), ('email')) as ch(channel);
