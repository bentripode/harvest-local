-- Harvest Local — Michigan, from Mich. Comp. Laws 289.1105(1)(j)-(k) and 289.4102, read 2026-09-06.
--
-- =========================================================================
-- 1. THE DISCLAIMER WE HOLD IS A TIDIED-UP VERSION OF THE STATUTE'S
-- =========================================================================
-- We stored: "Made in a home kitchen that has not been inspected by the Michigan Department of
-- Agriculture & Rural Development."
--
-- 289.4102(3)(g) requires: "Made in a home kitchen that has not been inspected by the Michigan
-- department of agriculture and rural development."
--
-- Lower case, and "and" rather than "&". Somebody — probably me, copying from a summary — smartened
-- up the agency's name. `disclaimer_text` is the one column in this schema that is quoted law
-- printed onto food as-is, so the difference between "and" and "&" is exactly the kind of drift it
-- exists to prevent, however harmless this particular instance looks. Restored verbatim.
--
-- The element list was missing (f), nutrition where a claim is made. Everything else matched.
--
-- =========================================================================
-- 2. THE ONLINE BAN IS CONFIRMED, AND IT IS NOT ALONE
-- =========================================================================
-- 289.4102(4), in full: "Cottage food products may be sold directly from the cottage food operation
-- to the consumer only, and not by internet or mail order. Sales by consignment or at wholesale are
-- prohibited."
--
-- Express, and exactly what 20260906030000 recorded — Michigan stays one of the five states where
-- our gate blocks food listings outright. Note the sentence bans four things, not one: internet,
-- mail order, consignment and wholesale.
--
-- =========================================================================
-- 3. THE CAP IS RIGHT, AND IS COUNTED PER HOUSE RATHER THAN PER PERSON
-- =========================================================================
-- 289.4102(5): "...After December 31, 2017, the gross sales of cottage food products by a cottage
-- food operation shall not exceed $25,000.00 annually. For the purposes of this subsection, gross
-- sales shall be computed on the basis of the amount of gross sales within or at a particular
-- domestic residence and shall not be computed on a per-person basis within or at that domestic
-- residence."
--
-- $25,000 matches. The per-residence rule is worth recording because our tracking is per seller
-- profile: two people running cottage food operations from the same house share one cap in Michigan,
-- and nothing here would notice.
--
-- =========================================================================
-- 4. TWO CATEGORY BANS ARE REALLY EXCEPTIONS
-- =========================================================================
-- 289.1105(1)(k): ""Cottage food product" means a food that is not potentially hazardous food as
-- that term is defined in the food code. Examples of cottage food product include, but are not
-- limited to, jams, jellies, dried fruit, candy, cereal, granola, dry mixes, VINEGAR, dried herbs,
-- and baked goods that do not require temperature control for safety. Cottage food product does not
-- include any potentially hazardous food regulated under 21 CFR parts 113 and 114, examples of which
-- include, but are not limited to, meat and poultry products; salsa; milk products; bottled water
-- and other beverages; and home-produced ice products. Cottage food product also does not include
-- canned low-acid fruits or acidified vegetables and other canned foods EXCEPT FOR JAMS, JELLIES,
-- AND PRESERVES as defined in 21 CFR part 150."
--
-- `cat_acidified` was a flat ban. It is not: acidified vegetables are out, but jams, jellies and
-- preserves are expressly in, and vinegar is named as an example of a permitted product. That is
-- `conditional`. `cat_fermented` was banned on nothing at all — vinegar is a fermented product and
-- is named as permitted, while a fermented vegetable might or might not fall within the "acidified
-- vegetables" exclusion depending on how it is made, which the statute does not resolve. Also
-- `conditional`, with the uncertainty stated rather than buried.
--
-- Meat and low-acid canned goods stay banned, both by name.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  -- Verbatim from 289.4102(3)(g): lower case, and "and" rather than "&".
  disclaimer_text = 'Made in a home kitchen that has not been inspected by the Michigan department of agriculture and rural development.',
  disclaimer_min_pt = 11,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'Mich. Comp. Laws 289.4102(3)(g) requires the statement "printed in at least the equivalent of '
    '11-point font size in a color that provides a clear contrast to the background".',
  notes =
    'Mich. Comp. Laws 289.4102(3), read 2026-09-06: "At a minimum, a cottage food operation shall '
    'place on the label of any food it produces or packages the following information: (a) The name '
    'and address of the business of the cottage food operation. (b) The name of the cottage food '
    'product. (c) The ingredients of the cottage food product, in descending order of predominance '
    'by weight. (d) The net weight or net volume of the cottage food product. (e) Allergen labeling '
    'as specified by federal labeling requirements. (f) If any nutritional claim is made, '
    'appropriate labeling as specified by federal labeling requirements. (g) [the statement]." (f) '
    'was missing and has been added. THE STATEMENT WAS NOT VERBATIM: we held "the Michigan '
    'Department of Agriculture & Rural Development", where the statute reads "the Michigan '
    'department of agriculture and rural development" — lower case, and "and" not "&". Somebody '
    'tidied up the agency''s name in a column that exists to hold quoted law printed onto food '
    'as-is. Restored. 289.4102(2) also requires products to be "prepackaged and properly labeled '
    'prior to sale", and (6) that they "be stored only in the primary domestic residence".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Michigan.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MI' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- Jams, jellies and preserves are expressly in, and vinegar is a named example; only acidified
  -- vegetables are out.
  cat_acidified = 'conditional',
  -- Vinegar is named as permitted; a fermented vegetable may or may not be an "acidified vegetable".
  cat_fermented = 'conditional',
  -- The statute bans internet, mail order, consignment and wholesale. Handing food to a consumer at
  -- their door is none of those and is a direct sale from the operation to the consumer.
  direct_delivery = 'allowed',
  venue_note =
    'EXPRESS PROHIBITION, and it bans four things rather than one. Mich. Comp. Laws 289.4102(4): '
    '"Cottage food products may be sold directly from the cottage food operation to the consumer '
    'only, and not by internet or mail order. Sales by consignment or at wholesale are prohibited." '
    'That is why online_orders and mail_delivery are banned and retail_allowed is false. Direct '
    'delivery is recorded as allowed because it is none of the four and is a direct sale from the '
    'operation to the consumer — the statute does not address it in terms. 289.4102(6) adds that '
    'products "shall be stored only in the primary domestic residence". LOCAL LAW IS EXPRESSLY NOT '
    'PREEMPTED — (7): "An exemption under this section does not affect the application of any other '
    'state or federal laws or any applicable ordinances enacted by any local unit of government."',
  cap_note =
    'PER HOUSE, NOT PER PERSON — worth knowing, because our revenue tracking is per seller profile '
    'and would not notice. 289.4102(5): "After December 31, 2017, the gross sales of cottage food '
    'products by a cottage food operation shall not exceed $25,000.00 annually. For the purposes of '
    'this subsection, gross sales shall be computed on the basis of the amount of gross sales within '
    'or at a particular domestic residence and shall not be computed on a per-person basis within or '
    'at that domestic residence. The department may request in writing documentation to verify the '
    'annual gross sales figure." Two people running cottage food operations from one house share one '
    '$25,000 cap in Michigan.',
  category_note =
    'AN OPEN EXAMPLE LIST WITH NAMED EXCLUSIONS, and two of our bans were really exceptions. '
    '289.1105(1)(k): ""Cottage food product" means a food that is not potentially hazardous food as '
    'that term is defined in the food code. Examples of cottage food product include, but are not '
    'limited to, jams, jellies, dried fruit, candy, cereal, granola, dry mixes, vinegar, dried '
    'herbs, and baked goods that do not require temperature control for safety. Cottage food product '
    'does not include any potentially hazardous food regulated under 21 CFR parts 113 and 114, '
    'examples of which include, but are not limited to, meat and poultry products; salsa; milk '
    'products; bottled water and other beverages; and home-produced ice products. Cottage food '
    'product also does not include canned low-acid fruits or acidified vegetables and other canned '
    'foods except for jams, jellies, and preserves as defined in 21 CFR part 150." So acidified is '
    'conditional rather than banned — acidified VEGETABLES are out, jams, jellies and preserves are '
    'expressly in, and vinegar is a named permitted example. Fermented is conditional too and was '
    'previously banned on nothing: vinegar is fermented and named as permitted, while a fermented '
    'vegetable may or may not be an "acidified vegetable" depending on how it is made, which the '
    'statute does not resolve. Meat and low-acid canned goods are banned by name. Salsa, milk, '
    'bottled beverages and ice are also excluded and have no axis here.',
  license_note =
    'Exempt from licensing, but not from the law. 289.4102(1): "A cottage food operation is exempt '
    'from the licensing and evaluation provisions of this act. This exemption does not include an '
    'exemption from the adulteration and other standards imposed in this section or under this act, '
    'or both, and does not limit the ability of the department to take appropriate enforcement '
    'action for applicable violations as described in section 5101. This subsection does not require '
    'a cottage food operation to meet the standards contained in 21 CFR part 110 or the food code." '
    '289.1105(1)(j) defines the operation as "a person who produces or packages cottage food '
    'products only in a kitchen of that person''s primary domestic residence within this state". No '
    'training and no product approval appear in either section.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Michigan.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MI' and ordinal = 1 and verified_at is null;
