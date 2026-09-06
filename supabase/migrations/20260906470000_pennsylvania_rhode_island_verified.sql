-- Harvest Local — Pennsylvania and Rhode Island, from 7 Pa. Code 46.212 and R.I. Gen. Laws
-- 21-27-6.1, read 2026-09-06.
--
-- Both compilations are narrow, and the useful work here is saying precisely WHICH parts of each
-- row rest on primary text and which do not. Pennsylvania stays on the list of states this generator
-- refuses to print for — but for a reason that is now written down rather than assumed.
--
-- =========================================================================
-- 1. PENNSYLVANIA'S ONLY COMPILED SECTION IS ABOUT SUPPLYING SHOPS, NOT SELLING DIRECT
-- =========================================================================
-- 7 Pa. Code 46.212 is headed "Food Prepared In a private home" and (a) sets its whole scope: "Food
-- prepared in a private home may not be used or offered for human consumption IN A RETAIL FOOD
-- FACILITY unless the private home meets the requirements of subsection (b) or (c)."
--
-- It is a rule about when a shop or restaurant may serve home-prepared food. It says nothing about a
-- producer selling to a consumer, online or otherwise. So `venue_note` reading "No restrictions" was
-- not merely thin — it implied this section had been consulted on a question it never addresses.
--
-- The two routes it does describe:
--
--   (b) THE ROUTE THIS ROW IS. "Food prepared in a private home may be used or offered for human
--   consumption in a retail food facility if the private home from which the food originates is
--   registered with the Department as a food establishment under the Food Safety Act." That is the
--   registration behind `license_required = yes`, and the reason the row is called a Limited Food
--   Establishment.
--
--   (c) A DONATION EXEMPTION THAT IS EASY TO MISTAKE FOR A COTTAGE FOOD ROUTE. It applies only where
--   the food is not potentially hazardous, is offered by a 501(c)(3), volunteer fire company,
--   religious, charitable, fraternal, veterans, civic, sportsmen or agricultural organisation or a
--   youth sports body, the organisation tells consumers the food came from unlicensed private homes,
--   AND — (c)(4) — "The food is donated to an organization described under paragraph (2)." A sale is
--   not a donation. This is the bake-sale exemption, not a way to trade.
--
-- WHY THE LABEL ROW STAYS EMPTY. 46.212 contains no labelling requirements for the (b) route at all.
-- The notice language in (c)(3) — including the sample phrases the Department accepts — is an
-- obligation on the ORGANISATION serving donated food, not on a producer. Pennsylvania's labelling
-- for a registered food establishment lives in the Food Safety Act scheme and its regulations, which
-- are not in this compilation. Contrast Massachusetts, which looked equally empty until 105 CMR
-- 590.001(A) turned out to adopt the Food Code by reference; here there is no such hook, and the
-- honest answer is still "not recorded".
--
-- Everything else on the Pennsylvania row — the category axes, the "Jerky" note, the channel flags —
-- comes from outside this section and is now marked as unverified rather than left looking checked.
-- Note in particular that (c)(1)'s "The food is not potentially hazardous food" governs the DONATION
-- route; it is not a limit on a registered food establishment.
--
-- =========================================================================
-- 2. RHODE ISLAND: THE FARM ROUTE IS FULLY VERIFIED AND ITS LABEL WAS ALREADY RIGHT
-- =========================================================================
-- R.I. Gen. Laws 21-27-6.1(2)(vi)-(vii) requires the kitchen to "List ingredients on product" and
-- "Label with farm name, address and telephone number". That is exactly the four elements this row
-- held, so it is recorded as checked. No disclaimer is required, which is why `disclaimer_text` is
-- null rather than unrecorded.
--
-- The permitted foods are a closed six-item list and the row said `unrestricted`. (3): "Farm home
-- food manufacture shall be limited to the production of nonpotentially hazardous food and foods
-- that do not require refrigeration, including: (i) Jams, jellies, preserves and ACID FOODS, SUCH AS
-- VINEGARS, that are prepared using fruits, vegetables and/or herbs that have been grown locally;
-- (ii) Double crust pies that are made with fruit grown locally; (iii) Yeast breads; (iv) Maple
-- syrup from the sap of trees on the farm or of trees within a twenty (20) mile radius of the farm;
-- (v) Candies and fudges; (vi) Dried herbs and spices."
--
-- Vinegar is named, so `cat_fermented` moves from banned to conditional — the same correction Nevada
-- and New Hampshire needed, and for the same reason.
--
-- `recipe_approval` was `yes`. Nothing in the section approves a recipe. (2)(v) requires that
-- "Recipe(s) for each farm home food product with all the ingredients and quantities listed, and
-- processing times and procedures, are maintained in the kitchen for review and inspection" — a
-- retention duty, not an approval. Corrected to `no`, with the duty recorded where a seller will see
-- it.
--
-- =========================================================================
-- 3. RHODE ISLAND'S NON-FARMER ROUTE IS NOT IN THIS COMPILATION
-- =========================================================================
-- The compilation carries 21-27-6.1 and nothing else — farm home food manufacture. The Non-Farmers
-- row's $50,000 cap and training requirement come from Rhode Island's separate cottage food
-- provisions, which are not here. Its label is a copy of the farm route's, and its own note already
-- half-admitted that: "The source describes the rule for farmers selling homemade food; confirm it
-- applies to the program you sell under."
--
-- The elements are kept, because "farm name, address and telephone number" plus an ingredient list
-- is a plausible base and refusing to print helps nobody, but the note now states plainly that they
-- are the farm route's and unverified here. Same treatment as Ohio's home bakery and Oregon's two
-- unread routes.
--
-- `verified_at` stays null on all six rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Pennsylvania
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes =
    'STILL NOT RECORDED, AND NOW FOR A STATED REASON. 7 Pa. Code 46.212 — the only Pennsylvania '
    'text in the National Agricultural Law Center compilation, read 2026-09-06 — contains no '
    'labelling requirements for a registered food establishment. Its scope is set by (a): "Food '
    'prepared in a private home may not be used or offered for human consumption IN A RETAIL FOOD '
    'FACILITY unless the private home meets the requirements of subsection (b) or (c)." It governs '
    'when a shop or restaurant may serve home-prepared food, not what a producer puts on a package. '
    'THE NOTICE LANGUAGE IN (c)(3) IS NOT A LABEL RULE and should not be borrowed as one: it binds '
    'the ORGANISATION offering DONATED food, and (c)(4) makes donation a condition — "The food is '
    'donated to an organization described under paragraph (2)." Its sample phrases ("These baked '
    'goods originate from private homes that are not government-licensed or government-inspected", '
    'and two others) are examples the Department accepts from such an organisation, not a statement '
    'prescribed for a seller. Pennsylvania''s labelling for the (b) route lives in the Food Safety '
    'Act scheme and its regulations, which are not in this compilation. Contrast Massachusetts, '
    'which looked equally empty until 105 CMR 590.001(A) turned out to adopt the 2013 Food Code by '
    'reference — there is no such hook here, so the honest answer remains that we do not have the '
    'rule. An admin should read the Food Safety Act registration regulations before a Pennsylvania '
    'seller prints anything.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Pennsylvania.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'PA' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'THIS SECTION DOES NOT ADDRESS SELLING TO CONSUMERS AT ALL, and the row previously said "No '
    'restrictions", which implied it had been consulted on a question it never asks. 7 Pa. Code '
    '46.212(a): "Food prepared in a private home may not be used or offered for human consumption in '
    'a retail food facility unless the private home meets the requirements of subsection (b) or '
    '(c)." It is a rule about when a shop or restaurant may serve home-prepared food. (b) is the '
    'route this row records: food may be so used "if the private home from which the food originates '
    'is registered with the Department as a food establishment under the Food Safety Act" — which is '
    'also why retail_allowed is true. (c) IS A DONATION EXEMPTION AND IS EASY TO MISTAKE FOR A '
    'COTTAGE FOOD ROUTE: it needs non-potentially-hazardous food, a qualifying charity, fire '
    'company, religious, fraternal, veterans, civic, sportsmen, agricultural or youth-sports '
    'organisation, notice to consumers, and — (c)(4) — that "The food is donated to an organization '
    'described under paragraph (2)." A sale is not a donation. ONLINE AND DELIVERY FLAGS ON THIS ROW '
    'ARE UNVERIFIED: nothing in 46.212 speaks to them.',
  category_note =
    'UNVERIFIED. The "Jerky" note and every category axis on this row come from the summary, not '
    'from 7 Pa. Code 46.212, which is the only Pennsylvania text in the compilation read 2026-09-06. '
    'BEWARE ONE FALSE FRIEND: (c)(1) requires that "The food is not potentially hazardous food", but '
    '(c) is the DONATION exemption — that limit does not reach a private home registered as a food '
    'establishment under (b), which is what this row is. The permitted foods for the (b) route are '
    'in the Food Safety Act scheme, which is not in this compilation.',
  license_note =
    'Registration under the Food Safety Act, and that much IS in the text. 7 Pa. Code 46.212(b): '
    'food from a private home may be used or offered in a retail food facility "if the private home '
    'from which the food originates is registered with the Department as a food establishment under '
    'the Food Safety Act." The registration''s own conditions — what it costs, what it inspects, '
    'what it permits to be made — are in that Act and its regulations, which are not in this '
    'compilation, so inspection_required and recipe_approval on this row remain the summary''s.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Pennsylvania.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'PA' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Rhode Island #2 — Farm Home Food Manufacture (fully in the compilation)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'ingredients_desc_by_weight', 'business_name', 'producer_address', 'producer_phone'
  ],
  disclaimer_text = null,
  notes =
    'R.I. Gen. Laws 21-27-6.1(2), read 2026-09-06. CHECKED AND ALREADY CORRECT: (vi) "List '
    'ingredients on product" and (vii) "Label with farm name, address and telephone number" are '
    'exactly the four elements this row held, so it is recorded as checked rather than left to be '
    're-checked. NO DISCLAIMER IS REQUIRED — genuinely, not merely unrecorded; the section '
    'prescribes no statement of any kind. (vi) says only "List ingredients" without prescribing '
    'descending order, so the element used is slightly stricter than the statute. ONE DUTY WITH NO '
    'COLUMN: (2)(v) requires that "Recipe(s) for each farm home food product with all the '
    'ingredients and quantities listed, and processing times and procedures, are maintained in the '
    'kitchen for review and inspection." That is retention, not approval — see recipe_note — and it '
    'is a real obligation a Rhode Island farm seller should know about.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Rhode-Island.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'RI' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  -- (3)(i) names "acid foods, such as vinegars" among the permitted six.
  cat_fermented = 'conditional',
  -- A closed list of six, not an open field.
  cat_shelf_stable = 'limited',
  -- (2)(v) is a retention duty; nothing in the section approves a recipe.
  recipe_approval = 'no',
  category_note =
    'A CLOSED LIST OF SIX, and the row said unrestricted. R.I. Gen. Laws 21-27-6.1(3): "Farm home '
    'food manufacture shall be limited to the production of nonpotentially hazardous food and foods '
    'that do not require refrigeration, including: (i) Jams, jellies, preserves and acid foods, such '
    'as vinegars, that are prepared using fruits, vegetables and/or herbs that have been grown '
    'locally; (ii) Double crust pies that are made with fruit grown locally; (iii) Yeast breads; '
    '(iv) Maple syrup from the sap of trees on the farm or of trees within a twenty (20) mile radius '
    'of the farm; (v) Candies and fudges; (vi) Dried herbs and spices." The opening words are what '
    'ban refrigerated food, meat and low-acid canned goods. VINEGAR IS NAMED, so cat_fermented moves '
    'from banned to conditional — the same correction Nevada and New Hampshire needed, for the same '
    'reason. Note the locality conditions: the fruit, vegetables and herbs in (i) and the fruit in '
    '(ii) must be grown locally, and the maple sap must come from the farm or within twenty miles.',
  recipe_note =
    'RETENTION, NOT APPROVAL — recipe_approval was "yes" and nothing in the section approves '
    'anything. 21-27-6.1(2)(v): "Recipe(s) for each farm home food product with all the ingredients '
    'and quantities listed, and processing times and procedures, are maintained in the kitchen for '
    'review and inspection."',
  license_note =
    'Registration by notarised affidavit, renewed yearly. 21-27-6.1(4): "Each farm home kitchen '
    'shall be registered with the department of health and shall require a notarized affidavit of '
    'compliance ... from the owner of the farm that the requirements of this section have been met '
    '... A certificate of registration shall be issued by the department upon the payment of a fee '
    'as set forth in 23-1-54 and the submission of an affidavit of compliance. The certificate of '
    'registration shall be valid for one year after the date of issuance; provided, however, that '
    'the certificate may be revoked by the director at any time for noncompliance ... The '
    'certificate of registration, with a copy of the affidavit of compliance, shall be kept in the '
    'kitchen". The kitchen must also be "on the premises of a farm" (1) and meet listed standards — '
    'a two-compartment sink or a 150°F dishwasher plus a one-compartment sink, non-absorbent '
    'corrosion-resistant preparation surfaces, self-closing bathroom doors, covered garbage '
    'receptacles emptied daily, and no laundry during manufacture. A TAX POINT WORTH KNOWING: (5) '
    'provides that income from farm home food manufacture "shall not be included in the calculation '
    'of farm income for the purposes of obtaining an exemption from the sales and use tax", nor is '
    'equipment bought for it exempt.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Rhode-Island.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'RI' and ordinal = 2 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Rhode Island #1 — Non-Farmers (not in this compilation)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  notes =
    'NOT VERIFIED FOR THIS ROUTE, and the previous note half-admitted it ("The source describes the '
    'rule for farmers selling homemade food; confirm it applies to the program you sell under"). The '
    'National Agricultural Law Center compilation read on 2026-09-06 carries R.I. Gen. Laws '
    '21-27-6.1 and nothing else — that is FARM home food manufacture. These four elements are that '
    'section''s, from (2)(vi) "List ingredients on product" and (vii) "Label with farm name, address '
    'and telephone number", and they are verified THERE. Rhode Island''s separate cottage food '
    'provisions for non-farmers, which are where this row''s $50,000 cap and training requirement '
    'come from, are not in the compilation. The elements are kept because an ingredient list plus '
    'the producer''s name, address and telephone number is a plausible base and refusing to print '
    'helps nobody — the same treatment Ohio''s home bakery and Oregon''s two unread routes received '
    '— but an admin should read the non-farmer provisions before treating this as checked.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Rhode-Island.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'RI' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  venue_note =
    'PARTLY VERIFIED. The compilation read on 2026-09-06 carries only R.I. Gen. Laws 21-27-6.1, '
    'which is the FARM route — so the cap, the training requirement and the channel flags on this '
    'row are still the summary''s. What the previous note recorded about inspection ("Inspectors may '
    'inspect home kitchens at any time") is not in 21-27-6.1 either. The one thing the farm section '
    'does establish, and which is worth reading across, is how narrowly Rhode Island frames these '
    'permissions: it permits sale "at farmers markets, farmstands, and other markets and stores '
    'operated by farmers for the purpose of the retail sale of the products of Rhode Island farms" '
    'and nothing else. Whether the non-farmer route is drawn as tightly is exactly what an admin '
    'needs to check before relying on online_orders = allowed here.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Rhode-Island.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'RI' and ordinal = 1 and verified_at is null;
