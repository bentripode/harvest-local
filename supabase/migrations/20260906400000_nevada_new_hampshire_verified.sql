-- Harvest Local — Nevada and New Hampshire, from Nev. Rev. Stat. 446.866, 587.6945, 587.695 and
-- 587.696, and N.H. Rev. Stat. 143-A:12 and 143-A:13 with N.H. Admin. Code He-P 2310.01, read
-- 2026-09-06.
--
-- =========================================================================
-- 1. TWO MORE DISCLAIMERS THAT HAD BEEN TIDIED
-- =========================================================================
-- This is the third and fourth in a row, after Michigan's title-cased agency name and Mississippi's
-- capitalised "Cottage Food operation".
--
--   NEVADA. We stored "...GOVERNMENT FOOD SAFETY INSPECTION." NRS 446.866(1)(d) requires the label
--   to carry "MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY
--   INSPECTION" — the quotation closes before any full stop. Ours had one added.
--
--   NEW HAMPSHIRE. We stored "This product is made in a residential kitchen licensed by NH DHHS."
--   RSA 143-A:12 IV requires: "This product is made in a residential kitchen licensed by the New
--   Hampshire Department of Health and Human Services." Somebody abbreviated the agency to its
--   initials. On a label that is not a shorthand, it is a different sentence.
--
-- New Hampshire's exempt statement — "This product is exempt from New Hampshire licensing and
-- inspection." — matched exactly and is recorded as checked.
--
-- =========================================================================
-- 2. NEVADA RUNS TWO ROUTES AND WE MODEL ONE, DELIBERATELY
-- =========================================================================
-- NRS 446.866 is the cottage food operation. NRS 587.6945 is the CRAFT food operation, and it is a
-- different scheme with a different statement — "MADE IN A CRAFT FOOD OPERATION THAT IS NOT SUBJECT
-- TO GOVERNMENT FOOD SAFETY INSPECTION" — plus a production date, registration under 587.696, a
-- five-year log of "the recipe for each acidified food produced", canning dates and pH results, a
-- department-approved pH meter, and "only canning recipes that have been approved by, or included in
-- publications approved by, the State Department of Agriculture."
--
-- Delaware and Maryland both had a second programme's label copied onto the first, which is the
-- error to avoid here. It is avoided by NOT giving craft food a row of its own and saying why: both
-- routes carry the same in-person requirement, so neither is usable on this marketplace, and a row
-- nobody can trade under is a maintenance burden rather than a safeguard. The craft food statement
-- and its conditions are recorded in the notes instead, where a Nevada seller doing acidified foods
-- will find them.
--
-- =========================================================================
-- 3. NEVADA'S ONLINE BAN AND CAP, BOTH CONFIRMED IN THE DEFINITION
-- =========================================================================
-- NRS 446.866(1)(a): a food item must be sold "on the private property of the natural person who
-- manufactures or prepares the food item or at a location where [they] sell the food item directly
-- to a consumer, including, without limitation, a farmers market ..., flea market, swap meet, church
-- bazaar, garage sale or craft fair, BY MEANS OF AN IN-PERSON TRANSACTION THAT DOES NOT INVOLVE
-- SELLING THE FOOD ITEM BY TELEPHONE OR VIA THE INTERNET". Express, and exactly as recorded.
--
-- The $35,000 sits inside the definition of a cottage food operation — one "whose gross sales of
-- such food items are not more than $35,000 per calendar year" — so it is a ceiling on membership of
-- the programme, like Florida's and Mississippi's, and pausing at it is right.
--
-- =========================================================================
-- 4. VINEGAR IS ON BOTH STATES' LISTS, AND BOTH HAD FERMENTED FOOD BANNED
-- =========================================================================
-- Nevada's statutory list of nine food items includes "(4) Vinegar and flavored vinegar". New
-- Hampshire's exempt list includes "(5) Acid foods, including vinegars and mustards". Vinegar is a
-- fermented product, so a flat `cat_fermented = banned` is wrong in both. Both become `conditional`.
--
-- New Hampshire's `cat_acidified` was banned too, and He-P 2310.01 says both things at once: (b)(5)
-- permits "Acid foods, including vinegars and mustards", while (c) forbids "processed acidified and
-- low acid canned foods". Acid foods yes, acidified CANNED foods no — `conditional`, with the
-- distinction recorded. Nevada's acidified axis was already conditional and is now conditional on
-- the right thing: the craft food registration.
--
-- Both states' `cat_shelf_stable` was too loose for a closed statutory list and becomes `limited`.
--
-- =========================================================================
-- 5. NEW HAMPSHIRE'S PRODUCT CODE IS AN EITHER/OR
-- =========================================================================
-- The row required `lot_code`. He-P 2310.01(d)(8) requires "A product code which identifies the
-- product with a batch number, OR a date of manufacture to aid in a recall of the product in case of
-- an imminent health hazard." Either satisfies it, so it becomes an alternatives group — the same
-- shape as Delaware's "date of production or lot number".
--
-- `verified_at` stays null on all five rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Nevada — Cottage Food Operation (NRS 446.866)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'allergens', 'net_weight'
  ],
  -- Verbatim: NRS 446.866(1)(d) closes the quotation before any full stop.
  disclaimer_text = 'MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION',
  disclaimer_all_caps = true,
  disclaimer_min_pt = null,
  disclaimer_font_note =
    'NRS 446.866(1)(d) requires the statement "printed prominently on the label for the food item". '
    'No point size is prescribed.',
  notes =
    'Nev. Rev. Stat. 446.866(1), read 2026-09-06. THE ELEMENTS ARE FEDERAL BY REFERENCE, not a '
    'Nevada list: (1)(c) requires a label "which complies with the federal labeling requirements set '
    'forth in 21 U.S.C. 343(w) and 9 C.F.R. Part 317 and 21 C.F.R. Part 101", which is where the '
    'product name, ingredients, net quantity, producer identity and allergen declaration come from. '
    '(1)(d) then adds the state statement. THE STATEMENT WAS NOT VERBATIM: ours ended in a full stop '
    'and the statute''s quotation closes without one — the third such correction in this pass after '
    'Michigan and Mississippi. NEVADA ALSO RUNS A CRAFT FOOD OPERATION under NRS 587.6945, which is '
    'NOT modelled as a separate row here because both routes carry the same in-person requirement '
    'and neither can be used on this marketplace. Its label differs: 587.6945(1)(d) requires "(1) '
    'The date the food item was produced; and (2) "MADE IN A CRAFT FOOD OPERATION THAT IS NOT '
    'SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION" printed prominently". Do not print the cottage '
    'food statement on a craft food product — that is the copy-paste error found in Delaware and '
    'Maryland.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Nevada.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NV' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- "(4) Vinegar and flavored vinegar" is on the statutory list.
  cat_fermented = 'conditional',
  -- A closed list in the statute, not a department-maintained one.
  cat_shelf_stable = 'limited',
  cap_note =
    'Definitional, like Florida''s and Mississippi''s. NRS 446.866 defines a cottage food operation '
    'as a natural person who prepares food items in a private home "for sale to a natural person for '
    'consumption and whose gross sales of such food items are not more than $35,000 per calendar '
    'year". Above the figure the person is not a cottage food operation, so pausing is right — the '
    'seller has to return under a different status rather than merely add a document.',
  category_note =
    'A CLOSED LIST OF NINE, in the statute. NRS 446.866 defines "Food item" as: "(1) Nuts and nut '
    'mixes; (2) Candies; (3) Jams, jellies and preserves; (4) Vinegar and flavored vinegar; (5) Dry '
    'herbs and seasoning mixes; (6) Dried fruits; (7) Cereals, trail mixes and granola; (8) Popcorn '
    'and popcorn balls; or (9) Baked goods that: (I) Are not potentially hazardous foods; (II) Do not '
    'contain cream, uncooked egg, custard, meringue or cream cheese frosting or garnishes; and (III) '
    'Do not require time or temperature controls for food safety." VINEGAR IS ON IT, which is why '
    'cat_fermented moves from banned to conditional. Acidified food beyond jams, jellies, preserves '
    'and vinegar needs the separate CRAFT FOOD route: NRS 587.6945(3) defines its "food item" as '
    '"acidified foods produced by a person who meets the requirements of NRS 587.695 to 587.699", '
    'and 587.695 requires registration under 587.696, a five-year log recording "the recipe for each '
    'acidified food produced", the canning date and pH result of every batch, a department-approved '
    'pH meter, and "only canning recipes that have been approved by, or included in publications '
    'approved by, the State Department of Agriculture." That is what cat_acidified = conditional and '
    'recipe_approval = conditional mean here.',
  license_note =
    'Registration, not a licence, and inspection only on adulteration or an outbreak. NRS 446.866(3): '
    'each person "must, before selling any food item, register the cottage food operation with the '
    'health authority", giving name, address and contact information and any trading name; (4) caps '
    'the fee at "the actual cost of the health authority to establish and maintain a registry". (5): '
    'the health authority "may inspect a cottage food operation only to investigate a food item that '
    'may be deemed to be adulterated ... or an outbreak or suspected outbreak of illness". (1)(b) '
    'confines sales to "a natural person for his or her consumption and not for resale", which is '
    'why retail_allowed is false, and (1)(e) requires prepackaging that protects the item "during '
    'transport, display, sale and acquisition by consumers". LOCAL PREEMPTION IS NARROW: (2) stops a '
    'local body adopting any ordinance "that prohibits a natural person from preparing food in a '
    'cottage food operation" — it reaches preparation, not everything.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Nevada.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NV' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- New Hampshire #1 — Exempt Home Food Operations (He-P 2310.01)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'producer_phone', 'product_name',
    'ingredients_desc_by_weight', 'allergens'
  ],
  -- He-P 2310.01(d)(8): "a batch number, or a date of manufacture" — either will do.
  element_alternatives = '[["lot_code", "production_date"]]'::jsonb,
  disclaimer_text = 'This product is exempt from New Hampshire licensing and inspection.',
  disclaimer_min_pt = 10,
  disclaimer_font_note =
    'He-P 2310.01(d)(7) requires the statement "in at least the equivalent of 10 point font and a '
    'color that provides a clear contrast to the background".',
  notes =
    'N.H. Admin. Code He-P 2310.01(d), read 2026-09-06, with RSA 143-A:12 IV. The rule requires '
    '"(1) Name of the homestead food operation; (2) Address of the homestead food operation; (3) '
    'Phone number of the homestead food operation; (4) Name of the homestead food product; (5) All '
    'ingredients of the homestead food product in descending order of predominance by weight; (6) '
    'The name of each major food allergen contained in the homestead food product unless it is '
    'already part of the common or usual name of the respective ingredient already disclosed in the '
    'ingredient statement in (5) above; (7) [the statement]; and (8) A product code which identifies '
    'the product with a batch number, or a date of manufacture to aid in a recall of the product in '
    'case of an imminent health hazard." THE PRODUCT CODE IS AN EITHER/OR and the row required a lot '
    'code outright; it is now an alternatives group, the same shape as Delaware''s "date of '
    'production or lot number". The exempt statement matched the statute exactly and is recorded as '
    'checked. He-P 2310.01(e) also pulls in standards from He-P 2309.03(b)-(t) and He-P 2311.06(b)-'
    '(i), which are not in this compilation.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Hampshire.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NH' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- (b)(5) permits acid foods; (c) forbids processed acidified canned foods. Both at once.
  cat_acidified = 'conditional',
  -- Vinegars are expressly on the permitted list.
  cat_fermented = 'conditional',
  cat_shelf_stable = 'limited',
  category_note =
    'A SIX-ITEM LIST, AND ONE PROHIBITION THAT CUTS ACROSS IT. N.H. Admin. Code He-P 2310.01(b): '
    '"Only the following food products shall be produced and sold from exempt homestead food '
    'operations: (1) Baked items, including, breads, rolls, muffins, cookies, brownies, and cakes; '
    '(2) Double-crusted fruit pies; (3) Candy and fudge; (4) Packaged dry products, which include '
    'spices and herbs; (5) Acid foods, including vinegars and mustards; and (6) Jams and jellies." '
    '(c): "Exempt homestead food operations shall not produce or sell potentially hazardous foods, '
    'including any food which requires refrigeration or processed acidified and low acid canned '
    'foods." So ACID FOODS ARE IN AND ACIDIFIED CANNED FOODS ARE OUT — cat_acidified moves from '
    'banned to conditional on exactly that distinction, and cat_fermented likewise, because vinegar '
    'is named as permitted. Refrigerated food and low-acid canned goods are banned by (c) in terms.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Hampshire.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NH' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- New Hampshire #2 — Homestead (licensed, RSA 143-A:4)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'producer_phone', 'product_name',
    'ingredients_desc_by_weight', 'allergens'
  ],
  element_alternatives = '[["lot_code", "production_date"]]'::jsonb,
  -- Verbatim: RSA 143-A:12 IV names the agency in full.
  disclaimer_text = 'This product is made in a residential kitchen licensed by the New Hampshire Department of Health and Human Services.',
  disclaimer_min_pt = 10,
  notes =
    'N.H. Rev. Stat. 143-A:12 IV, read 2026-09-06. THE STATEMENT WAS ABBREVIATED: we held "licensed '
    'by NH DHHS", where the statute requires "This product is made in a residential kitchen licensed '
    'by the New Hampshire Department of Health and Human Services." On a label an agency''s initials '
    'are not a shorthand for its name, they are a different sentence. The fourth such correction in '
    'this pass. The element list is the statute''s: "name, address, and phone number of the '
    'homestead food operation; name of the homestead food product; the ingredients of the homestead '
    'product, in descending order of predominance by weight; and allergy information." THE PRODUCT '
    'CODE IS CARRIED OVER FROM THE EXEMPT RULE and is NOT verified for this route: He-P 2310.01(d)(8) '
    'governs exempt operations, and the licensed route''s own rules (He-P 2309, He-P 2311, made under '
    'RSA 143-A:13 II) are not in this compilation. It is kept as an alternatives group so it never '
    'blocks a label, and flagged here rather than asserted. The 10-point minimum is likewise the '
    'exempt rule''s and should be checked against the licensed rules.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Hampshire.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NH' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'SELLING ONLINE IS WHAT THIS LICENCE IS FOR, and the row previously said "No restrictions". N.H. '
    'Rev. Stat. 143-A:12 III: homestead food operations "who wish to sell food products, excluding '
    'potentially hazardous food, to restaurants or other retail food establishments, over the '
    'Internet, by mail order, or to wholesalers, brokers, or other food distributors who will resell '
    'the homestead product shall be licensed under RSA 143-A:4." 143-A:13 III directs the '
    'commissioner to make rules for exactly those operations. So online selling is not merely '
    'permitted on this route — it is one of the things that triggers the requirement to be on it. '
    'The exempt route at 143-A:12 II is the constrained one, confined to sales "from the homestead '
    'residence, at the owner''s own farm stand, at farmers'' markets, or at retail food stores".',
  category_note =
    'NOT VERIFIED FOR THIS ROUTE. He-P 2310.01(b) and (c), which give the exempt route its six-item '
    'list and its prohibition on refrigerated and canned foods, apply to EXEMPT operations. The '
    'licensed route''s food list is made under RSA 143-A:13 I — "Foods which may be made in a '
    'homestead food operation and potentially hazardous foods, which shall not be made in a '
    'homestead food operation" — and those rules are not in this compilation. The axes on this row '
    'are therefore still the summary''s and should not be treated as checked.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Hampshire.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NH' and ordinal = 2 and verified_at is null;
