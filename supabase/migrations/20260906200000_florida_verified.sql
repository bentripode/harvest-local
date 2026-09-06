-- Harvest Local — Florida, from Fla. Stat. 500.03(1)(i)-(j) and 500.80, read 2026-09-06.
--
-- Florida is the most permissive channel rule found so far, and it is express rather than inferred.
-- 500.80(2): "A cottage food operation may sell, offer for sale, and accept payment for cottage
-- food products over the Internet or by mail order. Such products may be delivered in person
-- directly to the consumer, to a specific event venue, or by United States Postal Service or
-- commercial mail delivery service. A cottage food operation may not sell, offer for sale, or
-- deliver cottage food products at wholesale."
--
-- Every channel this marketplace uses is named and permitted; the one prohibition is wholesale.
-- `venue_note` said "No restrictions", which was right in spirit and useless as a record — it
-- cited nothing and it missed both the wholesale ban and the storage rule at 500.80(4).
--
-- =========================================================================
-- 1. THE LABEL WAS ALREADY EXACTLY RIGHT
-- =========================================================================
-- All seven elements of 500.80(3)(a)-(g), in the statute's own order, and the disclaimer matches
-- character for character. Recorded here because "checked and correct" is a finding worth keeping —
-- the next reader should not have to check it again. Only the typography note was missing: (g)
-- requires the statement "printed in at least 10-point type in a color that provides a clear
-- contrast to the background of the label".
--
-- =========================================================================
-- 2. THE $250,000 IS A CAP AFTER ALL — BUT NOT FOR THE REASON THE COLUMN SUGGESTS
-- =========================================================================
-- 500.80(1)(a) makes the figure and the exemption one sentence: an operation "is exempt from the
-- permitting requirements of s. 500.12 if the cottage food operation complies with this section and
-- has annual gross sales of cottage food products that do not exceed $250,000."
--
-- That reads at first like Minnesota's or Vermont's `license_threshold` — cross it and get a licence
-- rather than stop. It is not, and 500.80(8) is why: "This section does not apply to a person
-- operating under a food permit issued pursuant to s. 500.12." Take the permit and you are no
-- longer a cottage food operation at all; you are a permitted food establishment, outside this
-- programme and outside these label rules. So for THIS programme the figure is a genuine ceiling,
-- `revenue_cap` is the right column, and pausing at it is the right behaviour — the seller has to
-- come back under a different status, not merely add a document.
--
-- 500.80(1)(b) also settles how to count: "a cottage food operation's annual gross sales include
-- all sales of cottage food products at any location, regardless of the types of products sold or
-- the number of persons involved in the operation" — annual_total, as recorded.
--
-- =========================================================================
-- 3. TWO CATEGORY AXES WERE BANNED ON A RULE WE HAVE NOT READ
-- =========================================================================
-- Florida has no approved-products list. The only limit is definitional: 500.03(1)(j), "Cottage
-- food product means food that is not a potentially hazardous food as defined by department rule".
-- That squarely excludes refrigerated foods, meat and low-acid canned goods, and it is why
-- `cat_shelf_stable` is correctly `unrestricted` — anything non-hazardous qualifies, with no list to
-- apply to.
--
-- It does not exclude acidified or fermented foods. A pickle below pH 4.6 and a jar of sauerkraut
-- are not potentially hazardous. Those two were banned on nothing the statute says, and the
-- department rule that would settle it (Fla. Admin. Code Ch. 5K-4) has not been read. They become
-- `unclear`, which is the same call made for the District of Columbia an hour earlier and for the
-- same reason.
--
-- =========================================================================
-- 4. THINGS CONFIRMED RATHER THAN CHANGED
-- =========================================================================
-- `inspection_required = false` is right and pleasingly explicit: 500.80(7)(b), "Only upon receipt
-- of a complaint, the department's authorized officer or employee may enter and inspect".
-- `local_preemption = true` is right: 500.80(6), "The regulation of cottage food operations is
-- preempted to the state." `retail_allowed = false` is right — selling to a shop is wholesale, and
-- 500.80(2) forbids it.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'allergens', 'nutrition_if_claimed'
  ],
  disclaimer_text = 'Made in a cottage food operation that is not subject to Florida''s food safety regulations.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'Fla. Stat. 500.80(3)(g): "printed in at least 10-point type in a color that provides a clear '
    'contrast to the background of the label".',
  notes =
    'Fla. Stat. 500.80(3), read 2026-09-06. CHECKED AND CORRECT — every element and the disclaimer '
    'already matched the statute, and are recorded here so the next reader need not check again. '
    '500.80(3) permits sale only of products "prepackaged with a label affixed that contains the '
    'following information: (a) The name and address of the cottage food operation. (b) The name of '
    'the cottage food product. (c) The ingredients of the cottage food product, in descending order '
    'of predominance by weight. (d) The net weight or net volume of the cottage food product. (e) '
    'Allergen information as specified by federal labeling requirements. (f) If any nutritional '
    'claim is made, appropriate nutritional information as specified by federal labeling '
    'requirements. (g) [the disclaimer]". Only the typography note was missing. Note also 500.80(4): '
    'an operation "may only sell cottage food products that it stores on the premises of the cottage '
    'food operation."',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Florida.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'FL' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- Expressly permitted: "delivered in person directly to the consumer".
  direct_delivery = 'allowed',
  -- Banned on nothing. Non-potentially-hazardous excludes neither; see Fla. Admin. Code 5K-4.
  cat_acidified = 'unclear',
  cat_fermented = 'unclear',
  venue_note =
    'EVERY CHANNEL THIS MARKETPLACE USES IS EXPRESSLY PERMITTED, and the previous note ("No '
    'restrictions") cited nothing and missed two real limits. Fla. Stat. 500.80(2): "A cottage food '
    'operation may sell, offer for sale, and accept payment for cottage food products over the '
    'Internet or by mail order. Such products may be delivered in person directly to the consumer, '
    'to a specific event venue, or by United States Postal Service or commercial mail delivery '
    'service. A cottage food operation may not sell, offer for sale, or deliver cottage food '
    'products at wholesale." The limits are that wholesale sentence — which is why retail_allowed is '
    'false, a shop buying to resell is wholesale — and 500.80(4), an operation "may only sell '
    'cottage food products that it stores on the premises of the cottage food operation." '
    '500.80(6) preempts local regulation to the state, subject to the home-based business '
    'conditions in s. 559.955.',
  mail_note =
    'Expressly permitted, by name: 500.80(2) allows sale "by mail order" and delivery "by United '
    'States Postal Service or commercial mail delivery service".',
  cap_note =
    'A true ceiling for this programme, not a licensing threshold, though the sentence reads like '
    'one. 500.80(1)(a): an operation "is exempt from the permitting requirements of s. 500.12 if '
    'the cottage food operation complies with this section and has annual gross sales of cottage '
    'food products that do not exceed $250,000." The reason it is a ceiling rather than a "get a '
    'permit" line is 500.80(8): "This section does not apply to a person operating under a food '
    'permit issued pursuant to s. 500.12" — taking the permit takes the operation OUT of the '
    'cottage food programme and out of these label rules entirely. Counting is settled by '
    '500.80(1)(b): gross sales "include all sales of cottage food products at any location, '
    'regardless of the types of products sold or the number of persons involved in the operation", '
    'and the department may demand written documentation of the figure.',
  category_note =
    'No approved list exists — Florida works by definition alone. 500.03(1)(j): "Cottage food '
    'product means food that is not a potentially hazardous food as defined by department rule '
    'which is sold by a cottage food operation in accordance with s. 500.80." That is why '
    'cat_shelf_stable is unrestricted rather than list_only: there is no list to be on. It excludes '
    'refrigerated foods, meat and low-acid canned goods. It does NOT exclude acidified or fermented '
    'foods, which can be non-hazardous, so those two axes are unclear pending Fla. Admin. Code Ch. '
    '5K-4, which has not been read.',
  license_note =
    'No permit below the cap, and inspection only on complaint. 500.80(1)(a) exempts a complying '
    'operation from "the permitting requirements of s. 500.12". 500.80(7)(b): "Only upon receipt of '
    'a complaint, the department''s authorized officer or employee may enter and inspect the '
    'premises of a cottage food operation" — refusal is grounds for discipline under s. 500.121. '
    '500.80(5) preserves state and federal tax obligations. The statute imposes no food safety '
    'training and no recipe or product approval.',
  training_note =
    'Fla. Stat. 500.80 imposes none. Unlike the District of Columbia, Florida does not delegate '
    'operating conditions to a rule — the section is self-contained apart from the definition of a '
    'potentially hazardous food.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Florida.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'FL' and ordinal = 1 and verified_at is null;
