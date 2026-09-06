-- Harvest Local — Delaware, from 16 Del. Admin. Code 4458A (Cottage Food Regulations) and
-- 3 Del. Admin. Code 101 (On-Farm Home Processing), read 2026-09-06.
--
-- Delaware runs two programmes with genuinely different labels, and we were printing the same one
-- on both. That is the serious finding here.
--
-- =========================================================================
-- 1. THE ON-FARM LABEL CARRIED THE WRONG QUOTED STATUTE
-- =========================================================================
-- Our on-farm row was a copy of the cottage food row, disclaimer included. It is not the same
-- statement, and `disclaimer_text` is verbatim law that gets printed as-is.
--
--   Cottage food, 4458A 8.2.4: "This food is made in a Cottage Food Establishment and is NOT
--   subject to routine Government Food Safety Inspections."
--   On-farm, 101 9.1.5: the following statement in ten (10) point type: "This product is
--   home-produced and processed".
--
-- An on-farm producer following our label would have declared themselves a Cottage Food
-- Establishment — a programme they are not registered under, whose regulations they are not
-- operating beneath. 101 9.2 makes the consequence explicit: a product "not labeled in accordance
-- with subsection (9.1) of these regulations are deemed misbranded."
--
-- The element lists differ too. 101 9.1 is short and closed: name of product; name and address of
-- manufacturer; ingredients in decreasing order by weight; net weight or unit count; the statement;
-- and the date the product was processed. No phone, no email, no allergen clause — the federal
-- allergen rules still bind the seller, but this regulation does not restate them, and we record
-- what the state's own text says.
--
-- =========================================================================
-- 2. THE COTTAGE FOOD LABEL WAS WRONG IN FOUR WAYS
-- =========================================================================
-- 4458A 8.2.1: "Products shall be properly labeled with the following: Name of CFE, name of
-- product, "town/city, Delaware", phone number or email of CFE, net weight or unit count, date of
-- production or lot number."
--
--   WRONG ELEMENT: `producer_name` — the regulation asks for the name of the CFE, the business,
--   which is `business_name`.
--   MISSING: the town. And Delaware asks for "town/city, Delaware" as one phrase, which is why
--   20260906170000 added `municipality_state`; `municipality` alone would print "Wilmington" where
--   the regulation requires "Wilmington, Delaware".
--   PHONE **AND** EMAIL WERE BOTH REQUIRED. The regulation says "phone number or email of CFE".
--   Requiring both stopped the label printing for a producer with one. Now an alternatives group.
--   PRODUCTION DATE WAS REQUIRED ALONE. "date of production or lot number" — also an alternative,
--   and both are per-batch values asked for at print time, so the producer supplies whichever they
--   keep.
--
-- 8.2.5 is a whole-label typography rule, not a disclaimer rule: "Labels shall be printed in at
-- least 10-point type in a color that provides a clear contrast to the background label." The
-- 10-point minimum is recorded on the disclaimer because that is where the column lives, and the
-- font note says it governs everything.
--
-- 8.2.2 keeps the ingredient list required but lets it move off a small label: "If the product
-- label is too small to allow for printing of ingredients, the list shall be available at the
-- request of the consumer." We keep the element required — a marketplace listing has room.
--
-- =========================================================================
-- 3. THE ONLINE BAN IS CONFIRMED, AND NARROWER THAN OUR MAIL-ORDER ROW CLAIMED
-- =========================================================================
-- 4458A 3.1.3.2, verbatim: "Online sales are not permitted. Online advertising and marketing are
-- permitted." Express, unambiguous, and exactly what 20260906030000 recorded. Note the second
-- sentence: a Delaware CFE may lawfully HAVE a storefront listing; what they may not do is take the
-- order through it.
--
-- But `mail_delivery = 'banned'` on the cottage food row rested on nothing. Delaware bans online
-- sales and confines the CFE to "direct sales with consumers in the State of Delaware" (3.1.3.1)
-- and forbids wholesale (3.1.3.3); mail order is named nowhere. Banning on silence is the error
-- found in Hawaii, so it becomes `unclear`. The on-farm row is the opposite case and stays banned:
-- 101 9.3 is an exhaustive venue list — products "may only be offered for sale by farmers markets,
-- roadside produce stands, or the processors farm" — and neither the post nor a delivery van is on
-- it, so `direct_delivery` becomes banned there too.
--
-- =========================================================================
-- 4. THE ON-FARM CATEGORY AXES OVERSTATED ONE BAN
-- =========================================================================
-- `cat_acidified` was `banned`. 101 8.5 does prohibit "Low-acid canned foods, such as home-canned
-- or jarred fruits, vegetables, pickled products, sauces, relishes" — but 8.4 expressly permits
-- "Herbs in vinegar with an equilibrated pH of 4.6 or less". A named, permitted acidified product
-- is not a ban, and under rule 7 only an outright ban blocks a listing. It becomes `conditional` —
-- the value that means "allowed with a qualification recorded in category_note", which is exactly
-- the shape of this rule. (`list_only` would read better still, but that value exists only on
-- `cat_shelf_stable`; the five narrow axes are allowed/banned/conditional/unclear.)
--
-- `verified_at` stays null on every row. These migrations carry figures and citations; the
-- attestation is a person saving the review form.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Programme 1 — Delaware Cottage Food (16 Del. Admin. Code 4458A)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'product_name', 'municipality_state', 'net_weight',
    'ingredients_desc_by_weight', 'allergens'
  ],
  element_alternatives = '[["producer_phone", "producer_email"], ["production_date", "lot_code"]]'::jsonb,
  disclaimer_text = 'This food is made in a Cottage Food Establishment and is NOT subject to routine Government Food Safety Inspections.',
  disclaimer_min_pt = 10,
  disclaimer_font_note =
    'The 10-point minimum governs the WHOLE label, not only the statement. 4458A 8.2.5: "Labels '
    'shall be printed in at least 10-point type in a color that provides a clear contrast to the '
    'background label."',
  notes =
    '16 Del. Admin. Code 4458A 8.2, read 2026-09-06. 8.2.1 requires "Name of CFE, name of product, '
    '"town/city, Delaware", phone number or email of CFE, net weight or unit count, date of '
    'production or lot number" — so the business name rather than the producer''s own, the town AND '
    'the state as one phrase (municipality_state), and TWO either/or pairs: phone-or-email and '
    'production-date-or-lot-number, both now alternatives groups. 8.2.2 adds the ingredient list in '
    'decreasing order by weight, with a small-label escape: "If the product label is too small to '
    'allow for printing of ingredients, the list shall be available at the request of the '
    'consumer." We keep it required, since a listing has room. 8.2.3 requires "the name of the food '
    'source for each major food allergen ... unless the food source is already part of the common '
    'or usual name". 8.2.6: further information must be available on request.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Delaware.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'DE' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- Named nowhere in the regulation; banning it on silence is not verification.
  mail_delivery = 'unclear',
  mail_note =
    '4458A does not address mail order either way. It bans online sales (3.1.3.2), confines the CFE '
    'to "direct sales with consumers in the State of Delaware" (3.1.3.1) and forbids wholesale '
    '(3.1.3.3). Whether posting a parcel to a Delaware consumer is a permitted direct sale is a '
    'question the text read here does not answer.',
  cat_shelf_stable = 'list_only',
  venue_note =
    'Express prohibition, and narrower than it first looks. 4458A 3.1.3: "3.1.3.1 CFE are only '
    'permitted to engage in direct sales with consumers in the State of Delaware. 3.1.3.2 Online '
    'sales are not permitted. Online advertising and marketing are permitted. 3.1.3.3 Wholesale or '
    'other sales to resellers or food establishments are not permitted by a CFE." The second '
    'sentence of 3.1.3.2 matters to this marketplace: a Delaware CFE may lawfully hold a storefront '
    'listing — advertising is permitted — but may not take the order through it. 3.1.3.4 requires '
    'the registration certificate to be displayed "at farmers markets, craft fairs, charitable '
    'organization, or other approved venues/functions", an open-ended list, so direct delivery is '
    'left unclear rather than assumed either way.',
  category_note =
    'A Division-maintained list, not a statutory one: 3.2.1 "Products produced in a CFE are limited '
    'to those listed on the approved list maintained by Division", and 3.2.2 limits production to '
    'non-TCS foods. The regulation itself names baked goods (3.2.3 — "cakes, breads, cookies, '
    'rolls, muffins, brownies, fruit pies, and pastries", excluding items with cream, meat or other '
    'TCS components), "jams, jellies, and other fruit preserves" (3.2.4), and non-TCS candy (3.2.5 '
    '— "fudge, lollipops, chocolates, tortes, hard candy, and rock candy"). 3.2.6: "Products may '
    'not contain cannabis."',
  license_note =
    'Registration, annual, and enforced. 3.1.1: "Annual registration fees will be in the amount of '
    '$30 per CFE", the year running 1 April to 31 March (3.1.2). 3.3.5: "It shall be a violation of '
    'these regulations to operate in Delaware as a CFE, as defined by these regulations, if not '
    'registered with the Division", and 9.2.1.1.1 orders an unregistered establishment "immediately '
    'closed". Registration follows an application covering products, ingredients, example labels, '
    'processes and a floor plan (3.3.1.1), proof of training (3.3.1.1.5, Section 5.0), and a '
    'pre-operational inspection (1.6.1). No revenue cap appears anywhere: Delaware limits channels, '
    'not turnover.',
  recipe_note =
    'Not recipe approval as such, but product approval in substance: 3.2.1 limits a CFE to products '
    '"listed on the approved list maintained by Division", and the application must describe '
    '"products to be made, ingredients, example labels, processes, and products" (3.3.1.1.3). '
    'Laboratory testing may also be demanded (8.1).',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Delaware.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'DE' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Programme 2 — Delaware On-Farm Home Processing (3 Del. Admin. Code 101)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'producer_address',
    'ingredients_desc_by_weight', 'net_weight', 'production_date'
  ],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = 'This product is home-produced and processed',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note = '101 9.1.5 requires the statement "in ten (10) point type".',
  notes =
    '3 Del. Admin. Code 101 9.1, read 2026-09-06. THIS ROW PREVIOUSLY CARRIED THE COTTAGE FOOD '
    'DISCLAIMER, which is a different programme''s quoted statute — an on-farm producer printing it '
    'would have declared themselves a Cottage Food Establishment they are not registered as. 9.1 is '
    'short and closed: "9.1.1 Name of product 9.1.2 Name and address of manufacturer 9.1.3 '
    'Ingredients listed in decreasing order by weight 9.1.4 Net weight or unit count 9.1.5 The '
    'following statement in ten (10) point type: This product is home-produced and processed 9.1.6 '
    'The date the product was processed." No phone, no email, and NO ALLERGEN CLAUSE — federal '
    'allergen labelling still binds the seller, but this regulation does not restate it and we '
    'record the state''s own text. 9.2: a qualifying product "not labeled in accordance with '
    'subsection (9.1) of these regulations are deemed misbranded."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Delaware.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'DE' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  -- An exhaustive venue list that names neither the post nor a delivery.
  direct_delivery = 'banned',
  cat_acidified = 'conditional',
  venue_note =
    'Exclusive venue list. 3 Del. Admin. Code 101 9.3: products produced, processed and labelled in '
    'accordance with the regulation "are acceptable food products that may only be offered for sale '
    'by farmers markets, roadside produce stands, or the processors farm." The internet, the post '
    'and delivery to a buyer''s door are all excluded by omission from an exhaustive list rather '
    'than named — which is why online_orders, mail_delivery and direct_delivery are all banned here '
    'while the cottage food programme''s mail rule is left unclear.',
  cap_note =
    '101 8.6.2 limits a licensed operation to "$50,000 of sales of on-farm home processed foods". '
    'The regulation does not attach the word "annual" to that figure; we treat it as annual because '
    'the licence itself is annual, which is the only reading that gives the limit a period. If a '
    'seller ever approaches it, check with DDA before relying on our arithmetic.',
  category_note =
    'Two express lists. Permitted (8.4, "shall manufacture and process only non-potentially '
    'hazardous foods such as"): baked breads, cakes, muffins or cookies with water activity 0.85 or '
    'less; non-chocolate candy; containerized fruit preparations — jellies, jams, preserves, '
    'marmalades, fruit butters — at pH 4.6 or less or water activity 0.85 or less; fruit pies on '
    'the same terms; "Herbs in vinegar with an equilibrated pH of 4.6 or less"; honey and herb '
    'mixtures; dried fruit and vegetables; spices or herbs; maple syrup or sorghum; snack items '
    'such as popcorn, caramel corn and peanut brittle; roasted nuts. Prohibited (8.5): "Low-acid '
    'canned foods, such as home-canned or jarred fruits, vegetables, pickled products, sauces, '
    'relishes", cream/custard/pumpkin/meat and other single-crust pies, cream or cheese-filled '
    'baked goods, "Cured or fermented foods", seafood, and "Apple cider or other juices". The '
    'acidified axis is conditional rather than banned BECAUSE OF the herbs-in-vinegar entry: pickled '
    'products are out, but a named acidified product is expressly in, and only an outright ban may '
    'block a listing. Seafood and juices have no axis here and are recorded nowhere else.',
  license_note =
    'A licence, not a registration: 101 8.4 through 8.9 all condition permitted activity on '
    '"operating with a license issued in accordance with this regulation", and 8.9.1 requires the '
    'operator to "Use only building areas, equipment, and utensils that DDA has reviewed or '
    'inspected and approved". 10.1 assigns responsibility for compliance to the permit holder.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Delaware.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'DE' and ordinal = 2 and verified_at is null;
