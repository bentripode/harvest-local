-- Harvest Local — Maryland, from Md. Code, Health-Gen. § 21-330.1 and Md. Code Regs. 10.15.03.27,
-- read 2026-09-06.
--
-- =========================================================================
-- 1. THE $50,000 CAP IS NOT IN MARYLAND'S LAW
-- =========================================================================
-- § 21-330.1 was read in full, (a) through (i), and COMAR 10.15.03.27 A, B and C. Neither contains a
-- revenue figure of any kind. The $50,000 on this row came from the summary.
--
-- That matters more than an ordinary wrong field, because `record_order_revenue` PAUSES a storefront
-- the moment its yearly gross crosses `revenue_cap`. An invented cap is a guardrail firing on a
-- number nobody checked — the same hazard `/admin/states` warns about for the seeded
-- `state_cottage_food_rules` figures — and here it would have shut a lawful Maryland seller's shop
-- at a threshold their legislature never set. Set to null, with the sections read recorded so the
-- next reader knows exactly how far the search went.
--
-- The $40,000 on the On-Farm Home Processing row is left ALONE. Its regulation, COMAR 10.15.04.19A,
-- is not in this compilation and has not been read, so there is no evidence either way; removing the
-- figure would be as unfounded as keeping it, and it is flagged instead.
--
-- =========================================================================
-- 2. THE VENUE LIST IS CLOSED, AND WHERE THAT LEAVES US IS GENUINELY UNCERTAIN
-- =========================================================================
-- COMAR 10.15.03.27 A: "A cottage food business may offer for sale the homemade foods specified in B
-- of this regulation when the foods are: (1) Made in a private home kitchen; and (2) Offered or sold
-- only in the State: (a) Subject to the requirements of C(6) and (7) of this regulation, at a retail
-- food store; or (b) Directly to a consumer: (i) At a farmer's market; (ii) At a bake sale; (iii) At
-- a public event; (iv) By personal delivery; or (v) By mail order".
--
-- Five direct-to-consumer channels, closed, and the internet is not among them. But unlike Delaware
-- or Washington, two of the five are the ways an online order is actually completed:
--
--   BY PERSONAL DELIVERY (iv). A Maryland order placed here and driven round by the seller is a
--   personal delivery. This is the strongest reading available and it covers our delivery flow.
--   BY MAIL ORDER (v). "Mail order" is the historical term for ordering remotely and receiving by
--   post; an internet order posted to the buyer is its modern form.
--   PICKUP IS THE WEAK CASE. A buyer collecting from the seller's door is not at a farmer's market,
--   a bake sale or a public event, and is not receiving a personal delivery or a mail order. On a
--   strict reading of a closed list, that particular flow has no home in it.
--
-- `online_orders` moves from `allowed` — which was the summary's, and asserted more than the
-- regulation says — to `unclear`. It does not block a listing, so no Maryland seller is shut off on
-- my uncertainty, and the note puts the actual question in front of whoever verifies the row.
--
-- What IS express: `mail_delivery` (v), `direct_delivery` (iv) and `retail_allowed` (a) are all in
-- the regulation by name.
--
-- =========================================================================
-- 3. THE ID NUMBER REPLACES THE ADDRESS, NOT THE NAME AND ADDRESS
-- =========================================================================
-- The label note read "A state-issued ID number may stand in for the name and address." COMAR
-- 10.15.03.27 C(2) says the opposite of half of that: the number "can be used IN LIEU OF THE ADDRESS
-- of the cottage food business on the product label". The statute puts it as a choice between two
-- composites — § 21-330.1(c)(2)(i)1: "A. The name and address of the cottage food business; or B.
-- The name and phone number of the cottage food business and the identification number assigned to
-- the cottage food business" — so the name is required either way, and what varies is address versus
-- phone-plus-number.
--
-- `element_alternatives` cannot express "either this pair or that triple" — it asks for at least one
-- member of a flat group, which here would let a phone number alone satisfy a requirement it does
-- not. So the row requires the name and address, the branch we can fill from the seller's pickup
-- address, and the note records the other branch for a seller who would rather use it.
--
-- =========================================================================
-- 4. ACID CANNED GOODS ARE THE POINT OF THE PROGRAMME, AND WERE RECORDED AS BANNED
-- =========================================================================
-- `cat_acidified` was banned. COMAR 10.15.03.27 B(1) permits "Non-potentially hazardous hot-filled
-- canned ACID fruit jellies, jams, preserves, and butters"; B(2) and B(3) then enumerate the fruits
-- for butters and for jams, preserves and jellies, each ending "Another fruit or fruit mixture that
-- will produce an acid canned food". Three of the seven permitted categories are acid canned goods.
-- Corrected to allowed.
--
-- `cat_shelf_stable` was `unrestricted` and B is a closed list, so it becomes `limited`. Note B(7),
-- "All other non-potentially hazardous foods produced by a licensed entity", does not widen it for a
-- cottage food business — which by § 21-330.1(b) is precisely an unlicensed one.
--
-- =========================================================================
-- 5. THE ON-FARM LABEL SAYS SOMETHING FALSE AND IS BEING WITHDRAWN
-- =========================================================================
-- The On-Farm Home Processing row carried a copy of the cottage food label, disclaimer included —
-- the same copy-paste found in Delaware. Here the statement is "Made by a cottage food business that
-- is not subject to Maryland's food safety regulations", and an on-farm processor operating under
-- COMAR 10.15.04.19A is a LICENSED food processor, not a cottage food business. Printing it would
-- put a false description of the producer's regulatory status on the jar.
--
-- Its own labelling provision is not in this compilation and has not been read. So rather than leave
-- a wrong statement standing, the row is emptied: `renderLabel()` will report the rule as unrecorded
-- and refuse to print, which is the correct outcome when we know the label we hold is wrong and do
-- not know what the right one is.
--
-- `verified_at` stays null on all four rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Programme 1 — Maryland Cottage Food (Health-Gen. 21-330.1, COMAR 10.15.03.27)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  disclaimer_text = 'Made by a cottage food business that is not subject to Maryland''s food safety regulations.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'Md. Code, Health-Gen. 21-330.1(c)(2)(ii) requires the statement "printed in 10 point or larger '
    'type in a color that provides a clear contrast to the background of the label".',
  notes =
    'Md. Code, Health-Gen. 21-330.1(c)(2), read 2026-09-06, with COMAR 10.15.03.27 C(1). The label '
    'carries the business identification, the product name, the ingredients "in descending order of '
    'the amount of each ingredient by weight", the net weight or volume, allergens per federal '
    'requirements, nutrition where a claim is made, and the quoted statement. THE IDENTIFICATION IS '
    'A CHOICE OF TWO COMPOSITES and the previous note had it wrong: it said a state-issued ID number '
    '"may stand in for the name and address", but C(2) says the number "can be used in lieu of the '
    'ADDRESS", and (c)(2)(i)1 puts the choice as "A. The name and address of the cottage food '
    'business; or B. The name and phone number of the cottage food business and the identification '
    'number assigned to the cottage food business". The name is required on either branch. '
    'element_alternatives cannot express "this pair or that triple" — it would let a phone number '
    'alone satisfy the requirement — so this row requires the name and address, and a Maryland '
    'seller who would rather print the name, phone and Department number may do so. ONE MORE '
    'REQUIREMENT, FOR A CHANNEL WE DO NOT USE: (c)(2)(iii) adds, for a product "offered for sale at '
    'a retail food store", the phone number and email address of the business and the date the '
    'product was made.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maryland.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MD' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- No revenue figure appears anywhere in 21-330.1 or COMAR 10.15.03.27.
  revenue_cap = null,
  cap_basis = 'none',
  -- The closed venue list does not name the internet, but two of its five members are how an online
  -- order completes. Asserting "allowed" went further than the regulation does.
  online_orders = 'unclear',
  -- COMAR 10.15.03.27 A(2)(b)(iv) and (v), by name.
  direct_delivery = 'allowed',
  -- B(1)-(3): three of the seven permitted categories are acid canned goods.
  cat_acidified = 'allowed',
  -- B is a closed list, not an open field.
  cat_shelf_stable = 'limited',
  cap_note =
    'NO CAP EXISTS IN THE LAW READ. Md. Code, Health-Gen. 21-330.1 was read in full, (a) through '
    '(i), and COMAR 10.15.03.27 A, B and C; neither contains a revenue figure of any kind. The '
    '$50,000 previously recorded here was the summary''s, and it mattered: record_order_revenue '
    'pauses a storefront when the yearly gross crosses revenue_cap, so it would have closed a lawful '
    'Maryland shop at a threshold the legislature never set. If a cap exists it is somewhere neither '
    'of those sources reaches.',
  venue_note =
    'A CLOSED LIST THAT DOES NOT NAME THE INTERNET — AND TWO OF WHOSE MEMBERS ARE HOW AN ONLINE '
    'ORDER COMPLETES. COMAR 10.15.03.27 A: "A cottage food business may offer for sale the homemade '
    'foods specified in B of this regulation when the foods are: (1) Made in a private home kitchen; '
    'and (2) Offered or sold only in the State: (a) Subject to the requirements of C(6) and (7) of '
    'this regulation, at a retail food store; or (b) Directly to a consumer: (i) At a farmer''s '
    'market; (ii) At a bake sale; (iii) At a public event; (iv) By personal delivery; or (v) By mail '
    'order". THE QUESTION FOR THIS MARKETPLACE, stated so whoever verifies this row can answer it: '
    'an order placed here and driven round by the seller is a personal delivery under (iv), and one '
    'posted to the buyer is a mail order under (v) — but a buyer COLLECTING FROM THE SELLER''S DOOR '
    'is at none of the five, and on a strict reading of a closed list that flow has no home. '
    'online_orders is therefore unclear rather than the summary''s "allowed"; it does not block a '
    'listing, so no Maryland seller is shut off on our uncertainty. Note also (2): sales are '
    '"only in the State". LOCAL LAW IS EXPRESSLY NOT PREEMPTED — 21-330.1(e): the owner "shall '
    'comply with all applicable county and municipal laws and ordinances regulating the preparation, '
    'processing, storage, and sale of cottage food products."',
  category_note =
    'A CLOSED LIST, AND ACID CANNED GOODS ARE MOST OF IT. COMAR 10.15.03.27 B: "The Department shall '
    'allow the preparation and sale of the following foods ...: (1) Non-potentially hazardous '
    'hot-filled canned acid fruit jellies, jams, preserves, and butters that are: (a) Unadulterated; '
    '(b) Packaged to maintain food safety and integrity; and (c) Labeled in accordance with '
    'Regulation .12 of this chapter; (2) Fruit butters made only from: (a) Apples; (b) Apricots; (c) '
    'Grapes; (d) Peaches; (e) Plums; (f) Prunes; (g) Quince; or (h) Another fruit or fruit mixture '
    'that will produce an acid canned food; (3) Jam, preserve, or jelly made only from: (a) A fruit '
    'listed in B(2) ...; (b) Oranges; (c) Nectarines; (d) Tangerines; (e) Blackberries; (f) '
    'Raspberries; (g) Blueberries; (h) Boysenberries; (i) Cherries; (j) Cranberries; (k) '
    'Strawberries; (l) Red currants; or (m) Another fruit or fruit mixture that will produce an acid '
    'canned food; (4) Non-potentially hazardous baked goods; (5) Foods manufactured on a farm by a '
    'licensed food processor in accordance with COMAR 10.15.04.19A; (6) Non-potentially hazardous '
    'candy; and (7) All other non-potentially hazardous foods produced by a licensed entity." '
    'cat_acidified was BANNED and is now allowed — three of the seven categories are acid canned '
    'goods. B(7) does not widen the list for a cottage food business, which by 21-330.1(b) is '
    'precisely an unlicensed one, and B(5) is the hook for the separate On-Farm Home Processing '
    'programme. Refrigerated food and meat stay banned on the "non-potentially hazardous" '
    'qualifier that runs through every category; fermented food stays banned because the list is '
    'closed and it is not on it.',
  license_note =
    'No licence, and inspection only on complaint. 21-330.1(b): "A cottage food business is not '
    'required to be licensed by the Department if the owner of the cottage food business complies '
    'with this section." (f)(2): on receipt of a complaint a representative "may enter and inspect '
    'the premises", and COMAR 10.15.03.27 C(4) adds collection of samples on a complaint or illness '
    'outbreak. (a) preserves State and federal tax obligations and excludes an establishment that '
    'must be licensed under 21-305. TRAINING IS CONDITIONAL ON ONE CHANNEL: (g), "Before the owner '
    'of a cottage food business may sell a cottage food product to a retail food store, the owner '
    'shall submit to the Department: (1) Documentation of the owner''s successful completion of a '
    'food safety course approved by the Department; and (2) The label that will be affixed" — so a '
    'seller who never supplies a shop needs neither.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maryland.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MD' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Programme 2 — Maryland On-Farm Home Processing (COMAR 10.15.04.19A, NOT READ)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  -- Withdrawn rather than left wrong: renderLabel() will refuse to print, which is correct when the
  -- label we hold is known to be false and the right one is unknown.
  required_elements = array[]::text[],
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  notes =
    'WITHDRAWN, BECAUSE WHAT WAS HERE SAID SOMETHING FALSE. This row carried a copy of the Maryland '
    'cottage food label, disclaimer included — "Made by a cottage food business that is not subject '
    'to Maryland''s food safety regulations." An on-farm home processor is a LICENSED food processor '
    'operating under COMAR 10.15.04.19A (see COMAR 10.15.03.27 B(5), which permits "Foods '
    'manufactured on a farm by a licensed food processor in accordance with COMAR 10.15.04.19A"), '
    'not a cottage food business, so printing that statement would put a false description of the '
    'producer''s regulatory status on the package. The same copy-paste was found in Delaware, where '
    'the primary text for both routes was available and the two labels turned out to be different '
    'statutes. COMAR 10.15.04.19A IS NOT IN THE NATIONAL AGRICULTURAL LAW CENTER COMPILATION AND HAS '
    'NOT BEEN READ, so there is nothing to put in its place. The label generator will now report '
    'this rule as unrecorded and refuse to print, which is the right outcome while the correct '
    'requirements are unknown. An admin should read COMAR 10.15.04.19 and fill this in.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maryland.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MD' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  cap_note =
    'UNVERIFIED, AND LEFT ALONE DELIBERATELY. The $40,000 here is the summary''s. This programme is '
    'governed by COMAR 10.15.04.19A, which is not in the compilation read on 2026-09-06, so there is '
    'no evidence either way — removing the figure would be as unfounded as keeping it. Contrast the '
    'cottage food row, where 21-330.1 and COMAR 10.15.03.27 WERE read in full and contain no cap at '
    'all, so the invented $50,000 could be removed on evidence. Remember that revenue_cap pauses a '
    'storefront when the yearly gross crosses it: if this figure is wrong, it closes a lawful shop.',
  venue_note =
    'NOT VERIFIED — the note here ("Farmers markets, events and from home") is the summary''s, and '
    'the governing regulation COMAR 10.15.04.19A is not in the compilation read on 2026-09-06. What '
    'IS known from the cottage food side: COMAR 10.15.03.27 B(5) lets a cottage food business sell '
    '"Foods manufactured on a farm by a licensed food processor in accordance with COMAR '
    '10.15.04.19A", which is how this programme''s output reaches that route. Everything else on '
    'this row still rests on the summary.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Maryland.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MD' and ordinal = 2 and verified_at is null;
