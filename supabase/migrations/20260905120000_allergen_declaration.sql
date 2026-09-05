-- Harvest Local — make "no allergens" something a seller said, not something we assumed.
--
-- `products.allergens` is a text[] of the federal nine, and an empty array has been carrying two
-- entirely different meanings: "this product contains none of them" and "nobody ever filled this
-- in". Those are not the same claim, and since the pre-checkout disclosure renders the label to the
-- buyer, the second one silently becomes the first the moment a listing goes live. A seller who
-- scrolls past the allergen section publishes a label asserting a safety fact they never asserted.
--
-- `allergens_confirmed_at` is the missing half: the timestamp a seller explicitly said "none of the
-- nine". Ticking allergens is itself an answer, so the rule to publish a food listing is:
--
--     at least one allergen ticked  OR  allergens_confirmed_at is set
--
-- Null therefore means "never asked", which is what every existing row honestly is. They keep their
-- current status; the guard only bites when something is published or republished.
--
-- Non-food listings are untouched, and nothing here blocks a draft — same scope as the ingredients
-- and net-weight rule this extends (`20260905110000`).

set search_path = public;

alter table public.products
  add column if not exists allergens_confirmed_at timestamptz;

comment on column public.products.allergens_confirmed_at is
  'When the seller explicitly declared this product contains none of the federal nine allergens. '
  'Null means the question was never answered — which is NOT the same as "contains none", and is '
  'why an empty allergens array alone cannot publish a food listing.';

-- ---------------------------------------------------------------------------
-- Fold the allergen answer into the existing publish guard.
-- ---------------------------------------------------------------------------
create or replace function public.products_guard_label_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_food boolean;
begin
  -- Not on sale, nothing to disclose.
  if new.status in ('draft', 'archived') then
    return new;
  end if;

  -- Food-ness is derived from the catalogue, never self-declared — same source as the permit gate
  -- (`seller_sells_cottage_food`). Either the category or the subcategory carrying the flag is
  -- enough, so a food subcategory under a non-food parent still counts.
  select coalesce(bool_or(c.requires_food_permit), false)
    into v_food
    from public.categories c
   where c.id = new.category_id
      or c.id = new.subcategory_id;

  if not v_food then
    return new;
  end if;

  if new.ingredients is null or jsonb_array_length(new.ingredients) = 0 then
    raise exception 'a food listing needs its ingredients before it can be published'
      using errcode = 'check_violation',
            hint = 'List the ingredients, most to least by weight, then publish.';
  end if;

  if new.net_weight_value is null or new.net_weight_unit is null then
    raise exception 'a food listing needs its net weight before it can be published'
      using errcode = 'check_violation',
            hint = 'Enter the net quantity and its unit, then publish.';
  end if;

  if coalesce(cardinality(new.allergens), 0) = 0 and new.allergens_confirmed_at is null then
    raise exception 'a food listing needs an allergen answer before it can be published'
      using errcode = 'check_violation',
            hint = 'Tick every allergen present, or confirm it contains none of the nine.';
  end if;

  return new;
end;
$$;

comment on function public.products_guard_label_fields() is
  'A product in a requires_food_permit category cannot reach active or sold_out without its '
  'ingredients, its net weight, and an answered allergen question — the label facts the product '
  'row owns, and the ones the buyer is shown before paying. draft and archived are exempt.';
