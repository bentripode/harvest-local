-- Harvest Local — Illinois, from 410 ILCS 625/3.6 and 625/4, read 2026-09-06.
--
-- =========================================================================
-- 1. ILLINOIS REGULATES OUR CHECKOUT PAGE BY NAME
-- =========================================================================
-- This is the finding. 410 ILCS 625/4(b)(10):
--
--   "At the point of sale, notice must be provided in a prominent location that states the
--   following: "This product was produced in a home kitchen not inspected by a health department
--   that may also process common food allergens." At a physical display, notice shall be a placard.
--   ONLINE, NOTICE SHALL BE A MESSAGE ON THE COTTAGE FOOD OPERATION'S ONLINE SALES INTERFACE AT THE
--   POINT OF SALE."
--
-- Texas reaches the same result by requiring the labelling information before payment is accepted;
-- Nebraska by requiring the disclaimer in internet advertising; California by requiring the county,
-- permit number and statement in an internet advertisement. Illinois is the first to legislate the
-- online sales interface itself, in those words. `predisclosure_required` becomes true.
--
-- THE TWO STATEMENTS ARE NOT THE SAME SENTENCE, which is why both columns are now filled. The label
-- phrase at (b)(7)(E) adds a second sentence the point-of-sale notice does not carry:
--
--   Label (7)(E): "This product was produced in a home kitchen not inspected by a health department
--   that may also process common food allergens. If you have safety concerns, contact your local
--   health department."
--   Notice (10):  "This product was produced in a home kitchen not inspected by a health department
--   that may also process common food allergens."
--
-- Colorado had the same trap in the other direction. Do not substitute one for the other. Our
-- pre-checkout disclosure renders the fuller label text, which contains the required sentence
-- verbatim and then some — more than (10) demands, never less.
--
-- =========================================================================
-- 2. THE VENUE LIST NAMES ONLINE SELLING AND DELIVERY OUTRIGHT
-- =========================================================================
-- `venue_note` said "No restrictions". 625/4(b)(11): "Food and drink produced by a cottage food
-- operation shall be sold directly to consumers for their own consumption and not for resale. Sales
-- directly to consumers include, but are not limited to, sales at or through: (A) farmers' markets;
-- (B) fairs, festivals, public events, OR ONLINE; (C) pickup from the private home or farm of the
-- cottage food operator ...; (D) DELIVERY TO THE CUSTOMER; (E) pickup from a third-party private
-- property with the consent of the third-party property holder; and (F) mobile farmers markets."
--
-- Shipping is separately governed by (12) and is the one place Illinois is stricter than our row:
-- "Only food that is not a time-or-temperature control for safety food may be shipped. A cottage
-- food product shall not be shipped out of State. Each cottage food product that is shipped must be
-- sealed in a manner that reveals tampering, including, but not limited to, a sticker or pop top."
--
-- =========================================================================
-- 3. LOCAL LAW IS NOT PREEMPTED
-- =========================================================================
-- `local_preemption` was true. Illinois is the opposite: registration itself is local ((b)(1.3),
-- with the certificate and registration number then printed on every label), and (b)(11)(C) makes
-- home pickup lawful only "if the pickup is not prohibited by any law of the unit of local
-- government that applies equally to all cottage food operations", adding that "in a municipality
-- with a population of 1,000,000 or more" — Chicago — "a cottage food operator shall comply with any
-- law of the municipality that applies equally to all home-based businesses". The home kitchen
-- operation route at 625/3.6(c) goes further still: it "appl[ies] only to a home kitchen operation
-- located in a municipality, township, or county where the local governing body ... has adopted an
-- ordinance authorizing home kitchen operations."
--
-- =========================================================================
-- 4. THE LABEL ELEMENTS WERE ALREADY RIGHT
-- =========================================================================
-- All seven of (b)(7)(A) through (G), and no net weight — Illinois does not ask for one directly,
-- though (7) opens by requiring packaging to "conform with the labeling requirements of the Illinois
-- Food, Drug and Cosmetic Act", which has not been read and may add to this list.
--
-- =========================================================================
-- 5. THE OTHER ROUTE, RECORDED BUT NOT MODELLED
-- =========================================================================
-- 625/3.6 is a second, lighter route: a "home kitchen operation" is exempt from the Act where
-- "Monthly gross sales do not exceed $1,000", the food is a non-potentially hazardous baked good,
-- the sale is direct, and the food is stored in the residence. Its label is far shorter — the common
-- name and allergens, plus notice that the product was produced in a home kitchen. It is NOT a
-- second programme row here, because our data models the cottage food route Illinois sellers on a
-- marketplace would use, and because 3.6 exists only where a local body has authorised it.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'business_name', 'municipality', 'permit_number', 'product_name',
    'ingredients_desc_by_weight', 'production_date', 'allergens'
  ],
  disclaimer_text = 'This product was produced in a home kitchen not inspected by a health department that may also process common food allergens. If you have safety concerns, contact your local health department.',
  disclaimer_font_note = '410 ILCS 625/4(b)(7)(E) requires the phrase "in prominent lettering". No point size is given.',
  -- (b)(10) is a separate, SHORTER statement, and online it is a message on the sales interface.
  placard_required = true,
  placard_text = 'This product was produced in a home kitchen not inspected by a health department that may also process common food allergens.',
  predisclosure_required = true,
  notes =
    '410 ILCS 625/4(b)(7) and (10), read 2026-09-06. The label list was already correct and is kept: '
    '"(A) the name of the cottage food operation and unit of local government in which the cottage '
    'food operation is located; (B) the identifying registration number provided by the local health '
    'department on the certificate of registration and the name of the municipality or county in '
    'which the registration was filed; (C) the common or usual name of the food product; (D) all '
    'ingredients of the food product, including any color, artificial flavor, and preservative, '
    'listed in descending order by predominance of weight shown with the common or usual names; (E) '
    'the following phrase in prominent lettering: [the disclaimer]; (F) the date the product was '
    'processed; and (G) allergen labeling as specified under federal labeling requirements." No net '
    'weight is required directly, though (7) opens by requiring packaging to "conform with the '
    'labeling requirements of the Illinois Food, Drug and Cosmetic Act", which has not been read. '
    'TWO DIFFERENT STATEMENTS: the label phrase at (E) ends "If you have safety concerns, contact '
    'your local health department."; the point-of-sale notice at (10) stops before that sentence. '
    'Both are stored, separately, as Colorado''s are. (10) IS WHY predisclosure_required IS TRUE: '
    '"At the point of sale, notice must be provided in a prominent location that states the '
    'following: [the shorter sentence]. At a physical display, notice shall be a placard. Online, '
    'notice shall be a message on the cottage food operation''s online sales interface at the point '
    'of sale." Our disclosure renders the fuller label text, which contains the required sentence '
    'and more. (9) allows a local health department to permit unpackaged sale of a product "difficult '
    'to properly label or package", with "other prominent written notice" to the purchaser instead.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Illinois.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'IL' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- (b)(11)(D): "delivery to the customer" is a named direct-sale channel.
  direct_delivery = 'allowed',
  -- Registration is local, home pickup is subject to local law, and Chicago has its own rules.
  local_preemption = false,
  venue_note =
    'ONLINE SELLING AND DELIVERY ARE NAMED IN THE STATUTE, and this row previously said "No '
    'restrictions". 410 ILCS 625/4(b)(11): "Food and drink produced by a cottage food operation '
    'shall be sold directly to consumers for their own consumption and not for resale. Sales '
    'directly to consumers include, but are not limited to, sales at or through: (A) farmers'''' '
    'markets; (B) fairs, festivals, public events, or online; (C) pickup from the private home or '
    'farm of the cottage food operator, if the pickup is not prohibited by any law of the unit of '
    'local government that applies equally to all cottage food operations; in a municipality with a '
    'population of 1,000,000 or more, a cottage food operator shall comply with any law of the '
    'municipality that applies equally to all home-based businesses; (D) delivery to the customer; '
    '(E) pickup from a third-party private property with the consent of the third-party property '
    'holder; and (F) mobile farmers markets." An open list ("include, but are not limited to"), so '
    'retail_allowed is false on the resale prohibition rather than on any missing venue. LOCAL LAW '
    'IS NOT PREEMPTED — see (11)(C) above, the local registration in (1.3), and 625/3.6(c), which '
    'makes the lighter home kitchen route available only where a local body "has adopted an '
    'ordinance authorizing home kitchen operations."',
  mail_note =
    'Permitted and conditioned. 625/4(b)(12): "Only food that is not a time-or-temperature control '
    'for safety food may be shipped. A cottage food product shall not be shipped out of State. Each '
    'cottage food product that is shipped must be sealed in a manner that reveals tampering, '
    'including, but not limited to, a sticker or pop top." The out-of-State bar is no constraint '
    'here, since orders never cross a state line on this marketplace.',
  category_note =
    'A prohibited list, not an approved one — which is why cat_shelf_stable stays unrestricted. '
    '625/4(b)(1.5): an operation "shall not sell or offer to sell the following food items or '
    'processed foods containing the following food items, except as indicated: (A) meat, poultry, '
    'fish, seafood, or shellfish; (B) dairy, except as an ingredient in a baked good or candy that '
    'is not a time/temperature control for safety food, such as caramel ..., or as an ingredient in '
    'a baked good frosting, such as buttercream; (C) eggs, except as an ingredient in a food that is '
    'not a time/temperature control for safety food, including dry noodles, or as an ingredient in a '
    'baked good frosting, such as buttercream, if the eggs are not raw; (D) pumpkin pies, sweet '
    'potato pies, cheesecakes, custard pies, creme pies, and pastries with time/temperature control '
    'for safety foods that are fillings or toppings; (E) garlic in oil or oil infused with garlic, '
    'except if the garlic oil is acidified; (F) low-acid canned foods; (G) sprouts; (H) cut leafy '
    'greens, except for cut leafy greens that are dehydrated, acidified, or blanched and frozen; (I) '
    'cut or pureed fresh tomato or melon; (J) dehydrated tomato or melon; (K) frozen cut melon; (L) '
    'wild-harvested, non-cultivated mushrooms; (M) alcoholic beverages; or (N) kombucha." ACIDIFIED '
    'AND FERMENTED STAY ALLOWED and are defined together: 625/4(a) says a food is "acidified" if '
    'acid is added "to produce a final equilibrium pH of 4.6 or below and a water activity greater '
    'than 0.85" or "it is fermented to produce a final equilibrium pH of 4.6 or below". Kombucha is '
    'the named fermented exception. Sprouts, mushrooms, melon and leafy greens have no axis here.',
  license_note =
    'Local registration, and the registration number is printed on every label. 625/4(b)(1.3): "A '
    'cottage food operation must register with the local health department for the unit of local '
    'government in which it is located, but may sell products outside of the unit of local '
    'government where the cottage food operation is located", with a county lacking a health '
    'department contracting with an adjacent one, and "A copy of the certificate of registration '
    'must be available upon request by any local health department." (b)(6) is the training '
    'condition and it is a strong one: "A person preparing or packaging a product as part of a '
    'cottage food operation must be a Department-approved certified food protection manager." No '
    'revenue cap applies to this route. The separate home kitchen operation route at 625/3.6 has one '
    '— monthly gross sales not exceeding $1,000 — and is not modelled as a programme row here.',
  recipe_note =
    'Conditional, and the condition is specific to canned tomatoes. 625/4(b)(1.6): to sell "canned '
    'tomatoes or a canned product containing tomatoes", the operator shall either "(A) follow '
    'exactly a recipe that has been tested by the United States Department of Agriculture or by a '
    'state cooperative extension located in this State or any other state in the United States; or '
    '(B) submit the recipe, at the cottage food operator''s expense, to a commercial laboratory".',
  training_note =
    'Certification, not a class: 625/4(b)(6) requires the person preparing or packaging the product '
    'to "be a Department-approved certified food protection manager".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Illinois.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'IL' and ordinal = 1 and verified_at is null;
