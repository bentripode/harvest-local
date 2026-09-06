-- Harvest Local — Tennessee verified against the Food Freedom Act, at last.
--
-- SOURCES, both enrolled public chapters from the Secretary of State, read 2026-09-06:
--   * 2022 Pub. Ch. 862 (SB 693), the "Tennessee Food Freedom Act", effective 1 July 2022 —
--     https://publications.tnsosfiles.com/acts/112/pub/pc0862.pdf
--   * 2025 Pub. Ch. 431 (SB 484), effective 1 July 2025 —
--     https://publications.tnsosfiles.com/acts/114/pub/pc0431.pdf
-- Together these are T.C.A. § 53-1-118 (with definitions added to § 53-1-102).
--
-- The previous pass recorded this row as UNREACHABLE: the National Agricultural Law Center has no
-- Tennessee file and the state's rule PDF returned 403 to us. Both chapters download fine from the
-- Secretary of State's own acts archive, which is where they should have been fetched from.
--
-- =========================================================================
-- 0. WHAT THIS ROW USED TO DESCRIBE NO LONGER EXISTS
-- =========================================================================
-- The row described a "Cottage Food" programme with a metric weight statement, a lot code and no
-- disclaimer, which is Rule 0080-04-11, the domestic-kitchen regulations. 2022 Pub. Ch. 862 § 5
-- deleted Tenn. Code § 53-1-204(c) and (d) — the exemption that scheme hung from — and § 3 put a
-- single food-freedom exemption in its place. So every labelling value on this row was describing a
-- repealed programme. The programme is renamed to what the statute creates.
--
-- =========================================================================
-- 1. THE ENACTED TEXT IS NOT THE INTRODUCED TEXT. THIS ONE NEARLY CAUGHT US.
-- =========================================================================
-- HB 130 as introduced (draft 001058, capitol.tn.gov) would have rewritten the § 53-1-102(19)
-- definition of "homemade food item" to exclude milk, fish, shellfish, meat and poultry outright,
-- and would have split the sale and delivery rules by whether an item "contains dairy, meat, or
-- poultry" — permitting internet sale of those items by the producer.
--
-- NONE OF THAT WAS ENACTED. Public Chapter 431 as signed does four renumberings and adds ONE new
-- subdivision (b)(3), whose (C) does the opposite of the introduced draft: it confines TCS food to
-- an IN-PERSON sale. Reading the introduced bill and stopping there would have produced a row that
-- permits exactly what the enacted law forbids.
--
-- The rule this pass now runs on: FOR AN AMENDMENT, READ THE ENROLLED PUBLIC CHAPTER, NOT THE BILL
-- AS FILED. capitol.tn.gov serves the introduced draft under the bill number; the acts archive
-- serves what the governor signed.
--
-- =========================================================================
-- 2. ONLINE SELLING IS EXPRESS — FOR NON-TCS FOOD ONLY
-- =========================================================================
-- (b)(1) "Non-time/temperature control for safety food homemade food items must be sold either by:
-- (A) The producer to the consumer, whether in person or remotely, including, but not limited to, a
-- sale by telephone or internet; or (B) An agent of the producer or a third-party vendor, such as a
-- retail shop or grocery store, to the consumer".
--
-- `online_orders = allowed` was already the stored value, but it was the summary's. It now rests on
-- that sentence, and it is correct only for non-TCS food, which is what section 3 is about.
--
-- =========================================================================
-- 3. TCS FOOD MAY BE SOLD IN PERSON ONLY — AND THAT IS A CATEGORY BAN, NOT A STATE BAN
-- =========================================================================
-- New (b)(3), added 2025: "Time/temperature control for safety food homemade food items must:
-- (A) Not include unpasteurized milk or foods that are, or that contain, alcoholic beverages, fish,
-- shellfish products, meat, meat byproducts, or meat food products; (B) Be sold only to the extent
-- permissible by federal law, including, but not limited to, poultry, poultry byproducts, or poultry
-- food products, which are permitted if: (i) The home-based food business operates as a poultry
-- producer in compliance with the 1,000-poultry exemption under 9 CFR 381.10(c) ... or (ii) The
-- home-based food business complies with 9 CFR 381.10(d) ...; and (C) Be sold either by: (i) The
-- producer to the consumer, in person; or (ii) An agent of the producer, in person, such as a farm
-- stand located on the property where the food was prepared."
--
-- (C) is the operative one for us. A Harvest Local sale is concluded and paid for remotely even when
-- the goods are collected — so a TCS listing here is not a sale "in person" within (b)(3)(C), and
-- the exemption in (a) does not cover it. THE COUNTER-ARGUMENT IS RECORDED RATHER THAN HIDDEN: a
-- pickup order could be characterised as a sale completed when the buyer collects, which would put
-- it inside (C)(i). Nothing in the chapter says which moment is the sale, and the consequence of
-- being wrong is an uninspected TCS food sold outside the exemption, so `cat_refrigerated` stays
-- `banned` and the note carries the argument for an admin to weigh.
--
-- This is the first row in the table where an online restriction lands on a FOOD AXIS instead of on
-- `online_orders`, and that is the right shape: Tennessee has not banned internet selling, it has
-- confined one class of food to the doorstep. `products_guard_food_categories` blocks the TCS
-- listing; the shelf-stable listings beside it are untouched. Rule 6 stays out of it.
--
-- =========================================================================
-- 4. THE OTHER THREE "BANNED" AXES HAD A REPEALED RULE BEHIND THEM
-- =========================================================================
-- `cat_acidified`, `cat_low_acid_canned` and `cat_fermented` were all `banned`, from the same
-- domestic-kitchen rules § 5 repealed. § 53-1-118 says nothing at all about acidified, canned or
-- fermented food: a properly acidified or fermented shelf-stable product is non-TCS and falls
-- squarely inside (b)(1). A ban must be traceable to words, and these three are not — they become
-- `unclear`, which under rule 7 qualifies a listing rather than stopping it.
--
-- `cat_meat` keeps `conditional`, on much better grounds than "Poultry only". (b)(3)(A) excludes
-- meat from the TCS route entirely; (b)(3)(B) lets poultry back in under the two federal exemptions,
-- but (C) then confines it to an in-person sale; and non-TCS meat — shelf-stable jerky — is outside
-- (b)(3) altogether and subject to federal inspection law this pass has not read.
--
-- =========================================================================
-- 5. DELIVERY, ANSWERED IN THE TEXT
-- =========================================================================
-- (b)(2) for non-TCS food: "(A) The producer to the consumer; or (B) An agent of the producer, a
-- third-party vendor, or a third-party carrier to the consumer". `direct_delivery` was `unclear`
-- and is now `allowed`; `mail_delivery` was `allowed` on the summary and is now on the words —
-- with (c)(5) recorded against it, because the section "does not ... apply to sales other than
-- intrastate sales made within this state", so a carrier may carry it only inside Tennessee.
--
-- =========================================================================
-- 6. THE LABEL: THE STATUTE IS THE WHOLE OF IT
-- =========================================================================
-- (a) exempts homemade food from "all licensing, permitting, inspecting, packaging, and labeling
-- laws of this state", and (b)(4) then lists what must reach the consumer: "(A) The name, home
-- address, and telephone number of the producer of the homemade food item; (B) The common or usual
-- name of the homemade food item; (C) The ingredients of the homemade food item in descending order
-- of predominance; and (D) The following statement: 'This product was produced at a private
-- residence that is exempt from state licensing and inspection. This product may contain
-- allergens.'"
--
-- So the stored row was wrong in both directions. It asked for a NET WEIGHT IN METRIC AND IMPERIAL
-- and a LOT CODE, neither of which appears anywhere in the chapter — the metric requirement came
-- from the repealed weights-and-measures side of the domestic-kitchen rules, and § 53-1-118(a)
-- exempts homemade food from state packaging law outright. And it carried NO DISCLAIMER at all
-- while (b)(4)(D) prescribes one word for word. It also never asked for the telephone number
-- (b)(4)(A) requires.
--
-- The 2025 amendment did NOT add a production date. The introduced draft would have ((b)(3)(D) of
-- that draft, for TCS food); the enacted chapter's SECTION 3 renumbers a cross-reference to
-- "subdivisions (b)(4)(A)-(C)", which confirms the informational items still stop at (C).
--
-- =========================================================================
-- 7. A PLACARD, AND A DISCLOSURE ON THE LISTING PAGE ITSELF
-- =========================================================================
-- (b)(5)(A): the information "must be provided: (i) On a label affixed to the package, if the
-- homemade food item is packaged; (ii) On a label affixed to the container, if the homemade food
-- item is offered for sale from a bulk container; (iii) On a placard displayed at the point of sale,
-- if the homemade food item is neither packaged nor offered for sale from a bulk container; or
-- (iv) On the webpage on which the homemade food item is offered for sale, if the homemade food item
-- is offered only for sale on the internet".
--
-- (iii) makes Tennessee a placard state. Unlike Colorado and Illinois it prescribes no separate,
-- shorter sign text — the placard carries the same (b)(4) information — so `placard_text` stays null
-- and the note says why, rather than our inventing a sentence for it.
--
-- (iv) makes Tennessee a predisclosure state, and the strongest one found so far. Texas requires the
-- information before payment; Indiana requires the label posted on the vendor's website; Tennessee
-- names "the webpage on which the homemade food item is offered for sale" — a storefront listing, in
-- those words. The "only for sale on the internet" qualifier limits it to sellers who offer the item
-- nowhere else, which we cannot know, so the disclosure is rendered for every Tennessee listing:
-- showing it to a seller who also trades at a market costs nothing, and omitting it from one who
-- does not is a non-compliant listing.
--
-- =========================================================================
-- 8. NOT TOUCHED
-- =========================================================================
-- `state_cottage_food_rules` for TN was verified by an admin on 2026-09-06 against § 53-1-118 and
-- already reads: no cap, no licence. Both are right — the chapter sets neither — and that row is a
-- human attestation, so this migration leaves it exactly as it is.
--
-- `verified_at` on the two rows below stays null, as always. The corrections are ours; the sign-off
-- is an admin's.

set search_path = public;

-- ---------------------------------------------------------------------------
-- The programme.
-- ---------------------------------------------------------------------------
update public.state_food_programs set
  name = 'Homemade Food (Tennessee Food Freedom Act)',
  online_orders = 'allowed',
  mail_delivery = 'allowed',
  mail_note =
    'A third-party carrier may deliver non-TCS homemade food ((b)(2)(B)), but § 53-1-118(c)(5) says '
    'the section does "not ... apply to sales other than intrastate sales made within this state" — '
    'so the carrier route is an inside-Tennessee one. TCS food may not be carried at all: (b)(3)(C) '
    'confines it to a sale in person.',
  direct_delivery = 'allowed',
  retail_allowed = true,
  revenue_cap = null,
  cap_basis = 'none',
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'banned',
  cat_meat = 'conditional',
  cat_acidified = 'unclear',
  cat_low_acid_canned = 'unclear',
  cat_fermented = 'unclear',
  category_note =
    'TCS (refrigerated) food is BANNED HERE BECAUSE OF HOW IT MAY BE SOLD, not because Tennessee '
    'forbids making it. § 53-1-118(b)(3)(C) allows a TCS homemade food item to be sold only by "The '
    'producer to the consumer, in person" or by "An agent of the producer, in person, such as a farm '
    'stand located on the property where the food was prepared". A sale on this marketplace is '
    'concluded and paid for remotely even when the goods are collected, so it is not within (C). '
    'The counter-argument — that a pickup order is sold when the buyer collects it — is real and the '
    'chapter does not settle it; an admin who takes that view should move this axis, not delete the '
    'note. MEAT is conditional: (b)(3)(A) excludes meat, meat byproducts and meat food products from '
    'the TCS route outright, (b)(3)(B) readmits poultry under the 9 CFR 381.10(c) 1,000-bird '
    'exemption or the 381.10(d) inspected-source exemption, and (C) then still requires that sale to '
    'be in person; shelf-stable meat is outside (b)(3) and governed by federal inspection law that '
    'has not been read here. ACIDIFIED, LOW-ACID CANNED and FERMENTED were all recorded as banned, '
    'on the repealed domestic-kitchen rules — § 53-1-118 does not mention them, and a properly '
    'acidified or fermented shelf-stable product is non-TCS and inside (b)(1) — so they are now '
    'unclear rather than blocking.',
  license_required = 'no',
  inspection_required = false,
  recipe_approval = 'no',
  training_required = 'no',
  local_preemption = true,
  venue_note =
    'Tenn. Code § 53-1-118, from 2022 Pub. Ch. 862 as amended by 2025 Pub. Ch. 431 (both enrolled '
    'chapters read 2026-09-06). Non-TCS homemade food may be sold by the producer "whether in person '
    'or remotely, including, but not limited to, a sale by telephone or internet", or through an '
    'agent or third-party vendor "such as a retail shop or grocery store" ((b)(1)). TCS food may be '
    'sold in person only ((b)(3)(C)) — see category_note. (d) preempts county and municipal '
    'regulation. NOTE FOR THE NEXT READER: the row this replaces described Rule 0080-04-11, the '
    'domestic-kitchen scheme, whose enabling subsections § 53-1-204(c) and (d) were DELETED by 2022 '
    'Pub. Ch. 862 § 5. And do not read HB 130 as introduced for the 2025 amendment: that draft would '
    'have permitted internet sale of dairy, meat and poultry items and was not what passed.',
  source_url = 'https://publications.tnsosfiles.com/acts/114/pub/pc0431.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'TN' and ordinal = 1;

-- ---------------------------------------------------------------------------
-- The label.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'producer_address', 'producer_phone',
    'ingredients_desc_by_weight'
  ],
  optional_elements = array[]::text[],
  element_alternatives = '[]'::jsonb,
  disclaimer_text =
    'This product was produced at a private residence that is exempt from state licensing and '
    'inspection. This product may contain allergens.',
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  metric_required = false,
  placard_required = true,
  placard_text = null,
  predisclosure_required = true,
  notes =
    'Tenn. Code § 53-1-118(b)(4) and (b)(5), from 2022 Pub. Ch. 862 § 3 as renumbered by 2025 Pub. '
    'Ch. 431 §§ 1-3, read 2026-09-06. The five elements and the disclaimer are the whole of what the '
    'chapter asks for: "(A) The name, home address, and telephone number of the producer ...; (B) '
    'The common or usual name of the homemade food item; (C) The ingredients ... in descending order '
    'of predominance; and (D) The following statement: ...". '
    'REMOVED: net_weight and lot_code, and the metric requirement with them. Neither appears in the '
    'chapter, and § 53-1-118(a) exempts homemade food from "all licensing, permitting, inspecting, '
    'packaging, and labeling laws of this state" — they came from the repealed Rule 0080-04-11 '
    'domestic-kitchen scheme this row used to describe. '
    'NO PRODUCTION DATE: the 2025 amendment as INTRODUCED (HB 130 draft 001058) would have added one '
    'for TCS food; the enacted chapter did not, and its § 3 renumbers a cross-reference to '
    '"subdivisions (b)(4)(A)-(C)", which confirms the informational items stop at (C). '
    'PLACARD: (b)(5)(A)(iii) requires one at the point of sale for food that is neither packaged nor '
    'sold from a bulk container. It carries the same (b)(4) information — Tennessee prescribes no '
    'separate, shorter sign text the way Colorado and Illinois do — so placard_text is deliberately '
    'null rather than a sentence of our own. '
    'PREDISCLOSURE: (b)(5)(A)(iv), "On the webpage on which the homemade food item is offered for '
    'sale, if the homemade food item is offered only for sale on the internet". That names the '
    'listing page. The "only for sale on the internet" condition depends on whether the seller also '
    'trades elsewhere, which we cannot know, so the disclosure renders for every Tennessee listing. '
    'A telephone number is required and nothing in the app collected one before this migration; see '
    'the contact-phone migration alongside it.',
  source_url = 'https://publications.tnsosfiles.com/acts/114/pub/pc0431.pdf',
  source_checked_at = '2026-09-06'
where program_id in (select id from public.state_food_programs where state_code = 'TN' and ordinal = 1);
