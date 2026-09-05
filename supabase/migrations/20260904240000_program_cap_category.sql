-- Harvest Local — the column a per-category cap actually needs.
--
-- `record_order_revenue` (20260904230000) reads `state_food_programs.cap_category` to know WHICH
-- category a per-category cap applies to, but that column was never added: the programs migration
-- recorded the fact in the free-text `cap_note` instead. The integration suite caught it — every
-- call failed with "column fp.cap_category does not exist".
--
-- Virginia is the only program with this basis today: no general cap, $3,000 on acidified and
-- pickled foods alone.

set search_path = public;

alter table public.state_food_programs
  add column if not exists cap_category text;

comment on column public.state_food_programs.cap_category is
  'For cap_basis = ''per_category'', the regulatory axis the cap applies to. Everything else the '
  'seller sells is uncapped. Null for every other basis.';

alter table public.state_food_programs
  add constraint state_food_programs_cap_category_known
    check (cap_category is null or cap_category in
      ('shelf_stable', 'refrigerated', 'meat', 'acidified', 'low_acid_canned', 'fermented'));

-- A per-category cap with no category named would silently tally nothing.
alter table public.state_food_programs
  add constraint state_food_programs_cap_category_required
    check (cap_basis <> 'per_category' or cap_category is not null) not valid;

update public.state_food_programs
  set cap_category = 'acidified'
  where cap_basis = 'per_category';

alter table public.state_food_programs
  validate constraint state_food_programs_cap_category_required;
