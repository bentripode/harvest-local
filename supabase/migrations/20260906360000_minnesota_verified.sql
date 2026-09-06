-- Harvest Local — Minnesota, from Minn. Stat. 28A.152 (the version in force until 1 August 2027),
-- read 2026-09-06.
--
-- Minnesota is the most marketplace-aware statute in this pass. It permits internet selling in
-- terms, says what must appear on the website, and says who is allowed to carry the parcel.
--
-- =========================================================================
-- 1. A SIXTH PRE-SALE DISCLOSURE RULE, AND IT NAMES THE WEBSITE
-- =========================================================================
-- Subd. 2(d), in full: "Food products exempt under subdivision 1 may be sold over the Internet but
-- must be delivered directly to the ultimate consumer by the individual who prepared the food
-- product. The statement "These products are homemade and not subject to state inspection." must be
-- displayed on the website that offers the exempt foods for purchase."
--
-- Three separate things in two sentences: internet selling is expressly permitted, the delivery is
-- restricted to the maker, and the statement must be on the website. That last is
-- `predisclosure_required`, joining Texas, Indiana, Illinois, California and Nebraska.
--
-- =========================================================================
-- 2. ONLY THE PERSON WHO MADE IT MAY DELIVER IT
-- =========================================================================
-- Subd. 2(b): "If an exempt food product will be delivered to the ultimate consumer upon sale of the
-- food product, the individual who prepared the food product must be the person who delivers the
-- food product to the ultimate consumer." Subd. 2(d) repeats it for internet sales.
--
-- `mail_delivery` was "restricted", which understates it. A postal service or a courier is not the
-- individual who prepared the food, so the post cannot satisfy subdivision 2 at all: banned.
-- `direct_delivery` is allowed and, for an internet sale, mandatory.
--
-- This is the second state to legislate WHO carries the parcel — Texas 437.0194(b)(1) is the other,
-- and Minnesota is stricter: Texas allows the operator, an employee or a household member, Minnesota
-- requires the maker personally. Nothing in our delivery flow records or checks that, so it is a
-- seller responsibility recorded in the note.
--
-- =========================================================================
-- 3. REGISTRATION IS REQUIRED OF EVERYONE; ONLY THE FEE IS CONDITIONAL
-- =========================================================================
-- `license_required` was `conditional`. Subd. 4: "An individual who prepares and sells exempt food
-- under subdivision 1 MUST register annually with the commissioner." No qualification. What is
-- conditional is the money: "The annual registration fee is $50. An individual with $5,000 or less
-- in annual gross receipts from the sale of exempt food under this section is not required to pay
-- the registration fee."
--
-- And that $5,000 is where the $7,665 figure in circulation comes from — the same subdivision
-- directs the commissioner to "adjust the gross receipts amount of this fee exemption based on the
-- consumer price index using 2002 as the index year". It is a FEE threshold, not a licensing one:
-- crossing it means paying $50 and taking the longer training, not getting a licence. `license_
-- threshold` stays null rather than carrying an inflation-adjusted number the statute does not
-- state.
--
-- =========================================================================
-- 4. THE LABEL WAS MISSING THE PRODUCER'S IDENTITY
-- =========================================================================
-- Subd. 1(a)(1)(i): the food must be "labeled to accurately reflect the name and the registration
-- number or address of the individual preparing and selling the food, the date on which the food was
-- prepared, the ingredients and any possible allergens, and the statement ...".
--
-- We had the name, date, ingredients and allergens. The "registration number OR address" half was
-- missing entirely — a third state (after Iowa and Maryland) whose identity requirement is a name
-- plus a choice, and here the choice is expressible: an alternatives group of two.
--
-- Note Minnesota asks only for "the ingredients", with no ordering rule, so the element used is
-- slightly stricter than the statute. It asks for no net weight at all.
--
-- =========================================================================
-- 5. FERMENTED FOOD IS PERMITTED, AND WAS BANNED
-- =========================================================================
-- Subd. 1(a)(2) is a whole second exemption for "home-processed and home-canned food products" where
-- "the products are pickles, vegetables, or fruits having an equilibrium pH value of 4.6 or lower or
-- a water activity value of .85 or less". A fermented vegetable that reaches pH 4.6 is squarely
-- within it. `cat_fermented` becomes `conditional` — permitted subject to the pH or water activity
-- test, which is a real qualification the seller must meet rather than a ban.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'production_date', 'ingredients_desc_by_weight', 'allergens'
  ],
  -- "the name and the registration number or address" — name required, then one of two.
  element_alternatives = '[["permit_number", "producer_address"]]'::jsonb,
  disclaimer_text = 'These products are homemade and not subject to state inspection.',
  placard_required = true,
  placard_text = 'These products are homemade and not subject to state inspection.',
  predisclosure_required = true,
  notes =
    'Minn. Stat. 28A.152 subd. 1(a)(1)(i), read 2026-09-06: the food must be "labeled to accurately '
    'reflect the name and the registration number or address of the individual preparing and selling '
    'the food, the date on which the food was prepared, the ingredients and any possible allergens, '
    'and the statement "These products are homemade and not subject to state inspection."" THE '
    'PRODUCER''S IDENTITY WAS MISSING — we had the name but not the "registration number or address" '
    'half, now an alternatives group. Minnesota asks only for "the ingredients", with no ordering '
    'rule, so the element used is slightly stricter than the statute; and it asks for NO NET WEIGHT '
    'at all. THE SAME STATEMENT IS OWED IN THREE PLACES: on the label (1)(a)(1)(i); on "a clearly '
    'legible sign or placard" at the point of sale (1)(a)(1)(ii), which is placard_required; and, '
    'for an internet sale, "on the website that offers the exempt foods for purchase" (subd. 2(d)), '
    'which is predisclosure_required. The home-canned route at subd. 1(a)(2)(iv) requires the same '
    'label with the date "on which the goods were processed and canned".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Minnesota.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MN' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- Subd. 2(b) and (d): the maker must be the deliverer. A carrier cannot satisfy that.
  mail_delivery = 'banned',
  direct_delivery = 'allowed',
  -- Subd. 4: registration is required of everyone; only the fee is conditional.
  license_required = 'yes',
  -- Subd. 1(a)(2) expressly permits pickles and vegetables at pH 4.6 or below.
  cat_fermented = 'conditional',
  venue_note =
    'INTERNET SELLING IS EXPRESSLY PERMITTED, AND THE STATUTE SAYS WHO MAY CARRY THE PARCEL — the '
    'previous note read "Farmers markets, community events and from home", which is subd. 2(a) and '
    'misses subd. 2(d) entirely. Subd. 2(a): an individual "may sell the exempt food: (1) directly '
    'to the ultimate consumer at a community event or farmers'' market; (2) directly from the '
    'individual''s home to the ultimate consumer, to the extent allowed by local ordinance; or (3) '
    'through donation to a community event with the purpose of fundraising ...". Subd. 2(d): "Food '
    'products exempt under subdivision 1 may be sold over the Internet but must be delivered '
    'directly to the ultimate consumer by the individual who prepared the food product. The '
    'statement "These products are homemade and not subject to state inspection." must be displayed '
    'on the website that offers the exempt foods for purchase." ONLY THE MAKER MAY DELIVER, and '
    'subd. 2(b) says it again for any delivered sale: "the individual who prepared the food product '
    'must be the person who delivers the food product to the ultimate consumer." That is why '
    'mail_delivery is banned — a courier is not the maker — and it is a seller responsibility our '
    'delivery flow neither records nor checks. Minnesota is the second state to legislate who '
    'carries the parcel and the stricter of the two: Texas 437.0194(b)(1) allows the operator, an '
    'employee or a household member. Subd. 2(c): home-canned products under 1(a)(2) "may not be sold '
    'outside of Minnesota". LOCAL LAW IS EXPRESSLY NOT PREEMPTED — subd. 6: "This section does not '
    'preempt the application of any business licensing requirement or sanitation, public health, or '
    'zoning ordinance of a political subdivision."',
  cap_note =
    'Two figures, and only one of them is a cap. Subd. 3: "An individual selling exempt foods under '
    'this section is limited to total sales with gross receipts of $78,000 or less in a calendar '
    'year" — that is the cap, and it matches. The OTHER figure, which appears in summaries as '
    '$7,665, is not a licensing threshold at all: subd. 4 sets a $50 annual registration fee and '
    'exempts "An individual with $5,000 or less in annual gross receipts", then directs the '
    'commissioner to "adjust the gross receipts amount of this fee exemption based on the consumer '
    'price index using 2002 as the index year". Crossing it means paying $50 and taking the longer '
    'training (subd. 5(a) rather than 5(b)) — not getting a licence and not stopping. '
    'license_threshold is left null rather than carrying an inflation-adjusted number the statute '
    'does not itself state.',
  category_note =
    'TWO EXEMPTIONS, NOT ONE. Subd. 1(a)(1) covers "food that is not potentially hazardous food, as '
    'defined in Minnesota Rules, part 4626.0020, subpart 62" — which is what bans refrigerated food '
    'and meat here. Subd. 1(a)(2) is a separate exemption for "home-processed and home-canned food '
    'products" where "the products are pickles, vegetables, or fruits having an equilibrium pH value '
    'of 4.6 or lower or a water activity value of .85 or less" and "are home-processed and '
    'home-canned in Minnesota". That is why acidified is allowed and low-acid canned is banned — the '
    'pH ceiling is the line. FERMENTED WAS BANNED AND SHOULD NOT HAVE BEEN: a fermented vegetable '
    'reaching pH 4.6 is squarely inside 1(a)(2), so it is conditional on meeting the pH or water '
    'activity test rather than prohibited. Subd. 1(b) also exempts a 1(a)(2) producer from Minn. '
    'Stat. 31.31 and 31.392.',
  license_note =
    'REGISTRATION IS REQUIRED OF EVERYONE; ONLY THE FEE AND THE TRAINING VARY — license_required was '
    '"conditional", which read the fee exemption as if it were a registration exemption. Subd. 4: '
    '"An individual who prepares and sells exempt food under subdivision 1 must register annually '
    'with the commissioner. The commissioner shall register an individual within 30 days of '
    'submitting a complete registration ... The annual registration fee is $50. An individual with '
    '$5,000 or less in annual gross receipts from the sale of exempt food under this section is not '
    'required to pay the registration fee." Nothing requires an inspection. Subd. 1(c) permits the '
    'seller to "organize the individual''s cottage food business as a business entity recognized by '
    'state law". NOTE A SUCCESSOR VERSION: the text read here is the one "Effective until 8/1/2027"; '
    'a revised 28A.152 takes effect 1 August 2027 and has not been compared against this row.',
  training_note =
    'Required either way, and which course depends on the fee. Subd. 5(a): an individual who must '
    'pay the registration fee "must complete a safe food handling training course that is approved '
    'by the commissioner before registering ... The training shall not exceed eight hours and must '
    'be completed every three years." Subd. 5(b): one who is exempt from the fee "must satisfactorily '
    'complete an online course and exam as approved by the commissioner before registering", offered '
    '"at no cost to the individual".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Minnesota.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MN' and ordinal = 1 and verified_at is null;
