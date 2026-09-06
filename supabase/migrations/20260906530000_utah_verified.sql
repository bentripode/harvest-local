-- Harvest Local — Utah verified: three programmes, three different bodies of law.
--
-- SOURCES, all read 2026-09-06 from the state's own publications:
--   * Utah Code § 4-5-501 (cottage food operations), le.utah.gov, effective 5/3/2023
--   * Utah Admin. Code R70-560 (Inspection and Regulation of Cottage Food Production Operations),
--     sections 1 to 8, via Cornell LII's reproduction of the rule
--   * Utah Code Title 4, Chapter 5a (Home Consumption and Homemade Food Act), §§ 4-5a-101 to
--     4-5a-105, le.utah.gov — §§ 102, 103 and 104 are EFFECTIVE 5/6/2026, amended by 2026 Ch. 433
--   * Utah Code § 26B-7-416 (microenterprise home kitchen permits) and § 26B-7-401 (definitions),
--     le.utah.gov, effective 5/7/2025, amended by 2025 Ch. 487
--
-- Utah runs three routes and they are MUTUALLY EXCLUSIVE by definition: § 26B-7-401(15)(b)(ii) says
-- a "microenterprise home kitchen" "does not include ... a cottage food operation". So a Utah seller
-- picking a programme is picking one of three genuinely different regimes, and getting the row
-- wrong sends them to the wrong regulator — the cottage food route registers with the Department of
-- Agriculture and Food, the microenterprise route permits with the LOCAL health department, and the
-- homemade food route registers with nobody.
--
-- Every label rule for Utah was empty, with the note "The source has no labelling section for
-- Utah." Two of the three now have one, from the state's own text.
--
-- =========================================================================
-- 1. THE SEED SAID EVERY UTAH PROGRAMME ALLOWS ONLINE ORDERS. NONE OF THEM SAY SO.
-- =========================================================================
-- All three rows read `online_orders = allowed` and all three came from the same summary. Reading
-- the three bodies of law, NOT ONE mentions internet selling in either direction:
--   * § 4-5-501 and R70-560 are silent; R70-560-7(8) reaches a food establishment sale and confines
--     it to "within the boundaries of Utah".
--   * Chapter 5a works through a "direct-to-sale location", defined at § 4-5a-102(4) as "a farm,
--     ranch, direct-to-sale farmers market, home, office, or any location agreed upon by both a
--     producer or a producer's designated representative and the informed final consumer" — a place,
--     not a channel.
--   * § 26B-7-416(8)(f) says only "the operator may only provide food directly to a consumer".
-- So all three become `unclear`, which under rule 6 does NOT block a listing. This is a downgrade in
-- confidence, not a new restriction: nobody has been stopped from selling, and the row now says
-- honestly that the state has not answered the question rather than asserting that it has.
--
-- =========================================================================
-- 2. THE HOMEMADE FOOD ACT HAS A LABEL, AND THE BUYER MUST BE TOLD BEFORE THEY BUY
-- =========================================================================
-- § 4-5a-104(3): "food or food products sold under this section shall be labeled with: (a) the
-- producer's name and address; (b) a disclosure statement indicating that the product is: (i) not
-- for resale; and (ii) processed and prepared without state or local inspection; and (c) a statement
-- listing whether the food or food product contains, or was prepared in a location that also
-- handles, common allergens including milk, soy, wheat, eggs, peanuts or tree nuts, fish, or
-- shellfish."
--
-- (b) and (c) PRESCRIBE SUBSTANCE AND NOT WORDING, so they are a `seller_statement`, not a
-- `disclaimer_text` — composing a sentence and storing it in the column that exists to hold quoted
-- law printed onto food without review is exactly what that column is not for. The prompt carries
-- the statute's own words for both.
--
-- PREDISCLOSURE IS REQUIRED, and by an unusually direct route: the exemption in (1) applies only
-- where the food is "sold directly to an informed final consumer", and § 4-5a-102(7) defines that
-- person as one who "(c) has been informed that the product is not certified, licensed, regulated,
-- or inspected by the state". Being informed is a PRECONDITION OF THE EXEMPTION, not a labelling
-- afterthought — a buyer who learns it when the box arrives was not an informed final consumer when
-- they bought. § 4-5a-104(6) says the same thing as a duty on the producer. For a remote sale the
-- only place that can happen is the listing.
--
-- 2026 Ch. 433 also added minor-producer carve-outs: § 4-5a-104(7) disapplies the labelling
-- requirements to "a direct sale by a home producer comprising only minor producers", and
-- § 4-5a-103(3) does the same for a direct-to-sale farmers market of minors. Not modelled — nothing
-- here records a seller's age — and recorded in the notes rather than silently ignored.
--
-- =========================================================================
-- 3. THE COTTAGE FOOD LABEL IS IN THE RULE, NOT THE STATUTE
-- =========================================================================
-- § 4-5-501(4)(c) says only that the operator shall "package a cottage food product with a label, as
-- specified by the department in rule", which is why reading the statute alone found nothing. The
-- rule is R70-560-6(2): the food's name, ingredients in descending order of predominance by weight,
-- the food source of each major allergen, an accurate net quantity declaration, the name and place
-- of business, the telephone number, nutritional labelling unless exempt, and "(h) the words 'Home
-- Produced' in bold and conspicuous 12-point type on the principal display panel".
--
-- (h) IS PRESCRIBED WORDING, so it is `disclaimer_text` — two words, verbatim, at 12pt.
--
-- (g), nutritional labelling, is NOT put in `required_elements`: `nutrition_if_claimed` can never
-- carry a value, so requiring it makes the label permanently unprintable. See the migration
-- alongside this one, which is the general fix for that.
--
-- =========================================================================
-- 4. THE MICROENTERPRISE ROUTE IS LOCAL, AND THAT WAS RECORDED BACKWARDS
-- =========================================================================
-- `local_preemption` was `true` on all three rows. It is right for the other two — § 4-5-501(6)(a)
-- and R70-560-8(1)(a) take local health departments out of cottage food production, and
-- § 4-5a-104(1) exempts a producer from "state, county, or city licensing, permitting,
-- certification, inspection, packaging, and labeling requirements". It is FLATLY WRONG for the
-- microenterprise route, where § 26B-7-416(2)(a) requires "a permit from the local health department
-- that has jurisdiction over the area", (2)(c) has that department set the fee, and (6) has it
-- inspect. A seller reading "local preemption" there would conclude their county has no say, when
-- their county issues the permit.
--
-- 2025 Ch. 487 also loosened the same-day rule our note recorded: § 26B-7-416(8)(a) still requires
-- TCS food to be prepared, cooked and served the same day, but (a)(ii) now allows up to 72 hours
-- with a temperature log kept every two hours, daily and four-hourly appliance logs, 90-day
-- retention and date marking.
--
-- `training_required` drops from `yes` to `unclear` on that row: § 26B-7-416 imposes none, and
-- § 26B-7-413(2) requires a food handler permit only for someone working "for a food service
-- establishment" — whether a microenterprise home kitchen is one under the § 26B-7-401(13)
-- definition is a question the text does not answer. `recipe_approval` drops to `no` for a similar
-- reason: what § 26B-7-416(10)(b) requires is written standard operating procedures naming all food
-- and the methods of preparing it, filed with the local health department. That is a real
-- obligation and it is recorded in `recipe_note`, but it is not recipe approval.
--
-- =========================================================================
-- 5. CATEGORY AXES
-- =========================================================================
-- COTTAGE FOOD. § 4-5-501(1)(b) limits it to "a nonpotentially hazardous baked good, jam, jelly, or
-- other nonpotentially hazardous food", and (1)(d) defines potentially hazardous as a food of animal
-- origin, raw seed sprouts, or a TCS food — so refrigerated and meat stay `banned` on the
-- definition. `list_only` on shelf-stable is right for a better reason than the seed gave:
-- R70-560-3(1)(b) and (2) mean an operation "may only sell department approved foods to the public",
-- with a process-authority letter at the department's discretion. Acidified and fermented move from
-- the seed's flat `allowed`/`banned` to `conditional` — neither is named anywhere in statute or
-- rule, and both live or die on that same per-food approval. Low-acid canned stays `banned`: a
-- home-canned low-acid food is potentially hazardous by the statutory definition, and R70-560-7(2)
-- requires any hermetically sealed ingredient to come from a regulated plant.
--
-- HOMEMADE FOOD. § 4-5a-105(1) is the whole of the limitation: the chapter "does not apply to the
-- sale of (a) raw dairy or raw dairy products; or (b) meat products", excepting poultry under the
-- USDA 1,000-bird exemption and "domesticated rabbit meat, pending approval from the United States
-- Department of Agriculture". Everything else the seed had is confirmed rather than changed, and
-- § 4-5a-105(3) — "The department may not, by rule, impose an additional limit, requirement, or
-- restriction on a producer selling food or a food product under this chapter" — is why `allowed`
-- is safe here in a way it rarely is. Raw dairy is not one of our six axes; it is in the note.
--
-- MICROENTERPRISE. Shelf-stable moves from `conditional` to `unrestricted`: the same-day rule the
-- old note cited applies to TCS food, and § 26B-7-401(18)(e) puts a bakery item needing no further
-- cooking squarely inside "ready-to-eat". Acidified and fermented move from `banned` to
-- `conditional`, hanging on § 26B-7-416(8)(d) — "food preparation may not involve processes that
-- require a HACCP plan" — which is a real hook but resolves against the adopted Food Code's variance
-- rules, not read here. Low-acid canned stays `banned` on § 26B-7-416(9)(w)(i), which permits a rule
-- requiring that "food in a hermetically sealed container is obtained from a regulated food
-- processing plant". Also banned by name: raw milk and raw milk products, molluscan shellfish
-- ((8)(d), (8)(e)) and, at (9)(v), raw TCS foods and fish from waters of the state.
--
-- =========================================================================
-- 6. NOT TOUCHED
-- =========================================================================
-- `state_cottage_food_rules` for UT was verified by an admin on 2026-09-05 against Chapter 5a and
-- reads no cap, no licence, with a note that says outright it records the Homemade Food Act route
-- and that Utah runs two others. That is correct and it is a human attestation, so it stays as it
-- is. No Utah programme has a revenue cap in any of the three bodies of law.
--
-- `verified_at` stays null on every row below.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Cottage food — Utah Code 4-5-501, Utah Admin. Code R70-560.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'unclear',
  retail_allowed = true,
  revenue_cap = null,
  cap_basis = 'none',
  cat_shelf_stable = 'list_only',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'conditional',
  category_note =
    'A cottage food product is "a nonpotentially hazardous baked good, jam, jelly, or other '
    'nonpotentially hazardous food produced in a home kitchen" (§ 4-5-501(1)(b)), and potentially '
    'hazardous means a food of animal origin, raw seed sprouts, or a TCS food ((1)(d)) — which is '
    'what bans refrigerated and meat. The list_only on shelf-stable is R70-560-3: the operator must '
    '"receive approval from the department to produce the food" and "may only sell department '
    'approved foods to the public", with written confirmation from a department-approved laboratory '
    'or process authority that the food is not potentially hazardous, at the department''s '
    'discretion. ACIDIFIED and FERMENTED are conditional rather than flatly allowed or banned: '
    'neither is named in the statute or the rule, so each stands or falls on that per-food approval. '
    'LOW-ACID CANNED stays banned — home-canned low-acid food is potentially hazardous on the '
    'statutory definition, and R70-560-7(2) requires any hermetically sealed ingredient to come from '
    'a regulated food processing plant.',
  license_required = 'yes',
  license_note =
    'A REGISTRATION, not a licence, and non-discretionary: § 4-5-501(5) says the department "shall '
    'issue a registration" to an applicant who pays the fee and meets the section, and R70-560-5(2) '
    'registers the operation as a food establishment under R70-540. R70-560-5(4) requires the '
    'registration to be displayed at the operation, and a copy displayed at farmers'' markets, '
    'roadside stands and other fixed selling structures.',
  inspection_required = true,
  recipe_approval = 'yes',
  recipe_note =
    'R70-560-4(4): the product "shall be prepared by following the recipe used to prepare the food '
    'that was submitted for the approval testing", any process-authority stipulations must be '
    'followed, and the recipe and those stipulations must be available in the facility for the '
    'department to review.',
  training_required = 'yes',
  training_note =
    '§ 4-5-501(4)(b) and R70-560-4(1)(a): each operator must hold a valid food handler''s permit, '
    'which under § 26B-7-413(3) means at least 75 minutes of training and a 40-question exam passed '
    'at 75%.',
  local_preemption = true,
  venue_note =
    'Utah Code § 4-5-501 (eff. 5/3/2023) and Utah Admin. Code R70-560, read 2026-09-06. Register '
    'with the Department of Agriculture and Food and hold a food handler''s permit; the department '
    'inspects before issuing the registration, on suspicion of violation, and "at a frequency '
    'determined by the department" (R70-560-5(1)). NOTHING IN EITHER TEXT ADDRESSES INTERNET '
    'SELLING, which is why online_orders is now unclear rather than the summary''s allowed. '
    'R70-560-7(8) permits sale to a food establishment "within the boundaries of Utah" only "if that '
    'food has not been subject to intervening storage or transfer" — that condition is what makes '
    'mail_delivery unclear for the retail channel. § 4-5-501(7) and R70-560-8(2) then forbid a food '
    'service establishment using a cottage food product as an ingredient in food it prepares for the '
    'public. Local health departments have no jurisdiction over production (§ 4-5-501(6)(a)) unless '
    'the product is consumed on the premises, but keep it for foodborne-illness investigations.',
  source_url = 'https://le.utah.gov/xcode/Title4/Chapter5/4-5-S501.html',
  source_checked_at = '2026-09-06'
where state_code = 'UT' and ordinal = 1;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'allergens', 'net_weight',
    'business_name', 'producer_address', 'producer_phone'
  ],
  optional_elements = array['nutrition_if_claimed'],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = 'Home Produced',
  disclaimer_min_pt = 12,
  disclaimer_all_caps = false,
  disclaimer_font_note = 'Bold and conspicuous, on the principal display panel.',
  metric_required = false,
  placard_required = false,
  placard_text = null,
  predisclosure_required = false,
  seller_statement_prompt = null,
  notes =
    'Utah Admin. Code R70-560-6, read 2026-09-06. The statute delegates the whole label: '
    '§ 4-5-501(4)(c) requires only that the operator "package a cottage food product with a label, '
    'as specified by the department in rule", which is why reading the statute alone found nothing '
    'and this row was empty. R70-560-6(2) lists the name, ingredients in descending order of '
    'predominance by weight (when made from two or more), "the name of the food source for each '
    'major food allergen contained in the food unless the food source is already part of the common '
    'or usual name of the respective ingredient", an accurate net quantity declaration, the name and '
    'place of business, the telephone number, and nutritional labelling unless exempt. '
    '"HOME PRODUCED" IS PRESCRIBED WORDING, not a substance requirement: (h) requires "the words '
    '"Home Produced" in bold and conspicuous 12-point type on the principal display '
    'panel", so it is stored as the disclaimer, verbatim, at 12pt. '
    'NUTRITIONAL LABELLING ((g), "unless the product qualifies for an exemption") is recorded as '
    'OPTIONAL, not required: whether a given operation is exempt turns on 21 CFR 101.9(j), which '
    'nothing here evaluates, and the element can never carry a value — requiring it would make every '
    'Utah cottage food label permanently unprintable. R70-560-6(1) also incorporates 21 CFR Ch. 1 '
    'Subchapters A and B wholesale, so federal packaged-food labelling applies on top of this list.',
  source_url = 'https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R70-560-6',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'UT' and ordinal = 1);

-- ---------------------------------------------------------------------------
-- 2. Home Consumption and Homemade Food Act — Utah Code 4-5a.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'restricted',
  mail_note =
    'A "designated representative" — "a person contracted by a producer to distribute, sell, '
    'deliver, hold, store, or offer for sale the producer''s homemade food product" '
    '(§ 4-5a-102(2)) — may deliver on the producer''s behalf under § 4-5a-104(4)(a), and the '
    'producer keeps ownership unless they agree otherwise ((4)(b)). Restricted rather than allowed '
    'for two reasons: the delivery must still land at a direct-to-sale location, and '
    '§ 4-5a-104(1)(b)(i) requires the food be "produced and sold within the state", so it is an '
    'inside-Utah route only. Whether an ordinary parcel carrier is a contracted "designated '
    'representative" is not answered by the text.',
  direct_delivery = 'allowed',
  retail_allowed = false,
  revenue_cap = null,
  cap_basis = 'none',
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'allowed',
  cat_meat = 'conditional',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'allowed',
  cat_fermented = 'allowed',
  category_note =
    '§ 4-5a-105(1) is the entire limitation: the chapter "does not apply to the sale of (a) raw '
    'dairy or raw dairy products; or (b) meat products", with two exceptions — poultry where the '
    'producer "slaughters no more than 1,000 birds per year in accordance with the United States '
    'Department of Agriculture 1,000 bird exemption" and follows the FSIS guidance document by name, '
    'and "domesticated rabbit meat, pending approval from the United States Department of '
    'Agriculture that the state''s role in meat inspection is preserved". That is why meat is '
    'conditional. Everything else is allowed on unusually firm ground for this table: '
    '§ 4-5a-105(3) says "The department may not, by rule, impose an additional limit, requirement, '
    'or restriction on a producer selling food or a food product under this chapter", so there is no '
    'rule underneath the statute waiting to narrow it. RAW DAIRY is banned and is not one of our six '
    'axes.',
  license_required = 'no',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = true,
  license_note =
    '§ 4-5a-104(1) exempts a producer from "state, county, or city licensing, permitting, '
    'certification, inspection, packaging, and labeling requirements". (2) is the exception: the '
    'producer must still comply with municipal business licence requirements under § 10-1-203.',
  venue_note =
    'Utah Code Title 4, Chapter 5a (Home Consumption and Homemade Food Act), §§ 102-104 as amended '
    'by 2026 Ch. 433, EFFECTIVE 5/6/2026, read 2026-09-06. The Act works through a "direct-to-sale '
    'location": "a farm, ranch, direct-to-sale farmers market, home, office, or any location agreed '
    'upon by both a producer or a producer''s designated representative and the informed final '
    'consumer" (§ 4-5a-102(4)). Sales must be direct to an "informed final consumer" who does not '
    'resell and who "has been informed that the product is not certified, licensed, regulated, or '
    'inspected by the state" (§ 4-5a-102(7)), and the food must be "produced and sold within the '
    'state" (§ 4-5a-104(1)(b)(i)). NO RESALE CHANNEL: § 4-5a-104(5)(a) forbids selling to a '
    'restaurant or commercial establishment, except (5)(b), raw unprocessed fruit or vegetables. '
    'The Act does not mention internet selling in either direction. NOT MODELLED: 2026 Ch. 433 '
    'added minor-producer carve-outs at § 4-5a-104(7) and § 4-5a-103(3) that disapply the labelling '
    'and unregulated-market requirements to sellers under 18 — nothing here records a seller''s age, '
    'so the stricter adult rules are applied to everyone.',
  source_url = 'https://le.utah.gov/xcode/Title4/Chapter5A/4-5a-S104.html',
  source_checked_at = '2026-09-06'
where state_code = 'UT' and ordinal = 2;

update public.state_label_rules set
  required_elements = array['producer_name', 'producer_address', 'allergens', 'seller_statement'],
  optional_elements = array[]::text[],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  metric_required = false,
  placard_required = false,
  placard_text = null,
  predisclosure_required = true,
  seller_statement_prompt =
    'Utah asks you to say two things in your own words. § 4-5a-104(3)(b): "a disclosure statement '
    'indicating that the product is: (i) not for resale; and (ii) processed and prepared without '
    'state or local inspection". § 4-5a-104(3)(c): "a statement listing whether the food or food '
    'product contains, or was prepared in a location that also handles, common allergens including '
    'milk, soy, wheat, eggs, peanuts or tree nuts, fish, or shellfish." The allergens you record on '
    'each product cover what is IN the food; this statement is where you say whether your kitchen '
    'also handles them.',
  notes =
    'Utah Code § 4-5a-104(3), as amended by 2026 Ch. 433, read 2026-09-06. The statute prescribes '
    'SUBSTANCE AND NOT WORDING for both the disclosure and the allergen statement, so they are a '
    'seller_statement rather than a disclaimer — writing a sentence of our own into disclaimer_text, '
    'the column that holds quoted law printed onto food without review, is exactly what that column '
    'is not for. '
    'PREDISCLOSURE IS REQUIRED, and by a route no other state uses: the exemption at '
    '§ 4-5a-104(1) applies only where the food is "sold directly to an informed final consumer", and '
    '§ 4-5a-102(7)(c) defines that person as one who "has been informed that the product is not '
    'certified, licensed, regulated, or inspected by the state". Being informed is a PRECONDITION OF '
    'THE EXEMPTION, not a labelling afterthought — a buyer who reads it when the box arrives was not '
    'an informed final consumer at the moment they bought. § 4-5a-104(6) restates it as a duty on '
    'the producer. For a remote sale the only place that can happen is the listing. '
    'The allergen element carries § 4-5a-104(3)(c)''s "contains" half; the "prepared in a location '
    'that also handles" half is a fact about the kitchen rather than the product, so the prompt asks '
    'the seller to cover it in their statement. '
    'NOT MODELLED: § 4-5a-104(7) disapplies this whole subsection to a direct sale by a home '
    'producer comprising only minor producers.',
  source_url = 'https://le.utah.gov/xcode/Title4/Chapter5A/4-5a-S104.html',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'UT' and ordinal = 2);

-- ---------------------------------------------------------------------------
-- 3. Microenterprise home kitchens — Utah Code 26B-7-416.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  mail_note =
    '§ 26B-7-416(8)(c) requires the operator to "ensure the consumer receives the operator provided '
    'food within a safe time period based on holding capacity", and (8)(a)(ii) allows TCS food to be '
    'distributed up to 72 hours after preparation only with the temperature logs it describes. '
    'Neither addresses a third-party carrier.',
  direct_delivery = 'allowed',
  retail_allowed = false,
  revenue_cap = null,
  cap_basis = 'none',
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'conditional',
  cat_meat = 'allowed',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'conditional',
  category_note =
    'This programme is for ready-to-eat food, and its constraints fall on TCS food. '
    '§ 26B-7-416(8)(a): the operator "shall prepare, cook, and serve time and temperature controlled '
    'food on the same day", OR may distribute it within 72 hours with a temperature log updated '
    'every two hours, appliance logs at the start and end of each day and every four hours, 90-day '
    'log retention, and consistent date marking. The 72-hour route is new in 2025 Ch. 487; the old '
    'note here said only "same day". SHELF-STABLE is unrestricted, not conditional: the same-day '
    'rule is about TCS food, and § 26B-7-401(18)(e) puts "a bakery item for which further cooking is '
    'not required for food safety" inside "ready-to-eat". BANNED BY NAME: raw milk and raw milk '
    'products and any process requiring a HACCP plan ((8)(d)), molluscan shellfish ((8)(e)), and at '
    '(9)(v) raw TCS foods such as raw fish and raw shellfish and fish from waters of the state. '
    'ACIDIFIED and FERMENTED are conditional on that HACCP hook — whether a given preservation '
    'process needs a plan resolves against the adopted Food Code''s variance rules, not read here. '
    'LOW-ACID CANNED is banned on (9)(w)(i), which permits a rule requiring that "food in a '
    'hermetically sealed container is obtained from a regulated food processing plant". Game animals '
    'must be raised, slaughtered and processed under UDAF rules ((9)(w)(v)).',
  license_required = 'yes',
  license_note =
    'A LOCAL permit, not a state one: § 26B-7-416(2)(a) requires "a permit from the local health '
    'department that has jurisdiction over the area in which the microenterprise home kitchen is '
    'located", (2)(c) has that department set a cost-recovery fee, and (12) makes it '
    'non-transferable, annually renewable and restricted to the location and hours listed on it. '
    'The permit itself must carry the statement "This location is permitted under modified FDA '
    'requirements." (§ 26B-7-416(12)(d)) — that is text on the PERMIT, not on a label, and it is not '
    'a label element.',
  inspection_required = true,
  recipe_approval = 'no',
  recipe_note =
    'No recipe approval, but not nothing: § 26B-7-416(10)(b) requires the applicant to give the '
    'local health department written standard operating procedures covering "all food that will be '
    'stored, handled, and prepared", the proposed methods of preparation and handling, cleaning and '
    'refuse procedures, and a temperature plan for each TCS food. § 26B-7-416(12)(e) then lets the '
    'operator update the food types handled without renewing the permit.',
  training_required = 'unclear',
  training_note =
    '§ 26B-7-416 imposes no training requirement. § 26B-7-413(2) requires a food handler permit of '
    'anyone working as a food handler "for a food service establishment", and whether a '
    'microenterprise home kitchen is one under the § 26B-7-401(13) definition — "any place or area '
    'within a business or organization where potentially hazardous foods ... are prepared and '
    'intended for individual portion service and consumption by the general public" — is not '
    'answered by the text. Read as unclear rather than guessed either way.',
  local_preemption = false,
  venue_note =
    'Utah Code § 26B-7-416 (eff. 5/7/2025, 2025 Ch. 487) and § 26B-7-401, read 2026-09-06. '
    'LOCAL_PREEMPTION IS FALSE HERE AND WAS RECORDED AS TRUE: the local health department issues the '
    'permit, sets the fee and inspects. A seller told their county has no say would be badly '
    'misled. § 26B-7-416(8)(b): the operator "may not allow consumption of the operator provided '
    'food onsite". (8)(f) and (8)(g): food may go "only ... directly to a consumer" and not "to any '
    'wholesaler or retailer". § 26B-7-401(15)(b) excludes a catering operation, a cottage food '
    'operation, a food truck, an agritourism food establishment, a bed and breakfast and a '
    'residence-based group care facility from the definition — so this route and the cottage food '
    'route are mutually exclusive by law, not by our modelling. Inspections are bounded by (6)(b): '
    'an initial one no more than a week before opening, unscheduled ones within three days of '
    'opening or during operating hours, and later ones only on notice or on a valid suspicion of '
    'adulterated food or an outbreak.',
  source_url = 'https://le.utah.gov/xcode/Title26B/Chapter7/26B-7-S416.html',
  source_checked_at = '2026-09-06'
where state_code = 'UT' and ordinal = 3;

update public.state_label_rules set
  required_elements = array['seller_statement'],
  optional_elements = array[]::text[],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  metric_required = false,
  placard_required = false,
  placard_text = null,
  predisclosure_required = false,
  seller_statement_prompt =
    'Utah asks you to tell the buyer this, in your own words. § 26B-7-416(8)(h): the operator shall '
    'provide the consumer with "a notification that, while a permit has been issued by the local '
    'health department, the kitchen may not meet all of the requirements of a commercial retail food '
    'establishment."',
  notes =
    'Utah Code § 26B-7-416(8)(h), read 2026-09-06. This is the only thing the microenterprise statute '
    'requires a buyer to be told, and it prescribes substance rather than wording, so it is a '
    'seller_statement. There is no prescribed label: unlike the cottage food route, which delegates '
    'labelling to R70-560-6, § 26B-7-416 sets out sanitation, inspection and permit conditions and '
    'says nothing about what goes on a package. '
    'PREDISCLOSURE IS LEFT FALSE, deliberately. (8)(h) says the operator "shall provide the consumer '
    'with a notification" and does not say when — handing it over with the food would satisfy those '
    'words — so unlike the Homemade Food Act row, where being informed is a precondition of the '
    'exemption itself, there is no textual hook for requiring it before payment. Revisit if the '
    'department''s rules under (5) add one. '
    'NOT A LABEL ELEMENT: § 26B-7-416(12)(d) requires the PERMIT to carry the statement "This '
    'location is permitted under modified FDA requirements." That is text on the permit the local '
    'health department issues, not on the food.',
  source_url = 'https://le.utah.gov/xcode/Title26B/Chapter7/26B-7-S416.html',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'UT' and ordinal = 3);
