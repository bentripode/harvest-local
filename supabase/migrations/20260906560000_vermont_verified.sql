-- Harvest Local — Vermont: the rule our four rows cited was replaced three weeks ago.
--
-- SOURCES, all read 2026-09-06:
--   * 18 V.S.A. §§ 4301, 4303, 4353, 4358 (Title 18 ch. 85), legislature.vermont.gov — 4303, 4353
--     and 4358 all amended by 2025 Act 42, effective 1 July 2025
--   * Vermont Health Regulations, Chapter 5 Food Safety Rules, Subchapter 1 **Manufactured Food
--     Rule**, FINAL ADOPTED, EFFECTIVE 15 JANUARY 2026 —
--     healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf
--   * Vermont Health Regulations Chapter 5, Subchapter 2, **Food Service Establishments** (eff.
--     1 December 2003) — reg-food-service-establishments.pdf. This is the one that reaches a home
--     caterer, and it is the source the "NOT SOURCED" note on that row asked for.
--
-- =========================================================================
-- 1. VT ADMIN. CODE 12-5-52 IS SUPERSEDED, AND WE CITE IT SIX TIMES
-- =========================================================================
-- The previous pass verified three of these four rows against "VT Admin. Code 12-5-52" §§ 6.1.1 and
-- 6.2.1. That rule has been replaced by the Manufactured Food Rule effective 15 January 2026 — three
-- weeks before this reading. The section numbers even survived, which is the trap: the new rule also
-- has a 6.1.1 and a 6.2.1, and 6.2.1's labelling list is materially the same. **6.1.1 is not.**
--
--   OLD 6.1.1.2 (quoted in our note): an individual selling bakery products from their own home
--   kitchen whose average gross retail sales do not exceed $125.00 per week — $6,500 a year.
--   NEW 6.1.1.2: "A cottage food operation, as defined in this rule, that has gross annual sales of
--   $30,000 or less from the sale of cottage food products."
--
-- THE HOME-BAKERY WEEKLY EXEMPTION NO LONGER EXISTS. There are now exactly two licence exemptions
-- (new 6.1.1): a non-bakery food manufacturing establishment at $10,000 or less, and a cottage food
-- operation at $30,000 or less. A home baker making non-potentially-hazardous baked goods is a
-- cottage food operation — 18 V.S.A. § 4301(a)(6)(A) lists them first — and takes the $30,000
-- exemption. Above it, they are a licensed bakery at $100 a year under § 4353(3)(B)I.
--
-- So the "Vermont Home Baker" row was describing a repealed exemption at a stale figure, and is
-- repointed at what Vermont still has: the LICENSED home bakery. A seller under $30,000 belongs on
-- the Cottage Food Operation row instead. Nothing reassigns `seller_profiles.food_program_id`
-- automatically — that is a choice a seller makes and an admin should review.
--
-- =========================================================================
-- 2. THE DISCLAIMER MUST COME OFF THE LICENSED BAKERY ROW
-- =========================================================================
-- All four rows carried "Made in a home kitchen not inspected by the Vermont Department of Health."
-- New 6.2.1 is headed "Labeling Requirements for License Exempt Food Manufacturing Establishments"
-- and 6.2.1.1.7 puts that sentence on a LICENCE-EXEMPT operation's label. A licensed home bakery is
-- inspected. Printing it there would be a false statement on food, which is the same reason
-- Maryland's on-farm row had its label emptied rather than inherited.
--
-- The licensed bakery keeps a label, from the federal labelling this rule incorporates by reference
-- at § 7.5.2.3 (21 C.F.R. Part 101) — statement of identity, ingredients, net quantity, name and
-- place of business, and the 21 U.S.C. 343(w) allergen declaration — and the note says that is where
-- it comes from, rather than leaving it looking like a Vermont list.
--
-- =========================================================================
-- 3. TRAINING IS REQUIRED, AND ALL FOUR ROWS SAID IT WAS NOT
-- =========================================================================
-- New 6.2.2.1: "Both before beginning manufacturing and annually thereafter, a license exempt food
-- manufacturing establishment shall complete training approved by the Department in food handling,
-- cleanliness, sanitation, and healthfulness and attest to the completion of the training". 18 V.S.A.
-- § 4358(c) makes that attestation part of the annual licensing exemption filing, and § 4303(a)(7)
-- — added by 2025 Act 42 § 3 — is the rulemaking mandate behind it.
--
-- `training_required` was `no` on the two exempt rows and `unclear` on the third. It is `yes`. A
-- seller told no training is needed, who then has to attest annually that they completed it, has
-- been given the wrong answer about the one obligation that comes before they start.
--
-- =========================================================================
-- 4. NOTHING IN ANY OF IT MENTIONS SELLING ONLINE
-- =========================================================================
-- All four rows read `online_orders = allowed`, and three carried the summary's venue note
-- "Farmers markets, roadside stands, special events, online with mail order, home delivery and
-- pickup". The Manufactured Food Rule contains the words "internet", "online", "mail", "retail",
-- "resale" and "restaurant" ZERO times — that is a count, not an impression. The Food Service
-- Establishment rule confines a home caterer by where the food is eaten, not by how it is ordered.
-- So all four become `unclear`, along with `mail_delivery`. Nothing is blocked by that: only
-- `banned` blocks.
--
-- The one channel statement anywhere is the Department's own guidance page, "Food made under a
-- license exemption cannot be sold to restaurants or other licensed food establishments." That is
-- GUIDANCE, not the rule, and it is recorded as guidance while `retail_allowed` stays false on the
-- two exempt rows.
--
-- =========================================================================
-- 5. THE HOME CATERER, AT LAST SOURCED — AND ITS RESALE CHANNEL WAS BACKWARDS
-- =========================================================================
-- Food Service Establishments § 5-202(2): "Home Caterer: An establishment where food is prepared and
-- wrapped in a home kitchen using only standard home kitchen equipment and sold on a take-out basis
-- only or sold to commercial establishments for resale. Home caterers shall be inspected and
-- approved under these regulations to the maximum extent feasible considering the fact that the
-- establishment is located in the same facility the licensee uses as a primary residence. No animals
-- or pets are allowed in the kitchen area while food is being prepared. Meat and poultry products,
-- other than the sale of meals or as entrees directly to individual consumers, cannot be prepared in
-- a home kitchen operation."
--
-- Two corrections fall straight out of that sentence. `retail_allowed` was FALSE and the venue note
-- read "Must sell directly to consumers" — but the rule expressly permits sale "to commercial
-- establishments for resale". And `cat_meat` was `allowed` without qualification, when meat and
-- poultry may only go out as meals or entrees direct to individual consumers.
--
-- Its label comes from § 5-205 Item 2.A.2 — common name, ingredients in descending order of
-- predominance by weight, an accurate declaration of quantity, and the name and place of business of
-- the manufacturer, packer or distributor. No disclaimer: a home caterer is licensed and inspected.
--
-- =========================================================================
-- 6. THE REVENUE CAP THAT IS NOT A CAP
-- =========================================================================
-- `state_cottage_food_rules.revenue_cap` for VT is 30000. That column is a HARD STOP:
-- `record_order_revenue()` sets `is_paused = true, pause_reason = 'revenue_cap'` when a seller's
-- yearly goods total crosses it. Vermont's $30,000 is a LICENSING THRESHOLD — 18 V.S.A. § 4353(3)(C)
-- exempts gross receipts of $30,000 or less "pursuant to section 4358", and § 4358(b) removes only
-- "the obligation to obtain a license and the associated licensure fees" below it. Crossing it means
-- get a licence, not stop selling.
--
-- This is the Minnesota lesson with a live consequence: a Vermont seller with no chosen programme
-- falls back to this column, and at $30,000.01 their storefront closes with a compliance pause they
-- cannot lift themselves. The figure moves to `license_threshold` on the programme rows, where
-- crossing it stamps `license_threshold_crossed_at` and pauses nobody, and the cap column goes null.
--
-- THE ROW IS ADMIN-VERIFIED AND ITS OWN NOTE ALREADY SAYS THIS — "Below that figure no licence is
-- required; above it the establishment is licensed." The note and the column disagreed and the note
-- was right, so this is a placement fix rather than a disagreement with the person who signed it.
-- `verified_at` is left exactly as it is; it is not this migration's to set or clear, and the
-- appended note tells the admin what changed under their signature so they can re-save the form.
--
-- =========================================================================
-- 7. NOT TOUCHED
-- =========================================================================
-- `verified_at` stays null on all eight programme and label rows below.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 0. The guardrail: a licensing threshold is not a revenue cap.
-- ---------------------------------------------------------------------------
update public.state_cottage_food_rules set
  revenue_cap = null,
  notes = notes ||
    ' CORRECTION (20260906560000): revenue_cap held $30,000 and is now null. That column is what '
    'record_order_revenue() pauses a storefront on, and the $30,000 in 18 V.S.A. 4353(3)(C) is a '
    'LICENSING threshold, not a sales cap — 4358(b) removes "the obligation to obtain a license and '
    'the associated licensure fees" below it and nothing more. As written, a Vermont seller with no '
    'programme chosen would have had their storefront closed with pause_reason = revenue_cap at '
    '$30,000.01. The figure now lives on the programme rows as license_threshold, which stamps '
    'license_threshold_crossed_at and pauses nobody. The note above already described it correctly; '
    'only the column was wrong. Vermont sets no revenue cap in any of the four routes.'
where state_code = 'VT' and revenue_cap is not null;

-- ---------------------------------------------------------------------------
-- 1. Home Bakery — repointed from a repealed exemption to the licensed route.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  name = 'Vermont Home Bakery (licensed)',
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'unclear',
  retail_allowed = true,
  revenue_cap = null,
  cap_basis = 'none',
  license_threshold = null,
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'allowed',
  cat_meat = 'unclear',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'conditional',
  cat_fermented = 'unclear',
  category_note =
    'A licensed bakery is not limited to shelf-stable goods the way a cottage food operation is — '
    'the Manufactured Food Rule 4.1.2 defines bakery products as "loaf breads, rolls, biscuits, '
    'cakes (including celebration cakes such as for weddings or birthdays), pastries, cookies, or '
    'fruit pies", with no non-potentially-hazardous qualifier, so cheesecakes and cream pies belong '
    'here rather than on the cottage food row. ACIDIFIED and LOW-ACID CANNED are conditional on '
    '5.2.2.4, which requires "Documentation of Process Authority Review for low-acid canned foods, '
    'acidified foods, and products where the Department has requested documentation that there are '
    'no biological concerns"; 21 C.F.R. Parts 113 and 114 are incorporated at 7.5.1.2 and 7.5.1.4. '
    'MEAT is unclear because it is a different regulator: Rule 3.0 excludes establishments '
    '"that process food solely under the regulatory oversight of the Vermont Agency of Agriculture, '
    'Food, & Markets", and nothing read here says what a bakery adding meat products must do. '
    'FERMENTED is unclear for the same reason as meat — the rule simply does not address it.',
  license_required = 'yes',
  license_note =
    'THE EXEMPTION THIS ROW USED TO RECORD WAS REPEALED. Our note quoted VT Admin. Code 12-5-52 '
    '6.1.1.2, exempting a home baker whose "average gross retail sales do not exceed $125.00 per '
    'week" ($6,500 a year). That rule is superseded by the Manufactured Food Rule effective '
    '15 January 2026, whose 6.1.1 lists only two exemptions — non-bakery at $10,000 or less, and a '
    'cottage food operation at $30,000 or less. A home baker making non-potentially-hazardous baked '
    'goods is a cottage food operation (18 V.S.A. 4301(a)(6)(A)) and belongs on that row; this row '
    'is the LICENSED home bakery, $100 annually under 18 V.S.A. 4353(3)(B)I. '
    'ONE CONFLICT WORTH RESOLVING WITH THE DEPARTMENT: its guidance page says "Home Bakery and Home '
    'Caterer licensees must follow the Health Regulations for Food Service Establishments", but the '
    'statute puts bakeries in the food manufacturing schedule at 4353(3)(B), Rule 4.1.10 says a food '
    'manufacturing establishment "shall include food processors, bakeries, distributers, and '
    'warehouses", and the Food Service Establishment rule itself treats a bakery as separately '
    'licensed ("in a Vermont or out-of-state bakery licensed by the Department of Health"). The rule '
    'is followed here over the guidance.',
  inspection_required = true,
  recipe_approval = 'conditional',
  recipe_note =
    'Only for the hazardous processes: Manufactured Food Rule 5.2.2.4 requires Process Authority '
    'Review documentation for low-acid canned foods, acidified foods, and anything else the '
    'Department asks about. Ordinary baking needs no recipe approval.',
  training_required = 'unclear',
  training_note =
    'Rule 6.2.2 imposes annual training on LICENCE-EXEMPT establishments specifically; 18 V.S.A. '
    '4303(a)(7) mandates training requirements for "food manufacturing establishment operators and '
    'employees" generally, without limiting it to the exempt. What a licensed home bakery must '
    'complete is not stated in the rule read here.',
  local_preemption = false,
  venue_note =
    'Vermont Health Regulations Ch. 5 Subch. 1, Manufactured Food Rule (final adopted, eff. '
    '15 January 2026) and 18 V.S.A. 4353(3)(B), read 2026-09-06. THE RULE SAYS NOTHING ABOUT SALES '
    'CHANNELS: the words internet, online, mail, retail, resale and restaurant do not appear in it '
    'at all, which is why online_orders and mail_delivery are now unclear rather than the summary''s '
    'allowed, and why the old venue note ("Farmers markets, roadside stands, special events, online '
    'with mail order, home delivery and pickup") has been removed rather than re-cited. '
    'retail_allowed is true here because the exempt-only restriction does not apply to a licensed '
    'establishment. local_preemption is false on the rule''s own terms: 5.2.2.3 requires a "Local '
    'permit or zoning approval for proposed operation" among the licensing documents.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'VT' and ordinal = 1;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'net_weight', 'business_name', 'producer_address',
    'allergens'
  ],
  optional_elements = array['nutrition_if_claimed'],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  metric_required = false,
  placard_required = false,
  placard_text = null,
  predisclosure_required = false,
  seller_statement_prompt = null,
  notes =
    'THE HOME-KITCHEN DISCLAIMER HAS BEEN REMOVED FROM THIS ROW, DELIBERATELY. "Made in a home '
    'kitchen not inspected by the Vermont Department of Health" comes from Manufactured Food Rule '
    '6.2.1.1.7, and 6.2.1 is headed "Labeling Requirements for License Exempt Food Manufacturing '
    'Establishments". A licensed home bakery IS inspected — 5.2 licensing, and the Department '
    'assigns an opening inspection — so printing that sentence on its jars would be a false '
    'statement on food. Same reasoning that emptied Maryland''s on-farm row. '
    'WHERE THE REMAINING ELEMENTS COME FROM: the Manufactured Food Rule prescribes no state label '
    'list for a LICENSED establishment. It incorporates federal labelling by reference at 7.5.2.3 '
    '(21 C.F.R. Part 101, except 101.69 and 101.108), which is the source of the statement of '
    'identity, the ingredient list, the net quantity declaration and the name and place of business; '
    'the allergen declaration is 21 U.S.C. 343(w). They are recorded so a label can be printed, and '
    'this note says they are federal rather than Vermont''s own list. '
    'Nutrition is optional for the reason it is everywhere: 21 C.F.R. 101.9(j) exemptions are not '
    'something this schema can evaluate.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'VT' and ordinal = 1);

-- ---------------------------------------------------------------------------
-- 2. Home Food Processor — the non-bakery exemption, confirmed at $10,000.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'unclear',
  retail_allowed = false,
  revenue_cap = null,
  cap_basis = 'none',
  license_threshold = 10000,
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'unclear',
  cat_meat = 'unclear',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'conditional',
  cat_fermented = 'unclear',
  category_note =
    'THE EXEMPTION IS BY SALES VOLUME, NOT BY FOOD TYPE. Manufactured Food Rule 6.1.1.1 exempts "A '
    'non-bakery food manufacturing establishment that has gross annual sales of $10,000 or less" and '
    'says nothing about what it may make; 6.2 then requires it to "comply with all other applicable '
    'provisions of the law and this rule". So the old category note — "Jams, jellies, candies, '
    'chocolates, salsas, sauces and salad dressings", which was the summary''s illustration — has '
    'been removed rather than treated as a list, and shelf-stable is unrestricted. REFRIGERATED and '
    'FERMENTED are unclear because the rule neither permits nor forbids them by category and the '
    'consequence of guessing wrong runs one way; ACIDIFIED and LOW-ACID CANNED are conditional on '
    'the Process Authority Review at 5.2.2.4 and 21 C.F.R. Parts 113 and 114 (incorporated at '
    '7.5.1.2 and 7.5.1.4). MEAT is unclear because Rule 3.0 excludes establishments under the '
    'Agency of Agriculture, Food & Markets — a different regulator entirely.',
  license_required = 'conditional',
  license_note =
    'Manufactured Food Rule 6.1.1.1 (final adopted, eff. 15 January 2026) exempts "A non-bakery food '
    'manufacturing establishment that has gross annual sales of $10,000 or less", matching the fee '
    'schedule at 18 V.S.A. 4353(3)(A)III. Above it, $175 up to $50,000 and $275 beyond. THE OLD NOTE '
    'CITED VT ADMIN. CODE 12-5-52 6.1.1.1 FOR THE SAME FIGURE — that rule is superseded, the figure '
    'survived, and the citation is updated. The exemption is not automatic: 6.1 requires an annual '
    'licensing exemption filing "on or before a date established by the Department", and 18 V.S.A. '
    '4358(c) makes it an annual obligation carrying a training attestation.',
  inspection_required = false,
  recipe_approval = 'conditional',
  recipe_note =
    'Process Authority Review documentation is required for low-acid canned and acidified foods '
    '(Manufactured Food Rule 5.2.2.4). Nothing else needs recipe approval.',
  training_required = 'yes',
  training_note =
    'Manufactured Food Rule 6.2.2.1: "Both before beginning manufacturing and annually thereafter, a '
    'license exempt food manufacturing establishment shall complete training approved by the '
    'Department in food handling, cleanliness, sanitation, and healthfulness and attest to the '
    'completion of the training as required by Section 6.1". 18 V.S.A. 4358(c) puts the attestation '
    'in the annual exemption filing and 4303(a)(7), added by 2025 Act 42, is the mandate behind it. '
    'THIS ROW PREVIOUSLY SAID NO TRAINING WAS REQUIRED.',
  local_preemption = false,
  venue_note =
    'Manufactured Food Rule (eff. 15 January 2026) and 18 V.S.A. 4353(3)(A), read 2026-09-06. The '
    'rule contains no sales-channel language whatever — internet, online, mail, retail, resale and '
    'restaurant appear zero times — so online_orders and mail_delivery are unclear and the '
    'summary''s venue list has been removed. RETAIL: the Department''s guidance page states that '
    '"Food made under a license exemption cannot be sold to restaurants or other licensed food '
    'establishments", which is why retail_allowed stays false; that sentence is GUIDANCE and is not '
    'in the rule or the statute read here, so treat it as the Department''s position rather than a '
    'cited prohibition. local_preemption is false: 5.2.2.3 contemplates local permit or zoning '
    'approval.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'VT' and ordinal = 2;

-- ---------------------------------------------------------------------------
-- 3. Home Caterer — sourced from the Food Service Establishment rule.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'unclear',
  retail_allowed = true,
  revenue_cap = null,
  cap_basis = 'none',
  license_threshold = null,
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'allowed',
  cat_meat = 'conditional',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'unclear',
  cat_fermented = 'conditional',
  category_note =
    'MEAT IS QUALIFIED, AND THIS ROW SAID IT WAS SIMPLY ALLOWED. Food Service Establishments '
    '5-202(2): "Meat and poultry products, other than the sale of meals or as entrees directly to '
    'individual consumers, cannot be prepared in a home kitchen operation." So meals and entrees '
    'direct to a buyer are fine and a packaged meat product is not — including through the resale '
    'channel the same paragraph otherwise permits. ACIDIFIED and FERMENTED are conditional on the '
    'Variance Requirement: a food establishment must obtain a variance, with third-party review, '
    'before "smoking food as a method of food preservation rather than as a method of flavor '
    'enhancement; curing food; ... using food additives or adding components such as vinegar as a '
    'method of food preservation rather than as a method of flavor enhancement or to render a food '
    'so that it is not potentially hazardous". LOW-ACID CANNED is unclear: that clause does not name '
    'canning and this rule is about food service rather than manufacturing.',
  license_required = 'yes',
  license_note =
    '18 V.S.A. 4353(1)VII: "Home Caterer; $155.00", annually — the figure the summary gave, now '
    'confirmed against the fee schedule, which sits in the RESTAURANT bracket because 4301(a)(11) '
    'makes a caterer a food service establishment. Food Service Establishments 5-202(2) requires '
    'that "Home caterers shall be inspected and approved under these regulations to the maximum '
    'extent feasible considering the fact that the establishment is located in the same facility the '
    'licensee uses as a primary residence".',
  inspection_required = true,
  recipe_approval = 'no',
  recipe_note =
    'No recipe approval, but a variance with third-party review is required before curing, '
    'preservation smoking, or using vinegar or additives as preservation (Food Service '
    'Establishments, Variance Requirement).',
  training_required = 'unclear',
  training_note =
    'The Manufactured Food Rule''s annual training does not reach this row — it applies to food '
    'manufacturing establishments and Rule 3.0 says it "does not pertain to food service '
    'establishments". 18 V.S.A. 4303(b)(1)(C) refers to "demonstration of knowledge" requirements '
    'set by the Department in rule for a food establishment licence; what those amount to for a home '
    'caterer was not resolved in the text read here.',
  local_preemption = false,
  venue_note =
    'Vermont Health Regulations Ch. 5 Subch. 2, Food Service Establishments (eff. 1 December 2003), '
    '5-202(2), read 2026-09-06 — this row was previously sourced only to a summary. "Home Caterer: '
    'An establishment where food is prepared and wrapped in a home kitchen using only standard home '
    'kitchen equipment and sold on a take-out basis only or sold to commercial establishments for '
    'resale." RETAIL_ALLOWED WAS FALSE AND THE VENUE NOTE SAID "Must sell directly to consumers"; '
    'the rule expressly permits sale to commercial establishments for resale, so both are corrected. '
    'The confinement is that food may not be eaten on the premises — it is take-out or resale. '
    'Also: "No animals or pets are allowed in the kitchen area while food is being prepared", and '
    'the classification section states that "Any establishment doing off-premise catering must also '
    'have a commercial catering license or a fair stand license", which is why delivery is left '
    'unclear rather than assumed. mail_delivery was recorded as banned on the summary; nothing in '
    'the rule bans it, so it is unclear.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-food-service-establishments.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'VT' and ordinal = 3;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'net_weight', 'business_name', 'producer_address'
  ],
  optional_elements = array['nutrition_if_claimed'],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  metric_required = false,
  placard_required = false,
  placard_text = null,
  predisclosure_required = false,
  seller_statement_prompt = null,
  notes =
    'NOW SOURCED. The previous note said "NOT SOURCED ... Nothing in the statute or rule read on '
    '2026-09-06 states what a Vermont home caterer must put on a label", and pointed at the right '
    'gap: the Manufactured Food Rule''s 6.2.1 covers licence-exempt FOOD MANUFACTURING '
    'establishments and a home caterer is a licensed FOOD SERVICE establishment. The answer is in '
    'the other rule. Food Service Establishments 5-205 Item 2.A.2: "Label information shall include: '
    'a. The common name of the food, or absent a common name, an adequately descriptive identifying '
    'statement; b. If made from two or more ingredients, a list of ingredients in descending order '
    'of predominance by weight, including a declaration of artificial color or flavor and chemical '
    'preservatives, if contained in the food; c. An accurate declaration of the quantity of '
    'contents; d. The name and place of business of the manufacturer, packer, or distributor; and '
    'e. Except as exempted in the Federal Food, Drug, and Cosmetic Act 403(Q)(3)-(5), nutrition '
    'labeling". Item 2.A.1 adds 21 C.F.R. 101 and 9 C.F.R. 317 on top. '
    'NO DISCLAIMER, and that is the finding rather than an omission: a home caterer is licensed and '
    'inspected under 5-202(2), so the home-kitchen statement this row used to be expected to carry '
    'would be false. '
    'AN EXEMPTION WORTH KNOWING: Item 2.A.4 excuses "Bulk, unpackaged foods such as bakery products '
    'and unpackaged foods that are portioned to consumer specification" from labelling where no '
    'health or nutrient claim is made, no other law requires it, and the food was made on the '
    'premises — which covers a good deal of what a caterer sells. The elements here are what a '
    'PACKAGED item needs. '
    'No allergen element: 5-205 Item 2.A.2 does not list one, unlike the exempt-establishment rule. '
    'Federal 21 U.S.C. 343(w) still applies through Item 2.A.1 and is the seller''s own duty.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-food-service-establishments.pdf',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'VT' and ordinal = 3);

-- ---------------------------------------------------------------------------
-- 4. Cottage Food Operation — the axes the statute actually lists.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'unclear',
  retail_allowed = false,
  revenue_cap = null,
  cap_basis = 'none',
  license_threshold = 30000,
  cat_shelf_stable = 'limited',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'conditional',
  category_note =
    'Every axis here comes from one definition. 18 V.S.A. 4301(a)(6), mirrored at Manufactured Food '
    'Rule 4.1.6: a cottage food product is "food sold by a cottage food operator that does not '
    'require refrigeration or time or temperature control for safety, such as: (A) nonpotentially '
    'hazardous baked goods; (B) candy; (C) jams and jellies; (D) dry herbs; (E) trail mix; '
    '(F) granola; (G) cereal; (H) mixed nuts; (I) flavored vinegar; (J) popcorn; (K) coffee beans; '
    '(L) dry tea; (M) home-canned pickles, vegetables, or fruits having an equilibrium pH value of '
    '4.6 or lower or a water activity value of 0.85 or less that are made using recipes: '
    '(i) approved by the National Center for Home Food Preservation; or (ii) reviewed by a food '
    'processing authority for safety; and (N) any other good defined by the Commissioner in rule or '
    'policy." '
    'REFRIGERATED and MEAT are banned by the opening words, not by a list. SHELF-STABLE is limited '
    'rather than list_only because "such as" and (N) make the list illustrative, and Rule 6.1.2 lets '
    'an operator ask the Department for a determination on anything not named. ACIDIFIED and '
    'FERMENTED are conditional on (M)''s pH/water-activity ceiling and its two approved recipe '
    'routes. LOW-ACID CANNED is banned by arithmetic: Rule 4.1.14 defines a low-acid food as one '
    'with finished pH greater than 4.6 and water activity greater than 0.85, which is precisely what '
    '(M) excludes.',
  license_required = 'conditional',
  license_note =
    '18 V.S.A. 4353(3)(C): "Gross receipts of $30,000.00 or less from the sale of cottage food '
    'products are exempt pursuant to section 4358 of this title", and 4358(b) confirms that only '
    '"the obligation to obtain a license and the associated licensure fees" fall away. THE TENSION '
    'THE PREVIOUS NOTE RECORDED IS RESOLVED: it observed that VT Admin. Code 12-5-52 6.1.1 listed '
    'only two exempt categories and did not mention cottage food operations, and reasoned that the '
    'statute must be the later word. It was — and the rule has since caught up. The Manufactured '
    'Food Rule effective 15 January 2026 replaces 12-5-52, and its 6.1.1.2 now reads "A cottage food '
    'operation, as defined in this rule, that has gross annual sales of $30,000 or less from the '
    'sale of cottage food products." Statute and rule now agree. '
    'NOT AUTOMATIC: 6.1 requires an annual licensing exemption filing, and 6.1.2 lets an operator '
    'ask the Department to determine whether a product they make is a cottage food product.',
  inspection_required = false,
  recipe_approval = 'conditional',
  recipe_note =
    'Only for home-canned pickles, vegetables and fruits: 18 V.S.A. 4301(a)(6)(M) requires recipes '
    '"approved by the National Center for Home Food Preservation" or "reviewed by a food processing '
    'authority for safety". Nothing else on the list needs approval, and Rule 6.1.2 makes a '
    'Department determination available but optional.',
  training_required = 'yes',
  training_note =
    'Manufactured Food Rule 6.2.2.1 requires training approved by the Department "Both before '
    'beginning manufacturing and annually thereafter", attested in the 6.1 filing; 18 V.S.A. 4358(c) '
    'and 4303(a)(7) are the statutory hooks. This row previously said unclear.',
  local_preemption = false,
  venue_note =
    '18 V.S.A. 4301(a)(4)-(6), 4353(3)(C) and 4358, with the Manufactured Food Rule (final adopted, '
    'eff. 15 January 2026), read 2026-09-06. A cottage food operator "produces or packages cottage '
    'food products solely in the home kitchen of the person''s private residential dwelling or a '
    'kitchen on the person''s personal property" (4301(a)(5)). NO SALES-CHANNEL RULE EXISTS: the '
    'words internet, online, mail, retail, resale and restaurant appear zero times in the '
    'Manufactured Food Rule, so online_orders and mail_delivery are unclear rather than the '
    'summary''s allowed. retail_allowed is false on the Department''s guidance that "Food made under '
    'a license exemption cannot be sold to restaurants or other licensed food establishments" — '
    'guidance, not the rule, and flagged as such.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'VT' and ordinal = 4;

-- ---------------------------------------------------------------------------
-- The two exempt rows keep the statement — re-cited to the rule that now carries it.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_font_note =
    'Printed in at least 10-point type "in a color that provides a clear contrast to the background" '
    '(Manufactured Food Rule 6.2.1.1.7).',
  notes =
    'Vermont Health Regulations Ch. 5 Subch. 1, Manufactured Food Rule 6.2.1, "Labeling Requirements '
    'for License Exempt Food Manufacturing Establishments", final adopted, EFFECTIVE 15 JANUARY '
    '2026, read 2026-09-06. RE-CITED: the previous note attributed this list to VT Admin. Code '
    '12-5-52 6.2.1, which the new rule supersedes. The list itself survived the replacement almost '
    'unchanged — name and address of the operation, name of the food product, ingredients in '
    'descending order of predominance by weight, net weights or net volumes, allergen information '
    'per federal requirements, nutritional labelling, and the 10-point contrasting statement — so '
    'the stored elements and disclaimer are confirmed rather than altered. '
    'VERMONT IS THE ONE STATE WHERE nutrition_if_claimed IS LITERALLY THE RULE: 6.2.1.1.6 requires '
    'nutritional labelling "if any nutrient content claim, health claim, or other nutritional '
    'information is provided". Optional here, as everywhere. '
    'UNRESOLVED, AND SMALL: the stored statement ends with a full stop. The rule''s PDF renders it '
    'as a display line and the text extraction used here drops formatting runs — it also lost the '
    'words "background label" from the same sentence — so trailing punctuation could not be '
    'confirmed either way. The wording is unchanged and is not in doubt; only the final character '
    'is, and it is left as it was rather than silently added or removed. Worth an eye on the PDF '
    'before this row is signed off.',
  source_url = 'https://www.healthvermont.gov/sites/default/files/document/reg-manufactured-food.pdf',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'VT' and ordinal in (2, 4));
