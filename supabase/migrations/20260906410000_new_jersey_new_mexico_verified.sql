-- Harvest Local — New Jersey and New Mexico, from N.J. Admin. Code 8:24-11.2 through 11.6 and
-- N.M. Stat. 25-12-2 through 25-12-4 (the Homemade Food Act), read 2026-09-06.
--
-- Both states legislate internet selling in terms, and both were recorded as "No restrictions" —
-- which understates them in a way that matters, because what they actually say maps onto this
-- marketplace almost exactly.
--
-- =========================================================================
-- NEW JERSEY
-- =========================================================================
--
-- 1. NEW JERSEY SEPARATES THE ORDER FROM THE HANDOVER, AND PERMITS THE ORDER ONLINE.
--
-- 8:24-11.2(b): "A cottage food operator may transact activities that are ancillary to the delivery
-- or relinquishment of cottage food products to a consumer by means of United States postal mail,
-- common carrier, electronic communication, INTERNET, and/or telephone, provided the delivery or
-- relinquishment of cottage food products occurs in New Jersey in compliance with N.J.A.C.
-- 8:24-11.3(a). 1. Authorized ancillary transactions include: i. Accepting order placements; ii.
-- Receiving payments; iii. Engaging in marketing or advertising activities; and iv. Participating in
-- other business activities other than cottage food product delivery and relinquishment."
--
-- Taking the order and taking the payment online are named as permitted. What may not happen
-- remotely is the handover. 8:24-11.3(a) then lists where the handover may occur — "i. The home of
-- the cottage food operator, but not for onsite consumption; ii. The home of the consumer, provided
-- the home is in New Jersey; iii. A New Jersey farmers' market or farm stand; iv. To consumers, at a
-- New Jersey temporary retail food establishment" — and forbids delivery "5. By United States postal
-- mail or a common carrier" and "6. In interstate commerce".
--
-- Pickup at the seller's home and delivery to the buyer's home, ordered and paid for online, inside
-- one state: that is this marketplace's model, described by a regulator. Recorded properly.
--
-- 2. NEW JERSEY IS A PLACARD STATE AND WAS NOT RECORDED AS ONE.
--
-- 8:24-11.4(b): "If the point of sale is a location other than the residence of the operator or the
-- consumer, the operator shall place at the point of sale, on conspicuous and unobstructed display,
-- the cottage food permit and a placard that states, "This food is prepared pursuant to N.J.A.C.
-- 8:24-11 in a home kitchen that has not been inspected by the Department of Health."" Same words as
-- the label statement, unlike Colorado's and Illinois's.
--
-- 3. THE MUNICIPALITY ELEMENT IS THE DELAWARE SHAPE.
--
-- 8:24-11.4(c)(5) requires "The name of the municipality in which the cottage food operator prepares
-- the cottage food product ... FOLLOWED BY EITHER "NEW JERSEY" OR "NJ"". That is `municipality_state`,
-- the element added for Delaware's "town/city, Delaware", not the bare `municipality` the row had.
-- Our renderer prints the state's full name, which is one of the two forms New Jersey permits.
--
-- =========================================================================
-- NEW MEXICO
-- =========================================================================
--
-- 4. THE STATEMENT IS PRESCRIBED VERBATIM, AND WE RECORDED THAT IT WAS NOT.
--
-- The row had `disclaimer_text` null on a note reading "New Mexico requires a disclaimer that the
-- food is home-produced and exempt from state licensing and inspection; the source paraphrases it
-- rather than quoting exact wording." The statute quotes it exactly. 25-12-3(C)(4): "the following
-- statement: "This product is home produced and is exempt from state licensing and inspection. This
-- product may contain allergens."" Two sentences, in the statute's own quotation marks.
--
-- 5. THE LABEL WAS MISSING FOUR OF ITS SIX ELEMENTS.
--
-- The row required a phone number and an ingredient list. 25-12-3(C) requires: "(1) the name, home
-- address, telephone number and email address of the processor of the food item; (2) the common or
-- usual name of the food item; (3) the ingredients of the food item in descending order of
-- predominance; and (4) [the statement]."
--
-- (1) IS FOUR THINGS AND NOT A CHOICE — New Mexico is the first state in this pass to require an
-- email address outright rather than as an alternative to something else. See the warning in the
-- rule's notes: we do not collect a producer email anywhere, so a New Mexico label will report it
-- missing and point the seller at a settings field that does not exist yet.
--
-- 6. INTERNET SELLING IS NAMED, AND SO IS THE WEBPAGE.
--
-- 25-12-3(A)(2) makes the exemption conditional on the seller selling "directly to consumers within
-- the state, including at farmers' markets, at festivals, ON THE INTERNET, at roadside stands, at
-- the seller's home for pick-up or delivery or through mail delivery" — internet, pickup, delivery
-- and post, all four named.
--
-- And 25-12-3(B)(4) requires the (C) information to be provided "on a webpage on which the homemade
-- food item is offered for sale". That is `predisclosure_required`, making New Mexico the seventh
-- such jurisdiction and one of the most explicit: not a notice or a statement, but the whole
-- information set, on the page where the item is sold.
--
-- `verified_at` stays null on both rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- New Jersey
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'allergens', 'producer_name', 'business_name',
    'permit_number', 'municipality_state'
  ],
  disclaimer_text = 'This food is prepared pursuant to N.J.A.C. 8:24-11 in a home kitchen that has not been inspected by the Department of Health.',
  -- 8:24-11.4(b): the same sentence, on display, wherever the point of sale is not a residence.
  placard_required = true,
  placard_text = 'This food is prepared pursuant to N.J.A.C. 8:24-11 in a home kitchen that has not been inspected by the Department of Health.',
  notes =
    'N.J. Admin. Code 8:24-11.4, read 2026-09-06. (c) requires labels or tags that "collectively '
    'state at least the following: 1. The common name of the cottage food product; 2. The cottage '
    'food product ingredients in descending order of predominance by weight; 3. If the cottage food '
    'product contains a major food allergen, the word, "Contains" followed by a list of the major '
    'food allergens that the cottage food product contains; 4. The cottage food operator''s name, '
    'business name, and Cottage Food Operator Permit number; 5. The name of the municipality in '
    'which the cottage food operator prepares the cottage food product, which shall be the same as '
    'the municipality that appears of record with the Department as the cottage food operator''s '
    'residence, followed by either "New Jersey" or "NJ"; and 6. [the statement]." THE MUNICIPALITY '
    'ELEMENT IS THE DELAWARE SHAPE and the row had the bare one: (5) wants the town followed by the '
    'state, so it is municipality_state. Our renderer prints the state''s full name, which is one of '
    'the two forms New Jersey permits. NEW JERSEY IS ALSO A PLACARD STATE, which was not recorded — '
    '(b): "If the point of sale is a location other than the residence of the operator or the '
    'consumer, the operator shall place at the point of sale, on conspicuous and unobstructed '
    'display, the cottage food permit and a placard that states, [the same statement]." The label '
    'statement and the placard text are identical here, unlike Colorado''s and Illinois''s. (a) also '
    'requires the permit to be available for inspection on request where the point of sale IS a '
    'residence. Note (3): allergens are declared with the word "Contains" before the list.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Jersey.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NJ' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 8:24-11.3(a)(1)(ii): the consumer's home, provided it is in New Jersey.
  direct_delivery = 'allowed',
  venue_note =
    'NEW JERSEY SEPARATES THE ORDER FROM THE HANDOVER, AND PERMITS THE ORDER ONLINE — the row '
    'previously said "No restrictions", which understates a regulation that describes this '
    'marketplace almost exactly. 8:24-11.2(b): "A cottage food operator may transact activities that '
    'are ancillary to the delivery or relinquishment of cottage food products to a consumer by means '
    'of United States postal mail, common carrier, electronic communication, internet, and/or '
    'telephone, provided the delivery or relinquishment of cottage food products occurs in New '
    'Jersey ... 1. Authorized ancillary transactions include: i. Accepting order placements; ii. '
    'Receiving payments; iii. Engaging in marketing or advertising activities; and iv. Participating '
    'in other business activities other than cottage food product delivery and relinquishment." '
    'WHAT MAY NOT HAPPEN REMOTELY IS THE HANDOVER. 8:24-11.3(a): an operator "shall not deliver or '
    'relinquish cottage food products: 1. At a location other than: i. The home of the cottage food '
    'operator, but not for onsite consumption; ii. The home of the consumer, provided the home is in '
    'New Jersey; iii. A New Jersey farmers'' market or farm stand; iv. To consumers, at a New Jersey '
    'temporary retail food establishment; or v. In New Jersey, to the consumer, provided applicable '
    'law does not otherwise prohibit [it]"; nor "3. To a wholesale establishment ...; 4. To a retail '
    'food establishment; 5. By United States postal mail or a common carrier ...; and/or 6. In '
    'interstate commerce". So online_orders is allowed, mail_delivery is banned, direct_delivery is '
    'allowed and retail_allowed is false, each on express words.',
  cap_note =
    'N.J. Admin. Code 8:24-11.3(b): "The gross annual sales (that is, before deductions of taxes and '
    'operating expenses) that a cottage food operator generates from the sale of cottage food '
    'products shall not exceed $50,000." The parenthesis is the useful part — it is gross, before '
    'tax and expenses, which is what our order totals measure.',
  license_note =
    'A permit, two-yearly, with a fee. 8:24-11.6: "(a) The fee to apply for a Cottage Food Operator '
    'Permit is $100.00. (b) A Cottage Food Operator Permit is valid for two years from date of '
    'issuance. (c) The fee to apply for renewal ... is $100.00. (d) To prevent permit lapse, a '
    'cottage food operator permittee should submit an application for permit renewal by no later '
    'than 45 days before the expiration". The permit number goes on every label. INSPECTION IS NOT '
    'ROUTINE BUT THE ACCESS RIGHT IS BROAD: 8:24-11.5(a) authorises a health authority to "enter '
    'upon, examine, and survey any premises, including the home kitchen of a cottage food operator, '
    'and things thereof, including materials, equipment, books, and records ... 1. To enforce or '
    'confirm compliance with any health law ...; and/or 2. To investigate complaints associated with '
    'cottage food products, such as contamination, foodborne illness, misbranding, or adulteration." '
    '8:24-11.7 provides for suspension, revocation and monetary penalties.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Jersey.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NJ' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- New Mexico — Homemade Food Act
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'producer_phone', 'producer_email',
    'product_name', 'ingredients_desc_by_weight'
  ],
  disclaimer_text = 'This product is home produced and is exempt from state licensing and inspection. This product may contain allergens.',
  -- 25-12-3(B)(3): a placard is one of the five ways the information may reach the consumer.
  placard_required = true,
  placard_text = 'This product is home produced and is exempt from state licensing and inspection. This product may contain allergens.',
  predisclosure_required = true,
  notes =
    'N.M. Stat. 25-12-3(B) and (C), read 2026-09-06. THE STATEMENT IS PRESCRIBED VERBATIM AND WE '
    'RECORDED THAT IT WAS NOT: this row had disclaimer_text null on a note saying "the source '
    'paraphrases it rather than quoting exact wording". (C)(4) quotes it in the statute''s own '
    'quotation marks: "This product is home produced and is exempt from state licensing and '
    'inspection. This product may contain allergens." THE LABEL WAS MISSING FOUR OF ITS SIX '
    'ELEMENTS. (C): "(1) the name, home address, telephone number and email address of the processor '
    'of the food item; (2) the common or usual name of the food item; (3) the ingredients of the '
    'food item in descending order of predominance; and (4) [the statement]." (1) is four things and '
    'NOT a choice — contrast Iowa, Maryland and Minnesota, where the identity requirement is a name '
    'plus an alternative. WARNING: WE DO NOT COLLECT A PRODUCER EMAIL ANYWHERE. New Mexico is the '
    'first state in this pass to require one outright, so a New Mexico label will report '
    '"Email address" missing with fix "profile" and send the seller to a settings field that does '
    'not exist. The same value is required on the listing by (B)(4). FIVE DELIVERY CONTEXTS, not '
    'five duties: (B) requires the information "(1) on a label affixed to a package ... when the '
    'package is the unit of sale; (2) on a label affixed to a container when the homemade food item '
    'is offered for sale from a bulk container; (3) on a placard displayed at the point of sale when '
    'the homemade food item is neither packaged nor offered for sale from a bulk container; (4) on a '
    'webpage on which the homemade food item is offered for sale; and (5) when a homemade food item '
    'is sold by telephone or custom order, a label is not required ... however, the seller shall '
    'disclose to the consumer that the homemade food item is produced at a private residence that is '
    'exempt from state licensing and inspection and may contain allergens." (4) IS WHY '
    'predisclosure_required IS TRUE, and it is the most explicit yet: not a notice or a sentence, '
    'but the whole information set, on the page where the item is offered. (D) adds that the seller '
    'must have it "readily available and shall provide it to a consumer upon request".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Mexico.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NM' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 25-12-3(A)(2) names "at the seller's home for pick-up or delivery".
  direct_delivery = 'allowed',
  -- 25-12-2(I) makes "fermenting" one of the ways to produce a homemade food item; the only limit
  -- is that the result not be time-and-temperature-control food.
  cat_fermented = 'conditional',
  cat_acidified = 'conditional',
  -- 25-12-3(F) expressly contemplates local permit systems, so the Act does not displace them.
  local_preemption = false,
  venue_note =
    'INTERNET SELLING IS A CONDITION OF THE EXEMPTION, NOT AN AFTERTHOUGHT — the row previously said '
    '"No restrictions". N.M. Stat. 25-12-3(A): homemade food items "are exempt from other '
    'requirements pursuant to the Food Service Sanitation Act and the New Mexico Food Act; provided '
    'that: (1) the food items are not-time-and-temperature-control food items; (2) the seller sells '
    'directly to consumers within the state, including at farmers'' markets, at festivals, on the '
    'internet, at roadside stands, at the seller''s home for pick-up or delivery or through mail '
    'delivery; (3) the seller completes a food handler certification course approved by the '
    'department; (4) the seller maintains a sanitary kitchen, practices good hygiene, protects the '
    'kitchen from rodents and pests and keeps pets and children out of the kitchen while producing '
    'food; (5) if the seller transports food items ..., the seller ensures that the food is '
    'transported in a sanitary manner ...; and (6) the seller labels or otherwise provides to the '
    'consumer the information required by Subsection C." Internet, pickup, delivery and post are all '
    'four named in (2), and "within the state" is satisfied here by construction. retail_allowed is '
    'false on "directly to consumers".',
  category_note =
    'ONE LIMIT, AND FERMENTING IS A NAMED METHOD OF PRODUCTION. 25-12-3(A)(1) confines the exemption '
    'to "not-time-and-temperature-control food items", which is the whole of it — there is no '
    'approved list and no prohibited list, hence cat_shelf_stable unrestricted. 25-12-2(I) then '
    'defines "to produce" as "to prepare a homemade food item by baking, cooking, cutting, '
    'dehydrating, drying, FERMENTING, growing, mixing, preserving, raising or other process '
    'designated by the environmental improvement board by rule." Fermenting is expressly a way to '
    'make a homemade food item, so cat_fermented was banned against the statute and is now '
    'conditional — permitted where the result is not time-and-temperature-control food. Acidified '
    'food is on the same footing and was banned on nothing. Refrigerated food and meat stay banned '
    'on (A)(1); low-acid canned goods stay banned as the standing exception on the axis where being '
    'wrong is dangerous.',
  license_note =
    'PERMITS ARE OPTIONAL AT STATE LEVEL AND MAY BE MANDATORY LOCALLY, which is what '
    'license_required = conditional means. 25-12-3(E): "The department may operate a voluntary '
    'permit system for the sale of homemade food items. A seller may apply for such a permit". (F): '
    'a class A county and a home rule municipality with a combined local health department "may '
    'operate a mandatory or a voluntary permit system for the sale of homemade food items within the '
    'jurisdictions of the respective county and municipality; provided that such permit system '
    'allows the sale of all food items at all locations authorized by the Homemade Food Act." So '
    'local_preemption is false — locals may require a permit — but the proviso preempts any local '
    'attempt to narrow the foods or the venues. TRAINING IS MANDATORY: (A)(3) conditions the '
    'exemption on completing "a food handler certification course approved by the department". '
    'Enforcement is graduated: (G) requires the department to "first issue a written warning '
    'regarding any violation before imposing a fine", with failure to comply a misdemeanour and a '
    'fine "not to exceed one hundred dollars ($100) per violation". No revenue cap appears in the '
    'Act.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/New-Mexico.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NM' and ordinal = 1 and verified_at is null;
