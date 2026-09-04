-- Harvest Local — the product data a compliant cottage-food label needs.
--
-- Across 51 jurisdictions the required label elements collapse to a small set, and three of them
-- have no home on a `products` row today:
--
--   * ingredients IN DESCENDING ORDER OF PREDOMINANCE BY WEIGHT — required in nearly every state.
--     A free-text description cannot produce an ordered list, so this has to be structured.
--   * net weight or volume — required almost everywhere; North Carolina, Tennessee and Connecticut
--     want the metric equivalent alongside it, which is derived rather than stored.
--   * major allergens — a fixed federal vocabulary of nine, several states naming the list
--     explicitly. Prose in a description is not checkable and not printable.
--
-- These are nullable: the label generator, which is what actually needs them, does not exist yet,
-- and requiring them now would be friction with no payoff. The generator will require them at the
-- point it can offer something in return.
--
-- Deliberately NOT here: production date and lot code. Those are per-batch, not per-product — the
-- label printing step asks for them rather than storing a value that goes stale on the next bake.

set search_path = public;

alter table public.products
  add column if not exists ingredients      jsonb not null default '[]'::jsonb,
  add column if not exists net_weight_value numeric(10,3),
  add column if not exists net_weight_unit  text,
  add column if not exists allergens        text[] not null default '{}';

comment on column public.products.ingredients is
  'Ordered list of ingredient names. ORDER IS MEANINGFUL: states require descending order of '
  'predominance by weight, so the seller''s order is the label''s order. Never re-sort it.';

comment on column public.products.net_weight_value is
  'Net quantity in net_weight_unit. The metric equivalent that NC, TN and CT require is derived at '
  'render time (src/lib/products/labeling.ts), not stored.';

comment on column public.products.allergens is
  'Major allergens present, from the federal set of nine (sesame added by the FASTER Act). '
  'Constrained below so a typo cannot reach a label.';

-- Ingredients must be a JSON array — the app writes string[], and a bare object or scalar here
-- would break every label that reads it.
alter table public.products
  add constraint products_ingredients_is_array
    check (jsonb_typeof(ingredients) = 'array') not valid;

-- A unit is meaningless without a quantity and vice versa.
alter table public.products
  add constraint products_net_weight_pair
    check (num_nulls(net_weight_value, net_weight_unit) <> 1) not valid;

alter table public.products
  add constraint products_net_weight_unit_known
    check (net_weight_unit is null or net_weight_unit in ('oz', 'lb', 'g', 'kg', 'fl_oz', 'ml', 'count'))
    not valid;

alter table public.products
  add constraint products_net_weight_positive
    check (net_weight_value is null or net_weight_value > 0) not valid;

-- The allergen vocabulary is fixed by federal law, so it belongs at the data layer: an allergen
-- that reaches a label misspelled is worse than one that was refused at write time.
alter table public.products
  add constraint products_allergens_known
    check (allergens <@ array['milk','eggs','fish','shellfish','tree_nuts','peanuts','wheat','soybeans','sesame']::text[])
    not valid;

-- All NOT VALID: existing rows keep whatever they have (the defaults make them compliant anyway),
-- while every new write is checked. Nothing in the catalogue needs rewriting for this.
