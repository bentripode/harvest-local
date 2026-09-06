-- Harvest Local — Oklahoma and Oregon, from Okla. Stat. tit. 2 §§ 5-4.2 to 5-4.4 (the Homemade Food
-- Freedom Act) and Oregon's home baking statute, read 2026-09-06.
--
-- =========================================================================
-- 1. OKLAHOMA: WE HAD THE INGREDIENT ORDER BACKWARDS
-- =========================================================================
-- The note on Oklahoma's label rule read: "Ingredients are listed in ASCENDING order of proportion,
-- which is the opposite of most states."
--
-- Okla. Stat. tit. 2 § 5-4.2(A)(6)(d) requires "the ingredients of the homemade food product in
-- DESCENDING order of proportion". The same as everywhere else.
--
-- This is the most consequential single error found in the pass so far, because of what the rest of
-- the system does with it. CLAUDE.md's product-label rule says ingredient order is meaningful and
-- the seller's order is the label's order — `parseIngredients` never re-sorts. So an Oklahoma seller
-- who read that note and dutifully typed their ingredients smallest-first would have printed a label
-- listing them in exactly the wrong order, with nothing downstream to catch it. Every other
-- correction in this pass has been a field that was absent, over-strict, or unsourced; this one
-- would have produced a confidently wrong label.
--
-- =========================================================================
-- 2. OKLAHOMA IS AN EIGHTH PREDISCLOSURE STATE, AND A PLACARD STATE
-- =========================================================================
-- § 5-4.2(B) sets out four ways the (A)(6) information must reach the consumer, and two of them are
-- ours: "3. On a placard displayed at the point of sale, and on a card or other item that is made
-- available to the consumer and is readily carriable if the homemade food product is not packaged;
-- and 4. DISPLAYED ON THE WEBPAGE FROM WHICH THE HOMEMADE FOOD PRODUCT IS OFFERED FOR SALE if it is
-- sold on the Internet; provided, that each item sold over the Internet shall be properly labeled or
-- shall have a label included in the shipping container."
--
-- (B) also fixes the type size for all of it — "in a legible format of at least 10-point font" — and
-- the row had no minimum recorded.
--
-- =========================================================================
-- 3. OREGON: THREE ROWS SHARING ONE LABEL, AND ONE OF THEM CANNOT BE TRUE
-- =========================================================================
-- All three Oregon programmes carried the same statement: "This product is homemade, is not prepared
-- in an inspected food establishment and must be stored and displayed separately if merchandised by
-- a retailer."
--
-- That statement belongs to the home baking route, whose subsection (6)(a) prescribes it word for
-- word. It is verified there and stays.
--
-- OREGON DOMESTIC KITCHEN IS LICENSED AND INSPECTED. Saying its products are "not prepared in an
-- inspected food establishment" is not a borrowed formality but a false statement of fact about the
-- producer's regulatory status — the same defect found in Maryland's on-farm row. Removed.
--
-- OREGON FARM DIRECT is not inspected, so the first half is not false, but the second half — "must
-- be stored and displayed separately if merchandised by a retailer" — is drawn from the home baking
-- scheme's retailer provision at (5), and Farm Direct does not permit retail sale at all. Its own
-- labelling rules are not in this compilation. Removed too, and flagged.
--
-- Neither row is emptied. Both keep the element list, which is the ordinary packaged-food set, so
-- they still print — the treatment Ohio's home bakery got, rather than Maryland's, because there the
-- whole rule was unknown and here only the statement is wrong.
--
-- =========================================================================
-- 4. OREGON'S PERMITTED FOODS ARE AN OPEN LIST AND WE RECORDED A CLOSED ONE
-- =========================================================================
-- `category_note` read "Baked goods and confectionery only". Subsection (2)(b) reaches foods
-- "including but not limited to baked goods, confectionary items, coffee beans, teas, popcorn, jams,
-- jellies, honey, syrups, fruit butters, nut mixes, repackaged freeze-dried foods, repackaged dried
-- and dehydrated foods and powdered drink mixes".
--
-- Jams, jellies and fruit butters are acid canned goods and sit on that list by name, so
-- `cat_acidified` moves from banned to conditional. The list being open is why `cat_shelf_stable`
-- becomes unrestricted rather than limited.
--
-- =========================================================================
-- 5. TWO REQUIREMENTS THAT NEEDED EXISTING MACHINERY
-- =========================================================================
-- OREGON'S ADDRESS IS AN EITHER/OR. (6)(b)(B): "The address of the food establishment OR the unique
-- identification number for the food establishment provided under subsection (7)". An alternatives
-- group, the shape used for Iowa, Maryland, Minnesota and New Hampshire.
--
-- OREGON REQUIRES A PET DISCLOSURE AND WE HAD NO ELEMENT FOR IT. (6)(b)(H): the label must disclose
-- "The presence of pets in the residential dwelling in which the food establishment is located, if
-- any, and the potential for pet allergens." Substance prescribed, wording left to the producer, and
-- a fact about the dwelling rather than the product — which is exactly `seller_statement`, added for
-- Louisiana and now doing its fifth job. It goes in `optional_elements` because "if any" means a
-- seller without pets has nothing to disclose, and a required element would block their label.
--
-- `verified_at` stays null on all eight rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Oklahoma
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_phone', 'producer_address', 'product_name',
    'ingredients_desc_by_weight', 'allergens'
  ],
  disclaimer_text = 'This product was produced in a private residence that is exempt from government licensing and inspection.',
  disclaimer_min_pt = 10,
  disclaimer_font_note =
    'Okla. Stat. tit. 2 5-4.2(B) requires ALL of the (A)(6) information, not only the statement, "in '
    'a legible format of at least 10-point font".',
  placard_required = true,
  placard_text = 'This product was produced in a private residence that is exempt from government licensing and inspection.',
  predisclosure_required = true,
  notes =
    'Okla. Stat. tit. 2 5-4.2, read 2026-09-06. THE INGREDIENT ORDER WAS RECORDED BACKWARDS. This '
    'note previously read "Ingredients are listed in ASCENDING order of proportion, which is the '
    'opposite of most states." (A)(6)(d) requires "the ingredients of the homemade food product in '
    'DESCENDING order of proportion" — the same as everywhere else. That mattered more than a '
    'wrong flag: ingredient order is meaningful, parseIngredients never re-sorts, and a seller who '
    'followed the note would have printed their list in exactly the wrong order with nothing '
    'downstream to catch it. THE FULL (A)(6) LIST: "a. the name and phone number of the producer, b. '
    'the physical address where the product was produced, c. a description of the homemade food '
    'product, d. the ingredients ... in descending order of proportion, e. a statement indicating '
    'the presence of any of the eight most common allergens, including milk, eggs, peanuts, tree '
    'nuts, soy and wheat, and f. legible print stating, [the disclaimer]". (B) fixes the type size '
    'for all of it at 10 point, and lists four delivery contexts: a label on the package; a label on '
    'a bulk container; "On a placard displayed at the point of sale, and on a card or other item '
    'that is made available to the consumer and is readily carriable if the homemade food product is '
    'not packaged"; and "Displayed on the webpage from which the homemade food product is offered '
    'for sale if it is sold on the Internet; provided, that each item sold over the Internet shall '
    'be properly labeled or shall have a label included in the shipping container." The last is why '
    'predisclosure_required is true and the third is why placard_required is. A REGISTRATION NUMBER '
    'CAN REPLACE THREE ELEMENTS AT ONCE: (C) lets a producer pay $15 a year for a number that "may '
    'be used on product labels instead of the producer''s name, phone number, and the physical '
    'address" — a three-for-one substitution that element_alternatives cannot express, so the row '
    'requires the three and this note records the alternative. Note also that (A)(6)(e) says "the '
    'eight most common allergens" and then names six; our vocabulary is the federal nine.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oklahoma.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'OK' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  category_note =
    'MEAT AND SEAFOOD ARE BANNED BY NAME. Okla. Stat. tit. 2 5-4.2(A)(8): "Homemade food products '
    'shall not contain seafood or meat, meat by-products or meat food products as defined by Section '
    '301.2 of Title 9 of the Code of Federal Regulations or poultry, poultry products or poultry '
    'food products as defined for purposes of the federal Poultry Products Inspection Act." Nothing '
    'else is prohibited by food type in the sections read, which is why the other axes are permissive.',
  license_note =
    'No licence, and a voluntary registration number. 5-4.2(C): "A homemade food product producer '
    'may obtain a registration number upon the payment of an annual fee of Fifteen Dollars ($15.00) '
    'to the Oklahoma Department of Agriculture, Food, and Forestry that is good for one (1) year '
    'from the date of its issue." Enforcement is complaint-driven: 5-4.4 preserves the State '
    'Department of Health''s investigation of reported foodborne illness, and on a consumer '
    'complaint the Department of Agriculture "shall have the authority to request proof of '
    'completion of the food safety training, verify a producer''s gross sales, and ensure a producer '
    'has complied with the act''s labeling and delivery requirements", with power to fine. '
    '5-4.2(A)(7): a product "packaged and distributed in interstate commerce ... shall also be sold '
    'and labeled in accordance with federal law".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oklahoma.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'OK' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Oregon #1 — Home Baking (the route the shared statement actually belongs to)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_phone', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  -- (6)(b)(B): the address OR the department's unique identification number.
  element_alternatives = '[["producer_address", "permit_number"]]'::jsonb,
  -- (6)(b)(H): "if any" — a seller without pets has nothing to disclose.
  optional_elements = array['seller_statement'],
  seller_statement_prompt =
    'a disclosure of the presence of pets in the residential dwelling in which the food '
    'establishment is located, if any, and the potential for pet allergens (Oregon home baking '
    'statute, subsection (6)(b)(H))',
  disclaimer_text = 'This product is homemade, is not prepared in an inspected food establishment and must be stored and displayed separately if merchandised by a retailer.',
  notes =
    'Oregon home baking statute, subsection (6), read 2026-09-06. THE STATEMENT IS VERIFIED FOR THIS '
    'ROUTE and matched exactly: "(6)(a) Except as provided in this paragraph, the label statement '
    'required under subsection (2) of this section is This product is homemade, is not prepared in '
    'an inspected food establishment and must be stored and displayed separately if merchandised by '
    'a retailer. The State Department of Agriculture may adopt rules specifying alternative wording '
    '... to the extent that alternative wording is necessary in order to comply with federal '
    'requirements." (6)(b) then requires "(A) The name and phone number for the food establishment; '
    '(B) The address of the food establishment OR the unique identification number ...; (C) The name '
    'of the product; (D) The ingredients of the product in descending order by weight; (E) The net '
    'weight or net volume of the product; (F) Any applicable allergen warnings as specified under '
    'federal labeling requirements; (G) If the label provides any nutrient content claim, health '
    'claim or other nutritional information, product nutritional information ...; and (H) The '
    'presence of pets in the residential dwelling in which the food establishment is located, if '
    'any, and the potential for pet allergens." (B) IS AN ALTERNATIVES GROUP, now expressed as one. '
    '(H) IS A PET DISCLOSURE with the substance prescribed and the wording left to the producer — a '
    'fact about the dwelling rather than the product, so it uses the seller_statement element added '
    'for Louisiana, in optional_elements because "if any" means a pet-free seller discloses nothing. '
    '(7) is the identification number: "At the request of a food establishment ..., the department '
    'shall provide ... a unique identification number", for a reasonable fee.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'OR' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- (2)(b) names jams, jellies and fruit butters — acid canned goods — on an open list.
  cat_acidified = 'conditional',
  cat_shelf_stable = 'unrestricted',
  -- (4) names online and the mail expressly.
  direct_delivery = 'allowed',
  venue_note =
    'EVERY CHANNEL IS NAMED, and the row previously said "No restrictions". Subsection (4): "A person '
    'may sell foods prepared in a food establishment described in subsection (2) of this section '
    'directly to the end user in any manner, INCLUDING FROM THE HOME, ONLINE, THROUGH THE MAIL AND '
    'AT EVENTS." Retail is permitted on a condition — (5): a person may sell packaged foods "to a '
    'retailer if the retailer agrees to: (a) Store and display the foods separately from other '
    'foods; and (b) Clearly indicate in displaying the foods that the foods are homemade and not '
    'prepared in an inspected food establishment", which is where the second half of the label '
    'statement comes from. INSTITUTIONS ARE BARRED: (3) forbids selling "to an institution '
    'including, but not limited to, a caterer, school, day care center, hospital, nursing home, '
    'correctional facility or restaurant."',
  cap_note =
    'INDEXED TO INFLATION, which the flat figure here does not capture. Subsection (2)(d): "The '
    'annual gross sales of foods prepared at the food establishment do not exceed $50,000, adjusted '
    'annually for inflation pursuant to the Consumer Price Index for All Urban Consumers, West '
    'Region (All Items), as published by the Bureau of Labor Statistics ... and rounded to the '
    'nearest $100." The stored 50000 is the statutory base, not the current threshold, so a seller '
    'near the line should check the department''s published figure before relying on a pause here.',
  category_note =
    'AN OPEN LIST, and the previous note ("Baked goods and confectionery only") read as a closed one. '
    'Subsection (2)(b) reaches foods "including but not limited to baked goods, confectionary items, '
    'coffee beans, teas, popcorn, jams, jellies, honey, syrups, fruit butters, nut mixes, repackaged '
    'freeze-dried foods, repackaged dried and dehydrated foods and powdered drink mixes". Jams, '
    'jellies and fruit butters are acid canned goods and are on it by name, which is why '
    'cat_acidified moves from banned to conditional, and "including but not limited to" is why '
    'cat_shelf_stable is now unrestricted.',
  license_note =
    'No licence, but training for everyone who touches the food. Subsection (2)(e): "Each individual '
    'involved in the preparation of food at the food establishment for public distribution has '
    'successfully completed a food handler training program and holds a certificate issued under ORS '
    '624.570." (8) is the backstop: "the department may require a food establishment ... to become '
    'licensed under ORS 616.695 to 616.755, if the food establishment refuses to comply with '
    'department rules".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'OR' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Oregon #2 — Farm Direct (statement withdrawn, rules not in this compilation)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_text = null,
  notes =
    'THE HOME BAKING STATEMENT HAS BEEN REMOVED FROM THIS ROW. All three Oregon programmes were '
    'carrying "This product is homemade, is not prepared in an inspected food establishment and must '
    'be stored and displayed separately if merchandised by a retailer", which subsection (6)(a) of '
    'the home baking statute prescribes for THAT route. Its first half is not false of a Farm Direct '
    'producer, who is also uninspected — but its second half comes from the home baking scheme''s '
    'retailer provision at (5), and Farm Direct does not permit retail sale at all, so printing it '
    'would tell a buyer about a rule that does not apply. Oregon''s Farm Direct Marketing labelling '
    'requirements are not in the compilation read on 2026-09-06. The element list is kept — it is '
    'the ordinary packaged-food set — so this row still prints, the treatment Ohio''s home bakery '
    'got rather than Maryland''s, because there the whole rule was unknown and here only the '
    'statement is wrong. An admin should read the Farm Direct rules before treating this as checked.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'OR' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'NOT VERIFIED. The note here ("No restrictions") is the summary''s, and Oregon''s Farm Direct '
    'Marketing provisions are not in the compilation read on 2026-09-06, which carries the home '
    'baking statute. Every flag on this row still rests on the summary.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'OR' and ordinal = 2 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Oregon #3 — Domestic Kitchen (licensed and INSPECTED; the statement was false)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_text = null,
  notes =
    'THE STATEMENT ON THIS ROW WAS FALSE AND HAS BEEN REMOVED. It read "This product is homemade, is '
    'not prepared in an inspected food establishment and must be stored and displayed separately if '
    'merchandised by a retailer" — the home baking statement from subsection (6)(a) — and an Oregon '
    'DOMESTIC KITCHEN is licensed and inspected. That is not a borrowed formality but a false '
    'statement of fact about the producer''s regulatory status on the package, the same defect found '
    'in Maryland''s on-farm row, and the third time in this pass a licensed route was carrying an '
    'exempt route''s disclaimer after Ohio''s home bakery and Nevada''s craft food warning. The '
    'element list is kept, so this row still prints: those items are the ordinary packaged-food set '
    'a licensed kitchen will owe anyway. Oregon''s domestic kitchen licensing rules (ORS 616.695 to '
    '616.755 and the rules under them) are not in the compilation read on 2026-09-06, so nothing '
    'else on this row is verified either.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'OR' and ordinal = 3
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'NOT VERIFIED. The note here ("No restrictions") is the summary''s. This is Oregon''s LICENSED '
    'and INSPECTED domestic kitchen route, governed by ORS 616.695 to 616.755 and the rules under '
    'them, which are not in the compilation read on 2026-09-06 — that carries the home baking '
    'statute. Subsection (8) of the home baking statute is the only place the two meet: the '
    'department "may require a food establishment described in subsection (2) of this section to '
    'become licensed under ORS 616.695 to 616.755, if the food establishment refuses to comply with '
    'department rules". Every flag on this row still rests on the summary.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Oregon.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'OR' and ordinal = 3 and verified_at is null;
