-- Harvest Local — Massachusetts, from 105 CMR 590.001(A), 590.001(C) and 590.010(F), read
-- 2026-09-06.
--
-- Massachusetts was one of the states this generator refused to print for, on a note reading "The
-- source has no labelling section for Massachusetts." That was true of the compilation and false of
-- the law: Massachusetts has a labelling rule, it is just not written in Massachusetts.
--
-- =========================================================================
-- 1. THE LABEL IS THE FEDERAL FOOD CODE, ADOPTED BY REFERENCE
-- =========================================================================
-- 105 CMR 590.001(A): "the Department of Public Health hereby adopts and incorporates by reference
-- the 2013 Food Code (not including Annexes 1 through 8), as amended by the Supplement to the 2013
-- Food Code ... provided, however, that the Department does not adopt those provisions of the 2013
-- Food Code, which are specifically stricken or modified by 105 CMR 590.000."
--
-- So the packaged-food labelling a Massachusetts cottage food operation owes is the Food Code's,
-- which in turn tracks 21 CFR 101: the common name, ingredients in descending order of predominance
-- by weight, the net quantity, the name and place of business of the manufacturer or packer, and
-- allergen declaration. Those elements go on the row, and the note says plainly that they come from
-- the incorporated Food Code rather than from a list Massachusetts wrote — the same treatment Kansas
-- got, and for the same reason: printing them gives a Massachusetts buyer what a buyer anywhere else
-- gets, and pretending they are a state requirement would be a different kind of error.
--
-- NO DISCLAIMER IS PRESCRIBED for a cottage food operation, and that is a real finding rather than a
-- gap. Massachusetts does prescribe one next door, for bed-and-breakfasts — 590.010(E)(1) requires
-- notice "posted at the registration area that the food is prepared in a kitchen that is not
-- regulated and inspected by the board of health" — and conspicuously does not extend it to (F).
--
-- =========================================================================
-- 2. THE PERMIT IS LOCAL, AND THAT IS THE WHOLE CONTROL
-- =========================================================================
-- 590.010(F)(2)(a): "Except as specified 105 CMR 590.010(F)(1), a cottage food operation shall not
-- sell or serve food unless it has been approved to do so and has obtained a valid permit from the
-- board of health." (2)(b): "A board of health shall review a permit application for a cottage food
-- operation, as specified by administrative guidelines of the Department. The board may approve an
-- application that conforms with the guidelines and with applicable sections of the 2013 Food Code."
--
-- (F)(1) is the only exemption: no permit is needed where an operation "only sells: (a) Whole, uncut
-- fresh fruits and vegetables; (b) Unprocessed honey; (c) Pure maple products; or (d) Farm fresh
-- eggs which are stored and maintained at 45F (7.2C) or less."
--
-- `inspection_required` moves to false, on a contrast rather than on silence. The bed-and-breakfast
-- provision immediately above requires inspection in terms — (E)(2)(c), operations "shall be
-- inspected by the board of health upon application for an original permit, within the six months
-- prior to renewal of a permit, and at least once a year" — and (F) says nothing of the kind for
-- cottage food. Two adjacent subsections by the same drafter, one specifying inspection and one not.
--
-- =========================================================================
-- 3. FIVE CATEGORY BANS WITH NOTHING BEHIND THEM
-- =========================================================================
-- 590.010(F) restricts no foods at all. What a cottage food operation may make is whatever its board
-- of health approves "as specified by administrative guidelines of the Department" — guidelines that
-- are not in this compilation and have not been read.
--
-- So `cat_refrigerated`, `cat_meat`, `cat_acidified` and `cat_fermented` become `unclear`. That is
-- not a loosening on a hunch: it is the removal of four bans that had no source, in a state where
-- every seller needs a local permit before selling anything, so the real gatekeeper is a person
-- reading their application. `cat_low_acid_canned` stays banned, the standing exception on the one
-- axis where being wrong is dangerous.
--
-- =========================================================================
-- 4. DELIVERY IS INSIDE THE DEFINITION OF A FOOD ESTABLISHMENT
-- =========================================================================
-- `venue_note` said "No restrictions". 590.001(C) defines a food establishment as an operation that
-- "(b) relinquishes possession of food to a consumer directly, OR INDIRECTLY THROUGH A DELIVERY
-- SERVICE such as home delivery of grocery orders or restaurant takeout orders, or delivery service
-- that is provided by common carriers" — and expressly names a "residential kitchen for a cottage
-- food operation" as one. Delivery and common carriage are contemplated by the definition itself.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'ingredients_desc_by_weight', 'net_weight', 'business_name',
    'producer_address', 'allergens'
  ],
  disclaimer_text = null,
  notes =
    'MASSACHUSETTS HAS A LABELLING RULE; IT IS JUST NOT WRITTEN IN MASSACHUSETTS. This row was empty '
    'with a note saying the source had no labelling section, which was true of the compilation and '
    'false of the law. 105 CMR 590.001(A), read 2026-09-06: the Department of Public Health "adopts '
    'and incorporates by reference the 2013 Food Code (not including Annexes 1 through 8), as '
    'amended by the Supplement to the 2013 Food Code ... provided, however, that the Department does '
    'not adopt those provisions of the 2013 Food Code, which are specifically stricken or modified '
    'by 105 CMR 590.000." THE ELEMENTS HERE ARE THE FOOD CODE''S AND 21 CFR 101''s, NOT A '
    'MASSACHUSETTS LIST — common name, ingredients in descending order of predominance by weight, '
    'net quantity, the name and place of business of the manufacturer or packer, and allergens. The '
    'Food Code text itself has not been read; these are its labelling requirements as they are '
    'universally applied, and they are recorded so a Massachusetts seller gets the same label a '
    'seller anywhere else gets. NO DISCLAIMER IS PRESCRIBED, and that is a finding rather than a '
    'gap: Massachusetts prescribes one next door for bed-and-breakfasts — 590.010(E)(1) requires '
    'notice "posted at the registration area that the food is prepared in a kitchen that is not '
    'regulated and inspected by the board of health" — and does not extend it to cottage food '
    'operations under (F).',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Massachusetts.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MA' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 590.010(F) restricts no foods; the board of health approves against Department guidelines that
  -- have not been read. These four were banned on nothing.
  cat_refrigerated = 'unclear',
  cat_meat = 'unclear',
  cat_acidified = 'unclear',
  cat_fermented = 'unclear',
  -- The bed-and-breakfast subsection next door specifies inspection in terms; (F) does not.
  inspection_required = false,
  -- 590.001(C) puts delivery, including by common carrier, inside the definition itself.
  direct_delivery = 'allowed',
  venue_note =
    'DELIVERY IS INSIDE THE DEFINITION, and this row previously said "No restrictions" with no '
    'citation. 105 CMR 590.001(C) defines a food establishment as an operation that "(a) stores, '
    'prepares, packages, serves, vends food directly to the consumer ... [including a] residential '
    'kitchen for a cottage food operation; and (b) relinquishes possession of food to a consumer '
    'directly, or indirectly through a delivery service such as home delivery of grocery orders or '
    'restaurant takeout orders, or delivery service that is provided by common carriers." So '
    'delivery and common carriage are contemplated by the definition of the thing being regulated. '
    'Online selling is not mentioned anywhere in 590.001 or 590.010(F); online_orders stays allowed '
    'on that plus the absence of any venue restriction, which is an inference from a permissive '
    'frame rather than an express permission. LOCAL CONTROL IS THE POINT HERE, not an oversight: the '
    'permit comes from the municipal board of health, which is why local_preemption is false.',
  category_note =
    'NOTHING IN 590.010(F) RESTRICTS FOODS AT ALL, which is why four bans have been withdrawn. What '
    'an operation may make is whatever its board of health approves: (F)(2)(b), "A board of health '
    'shall review a permit application for a cottage food operation, as specified by administrative '
    'guidelines of the Department. The board may approve an application that conforms with the '
    'guidelines and with applicable sections of the 2013 Food Code." THOSE DEPARTMENT GUIDELINES ARE '
    'NOT IN THIS COMPILATION AND HAVE NOT BEEN READ. cat_refrigerated, cat_meat, cat_acidified and '
    'cat_fermented were banned with nothing behind them and are now unclear; cat_low_acid_canned '
    'stays banned as the standing exception on the axis where being wrong is dangerous. Note this is '
    'not a state where a listing goes up unsupervised: every cottage food operation needs a local '
    'permit before selling anything, so a person reads the application. The only foods that escape '
    'that are in (F)(1), which exempts an operation that "only sells: (a) Whole, uncut fresh fruits '
    'and vegetables; (b) Unprocessed honey; (c) Pure maple products; or (d) Farm fresh eggs which '
    'are stored and maintained at 45F (7.2C) or less."',
  license_note =
    'A LOCAL PERMIT, AND IT IS THE WHOLE CONTROL. 105 CMR 590.010(F)(2)(a): "Except as specified 105 '
    'CMR 590.010(F)(1), a cottage food operation shall not sell or serve food unless it has been '
    'approved to do so and has obtained a valid permit from the board of health." (2)(b) sends the '
    'board to "administrative guidelines of the Department" and the 2013 Food Code. INSPECTION IS '
    'NOT REQUIRED FOR THIS ROUTE, and that reading rests on a contrast rather than on silence: the '
    'bed-and-breakfast subsection immediately above specifies it in terms — (E)(2)(c), such '
    'operations "shall be inspected by the board of health upon application for an original permit, '
    'within the six months prior to renewal of a permit, and at least once a year for the '
    'enforcement of 105 CMR 590.000" — and (F) says nothing of the kind. No revenue cap appears in '
    'either section. Because the whole scheme is the 2013 Food Code as adopted by 590.001(A), a '
    'Massachusetts seller''s obligations are far wider than this row can carry.',
  training_note =
    '590.010(F) imposes no training requirement of its own. That is not the same as none: the 2013 '
    'Food Code is adopted wholesale by 590.001(A) and carries its own person-in-charge knowledge '
    'requirements, which have not been read.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Massachusetts.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MA' and ordinal = 1 and verified_at is null;
