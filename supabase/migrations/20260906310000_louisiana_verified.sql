-- Harvest Local — Louisiana, from La. Rev. Stat. 40:4.9, read 2026-09-06.
--
-- Louisiana was one of five states this generator refused to print for, on the ground that the rule
-- was unrecorded. It is recorded now, and the reason it could not be held is interesting enough to
-- have produced new machinery.
--
-- =========================================================================
-- 1. LOUISIANA PRESCRIBES THE SUBSTANCE AND NOT THE WORDS
-- =========================================================================
-- 40:4.9(D)(1)(a): "any individual who prepares low-risk foods in the home for sale, as authorized
-- by this Section, shall affix to any such food offered for sale A LABEL WHICH CLEARLY INDICATES
-- THAT THE FOOD WAS NOT PRODUCED IN A LICENSED OR REGULATED FACILITY."
--
-- Every other disclaimer in this table is a sentence a legislature wrote. Louisiana wrote none — it
-- named a fact the label must convey and left the wording to the producer. Composing a sentence
-- ourselves and storing it in `disclaimer_text` would have been the easy fix and the wrong one: that
-- column is quoted law printed onto food without review, and the moment it holds our prose the
-- guarantee that makes it safe is gone for every state, not just this one.
--
-- 20260906300000 added the `seller_statement` element and `seller_statement_prompt`, which carries
-- the state's own description of the requirement to the print form. The seller writes the sentence;
-- the label will not print until they do, which is right.
--
-- (D)(1)(b) carves out one product entirely: the labelling requirement "shall not apply to raw honey
-- offered for sale if the honey is not pasteurized, filtered, or otherwise processed in such a way
-- as to remove natural pollen contained in the honey." Nothing here models raw honey, so it stays in
-- the notes.
--
-- =========================================================================
-- 2. RESALE IS PROHIBITED FOR THE BAKED GOODS, AND retail_allowed WAS TRUE
-- =========================================================================
-- 40:4.9(C): "No individual who prepares breads, cakes, cookies, or pies in the home for sale to the
-- public pursuant to this Section shall sell such foods to any retail business or individual for
-- resale."
--
-- Note the limit: the prohibition names four baked goods, not all nine categories of low-risk food.
-- A single boolean cannot say "false for the bread, unstated for the pepper jelly", and since baked
-- goods are the bulk of what this marketplace carries, false is the safer and more accurate-on-
-- balance value. The note says exactly how far the prohibition reaches.
--
-- =========================================================================
-- 3. A REGISTRATION OBLIGATION WITH NOWHERE TO LIVE
-- =========================================================================
-- 40:4.9(D)(2): "No individual who prepares low-risk foods in the home shall sell such foods unless
-- he is registered to collect any local sales and use taxes that are applicable to the sale of such
-- foods, as evidenced by a current sales tax certificate issued to the seller by the sales and use
-- tax collector for the parish in which the sales occur."
--
-- `license_required` stays `no` — this is not a food licence and no health agency issues it — but a
-- Louisiana seller may not lawfully sell without a parish sales tax certificate, and a row saying
-- only "no licence required" would mislead them badly. It goes in `license_note`.
--
-- =========================================================================
-- 4. THE $30,000 IS A CEILING, AND IT BITES AT EXACTLY $30,000
-- =========================================================================
-- 40:4.9(B): "This Section shall not apply to any preparer of low-risk foods made at a home for
-- sale, whose gross annual sales EQUAL thirty thousand dollars OR MORE." Definitional, like
-- Florida's and Iowa's: at the figure the exemption is gone, so pausing is right. Worth noting the
-- boundary is inclusive — $30,000 exactly is already outside.
--
-- =========================================================================
-- 5. THE CATEGORY AXES
-- =========================================================================
-- 40:4.9(E) defines low-risk foods as nine categories, "none of which shall consist of any animal
-- muscle protein or fish protein" — which is `cat_meat = banned`, expressly. (7) is "Pickles and
-- acidified foods", so `cat_acidified = allowed` is on the statute rather than the summary.
--
-- `cat_fermented` stays banned, with its reasoning recorded rather than assumed: fermented food is
-- not among the nine, and the exemption reaches only what is. The list is introduced with "shall
-- INCLUDE all of the following", which read as illustrative would leave room — an admin should
-- resolve that before a Louisiana seller is turned away from a fermented listing.
--
-- `cat_refrigerated` stays allowed and the statute supports it: 40:4.9(A)(2)(d) through (h) set out
-- detailed rules for custard and cream-filled bakery products, including cooking to "one hundred
-- forty-five degrees Fahrenheit for a period of not less than thirty minutes" and chilling to 45°F.
-- A statute that legislates custard fillings plainly contemplates refrigerated product.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array['seller_statement'],
  seller_statement_prompt =
    'a label which clearly indicates that the food was not produced in a licensed or regulated '
    'facility (La. Rev. Stat. 40:4.9(D)(1)(a))',
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  notes =
    'La. Rev. Stat. 40:4.9(D)(1)(a), read 2026-09-06. LOUISIANA PRESCRIBES THE SUBSTANCE AND NOT THE '
    'WORDS: a preparer "shall affix to any such food offered for sale a label which clearly '
    'indicates that the food was not produced in a licensed or regulated facility." There is no '
    'sentence to quote, so there is nothing to put in disclaimer_text — writing one ourselves would '
    'put our prose in a column that exists to hold quoted law. The seller_statement element '
    '(20260906300000) asks the seller for it at print time and shows them the statute''s own words. '
    'Louisiana requires NOTHING ELSE on the label: no product name, no ingredients, no net weight, '
    'no allergens. RAW HONEY IS EXEMPT ENTIRELY — (D)(1)(b): the requirement "shall not apply to raw '
    'honey offered for sale if the honey is not pasteurized, filtered, or otherwise processed in '
    'such a way as to remove natural pollen contained in the honey", which nothing here models.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Louisiana.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'LA' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  name = 'Low-Risk Foods Prepared in the Home',
  -- 40:4.9(C) bars selling the baked goods to a retail business or for resale.
  retail_allowed = false,
  -- 40:4.9(A)(1)(a) displaces the Sanitary Code and "any other law or regulation" on the listed
  -- subjects, which reaches local rules on those subjects.
  local_preemption = true,
  venue_note =
    'NOT ADDRESSED — the section is an exemption from the Sanitary Code, not a marketing rule, and '
    'the previous note ("No restrictions") said nothing about that. 40:4.9(A)(1)(a): "No provision '
    'of the state Sanitary Code or any provision of any other law or regulation that requires any '
    'equipment, design, construction, utensils, supplies, preparation, or services shall apply to '
    'the preparation of low-risk foods ... in the home for sale." That displacement of "any other '
    'law or regulation" is why local_preemption is true, though it reaches only those subjects. THE '
    'ONE EXPRESS CHANNEL RULE IS A RESALE BAN, and it is narrower than this column can express — '
    '(C): "No individual who prepares BREADS, CAKES, COOKIES, OR PIES in the home for sale to the '
    'public pursuant to this Section shall sell such foods to any retail business or individual for '
    'resale." Four baked goods, not all nine categories of low-risk food; retail_allowed is false '
    'because baked goods are the bulk of what a marketplace carries. Online selling and delivery are '
    'nowhere in the section: online_orders stays allowed on silence plus a permissive frame, not on '
    'any express permission, and direct_delivery stays unclear because Louisiana gives no '
    'direct-to-consumer framing to reason from. One more limit with no column: (A)(1)(b), the '
    'exemption "shall not apply to any preparer of breads, cakes, cookies, or pies who employs any '
    'individual to assist in the preparation of such food for sale" — no employees, for those four.',
  cap_note =
    'A ceiling, and it bites AT the figure. 40:4.9(B): "This Section shall not apply to any preparer '
    'of low-risk foods made at a home for sale, whose gross annual sales EQUAL thirty thousand '
    'dollars OR MORE." Definitional like Florida''s and Iowa''s — at $30,000 exactly the exemption '
    'is already gone, so the seller is outside the programme rather than merely over a limit, and '
    'pausing is the right behaviour.',
  category_note =
    'Nine categories, and no animal protein in any of them. 40:4.9(E): ""low-risk foods" shall '
    'include all of the following, NONE OF WHICH SHALL CONSIST OF ANY ANIMAL MUSCLE PROTEIN OR FISH '
    'PROTEIN: (1) Baked goods, including breads, cakes, cookies, and pies. (2) Candies. (3) Cane '
    'syrup. (4) Dried mixes. (5) Honey and honeycomb products. (6) Jams, jellies, and preserves. (7) '
    'Pickles and acidified foods. (8) Sauces and syrups. (9) Spices." (7) is why cat_acidified is '
    'allowed, on the statute rather than the summary. cat_meat is banned by the protein exclusion. '
    'FERMENTED IS NOT ON THE LIST and the ban rests on that alone — note the list is introduced with '
    '"shall include all of the following", which read as illustrative rather than exhaustive would '
    'leave room for a fermented food; an admin should resolve that before a Louisiana seller is '
    'turned away. cat_refrigerated stays allowed and the statute backs it: (A)(2)(d)-(h) legislate '
    'custard and cream-filled bakery products in detail, requiring pasteurised milk, cooking to "one '
    'hundred forty-five degrees Fahrenheit for a period of not less than thirty minutes", immediate '
    'transfer to sanitised containers and chilling to 45°F. (F) bars any food containing cannabidiol '
    '"unless the United States Food and Drug Administration approves cannabidiol as a food '
    'additive". Cane syrup gets its own definition of "the home" at (A)(1)(a), extending it to "an '
    'open-sided structure on private property that shelters a cast iron kettle, evaporator, or other '
    'equipment for preparing cane syrup in the traditional manner."',
  license_note =
    'NO FOOD LICENCE, BUT A SALES TAX CERTIFICATE IS MANDATORY BEFORE SELLING — and a seller told '
    'only "no licence required" would never guess it. 40:4.9(D)(2): "No individual who prepares '
    'low-risk foods in the home shall sell such foods unless he is registered to collect any local '
    'sales and use taxes that are applicable to the sale of such foods, as evidenced by a current '
    'sales tax certificate issued to the seller by the sales and use tax collector for the parish in '
    'which the sales occur." license_required stays no because no health agency licences or inspects '
    'this, but that certificate is a condition of lawful sale. The section also imposes real '
    'construction and sanitation duties on preparers of breads, cakes, cookies and pies '
    '((A)(2)(a)-(c)): openings protected against flies and vermin, a building constructed to exclude '
    'rats, mice and roaches, pets excluded from the preparation area, equipment kept clean and free '
    'from cracks in non-corroding or smooth impervious material, refrigeration holding perishables '
    'at or below 45°F, and all food contact surfaces "cleaned and sanitized after each day''s '
    'production."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Louisiana.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'LA' and ordinal = 1 and verified_at is null;
