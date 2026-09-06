-- Harvest Local — the District of Columbia, from D.C. Code 7-742.01 and 7-742.02, read 2026-09-06
-- at code.dccouncil.gov.
--
-- The District is the first jurisdiction in this pass whose statute NAMES online selling as
-- permitted, in the definition itself. 7-742.01(3): a cottage food product is a non-potentially
-- hazardous food "that is sold to consumers, including through direct, retail, wholesale to
-- licensed food establishments, and online sales, within the District of Columbia".
--
-- Our row had `online_orders = 'allowed'` already, from the summary. It is now allowed on the
-- strength of the statute — which matters, because a summary can be wrong in that direction too
-- (Washington was seeded as allowed and bans it outright).
--
-- =========================================================================
-- 1. THE VENUE NOTE DESCRIBED A DIFFERENT JURISDICTION'S RULE
-- =========================================================================
-- It read "Only at farmers markets and public events" and `retail_allowed` was false. The statute
-- says the opposite: retail and wholesale to licensed food establishments are both inside the
-- definition of a cottage food product. Nothing in 7-742.02 confines sales to markets or events.
-- The one locational constraint is 7-742.02(c)(1) — products must be "Stored on the premises of the
-- cottage food business" — and the one geographic one is "within the District of Columbia".
--
-- =========================================================================
-- 2. INSPECTION IS DISCRETIONARY, NOT REQUIRED
-- =========================================================================
-- `inspection_required` was true. 7-742.02(b)(2): "The Department MAY perform an inspection of the
-- cottage food business before that business may sell its cottage food products." May, not shall,
-- and (b)(4) grants the authority to enter rather than imposing a duty to. A seller reading our
-- onboarding should not be told to expect an inspection the law does not require.
--
-- =========================================================================
-- 3. THE DISCLAIMER HAD A FULL STOP THE STATUTE DOES NOT
-- =========================================================================
-- 7-742.02(c)(2)(G) quotes the sentence and closes the quotation before any punctuation: "Made by a
-- cottage food business that is not subject to the District of Columbia's food safety regulations"
-- (printed in 10-point or larger type in contrasting color). `disclaimer_text` is printed as-is and
-- is the one field in this schema that must match the law character for character, so the added
-- period comes off. The element list was already exactly right — all six of (c)(2)(A) through (F),
-- in the statute's own order.
--
-- =========================================================================
-- 4. TWO CATEGORY AXES AND THE TRAINING FLAG RESTED ON AN UNREAD REGULATION
-- =========================================================================
-- The Code does not list permitted foods. 7-742.02(b)(3) delegates that: a registered business may
-- sell the products "on the approved food products list issued by the Department, set forth in
-- section 103.5 of Title 25-K of the District of Columbia Municipal Regulations (25-K DCMR 103.5)",
-- and "shall not produce, package, or sell any food products that are not allowed by the Department
-- nor use any processes and activities that are not allowed by the Department."
--
-- 25-K DCMR 103.5 is not reachable as text from dcregs.dc.gov — the chapter listing links to a
-- document viewer rather than the rule — so it has NOT been read. What the Code alone supports is
-- the definitional limit to "non-potentially hazardous food", which squarely excludes refrigerated
-- items, meat and low-acid canned goods. It does not exclude acidified or fermented foods: a pickle
-- below pH 4.6 and a jar of sauerkraut are not potentially hazardous, so those two axes were banned
-- on nothing and become `unclear` until someone reads 103.5. Same for `training_required`, which
-- was `no`: the Code imposes none, but the Code is not where operating conditions live here.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'permit_number', 'product_name', 'ingredients_desc_by_weight', 'net_weight',
    'allergens', 'nutrition_if_claimed'
  ],
  -- Verbatim, and the statute closes its quotation before the punctuation.
  disclaimer_text = 'Made by a cottage food business that is not subject to the District of Columbia''s food safety regulations',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'D.C. Code 7-742.02(c)(2)(G): "(printed in 10-point or larger type in contrasting color)".',
  notes =
    'D.C. Code 7-742.02(c), read 2026-09-06. Sales are confined to products "Stored on the premises '
    'of the cottage food business" and "Prepackaged with a label that contains the following '
    'information: (A) The cottage food business identification number; (B) The name of the cottage '
    'food product; (C) The ingredients of the cottage food product in descending order of the '
    'amount of each ingredient by weight; (D) The net weight or net volume of the cottage food '
    'product; (E) Allergen information as specified by federal labeling requirements; (F) If any '
    'nutritional claim is made, nutritional information as specified by federal labeling '
    'requirements; and (G) [the disclaimer]". The element list was already correct and is left as '
    'it was, in the statute''s order. THE ONLY CHANGE IS A FULL STOP: the disclaimer carried one '
    'that (G) does not, and disclaimer_text is printed as-is. Note the permit_number element here '
    'is the "cottage food business identification number" from the CFBR, not a licence.',
  source_url = 'https://code.dccouncil.gov/us/dc/council/code/sections/7-742.02',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'DC' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 7-742.01(3) puts retail and wholesale inside the definition of a cottage food product.
  retail_allowed = true,
  -- "direct ... and online sales" are both named; delivering an online order to a District address
  -- is how such a sale completes, and no provision confines sales to a venue.
  direct_delivery = 'allowed',
  -- Not addressed either way. Allowed-on-silence is the same error as banned-on-silence.
  mail_delivery = 'unclear',
  mail_note =
    'The Code does not mention mail order. It permits sale "through direct, retail, wholesale to '
    'licensed food establishments, and online sales, within the District of Columbia" '
    '(7-742.01(3)); whether the post is one of those is not answered by the text read here.',
  -- 7-742.02(b)(2) says the Department MAY inspect, not that it shall.
  inspection_required = false,
  -- Banned on nothing: non-potentially-hazardous does not exclude either. See 25-K DCMR 103.5.
  cat_acidified = 'unclear',
  cat_fermented = 'unclear',
  -- The Code imposes no training. It is also not where DC keeps operating conditions.
  training_required = 'unclear',
  training_note =
    'D.C. Code 7-742.01 and 7-742.02 impose no food safety training requirement. That is not the '
    'same as there being none: 25-K DCMR carries the operating detail and has not been read.',
  venue_note =
    'EXPRESSLY PERMITTED, INCLUDING ONLINE — this row previously said "Only at farmers markets and '
    'public events", which is not in the statute. D.C. Code 7-742.01(3) defines a cottage food '
    'product as a non-potentially hazardous food "that is sold to consumers, including through '
    'direct, retail, wholesale to licensed food establishments, and online sales, within the '
    'District of Columbia in accordance with 7-742.02 and regulations adopted by the Department of '
    'Health." The only locational limits are 7-742.02(c)(1), products must be "Stored on the '
    'premises of the cottage food business", and the District boundary itself.',
  category_note =
    'The Code names no foods. 7-742.02(b)(3) delegates the list: a registered business may "produce, '
    'package, and sell the temperature control for safety food products on the approved food '
    'products list issued by the Department, set forth in section 103.5 of Title 25-K of the '
    'District of Columbia Municipal Regulations (25-K DCMR 103.5)", and "shall not produce, '
    'package, or sell any food products that are not allowed by the Department nor use any '
    'processes and activities that are not allowed by the Department." 25-K DCMR 103.5 HAS NOT BEEN '
    'READ — dcregs.dc.gov serves the chapter through a document viewer rather than as text. The '
    'axes below therefore rest only on the definitional limit in 7-742.01(3) to "a non-potentially '
    'hazardous food", which excludes refrigerated items, meat and low-acid canned goods but does '
    'NOT exclude acidified or fermented foods — a pickle below pH 4.6 is not potentially hazardous. '
    'Those two are unclear until 103.5 is read.',
  license_note =
    'Registration plus a separate permit, not a food licence. 7-742.02(b)(1): "A cottage food '
    'business shall register with the Cottage Food Business Registry within the Department before '
    'beginning operation", and (b)(3) the Department "shall issue a cottage food business '
    'identification number and certificate" — the number that goes on every label. Separately, '
    '7-742.01(2)(D) requires the business to have "obtained a home occupancy permit from the '
    'Department of Consumer and Regulatory Affairs pursuant to section 203 of Title 11 of the '
    'District of Columbia Municipal Regulations (11 DCMR Section 203)". 7-742.02(a)(1) excludes a '
    'food establishment that must hold a Department licence, and (a)(2) preserves tax obligations. '
    'No revenue cap: the $25,000 limit was repealed by the Cottage Food Expansion Amendment Act of '
    '2019 (D.C. Law 23-61).',
  recipe_note =
    'Product approval rather than recipe approval, and it is the Department''s list that governs: '
    '7-742.02(b)(3) authorises sale of the products on the 25-K DCMR 103.5 list and forbids any '
    'food "not allowed by the Department" or any "processes and activities that are not allowed by '
    'the Department".',
  source_url = 'https://code.dccouncil.gov/us/dc/council/code/sections/7-742.02',
  source_checked_at = '2026-09-06'
where state_code = 'DC' and ordinal = 1 and verified_at is null;
