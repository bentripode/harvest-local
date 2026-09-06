-- Harvest Local — Idaho, from Idaho Code 37-201 through 37-208, read 2026-09-06 (the National
-- Agricultural Law Center compilation, current through 1 July 2026).
--
-- Idaho is not a cottage food law and our row described it as one. It is the "Idaho Direct-to-
-- Consumer Commerce Act", and 37-202 states the purpose as facilitating "the production and direct
-- sale of homemade food and nonalcoholic drink products from producers to informed end consumers
-- with minimal regulatory burden". Almost every restrictive flag on this row was wrong.
--
-- =========================================================================
-- 1. PERISHABLE FOOD IS EXPRESSLY PERMITTED
-- =========================================================================
-- `cat_refrigerated` was banned. 37-205(1): "Producers operating pursuant to this chapter may sell
-- homemade shelf-stable OR PERISHABLE food products to the fullest extent permitted by applicable
-- state and federal law." 37-203(7) defines perishable food as food requiring temperature control
-- and lists, among others, milk and dairy products, eggs and egg products, fresh and dehydrated
-- pastas, raw doughs, cooked vegetables and pickled products.
--
-- This is the single largest correction in the pass so far. Our data would have refused a Idaho
-- seller a listing their state expressly allows, in a state that has legislated to remove exactly
-- that kind of obstacle.
--
-- `cat_fermented` was banned too: 37-203(10)(b) names "Fermented food products" as shelf-stable
-- food. `cat_acidified` was banned: 37-203(7)(n) names "Pickled products" as permitted perishable
-- food and (10)(a) names hermetically sealed preserves as permitted shelf-stable food.
--
-- =========================================================================
-- 2. MEAT IS CONDITIONAL, NOT BANNED, AND THE CONDITIONS ARE SPECIFIC
-- =========================================================================
-- 37-205(2)(c) bars "the sale of meat or meat products, except:" and then names six exceptions —
-- poultry where the producer slaughters "no more than one thousand (1,000) poultry of the producer's
-- own raising during any one (1) calendar year"; live animals; portions of live animals; domestic
-- rabbit meat; farm-raised fish other than catfish; and meat from cattle, sheep, swine and goats
-- "that have been inspected by the United States department of agriculture or another approved
-- inspector". 37-207 adds animal shares, which are expressly not a sale of meat.
--
-- Same shape as Colorado's poultry rule, and `conditional` is what that shape is for.
--
-- =========================================================================
-- 3. LOCAL REGULATION IS PREEMPTED, EXPRESSLY AND UNUSUALLY HARD
-- =========================================================================
-- `local_preemption` was false. 37-204(1): "It is the legislature's intent to wholly occupy the
-- field of products made directly available to consumers pursuant to this chapter within this
-- state." (2) forbids any agency or political subdivision from adopting or enforcing anything
-- "pertaining to the licensing, permitting, inspection, packaging, or labeling of products made
-- available pursuant to this chapter that is more stringent than the corresponding state or federal
-- requirement", and declares any such rule "unenforceable".
--
-- =========================================================================
-- 4. THE LABEL TEXT WE HELD WAS A PARAPHRASE, AND THE ROW SAID SO
-- =========================================================================
-- `placard_text` read "Prepared in a home kitchen not subject to regulation and inspection by any
-- regulatory authority", and the notes admitted "The source paraphrases the wording rather than
-- quoting it." `disclaimer_text` was null. The statute is exact. 37-205(3)(b): "There shall be a
-- conspicuously displayed sign, label affixed to the food product, or card given to the informed end
-- consumer that shall: (i) State: "This product is not subject to government food safety inspection
-- or licensing requirements. It may contain allergens."; (ii) Include the name and contact
-- information of the producer; and (iii) Include a list of ingredients used in the product if such
-- product contains two (2) or more ingredients."
--
-- Three consequences for the element list:
--
--   ALLERGENS COMES OFF. Idaho requires no allergen declaration — the prescribed sentence carries
--   "It may contain allergens" instead. Keeping the element would demand of an Idaho seller
--   something their legislature deliberately replaced.
--   CONTACT INFORMATION IS AN ALTERNATIVES GROUP, as in Hawaii: (ii) names no channel, so a phone
--   number or an email address each satisfies it.
--   NO PRODUCT NAME AND NO NET WEIGHT. The list is the statement, the producer's identity, and the
--   ingredients. Nothing else. (Our own products_guard_label_fields still asks a food seller for a
--   net weight before publishing — a platform choice, not an Idaho requirement.)
--
-- =========================================================================
-- 5. ONE REQUIREMENT THIS SCHEMA STILL CANNOT EXPRESS
-- =========================================================================
-- 37-205(4)(b): "Perishable food products shall include information on handling instructions
-- sufficient to inform the consumer of safe storage and preparation practices."
--
-- There is no handling-instructions element and, more to the point, no product field to hold one —
-- it is per-product prose the seller would have to write. Idaho is the first state in this pass to
-- permit perishable food at all, so it is the first to need it. Recorded in the rule's notes as a
-- seller responsibility until there is somewhere real to put it.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array['producer_name', 'ingredients_desc_by_weight'],
  -- "the name and contact information of the producer" — the statute names no channel.
  element_alternatives = '[["producer_phone", "producer_email"]]'::jsonb,
  disclaimer_text = 'This product is not subject to government food safety inspection or licensing requirements. It may contain allergens.',
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  placard_required = true,
  -- The sign is one of three permitted forms of the SAME disclosure, so it carries the same words.
  placard_text = 'This product is not subject to government food safety inspection or licensing requirements. It may contain allergens.',
  notes =
    'Idaho Code 37-205(3)(b), read 2026-09-06 — the previous text here was a paraphrase and the row '
    'said so. Idaho gives ONE disclosure duty satisfiable THREE ways: "There shall be a '
    'conspicuously displayed sign, label affixed to the food product, or card given to the informed '
    'end consumer that shall: (i) State: "This product is not subject to government food safety '
    'inspection or licensing requirements. It may contain allergens."; (ii) Include the name and '
    'contact information of the producer; and (iii) Include a list of ingredients used in the '
    'product if such product contains two (2) or more ingredients." placard_required is true because '
    'the sign is one of the three forms, not an extra duty, and it carries the same sentence. '
    'ALLERGENS ARE NOT A SEPARATE ELEMENT HERE — the prescribed sentence says "It may contain '
    'allergens" instead, and demanding a declaration Idaho replaced would be wrong. NO PRODUCT NAME '
    'AND NO NET WEIGHT are required; (iii) also asks only for "a list of ingredients", not for '
    'descending order, so the element used is slightly stricter than the statute. STILL '
    'INEXPRESSIBLE: 37-205(4)(b) requires that "Perishable food products shall include information '
    'on handling instructions sufficient to inform the consumer of safe storage and preparation '
    'practices." There is no element and no product field for per-product handling prose; the seller '
    'must add it. Idaho is the first state in this pass to permit perishable food at all, which is '
    'why it is the first to need this.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Idaho.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'ID' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  name = 'Direct-to-Consumer Commerce Act',
  -- 37-205(1): perishable food is expressly sellable.
  cat_refrigerated = 'allowed',
  -- 37-203(10)(b) names fermented food products; (7)(n) names pickled products.
  cat_fermented = 'allowed',
  cat_acidified = 'allowed',
  -- 37-205(2)(c) bans meat with six named exceptions.
  cat_meat = 'conditional',
  -- Not addressed by the chapter; 37-205(1) defers to "applicable state and federal law", which for
  -- low-acid canned food is 21 CFR 108/113. Not a ban, and not something this chapter settles.
  cat_low_acid_canned = 'conditional',
  -- 37-204(1)-(2): the legislature "wholly occup[ies] the field".
  local_preemption = true,
  -- 37-205(2)(b) names delivery among the activities that must occur within Idaho, so delivery is
  -- contemplated; it just may not cross the state line.
  direct_delivery = 'allowed',
  -- A shop may hold these products, but only as a designated agent who takes no ownership.
  retail_allowed = true,
  venue_note =
    'NOT A COTTAGE FOOD LAW. Idaho Code 37-201: "This chapter shall be known and may be cited as the '
    '"Idaho Direct-to-Consumer Commerce Act."" 37-202 gives the purpose as facilitating direct sale '
    '"from producers to informed end consumers with minimal regulatory burden". The binding limits '
    'are in 37-205(2): a transaction shall "(a) Occur between a producer or designated agent and '
    'informed end consumer; (b) Occur entirely within the state of Idaho and shall not constitute or '
    'involve interstate commerce. All production, processing, packaging, sale, and delivery '
    'activities shall take place wholly within the state of Idaho". That second clause suits this '
    'marketplace exactly, since orders never cross a state line here anyway. RESALE IS THE '
    'PROHIBITION, NOT RETAIL SPACE: 37-203(6) defines an informed end consumer as one "who does not '
    'resell or redistribute the product, and for whom resale or redistribution is unlawful", while '
    '37-205(5) expressly contemplates a retail space offering these products, requiring only that it '
    '"Avoid intermingling by physically separating products available pursuant to this chapter from '
    'other products" and sign the area. The mechanism is 37-203(3), a "designated agent" — a person '
    'or entity "designated by a producer to facilitate producer-to-consumer transactions, including '
    'marketing, transport, storage, selling, and delivery", who "shall be named in writing by the '
    'producer and shall not take ownership of any food or drink product". A marketplace that never '
    'takes title fits that definition; the writing requirement would be ours to satisfy. ONLINE '
    'SELLING IS NOT MENTIONED — online_orders stays allowed on the same reasoning as Georgia: the '
    'operative requirement is a direct sale to an end consumer within Idaho, which an online order '
    'satisfies, and no provision names a venue. Inference from silence plus a permissive frame, not '
    'an express permission.',
  mail_note =
    'Not named, but delivery is: 37-205(2)(b) requires that "All production, processing, packaging, '
    'sale, and delivery activities shall take place wholly within the state of Idaho". Post within '
    'Idaho is therefore not obviously excluded, while anything crossing the state line is barred '
    'outright.',
  category_note =
    'Two open lists, both "includes but is not limited to", which is why cat_shelf_stable stays '
    'unrestricted. 37-203(10) shelf-stable food: "(a) Hermetically sealed butters, jams, jellies, '
    'marmalades, preserves, and syrups; (b) Fermented food products; (c) Tallow; (d) Lard; (e) Fruit '
    'leathers, pies, and turnovers; (f) Chocolates, candies, and confectioneries that do not need to '
    'be refrigerated; (g) Nonalcoholic drinks that do not need to be refrigerated; (h) Milk and '
    'dairy products that do not need to be refrigerated; (i) Nut mixes; (j) Granola; (k) Dry soup '
    'mixes, excluding meat-based soup mixes; (l) Roasted coffee beans; (m) Popcorn; (n) Honey; (o) '
    'Dried, dehydrated, and freeze-dried foods, including jerky products; and (p) Baked goods that '
    'do not include frosting or filling made from animal products or other perishable ingredients." '
    '37-203(7) perishable food, ALL OF IT SELLABLE under 37-205(1): nonalcoholic drinks; chocolate '
    'and confectionery; condiments and sauces; uncut fruits and vegetables; milk and dairy; eggs and '
    'egg products; nut, seed and fruit butters; fresh and dehydrated pastas; raw doughs; butters, '
    'jams, jellies, marmalades, preserves and syrups; baked goods with animal-product frosting or '
    'filling; meat products produced under the chapter; cooked vegetables; and pickled products. '
    'MEAT IS CONDITIONAL, not banned — 37-205(2)(c) permits poultry where the producer slaughters '
    '"no more than one thousand (1,000) poultry of the producer''s own raising during any one (1) '
    'calendar year", live animals, portions of live animals, domestic rabbit meat, farm-raised fish '
    'other than catfish, and USDA-inspected cattle, sheep, swine and goat meat; 37-207 animal shares '
    'are expressly not a sale of meat. DAIRY AND RAW MILK CARRY THEIR OWN CONDITIONS: 37-204(3)(b) '
    'and (c) allow them only where the producer is "in full compliance" with chapters 3, 4, 5 and 12 '
    'and chapter 11 of title 37 respectively — not modelled here.',
  license_note =
    'None, and the statute says so twice. 37-205(3)(a): a producer "shall inform the end consumer '
    'that any homemade shelf-stable or perishable food product sold pursuant to this chapter is not '
    'subject to inspection or licensing." 37-208(8): "Nothing in this section shall be construed to '
    'require routine reporting, inspection, or submission of records absent a confirmed foodborne '
    'illness investigation." No revenue cap appears anywhere in the chapter. RECORDS ARE REQUIRED '
    'THOUGH, and this is the one ongoing obligation: 37-208(1) requires records of "the type and '
    'quantity of product sold, the date of the sale, the date of production, where the homemade food '
    'product was produced, and where each ingredient was produced or acquired", kept two years, '
    'confidential and undisclosable except in a confirmed foodborne illness investigation, with a '
    'fine up to $500 for failing to keep them.',
  training_note =
    'Not required. 37-206 obliges the department to compile educational material and says only that '
    '"Producers and designated agents shall become familiar with the educational material provided '
    'by the department" — familiarity, with no certification, course or proof attached.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Idaho.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'ID' and ordinal = 1 and verified_at is null;
