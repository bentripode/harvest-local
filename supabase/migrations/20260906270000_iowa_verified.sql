-- Harvest Local — Iowa, from Iowa Code 137D.1 through 137D.8, 137F.1 and 137F.20, read 2026-09-06.
--
-- Iowa runs two programmes and the difference between them is real: the Cottage Food exemption at
-- 137F.20 asks for four things on a label; the Home Food Processing Establishment at 137D.2(7) asks
-- for six, holds a licence, is inspected, and is capped at $50,000. Both label rules were empty of
-- disclaimer text.
--
-- =========================================================================
-- 1. IOWA NAMES INTERNET SELLING IN THE COTTAGE FOOD EXEMPTION ITSELF
-- =========================================================================
-- 137F.20(1): "Cottage food is exempt from all licensing, permitting, inspection, packaging, and
-- labeling laws of the state if the food is sold and delivered by the producer directly to the
-- consumer, or delivered by mail or an agent of the producer such as an employee. A producer may
-- sell food to the consumer in person, remotely, by telephone, BY INTERNET, or by an agent of the
-- producer."
--
-- Internet selling, mail delivery, direct delivery and selling through an agent are all named. Note
-- the shape of that sentence: the exemption is CONDITIONED on the channel. A cottage food producer
-- who sold any other way would not be exempt at all.
--
-- The agent language matters to this marketplace the way Idaho's "designated agent" does, and Iowa's
-- is looser — "an agent of the producer such as an employee" is illustrative, not a definition.
--
-- =========================================================================
-- 2. BOTH DISCLAIMERS WERE MISSING, AND THEY ARE DIFFERENT SENTENCES
-- =========================================================================
--   Cottage Food, 137F.20(2)(d): "This product was produced at a residential property that is
--   exempt from state licensing and inspection."
--   Home Food Processing Establishment, 137D.2(7)(f): "This product was produced at a home food
--   processing establishment."
--
-- Both rows had `disclaimer_text` null, which makes `renderLabel()` treat the rule as unrecorded and
-- refuse to print. Iowa sellers could not generate a label at all.
--
-- =========================================================================
-- 3. THE COTTAGE FOOD CONTACT REQUIREMENT IS A THREE-WAY ALTERNATIVE
-- =========================================================================
-- 137F.20(2)(a): "Information to identify the name and address, phone number, or electronic mail
-- address of the person preparing the food." The name is required; the second half is a choice of
-- three. That is the widest alternatives group in the data — Colorado and Hawaii each have two.
--
-- (2)(e) is the "if applicable" case and goes in `optional_elements`: "If the food is home-processed
-- and home-canned pickles, vegetables, or fruits permitted under this section, the date that the
-- food was processed and canned." Iowa asks for no net weight on a cottage food label.
--
-- =========================================================================
-- 4. THE HFPE LABEL NEEDED A VOCABULARY ENTRY
-- =========================================================================
-- 137D.2(7)(e): "For refrigerated time/temperature control for safety foods, an expiration date
-- based on food safety." `expiration_date` was added by 20260906260000 as a per-batch value asked
-- for at print time, alongside the production date and lot code, and it sits in `optional_elements`
-- because the duty depends on a fact about the batch that nothing here records.
--
-- =========================================================================
-- 5. WHAT THE CATEGORY AXES ACTUALLY REST ON
-- =========================================================================
-- Cottage Food. 137F.1(3) defines it as food "produced at a private residence other than
-- time/temperature control for safety food", and then EXPRESSLY INCLUDES "home-processed and
-- home-canned pickles, vegetables, or fruits that have a finished equilibrium pH value of four and
-- six-tenths or lower or a water activity value of eighty-five hundredths or less for which each
-- batch has been measured by a pH meter or a water activity meter and each container that is sold or
-- offered for sale contains the date the food was processed and canned." So acidified stays allowed,
-- on the statute rather than on the summary — and the pH-meter and dating conditions are the reason
-- (2)(e) exists. It excludes milk and milk products (ch. 192 or 194) and meat and poultry (ch.
-- 189A), so refrigerated and meat stay banned.
--
-- `cat_fermented` was banned on nothing and becomes `unclear`: fermented food is nowhere in either
-- the inclusion or the exclusion, and the reasoning that would permit it runs through the TCS
-- definition, which this chapter does not carry.
--
-- Home Food Processing Establishment. 137D.1(4)(c) is an exhaustive exclusion list — "Homemade food
-- item does not include unpasteurized fruit or vegetable juice, raw sprout seeds, foods containing
-- game animals, fish or shellfish, alcoholic beverages, bottled water, packaged ice, consumable hemp
-- products, food that will be further processed by a food processing plant, time/temperature control
-- for safety food packaged using a reduced oxygen packaging method, milk or milk products ... and
-- meat, meat food products, poultry, or poultry products ... except for [poultry the producer
-- raised]". Acidified food is not on it, so `cat_acidified` moves from banned to allowed.
-- Refrigerated stays allowed, and 137D.2(7)(e) confirms it by legislating a label for refrigerated
-- TCS food.
--
-- `cat_low_acid_canned` stays banned on both rows. Neither exclusion list names it, so this is the
-- one axis recorded more strictly than the text strictly requires — heat-treated low-acid food in a
-- sealed container is the case where being wrong is dangerous, and Iowa's cottage food inclusion is
-- expressly limited to pH 4.6 or below, which excludes it there anyway.
--
-- =========================================================================
-- 6. TWO CAPS, TWO MEANINGS, AND ONE FLAG THAT WAS ASSERTED
-- =========================================================================
-- The HFPE $50,000 is definitional, like Florida's: 137D.1(3) defines the establishment as one whose
-- business "has gross annual sales of less than fifty thousand dollars". Above it you are not an
-- HFPE, so `revenue_cap` and a pause are right. Cottage Food has no cap at all.
--
-- `local_preemption` was true on both and is in neither chapter. 137F.20(1) exempts cottage food
-- from "laws of the state"; 137D.6 addresses only conflicts with the state building code. Both go to
-- null.
--
-- `verified_at` stays null on all four rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Programme 1 — Iowa Cottage Food (Iowa Code 137F.20)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array['producer_name', 'product_name', 'ingredients_desc_by_weight', 'allergens'],
  -- "the name AND address, phone number, or electronic mail address" — one of three.
  element_alternatives = '[["producer_address", "producer_phone", "producer_email"]]'::jsonb,
  -- (2)(e): only for home-canned pickles, vegetables or fruits.
  optional_elements = array['production_date'],
  disclaimer_text = 'This product was produced at a residential property that is exempt from state licensing and inspection.',
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  notes =
    'Iowa Code 137F.20(2), read 2026-09-06 — this row previously had NO disclaimer text, which made '
    'renderLabel() treat the rule as unrecorded and refuse to print at all. The statute: "Cottage '
    'food sold pursuant to this section shall be affixed or labeled with all of the following '
    'information: a. Information to identify the name and address, phone number, or electronic mail '
    'address of the person preparing the food. b. The common name of the food. c. The ingredients of '
    'the cottage food in descending order of predominance. d. The following statement: [the '
    'disclaimer] If the cottage food contains one or more major food allergens, an additional '
    'allergen statement must be included on the label identifying each major allergen contained in '
    'the food by the common name of the allergen. e. If the food is home-processed and home-canned '
    'pickles, vegetables, or fruits permitted under this section, the date that the food was '
    'processed and canned." (a) IS A THREE-WAY ALTERNATIVE — the name is required, then an address '
    'OR a phone number OR an email address; the widest such group in this data. (e) is optional '
    'because it reaches only home-canned produce. NO NET WEIGHT is required. 137F.20(3) is worth '
    'passing on to sellers: "Compliance with the cottage food exemption provided in this section '
    'does not represent compliance with federal law."',
  source_url = 'https://www.legis.iowa.gov/docs/code/137F.20.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'IA' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 137F.20(1) names the producer delivering "directly to the consumer".
  direct_delivery = 'allowed',
  -- Nowhere in the inclusion or the exclusion; the reasoning that would permit it runs through a
  -- TCS definition this chapter does not carry.
  cat_fermented = 'unclear',
  -- Not addressed by the chapter.
  local_preemption = null,
  venue_note =
    'THE EXEMPTION IS CONDITIONED ON THE CHANNEL, and internet selling is named in it. Iowa Code '
    '137F.20(1): "Cottage food is exempt from all licensing, permitting, inspection, packaging, and '
    'labeling laws of the state if the food is sold and delivered by the producer directly to the '
    'consumer, or delivered by mail or an agent of the producer such as an employee. A producer may '
    'sell food to the consumer in person, remotely, by telephone, by internet, or by an agent of the '
    'producer." Read the conditional: a producer who sold some other way would not be exempt at all. '
    'The agent language reaches this marketplace the way Idaho''s designated agent does, and is '
    'looser — "an agent of the producer such as an employee" is illustrative rather than defined. '
    'The previous note, "Farmers markets, roadside stands, events and from home", is the summary''s '
    'and appears nowhere in the section.',
  mail_note = 'Named in 137F.20(1): cottage food may be "delivered by mail or an agent of the producer".',
  category_note =
    'ACIDIFIED IS EXPRESSLY IN, WITH CONDITIONS. Iowa Code 137F.1(3): "Cottage food means the '
    'production and sale of food produced at a private residence other than time/temperature control '
    'for safety food as provided in section 137F.20 and food for resale that is not time/temperature '
    'control for safety food. Cottage food includes home-processed and home-canned pickles, '
    'vegetables, or fruits that have a finished equilibrium pH value of four and six-tenths or lower '
    'or a water activity value of eighty-five hundredths or less for which each batch has been '
    'measured by a pH meter or a water activity meter and each container that is sold or offered for '
    'sale contains the date the food was processed and canned. Cottage food does not include any of '
    'the following: a. Milk or milk products regulated under chapter 192 or 194. b. Meat, meat food '
    'products, poultry, or poultry food products regulated under chapter 189A." The pH-meter and '
    'per-container dating conditions are real seller obligations and are why the label carries an '
    'optional production date. Fermented food appears in neither list and is unclear. Low-acid '
    'canned food is banned: the inclusion is capped at pH 4.6, which excludes it.',
  license_note =
    'None — and the exemption is unusually wide. 137F.20(1): cottage food "is exempt from all '
    'licensing, permitting, inspection, packaging, and labeling laws of the state" on the channel '
    'conditions above. No revenue cap applies to this route; the $50,000 figure belongs to the Home '
    'Food Processing Establishment programme, which is a licence, not an exemption. LOCAL '
    'PREEMPTION IS NOT ADDRESSED: 137F.20(1) speaks of laws "of the state".',
  source_url = 'https://www.legis.iowa.gov/docs/code/137F.20.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'IA' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Programme 2 — Iowa Home Food Processing Establishment (Iowa Code 137D)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[
    'business_name', 'product_name', 'ingredients_desc_by_weight', 'net_weight', 'allergens'
  ],
  -- 137D.2(7)(e): required only for refrigerated TCS food, which nothing here identifies.
  optional_elements = array['expiration_date'],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = 'This product was produced at a home food processing establishment.',
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  notes =
    'Iowa Code 137D.2(7), read 2026-09-06 — this row also had NO disclaimer text and could not '
    'print. THE STATEMENT IS NOT THE COTTAGE FOOD ONE: a home food processing establishment holds a '
    'licence and is inspected, and says so. The statute: "A home food processing establishment shall '
    'affix or label a homemade food item with all of the following information: a. Information to '
    'identify the name of the home food processing establishment. b. The common name of the food. c. '
    'The ingredients of the homemade food item in descending order of predominance. d. The net '
    'quantity of contents. e. For refrigerated time/temperature control for safety foods, an '
    'expiration date based on food safety. f. The following statement: [the disclaimer] If the '
    'homemade food item contains one or more major food allergens, an additional allergen statement '
    'must be included on the label identifying each major allergen contained in the food by the '
    'common name of the allergen." (e) is why the expiration_date element exists (20260906260000); '
    'it is optional here because whether a given product is a refrigerated TCS food is not something '
    'this schema records, and requiring it would block every shelf-stable Iowa label.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Iowa.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'IA' and ordinal = 2
)
and verified_at is null;

update public.state_food_programs set
  -- Not on the exhaustive exclusion list at 137D.1(4)(c).
  cat_acidified = 'allowed',
  -- Not addressed by the chapter; 137D.6 covers only the state building code.
  local_preemption = null,
  cap_note =
    'Definitional, like Florida''s, not a licensing threshold. 137D.1(3): "Home food processing '
    'establishment means a business on the premises of a residence in which homemade food items are '
    'produced for sale or resale, for consumption off the premises, IF THE BUSINESS HAS GROSS ANNUAL '
    'SALES OF LESS THAN FIFTY THOUSAND DOLLARS." Above the figure the operation is not a home food '
    'processing establishment, so pausing is the right behaviour — the seller has to return under a '
    'different status. The same definition excludes "a residence in which food is prepared to be '
    'used or sold by churches, fraternal societies, charitable organizations, or civic '
    'organizations".',
  category_note =
    'AN EXHAUSTIVE EXCLUSION LIST, so anything not on it is in. 137D.1(4): "a. Homemade food item '
    'means a food that is produced and, if packaged, packaged at a home food processing '
    'establishment. b. Homemade food item includes all of the following: (1) Food that is not '
    'time/temperature control for safety food, but does not include such food if produced and sold '
    'under section 137F.20. (2) Made-to-order food that is [regularly prepared, promptly served ... '
    'and] intended for immediate consumption. c. Homemade food item does not include unpasteurized '
    'fruit or vegetable juice, raw sprout seeds, foods containing game animals, fish or shellfish, '
    'alcoholic beverages, bottled water, packaged ice, consumable hemp products, food that will be '
    'further processed by a food processing plant, time/temperature control for safety food packaged '
    'using a reduced oxygen packaging method, milk or milk products regulated under chapter 192 or '
    '194, and meat, meat food products, poultry, or poultry products regulated under chapter 189A, '
    'except for any of the following products when sold directly to the end consumer: (1) Poultry ... '
    'if the producer raised the poultry ..." Acidified food is not on that list and moves from '
    'banned to allowed. Refrigerated food stays allowed and 137D.2(7)(e) confirms it by legislating '
    'a label for "refrigerated time/temperature control for safety foods". Meat stays conditional on '
    'the producer-raised poultry exception. Low-acid canned food is not named either way and stays '
    'banned — recorded more strictly than the text strictly requires, on the one axis where being '
    'wrong is dangerous. Juice, sprouts, game, fish and hemp have no axis here.',
  license_note =
    'A licence, inspected, and revocable. 137D.2 provides for inspection: the department "may enter '
    'a home food processing establishment at any reasonable hour to make the inspection" and "shall '
    'inspect only those areas related to preparing food for sale", and under (6) the inspection "may '
    'occur at any place where a homemade food item is created, transported, or stored for sale or '
    'resale." 137D.3 sets a civil penalty of "one hundred dollars per violation", each day a '
    'separate violation; 137D.4 allows an injunction and requires an establishment to cease '
    'operation on an imminent health hazard until authorised to resume; 137D.8 lets the department '
    'suspend or revoke the licence. retail_allowed is true because 137D.1(3) contemplates production '
    '"for sale or resale".',
  venue_note =
    'NOT ADDRESSED. Chapter 137D regulates the establishment, the label and the licence, and says '
    'nothing about where or how the food may be sold — the previous note, "Farmers markets, roadside '
    'stands, events and from home", is the summary''s. online_orders and mail_delivery stay allowed '
    'on that silence plus the chapter''s framing of production "for sale or resale ... for '
    'consumption off the premises", not on any express permission. Contrast the cottage food '
    'programme at 137F.20(1), where the channel is named and the exemption depends on it.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Iowa.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'IA' and ordinal = 2 and verified_at is null;
