-- Harvest Local — Arizona's programme and label rule, from A.R.S. 36-136, 36-931, 36-932 and
-- Ariz. Admin. Code R9-8-110.
--
-- The disclaimer was already exact, which is the first time that has been true: the stored text
-- matches A.R.S. 36-932(A)(3) word for word. Worth noting that the administrative code carries an
-- OLDER version of the same sentence — R9-8-110 says "may process common FOOD allergens" where the
-- statute says "may come in contact with common food allergens and pet allergens" — and the statute
-- is both higher authority and the later word, so the stored text is the right one to print.
--
-- MEAT was recorded as allowed. 36-931(1)(b) excludes "alcoholic beverages, unpasteurized milk or
-- foods that are or that contain alcoholic beverages, fish and shellfish products, meat, meat
-- by-products, poultry or poultry by-products unless the sale of those items is allowed by federal
-- law", then lists what federal law does allow: poultry under the 1,000-bird exemption at 9 C.F.R.
-- 381.10(c), poultry from an inspected source under 381.10(d), and meat from an inspected source.
-- That is conditional, not allowed.
--
-- The label elements were wrong in one place and incomplete in two others.
--
--   business_name -> producer_name. 36-932(A)(1) asks the label to "Clearly state the name and
--   registration number of the food preparer" — the person, not a trading name.
--
--   TWO REQUIREMENTS CANNOT BE EXPRESSED AT ALL, and both are recorded here rather than dropped
--   silently. 36-932(A)(5) requires the label to include "a website address provided by the
--   department" carrying contact information for reporting foodborne illness and a way to verify
--   the preparer's registration — there is no element in our fixed vocabulary for a
--   department-supplied URL. 36-932(A)(4) requires disclosure where the product "was made in a
--   facility for individuals with developmental disabilities", which is conditional and equally
--   inexpressible. An Arizona label printed from this row is therefore INCOMPLETE by two items, and
--   the seller has to add them by hand.
--
--   Arizona does NOT require ingredients in descending order — 36-932(A)(2) says only "Lists all
--   the ingredients in the cottage food product and the cottage food product's production date".
--   `ingredients_desc_by_weight` is the only ingredient element we have, so it stands in and
--   overstates the duty slightly; a label in descending order still complies.
--
-- Confirmed already correct: registration required and renewed every three years (36-136(I)(13)),
-- refrigerated permitted — 36-931(1)(a)(ii) expressly contemplates a cottage food product that "Is
-- potentially hazardous or requires time or temperature control for safety", which is rare — and
-- local preemption.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_food_programs set
  cat_meat = 'conditional',
  category_note =
    'Arizona is unusual in permitting potentially hazardous cottage food: 36-931(1)(a) defines a '
    'cottage food product as one that either "Is not potentially hazardous or does not require time '
    'or temperature control for safety" OR "Is potentially hazardous or requires time or temperature '
    'control for safety". Excluded by (1)(b): "alcoholic beverages, unpasteurized milk or foods '
    'that are or that contain alcoholic beverages, fish and shellfish products, meat, meat '
    'by-products, poultry or poultry by-products unless the sale of those items is allowed by '
    'federal law" — with poultry under the 9 C.F.R. 381.10(c) 1,000-bird exemption, poultry from an '
    'inspected source under 381.10(d), and meat from an inspected source all named as permitted. '
    'Hence meat conditional. The fish and shellfish exclusion has no axis here.',
  license_note =
    'Registration, not a licence, and it is built into the definition: 36-931(1)(a) requires the '
    'product be prepared "by or under the direct supervision of an individual who is registered '
    'with the department". 36-136(I)(13) requires the department to keep an online registry and '
    'provides that "A registered food preparer shall renew the registration every three years and '
    'shall provide to the department updated registration information within thirty days after any '
    'change."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arizona.pdf'
where state_code = 'AZ' and ordinal = 1 and verified_at is null;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'permit_number', 'ingredients_desc_by_weight', 'production_date'
  ],
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'No point size is prescribed, but 36-932(A) requires the label be "in a clear and legible '
    'printed or handwritten font" — handwritten is expressly acceptable in Arizona.',
  notes =
    'A.R.S. 36-932(A), read 2026-09-06; the disclaimer text was already verbatim and is unchanged. '
    'INCOMPLETE BY TWO ITEMS, both inexpressible in our fixed element vocabulary and both required '
    'by statute. (A)(5): the label must include "a website address provided by the department" that '
    'carries contact information for reporting foodborne illness and a way to verify the preparer''s '
    'active registration. (A)(4): where the product was made in a facility for individuals with '
    'developmental disabilities, the label must disclose that. A seller must add both by hand. '
    'Also note Arizona does NOT require ingredients in descending order — (A)(2) asks only that the '
    'label "Lists all the ingredients ... and the cottage food product''s production date" — so the '
    'element used here is the closest we have and overstates the duty. Ariz. Admin. Code R9-8-110 '
    'carries an older form of the disclaimer ("may process common FOOD allergens"); the statute is '
    'later and higher authority, so the stored wording follows the statute.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arizona.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'AZ' and ordinal = 1
)
and verified_at is null;
