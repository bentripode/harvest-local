-- Harvest Local — Vermont's label rules, from the administrative code instead of a summary.
--
-- All four Vermont rows carried the same five required elements, no disclaimer, and a citation to a
-- summary page rather than Vermont law. VT Admin. Code 12-5-52 section 6.2.1 sets the actual
-- requirements for a license-exempt food manufacturing establishment, and it is both longer and
-- stricter than what we had:
--
--   6.2.1.1.1  "The name and address of the operation"
--   6.2.1.1.2  "The name of the food product"
--   6.2.1.1.3  "The ingredients of the food product, in descending order of predominance by weight"
--   6.2.1.1.4  "The net weights or net volumes of the food product"
--   6.2.1.1.5  "Allergen information as specified by federal labeling requirements"
--   6.2.1.1.6  "Nutritional labeling as specified by federal labeling requirements is required if
--               any nutrient content claim, health claim, or other nutritional information is
--               provided"
--   6.2.1.1.7  a statement "printed in at least 10-point type in a color that provides a clear
--               contrast to the background label: Made in a home kitchen not inspected by the
--               Vermont Department of Health."
--
-- Two consequences. ALLERGENS and NUTRITION-IF-CLAIMED were missing from every Vermont row, so the
-- label generator would have omitted a required field. And Vermont has a MANDATORY DISCLAIMER that
-- we recorded as having none — a Vermont label printed from our data would have gone out without
-- the one sentence the rule insists on, at the one size it insists on.
--
-- The disclaimer is stored verbatim, as rule 5 of the label generator requires: it is quoted
-- regulation, printed as-is, never paraphrased.
--
-- SCOPE. Section 6.2.1 is headed "Labeling Requirements for License Exempt Food Manufacturing
-- Establishments", so by its own terms it governs the three exempt routes — Home Baker, Home Food
-- Processor and Cottage Food Operation. HOME CATERER is licensed under the restaurant schedule at
-- 4353(1)VII rather than exempt, so 6.2.1 does not reach it and nothing in the material read here
-- says what a caterer must label. That row is left alone with a note saying so, rather than given
-- requirements by assumption.
--
-- `verified_at` stays null: the attestation is a person's, per environment.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'product_name',
    'ingredients_desc_by_weight', 'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  disclaimer_text = 'Made in a home kitchen not inspected by the Vermont Department of Health.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note = 'Must be "in a color that provides a clear contrast to the background label" (VT Admin. Code 12-5-52 6.2.1.1.7).',
  metric_required = false,
  placard_required = false,
  notes =
    'VT Admin. Code 12-5-52 6.2.1, "Labeling Requirements for License Exempt Food Manufacturing '
    'Establishments". Replaces a summary-derived rule that omitted allergens and nutrition-if-'
    'claimed and recorded no disclaimer at all, though the rule requires one at a minimum size.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Vermont.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs
  where state_code = 'VT' and ordinal in (1, 2, 4)
)
and verified_at is null;

-- The caterer is licensed, not exempt, so 6.2.1 does not reach it by its own terms.
update public.state_label_rules set
  notes =
    'NOT SOURCED. VT Admin. Code 12-5-52 6.2.1 is headed "Labeling Requirements for License Exempt '
    'Food Manufacturing Establishments" and a home caterer is licensed under the restaurant '
    'schedule at 18 V.S.A. 4353(1)VII rather than exempt, so that section does not reach this row. '
    'Nothing in the statute or rule read on 2026-09-06 states what a Vermont home caterer must put '
    'on a label. The elements here are inherited from the original summary-derived seed and should '
    'not be relied on. Resolve with the Department before verifying.'
where program_id in (
  select id from public.state_food_programs
  where state_code = 'VT' and ordinal = 3
)
and verified_at is null;
