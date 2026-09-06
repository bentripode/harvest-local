-- Harvest Local — North Dakota and Ohio, from N.D. Cent. Code ch. 23-09.5 and Ohio Rev. Code
-- 3715.023 and 3715.025 with Ohio Admin. Code 901:3-20, read 2026-09-06.
--
-- =========================================================================
-- 1. NORTH DAKOTA HAS TWO SEPARATE DISCLOSURE DUTIES AND WE HAD ONE
-- =========================================================================
-- 23-09.5-02(8) is the one we held, and it matched exactly: "A cottage food operator shall display a
-- consumer advisory sign at the point of sale or place a label on the cottage food product with the
-- following statement: "This product is made in a home kitchen that is not inspected by the state or
-- local health department.""
--
-- 23-09.5-02(5) is a different duty with different content: "The cottage food operator shall inform
-- the end consumer that any cottage food product or food sold under this section is not certified,
-- labeled, licensed, packaged, regulated, or inspected."
--
-- Six things there, against the one in (8), and no wording prescribed. The definition at
-- 23-09.5-01(6) turns on it — an "informed end consumer" is one "who ... has been informed the
-- cottage food product is not licensed, regulated, or inspected" — so satisfying (5) is what makes
-- the buyer the kind of person this chapter lets you sell to. The prescribed sentence in (8) does
-- not cover it: (8) says only "not inspected by the state or local health department".
--
-- So North Dakota gets both: the quoted statement in `disclaimer_text`, and `seller_statement` for
-- the (5) duty with the statute's own words as the prompt.
--
-- NORTH DAKOTA IS ALSO A PLACARD STATE. (8) offers "a consumer advisory sign at the point of sale"
-- as the alternative to a label — the same either/or shape as Idaho's, and `placard_required` was
-- false.
--
-- =========================================================================
-- 2. NORTH DAKOTA'S VENUE LIST HAS A CATCH-ALL AND ITS NOTE HAD A CLOSED LIST
-- =========================================================================
-- The note read "Farmers markets, roadside stands, festivals and from home". 23-09.5-02(2):
-- "Transactions under this section must be directly between the cottage food operator and the
-- informed end consumer and be only for home consumption. Transactions may occur at a farm, ranch,
-- farmers market, farm stand, home-based kitchen, OR ANY OTHER VENUE NOT OTHERWISE PROHIBITED BY LAW
-- OR THROUGH DELIVERY."
--
-- An open list ending in a catch-all and an express mention of delivery. Recorded properly, and
-- `direct_delivery` moves from unclear to allowed.
--
-- =========================================================================
-- 3. OHIO CONFINES ITS STATEMENT TO COTTAGE FOOD OPERATIONS, AND BOTH OUR ROWS CARRIED IT
-- =========================================================================
-- Ohio Rev. Code 3715.023(A): "A cottage food production operation and a maple syrup or sorghum
-- processor and beekeeper ... shall label each of their food products and include the following
-- information on the label of each of their food products: (1) The name and address of the business
-- of the cottage food production operation, processor, or beekeeper; (2) The name of the food
-- product; (3) The ingredients of the food product, in descending order of predominance by weight;
-- (4) The net weight and volume of the food product; (5) IN THE CASE OF A COTTAGE FOOD PRODUCTION
-- OPERATION, the following statement in ten-point type: "This product is home produced.""
--
-- (5) is expressly scoped. Our Home Bakery row carried the same statement, and a home bakery is a
-- LICENSED, INSPECTED operation rather than a cottage food production operation. This is the fourth
-- state in the pass where a second programme was carrying the first one's label — after Delaware,
-- Maryland and Nevada — and the statement is removed from that row for that reason.
--
-- The row is NOT emptied, unlike Maryland's on-farm one. Maryland's copied statement made an
-- affirmative and false claim about regulatory status ("not subject to Maryland's food safety
-- regulations") on a licensed producer's jar. Ohio's says only "This product is home produced",
-- which is true of a home bakery even though the statute does not require it of them — and the four
-- element items are the ordinary packaged-food set that a licensed bakery will owe anyway. Removing
-- the statement and flagging the rest as unverified is proportionate; refusing to print is not.
--
-- Ohio's home bakery provisions are not in this compilation, which covers 3715.023, 3715.025 and
-- OAC 901:3-20 — all cottage food. The phrase "home bakery" does not appear in it once.
--
-- 4. A FIFTH TIDIED STATEMENT. We stored "This product is home produced" and 3715.023(A)(5) quotes
-- it as "This product is home produced." — with the full stop inside the quotation marks. The
-- opposite direction from Nevada's, which had gained one.
--
-- 5. OHIO PERMITS RETAIL SALE IN TERMS, and the cottage food row's note said "Only at farmers
-- markets, events and from home". 3715.023(B): "Food products identified and labeled in accordance
-- with division (A) of this section are acceptable food products that a retail food establishment or
-- food service operation licensed under Chapter 3717. of the Revised Code may offer for sale or use
-- in preparing and serving food."
--
-- `verified_at` stays null on all five rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- North Dakota
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array['seller_statement'],
  seller_statement_prompt =
    'a statement informing the consumer that the product is not certified, labeled, licensed, '
    'packaged, regulated, or inspected (N.D. Cent. Code 23-09.5-02(5))',
  disclaimer_text = 'This product is made in a home kitchen that is not inspected by the state or local health department.',
  -- (8) offers a point-of-sale sign as the alternative to a label, the same either/or shape as Idaho.
  placard_required = true,
  placard_text = 'This product is made in a home kitchen that is not inspected by the state or local health department.',
  notes =
    'N.D. Cent. Code 23-09.5-02, read 2026-09-06. NORTH DAKOTA HAS TWO SEPARATE DISCLOSURE DUTIES '
    'AND THIS ROW HELD ONE. (8) is the one we had, and it matched exactly: "A cottage food operator '
    'shall display a consumer advisory sign at the point of sale or place a label on the cottage '
    'food product with the following statement: [the disclaimer]." That either/or is why '
    'placard_required is now true. (5) is a DIFFERENT duty with different content and no prescribed '
    'wording: "The cottage food operator shall inform the end consumer that any cottage food product '
    'or food sold under this section is not certified, labeled, licensed, packaged, regulated, or '
    'inspected." Six things against the one in (8), and the chapter turns on it — 23-09.5-01(6) '
    'defines an "informed end consumer" as one "who ... has been informed the cottage food product '
    'is not licensed, regulated, or inspected", and (2) permits transactions only with such a '
    'person. So the seller writes that one, as in Louisiana, Missouri, Montana and Nebraska. NOTHING '
    'ELSE IS REQUIRED ON THE LABEL: (1) forbids any agency from requiring "licensure, permitting, '
    'certification, inspection, packaging, or labeling", so there is no product name, ingredient '
    'list or net weight to print. STILL INEXPRESSIBLE: (7) requires a cottage food operator to label '
    'refrigerated products "such as baked goods containing cream, custard, meringue, cheesecake, '
    'pumpkin pie, and cream cheese, with safe handling instructions and a product disclosure '
    'statement indicating the product was transported and maintained frozen." That is the same '
    'handling-instructions gap Idaho has, and North Dakota is the second state to need it.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/North-Dakota.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'ND' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 23-09.5-02(2) names delivery in the venue sentence itself.
  direct_delivery = 'allowed',
  venue_note =
    'AN OPEN LIST WITH A CATCH-ALL, and the previous note ("Farmers markets, roadside stands, '
    'festivals and from home") read like a closed one. N.D. Cent. Code 23-09.5-02(2): "Transactions '
    'under this section must be directly between the cottage food operator and the informed end '
    'consumer and be only for home consumption. Transactions may occur at a farm, ranch, farmers '
    'market, farm stand, home-based kitchen, or any other venue not otherwise prohibited by law or '
    'through delivery." Delivery is named and the catch-all covers an online sale, so online_orders '
    'and mail_delivery stay allowed on the text rather than on silence. retail_allowed is false on '
    '(4): "Except for whole, unprocessed fruits and vegetables, food prepared by a cottage food '
    'operator may not be sold or used in any food establishment, food processing plant, or food '
    'store." (3)(c) additionally bars poultry products from interstate commerce.',
  category_note =
    'DELIBERATELY WIDE. 23-09.5-01(2): ""Cottage food product" means baked goods, jams, jellies, and '
    'other food and drink products produced by a cottage food operator" — open-ended, which is why '
    'cat_shelf_stable is unrestricted and acidified, low-acid canned and fermented are all allowed. '
    'REFRIGERATED FOOD IS PERMITTED AND THE STATUTE LEGISLATES ITS LABEL: 23-09.5-02(7) requires an '
    'operator to label products "that require refrigeration, such as baked goods containing cream, '
    'custard, meringue, cheesecake, pumpkin pie, and cream cheese, with safe handling instructions '
    'and a product disclosure statement indicating the product was transported and maintained '
    'frozen." MEAT IS CONDITIONAL on the poultry exception: (3) bars "the sale of uninspected '
    'products made from meat" except poultry where "(1) The cottage food operator slaughters no more '
    'than one thousand poultry raised by the cottage food operator during the calendar year; (2) The '
    'cottage food operator does not buy or sell poultry products, except products produced from '
    'poultry raised by the cottage food operator; and (3) The poultry product is not adulterated or '
    'misbranded."',
  license_note =
    'None, and the preemption is written as a prohibition on government. 23-09.5-02(1): '
    '"Notwithstanding any other provision of law, a state agency or political subdivision may not '
    'require licensure, permitting, certification, inspection, packaging, or labeling that pertains '
    'to the preparation or sale of cottage food products under this section. This section does not '
    'preclude an agency from providing assistance, consultation, or inspection, upon request, of a '
    'producer." (9) preserves investigation "upon complaint of an illness or environmental health '
    'complaint", and (6) leaves brand and animal health inspection requirements untouched. No '
    'revenue cap, training requirement or product approval appears in the chapter.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/North-Dakota.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'ND' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Ohio #1 — Cottage Food Production Operation
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight', 'net_weight'
  ],
  -- Verbatim: 3715.023(A)(5) puts the full stop inside the quotation marks.
  disclaimer_text = 'This product is home produced.',
  disclaimer_min_pt = 10,
  disclaimer_font_note = 'Ohio Rev. Code 3715.023(A)(5) requires the statement "in ten-point type".',
  notes =
    'Ohio Rev. Code 3715.023(A), read 2026-09-06: an operation "shall label each of their food '
    'products and include the following information on the label of each of their food products: '
    '(1) The name and address of the business of the cottage food production operation, processor, '
    'or beekeeper; (2) The name of the food product; (3) The ingredients of the food product, in '
    'descending order of predominance by weight; (4) The net weight AND volume of the food product; '
    '(5) In the case of a cottage food production operation, the following statement in ten-point '
    'type: "This product is home produced."" THE STATEMENT WAS MISSING ITS FULL STOP, which the '
    'statute puts inside the quotation marks — the fifth such correction in this pass, and the '
    'opposite direction from Nevada''s, which had gained one. (4) asks for weight AND volume, not '
    'either, so a seller should check the printed label against the statute the way Kentucky''s must. '
    'nutrition_if_claimed was on this row and is not in the statutory list; it is removed, though '
    'federal labelling reaches the seller independently. Ohio requires no allergen declaration of '
    'its own either. A REFRIGERATED BAKED GOOD ALSO NEEDS "Keep Refrigerated" per the previous note, '
    'which is not in 3715.023 and has not been located in the sections read.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Ohio.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'OH' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 3715.025(A) names acidified and low-acid canned foods; fermented food is not among them.
  cat_fermented = 'unclear',
  venue_note =
    'RETAIL SALE IS PERMITTED IN TERMS, and the previous note said "Only at farmers markets, events '
    'and from home". Ohio Rev. Code 3715.023(B): "Food products identified and labeled in accordance '
    'with division (A) of this section are acceptable food products that a retail food establishment '
    'or food service operation licensed under Chapter 3717. of the Revised Code may offer for sale '
    'or use in preparing and serving food." That is why retail_allowed is true. Online selling is '
    'not mentioned in 3715.023, 3715.025 or the parts of OAC 901:3-20 read here; online_orders and '
    'mail_delivery stay allowed on that silence plus the absence of any venue restriction, which is '
    'an inference rather than an express permission.',
  category_note =
    'A STATUTORY LIST PLUS RULES, WITH THREE EXPRESS PROHIBITIONS. Ohio Rev. Code 3715.025(A): "A '
    'cottage food production operation shall not process acidified foods, low acid canned foods, or '
    'potentially hazardous foods." That is cat_acidified, cat_low_acid_canned and cat_refrigerated, '
    'all three stated rather than assumed. (B) directs the director of agriculture to adopt rules '
    '"specifying the food items a cottage food production operation may produce that are in addition '
    'to the food items identified by name in division (A)(19) of section 3715.01", and forbids rules '
    'permitting "any food that is a potentially hazardous food" — hence cat_shelf_stable = '
    'list_only. FERMENTED FOOD IS NOT NAMED in either the prohibition or the sections read, and a '
    'fermented food that is neither acidified nor potentially hazardous is not obviously excluded, '
    'so it moves from banned to unclear.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Ohio.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'OH' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Ohio #2 — Home Bakery (licensed; provisions NOT in this compilation)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight', 'net_weight'
  ],
  -- 3715.023(A)(5) confines the statement to "the case of a cottage food production operation".
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_font_note = null,
  notes =
    'THE COTTAGE FOOD STATEMENT HAS BEEN REMOVED FROM THIS ROW. Ohio Rev. Code 3715.023(A)(5) '
    'requires "This product is home produced." only "In the case of a cottage food production '
    'operation", and a home bakery is a LICENSED, INSPECTED operation rather than a cottage food '
    'production operation. This row was carrying the neighbouring programme''s statement — the '
    'fourth time in this pass, after Delaware, Maryland and Nevada. THE ROW IS NOT EMPTIED, unlike '
    'Maryland''s on-farm one: Maryland''s copied statement made an affirmative and false claim about '
    'regulatory status on a licensed producer''s jar, whereas "This product is home produced" is '
    'true of a home bakery even though the statute does not require it of them, and the five '
    'elements kept here are the ordinary packaged-food set a licensed bakery will owe anyway. '
    'Removing the statement and flagging the rest is proportionate; refusing to print is not. '
    'NOTHING ON THIS ROW IS VERIFIED FOR THIS PROGRAMME. Ohio''s home bakery provisions are not in '
    'the National Agricultural Law Center compilation, which carries 3715.023, 3715.025 and OAC '
    '901:3-20 — all cottage food. The phrase "home bakery" does not appear in it once. An admin '
    'should read Ohio''s bakery licensing law before treating this row as checked.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Ohio.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'OH' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'NOT VERIFIED. The note here ("No restrictions") is the summary''s, and Ohio''s home bakery '
    'provisions are not in the compilation read on 2026-09-06, which covers only the cottage food '
    'sections. What IS known from the cottage food side is that 3715.023(B) lets a licensed retail '
    'food establishment offer cottage food products for sale — a home bakery is licensed and '
    'inspected, so its position is at least as permissive, but that is an inference and not a '
    'reading. Every other flag on this row still rests on the summary.',
  category_note =
    'NOT VERIFIED for this programme. Ohio Rev. Code 3715.025(A) — "A cottage food production '
    'operation shall not process acidified foods, low acid canned foods, or potentially hazardous '
    'foods" — is directed at COTTAGE FOOD OPERATIONS and does not by its terms reach a licensed home '
    'bakery, which is why cat_refrigerated is allowed here and banned on the other row. The values '
    'here are the summary''s and are plausible for a bakery; they have not been checked against '
    'Ohio''s bakery licensing law, which is not in this compilation.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Ohio.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'OH' and ordinal = 2 and verified_at is null;
