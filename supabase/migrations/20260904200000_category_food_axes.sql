-- Harvest Local — gate a listing on the food categories the seller's state actually permits.
--
-- `state_food_programs` grades six axes: shelf-stable, refrigerated baked goods, meat, acidified or
-- pickled, low-acid canned, and fermented. Our own taxonomy is a shopping taxonomy — Baked Goods,
-- Pantry & Preserves — so nothing connects the two. This adds that link and enforces it.
--
-- ## On the mapping
--
-- Deciding which regulatory axis a marketplace category implicates is a judgement, and a wrong one
-- either blocks a legal product or lets an illegal one through. So the seed maps only what the
-- source's own vocabulary makes unambiguous, and leaves the rest EMPTY:
--
--   * Fresh produce is not one of the six axes at all — cottage food law is about processed food,
--     and whether raw produce is even in scope varies. Left unmapped.
--   * "Juice & Cider" could be acidified, refrigerated, or neither depending on the product.
--     Left unmapped.
--
-- An empty mapping means this gate does not fire, NOT that the category is unregulated —
-- `categories.requires_food_permit` and the licence gate still apply. The unmapped ones are visible
-- on /admin/programs so the gap is countable rather than silent, and an admin can fill them in as
-- the state data gets verified.
--
-- ## On severity
--
-- Only `banned` blocks. `conditional` (Colorado: meat allowed under 1,000 personally-raised
-- poultry), `list_only` and `limited` all mean "allowed, with a qualification", so the listing goes
-- through and the seller is shown the qualification. Blocking those would stop legal trade on a
-- technicality the source itself doesn't treat as a prohibition.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Which regulatory axes a marketplace category implicates.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists food_axes text[] not null default '{}';

alter table public.categories
  add constraint categories_food_axes_known
    check (food_axes <@ array['shelf_stable','refrigerated','meat','acidified','low_acid_canned','fermented']::text[]);

comment on column public.categories.food_axes is
  'Regulatory axes from state_food_programs that a listing in this category implicates. EMPTY means '
  'no axis rule is known for it — the gate does not fire, but requires_food_permit and the licence '
  'gate still apply. Never guess an axis: a wrong one blocks legal trade or permits illegal trade.';

update public.categories set food_axes = array['shelf_stable']
  where slug in ('baked-goods', 'baked-goods-bread', 'baked-goods-pastries', 'baked-goods-cakes-cookies',
                 'pantry-preserves', 'pantry-jam-jelly', 'pantry-honey', 'pantry-sauces-spices',
                 'beverages', 'beverages-coffee-tea');

update public.categories set food_axes = array['refrigerated']
  where slug in ('dairy-eggs', 'dairy-eggs-eggs', 'dairy-eggs-cheese', 'dairy-eggs-milk-butter');

update public.categories set food_axes = array['meat']
  where slug in ('meat-seafood', 'meat-seafood-poultry', 'meat-seafood-beef-pork', 'meat-seafood-seafood');

update public.categories set food_axes = array['acidified', 'fermented']
  where slug = 'pantry-pickles-ferments';

-- Deliberately left empty: produce and its children, beverages-juice-cider, and every non-food
-- category. See the header note.

-- ---------------------------------------------------------------------------
-- 2. Does any program in the state permit this axis?
--
-- Permissive on purpose while a seller has no chosen program: if ANY of the state's programs allows
-- the axis, the seller could in principle be enrolled in that one. This is the "is this even
-- possible where you live" check. It tightens to the seller's actual program once program
-- selection exists in onboarding.
-- ---------------------------------------------------------------------------
create or replace function public.state_permits_food_axis(p_state_code char(2), p_axis text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_column text;
  v_permitted boolean;
begin
  v_column := case p_axis
    when 'shelf_stable'    then 'cat_shelf_stable'
    when 'refrigerated'    then 'cat_refrigerated'
    when 'meat'            then 'cat_meat'
    when 'acidified'       then 'cat_acidified'
    when 'low_acid_canned' then 'cat_low_acid_canned'
    when 'fermented'       then 'cat_fermented'
  end;

  -- An axis we don't recognise is not a licence to sell: refuse rather than fail open.
  if v_column is null then
    return false;
  end if;

  -- Only an explicit 'banned' blocks. 'conditional', 'list_only' and 'limited' are qualifications,
  -- and 'unclear' is missing data, which should not stop a seller trading.
  execute format(
    'select exists (select 1 from public.state_food_programs where state_code = $1 and %I <> ''banned'')',
    v_column
  ) into v_permitted using p_state_code;

  return coalesce(v_permitted, false);
end;
$$;

comment on function public.state_permits_food_axis(char, text) is
  'True when at least one of the state''s programs does not ban this regulatory axis. Only an '
  'explicit ban blocks; conditional and list-only are qualifications shown to the seller.';

revoke all on function public.state_permits_food_axis(char, text) from public, anon;
grant execute on function public.state_permits_food_axis(char, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. The gate.
--
-- Same shape as products_guard_online_food_sales: drafts pass so a seller keeps their work, and
-- publishing is what's refused.
-- ---------------------------------------------------------------------------
create or replace function public.products_guard_food_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state char(2);
  v_axes text[];
  v_axis text;
begin
  if new.status = 'draft' or new.status = 'archived' then
    return new;
  end if;

  select food_axes into v_axes from public.categories where id = new.category_id;
  if v_axes is null or cardinality(v_axes) = 0 then
    return new;
  end if;

  select home_state into v_state from public.seller_profiles where id = new.seller_id;
  if v_state is null then
    return new;
  end if;

  foreach v_axis in array v_axes loop
    if not public.state_permits_food_axis(v_state, v_axis) then
      raise exception
        '% does not permit selling % under any of its cottage food programs', v_state, replace(v_axis, '_', ' ')
        using errcode = 'check_violation',
              hint = 'Every cottage food program in this state bans this kind of food.';
    end if;
  end loop;

  return new;
end;
$$;

create trigger products_guard_food_categories
  before insert or update of status, category_id, seller_id on public.products
  for each row execute function public.products_guard_food_categories();

-- ---------------------------------------------------------------------------
-- 4. Park anything already published that the seller's state bans.
--
-- `draft`, not deleted — same reasoning as the online-sales backfill. On the dev project this
-- affects nothing; on a populated database it stops the violation without destroying a listing.
-- ---------------------------------------------------------------------------
update public.products p
  set status = 'draft'
  from public.categories c, public.seller_profiles sp
  where c.id = p.category_id
    and sp.id = p.seller_id
    and p.status in ('active', 'sold_out')
    and cardinality(c.food_axes) > 0
    and exists (
      select 1 from unnest(c.food_axes) as axis
      where not public.state_permits_food_axis(sp.home_state, axis)
    );
