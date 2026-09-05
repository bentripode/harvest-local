-- Harvest Local — a food listing may not go live without its ingredients and net weight.
--
-- `20260904190000_product_label_fields.sql` added these columns and left them optional, "until the
-- label generator can require them in exchange for something". The label generator now exists, and
-- so does the pre-checkout disclosure (`20260904260000`) — which means an incomplete product row is
-- no longer a private gap in the seller's dashboard. It is rendered to the buyer, above the pay
-- button, as the label information the state requires them to have seen. Two listings on the dev
-- project were doing exactly that: no ingredients, no net weight, live, and disclosed to buyers.
--
-- These are the only two label facts that live on the PRODUCT. Producer name, address, permit
-- number and the disclaimer all come from the seller profile or the state rule, so a product-level
-- guard cannot and should not reach for them.
--
-- Deliberately a flat rule rather than a per-program one. `state_label_rules.required_elements`
-- does record which of the 69 programs require which element (55 ask for ingredients, 36 for net
-- weight), but every one of those rows is seeded UNVERIFIED — and gating a seller's livelihood on
-- an unchecked row is the same mistake as pausing a storefront on a placeholder revenue cap.
-- Requiring both of every food listing is stricter than some states and wrong in none of them.
--
-- `draft` and `archived` pass, as with the online-sales and category gates: neither is on sale, and
-- refusing to save a draft would take the seller's work away mid-edit. The two archived listings
-- this migration was written for stay archived and stay readable.

set search_path = public;

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

  return new;
end;
$$;

create trigger products_guard_label_fields
  before insert or update on public.products
  for each row execute function public.products_guard_label_fields();

comment on function public.products_guard_label_fields() is
  'A product in a requires_food_permit category cannot reach active or sold_out without its '
  'ingredients and net weight — the two label facts the product row owns, and the ones the buyer '
  'is shown before paying. draft and archived are exempt.';
