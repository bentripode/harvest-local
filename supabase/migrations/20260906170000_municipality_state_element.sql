-- Harvest Local — one more label element, because Delaware asks for a phrase, not a field.
--
-- 16 Del. Admin. Code 4458A 8.2.1 lists what a cottage food label must carry, and one of the items
-- is literally `"town/city, Delaware"` — the town AND the state, together. `municipality` renders
-- the town alone, so a Delaware label built from it would read "Wilmington" where the regulation
-- requires "Wilmington, Delaware". That is a non-compliant label, not a formatting preference.
--
-- Rather than special-case Delaware inside the renderer, or leave a note asking the seller to
-- append the state by hand, the vocabulary gains `municipality_state`. It is missing unless BOTH
-- halves are known, which is correct: half of the required phrase is not the phrase.
--
-- `municipality` stays, and stays in use. California (114365.3(e)(4)) and Colorado
-- (25-4-1614(3)(a)(II)) want the COUNTY on its own, with no state appended; the two elements are
-- not interchangeable and neither should be retired in favour of the other.

set search_path = public;

alter table public.state_label_rules
  drop constraint if exists state_label_rules_elements_known;

alter table public.state_label_rules
  add constraint state_label_rules_elements_known
    check (
      required_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'nutrition_if_claimed', 'regulator_website'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'nutrition_if_claimed', 'regulator_website'
      ]::text[]
    );
