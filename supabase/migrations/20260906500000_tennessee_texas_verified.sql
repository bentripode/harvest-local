-- Harvest Local — Texas verified against the 2025 amendments, and Tennessee recorded as unreachable.
--
-- Tex. Health & Safety Code 437.001 and 437.0192 to 437.01965, read 2026-09-06. Several of those
-- sections carry an "(Effective 9/1/2025)" version alongside an earlier one, and today is after that
-- date, so the LATER text governs. Our row was verified in an earlier pass against the earlier text,
-- which is why parts of it are now out of date rather than wrong.
--
-- =========================================================================
-- 1. THE LABEL IS SHORTER THAN OUR ROW, AND ITS ADDRESS IS NOW OPTIONAL
-- =========================================================================
-- 437.0193(b) (effective 9/1/2025): "The label must include: (1) the name and address of the cottage
-- food production operation; and (2) the following disclosure: THIS PRODUCT WAS PRODUCED IN A
-- PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION."
--
-- Two items. Our stored disclosure matches that text exactly and is recorded as checked — the 2025
-- amendment replaced a substance-only requirement ("a statement that the food is not inspected by
-- the department or a local health department") with this prescribed wording, and an earlier pass had
-- already caught it.
--
-- (b-1) IS AN EITHER/OR WE DID NOT HAVE: "Notwithstanding Subsection (b)(1), a cottage food
-- production operation is not required to include on a food label the address of the operation if
-- the operation registers with the department in the form and manner the department prescribes and
-- includes on the label a unique identification number provided by the department." Now an
-- alternatives group.
--
-- `product_name` and `allergens` are KEPT but are not in 437.0193(b). They come from federal
-- packaged-food labelling — 21 CFR 101.3's statement of identity and 21 U.S.C. 343(w)'s allergen
-- declaration — and possibly from 25 Tex. Admin. Code 229.661, the rule 437.0193(b) directs the
-- executive commissioner to adopt, which has not been read. The note says so rather than leaving
-- them looking like statutory Texas requirements.
--
-- =========================================================================
-- 2. TEXAS PRESCRIBES ITS SAFE HANDLING WORDING, WHICH THE OTHER THREE STATES DO NOT
-- =========================================================================
-- The `handling_instructions` element was built for Idaho and North Dakota, which describe what the
-- instructions must achieve and leave the words to the seller, and South Dakota, which asks for "a
-- directive to keep refrigerated or frozen". Texas is the fourth state to need it and the first to
-- dictate the sentence — two different sentences, in fact, both in at least 12-point font:
--
--   437.0193(d), frozen raw and uncut fruit or vegetables: "SAFE HANDLING INSTRUCTIONS: To prevent
--   illness from bacteria, keep this food frozen until preparing for consumption."
--   437.0193(e)(2), time and temperature control for safety food: "SAFE HANDLING INSTRUCTIONS: To
--   prevent illness from bacteria, keep this food refrigerated or frozen until the food is prepared
--   for consumption."
--
-- Both go in `optional_elements` for the usual reason — nothing here records whether a product is
-- frozen produce or a TCS food — and the note carries the exact wording so a Texan seller types the
-- statute's sentence rather than their own.
--
-- 437.0193(e)(1) also requires "on the food label the date the food was made" for a TCS food, which
-- is `production_date`, likewise optional and conditional on the same fact.
--
-- =========================================================================
-- 3. TEXAS EXPRESSLY PERMITS WITHHOLDING THE ADDRESS UNTIL AFTER PAYMENT
-- =========================================================================
-- This is worth knowing because our pre-checkout disclosure publishes it. 437.0194(c): an operator
-- selling through the Internet "(1) is not required to include the address of the operation in the
-- labeling information required under Subsection (b)(2) before the operator accepts payment for the
-- food; and (2) shall provide the address or unique identification number of the operation on the
-- label of the food in the manner required by Section 437.0193(b) or (b-1) after the operator
-- accepts payment."
--
-- `product_label_disclosure()` returns `producer_address` unconditionally, so a Texan listing shows a
-- home address that the statute says need not appear until after the sale. That is not unlawful —
-- showing more than required never is — but it is a privacy choice the legislature made available
-- and we currently take away. Recorded here rather than changed, because the same field is required
-- BEFORE the sale in other states (Indiana wants the whole label on the website), so narrowing it
-- needs a per-state decision rather than a blanket one.
--
-- =========================================================================
-- 4. THE INTERNET RULE SURVIVED THE AMENDMENT, AND A NEW ACTOR APPEARED
-- =========================================================================
-- 437.0194(b) still permits an internet sale only if "the operator or the operator's employee or
-- household member personally delivers the food to the consumer" and the labelling information is
-- posted before payment — so `mail_delivery = banned` and `predisclosure_required = true` both hold,
-- now on the current text.
--
-- NEW IN 2025: 437.01965 creates a "cottage food vendor" who "may sell food produced by a cottage
-- food production operation ... directly to consumers at a farmers market, a farm stand, a food
-- service establishment, or any retail store", and must "display in a prominent place near the
-- location where the food is offered for sale a sign with the following disclosure: THIS PRODUCT WAS
-- PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION."
-- That placard duty falls on the VENDOR at a physical location, not on the producer, and this
-- marketplace is none of the four venues listed — so `placard_required` stays false and the concept
-- is recorded rather than modelled.
--
-- =========================================================================
-- 5. TENNESSEE COULD NOT BE REACHED, AND THAT IS RECORDED RATHER THAN GUESSED
-- =========================================================================
-- The National Agricultural Law Center has no Tennessee file (404), and the state's own rule PDF at
-- publications.tnsosfiles.com returns 403. No primary text was read, so NOTHING on the Tennessee
-- rows is changed — every value stays exactly as it was, marked as unverified.
--
-- What the row currently holds describes Rule 0080-04-11, the domestic kitchen regulations, and
-- there is a specific reason to doubt it is current: secondary sources say Tennessee replaced its
-- cottage food scheme with a food freedom law in 2022, which would postdate both that rule and the
-- "2017 amendment" our note refers to. That is a lead, not a finding — it comes from a web search
-- and this pass records only what primary text says — but it is exactly what an admin should chase.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Texas
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array['business_name', 'product_name', 'allergens'],
  -- 437.0193(b-1): the address, or a department-issued unique identification number.
  element_alternatives = '[["producer_address", "permit_number"]]'::jsonb,
  -- (e)(1) date for TCS food; (d) and (e)(2) the prescribed safe handling sentences.
  optional_elements = array['production_date', 'handling_instructions'],
  disclaimer_text = 'THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION.',
  disclaimer_all_caps = true,
  predisclosure_required = true,
  notes =
    'Tex. Health & Safety Code 437.0193 and 437.0194, read 2026-09-06 in their versions EFFECTIVE '
    '9/1/2025 — both sections carry an earlier text alongside the current one, and an earlier pass '
    'verified this row against the earlier text. THE STATUTORY LABEL IS TWO ITEMS. 437.0193(b): "The '
    'label must include: (1) the name and address of the cottage food production operation; and (2) '
    'the following disclosure: THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT '
    'TO GOVERNMENTAL LICENSING OR INSPECTION." The disclosure matches ours exactly and is recorded '
    'as checked. THE ADDRESS IS AN EITHER/OR, which this row did not express — (b-1): an operation '
    '"is not required to include on a food label the address of the operation if the operation '
    'registers with the department ... and includes on the label a unique identification number '
    'provided by the department." product_name and allergens are KEPT but are NOT in 437.0193(b): '
    'they come from federal packaged-food labelling (21 CFR 101.3, 21 U.S.C. 343(w)) and possibly '
    'from 25 Tex. Admin. Code 229.661, the rule (b) directs the executive commissioner to adopt, '
    'which has not been read. TEXAS PRESCRIBES ITS SAFE HANDLING WORDING, unlike Idaho, North Dakota '
    'and South Dakota — two sentences, both "in at least 12-point font". (d), frozen raw and uncut '
    'fruit or vegetables: "SAFE HANDLING INSTRUCTIONS: To prevent illness from bacteria, keep this '
    'food frozen until preparing for consumption." (e)(2), time and temperature control for safety '
    'food: "SAFE HANDLING INSTRUCTIONS: To prevent illness from bacteria, keep this food '
    'refrigerated or frozen until the food is prepared for consumption." A Texan seller should type '
    'the statute''s sentence, not their own. (e)(1) also puts "the date the food was made" on a TCS '
    'label, which is why production_date is optional here. (c) allows the (b) information to go on '
    'an invoice or receipt for food too large or bulky to package.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Texas.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'TX' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'Verified against the 9/1/2025 text of Tex. Health & Safety Code 437.0194. (b): an operation "may '
    'sell a food other than a food described by Section 437.002(2-b)(A)(i)-(vi) in this state '
    'through the Internet only if: (1) the consumer purchases the food through the Internet from the '
    'operation and the operator or the operator''s employee or household member PERSONALLY DELIVERS '
    'the food to the consumer; and (2) subject to Subsection (c), before the operator accepts '
    'payment for the food, the operator provides all labeling information required by Section '
    '437.0193(e) and department rules to the consumer by posting a legible statement on the '
    'operation''s Internet website." Both halves survive the amendment: mail_delivery stays banned '
    'because a carrier is not the operator, an employee or a household member, and '
    'predisclosure_required stays true. TEXAS EXPRESSLY PERMITS WITHHOLDING THE ADDRESS UNTIL AFTER '
    'PAYMENT and we do not currently offer that — (c): the operator "(1) is not required to include '
    'the address of the operation in the labeling information required under Subsection (b)(2) '
    'before the operator accepts payment for the food; and (2) shall provide the address or unique '
    'identification number of the operation on the label of the food ... after the operator accepts '
    'payment." product_label_disclosure() returns producer_address unconditionally, so a Texan '
    'listing publishes a home address the statute says need not appear until the sale is done. Not '
    'unlawful — showing more than required never is — but a privacy choice the legislature made '
    'available. NEW IN 2025, AND NOT MODELLED: 437.01965 creates a "cottage food vendor" who may '
    'sell a producer''s food "directly to consumers at a farmers market, a farm stand, a food '
    'service establishment, or any retail store" and must display a sign carrying the same '
    'disclosure. That placard duty is the vendor''s, at a physical location, and this marketplace is '
    'none of those four venues — hence placard_required stays false. 437.0194(a-1) is the wholesale '
    'route to such a vendor, which is what retail_allowed reflects.',
  category_note =
    'ACIDIFIED AND FERMENTED FOODS ARE PERMITTED ON A RECIPE CONDITION, which is what '
    'recipe_approval = conditional means. Tex. Health & Safety Code 437.01951(a): an operation "that '
    'sells to consumers pickled fruit or vegetables, fermented vegetable products, or plant-based '
    'acidified canned goods shall: (1) use a recipe that: (A) is from a source approved by the ..." '
    '[department]. TIME AND TEMPERATURE CONTROL FOR SAFETY FOOD is contemplated by the 2025 text — '
    '437.0193(e) prescribes its label — which is why cat_refrigerated is allowed; note the earlier '
    '437.0196 flatly prohibited it, and that section became part of 437.001 on 9/1/2025. Its '
    'definition is worth keeping: a TCS food "may include a food that contains protein and moisture '
    'and is neutral or slightly acidic, such as meat, poultry, fish, and shellfish products, '
    'pasteurized and unpasteurized milk and dairy products, raw seed sprouts, baked goods that '
    'require refrigeration, including cream or custard pies or cakes, and ice products."',
  license_note =
    'No licence, but training is mandatory. Tex. Health & Safety Code 437.0195(a): "An individual '
    'who operates a cottage food production operation must have successfully completed a basic food '
    'safety education or training program for food handlers accredited under Subchapter D, Chapter '
    '438." (b) extends it: nobody may "process, prepare, package, or handle cottage food products" '
    'unless they meet (a), are directly supervised by someone who does, or are "a member of the '
    'household in which the cottage food products are produced." 437.0195 5 (sampling and donation, '
    'effective 9/1/2025) additionally lets an operation give samples anywhere in the state and '
    'donate non-TCS food to bake sales.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Texas.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'TX' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Tennessee — no primary text reached. Nothing is changed but the record of that.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes = notes ||
    ' NOT VERIFIED — NO PRIMARY TEXT COULD BE REACHED on 2026-09-06. The National Agricultural Law '
    'Center has no Tennessee file (404) and the state''s own rule PDF at publications.tnsosfiles.com '
    'returns 403, so every value on this row is left exactly as it was rather than adjusted on a '
    'secondary source. THERE IS A SPECIFIC REASON TO DOUBT IT IS CURRENT: what is recorded here '
    'describes Rule 0080-04-11, the domestic kitchen regulations, and secondary sources say '
    'Tennessee replaced its cottage food scheme with a food freedom law in 2022 — which would '
    'postdate both that rule and the "2017 amendment" this note refers to. That is a lead rather '
    'than a finding, since it comes from a web search and this table records primary text, but it is '
    'what an admin should chase first. Until then, treat the metric requirement, the lot code and '
    'the absence of a disclaimer as unchecked.'
where program_id in (select id from public.state_food_programs where state_code = 'TN' and ordinal = 1)
  and verified_at is null
  and notes not like '%NOT VERIFIED — NO PRIMARY TEXT%';

update public.state_food_programs set
  venue_note =
    'NOT VERIFIED. The note here ("No restrictions") is the summary''s, and no Tennessee primary text '
    'could be reached on 2026-09-06 — the National Agricultural Law Center has no Tennessee file and '
    'the state rule PDF returns 403. Nothing on this row has been changed. Secondary sources '
    'indicate Tennessee replaced its cottage food scheme with a FOOD FREEDOM LAW IN 2022, which '
    'would supersede the Rule 0080-04-11 domestic kitchen regulations this row appears to describe. '
    'An admin should read that law before relying on any flag here, and in particular before '
    'relying on online_orders = allowed.',
  source_checked_at = '2026-09-06'
where state_code = 'TN' and ordinal = 1 and verified_at is null;
