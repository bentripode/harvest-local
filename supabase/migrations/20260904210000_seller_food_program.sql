-- Harvest Local — a seller picks which of their state's cottage-food programs they operate under.
--
-- Until now the two food gates asked "is this even possible somewhere in your state?", because
-- nothing recorded which program the seller was actually enrolled in. That is the right question
-- while we don't know, and the wrong one once we do: California runs three programs with different
-- permitted foods, and a Class A seller is not entitled to what a MEHKO may sell.
--
-- Recording the choice turns both gates from permissive to precise. Sellers who haven't chosen keep
-- the old behaviour, so nothing regresses for anyone mid-onboarding.

set search_path = public;

alter table public.seller_profiles
  add column if not exists food_program_id uuid references public.state_food_programs(id) on delete set null;

comment on column public.seller_profiles.food_program_id is
  'The state cottage-food program this seller operates under, chosen during onboarding. NULL means '
  'not yet chosen, in which case the food gates fall back to asking whether ANY program in the '
  'state permits the thing.';

create index if not exists seller_profiles_food_program_ix
  on public.seller_profiles (food_program_id);

-- ---------------------------------------------------------------------------
-- A program from another state is never a valid choice.
-- ---------------------------------------------------------------------------
create or replace function public.seller_profiles_guard_food_program()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_state char(2);
begin
  if new.food_program_id is null then
    return new;
  end if;

  select state_code into v_state
    from public.state_food_programs where id = new.food_program_id;

  if v_state is distinct from new.home_state then
    -- A seller who moves keeps trading; their old state's program simply no longer applies and
    -- they are asked to choose again. Anything else is a mis-set and should fail loudly.
    if tg_op = 'UPDATE' and new.home_state is distinct from old.home_state then
      new.food_program_id := null;
    else
      raise exception 'food program % does not belong to state %', new.food_program_id, new.home_state
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger seller_profiles_guard_food_program
  before insert or update of food_program_id, home_state on public.seller_profiles
  for each row execute function public.seller_profiles_guard_food_program();

-- ---------------------------------------------------------------------------
-- Seller-scoped gates: the chosen program when there is one, the whole state when there isn't.
-- ---------------------------------------------------------------------------
create or replace function public.seller_permits_food_axis(p_seller_id uuid, p_axis text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_column text;
  v_program uuid;
  v_state char(2);
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
  if v_column is null then
    return false;   -- an unrecognised axis is not a licence to sell
  end if;

  select food_program_id, home_state into v_program, v_state
    from public.seller_profiles where id = p_seller_id;
  if v_state is null then
    return true;    -- no storefront yet; nothing to gate
  end if;

  if v_program is null then
    return public.state_permits_food_axis(v_state, p_axis);
  end if;

  execute format(
    'select %I <> ''banned'' from public.state_food_programs where id = $1', v_column
  ) into v_permitted using v_program;

  return coalesce(v_permitted, false);
end;
$$;

comment on function public.seller_permits_food_axis(uuid, text) is
  'Whether this seller may sell food on this regulatory axis. Uses their chosen program when they '
  'have one, and falls back to "does any program in the state permit it" when they do not.';

create or replace function public.seller_allows_online_food_sales(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when sp.food_program_id is not null then
      coalesce((select fp.online_orders = 'allowed'
                  from public.state_food_programs fp where fp.id = sp.food_program_id), false)
    else public.state_allows_online_food_sales(sp.home_state)
  end
  from public.seller_profiles sp
  where sp.id = p_seller_id;
$$;

comment on function public.seller_allows_online_food_sales(uuid) is
  'Whether this seller may take food orders online. Their chosen program decides it when set; '
  'otherwise any program in the state permitting online orders is enough.';

revoke all on function public.seller_permits_food_axis(uuid, text) from public, anon;
revoke all on function public.seller_allows_online_food_sales(uuid) from public, anon;
grant execute on function public.seller_permits_food_axis(uuid, text) to authenticated, service_role;
grant execute on function public.seller_allows_online_food_sales(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Point both product gates at the seller-scoped versions.
-- ---------------------------------------------------------------------------
create or replace function public.products_guard_online_food_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_food boolean;
  v_state char(2);
begin
  if new.status = 'draft' or new.status = 'archived' then
    return new;
  end if;

  select requires_food_permit into v_is_food from public.categories where id = new.category_id;
  if not coalesce(v_is_food, false) then
    return new;
  end if;

  select home_state into v_state from public.seller_profiles where id = new.seller_id;
  if v_state is null then
    return new;
  end if;

  if not public.seller_allows_online_food_sales(new.seller_id) then
    raise exception
      'online food sales are not permitted for sellers in %', v_state
      using errcode = 'check_violation',
            hint = 'This state, or the program you selected, prohibits taking cottage-food orders online. Non-food listings are unaffected.';
  end if;

  return new;
end;
$$;

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
    if not public.seller_permits_food_axis(new.seller_id, v_axis) then
      raise exception
        '% does not permit selling % under the program you sell on', v_state, replace(v_axis, '_', ' ')
        using errcode = 'check_violation',
              hint = 'Choose a different program in onboarding, or list this under another category.';
    end if;
  end loop;

  return new;
end;
$$;
