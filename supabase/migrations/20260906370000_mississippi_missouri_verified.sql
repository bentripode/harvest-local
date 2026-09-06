-- Harvest Local — Mississippi and Missouri, from Miss. Code Ann. 75-29-951 and Mo. Rev. Stat.
-- 196.298, read 2026-09-06.
--
-- =========================================================================
-- MISSISSIPPI
-- =========================================================================
--
-- 1. THE DISCLAIMER WAS CAPITALISED AND THE STATUTE IS NOT.
--
-- We stored: "Made in a Cottage Food operation that is not subject to Mississippi's food safety
-- regulations."
-- 75-29-951(3)(g) requires: "Made in a cottage food operation that is not subject to Mississippi's
-- food safety regulations."
--
-- Two capital letters, added by somebody smartening up a phrase. This is the second in a row —
-- Michigan's agency name had been title-cased and ampersanded in the same way — and it is worth
-- stating the pattern plainly: `disclaimer_text` is quoted law that gets printed onto food without
-- anyone reading it again, and the habit of tidying prose is exactly what it must be protected from.
--
-- The element list at (3)(a)-(g) matched ours exactly. Recorded as checked.
--
-- 2. MISSISSIPPI IS FLORIDA'S STATUTE, ALMOST WORD FOR WORD.
--
-- The cap and the exemption share a sentence ((1)(a)); gross sales are counted "at any location,
-- regardless of the types of products sold or the number of persons involved" ((1)(b)); inspection
-- happens "Only upon receipt of a complaint" ((5)(b)); and the section "does not apply to a person
-- operating under a food permit" ((6)). Florida's 500.80 says all four in nearly the same words. So
-- the $35,000 is a genuine ceiling for this programme rather than a licensing threshold, for exactly
-- the reason Florida's $250,000 is: take the permit and you leave the programme.
--
-- 3. THE ONLINE BAN IS CONFIRMED, AND ADVERTISING IS EXPRESSLY CARVED OUT.
--
-- (2): "A cottage food operation may not sell cottage food products over the Internet, by mail
-- order, or at wholesale or to a retail establishment; however, this does not prohibit the
-- advertising of cottage food products over the Internet, including through social media." Already
-- recorded correctly by 20260906030000, and the carve-out matters to us: a Mississippi seller may
-- hold a storefront listing, they just may not take the order through it.
--
-- 4. TWO AXES SWAPPED FROM ONE UNVERIFIED VALUE TO ANOTHER.
--
-- The only category limit in the section is the last sentence of (2): "Cottage food products are
-- nonpotentially hazardous food products as defined by the department." The department's definition
-- is not in this compilation. `cat_acidified` was `allowed` and `cat_fermented` was `banned`, and
-- neither had anything behind it. Both become `unclear`, which is the honest description of what we
-- know. Neither value blocks a listing, so nothing changes for a seller.
--
-- =========================================================================
-- MISSOURI
-- =========================================================================
--
-- 5. MISSOURI PERMITS INTERNET SELLING ON A CONDITION WE ALREADY SATISFY BY CONSTRUCTION.
--
-- 196.298.5: "A cottage food production operation shall not sell any foods described in this section
-- through the internet unless both the cottage food production operation and the purchaser are
-- located in this state."
--
-- An express permission with a geographic condition — and this marketplace confines every order to a
-- single state at the data layer, so a Missouri order on Harvest Local satisfies it by construction
-- rather than by anybody remembering to. `venue_note` said "No restrictions", which missed both the
-- permission and its condition.
--
-- 6. THE LABEL STATEMENT IS PRESCRIBED BY SUBSTANCE, NOT BY WORDING — THE LOUISIANA SHAPE.
--
-- 196.298.4: "The department shall promulgate rules requiring a cottage food production operation to
-- label all of the foods described in this section which the operation intends to sell to consumers.
-- The label shall include the name and address of the cottage food production operation and A
-- STATEMENT THAT THE FOOD IS NOT INSPECTED by the department or local health department."
--
-- No sentence to quote. The row held a paraphrase — "Prepared in a kitchen that is not subject to
-- inspection by the Missouri Department of Health and Senior Services." — and its own notes admitted
-- "The source paraphrases the label statement rather than quoting it." That paraphrase is now
-- removed and replaced with the `seller_statement` element added for Louisiana, with the statute's
-- own words as the prompt.
--
-- 7. MISSOURI IS NOT A PLACARD STATE.
--
-- `placard_required` was true, carrying that same paraphrase as placard text. 196.298.4 requires the
-- statement on THE LABEL and says nothing about a sign at the point of sale. The department rules
-- promulgated under it are not in this compilation, so they might add one — but a placard we cannot
-- source, printed in words we invented, is two errors stacked. Withdrawn, and Missouri leaves the
-- placard list.
--
-- 8. LOCAL REGULATION IS PREEMPTED, AND UNUSUALLY BLUNTLY.
--
-- 196.298.2: an operation "is not a food service establishment and shall not be subject to any
-- health or food code laws or regulations of the state or department other than this section".
-- 196.298.3(1): "A local health department SHALL NOT REGULATE the production of food at a cottage
-- food production operation." `local_preemption` was already true; it is now true on the text.
--
-- `verified_at` stays null on all four rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Mississippi
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  -- Verbatim: the statute does not capitalise "cottage food operation".
  disclaimer_text = 'Made in a cottage food operation that is not subject to Mississippi''s food safety regulations.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'Miss. Code Ann. 75-29-951(3)(g) requires the statement "printed in at least ten-point type in a '
    'color that provides a clear contrast to the background of the label".',
  notes =
    'Miss. Code Ann. 75-29-951(3), read 2026-09-06. THE ELEMENT LIST WAS ALREADY EXACTLY RIGHT and '
    'is recorded as checked: "(a) The name and address of the cottage food operation; (b) The name '
    'of the cottage food product; (c) The ingredients of the cottage food product, in descending '
    'order of predominance by weight; (d) The net weight or net volume of the cottage food product; '
    '(e) Allergen information as specified by federal labeling requirements; (f) Appropriate '
    'nutritional information as specified by federal labeling requirements, if any nutritional claim '
    'is made; and (g) [the statement]." THE STATEMENT WAS NOT VERBATIM: we held "Made in a Cottage '
    'Food operation", where the statute reads "Made in a cottage food operation" — two capital '
    'letters added by tidying. The second such correction in a row after Michigan''s agency name, '
    'and worth naming as a pattern: this column holds quoted law that is printed onto food without '
    'anyone reading it again.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Mississippi.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MS' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- The bans are internet, mail order, wholesale and retail. Handing food to a consumer is none.
  direct_delivery = 'allowed',
  -- The only limit is "nonpotentially hazardous ... as defined by the department", and that
  -- definition is not in this compilation. Neither value was ever checked.
  cat_acidified = 'unclear',
  cat_fermented = 'unclear',
  -- Not addressed in the section either way.
  local_preemption = null,
  cap_note =
    'A ceiling for this programme, on Florida''s structure. 75-29-951(1)(a): an operation "is exempt '
    'from the permitting requirements of Section 41-3-18 if the cottage food operation complies with '
    'this section and has annual gross sales of cottage food products that do not exceed Thirty-five '
    'Thousand Dollars ($35,000.00)", and (6): "This section does not apply to a person operating '
    'under a food permit issued pursuant to Section 41-3-18." Take the permit and you leave the '
    'programme, so the figure is a real ceiling and pausing is right. Counting is settled by (1)(b): '
    'gross sales "include all sales of cottage food products at any location, regardless of the '
    'types of products sold or the number of persons involved in the operation", with written '
    'documentation on request. MISSISSIPPI IS FLORIDA''S STATUTE ALMOST WORD FOR WORD — the cap '
    'sentence, the counting clause, the complaint-only inspection and the permit-holder exclusion '
    'all track Fla. Stat. 500.80.',
  category_note =
    'DELEGATED, AND THE DELEGATION HAS NOT BEEN READ. The only category limit in the section is the '
    'last sentence of 75-29-951(2): "Cottage food products are nonpotentially hazardous food '
    'products as defined by the department." That excludes refrigerated food, meat and low-acid '
    'canned goods. It says nothing about acidified or fermented food, which were recorded as '
    '"allowed" and "banned" respectively with nothing behind either; both are now unclear. The '
    'department''s list, which cat_shelf_stable = list_only points at, is not in this compilation.',
  license_note =
    'No permit below the cap, and inspection only on complaint. 75-29-951(1)(a) exempts a complying '
    'operation from "the permitting requirements of Section 41-3-18". (5)(b): "Only upon receipt of '
    'a complaint, the department''s authorized officer or employee may enter and inspect the '
    'premises", with refusal "grounds for disciplinary action pursuant to Section 41-3-59". (4) '
    'preserves federal tax obligations. The section imposes no training and no product approval.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Mississippi.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MS' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Missouri
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  -- Only the name and address are Missouri's; the rest is the federal packaged-food set.
  required_elements = array[
    'producer_name', 'producer_address', 'seller_statement', 'product_name',
    'ingredients_desc_by_weight', 'net_weight'
  ],
  seller_statement_prompt =
    'a statement that the food is not inspected by the department or local health department '
    '(Mo. Rev. Stat. 196.298.4)',
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  -- 196.298.4 puts the statement on the LABEL and prescribes no sign at the point of sale.
  placard_required = false,
  placard_text = null,
  notes =
    'Mo. Rev. Stat. 196.298.4, read 2026-09-06: "The department shall promulgate rules requiring a '
    'cottage food production operation to label all of the foods described in this section which the '
    'operation intends to sell to consumers. The label shall include the name and address of the '
    'cottage food production operation and a statement that the food is not inspected by the '
    'department or local health department." MISSOURI PRESCRIBES THE SUBSTANCE AND NOT THE WORDING, '
    'like Louisiana. The row previously held a paraphrase — "Prepared in a kitchen that is not '
    'subject to inspection by the Missouri Department of Health and Senior Services." — and its own '
    'note admitted the source paraphrased rather than quoted. That is gone; the seller writes the '
    'statement at print time and is shown the statute''s own words. MISSOURI IS NOT A PLACARD STATE: '
    'placard_required was true, carrying that same invented text, and 196.298.4 requires the '
    'statement on the label and prescribes no sign at the point of sale. ONLY THE NAME AND ADDRESS '
    'ARE MISSOURI''S — the product name, ingredients and net weight kept here are the federal '
    'packaged-food set (21 CFR 101), which reaches the seller independently, since 196.298.2 '
    'displaces only STATE health and food code law. The department rules promulgated under 196.298.4 '
    'are not in this compilation and may add to this list, including possibly a prescribed wording. '
    'HONEY: the previous note recorded a recommendation to add "Honey is not recommended for infants '
    'less than 12 months of age." That is not in the statute and is dropped from the requirements; a '
    'Missouri honey seller should still consider it.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Missouri.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MO' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- Jam and jelly are permitted; acidified vegetables are not on the list.
  cat_acidified = 'conditional',
  venue_note =
    'INTERNET SELLING IS EXPRESSLY PERMITTED ON A CONDITION WE SATISFY BY CONSTRUCTION, and the row '
    'previously said "No restrictions". Mo. Rev. Stat. 196.298.5: "A cottage food production '
    'operation shall not sell any foods described in this section through the internet unless both '
    'the cottage food production operation and the purchaser are located in this state." Every order '
    'on this marketplace is confined to a single state at the data layer, so a Missouri order meets '
    'that condition without anyone having to remember it. THERE IS A TENSION IN THE STATUTE worth '
    'knowing: the definition at 196.298.1(2) describes an operation that "(a) Produces a baked good, '
    'a canned jam or jelly, or a dried herb or herb mix for sale at the individual''s home; and (b) '
    'Sells the food produced under paragraph (a) of this subdivision only directly to consumers" — '
    '"at the individual''s home" read strictly would leave no room for the internet sales '
    'subsection 5 plainly contemplates, so it is better read as describing where the operation is '
    'based. direct_delivery stays unclear for that reason: subsection 5 implies goods reaching a '
    'buyer somehow, but nothing addresses delivery, and the definition points the other way. '
    'mail_delivery stays banned on the narrower ground that the legislature carved out one remote '
    'channel by name and not that one. retail_allowed is false on (b), "only directly to consumers".',
  category_note =
    'A THREE-ITEM LIST, closed and short. Mo. Rev. Stat. 196.298.1(2)(a) defines the operation as '
    'one that "Produces a baked good, a canned jam or jelly, or a dried herb or herb mix", and '
    '1(1) defines a baked good as "cookies, cakes, breads, danish, donuts, pastries, pies, and other '
    'items that are prepared by baking the item in an oven. A baked good does not include a '
    'potentially hazardous food item as defined by department rule." cat_acidified moves from banned '
    'to conditional: a canned jam or jelly is an acid canned good and is expressly permitted, while '
    'pickles and acidified vegetables are not on the list. Fermented food is not on it either and '
    'stays banned on that closed list. Meat, refrigerated food and low-acid canned goods are all off '
    'it as well.',
  license_note =
    'None, and the preemption is unusually blunt. 196.298.2: a cottage food production operation "is '
    'not a food service establishment and shall not be subject to any health or food code laws or '
    'regulations of the state or department other than this section and rules promulgated thereunder '
    'for a cottage food production operation." 196.298.3(1): "A local health department shall not '
    'regulate the production of food at a cottage food production operation" — though (3)(2) '
    'requires both the local department and the state to "maintain a record of a complaint made by a '
    'person against a cottage food production operation", and 196.298.6 preserves the authority "to '
    'conduct an investigation of a food-borne disease or outbreak". No revenue cap, no registration, '
    'no training and no product approval appear anywhere in the section.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Missouri.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MO' and ordinal = 1 and verified_at is null;
