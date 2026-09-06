-- Harvest Local — model the conditional element as conditional, instead of as a code exception.
--
-- `nutrition_if_claimed` sat in `required_elements` for fourteen rules across ten states (DC, FL,
-- GA, MD, MI, MS, OR ×3, VA ×2, VT ×3), and `valueFor()` returns null for it unconditionally —
-- a nutrition panel needs per-serving figures nothing here collects.
--
-- THIS IS NOT A BUG FIX, AND AN EARLIER DRAFT OF THIS COMMENT CLAIMED IT WAS. Those labels print
-- fine today, because `renderLabel()` carries an explicit exception:
--
--     if (value == null || value === "") {
--       // Nutrition is conditional on a claim the seller makes; never block a label on it.
--       if (raw !== "nutrition_if_claimed") { missing.push(...) }
--
-- So the behaviour is already correct. What is wrong is the data underneath it: an element the
-- renderer must be told to ignore is not a required element. Every state that asks for nutrition
-- labelling asks CONDITIONALLY — on a nutrient claim, or on the seller failing the 21 CFR 101.9(j)
-- small-business exemption — and neither condition is a fact this schema records.
--
-- `optional_elements` is exactly that bucket: print it if there is a value, never block on it. It
-- is where AS 17.20.332's "if applicable" business licence number lives. Moving the fourteen rows
-- there makes the data say what the code already does, and means a new state added tomorrow gets
-- the right behaviour from its rule rather than from a name-check in the renderer.
--
-- Utah is what surfaced it: R70-560-6(2)(g) requires "nutritional labeling unless the product
-- qualifies for an exemption", the same shape, and it goes straight into the optional list.
--
-- THE RENDERER'S EXCEPTION STAYS. Nothing in the schema stops an admin re-adding the element to a
-- required list through /admin/programs, and the belt-and-braces guard is one line.
--
-- WHAT THIS DOES NOT DO: it does not stop recording that these states have a nutrition rule, and it
-- does not tell a seller nutrition labelling is optional in law. The requirement stays on the rule
-- and in its notes; producing a compliant panel where one is genuinely required is the seller's own
-- duty under federal law, which is what the appended note says. Teaching the renderer to compose a
-- panel is a real feature needing per-serving data we do not collect, and is not something an
-- alphabetical verification pass should invent on the way past.

set search_path = public;

update public.state_label_rules set
  required_elements = array_remove(required_elements, 'nutrition_if_claimed'),
  optional_elements =
    case
      when 'nutrition_if_claimed' = any(coalesce(optional_elements, '{}'::text[]))
        then optional_elements
      else coalesce(optional_elements, '{}'::text[]) || array['nutrition_if_claimed']::text[]
    end,
  notes = coalesce(notes, '') ||
    ' UPDATE (20260906540000): nutrition labelling moved from the required list to the optional one. '
    'It stays recorded because the state asks for it, but it is conditional in every state that does '
    '— on a nutrient claim, or on the 21 CFR 101.9(j) small-business exemption — and nothing here '
    'collects the per-serving values a panel needs. No label changes: renderLabel() already refused '
    'to block on it. Producing a compliant nutrition panel where one is genuinely required remains '
    'the seller''s own responsibility under federal law.'
where 'nutrition_if_claimed' = any(coalesce(required_elements, '{}'::text[]));
