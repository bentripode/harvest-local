-- Harvest Local — Hawaii, from Haw. Admin. Rules 11-50-2, 11-50-3(c) and 11-50-35(c), read
-- 2026-09-06.
--
-- 20260906030000 already lifted Hawaii's online ban, which had been seeded on nothing. This
-- finishes the state: the label rule and the category axes, both still carrying summary data.
--
-- =========================================================================
-- 1. THE CATEGORY BANS ARE RIGHT, AND FOR ONCE THEY ARE IN THE TEXT
-- =========================================================================
-- Three states checked earlier today (DC, FL, GA) had `cat_acidified` and `cat_fermented` banned on
-- nothing — "non-potentially hazardous" excludes neither, and a pickle below pH 4.6 is not
-- hazardous. Hawaii is the opposite case, and the definition does the work itself. 11-50-2:
--
--   "Homemade food products" means not potentially hazardous food produced or packaged in a home
--   kitchen but does not include fermented foods, acidified foods, canned or bottled foods, dried
--   meats or seafood, low acid canned foods and garlic in oil.
--
-- Every one of the five bans on this row is named in that sentence. Nothing changes; the sentence is
-- recorded so the next reader can see the difference between a ban that was checked and a ban that
-- was inherited.
--
-- =========================================================================
-- 2. "CONTACT INFORMATION" IS NOT "TELEPHONE NUMBER"
-- =========================================================================
-- The label required `producer_phone`. 11-50-35(c)(3)(D) asks for "Name and contact information of
-- the homemade food product producer" — it does not name a channel. Requiring a phone number
-- specifically would stop the label printing for a producer who gives an email address, which
-- satisfies Hawaii perfectly. It becomes an alternatives group, the machinery added for Colorado.
--
-- The full stop comes off the disclaimer, as it did for the District of Columbia earlier today:
-- 11-50-35(c)(3)(A) requires "A statement that reads "Made in a home kitchen not routinely inspected
-- by the Department of Health"" and closes the quotation before any punctuation. Same correction
-- applied to the hand-pounded poi statement recorded in the notes.
--
-- Note what Hawaii does NOT ask for on a homemade label: no net weight, no allergen declaration.
-- Both appear at 11-50-35(b)(3)(C) and (E), but (b) governs food "packaged in a food establishment"
-- and 11-50-3(c) directs a homemade operation to (c) alone. Federal labelling law reaches the seller
-- independently of these rules; that is not something this row can express, and it is not a reason
-- to record a state requirement Hawaii has not made.
--
-- The ingredient list is also conditional in the text — "If made from two or more ingredients" — so
-- a single-ingredient product needs none. The element stays required because a seller with one
-- ingredient simply lists it, which satisfies the rule either way.
--
-- =========================================================================
-- 3. INSPECTION: NOT REQUIRED, BUT NOT ABSENT EITHER
-- =========================================================================
-- `inspection_required` stays false, and that is a judgement worth writing down. 11-50-3(c) makes a
-- homemade operation "exempt from the provisions of this chapter, except that they shall remain
-- subject to the inspection in accordance with section 11-50-8 and, the provisions of sections
-- 11-50-10, 11-50-11, 11-50-14". So Hawaii keeps its inspection power — but no inspection is a
-- precondition of trading, because there is no permit to be inspected for. That is the sense this
-- column carries elsewhere (Georgia's true value means "the licence will not issue until a
-- Compliance Specialist has been round"). 11-50-8 itself has not been read.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array['product_name', 'ingredients_desc_by_weight', 'producer_name'],
  -- "Name and contact information": either channel satisfies it, neither alone is demanded.
  element_alternatives = '[["producer_phone", "producer_email"]]'::jsonb,
  disclaimer_text = 'Made in a home kitchen not routinely inspected by the Department of Health',
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  notes =
    'Haw. Admin. Rules 11-50-35(c)(3), read 2026-09-06: "Homemade food products shall bear a label '
    'with the following information; (A) A statement that reads "Made in a home kitchen not '
    'routinely inspected by the Department of Health"; (B) The common name of the food or, if no '
    'common name exists, an adequately descriptive identity statement; (C) If made from two or more '
    'ingredients, a list of ingredients in descending order of predominance by weight; (D) Name and '
    'contact information of the homemade food product producer". CONTACT INFORMATION IS NOT A PHONE '
    'NUMBER — (D) names no channel, so phone-or-email is an alternatives group and a producer with '
    'either can print. The statement lost a trailing full stop the rule does not have. NO NET WEIGHT '
    'AND NO ALLERGEN ELEMENT: both appear at 11-50-35(b)(3)(C) and (E), but (b) governs food '
    '"packaged in a food establishment" and 11-50-3(c)(3) sends a homemade operation to (c) alone. '
    'Federal labelling law still reaches the seller independently. The ingredient list is '
    'conditional in the text ("If made from two or more ingredients"); the element is kept required '
    'because a single-ingredient seller simply lists the one. HAND-POUNDED POI IS A SEPARATE LABEL '
    'this row cannot express — 11-50-35(c)(4) requires "A statement that reads "This hand-pounded '
    'poi was prepared in a facility not inspected by the Department of Health"" plus the producer''s '
    'name and contact information, and no ingredient list.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Hawaii.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'HI' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 11-50-3(c)(4) requires distribution "only directly to the consumer"; a delivery to that
  -- consumer is direct distribution, and no provision names a venue.
  direct_delivery = 'allowed',
  category_note =
    'EXPRESSLY EXCLUDED BY DEFINITION, not inferred — which is worth saying, because the same two '
    'axes were banned on nothing in the District of Columbia, Florida and Georgia. Haw. Admin. Rules '
    '11-50-2: ""Homemade food products" means not potentially hazardous food produced or packaged '
    'in a home kitchen but does not include fermented foods, acidified foods, canned or bottled '
    'foods, dried meats or seafood, low acid canned foods and garlic in oil." Fermented, acidified, '
    'low-acid canned and dried meat are each named. Seafood and garlic in oil have no axis here and '
    'are recorded nowhere else. There is no approved list, so cat_shelf_stable stays unrestricted: '
    'anything non-hazardous outside those exclusions qualifies.',
  license_note =
    'No permit, and no inspection as a precondition of trading — but Hawaii keeps its inspection '
    'power. 11-50-3(a) requires a permit to operate a food establishment; 11-50-3(c) then exempts a '
    'person who "produces or packages only homemade food products in a home kitchen or only produces '
    'hand-pounded poi" from the chapter, "except that they shall remain subject to the inspection in '
    'accordance with section 11-50-8 and, the provisions of sections 11-50-10, 11-50-11, 11-50-14, '
    'and shall adhere to the following special conditions, violations of which shall constitute '
    'violations of this chapter: (1) Obtain food safety certification in accordance with section '
    '11-50-20(c); (2) Ensure that a handwashing sink with appropriate cleaning compound is available '
    'at all times during food preparation activities ...; (3) Label all food in accordance with the '
    'requirements of section 11-50-35(c); and (4) Distribute food products only directly to the '
    'consumer." inspection_required is false because nothing must be inspected before trading '
    'begins, not because Hawaii cannot inspect; 11-50-8 has not been read. No revenue cap appears '
    'anywhere in the rules read.',
  training_note =
    'One of the four special conditions, and the only one this table can carry: 11-50-3(c)(1), '
    '"Obtain food safety certification in accordance with section 11-50-20(c)." 11-50-20(c) has not '
    'been read, so what the certification involves is not recorded.',
  mail_note =
    'Not mentioned in the rules read. Previously banned on nothing, corrected by 20260906030000 for '
    'online orders; the same reasoning applies here. 11-50-3(c)(4) requires distribution "only '
    'directly to the consumer", which is a rule about WHO receives the food, not how it travels — '
    'Minnesota uses the same structure while expressly permitting online sales.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Hawaii.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'HI' and ordinal = 1 and verified_at is null;

-- The mail ban was seeded, not found. Same correction the online flag already received.
update public.state_food_programs set mail_delivery = 'unclear'
where state_code = 'HI' and ordinal = 1 and verified_at is null and mail_delivery = 'banned';
