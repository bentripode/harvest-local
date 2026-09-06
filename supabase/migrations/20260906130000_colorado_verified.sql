-- Harvest Local — Colorado, from Colo. Rev. Stat. 25-4-1602, 25-4-1614 and 25-4-1614.5.
--
-- A PLACARD IS REQUIRED and we recorded none. 25-4-1614(3)(c): "A producer operating under this
-- section shall conspicuously display a placard, sign, or card at the point of sale with the
-- following disclaimer: This product was produced in a home kitchen that is not subject to state
-- licensure or inspection. This product is not intended for resale."
--
-- Note the placard text is NOT the label text. The label disclaimer at (3)(a)(V) additionally names
-- the nine allergens; the placard is the shorter sentence. Both are quoted statute and both are
-- stored verbatim, separately, because printing one where the other belongs would be wrong.
--
-- THE LABEL was missing two required elements and asserting one Colorado never asks for.
-- 25-4-1614(3)(a) requires: "(I) Identification of the product; (II) The producer's name,
-- department-issued registration number, the county in which the food was prepared, and the
-- producer's current telephone number or electronic mail address; (III) The date on which the food
-- was produced; (IV) A complete list of ingredients; (V) The following disclaimer: ...; (VI) A
-- website address provided by the department".
--
--   MISSING: `permit_number` — the department-issued registration number is required on every
--   label, and Colorado registration is exactly what makes a producer lawful here.
--   MISSING: `municipality` — "the county in which the food was prepared".
--   NOT REQUIRED: `producer_address`. Colorado asks for name, registration number, county and a
--   phone number or email. It never asks for a street address, and requiring one made
--   `renderLabel()` demand a field the state does not.
--
-- `producer_email` is also dropped, for a modelling reason rather than a legal one. The statute
-- says "telephone number OR electronic mail address"; `required_elements` has no way to express an
-- alternative, and requiring both would stop the label printing for a producer who has only one.
-- Phone is kept as the commoner of the two and the note records that an email address satisfies
-- Colorado equally.
--
-- Like Arizona, one requirement cannot be expressed at all: (3)(a)(VI) demands "A website address
-- provided by the department that includes contact information for consumers to report food-borne
-- illnesses, how to verify a producer's active registration, and how to report issues regarding a
-- producer's registration status." There is no element for a state-supplied URL. A Colorado label
-- generated from this row is short by that item and the seller must add it.
--
-- Colorado also does not require descending ingredient order — (IV) asks only for "A complete list
-- of ingredients" — so `ingredients_desc_by_weight` overstates the duty, harmlessly.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'permit_number', 'municipality',
    'producer_phone', 'production_date', 'ingredients_desc_by_weight'
  ],
  placard_required = true,
  placard_text = 'This product was produced in a home kitchen that is not subject to state licensure or inspection. This product is not intended for resale.',
  notes =
    'Colo. Rev. Stat. 25-4-1614(3), read 2026-09-06. THE PLACARD AND THE LABEL CARRY DIFFERENT '
    'TEXT: (3)(c) requires a placard, sign or card conspicuously displayed at the point of sale '
    'with the shorter sentence, while the label disclaimer at (3)(a)(V) additionally names the nine '
    'allergens. Do not substitute one for the other. Two things this row cannot express. (3)(a)(VI) '
    'requires "A website address provided by the department" covering foodborne-illness reporting '
    'and registration verification — there is no element for a state-supplied URL, so a generated '
    'label is short by that item. And (3)(a)(II) asks for "the producer''s current telephone number '
    'or electronic mail address" — an alternative our fixed list cannot hold, so phone is required '
    'here and an email address satisfies Colorado just as well. Colorado asks for no street address '
    'and no net weight, and (IV) wants "A complete list of ingredients" without prescribing '
    'descending order, so the ingredient element used here is slightly stricter than the statute.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Colorado.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'CO' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Colo. Rev. Stat. 25-4-1614 confines sales to Colorado and bars interstate commerce, and the '
    'required disclaimer states the product "is not intended for resale" — hence retail_allowed '
    'false. The statute read here does not address delivery to a buyer''s address either way, so '
    'direct_delivery is left unclear rather than assumed.',
  license_note =
    'Registration is required and appears on the product: 25-4-1614(3)(a)(II) puts the '
    '"department-issued registration number" on every label, and (3)(a)(VI) requires a department '
    'website address explaining "how to verify a producer''s active registration". Enforcement is '
    'complaint-driven — (4)(a) makes a product subject to sampling and inspection if it is '
    'misbranded, if a consumer complaint is received, or if it is suspected in an injury or '
    'food-borne illness outbreak.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Colorado.pdf'
where state_code = 'CO' and ordinal = 1 and verified_at is null;
