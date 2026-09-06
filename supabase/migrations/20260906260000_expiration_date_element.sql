-- Harvest Local — an expiry date on the label, because Iowa asks for one.
--
-- Iowa Code 137D.2(7)(e) requires a home food processing establishment to label a homemade food item
-- with, among other things, "For refrigerated time/temperature control for safety foods, an
-- expiration date based on food safety."
--
-- Iowa is the first state in this pass whose programme permits refrigerated food AND prescribes what
-- goes on its label. (Idaho permits perishable food but asks for handling instructions instead,
-- which needs a product field rather than a vocabulary entry and is still recorded as a gap.)
--
-- `expiration_date` joins `production_date` and `lot_code` as a per-BATCH value: it is a fact about
-- the jar in front of the seller, not about the listing, so it is asked for at print time and never
-- stored on the product.
--
-- It goes in Iowa's `optional_elements`, not `required_elements`, and the reason is that the duty is
-- conditional on a fact we cannot see. (7)(e) bites only for a refrigerated TCS food, and nothing in
-- our schema says whether a given product is one. Required, it would block every Iowa label,
-- including the shelf-stable majority the subsection does not reach. Optional, it prints whenever
-- the seller fills it in, and the rule's notes tell them when Iowa obliges them to.

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
        'expiration_date', 'nutrition_if_claimed', 'regulator_website'
      ]::text[]
      and optional_elements <@ array[
        'product_name', 'producer_name', 'business_name', 'producer_address', 'producer_phone',
        'producer_email', 'permit_number', 'municipality', 'municipality_state',
        'ingredients_desc_by_weight', 'net_weight', 'allergens', 'production_date', 'lot_code',
        'expiration_date', 'nutrition_if_claimed', 'regulator_website'
      ]::text[]
    );
