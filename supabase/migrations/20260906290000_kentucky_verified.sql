-- Harvest Local — Kentucky, from KRS 217.136, KRS 217.137 and 902 KAR 45:090, read 2026-09-06.
--
-- =========================================================================
-- 1. I HAVE TO REVERSE MY OWN CORRECTION: THE MICROPROCESSOR BAN WAS REAL
-- =========================================================================
-- 20260906030000 moved Kentucky's home-based MICROPROCESSOR row from `online_orders = 'banned'` to
-- `'unclear'`, saying the ban was "on nothing". That was wrong, and it was wrong because I read
-- 902 KAR 45:090 and not KRS 217.137. The statute enumerates, and the enumeration is closed:
--
--   KRS 217.137(2): "Food products that are produced or processed by a home-based microprocessor
--   and in compliance with administrative regulations promulgated pursuant to subsection (1) of this
--   section are acceptable food products that MAY ONLY BE OFFERED FOR SALE BY FARMERS MARKETS,
--   CERTIFIED ROADSIDE STANDS, OR ON THE PROCESSOR'S FARM."
--
-- Three venues, all physical, "may only". A "certified roadside stand" is itself defined in 902 KAR
-- 45:090 Section 1(2) as "a physical location listed with the Kentucky Farm Bureau". The internet is
-- not among them.
--
-- What settles it is the contrast INSIDE THE SAME CHAPTER. For the home-based PROCESSOR, KRS
-- 217.136(5) uses an open list and names the internet in it: products "may only be offered for sale
-- directly to consumers within this state, INCLUDING from the home-based processor's home, whether
-- by pick-up or delivery, at a market, roadside stand, community event, OR ONLINE." The legislature
-- wrote "including ... or online" for one route and a closed list of three physical venues for the
-- other. That is a deliberate difference, not an oversight, and the microprocessor row goes back to
-- `banned` — a ban by exhaustive enumeration, the shape recorded for Delaware's on-farm route, Maine,
-- Rhode Island and Wisconsin.
--
-- The lesson is worth keeping: a ban recorded on a regulation is not disproved by that regulation's
-- silence when the enabling statute is where the venue list lives.
--
-- =========================================================================
-- 2. THE PROCESSOR ROUTE IS EXPRESSLY, UNUSUALLY OPEN
-- =========================================================================
-- 902 KAR 45:090 Section 3(3): "A home-based processor may advertise and accept orders and payments
-- in person, electronically, or via the internet or phone." That covers the whole transaction —
-- advertising, the order, and the payment — and is the most complete express permission found in
-- this pass. Section 3(4): "A home-based processor shall provide all home-based processed foods
-- direct to the consumer through pick-up or delivery, and at flea markets, farmers markets,
-- festivals, county fairs, craft fairs, and non-profit charity events, or a roadside stand."
--
-- `mail_delivery` was banned on this row. Neither list is exhaustive — 217.136(5) says "including"
-- and the regulation's venues sit alongside "pick-up or delivery" — and the post is named nowhere.
-- It becomes `unclear`. On the microprocessor row it stays banned, now on 217.137(2).
--
-- =========================================================================
-- 3. THE PROCESSOR LABEL WAS MISSING ALLERGENS AND HAD A SPARE FULL STOP
-- =========================================================================
-- KRS 217.136(3) lists six items and 902 KAR 45:090 Section 3(5) adds a seventh: products shall
-- "(a) Be labeled as required by KRS 217.136(3); and (b) CONTAIN ALLERGEN INFORMATION as specified
-- by 21 U.S.C. 343(w)." The allergen element was absent from both rows.
--
-- The statement is quoted as "This product is home-produced and processed" and closes before any
-- punctuation; ours carried a trailing full stop. Fourth state in this pass where that mattered.
-- Note also (d): Kentucky wants "The net weight AND volume ... by standard measure, or numerical
-- count" — both measures, not either.
--
-- =========================================================================
-- 4. THE CATEGORY BANS ON THE PROCESSOR ROUTE ARE EXPRESS
-- =========================================================================
-- KRS 217.136(2): "A home-based processor shall not produce or process for sale acid foods,
-- acidified food products, formulated acid food products, or low-acid canned foods." Acidified and
-- low-acid canned are named. Fermented food is not, but a fermented product that reaches pH 4.6 or
-- below is an acid food and is caught by the first item, so the ban stands with its reasoning
-- recorded rather than assumed.
--
-- That prohibition is exactly what the microprocessor route exists to lift, which is why acidified
-- and low-acid canned are `allowed` there: 902 KAR 45:090 Section 4(2)(g) requires "Documentation
-- from the processing authority for an established scheduled process for each food item", and
-- "Any change in the recipe shall constitute a recipe deviation, and a new review and approval shall
-- be required from the processing authority prior to processing." `cat_fermented` on that row was
-- banned on nothing and becomes `unclear`.
--
-- `verified_at` stays null on all four rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Programme 1 — Kentucky Home-Based Processor (KRS 217.136, 902 KAR 45:090 §3)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'production_date', 'allergens'
  ],
  disclaimer_text = 'This product is home-produced and processed',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note = 'KRS 217.136(3)(e) requires the statement "in ten (10) point type".',
  notes =
    'KRS 217.136(3) plus 902 KAR 45:090 Section 3(5), read 2026-09-06. The statute: a home-based '
    'processor "shall label each of its food products and include the following information on the '
    'label of each of its food products: (a) The name and address of the home-based processing '
    'operation; (b) The common or usual name of the food product; (c) The ingredients of the food '
    'product, in descending order of predominance by weight; (d) The net weight AND volume of the '
    'food product by standard measure, or numerical count; (e) The following statement in ten (10) '
    'point type: "This product is home-produced and processed"; and (f) The date the product was '
    'processed." ALLERGENS WERE MISSING and come from the regulation: Section 3(5) requires products '
    'to "(a) Be labeled as required by KRS 217.136(3); and (b) Contain allergen information as '
    'specified by 21 U.S.C. 343(w)." The statement lost a trailing full stop the statute does not '
    'have. Note (d) asks for weight AND volume, not either — our net_weight element renders one '
    'measure, so a Kentucky seller should check the printed label against the statute. 217.136(4): '
    'a product "not labeled in accordance with subsection (3) ... [is] deemed misbranded."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kentucky.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'KY' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 217.136(5) and 902 KAR 45:090 §3(4) both name delivery.
  direct_delivery = 'allowed',
  -- Named nowhere, and neither venue list is exhaustive.
  mail_delivery = 'unclear',
  mail_note =
    'Not named. KRS 217.136(5) is an open list ("including ... or online") and 902 KAR 45:090 '
    'Section 3(4) sits "pick-up or delivery" alongside its venues, so the post is neither permitted '
    'nor excluded by either. Previously banned on nothing. Contrast the microprocessor row, where '
    'KRS 217.137(2) is a closed list and the ban is real.',
  venue_note =
    'THE MOST COMPLETE EXPRESS PERMISSION IN THIS PASS, and the row previously said "No '
    'restrictions". 902 KAR 45:090 Section 3(3): "A home-based processor may advertise and accept '
    'orders and payments in person, electronically, or via the internet or phone" — advertising, the '
    'order and the payment, all three. KRS 217.136(5): products "may only be offered for sale '
    'directly to consumers within this state, including from the home-based processor''s home, '
    'whether by pick-up or delivery, at a market, roadside stand, community event, or online." '
    '902 KAR 45:090 Section 3(4): "A home-based processor shall provide all home-based processed '
    'foods direct to the consumer through pick-up or delivery, and at flea markets, farmers markets, '
    'festivals, county fairs, craft fairs, and non-profit charity events, or a roadside stand." '
    'retail_allowed is false on "directly to consumers". Section 3(2): "A home-based processor doing '
    'business in the state shall be a resident of Kentucky."',
  category_note =
    'EXPRESSLY BANNED, by name. KRS 217.136(2): "A home-based processor shall not produce or process '
    'for sale acid foods, acidified food products, formulated acid food products, or low-acid canned '
    'foods." Acidified and low-acid canned are named outright. Fermented food is not named, and the '
    'ban is kept on the reasoning that a fermented product reaching pH 4.6 or below is an acid food '
    'within the first item — recorded so the inference is visible rather than assumed. 217.136(6) '
    'lifts the microprocessor''s farming condition here: a home-based processor "shall not be '
    'required to have grown a primary ingredient for each of their products produced." 217.136(1)(c) '
    'adds a packaging rule with no axis: "All glass containers for jams, jellies, preserves, fruit '
    'butter, and similar products are provided with suitable rigid metal covers." cat_shelf_stable '
    'stays list_only on 217.136(10), which directs the cabinet to "further delineate which food '
    'products are subject to the definition of home-based processor"; that delineation and the '
    'definition at KRS 217.015(56) have not been read, which is also all that cat_refrigerated rests '
    'on here.',
  license_note =
    'Registration, annual, fifty dollars, and inspection only on complaint. 902 KAR 45:090 Section '
    '3(7): "Beginning January 1, 2020, a home-based processor shall register with the Department for '
    'Public Health, Food Safety Branch", submitting "A DFS-250 Application for Home-based Processor" '
    'and "A fifty (50) dollar registration fee". (8): the registration "shall be valid for one (1) '
    'year ... shall expire March 31 of each year and is renewable upon submission of a DFS-250 and '
    'accompanied by an annual fee of fifty (50) dollars." (9): "Inspection of a home-based processor '
    'facility shall be made upon complaint, utilizing the DFS-252". KRS 217.136(7) adds that '
    'facilities "MAY be inspected annually by the cabinet" — may, which is why inspection_required '
    'is false — and (8) makes a processor subject to sampling and inspection on misbranding, '
    'adulteration or a consumer complaint, with (9) allowing cessation of production on an imminent '
    'health hazard. Section 3(1) also imposes real hygiene duties: regular handwashing, sanitising '
    'food contact surfaces before each use, keeping children under twelve and animals out of the '
    'kitchen during production, and ceasing domestic activities such as family meal preparation, '
    'dishwashing and laundry in the kitchen.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kentucky.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'KY' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Programme 2 — Kentucky Home-Based Microprocessor (KRS 217.137, 902 KAR 45:090 §§4-5)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'production_date', 'allergens'
  ],
  disclaimer_text = 'This product is home-produced and processed',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note = 'KRS 217.136(3)(e) requires the statement "in ten (10) point type".',
  notes =
    'THE MICROPROCESSOR''S OWN LABELLING PROVISION WAS NOT LOCATED. 902 KAR 45:090 Section 3(5) '
    'applies the KRS 217.136(3) list to the home-based PROCESSOR; Sections 4 and 5, which govern '
    'microprocessor certification and production standards, prescribe no label in the text read on '
    '2026-09-06. This row therefore carries the processor''s label as the best available reading — '
    'the two routes sit in one chapter under one statement, and printing that list is far better '
    'than refusing to print at all — but it is NOT verified for this programme and an admin should '
    'check 902 KAR 45:090 in full before treating it as settled. What Section 4(5) does say about '
    'documents is separate from the label: the scheduled process "shall be maintained ... in the '
    'processing establishment and a copy shall be posted at the point of sale", and "Home-based '
    'microprocessed food products shall only be marketed by the certificate holder that processed '
    'the food product."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kentucky.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'KY' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  -- REVERSING 20260906030000. KRS 217.137(2) is a closed list of three physical venues.
  online_orders = 'banned',
  direct_delivery = 'banned',
  -- Not addressed anywhere, and not the ban's basis.
  cat_fermented = 'unclear',
  venue_note =
    'BANNED BY EXHAUSTIVE ENUMERATION — and this row was moved to "unclear" by 20260906030000 on the '
    'strength of 902 KAR 45:090''s silence, which was a mistake: the venue list is in the statute, '
    'not the regulation. KRS 217.137(2): "Food products that are produced or processed by a '
    'home-based microprocessor and in compliance with administrative regulations promulgated '
    'pursuant to subsection (1) of this section are acceptable food products that may only be '
    'offered for sale by farmers markets, certified roadside stands, or on the processor''s farm." '
    'Three venues, all physical, "may only". A certified roadside stand is itself defined at 902 KAR '
    '45:090 Section 1(2) as "a physical location listed with the Kentucky Farm Bureau for the '
    'direct-to-consumer marketing of limited Kentucky grown and produced food products". THE '
    'CONTRAST WITHIN THE CHAPTER SETTLES IT: for the home-based processor, KRS 217.136(5) uses an '
    'open list and names the internet in it — "including from the home-based processor''s home, '
    'whether by pick-up or delivery, at a market, roadside stand, community event, or online". The '
    'legislature wrote "including ... or online" for one route and a closed list of three physical '
    'venues for the other. 902 KAR 45:090 also bars microprocessed products from being "used or '
    'offered for consumption in a retail food establishment or through interstate commerce", and '
    'Section 4(5)(c) requires that they "shall only be marketed by the certificate holder that '
    'processed the food product."',
  category_note =
    'THIS ROUTE EXISTS TO LIFT THE PROCESSOR''S ACID-FOOD BAN, which is why acidified and low-acid '
    'canned are allowed here and banned there. The price is a scheduled process: 902 KAR 45:090 '
    'Section 4(2)(g) requires "Documentation from the processing authority for an established '
    'scheduled process for each food item that is to be processed", and "1. Any change in the recipe '
    'shall constitute a recipe deviation, and a new review and approval shall be required from the '
    'processing authority prior to processing. 2. Each additional product shall have a separate '
    'written established scheduled process ... 3. All established scheduled processes shall be '
    'maintained and made available upon request by the cabinet." THE FARMING CONDITION IS REAL: '
    'Section 4(1) speaks of "A Kentucky farmer desiring to grow, harvest, process, and market '
    'Kentucky grown microprocessed food products", and 4(2)(a) requires the application to give "The '
    'physical address and acreage of the farmland on which the primary food product ingredients are '
    'to be grown". Fermented food is addressed nowhere and was banned on nothing.',
  license_note =
    'Certification, annual, fifty dollars, with a food processing school and an approved water '
    'source. 902 KAR 45:090 Section 4(2) requires the application to carry the farmland address and '
    'acreage, the primary residence, the water source ("Sufficient potable water ... from a source '
    'constructed, maintained, and operated pursuant to ... 401 KAR Chapter 8"), the sewage disposal '
    'arrangement, the product list, "Verification of attendance and successful completion of the '
    'Food Processing School provided by the University of Kentucky Extension Office" or a school '
    'approved under 21 C.F.R. 114.10, and the scheduled-process documentation. (3): the application '
    'and water source approval must be submitted "Prior to marketing home-based products", and only '
    '"If the application is approved" may the microprocessor begin marketing. (6): certification '
    'runs one year, expiring 31 March, renewable for fifty dollars. (7): the food processing school '
    '"shall be required every three (3) years or upon any change or addition of food products to be '
    'processed."',
  training_note =
    'The Food Processing School, and it recurs: 902 KAR 45:090 Section 4(2)(f) requires verification '
    'of "attendance and successful completion of the Food Processing School provided by the '
    'University of Kentucky Extension Office" or of "a food processing school approved pursuant to '
    '21 C.F.R. 114.10", and Section 4(7) requires it again "every three (3) years or upon any change '
    'or addition of food products to be processed."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kentucky.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'KY' and ordinal = 2 and verified_at is null;
