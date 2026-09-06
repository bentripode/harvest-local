-- Harvest Local — an unrecorded online-sales rule must not punish the seller who told us more.
--
-- `seller_allows_online_food_sales` currently asks two different questions depending on whether the
-- seller has chosen a programme:
--
--   * no programme chosen  -> `state_allows_online_food_sales`, which is true unless EVERY programme
--                             in the state bans it. `unclear` does not block.
--   * programme chosen     -> `fp.online_orders = 'allowed'`. `unclear` DOES block.
--
-- So a seller who tells us their programme can end up worse off than one who says nothing. That is
-- backwards: `/seller/onboarding/program` sells the choice as making the rules *precise*, and rule 7
-- already states the principle for the food axes — "`unclear` is missing data and must not stop a
-- seller trading." A gap in our own reference data is not evidence that a state prohibits anything.
--
-- No row is affected today: all 69 programmes are `allowed` (57) or `banned` (12). This is a latent
-- trap rather than a live one, and it is worth closing precisely because of how it would arrive —
-- `online_orders` DEFAULTS to 'unclear', so the next programme row added without setting it would
-- silently block every seller who picked it, with no error to explain why. That is exactly how it
-- surfaced: integration fixtures created programme rows, inherited the default, and failed with
-- "online food sales are not permitted" in suites that had nothing to do with online sales.
--
-- An outright ban still blocks, which is the whole point of the column.

set search_path = public;

create or replace function public.seller_allows_online_food_sales(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when sp.food_program_id is not null then
      -- `<> 'banned'` rather than `= 'allowed'`: only a recorded prohibition stops the sale.
      coalesce((select fp.online_orders <> 'banned'
                  from public.state_food_programs fp where fp.id = sp.food_program_id), false)
    else public.state_allows_online_food_sales(sp.home_state)
  end
  from public.seller_profiles sp
  where sp.id = p_seller_id;
$$;

comment on function public.seller_allows_online_food_sales(uuid) is
  'Whether this seller may take food orders online. Their chosen program decides it when set, and '
  'only a recorded ban blocks — an unclear program is missing data on our side, not a prohibition '
  'by the state. Otherwise any program in the state not banning online orders is enough.';
