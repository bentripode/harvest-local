-- Harvest Local — South Carolina and South Dakota, from S.C. Code 44-1-143 and S.D. Codified Laws
-- 34-18-36.1, 34-18-37 and 34-18-38, read 2026-09-06.
--
-- =========================================================================
-- 1. SOUTH CAROLINA: WE PREPENDED "NOT FOR RESALE" TO A STATUTE THAT PERMITS RESALE
-- =========================================================================
-- We stored: "NOT FOR RESALE-PROCESSED AND PREPARED BY A HOME-BASED FOOD PRODUCTION OPERATION THAT
-- IS NOT SUBJECT TO SOUTH CAROLINA'S FOOD SAFETY REGULATIONS."
--
-- S.C. Code 44-1-143(D)(4) requires "a conspicuous statement printed in all capital letters and in a
-- color that provides a clear contrast to the background that reads: "PROCESSED AND PREPARED BY A
-- HOME-BASED FOOD PRODUCTION OPERATION THAT IS NOT SUBJECT TO SOUTH CAROLINA'S FOOD SAFETY
-- REGULATIONS.""
--
-- The words "NOT FOR RESALE-" are not in it. This is the sixth disclaimer correction in the pass and
-- the first to add a whole phrase rather than punctuation or capitalisation — and the phrase is not
-- merely surplus, it is FALSE. Subsection (E) expressly permits these operations to sell "to retail
-- stores, including grocery stores", and requires those stores to post signage when they do. A South
-- Carolina label reading NOT FOR RESALE would contradict the statute on the same package.
--
-- =========================================================================
-- 2. SOUTH CAROLINA'S VENUE NOTE DESCRIBED A DIFFERENT KIND OF LAW
-- =========================================================================
-- It read "Farmers markets, roadside stands, events and from home". 44-1-143(E): "Home-based food
-- operations only may sell, or offer to sell, food items directly to a person, INCLUDING ONLINE AND
-- BY MAIL ORDER, or to retail stores, including grocery stores."
--
-- Online selling, mail order and supplying grocery stores are all named. The definition at (A)(1)
-- says the same thing again, describing an operation that distributes food "for sale directly to a
-- person, including online and by mail order, or to retail stores, including grocery stores."
--
-- =========================================================================
-- 3. SOUTH CAROLINA HAS A FLOOR, NOT A CAP
-- =========================================================================
-- 44-1-143(G): "The provisions of this section do not apply to an operation with net earnings of
-- less than fifteen hundred dollars annually but that would otherwise meet the definition of a
-- home-based food operation". Below $1,500 net earnings the section — including its label rule —
-- does not reach the operation at all. `revenue_cap` is correctly null; this is the opposite kind of
-- threshold and worth recording so nobody later mistakes it for one.
--
-- =========================================================================
-- 4. SOUTH DAKOTA'S EXEMPTION REQUIRES THE SALE TO HAPPEN IN THE SELLER'S PHYSICAL PRESENCE
-- =========================================================================
-- This row had `online_orders = 'allowed'`. S.D. Codified Laws 34-18-38:
--
--   "A person selling food prepared at the person's primary residence, in accordance with 34-18-35,
--   is exempt from the licensing and license fee provisions of this chapter if: (1) The food meets
--   the requirements of 34-18-37; (2) The food is sold IN THE SELLER'S PHYSICAL PRESENCE at: (a) The
--   seller's primary residence; (b) A farmer's market; (c) A roadside stand; or (d) Other temporary
--   sale venue; and (3) The seller, or a person residing at the seller's primary residence,
--   PERSONALLY DELIVERS the food to the buyer at the completion of the sale."
--
-- A sale made over the internet is not made in the seller's physical presence, so it falls outside
-- the exemption. `online_orders` becomes `banned`, which blocks food listings for South Dakota
-- sellers on this marketplace.
--
-- THE COUNTER-ARGUMENT, recorded because this is a guardrail and the reader deserves both halves: a
-- buyer who orders online and collects at the seller's door does take handover in the seller's
-- physical presence at the seller's primary residence, and (3) is satisfied. Whether the "sale" for
-- the purposes of (2) is the online order or the handover is not settled by the text. The row is set
-- to banned rather than unclear because (2) attaches physical presence to the SALE and not to the
-- delivery — (3) covers delivery separately — and because the consequence of being wrong the other
-- way is a South Dakota seller losing their licence exemption. This is the same protective direction
-- taken for Washington, where the seed said allowed and the statute did not.
--
-- Note the shape: like New Hampshire, this is an exemption from licensure rather than a prohibition.
-- A licensed South Dakota food operation is not covered by 34-18-38 at all, and that route is not
-- modelled here.
--
-- =========================================================================
-- 5. SOUTH DAKOTA'S LABEL WANTS TWO DIFFERENT ADDRESSES, AND A HANDLING DIRECTIVE
-- =========================================================================
-- 34-18-37 lists nine items and we held six. The disclaimer at (9) matched exactly and is recorded
-- as checked. Two of the misses matter:
--
--   (3) "Physical address of production" AND (4) "Mailing address of the producer" are two distinct
--   addresses. We have one `producer_address` element, filled from the seller's pickup address.
--   There is no element for a separate mailing address, and one state is not enough to build one on
--   — recorded as a gap, the way handling instructions were recorded for Idaho before North Dakota
--   made it two.
--
--   (8) "In the case of food sold in accordance with 34-18-36.1, a directive to keep refrigerated or
--   frozen" IS the handling-instructions element, added in 20260906450000 for Idaho and North
--   Dakota. South Dakota is the third state to need it, and it goes in `optional_elements` for the
--   same reason: 34-18-36.1 covers only refrigerated and frozen foods, which nothing here identifies.
--
-- `verified_at` stays null on both rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- South Carolina
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'product_name', 'ingredients_desc_by_weight', 'net_weight', 'allergens'
  ],
  -- (D)(1): the address, or a department identification number in its place.
  element_alternatives = '[["producer_address", "permit_number"]]'::jsonb,
  -- Verbatim: "NOT FOR RESALE-" is not in the statute, and subsection (E) permits resale.
  disclaimer_text = 'PROCESSED AND PREPARED BY A HOME-BASED FOOD PRODUCTION OPERATION THAT IS NOT SUBJECT TO SOUTH CAROLINA''S FOOD SAFETY REGULATIONS.',
  disclaimer_all_caps = true,
  disclaimer_font_note =
    'S.C. Code 44-1-143(D)(4) requires "a conspicuous statement printed in all capital letters and in '
    'a color that provides a clear contrast to the background". No point size is prescribed.',
  notes =
    'S.C. Code 44-1-143(D), read 2026-09-06. WE HAD PREPENDED "NOT FOR RESALE-" TO THE STATEMENT AND '
    'IT IS NOT IN THE STATUTE. (D)(4) requires the label to read "PROCESSED AND PREPARED BY A '
    'HOME-BASED FOOD PRODUCTION OPERATION THAT IS NOT SUBJECT TO SOUTH CAROLINA''S FOOD SAFETY '
    'REGULATIONS." and nothing before it. Worse than surplus: subsection (E) expressly permits these '
    'operations to sell "to retail stores, including grocery stores", so a label saying NOT FOR '
    'RESALE would contradict the statute on the same package. THE FULL LIST at (D): the label "must '
    'comply with federal laws and regulations and must include: (1) the name and address of the '
    'home-based food production operation. If a home-based food production operator does not want to '
    'include his address on the label, then the department shall provide an identification number to '
    'the operator, upon the operator''s request, that can be used on the label instead; (2) the name '
    'of the product being sold; (3) the ingredients used to make the product in descending order of '
    'predominance by weight; and (4) [the statement]." (1) IS AN EITHER/OR on the address, now an '
    'alternatives group. NET WEIGHT AND ALLERGENS ARE ADDED ON THE STATUTE''S OWN AUTHORITY, not '
    'merely as background federal law: (D) opens by requiring the label to "comply with federal laws '
    'and regulations", which is where 21 CFR 101''s net quantity and 21 U.S.C. 343(w)''s allergen '
    'declaration come from. That is a firmer hook than the other states in this table where federal '
    'elements are carried.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/South-Carolina.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'SC' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- (E) names online and mail order; nothing addresses the producer driving it round, but the
  -- section's whole frame is direct sale to a person.
  direct_delivery = 'allowed',
  -- The pH/Aw table at (A)(4)(b) makes food at pH 4.6 or below non-hazardous at every water
  -- activity, so acidified and fermented foods are not excluded as such.
  cat_acidified = 'conditional',
  cat_fermented = 'conditional',
  venue_note =
    'ONLINE AND MAIL ORDER ARE NAMED TWICE, and the row previously said "Farmers markets, roadside '
    'stands, events and from home" — which is the summary''s and describes a different kind of law. '
    'S.C. Code 44-1-143(E): "Home-based food operations only may sell, or offer to sell, food items '
    'directly to a person, INCLUDING ONLINE AND BY MAIL ORDER, or to retail stores, including '
    'grocery stores." The definition at (A)(1) says it again: an operation that "prepares, processes, '
    'packages, stores, and distributes nonpotentially hazardous foods for sale directly to a person, '
    'including online and by mail order, or to retail stores, including grocery stores." That is why '
    'retail_allowed is true — and (E) puts a duty on the shop: "Any retail stores, including grocery '
    'stores, that sell or offer to sell home-based food products must post clearly visible signage '
    'indicating that home-based food products are not subject to commercial food regulations." (F): '
    'the operation "is not a retail food establishment and is not subject to regulation by the '
    'department pursuant to Regulation 61.25". LOCAL LAW WINS: (I), "The provisions of this section '
    'apply in the absence of a local ordinance to the contrary."',
  cap_note =
    'A FLOOR, NOT A CAP — worth stating so nobody later reads it as one. 44-1-143(G): "The provisions '
    'of this section do not apply to an operation with net earnings of less than fifteen hundred '
    'dollars annually but that would otherwise meet the definition of a home-based food operation '
    'provided in subsection (A)(1)." Below $1,500 net earnings the section, including its labelling '
    'requirement, does not reach the operation at all. There is no upper limit anywhere in the '
    'section, which is why revenue_cap is null.',
  category_note =
    'NON-HAZARDOUS ONLY, WITH A pH/WATER-ACTIVITY TABLE THAT DOES THE REAL WORK. 44-1-143(A)(1) '
    'confines the operation to "nonpotentially hazardous foods" and excludes two things by name: it '
    '"does not include preparing, processing, packaging, storing, or distributing aluminum canned '
    'goods or charcuterie boards." (A)(4)(a) lists the hazardous foods — "an animal food that is raw '
    'or heat-treated; a plant food that is heat-treated or consists of raw seed sprouts; cut melons; '
    'cut leafy greens; cut tomatoes ...; garlic-in-oil mixtures not modified to prevent microorganism '
    'growth or toxin formation" — which is what bans refrigerated food and meat. (A)(4)(b) then '
    'gives a table of pH against water activity, under which food at pH 4.6 or less is '
    'non-hazardous at EVERY water activity. So an acidified or fermented food below that pH is not '
    'excluded, and both axes move from banned to conditional on meeting it. Low-acid canned goods '
    'stay banned, reinforced by the aluminium-can exclusion.',
  license_note =
    'No licence and no inspection, but a substantial list of standing duties. 44-1-143(F): the '
    'operation "is not a retail food establishment and is not subject to regulation by the department '
    'pursuant to Regulation 61.25." (B) still requires the operator to supervise anyone else '
    'handling the food, keep all animals including pets out of the production area and away from '
    'stored food, prohibit "all domestic activities in the kitchen" during production, keep out '
    'anyone with a communicable disease, infected wound or acute respiratory infection, and ensure '
    'everyone handling food is "knowledgeable of and follow[s] safe food handling practices" — which '
    'is a competence duty rather than a training requirement, hence training_required = no. (C) adds '
    'facility conditions: a department-approved water supply, separate ingredient storage, "a '
    'properly functioning refrigeration unit", a sink with adequate hot water, separate handwashing '
    'facilities, a working toilet, "no evidence of insect or rodent activity", and '
    'department-approved sewage disposal.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/South-Carolina.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'SC' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- South Dakota
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'producer_address', 'producer_phone',
    'production_date', 'ingredients_desc_by_weight'
  ],
  -- 34-18-37(8): a keep-refrigerated-or-frozen directive, but only for 34-18-36.1 foods.
  optional_elements = array['handling_instructions'],
  disclaimer_text = 'This product was not produced in a commercial kitchen. It has been home-processed in a kitchen that may also process common food allergens such as tree nuts, peanuts, eggs, soy, wheat, milk, fish, and crustacean shellfish.',
  notes =
    'S.D. Codified Laws 34-18-37, read 2026-09-06: "Food prepared at a residence may not be sold '
    'unless it has a label that includes the following information: (1) Name of the product; (2) '
    'Name of the producer; (3) Physical address of production; (4) Mailing address of the producer; '
    '(5) Telephone number of the producer; (6) Date the product was made or processed; (7) '
    'Ingredients; (8) In the case of food sold in accordance with 34-18-36.1, a directive to keep '
    'refrigerated or frozen; and (9) A disclaimer that states: [the disclaimer]." THE DISCLAIMER '
    'MATCHED EXACTLY and is recorded as checked. (8) IS THE HANDLING-INSTRUCTIONS ELEMENT — South '
    'Dakota is the third state to need it after Idaho and North Dakota, and it sits in '
    'optional_elements because 34-18-36.1 reaches only refrigerated and frozen foods, which nothing '
    'here identifies. A GAP THIS ROW CANNOT CLOSE: (3) and (4) are TWO DIFFERENT ADDRESSES — the '
    'physical address where the food was produced and the producer''s mailing address. We have one '
    'producer_address element, filled from the seller''s pickup address, and no element for a '
    'separate mailing address. One state is not enough to build one on, so it is recorded here the '
    'way handling instructions were recorded for Idaho before North Dakota made it two. A South '
    'Dakota seller whose mailing address differs from their production address must add it by hand. '
    'Note also that (7) asks only for "Ingredients", with no ordering rule, so the element used is '
    'slightly stricter than the statute.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/South-Dakota.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'SD' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 34-18-38(2) requires the SALE to happen in the seller's physical presence. See venue_note.
  online_orders = 'banned',
  direct_delivery = 'banned',
  venue_note =
    'THE EXEMPTION REQUIRES THE SALE TO HAPPEN IN THE SELLER''S PHYSICAL PRESENCE, and this row '
    'previously said "No restrictions" with online_orders allowed. S.D. Codified Laws 34-18-38: "A '
    'person selling food prepared at the person''s primary residence, in accordance with 34-18-35, '
    'is exempt from the licensing and license fee provisions of this chapter if: (1) The food meets '
    'the requirements of 34-18-37; (2) The food is sold IN THE SELLER''S PHYSICAL PRESENCE at: (a) '
    'The seller''s primary residence; (b) A farmer''s market; (c) A roadside stand; or (d) Other '
    'temporary sale venue; and (3) The seller, or a person residing at the seller''s primary '
    'residence, PERSONALLY DELIVERS the food to the buyer at the completion of the sale." A sale made '
    'over the internet is not made in the seller''s physical presence, so it falls outside the '
    'exemption — hence banned, which stops South Dakota food listings here. THE COUNTER-ARGUMENT, '
    'recorded because this is a guardrail: a buyer who orders online and collects at the seller''s '
    'door does take handover in the seller''s physical presence at the seller''s primary residence, '
    'and (3) is then satisfied. Whether the "sale" in (2) is the online order or the handover is not '
    'settled by the text. Banned rather than unclear because (2) attaches physical presence to the '
    'SALE while (3) deals with delivery separately, and because being wrong the other way costs a '
    'South Dakota seller their licence exemption — the same protective direction taken for '
    'Washington. NOTE THE SHAPE: like New Hampshire, this is an exemption from LICENSURE rather than '
    'a prohibition on selling. A licensed South Dakota food operation is not covered by 34-18-38 at '
    'all, and that route is not modelled here. mail_delivery is banned on (3): a courier is not the '
    'seller or a member of their household. direct_delivery is banned on (2): a buyer''s doorstep is '
    'not one of the four venues.',
  category_note =
    'REFRIGERATED AND FROZEN FOODS ARE EXPRESSLY PERMITTED WITH TEMPERATURE CONTROL, which is why '
    'cat_refrigerated is allowed. S.D. Codified Laws 34-18-36.1 covers food "that requires time and '
    'temperature control for safety, including soft pies, cheesecake, and baked goods having a '
    'custard or cream filling, and sauces and pesto that require time and temperature control for '
    'safety, provided the food is consistently maintained at a temperature that is at or below '
    'forty-one degrees Fahrenheit; and ... Home-processed frozen fruit and produce, provided the '
    'food is consistently maintained at a temperature that is at or below zero degrees Fahrenheit." '
    'Those are the foods whose labels need the keep-refrigerated-or-frozen directive under '
    '34-18-37(8).',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/South-Dakota.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'SD' and ordinal = 1 and verified_at is null;
