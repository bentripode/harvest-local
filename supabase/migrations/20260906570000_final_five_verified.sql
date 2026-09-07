-- Harvest Local — Virginia, Washington, West Virginia, Wisconsin and Wyoming. The pass ends here.
--
-- SOURCES, all read 2026-09-06 from each legislature's own site:
--   VA  Va. Code § 3.2-5130 (law.lis.virginia.gov) — AS AMENDED BY 2026 c. 605
--   WA  RCW 69.22.010 to 69.22.110 (app.leg.wa.gov), full chapter
--   WV  W. Va. Code §§ 19-40-1 to 19-40-6 and § 19-35-6 (code.wvlegislature.gov)
--   WI  Wis. Stat. § 97.29 (docs.legis.wisconsin.gov)
--   WY  Wyo. Stat. §§ 11-49-102 and 11-49-103 (wyoleg.gov, Title 11 compilation)
--
-- =========================================================================
-- 1. VIRGINIA'S CAP WAS AMENDED OUT FROM UNDER US THIS YEAR
-- =========================================================================
-- `state_cottage_food_rules.revenue_cap` for VA held $9,000, and the admin note signed on 2026-09-05
-- says it "applies to BOTH home-kitchen subdivisions: subdivision 3 ... and subdivision 4 ... each
-- end with 'not exceeding $9,000 in gross sales in a calendar year'". That was true of the text as
-- it then stood. **It is not true of the current section.**
--
-- § 3.2-5130(C)(3), as amended by 2026 c. 605, now ends at five conditions and none of them is a
-- cap: "(i) those that do not require time or temperature control after preparation; (ii) sold at
-- any location, through the internet, or by phone ...; (iii) delivered in person, by mail, or by
-- delivery service ...; (iv) not offered for sale to be used in or offered for consumption in retail
-- food establishments; and (v) affixed with a label ...". Subdivision 4 — pickles and other acidified
-- vegetables at pH 4.6 or lower — still ends "(v) not exceeding $9,000 in gross sales in a calendar
-- year."
--
-- So the $9,000 is ACIDIFIED-ONLY. Left in the state-wide fallback column it would pause a Virginian
-- selling nothing but jam and bread at $9,000.01, on a limit their subdivision no longer carries.
-- It moves to the programme row as `cap_basis = 'per_category'`, `cap_category = 'acidified'`.
--
-- **Virginia is the `per_category` example again**, and this is the third figure that row has held:
-- a seeded $3,000 acidified-only, then a corrected $9,000 annual-total, now a $9,000 acidified-only.
-- The seed had the right SHAPE and the wrong number; the correction had the right number and the
-- wrong shape; the statute has both.
--
-- =========================================================================
-- 2. TWO MORE DISCLAIMERS THAT HAD BEEN TIDIED, AND TWO THAT BELONG TO ANOTHER PROGRAMME
-- =========================================================================
-- VIRGINIA. Stored: "NOT FOR RESALE - PROCESSED AND PREPARED WITHOUT STATE INSPECTION." The statute
-- has no dash: subdivision 3 prescribes "NOT FOR RESALE PROCESSED AND PREPARED WITHOUT STATE
-- INSPECTION." (subdivision 4's is identical without the closing period). A hyphen we inserted is
-- still our punctuation on quoted law printed onto food.
--
-- WYOMING. Stored: "This food was made in a home kitchen, is not regulated or inspected and may
-- contain allergens." W.S. 11-49-103(k) requires the food be "clearly and prominently labeled with
-- 'this food was made in a home kitchen, is not regulated or inspected and may contain allergens'".
-- Lower case, no closing period, inside the quotation marks. Ours had been sentence-cased.
--
-- WEST VIRGINIA carried "This product was produced at a private residence that is exempt from state
-- licensing and inspection. This product may contain allergens." That is **Tennessee's statutory
-- sentence** (and Arkansas's). No West Virginia authority prescribes it: § 19-35-6(c) says only that
-- nonpotentially hazardous foods "shall be labeled in compliance with the department's labeling
-- standards", delegating the whole thing. It is removed rather than printed as though it were law.
--
-- WISCONSIN'S HOME BAKING row carried the home-canning statute's sentence. Wis. Stat.
-- § 97.29(2)(b)2.e. prescribes "This product was made in a private home not subject to state
-- licensing or inspection." for the CANNING exemption only; the baked-goods route exists because of
-- a 2017 Lafayette County Circuit Court injunction and has no statute behind it at all. Removed from
-- the baking row, kept verbatim on the canning row.
--
-- =========================================================================
-- 3. WISCONSIN NEEDS A SIGN, AND WE HAD NOT RECORDED ONE
-- =========================================================================
-- § 97.29(2)(b)2.d.: the seller "displays a sign at the place of sale stating: 'These canned goods
-- are homemade and not subject to state inspection.'" That is a second, DIFFERENT sentence from the
-- label statement at 2.e. — the same label/placard split Colorado and Illinois have, and the third
-- state found with it. `placard_required` was false.
--
-- =========================================================================
-- 4. WEST VIRGINIA'S REAL HOME IS IN THE FARMERS MARKET ARTICLE
-- =========================================================================
-- § 19-40-6 sends the ordinary case straight out of the cottage food article: "The production and
-- sale of a nonpotentially hazardous food, when done in conformity with § 19-35-6 and the
-- accompanying legislative rules, is not subject to the provisions of this article." So the row's
-- channel rules live in § 19-35-6(b), and they are express: sale "by the producer to the consumer,
-- whether in person or remotely, or by an agent of the producer or a third-party vendor", delivery
-- "by the producer, an agent of the producer, a third-party vendor, or a third-party carrier".
-- Online, mail and retail were all recorded correctly on a summary and are now on words.
--
-- The category axes were not. Five of the six read `banned`, and West Virginia expressly
-- contemplates potentially hazardous cottage food: § 19-40-2(a) creates a permit for exactly that,
-- § 19-40-5(c) says "Potentially hazardous cottage food standards shall be determined, including
-- acidified foods", and the definition of "Produce" in § 19-40-1 lists "fermenting" and "preserving"
-- among the things a producer does. Only MEAT is genuinely banned, by the definition of "cottage
-- food" itself: it "excludes meat, meat products, poultry, poultry products, seafood, and Grade A
-- dairy products".
--
-- =========================================================================
-- 5. WYOMING BANS MEAT, WITH SEVEN EXCEPTIONS, AND TELLS THE BUYER FIRST
-- =========================================================================
-- Every axis on the Wyoming row read `allowed`. W.S. 11-49-103(c)(v) says transactions shall "Not
-- involve the sale of meat products", then lists the exceptions — poultry under a 1,000-bird
-- own-raising limit, live animals, portions of live animals before slaughter, domestic rabbit meat,
-- farm-raised fish that is not catfish, an animal share under § 11-49-104, and (n) meat products.
-- `conditional`, not `allowed`.
--
-- And Wyoming is a PREDISCLOSURE state by the same route as Utah, which is to say by the structure
-- of the exemption rather than by a labelling rule. § 11-49-102(a)(v) defines the "informed end
-- consumer" as one "who has been informed that the product is not licensed, regulated or inspected",
-- and (e) puts the duty on the producer: "The producer shall inform the end consumer that any food
-- product or food sold at a farmers market or through ranch, farm or home based sales pursuant to
-- this act is not certified, labeled, licensed, packaged, regulated or inspected." Substance
-- prescribed, wording left open — a `seller_statement`, shown before the sale.
--
-- The $250,000 stays, and it is a real boundary rather than a licensing line: § 11-49-102(a)(vi)
-- makes it part of the definition of "Producer", so a person over it is not a producer and the Act
-- does not reach them at all. It is a TWO-part test — "does not produce more than two hundred fifty
-- thousand (250,000) individual food or drink products annually and does not exceed two hundred
-- fifty thousand dollars ($250,000.00) in gross revenue annually" — and only the money half is
-- modelled here.
--
-- =========================================================================
-- 6. WHY WASHINGTON'S AND WISCONSIN'S FIGURES STAY IN THE CAP COLUMN AND VERMONT'S DID NOT
-- =========================================================================
-- The line is not "does crossing it require a licence" — all three do. It is WHICH ROW THE FIGURE
-- SITS ON. Vermont's $30,000 was in `state_cottage_food_rules`, the state-wide fallback, so it
-- reached Vermont sellers on licensed routes that the figure has nothing to do with. Washington's
-- and Wisconsin's sit on the programme rows they actually bound, and a seller who outgrows the
-- exemption moves to a different programme rather than tripping a limit that was never theirs.
--
-- Washington also says it outright. RCW 69.22.050(2): above $35,000 "the cottage food operation must
-- either obtain a food processing plant license under chapter 69.07 RCW or cease operations", and
-- 69.22.070(1)(e) makes exceeding the limit a ground to revoke the permit.
--
-- =========================================================================
-- 7. NOT TOUCHED
-- =========================================================================
-- `state_cottage_food_rules` for WA, WV, WI and WY are admin-verified and their figures survive the
-- reading: Washington $35,000, Wyoming $250,000, West Virginia and Wisconsin no cap. Only Virginia's
-- moves. `verified_at` is neither set nor cleared anywhere below.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Virginia — the state fallback loses a cap that is now acidified-only.
-- ---------------------------------------------------------------------------
update public.state_cottage_food_rules set
  revenue_cap = null,
  notes = notes ||
    ' CORRECTION (20260906570000): revenue_cap held $9,000 and is now null. Va. Code 3.2-5130 was '
    'AMENDED BY 2026 c. 605, and subdivision (C)(3) — the candies, jams, dried fruits and baked '
    'goods route — no longer carries a gross sales limit; it ends at five conditions, none of them a '
    'cap. The $9,000 survives only in subdivision (C)(4), on "pickles and other acidified vegetables '
    'that have an equilibrium pH value of 4.6 or lower". Left in this column it would have paused a '
    'Virginian selling only jam and bread at $9,000.01 on a limit their subdivision no longer has. '
    'The figure now sits on the programme row as cap_basis = per_category with cap_category = '
    'acidified, which is what record_order_revenue needs to apply it to the right bucket. The note '
    'above was accurate against the pre-2026 text.'
where state_code = 'VA' and revenue_cap is not null;

update public.state_food_programs set
  online_orders = 'allowed',
  mail_delivery = 'allowed',
  direct_delivery = 'allowed',
  retail_allowed = false,
  revenue_cap = 9000,
  cap_basis = 'per_category',
  cap_category = 'acidified',
  cap_note =
    'ACIDIFIED ONLY. Va. Code 3.2-5130(C)(4)(v), "not exceeding $9,000 in gross sales in a calendar '
    'year", applies to the pickles-and-acidified-vegetables subdivision alone. Subdivision (C)(3), '
    'as amended by 2026 c. 605, has no gross sales limit at all — so a seller of jams and baked '
    'goods is uncapped and a seller of pickles is capped, which is exactly what cap_basis = '
    'per_category exists to express. Previously recorded as a $9,000 annual_total, and before that '
    'as a $3,000 acidified-only figure that is not in the statute.',
  cat_shelf_stable = 'list_only',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'conditional',
  category_note =
    'Subdivision (C)(3) is a CLOSED LIST, not an illustration: "candies, jams, and jellies not '
    'considered to be low-acid or acidified low-acid food products, dried fruits, dry herbs, dry '
    'seasonings, dry mixtures, coated and uncoated nuts, vinegars and flavored vinegars, popcorn, '
    'popcorn balls, cotton candy, dried pasta, dry baking mixes, roasted coffee, dried tea, cereals, '
    'trail mixes, granola, and baked goods", all of which must "not require time or temperature '
    'control after preparation". That is what makes shelf-stable list_only rather than the '
    'unrestricted it was, and what bans refrigerated. MEAT is nowhere on the list. LOW-ACID CANNED '
    'is excluded by name from (C)(3) and by the pH 4.6 ceiling in (C)(4). ACIDIFIED is the whole of '
    '(C)(4) and is capped at $9,000. FERMENTED moves from banned to conditional: a fermented '
    'vegetable pickle reaching an equilibrium pH of 4.6 or lower is a pickle within (C)(4), and '
    'nothing distinguishes how the acidity was arrived at.',
  license_required = 'no',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = false,
  venue_note =
    'Va. Code 3.2-5130(C)(3) and (C)(4), AS AMENDED BY 2026 c. 605, read 2026-09-06 at '
    'law.lis.virginia.gov. Both subdivisions permit sale "at any location, through the internet, or '
    'by phone to an individual in the Commonwealth for his own consumption and not for resale or '
    'consignment" and delivery "in person, by mail, or by delivery service", and each adds that '
    'nothing in it prohibits advertising the product on the Internet. RETAIL IS BARRED TWICE OVER: '
    'the sale must be for the buyer''s "own consumption and not for resale or consignment", and the '
    'products must be "not offered for sale to be used in or offered for consumption in retail food '
    'establishments". (D) exempts a qualifying private home from permit, inspection and inspection '
    'fees, but expressly preserves the Department''s right to inspect on a consumer complaint.',
  source_url = 'https://law.lis.virginia.gov/vacode/title3.2/chapter51/section3.2-5130/',
  source_checked_at = '2026-09-06'
where state_code = 'VA' and ordinal = 1;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'producer_phone', 'production_date',
    'product_name', 'ingredients_desc_by_weight', 'net_weight'
  ],
  optional_elements = array['nutrition_if_claimed'],
  disclaimer_text = 'NOT FOR RESALE PROCESSED AND PREPARED WITHOUT STATE INSPECTION.',
  disclaimer_all_caps = true,
  notes =
    'Va. Code 3.2-5130(C)(3)(v) and (C)(4)(iv), as amended by 2026 c. 605, read 2026-09-06. The '
    'label must be "placed on the principal display panel" and display "the name, physical address '
    'or post office box number, and telephone number of the person preparing the food product, the '
    'date the food product was processed, and the statement". '
    'THE DASH WAS OURS. The stored disclaimer read "NOT FOR RESALE - PROCESSED AND PREPARED WITHOUT '
    'STATE INSPECTION." and the statute has no dash. Subdivision (C)(4) prints the same words '
    'without the closing period; (C)(3)''s version, with it, is what is stored, and the difference '
    'is recorded here rather than reconciled away. '
    'A POST OFFICE BOX SATISFIES THE ADDRESS. The statute says "physical address or post office box '
    'number", so a seller who has set a mailing address rather than a street one is compliant; our '
    'producer_address element is filled from the pickup address and cannot express that choice. '
    'A SIGN MAY STAND IN FOR THE LABEL on small packaging: (C)(3)(v) allows a product "in packaging '
    'not large enough to bear such a label" to be "offered for sale with a sign displaying" the same '
    'information. That is an alternative to labelling rather than a point-of-sale placard '
    'requirement, so placard_required stays false. '
    'PRODUCT NAME, NET WEIGHT AND THE INGREDIENT LIST ARE NOT IN 3.2-5130. They are kept so a label '
    'can be printed at all, and they come from federal packaged-food labelling — 21 CFR 101.3, '
    '101.105 and 101.4 — not from Virginia''s own list. Same treatment as the Texas row.',
  source_url = 'https://law.lis.virginia.gov/vacode/title3.2/chapter51/section3.2-5130/',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'VA' and ordinal = 1);

-- Virginia's licensed route: inspected, so it must not claim otherwise.
update public.state_food_programs set
  retail_allowed = true,
  revenue_cap = null,
  cap_basis = 'none',
  license_required = 'yes',
  license_note =
    'Va. Code 3.2-5130(A): it is unlawful to operate as a food manufacturer until the operation "has '
    'been inspected by the Commissioner" and a permit has issued under 3.2-5100(C), though it may '
    'operate pending the permit if the inspection finds no significant health hazard, and the permit '
    'is processed within 30 days of the inspection.',
  inspection_required = true,
  recipe_approval = 'unclear',
  training_required = 'unclear',
  training_note =
    'Neither recipe approval nor training appears in 3.2-5130; both were recorded as required on a '
    'summary. Whatever a Virginia food manufacturer must do beyond permit and inspection is in the '
    'Department''s regulations (2 VAC 5-585 and related), which were not read here.',
  local_preemption = false,
  venue_note =
    'The licensed counterpart to the home-kitchen exemptions: a permitted food manufacturer under '
    'Va. Code 3.2-5130(A), read 2026-09-06. The section imposes no restriction on where or how a '
    'permitted manufacturer sells — the channel conditions in (C)(3) and (C)(4) are conditions of '
    'the EXEMPTION, and a permitted operation is not relying on them. That is why online, mail and '
    'retail are open here and constrained on the exemption row.',
  source_url = 'https://law.lis.virginia.gov/vacode/title3.2/chapter51/section3.2-5130/',
  source_checked_at = '2026-09-06'
where state_code = 'VA' and ordinal = 2;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'net_weight', 'business_name', 'producer_address'
  ],
  optional_elements = array['nutrition_if_claimed'],
  disclaimer_text = null,
  disclaimer_all_caps = false,
  notes =
    'THE HOME-KITCHEN DISCLAIMER HAS BEEN REMOVED, DELIBERATELY. This row carried "NOT FOR RESALE '
    'PROCESSED AND PREPARED WITHOUT STATE INSPECTION.", which Va. Code 3.2-5130(C)(3)(v) and '
    '(C)(4)(iv) require of a private home operating WITHOUT inspection. A permitted food '
    'manufacturer under 3.2-5130(A) has been inspected by the Commissioner, so the sentence would be '
    'false on its jars — the same reason Vermont''s two licensed routes and Maryland''s on-farm row '
    'lost theirs. '
    'Nothing in 3.2-5130 prescribes a label for a permitted manufacturer. The elements kept here are '
    'federal packaged-food labelling (21 CFR 101), recorded so a label can be printed and flagged '
    'here as federal rather than Virginia''s own list. The Department''s food regulations were not '
    'read.',
  source_url = 'https://law.lis.virginia.gov/vacode/title3.2/chapter51/section3.2-5130/',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'VA' and ordinal = 2);

-- ---------------------------------------------------------------------------
-- Washington — the ban confirmed, the label completed.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'banned',
  mail_delivery = 'banned',
  direct_delivery = 'unclear',
  retail_allowed = false,
  revenue_cap = 35000,
  cap_basis = 'annual_total',
  cap_note =
    'RCW 69.22.050(1)(a): "the annual gross sales of cottage food products may not exceed $35,000", '
    'computed "on the basis of the amount of gross sales within or at a particular domestic '
    'residence" and not per person, with the department reviewing and CPI-adjusting the figure by '
    'expedited rulemaking every four years — so this number moves and should be re-read. It is a '
    'genuine stop, not a licensing line: (2) says the operation "must either obtain a food '
    'processing plant license under chapter 69.07 RCW or cease operations", and 69.22.070(1)(e) '
    'makes exceeding it a ground to revoke the permit.',
  cat_shelf_stable = 'list_only',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'banned',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'banned',
  category_note =
    'RCW 69.22.010(2): cottage food products are "nonpotentially hazardous baked goods; baked '
    'candies and candies made on a stovetop; jams, jellies, preserves, and fruit butters as defined '
    'in 21 C.F.R. Sec. 150 as it existed on July 22, 2011; and other nonpotentially hazardous foods '
    'identified by the director in rule" — a closed list plus a rule-made list, which is what '
    'list_only records. The same subsection bans any ingredient at "a tetrahydrocannabinol '
    'concentration of 0.3 percent or greater". Everything else is banned because it is not on the '
    'list, not because the statute names it.',
  license_required = 'yes',
  license_note =
    'RCW 69.22.030: permitted every two years, with an inspection fee under 69.22.040, a $75 public '
    'health review fee and a $30 processing fee, plus documentation that everyone involved in '
    'preparation holds a food and beverage service worker''s permit under ch. 69.06 RCW. The '
    'applicant must also sign a document granting the director the right to enter the residence for '
    'inspections.',
  inspection_required = true,
  recipe_approval = 'no',
  recipe_note =
    'Recorded as required on a summary; the chapter has no recipe approval. What exists is the '
    'director''s power under 69.22.010(2) to identify permitted foods in rule, which is a list and '
    'is captured by cat_shelf_stable = list_only.',
  training_required = 'yes',
  training_note =
    'RCW 69.22.030(2) and 69.22.040(2)(f)(i): every individual preparing cottage food products must '
    'hold a food and beverage service worker''s permit under chapter 69.06 RCW, and the annual '
    'hygiene inspection checks for it.',
  local_preemption = false,
  venue_note =
    'RCW 69.22.020(4), read in full at app.leg.wa.gov 2026-09-06: "Cottage food products may only be '
    'sold directly to the consumer and may not be sold by internet, mail order, or for retail sale '
    'outside the state." Confirmed against the chapter text, having previously been verified through '
    'a compilation. 69.22.020(2) adds that the food "may not be repackaged, sold, or used as an '
    'ingredient in other foods by a food processing plant, or sold by a food service establishment", '
    'and (5) that products "must be stored only in the primary domestic residence". Washington is '
    'one of the states where a food listing on this marketplace is unlawful outright.',
  source_url = 'https://app.leg.wa.gov/RCW/default.aspx?cite=69.22&full=true',
  source_checked_at = '2026-09-06'
where state_code = 'WA' and ordinal = 1;

update public.state_label_rules set
  required_elements = array[
    'business_name', 'permit_number', 'product_name', 'ingredients_desc_by_weight', 'net_weight',
    'allergens'
  ],
  optional_elements = array['nutrition_if_claimed'],
  disclaimer_text = 'Made in a home kitchen that has not been subject to standard inspection criteria.',
  disclaimer_min_pt = 11,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'At least the equivalent of eleven-point font size, "in a color that provides a clear contrast '
    'to the background" (RCW 69.22.020(3)(g)).',
  notes =
    'RCW 69.22.020(3), read 2026-09-06. The list is "(a) The name and permit number issued under RCW '
    '69.22.030 of the business of the cottage food operation; (b) The name of the cottage food '
    'product; (c) The ingredients of the cottage food product, in descending order of predominance '
    'by weight; (d) The net weight or net volume of the cottage food product; (e) Allergen labeling '
    'as specified by the director in rule; (f) If any nutritional claim is made, appropriate '
    'labeling as specified by the director in rule; (g) The following statement ...". '
    'ALLERGENS WERE MISSING from the stored elements and are added — (e) is a flat requirement, not '
    'a conditional one. The nutrition item at (f) is conditional on a claim, which is exactly what '
    'the optional list is for. The disclaimer text was already exact; what it lacked was the '
    'contrasting-colour instruction that sits in the same clause as the point size. '
    '69.22.020(1)(e) lets the director add "Labeling specificity beyond the requirements of this '
    'section" by rule, so WAC 16-149 may carry more than this.',
  source_url = 'https://app.leg.wa.gov/RCW/default.aspx?cite=69.22&full=true',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'WA' and ordinal = 1);

-- ---------------------------------------------------------------------------
-- West Virginia — the article that governs it is a different article.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'allowed',
  mail_delivery = 'allowed',
  direct_delivery = 'allowed',
  retail_allowed = true,
  revenue_cap = null,
  cap_basis = 'none',
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'conditional',
  cat_meat = 'banned',
  cat_acidified = 'conditional',
  cat_low_acid_canned = 'unclear',
  cat_fermented = 'conditional',
  category_note =
    'FIVE OF THESE SIX READ "banned" AND WEST VIRGINIA EXPRESSLY ALLOWS POTENTIALLY HAZARDOUS '
    'COTTAGE FOOD. W. Va. Code 19-40-2(a) creates a "potentially hazardous cottage food vendor '
    'permit" for exactly that, 19-40-5(c) says "Potentially hazardous cottage food standards shall '
    'be determined, including acidified foods, and other categories identified and defined by the '
    'department", and 19-40-1 defines "Produce" as preparing food "by cooking, baking, drying, '
    'mixing, cutting, fermenting, preserving, dehydrating, growing, raising, or other process". So '
    'refrigerated, acidified and fermented are conditional on holding that permit, not forbidden. '
    'MEAT IS THE ONE REAL BAN, and it is in the definition of cottage food itself: the term '
    '"excludes meat, meat products, poultry, poultry products, seafood, and Grade A dairy products". '
    'LOW-ACID CANNED is unclear because 19-40-5(c) leaves the categories to the department and no '
    'text read here names it. Nonpotentially hazardous food needs no permit at all (19-40-2(d)(2)).',
  license_required = 'conditional',
  license_note =
    'No permit for the ordinary case, a permit for the hazardous one. W. Va. Code 19-40-2(a) '
    'requires a potentially hazardous cottage food vendor permit of "a person wanting to sell '
    'potentially hazardous cottage food", and (d) exempts "(1) A person selling fresh, uncut '
    'produce; (2) A person selling nonpotentially hazardous foods; and (3) A person selling other '
    'farm and food products that are identified by the department". Sitting behind that, 19-35-6(a) '
    'exempts the production and sale of nonpotentially hazardous foods from "licensing, permitting, '
    'inspection, packaging, and labeling laws of this state" outright. The permit "is valid in all '
    'counties in this state" (19-40-2(b)) and its holder needs no separate food establishment permit '
    'to sell from home (19-40-2(c)).',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = true,
  venue_note =
    'W. Va. Code 19-35-6 is where this row actually lives: 19-40-6 says "The production and sale of '
    'a nonpotentially hazardous food, when done in conformity with 19-35-6 and the accompanying '
    'legislative rules, is not subject to the provisions of this article." Read 2026-09-06. '
    '19-35-6(b) is express about channel: the food "must be sold by the producer to the consumer, '
    'whether in person or REMOTELY, or by an agent of the producer or a third-party vendor", and '
    '"must be delivered to the consumer by the producer, an agent of the producer, a third-party '
    'vendor, or a third-party carrier". Online, mail and retail were right on the summary and are '
    'now on the words. INTRASTATE ONLY: 19-40-2(b), "A cottage food produced pursuant to this '
    'article shall be sold only within the geographic boundaries of the State of West Virginia". '
    'PREEMPTION IS REAL BUT NOT TOTAL: 19-35-6(f) preempts county and municipal regulation, '
    'excepting space rentals at government facilities, government-sanctioned events, product '
    'placement agreements and temporary events of 14 days or less — and 19-40-3 lets a local health '
    'department order cessation of production where it believes an imminent health hazard exists.',
  source_url = 'https://code.wvlegislature.gov/19-35-6/',
  source_checked_at = '2026-09-06'
where state_code = 'WV' and ordinal = 1;

update public.state_label_rules set
  disclaimer_text = null,
  disclaimer_all_caps = false,
  notes =
    'THE DISCLAIMER ON THIS ROW WAS ANOTHER STATE''S STATUTE. It read "This product was produced at '
    'a private residence that is exempt from state licensing and inspection. This product may '
    'contain allergens." — the sentence Tenn. Code 53-1-118(b)(4)(D) prescribes, and which Arkansas '
    'uses too. No West Virginia authority prescribes it. It is removed rather than printed onto food '
    'as though it were West Virginia law. '
    'WHAT WEST VIRGINIA ACTUALLY DOES IS DELEGATE. W. Va. Code 19-35-6(c): "All nonpotentially '
    'hazardous foods shall be labeled in compliance with the department''s labeling standards and '
    'provide information about their content and sources." 19-40-5(d) says the same for the '
    'potentially hazardous route. The Department of Agriculture''s labelling standards were not '
    'located on 2026-09-06 and are what an admin should read before signing this row off. '
    'THE ELEMENTS ARE KEPT AND ARE NOT SOURCED TO A STATUTE. Producer name, address, telephone, '
    'product name and an ingredient list are what the summary listed; they are plausible, they '
    'satisfy "content and sources" on its face, and nothing here is false. But they are not quoted '
    'law, and the missing piece is the department''s standards, not this list.',
  source_url = 'https://code.wvlegislature.gov/19-35-6/',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'WV' and ordinal = 1);

-- ---------------------------------------------------------------------------
-- Wisconsin — two routes, one of which has no statute at all.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'allowed',
  mail_delivery = 'allowed',
  direct_delivery = 'unclear',
  retail_allowed = false,
  revenue_cap = null,
  cap_basis = 'none',
  cat_shelf_stable = 'limited',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'banned',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'banned',
  category_note =
    'BAKED GOODS ONLY, and the boundary is a court order rather than a statute: the 2017 Lafayette '
    'County Circuit Court injunction against enforcing the food processing plant licence requirement '
    'on home-baked goods, clarified in 2021 to reach anything baked in an oven that is not '
    'potentially hazardous. That is why shelf-stable is limited rather than unrestricted. MEAT was '
    'recorded as conditional with a note about 1,000 poultry and 3,000 rabbits — those figures '
    'belong to Wis. Stat. 97.42 meat establishments and have nothing to do with a home baking '
    'injunction, so meat is banned here. Anything acidified, canned or fermented belongs on the '
    'other Wisconsin row, which has an actual statute.',
  license_required = 'no',
  license_note =
    'NOT A STATUTORY EXEMPTION. Wis. Stat. 97.29(1)(h) lists the places exempt from the food '
    'processing plant licence and home bakeries are not among them; 97.29(2)(b)2 exempts home '
    'CANNING and nothing else. This route exists because a court enjoined enforcement, which is a '
    'weaker and narrower thing than an exemption and can change with litigation. The injunction '
    'itself was not read on 2026-09-06 — this row rests on the description in the admin-verified '
    'state rule note, and that is the gap to close before signing it off.',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = false,
  venue_note =
    'Wis. Stat. 97.29 read at docs.legis.wisconsin.gov 2026-09-06. THE STATUTE IS SILENT ON THIS '
    'ROUTE ENTIRELY, so there is no venue rule to record — which is itself the difference from the '
    'home canning row, whose exemption at 97.29(2)(b)2.b is confined to "a community or social event '
    'or a farmers'' market in this state". An injunction against enforcing a licence requirement '
    'carries no venue list with it, which is why online and mail are allowed here and banned there.',
  source_url = 'https://docs.legis.wisconsin.gov/document/statutes/97.29',
  source_checked_at = '2026-09-06'
where state_code = 'WI' and ordinal = 1;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'product_name', 'production_date', 'allergens',
    'ingredients_desc_by_weight'
  ],
  disclaimer_text = null,
  disclaimer_all_caps = false,
  notes =
    'THE DISCLAIMER BELONGED TO THE OTHER WISCONSIN ROUTE. "This product was made in a private home '
    'not subject to state licensing or inspection." is prescribed by Wis. Stat. 97.29(2)(b)2.e for '
    'the HOME CANNING exemption. This row is the baked-goods route, which exists by court injunction '
    'and has no statute behind it — so it has no prescribed label either, and printing the canning '
    'statute''s sentence on a loaf would be attributing a requirement to a law that does not reach '
    'it. Removed here, kept verbatim on the canning row. '
    'The elements are the summary''s, which itself worded them as "should" rather than "must". They '
    'are kept so a label can be printed and are flagged here as guidance rather than law. DATCP''s '
    'published guidance for home bakers, and the injunction''s own terms, are what an admin should '
    'read before signing this row off.',
  source_url = 'https://docs.legis.wisconsin.gov/document/statutes/97.29',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'WI' and ordinal = 1);

update public.state_food_programs set
  online_orders = 'banned',
  mail_delivery = 'banned',
  direct_delivery = 'banned',
  retail_allowed = false,
  revenue_cap = 5000,
  cap_basis = 'annual_total',
  cap_note =
    'Wis. Stat. 97.29(2)(b)2.c: the exemption applies only where "The person receives less than '
    '$5,000 per year from the sale of the food products". Above it a food processing plant licence '
    'under 97.29(2)(a) is required, with fees from $40 to $270 plus a $195 canning surcharge under '
    '97.29(3)(b). It stays in the cap column rather than license_threshold because it bounds THIS '
    'programme: a seller who licenses is no longer on this row.',
  cat_shelf_stable = 'limited',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'allowed',
  category_note =
    'Wis. Stat. 97.29(2)(b)2.a: the exemption reaches only "pickles or other processed vegetables or '
    'fruits with an equilibrium pH value of 4.6 or lower". Acidified and fermented vegetables and '
    'fruits are the whole of it — hence limited on shelf-stable. LOW-ACID CANNED moves from allowed '
    'to banned: the pH 4.6 ceiling is precisely what excludes it, and it was the single most '
    'permissive wrong value on this row. Meat and refrigerated are not vegetables or fruits.',
  license_required = 'no',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = false,
  venue_note =
    'Wis. Stat. 97.29(2)(b)2.b, read 2026-09-06: the person must sell "at a community or social '
    'event or a farmers'' market in this state". AN EXCLUSIVE VENUE LIST, and an internet sale is '
    'not on it — which is a ban by exhaustive enumeration, the same shape as Delaware''s on-farm '
    'route and Maine''s. direct_delivery moves from unclear to banned for the same reason: delivery '
    'to a buyer''s door is not a community event or a farmers'' market either. The exemption is also '
    'only from the food processing plant LICENCE (97.29(2)(b)2 opening words), not from the rest of '
    'ch. 97.',
  source_url = 'https://docs.legis.wisconsin.gov/document/statutes/97.29',
  source_checked_at = '2026-09-06'
where state_code = 'WI' and ordinal = 2;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'production_date', 'ingredients_desc_by_weight', 'allergens'
  ],
  disclaimer_text = 'This product was made in a private home not subject to state licensing or inspection.',
  disclaimer_all_caps = false,
  placard_required = true,
  placard_text = 'These canned goods are homemade and not subject to state inspection.',
  notes =
    'Wis. Stat. 97.29(2)(b)2.d and 2.e, read 2026-09-06. TWO DIFFERENT SENTENCES, AND WE HAD ONLY '
    'ONE. 2.e puts on each container "the name and address of the person who prepared and canned the '
    'food product, the date on which the food product was canned, the statement \"This product was '
    'made in a private home not subject to state licensing or inspection.\", and a list of '
    'ingredients in descending order of prominence"; 2.d separately requires that the person '
    '"displays a sign at the place of sale stating: \"These canned goods are homemade and not '
    'subject to state inspection.\"". placard_required was false. Wisconsin is the third state found '
    'with a placard sentence that is deliberately not the label sentence, after Colorado and '
    'Illinois. '
    'ALLERGENS ARE PART OF THE INGREDIENT LIST HERE, not a separate declaration: "If any ingredient '
    'originates from milk, eggs, fish, crustacean shellfish, tree nuts, wheat, peanuts, or soybeans, '
    'the list of ingredients shall include the common name of the ingredient." Note the list is '
    'eight, not the federal nine — sesame is absent. '
    'PRODUCT NAME IS NOT REQUIRED by 2.e and has been dropped from the element list; the statute '
    'asks for the preparer, the date, the statement and the ingredients. '
    'A WORDING QUIRK WORTH KEEPING: the statute says descending order of PROMINENCE, where every '
    'other state in this table says predominance. Our element is ingredients_desc_by_weight and the '
    'seller''s order is printed as given either way.',
  source_url = 'https://docs.legis.wisconsin.gov/document/statutes/97.29',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'WI' and ordinal = 2);

-- ---------------------------------------------------------------------------
-- Wyoming — the last row in the pass.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'allowed',
  retail_allowed = true,
  revenue_cap = 250000,
  cap_basis = 'annual_total',
  cap_note =
    'A TWO-PART TEST, OF WHICH WE MODEL HALF. Wyo. Stat. 11-49-102(a)(vi) defines a "Producer" as '
    'someone who "does not produce more than two hundred fifty thousand (250,000) individual food or '
    'drink products annually AND does not exceed two hundred fifty thousand dollars ($250,000.00) in '
    'gross revenue annually from the food and drink products". Exceeding either limb means you are '
    'not a producer and the Act does not reach you at all — so this is a hard boundary rather than a '
    'licensing line. Only the money limb is enforceable here; nothing counts individual items.',
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'allowed',
  cat_meat = 'conditional',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'allowed',
  cat_fermented = 'allowed',
  category_note =
    'MEAT WAS RECORDED AS SIMPLY ALLOWED AND IT IS NOT. Wyo. Stat. 11-49-103(c)(v): transactions '
    'shall "Not involve the sale of meat products", with exceptions — "(A) The sale of poultry and '
    'poultry products provided: (I) The producer slaughters not more than one thousand (1,000) '
    'poultry of his own raising during any one (1) calendar year; (II) The producer does not engage '
    'in buying or selling poultry products other than those produced from poultry of his own '
    'raising; and (III) The poultry product is not adulterated or misbranded. (B) The sale of live '
    'animals; (C) The sale of portions of live animals before slaughter for future delivery; (D) The '
    'sale of domestic rabbit meat; (E) The sale of farm raised fish provided ... the fish is not '
    'catfish. (F) The sale of meat pursuant to an animal share under W.S. 11-49-104; (G) The sale of '
    'meat products under subsection (n)". The rest of the axes stand: the Act imposes no category '
    'limits beyond meat, and 11-49-103(b) exempts homemade food from state licensure, permitting, '
    'inspection, packaging and labelling requirements.',
  license_required = 'no',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = false,
  venue_note =
    'Wyo. Stat. 11-49-103, read 2026-09-06 in the Legislature''s Title 11 compilation. '
    '11-49-103(c)(vi) confines transactions to "farmers markets, farms, ranches, producer''s homes '
    'or offices, the retail location of the third party seller of non-potentially hazardous foods, '
    'eggs and dairy products or any location the producer and the informed end consumer agree to" — '
    'the closing catch-all is what makes direct delivery allowed. ONLINE IS UNCLEAR RATHER THAN '
    'ALLOWED: the list governs WHERE a transaction happens and says nothing about the channel, and '
    'while an order placed online and handed over at an agreed location plainly fits, the statute '
    'does not say so. (c)(iii) and (iv) confine it to Wyoming and bar interstate commerce. '
    'RETAIL IS SPLIT BY HAZARD: (c)(i) lets a third party vendor including a retail shop or grocery '
    'store sell non-potentially hazardous food, eggs and dairy, while potentially hazardous food '
    '"shall be the producer of the item or a designated agent of the producer". A retail space '
    'selling homemade food must also display a sign saying it has not been inspected ((d)).',
  source_url = 'https://www.wyoleg.gov/statutes/compress/title11.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'WY' and ordinal = 1;

update public.state_label_rules set
  required_elements = array['seller_statement'],
  optional_elements = array[]::text[],
  disclaimer_text = 'this food was made in a home kitchen, is not regulated or inspected and may contain allergens',
  disclaimer_all_caps = false,
  predisclosure_required = true,
  seller_statement_prompt =
    'Wyoming asks you to tell the buyer this, in your own words, before they buy. Wyo. Stat. '
    '11-49-103(e): "The producer shall inform the end consumer that any food product or food sold at '
    'a farmers market or through ranch, farm or home based sales pursuant to this act is not '
    'certified, labeled, licensed, packaged, regulated or inspected."',
  notes =
    'Wyo. Stat. 11-49-103, read 2026-09-06. NO LABEL IS REQUIRED FOR A DIRECT SALE — (b) exempts '
    'homemade food from state "packaging and labeling requirements" outright, which the previous '
    'note already said. What the Act requires instead is that the buyer be TOLD. '
    'PREDISCLOSURE, by the same route as Utah: 11-49-102(a)(v) defines the "informed end consumer" '
    'as one "who has been informed that the product is not licensed, regulated or inspected", so '
    'being told is a precondition of the transaction the Act permits, and (e) makes it the '
    'producer''s duty. Substance prescribed, wording open — a seller_statement, shown on the '
    'listing. '
    'THE STORED DISCLAIMER HAD BEEN SENTENCE-CASED. 11-49-103(k) requires food sold at a retail '
    'location or grocery store to be "clearly and prominently labeled with \"this food was made in a '
    'home kitchen, is not regulated or inspected and may contain allergens\"" — lower case, no '
    'closing period, inside the quotation marks. Ours read "This food ... allergens." and is now '
    'exact. '
    'IT IS CHANNEL-SPECIFIC and is kept anyway: (k) applies to the retail and grocery channel, not '
    'to a direct sale, so a seller printing it for a direct sale is printing something true that is '
    'not required of them. Dropping a sentence the statute prescribes verbatim would be the worse '
    'error. (d) separately requires a retail space to display a sign that the food has not been '
    'inspected.',
  source_url = 'https://www.wyoleg.gov/statutes/compress/title11.pdf',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'WY' and ordinal = 1);
