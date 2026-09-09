-- Harvest Local — the rename 20260909150000 meant to do.
--
-- That migration matched `slug = 'herbs'`. Subcategory slugs are prefixed with their parent, so the
-- row is `produce-herbs` and the update hit nothing: the permit correction applied (it keyed on
-- `parent_id`) and the rename silently did not. A no-op UPDATE reports success, which is exactly why
-- the taxonomy invariants below are now an integration test rather than a thing I check by eye.
--
-- The rename matters because "Herbs" is ambiguous precisely where the money is. A bunch of cut basil
-- is a raw agricultural product and needs no cottage food permit. A jar of dried oregano is a
-- shelf-stable cottage food product that needs a permit, a programme, a label and an allergen
-- declaration. Putting "Fresh" in the name is what stops a seller filing the second under the first
-- and quietly escaping all four.

set search_path = public;

update public.categories
   set name = 'Fresh Herbs'
 where slug = 'produce-herbs';

comment on table public.categories is
  'The shopping taxonomy. `requires_food_permit` marks the branches that are COTTAGE food — '
  'prepared in a home kitchen — not merely edible: raw produce is food and is not cottage food. '
  'Category names carry the boundary where it is ambiguous ("Fresh Herbs"), because a seller '
  'choosing a category is the only person who knows which side of it their jar sits on.';
