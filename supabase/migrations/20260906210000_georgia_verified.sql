-- Harvest Local — Georgia, from Ga. Comp. R. & Regs. 40-7-19 (.01 through .10), read 2026-09-06.
--
-- Georgia is the most demanding programme checked so far and our row described it as one of the
-- lightest. Three flags were wrong, all in the permissive direction.
--
-- =========================================================================
-- 1. AN INSPECTION IS REQUIRED BEFORE THE LICENCE ISSUES
-- =========================================================================
-- `inspection_required` was false. 40-7-19-.07(1): "The Department will conduct an inspection of the
-- home kitchen of a cottage food operator: (a) Prior to issuing the Cottage Food License; (b) For
-- the investigation of a consumer complaint; or (c) For the investigation of a foodborne disease
-- outbreak, or other public health emergency." And .07(2): "A pre-operational inspection MUST be
-- performed prior to the issuance of a Cottage Food License by a Compliance Specialist." Mandatory,
-- and .06(1) makes the licence conditional on it. A Georgia seller told by our onboarding that no
-- inspection is required would plan their launch around a false premise.
--
-- =========================================================================
-- 2. NO WHOLESALE, AND NO SELLING THROUGH A SHOP
-- =========================================================================
-- `retail_allowed` was true. 40-7-19-.05(2): "Sale of cottage food products must be to the end
-- consumer. No distribution or wholesale is allowed, including to hotels, restaurants, or
-- institutions." The definition backs it: .02(2) says a "Consumer" is a person who "does not offer
-- the food for resale", and .02(3) confines the operator to sale "only for sale directly to the
-- consumer".
--
-- Beware the word "retail" here. The licence itself says "This license allows for the retail sale of
-- home produced food" (.06(2)(f)) — Georgia means retail as opposed to wholesale, i.e. selling to
-- consumers. Our column means selling THROUGH a retailer, which .05(2) forbids.
--
-- =========================================================================
-- 3. EVERY PRODUCT IS APPROVED IN ADVANCE, FOR A FEE
-- =========================================================================
-- `recipe_approval` was "no". 40-7-19-.05(3): "The cottage food operator may only produce the
-- cottage food products listed on their registration form. To add additional products to the list,
-- the cottage food operator must submit a new registration form, including an additional License fee
-- for processing the registration form and re-inspection to ensure that their facilities and
-- equipment are adequate for production of the new cottage food products."
--
-- Not a recipe review, but a product-by-product authorisation with a fee and a re-inspection
-- attached — the strongest form of this found so far, and materially more onerous than "no". It is
-- recorded as "yes" rather than "conditional" because it applies to every product, not to some.
--
-- =========================================================================
-- 4. THE ACIDIFIED AXIS, AGAIN
-- =========================================================================
-- `cat_acidified` was banned. .05(1)(k) expressly permits "Vinegar and flavored vinegars", while
-- .05(5) says "Home canned produce must not be used as an ingredient in cottage food products. Most
-- home canned products are not approved for production under these Regulations, with the exception
-- of jams and jellies." So an acidified product is named as permitted and a class of them is
-- excluded: that is `conditional`, not a ban. `cat_fermented` is not addressed at all and becomes
-- `unclear` — the third state in a row where these two axes had been banned on nothing.
--
-- =========================================================================
-- 5. THE LABEL WAS MISSING AN ELEMENT AND A FULL STOP
-- =========================================================================
-- 40-7-19-.09 sets three different label duties depending on how the sale happens, and the one that
-- governs a marketplace order is (2), Pre-Packaged. Its list is (a) business name and home address,
-- (b) common name of the product, (c) ingredients in descending order of predominance by weight,
-- (d) net weight or volume, (e) allergens per FDA, (f) nutrition IF a nutritional claim is made, and
-- (g) the cottage food statement. We were missing (f).
--
-- The statement itself is quoted by the regulation WITH its full stop, inside the quotation marks,
-- and ours had none. Compare the District of Columbia, checked earlier the same day, where the
-- opposite was true and a period had to come off. `disclaimer_text` is printed as-is, so both
-- matter.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  disclaimer_text = 'MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO STATE FOOD SAFETY INSPECTIONS.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = true,
  disclaimer_font_note =
    '40-7-19-.09(1)(b): the statement "must: 1. Appear in Times New Roman or Arial font, in at least '
    '10-point type; and 2. In a color that contrasts to the background color of the label."',
  notes =
    'Ga. Comp. R. & Regs. 40-7-19-.09, read 2026-09-06. Georgia sets THREE different label duties by '
    'manner of sale, and the one that governs a marketplace order is (2) Pre-Packaged: "(a) The '
    'business name and home address of the cottage food operator; (b) The common name of the cottage '
    'food product; (c) The ingredients in descending order of predominance by weight; (d) The net '
    'weight or volume of the product; (e) Allergen labeling as specified by FDA labeling '
    'requirements; (f) If a nutritional claim is made, appropriate nutritional information as '
    'specified by FDA labeling requirements; (g) The cottage food statement". (f) was missing here '
    'and has been added; the statement was missing its full stop, which the regulation quotes inside '
    'the quotation marks. The other two modes are recorded for completeness. (1) Direct sale — a '
    'custom item such as a wedding or birthday cake — needs only the business name and home address '
    'plus the statement. (3) Bulk Sales, from an aggregate container, moves the information off the '
    'package: it "may be accomplished by way of a card, sign, loose leaf booklet, or other method of '
    'notification at the point of sale", carrying name and address, the common name and ingredients '
    'of each product, allergens and any nutritional claim — while the statement itself "must be '
    'affixed to the bulk food container so that it is conspicuously displayed". Separately, '
    '40-7-19-.10(2) requires a scale legal for trade where products are sold by weight.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Georgia.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'GA' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- .07(1)(a) and .07(2): mandatory, and the licence cannot issue without it.
  inspection_required = true,
  -- .05(2): "No distribution or wholesale is allowed, including to hotels, restaurants, or
  -- institutions." Georgia's own use of "retail" in .06(2)(f) means the opposite of this column.
  retail_allowed = false,
  -- .05(3): every product must be on the registration form; adding one costs a fee and a
  -- re-inspection.
  recipe_approval = 'yes',
  -- .05(1)(k) permits vinegars by name; .05(5) excludes most home-canned goods. Not a ban.
  cat_acidified = 'conditional',
  -- Not addressed anywhere in the chapter.
  cat_fermented = 'unclear',
  -- Sale must be direct to the end consumer, and no provision confines it to a venue.
  direct_delivery = 'allowed',
  venue_note =
    'DIRECT TO THE CONSUMER ONLY, and this row previously said "No restrictions" with '
    'retail_allowed true. 40-7-19-.05(2): "Sale of cottage food products must be to the end '
    'consumer. No distribution or wholesale is allowed, including to hotels, restaurants, or '
    'institutions." .02(3) defines the operator as producing "only in the home kitchen of that '
    'person''s primary domestic residence and only for sale directly to the consumer", and .02(2) '
    'defines a consumer as someone who "does not offer the food for resale". Note Georgia uses '
    '"retail" the other way round from this column: the licence text at .06(2)(f) reads "This '
    'license allows for the retail sale of home produced food. Food sold under this license shall '
    'be to the end consumer." ONLINE SELLING IS NOT MENTIONED ANYWHERE IN THE CHAPTER — the word '
    'internet does not appear. online_orders stays allowed because the operative requirement is '
    'that the sale be direct to the end consumer, which an online order satisfies, and because no '
    'provision confines sales to a venue. That is an inference from silence plus a permissive '
    'frame, not an express permission like Florida''s or the District of Columbia''s.',
  mail_note =
    'Not mentioned in the chapter. Recorded as allowed on the same reasoning as online orders: the '
    'requirement is a direct sale to the end consumer, and mail order to a consumer is one.',
  category_note =
    'Not a closed list. .01 states the purpose as allowing home kitchens "to prepare, manufacture, '
    'and sell non-potentially hazardous foods to the public", and .05(1) says an operator "May only '
    'produce non-potentially hazardous foods. Examples of these foods include: (a) Loaf breads, '
    'rolls, and biscuits; (b) Cakes (except those that require refrigeration due to cream cheese '
    'icing, fillings, or high moisture content such as tres leche); (c) Pastries and cookies; (d) '
    'Candies and confections; (e) Fruit pies; (f) Jams, jellies, and preserves (Not to include '
    'Fruit Butters whose commercial sterility may be affected by reduced sugar/pectin levels); (g) '
    'Dried fruits; (h) Dry herbs, seasonings and mixtures; (i) Cereals, trail mixes, and granola; '
    '(j) Coated or uncoated nuts; (k) Vinegar and flavored vinegars; and (l) Popcorn, popcorn '
    'balls, and cotton candy." Examples, so cat_shelf_stable stays unrestricted rather than '
    'list_only. .05(5) is the canning rule: "Home canned produce must not be used as an ingredient '
    'in cottage food products. Most home canned products are not approved for production under '
    'these Regulations, with the exception of jams and jellies." Vinegars named as permitted plus '
    'that exclusion is why acidified is conditional rather than banned. .05(4) also forbids '
    'producing "in conjunction with any domestic activities" — family meals, dishwashing, laundry, '
    'kitchen cleaning or entertaining.',
  license_note =
    'A real licence, annual, priced, and inspected. .03: an operator "must register with the Georgia '
    'Department of Agriculture''s Food Safety Division before commencing operations", listing the '
    'products they intend to produce, indicating public or private water, and showing they "attended '
    'and passed a Food Safety training class accredited by the American National Standards Institute '
    '(ANSI)". .04(1): "A person must not operate as a cottage food operator without registering with '
    'and obtaining a license from the Department." .04(2): $100.00 a year, by calendar year, halved '
    'for applicants registering after 30 June. .04(3): annual coliform and nitrate water analysis '
    'for a private supply. .04(4) exempts individuals selling only at non-profit events under '
    'O.C.G.A. 26-2-21(a)(5)(C). .06(2)(f) puts on the licence itself that the food "is not subject '
    'to routine inspection, nor should this license be construed as a substitute for the '
    'Department''s Food Sales Establishment License", and (2)(g) requires the licence to be '
    '"conspicuously displayed at the point of sale". No revenue cap appears anywhere in the chapter.',
  recipe_note =
    'Product-by-product authorisation, not recipe review. .05(3): "The cottage food operator may '
    'only produce the cottage food products listed on their registration form. To add additional '
    'products to the list, the cottage food operator must submit a new registration form, including '
    'an additional License fee for processing the registration form and re-inspection to ensure '
    'that their facilities and equipment are adequate for production of the new cottage food '
    'products." Recorded as yes rather than conditional because it reaches every product.',
  training_note =
    'Expressly required and expressly accredited: .03(4) requires the registration to indicate "that '
    'the cottage food operator has attended and passed a Food Safety training class accredited by '
    'the American National Standards Institute (ANSI)", with a copy attached.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Georgia.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'GA' and ordinal = 1 and verified_at is null;
