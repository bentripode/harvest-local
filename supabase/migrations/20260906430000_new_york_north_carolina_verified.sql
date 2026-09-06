-- Harvest Local — New York and North Carolina, read 2026-09-06.
--
-- New York from 1 NYCRR 276.3 and 276.4 (the National Agricultural Law Center compilation, current
-- through Register Vol. 46 No. 52). North Carolina from the NCDA&CS Food and Drug Protection
-- Division's Home Processor page, which the project owner designated as the authoritative source for
-- this state because North Carolina has no cottage food statute — it regulates home production
-- through an agency programme instead.
--
-- =========================================================================
-- 1. NEW YORK REQUIRES NO LICENCE, AND THE ROW SAID IT DID
-- =========================================================================
-- `license_required` was `yes`. 1 NYCRR 276.4(b) is an exemption in terms: "Processors of
-- home-processed foods who sell or offer for sale such foods shall be EXEMPT FROM THE LICENSING
-- REQUIREMENTS OF ARTICLE 20-C, provided that the following conditions are met".
--
-- The programme is named "Home Processor", which is probably how the error crept in — New York does
-- licence food processors under Article 20-C, and this is the route that avoids needing one. A
-- seller told they must hold a licence they are exempt from would either not start or would pay for
-- something they do not need.
--
-- =========================================================================
-- 2. THERE IS NO APPROVED-FOODS LIST; THE DEFINITION WORKS BY EXCLUSION
-- =========================================================================
-- `cat_shelf_stable` was `list_only`, on a note reading "Department of Agriculture and Markets
-- approved list". Nothing in 276.3 or 276.4 establishes a list. 276.3(b)(3) defines home processed
-- food as "any food processed in a private home or residence using only the ordinary kitchen
-- facilities of that home or residence ... but shall exclude potentially hazardous foods as defined
-- in this Part or thermally processed low-acid foods packaged in hermetically sealed containers as
-- covered by Part 277 of this Chapter and acidified foods packed in closed containers, including but
-- not limited to pickles and relishes prepared from low-acid fruits, vegetables, poultry, meat, meat
-- products, fish or seafood."
--
-- Anything not excluded qualifies, so `unrestricted` is the right value. The three exclusions are
-- what support `cat_refrigerated`, `cat_low_acid_canned` and `cat_acidified` — the last of those is
-- one of the few acidified bans in this whole pass that is stated in the text rather than assumed.
-- `cat_fermented` is not named anywhere and becomes `unclear`: fermenting produces acid rather than
-- adding it, so a fermented food is not obviously an "acidified food" within the exclusion.
--
-- =========================================================================
-- 3. NEW YORK'S LABEL HAS NO ALLERGEN REQUIREMENT OF ITS OWN
-- =========================================================================
-- 276.4(b)(1) requires containers "labeled to show: (i) the name and address of the home processor;
-- (ii) the common or usual name of the food; (iii) if the food is fabricated from two or more
-- ingredients, the common or usual name of each ingredient in their order of predominance; except
-- that spices, flavorings and colorings may be designated as spices, flavorings and colorings
-- without naming each ...; and (iv) the net weight, standard measure or numerical count."
--
-- Four items, and allergens are not among them. The note on this row said "Allergens must be
-- identified within the ingredient statement itself", which is not in the Part — and sits awkwardly
-- beside (iii)'s permission to lump spices and flavourings together without naming each. The element
-- is KEPT, because 21 U.S.C. 343(w) reaches the seller anyway and a label without an allergen
-- declaration is worse for a buyer, but the note now says it is federal rather than New York's.
--
-- Also worth knowing: 276.3's lot-coding requirement applies to "potentially hazardous food", which
-- home processed food excludes by definition, so no code is required on this route.
--
-- =========================================================================
-- 4. NORTH CAROLINA: INSPECTED, BUT NOT PERMITTED
-- =========================================================================
-- The row already had the unusual combination right and it is worth recording rather than leaving to
-- look like an oversight: an inspection IS required before production begins, and no permit is
-- issued at the end of it. The NCDA&CS page: "A permit is not issued, but inspectors will provide
-- the home processor with a copy of the inspection report."
--
-- Its label was missing allergens, which the source lists separately from the ingredient statement.
-- `metric_required` is confirmed and is the reason North Carolina is one of only three states with
-- that flag: the net weight must be given "in ounces/pounds and the gram weight equivalent".
--
-- A SOURCE CAVEAT, recorded on the rows themselves. This is agency guidance, not codified rule text,
-- and it was read through a summarising fetch rather than as a statute. It is authoritative for
-- North Carolina — the project owner designated it — but the quoted fragments should not be treated
-- with the same confidence as the statutory quotations elsewhere in this table.
--
-- `verified_at` stays null on both rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- New York — Home Processing exemption (1 NYCRR 276.4(b))
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens'
  ],
  disclaimer_text = null,
  notes =
    '1 NYCRR 276.4(b)(1), read 2026-09-06: containers must be "labeled to show: (i) the name and '
    'address of the home processor; (ii) the common or usual name of the food; (iii) if the food is '
    'fabricated from two or more ingredients, the common or usual name of each ingredient in their '
    'order of predominance; except that spices, flavorings and colorings may be designated as '
    'spices, flavorings and colorings without naming each, and spices and flavorings may be '
    'designated together as flavorings; and (iv) the net weight, standard measure or numerical '
    'count." NO DISCLAIMER IS REQUIRED — genuinely, not merely unrecorded. THE ALLERGEN ELEMENT IS '
    'FEDERAL, NOT NEW YORK''S: the previous note said "Allergens must be identified within the '
    'ingredient statement itself", which is not in this Part and sits awkwardly beside (iii)''s '
    'permission to lump spices and flavourings together. It is kept because 21 U.S.C. 343(w) reaches '
    'the seller regardless and a label without it is worse for a buyer. Two other things: the '
    'ingredient list is conditional on the food being "fabricated from two or more ingredients", and '
    '276.4(b)(3) adds a packaging rule with no element — "Glass containers for jams, jellies, '
    'marmalades and similar products are provided with suitable rigid metal covers." 276.3''s '
    'lot-coding requirement applies only to potentially hazardous food, which this route excludes by '
    'definition, so no code is needed.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-York.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NY' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 276.4(b) is an exemption FROM licensing, not a licence.
  license_required = 'no',
  -- No list exists; the definition excludes rather than enumerates.
  cat_shelf_stable = 'unrestricted',
  -- Fermenting produces acid rather than adding it, so a fermented food is not obviously within the
  -- "acidified foods packed in closed containers" exclusion. Not addressed either way.
  cat_fermented = 'unclear',
  -- Not addressed in either section.
  local_preemption = null,
  venue_note =
    'NOT ADDRESSED — 1 NYCRR 276.4(b) is about licensing and labelling, not about where or how the '
    'food may be sold, and the row previously said "No restrictions" without saying that. The '
    'operative sentence is "Processors of home-processed foods who sell or offer for sale such foods '
    'shall be exempt from the licensing requirements of article 20-C, provided that the following '
    'conditions are met", and the conditions are the label, freedom from adulteration and '
    'misbranding, and rigid metal covers on glass jars. online_orders and mail_delivery stay allowed '
    'on that silence plus a permissive frame, not on any express permission; retail_allowed stays '
    'true on the same basis, since nothing confines sales to consumers.',
  category_note =
    'AN EXCLUSION, NOT A LIST — the previous note claimed a "Department of Agriculture and Markets '
    'approved list" and nothing in 276.3 or 276.4 establishes one. 1 NYCRR 276.3(b)(3): "Home '
    'processed food within the context of this Part shall mean any food processed in a private home '
    'or residence using only the ordinary kitchen facilities of that home or residence which are '
    'also used to prepare food for the owner thereof, his family, nonpaying guests and household and '
    'farm employees who reside therein, but shall exclude potentially hazardous foods as defined in '
    'this Part or thermally processed low-acid foods packaged in hermetically sealed containers as '
    'covered by Part 277 of this Chapter and acidified foods packed in closed containers, including '
    'but not limited to pickles and relishes prepared from low-acid fruits, vegetables, poultry, '
    'meat, meat products, fish or seafood." (b)(1) defines potentially hazardous food as "any '
    'perishable food which consists in whole or in part of milk or milk products, eggs, poultry, '
    'fish, shellfish or other ingredients capable of supporting rapid and progressive growth of '
    'infectious or toxigenic microorganisms." THE ACIDIFIED BAN HERE IS ONE OF THE FEW IN THIS TABLE '
    'THAT IS STATED RATHER THAN ASSUMED. Anything not excluded qualifies, hence unrestricted. Note '
    'the Department publishes guidance on this exemption that is not part of this Part.',
  license_note =
    'NO LICENCE — this route is the exemption from one. 1 NYCRR 276.4(b): "Processors of '
    'home-processed foods who sell or offer for sale such foods shall be exempt from the licensing '
    'requirements of article 20-C, provided that the following conditions are met: (1) All finished '
    'product containers are clean and sanitary and are labeled to show [the four items]; (2) All '
    'home-processed foods produced under this exemption are neither adulterated nor misbranded. (3) '
    'Glass containers for jams, jellies, marmalades and similar products are provided with suitable '
    'rigid metal covers." license_required was previously "yes", which would have told a New York '
    'seller to obtain an Article 20-C licence they are exempt from. Nothing in either section '
    'requires an inspection, training, product approval or a revenue cap. A SEPARATE EXEMPTION exists '
    'for maple syrup and honey at 276.4(a), on sanitation conditions and labelling under Part 259; '
    'it is not modelled as its own row.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-York.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NY' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- North Carolina — Home Processing (NCDA&CS Food and Drug Protection Division)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'business_name', 'producer_address', 'net_weight',
    'ingredients_desc_by_weight', 'allergens'
  ],
  metric_required = true,
  disclaimer_text = null,
  notes =
    'NCDA&CS Food and Drug Protection Division, Home Processor page, read 2026-09-06. SOURCE CAVEAT: '
    'North Carolina has no cottage food statute — it regulates home production through an agency '
    'programme — so this is agency guidance rather than codified rule text, and it was read through '
    'a summarising fetch rather than as a statute. It is the authoritative source for this state, '
    'designated as such by the project owner, but the fragments quoted here should not carry the '
    'same confidence as the statutory quotations elsewhere in this table. THE LABEL: "Product name", '
    '"Manufacturers name and address", "Net weight of the product in ounces/pounds and the gram '
    'weight equivalent", and a "Complete list of ingredients in order of predominance by weight", '
    'with all allergens noted separately. ALLERGENS WERE MISSING from this row and the source lists '
    'them apart from the ingredient statement. metric_required is confirmed and is why North '
    'Carolina is one of only three states carrying that flag — the gram equivalent is required '
    'alongside the imperial weight, which formatNetWeight derives. NO DISCLAIMER IS REQUIRED. '
    'LABELS ARE WAIVED ONLY FOR HAND-TO-CONSUMER SALES — direct unpackaged sales and farmers market '
    'transactions — so a marketplace order needs one, the same conclusion Maine reaches through its '
    '"retailed by any manner of public marketing" wording.',
  source_url = 'https://www.ncagr.gov/divisions/food-drug-protection/food-program/food-drug-food-program-home-processor',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NC' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- Not addressed by the source; fermenting is neither in the permitted nor the prohibited list.
  cat_fermented = 'unclear',
  venue_note =
    'SELLING REMOTELY IS PERMITTED, AND THE LABEL IS WHAT MAKES IT SO. NCDA&CS Home Processor page, '
    'read 2026-09-06: products cannot be sold via internet or mail services (USPS, FedEx) WITHOUT '
    'LABELS — the constraint is the label, not the channel. Labels are waived only for direct '
    'consumer sales without packaging and for farmers market hand-to-consumer transactions, so a '
    'marketplace order always needs one. That is the same conclusion Maine reaches by a different '
    'route, through its "retailed by any manner of public marketing" wording. The previous note said '
    '"No restrictions", which missed the labelling condition entirely.',
  category_note =
    'NCDA&CS Home Processor page, read 2026-09-06. PERMITTED: low-risk, shelf-stable products — '
    'baked goods that need no refrigeration, jams, candies, dried mixes, certain beverages, some '
    'sauces, and acidified foods such as pickles, which is what supports cat_acidified = allowed. '
    'PROHIBITED: refrigerated and frozen goods, low-acid canned foods, dairy, seafood, bottled water '
    'and juice, and bakery products with cream fillings. Fermented food appears in neither list and '
    'moves from banned to unclear. ONE CONDITION WITH NO COLUMN: the source states that pets in the '
    'home disqualify an applicant entirely, which is stricter than the "keep pets out of the '
    'kitchen" rule most states use and is worth a North Carolina seller knowing before they apply.',
  license_note =
    'INSPECTED BUT NOT PERMITTED — an unusual combination, and the row already had it right, so it '
    'is recorded here rather than left looking like an oversight. NCDA&CS Home Processor page, read '
    '2026-09-06: an inspection is required before production begins, and "A permit is not issued, '
    'but inspectors will provide the home processor with a copy of the inspection report." '
    'Applicants are told to expect contact within 8 to 12 weeks of applying, which is worth knowing '
    'at onboarding. No revenue cap and no training requirement appear on the page.',
  source_url = 'https://www.ncagr.gov/divisions/food-drug-protection/food-program/food-drug-food-program-home-processor',
  source_checked_at = '2026-09-06'
where state_code = 'NC' and ordinal = 1 and verified_at is null;
