-- Harvest Local — Maine, from 01-001-345 Me. Code R. §§ 1-8 and Me. Stat. tit. 7 §§ 281-286 (the
-- Maine Food Sovereignty Act), read 2026-09-06.
--
-- =========================================================================
-- 1. I TRUNCATED THE FOOD SOVEREIGNTY DEFINITION, AND THE TRUNCATION FLATTERED MY CONCLUSION
-- =========================================================================
-- The venue note on the Food Sovereignty row quoted 7 M.R.S. 282(1) as reaching an exchange
-- "on the property or premises owned, leased or rented by the food producer; at roadside stands,
-- fundraisers, farmers' markets and community" — and stopped there. The definition does not stop
-- there. In full:
--
--   "Direct producer-to-consumer transaction" means an exchange of food or food products directly
--   between a food producer and a consumer by barter, trade or purchase on the property or premises
--   owned, leased or rented by the food producer; at roadside stands, fundraisers, farmers' markets
--   and community social events; OR THROUGH BUYING CLUBS, DELIVERIES OR COMMUNITY-SUPPORTED
--   AGRICULTURE PROGRAMS, HERD-SHARE AGREEMENTS AND OTHER PRIVATE ARRANGEMENTS.
--
-- Cutting a list off mid-item made it look exhaustive and physical when its last clause is open and
-- includes deliveries. That is precisely the failure this pass exists to catch, and it was mine.
--
-- The conclusion survives, for a reason that now has to be argued rather than assumed. "Other
-- private arrangements" takes its colour from the things beside it — buying clubs, community-
-- supported agriculture, herd shares — all closed, membership-like arrangements between people who
-- know who they are dealing with. A public storefront open to any buyer in the state is not one. So
-- online selling still falls outside the Act rather than inside it, and `online_orders` stays
-- `banned` for this programme.
--
-- But `direct_delivery` was wrong: "deliveries" is named in the definition, so it becomes `allowed`.
-- And `mail_delivery` was `banned` on the truncated reading; "deliveries" is unqualified and may
-- well cover the post, so it becomes `unclear` rather than asserted either way.
--
-- =========================================================================
-- 2. HOME FOOD MANUFACTURING PERMITS REFRIGERATED FOOD — IT LEGISLATES THE TEMPERATURE
-- =========================================================================
-- `cat_refrigerated` was banned on the licensed route. 01-001-345-6(A): "Potentially hazardous foods
-- shall be refrigerated at a temperature of 45°F or below. Frozen foods to be kept at a temperature
-- of 0°F or below."
--
-- The rule does not prohibit potentially hazardous food. It tells you how cold to keep it. And
-- 345-1(G) defines the term by example — "cream fillings in pies, cakes or pastries; custard
-- products; meringue topped bakery products; or butter cream type fillings in bakery products" —
-- which are exactly the things a home baker sells. Corrected to allowed.
--
-- The one express food prohibition in the whole chapter is 345-6(D): "Home canned foods that require
-- pressure cooking for sealing shall not be sold." That is `cat_low_acid_canned = banned`, and it is
-- the only one. `cat_meat` and `cat_fermented` were banned on nothing and become `unclear` — meat in
-- particular is regulated outside this chapter (Title 22, chapter 562-A), which has not been read,
-- so `allowed` would be as unfounded as `banned`.
--
-- =========================================================================
-- 3. THE LABEL, AND WHETHER A MARKETPLACE ORDER NEEDS ONE
-- =========================================================================
-- 01-001-345-7: "When products are sold to stores, sold wholesale for further distribution, or
-- RETAILED BY ANY MANNER OF PUBLIC MARKETING, each individual item shall bear a label showing; A.
-- The common or usual name of the product. B. Ingredients in order of predominance. C. Net weight or
-- numerical count. D. The name and address of the producer, manufacturer or distributor and zip
-- code. When sold directly to a consumer from the home, the product does not require a label."
--
-- The element list was already right, and the exemption at the end is the interesting part. A
-- listing on this marketplace is retailing "by any manner of public marketing", so the label is
-- required — INCLUDING where the buyer collects from the seller's door, because the exemption turns
-- on how the sale was made and not on where the food changes hands. The previous note said the
-- exemption existed without saying which side of it a marketplace order falls, which is the only
-- question a Maine seller reading it actually has.
--
-- Note (B) says "in order of predominance" without adding "by weight", so the element used is
-- fractionally stricter than the rule. No disclaimer and no allergen declaration are required.
--
-- =========================================================================
-- 4. RECIPE APPROVAL WAS ASSERTED
-- =========================================================================
-- `recipe_approval` was `conditional` on the licensed route. Nothing in §§ 1 through 8 requires a
-- recipe or a product to be approved: the licence turns on an inspection of the premises, not on
-- what is made in them. Corrected to `no`, with the limit of the reading recorded.
--
-- `verified_at` stays null on all four rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Programme 1 — Maine Home Food Manufacturing (01-001-345 Me. Code R.)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'net_weight', 'producer_name', 'producer_address'
  ],
  disclaimer_text = null,
  notes =
    '01-001-345-7 Me. Code R., read 2026-09-06: "When products are sold to stores, sold wholesale '
    'for further distribution, or retailed by any manner of public marketing, each individual item '
    'shall bear a label showing; A. The common or usual name of the product. B. Ingredients in order '
    'of predominance. C. Net weight or numerical count. D. The name and address of the producer, '
    'manufacturer or distributor and zip code. When sold directly to a consumer from the home, the '
    'product does not require a label." A MARKETPLACE ORDER NEEDS A LABEL: a listing here is '
    'retailing "by any manner of public marketing", and that stays true when the buyer collects from '
    'the seller''s door, because the exemption turns on how the sale was made rather than on where '
    'the food changes hands. The previous note recorded the exemption without answering that, which '
    'is the only question a Maine seller has. NO DISCLAIMER AND NO ALLERGEN DECLARATION are required '
    '— Maine prescribes no statement at all, which is why disclaimer_text is null rather than '
    'unrecorded. (B) asks for ingredients "in order of predominance" without adding "by weight", so '
    'the element used is fractionally stricter than the rule; (D) expressly wants the zip code, '
    'which our formatted address carries.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maine.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'ME' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 345-6(A) tells you what temperature to hold potentially hazardous food at; it does not ban it.
  cat_refrigerated = 'allowed',
  -- Banned on nothing. Meat is regulated outside this chapter, so allowed would be as unfounded.
  cat_meat = 'unclear',
  cat_fermented = 'unclear',
  -- The chapter licenses premises, not recipes.
  recipe_approval = 'no',
  -- 345-1(E) covers sale "directly to the consumer or through other distribution methods".
  direct_delivery = 'allowed',
  venue_note =
    'BROAD BY DEFINITION, and the row previously said "No restrictions" without a citation. '
    '01-001-345-1(E): ""Home food manufacturing" means an establishment in the home in which food is '
    'processed or otherwise prepared and packaged for human consumption and offered for sale '
    'directly to the consumer OR THROUGH OTHER DISTRIBUTION METHODS." 345-7 then contemplates '
    'products "sold to stores, sold wholesale for further distribution, or retailed by any manner of '
    'public marketing", which is why retail_allowed is true. Online selling is not named anywhere in '
    'the chapter; online_orders stays allowed on that breadth plus the absence of any venue '
    'restriction, which is an inference from a permissive frame rather than an express permission '
    'like Indiana''s or Florida''s.',
  category_note =
    'ONE EXPRESS PROHIBITION IN THE WHOLE CHAPTER. 01-001-345-6(D): "Home canned foods that require '
    'pressure cooking for sealing shall not be sold" — that is the low-acid canned ban, and nothing '
    'else is forbidden by food type. REFRIGERATED FOOD IS PERMITTED, not banned: 345-6(A) says '
    '"Potentially hazardous foods shall be refrigerated at a temperature of 45°F or below. Frozen '
    'foods to be kept at a temperature of 0°F or below", and 345-1(G) defines potentially hazardous '
    'food by example as including "cream fillings in pies, cakes or pastries; custard products; '
    'meringue topped bakery products; or butter cream type fillings in bakery products" — the staples '
    'of a home bakery. Meat and fermented food are addressed nowhere in the chapter and are '
    'unclear rather than banned; meat is separately governed by Title 22, chapter 562-A, which has '
    'not been read. 345-6(C) also limits packaging: "Only new glass containers, or home canning '
    'glass containers designed and intended for reuse, shall be used ... Reusable containers shall '
    'be sanitized prior to reuse. Seals shall not be reused."',
  license_note =
    'An annual licence, and an inspection before every issue and renewal. 01-001-345-8(A): '
    '"Application for approval for Home Food Manufacturing shall be filed annually with the '
    'Department of Agriculture, Food And Rural Resources", with the fee set by Chapter 330. (B): '
    '"Before a license is issued or renewed the Department shall inspect the premises of the '
    'applicant", the commissioner issuing within 30 days where the applicant complies, and otherwise '
    'a temporary licence of up to 90 days for corrections or a conditional one. No revenue cap '
    'appears anywhere in the chapter. Other standing duties worth knowing: 345-5(A) requires "an '
    'adequate supply of hot and cold water under pressure" and "A two bay sink made of corrosion '
    'resistant material"; 345-5(B), "Private water supplies shall be tested yearly"; 345-3(B), '
    'screens on all doors and windows in the preparation area; and 345-5(C), sanitising by 170°F '
    'immersion, 50ppm chlorine or 12.5ppm iodine. NO RECIPE OR PRODUCT APPROVAL appears in §§ 1-8: '
    'the licence turns on the premises, not on what is made in them.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maine.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'ME' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Programme 2 — Maine Food Sovereignty (7 M.R.S. 281-286)
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  -- "deliveries" is named in the definition; banning it rested on my truncated quotation.
  direct_delivery = 'allowed',
  mail_delivery = 'unclear',
  mail_note =
    '"Deliveries" is inside the 7 M.R.S. 282(1) definition and is unqualified, so the post may well '
    'be one. Previously banned, on a quotation of that definition which had been cut off before the '
    'clause that contains the word.',
  venue_note =
    'AN OPEN-ENDED DEFINITION, NOT AN EXHAUSTIVE VENUE LIST — and the note here previously quoted it '
    'truncated, which made it look like one. 7 M.R.S. 282(1) in full: ""Direct producer-to-consumer '
    'transaction" means an exchange of food or food products directly between a food producer and a '
    'consumer by barter, trade or purchase on the property or premises owned, leased or rented by '
    'the food producer; at roadside stands, fundraisers, farmers'' markets and community social '
    'events; or through buying clubs, deliveries or community-supported agriculture programs, '
    'herd-share agreements and other private arrangements." ONLINE SELLING STILL FALLS OUTSIDE IT, '
    'but the argument has to be made rather than assumed: "other private arrangements" takes its '
    'colour from what sits beside it — buying clubs, community-supported agriculture, herd shares — '
    'all closed, membership-like arrangements between people who know whom they are dealing with. A '
    'public storefront open to any buyer in the state is not one. A seller wanting to sell online is '
    'on the licensed Home Food Manufacturing route instead. Note also that this Act only operates '
    'where a municipality has acted: 7 M.R.S. 284 lets a municipality or plantation "adopt ordinances '
    'regarding direct producer-to-consumer transactions and the State shall recognize such ordinances '
    'by not enforcing those laws or implementing rules with respect to those direct '
    'producer-to-consumer transactions that are governed by the ordinance."',
  category_note =
    'Deliberately wide, and wider than the licensed route. 7 M.R.S. 282(2): ""Food or food products" '
    'means food or food products that are grown, produced, processed or prepared for human '
    'consumption, including, but not limited to, vegetables, fruit, milk or milk products, meat or '
    'meat products, poultry or poultry products, fish or fish products, seafood or seafood products, '
    'cider or juice, acidified foods or canned fruits or vegetables." An open list ("including, but '
    'not limited to"), which is why cat_shelf_stable is unrestricted. MEAT AND POULTRY ARE THE '
    'CARVE-OUT and stay conditional: 7 M.R.S. 285 provides that "Notwithstanding any provision in '
    'this chapter to the contrary, the department shall implement and enforce all provisions of '
    'Title 22, chapter 562-A and the rules adopted" thereunder — so the Act''s local-ordinance '
    'displacement does not reach livestock and poultry. Fish and seafood are named as permitted food '
    'products but have no axis here.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maine.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'ME' and ordinal = 2 and verified_at is null;
