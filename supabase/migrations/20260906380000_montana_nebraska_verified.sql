-- Harvest Local — Montana and Nebraska, from Mont. Code Ann. 50-49-203 (with 50-50-102) and Neb.
-- Rev. Stat. 81-2,245.01 and 81-2,280, read 2026-09-06.
--
-- Both states prescribe a disclosure by SUBSTANCE and not by wording, which is now the fourth and
-- fifth instance of that shape after Louisiana, Missouri and — as it turns out — Nebraska's own
-- invented placard. Montana leaves the "cannot print" list as a result.
--
-- =========================================================================
-- MONTANA
-- =========================================================================
--
-- 1. THE TWO-SCHEME TRAP, CONFIRMED FROM THE OTHER SIDE.
--
-- Montana runs a cottage food operation scheme in Title 50 chapter 50 AND the Local Food Choice Act
-- in chapter 49. Our row is the Local Food Choice Act, and an earlier pass nearly recorded a blanket
-- online ban against it by reading the wrong chapter. Reading both confirms the distinction:
--
--   50-50-102(6) defines a cottage food "direct sale" as "a face-to-face purchase or exchange ...
--   The direct sale may not be by consignment or involve shipping or internet sales."
--   50-49-203(1)(c) says a producer under the Local Food Choice Act "is not: (i) a retail food
--   establishment, A COTTAGE FOOD OPERATION, or a temporary food establishment, as each term is
--   defined in 50-50-102".
--
-- The internet ban lives in a definition that expressly does not apply to this programme. Recorded
-- so nobody re-derives it a third time.
--
-- 2. MONTANA FORBIDS THE STATE FROM REQUIRING A LABEL AT ALL — AND STILL REQUIRES A DISCLOSURE.
--
-- 50-49-203(1)(a): "A state agency or an agency of a political subdivision of the state may not
-- require licensure, permitting, certification, packaging, LABELING, testing, sampling, or
-- inspection that pertains to the preparation, serving, use, consumption, delivery, or storage of
-- homemade food".
--
-- And then (3): "a producer shall inform an end consumer that any homemade food or homemade food
-- product sold through ranch, farm, or home-based sales pursuant to this part has not been licensed,
-- permitted, certified, packaged, labeled, or inspected per any official regulations."
--
-- A duty to inform, with no wording prescribed and no label mandated. That is the `seller_statement`
-- shape exactly, and it takes Montana off the list of states this generator refuses to print for.
-- The seller writes the sentence; nothing else goes on the label, because Montana forbids the state
-- to require anything else.
--
-- 3. DELIVERY IS INSIDE THE DEFINITION OF A TRANSACTION.
--
-- 50-49-202(8): ""Transaction" means an exchange of buying and selling, including the transfer of a
-- product by delivery." `direct_delivery` moves from unclear to allowed on that. 50-49-203(2)
-- confines transactions to being "directly between the producer and the informed end consumer",
-- "only for home consumption or consumption at a traditional community social event", and occurring
-- "only in this state" without interstate commerce — the last of which this marketplace satisfies
-- by construction.
--
-- =========================================================================
-- NEBRASKA
-- =========================================================================
--
-- 4. THE PLACARD TEXT WAS INVENTED, AND OUR OWN NOTE SAID SO.
--
-- We stored: "Prepared in a kitchen that is not subject to regulation and inspection by the
-- regulatory authority, and may contain allergens." The note beside it read: Nebraska "requires a
-- 'clearly visible notification' rather than fixed label wording".
--
-- 81-2,280(5)(a): "The producer shall inform the consumer by a clearly visible notification that the
-- food: (i) Was prepared in a kitchen that is not subject to regulation and inspection by a
-- regulatory authority; and (ii) May contain allergens."
--
-- Two facts to convey, no sentence to reproduce. Same correction as Missouri in the previous
-- migration: the invented text goes, `seller_statement` takes its place. `placard_required` STAYS
-- true, unlike Missouri's, because Nebraska really does require the notification at a physical sale
-- point — (5)(b), "For sales conducted at a farmers market, fair, festival, craft show, or other
-- public event, such notification shall be provided at the sale location" — but `placard_text`
-- becomes null, because there is no prescribed wording to print.
--
-- 5. PREDISCLOSURE IS CONFIRMED ON THE STATUTE, AND IT NAMES THE WEBSITE.
--
-- The flag was set from a summary. 81-2,280(5)(c): "For sales conducted for pickup or delivery, such
-- notification shall be provided at the producer's private home, ON THE PRODUCER'S WEBSITE, if such
-- website exists, and in any print, radio, television, or Internet advertisement for such sales."
--
-- Pickup or delivery is precisely this marketplace's model, so (5)(c) is the operative limb for
-- every Nebraska order here. See the WARNING in the label rule's notes: our pre-checkout disclosure
-- cannot currently render a seller-written statement, so this requirement is not yet met by the
-- platform.
--
-- 6. THE LABEL IS SHORT, AND ITS INGREDIENT LIST IS CONDITIONAL.
--
-- 81-2,280(6): "The producer shall label the food so that the name and address of the producer is
-- provided to the consumer on the package or container label. Food that is time/temperature control
-- for safety food shall ALSO have labeling that includes ingredients in descending order of
-- predominance." Name and address always; ingredients only for TCS food, which nothing here
-- identifies — so ingredients move to `optional_elements`.
--
-- 7. ACIDIFIED FOOD IS NOT FLATLY BANNED, AND MAIL IS "RESTRICTED" IN THE PRECISE SENSE.
--
-- 81-2,280(2) lets a producer provide TCS food except nine named types, one of which is "(g)
-- Low-acid canned food and HERMETICALLY SEALED acidified food". A refrigerated pickle that is not
-- hermetically sealed is not on the list, so acidified becomes `conditional`. Meat ("(a) Any part of
-- an animal, vertebrate or invertebrate, or animal by-product") and fermented food ("(i) Kimchi,
-- kombucha, or similar fermented foods") are banned by name and stay so.
--
-- (7) is why `mail_delivery` is `restricted` rather than allowed or banned: "(a) Food that is not
-- time/temperature control for safety food may be delivered by United States mail or a commercial
-- mail delivery service. (b) Food that is time/temperature control for safety food shall be
-- delivered only by the producer to the consumer in person ... and not be transported for longer
-- than two hours."
--
-- `verified_at` stays null on all four rows.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Montana — Local Food Choice Act (Mont. Code Ann. 50-49 part 2)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array['seller_statement'],
  seller_statement_prompt =
    'a statement that the food has not been licensed, permitted, certified, packaged, labeled, or '
    'inspected per any official regulations (Mont. Code Ann. 50-49-203(3))',
  disclaimer_text = null,
  notes =
    'MONTANA FORBIDS THE STATE FROM REQUIRING A LABEL, AND STILL REQUIRES A DISCLOSURE. This row was '
    'empty and refused to print; the rule is now recorded. Mont. Code Ann. 50-49-203(1)(a), read '
    '2026-09-06: "A state agency or an agency of a political subdivision of the state may not '
    'require licensure, permitting, certification, packaging, labeling, testing, sampling, or '
    'inspection that pertains to the preparation, serving, use, consumption, delivery, or storage of '
    'homemade food or a homemade food product under this part." (1)(d) repeats it against named '
    'chapters. But (3): "Except as provided in subsection (7), a producer shall inform an end '
    'consumer that any homemade food or homemade food product sold through ranch, farm, or '
    'home-based sales pursuant to this part has not been licensed, permitted, certified, packaged, '
    'labeled, or inspected per any official regulations." A duty to INFORM, with no wording '
    'prescribed and no label mandated — the seller_statement shape, as in Louisiana, Missouri and '
    'Nebraska. NOTHING ELSE GOES ON A MONTANA LABEL: no product name, no ingredients, no net weight, '
    'no allergens, because (1)(a) forbids the state to require them.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Montana.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'MT' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 50-49-202(8) puts "the transfer of a product by delivery" inside the definition of a transaction.
  direct_delivery = 'allowed',
  venue_note =
    'THE TWO-SCHEME TRAP, AND WHY ONLINE SELLING IS NOT BANNED HERE. Montana runs a cottage food '
    'operation scheme in Title 50 chapter 50 and the Local Food Choice Act in chapter 49; this row '
    'is the latter. 50-50-102(6) defines a cottage food "direct sale" as "a face-to-face purchase or '
    'exchange ... The direct sale may not be by consignment or involve shipping or internet sales" — '
    'and 50-49-203(1)(c) provides that a producer under this part "is not: (i) a retail food '
    'establishment, a cottage food operation, or a temporary food establishment, as each term is '
    'defined in 50-50-102." The internet ban sits in a definition that expressly does not reach this '
    'programme. An earlier pass nearly recorded it against this row by reading the wrong chapter; it '
    'is written down here so nobody derives it a third time. WHAT THIS PART DOES REQUIRE, at '
    '50-49-203(2): transactions "(a) must be directly between the producer and the informed end '
    'consumer; (b) must be only for home consumption or consumption at a traditional community '
    'social event; (c) must occur only in this state and may not involve interstate commerce; and '
    '(d) are not subject to regulation by a board of county commissioners". (c) is satisfied by '
    'construction here. Delivery is expressly inside the definition of a transaction — 50-49-202(8), '
    '""Transaction" means an exchange of buying and selling, including the transfer of a product by '
    'delivery." (4) keeps homemade food out of retail food establishments unless licensed, which is '
    'why retail_allowed is false.',
  category_note =
    'BROAD, WITH MEAT AS THE ONE REAL LIMIT. Mont. Code Ann. 50-49-203(7)(a): "meat or meat products '
    'processed at a state-licensed establishment or a federally approved meat establishment, by the '
    'producer, or by any third party may not be used in preparation of homemade food that is sold '
    'pursuant to a transaction provided for in this part." (7)(b): "Subsection (7)(a) does not apply '
    'to a producer who slaughters fewer than 1,000 poultry birds a year except that the producer is '
    'subject to the requirements of 9 CFR 381.10(c) and the recordkeeping requirements of 9 CFR '
    '381.175. The poultry or poultry products may not be adulterated or misbranded." That is why '
    'cat_meat is conditional. DAIRY IS PERMITTED WITH TESTING, which is why cat_refrigerated is '
    'allowed: (8) requires a small dairy to "sample, test, or retest every 6 months for standard '
    'plate count, coliform count, and somatic cell count", to test annually for brucellosis in every '
    'lactating animal, and to keep two years of records. (6) forbids donating milk to a community '
    'event. No other food-type restriction appears in 50-49-203.',
  license_note =
    'None, and the preemption is written as a prohibition on government. 50-49-203(1)(a): "A state '
    'agency or an agency of a political subdivision of the state may not require licensure, '
    'permitting, certification, packaging, labeling, testing, sampling, or inspection ..." (1)(b) '
    'preserves voluntary help: "This part does not preclude an agency from providing assistance, '
    'consultation, or inspection requested by a producer." (1)(d) exempts a producer from "labeling, '
    'licensure, inspection, sanitation, or other requirements or standards of 30-12-301; Title 50, '
    'chapters 31 and 50; or Title 81, chapters 2, 9, 21, 22, or 23." No revenue cap appears in the '
    'part as read.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Montana.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'MT' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- Nebraska — Producer of food at a private home (Neb. Rev. Stat. 81-2,280)
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array['producer_name', 'producer_address', 'seller_statement'],
  -- (6) requires ingredients only for time/temperature control for safety food, which nothing here
  -- identifies; required, it would block every shelf-stable Nebraska label.
  optional_elements = array['ingredients_desc_by_weight'],
  seller_statement_prompt =
    'a clearly visible notification that the food was prepared in a kitchen that is not subject to '
    'regulation and inspection by a regulatory authority, and may contain allergens '
    '(Neb. Rev. Stat. 81-2,280(5)(a))',
  disclaimer_text = null,
  -- (5)(b) really does require the notification at a physical sale point — but Nebraska prescribes
  -- no wording, so there is no text to carry.
  placard_required = true,
  placard_text = null,
  predisclosure_required = true,
  notes =
    'Neb. Rev. Stat. 81-2,280(5) and (6), read 2026-09-06. THE PLACARD TEXT WE HELD WAS INVENTED and '
    'the note beside it admitted Nebraska "requires a clearly visible notification rather than fixed '
    'label wording". (5)(a): "The producer shall inform the consumer by a clearly visible '
    'notification that the food: (i) Was prepared in a kitchen that is not subject to regulation and '
    'inspection by a regulatory authority; and (ii) May contain allergens." Two facts to convey, no '
    'sentence to reproduce — so the seller writes it, as in Louisiana, Missouri and Montana. '
    'placard_required stays true, unlike Missouri''s, because (5)(b) genuinely requires it at a '
    'physical sale point: "For sales conducted at a farmers market, fair, festival, craft show, or '
    'other public event, such notification shall be provided at the sale location." placard_text is '
    'null because there is nothing prescribed to print. THE LABEL ITSELF IS TWO ITEMS. (6): "The '
    'producer shall label the food so that the name and address of the producer is provided to the '
    'consumer on the package or container label. Food that is time/temperature control for safety '
    'food shall also have labeling that includes ingredients in descending order of predominance." '
    'Ingredients are therefore optional here — required only for TCS food, which this schema does '
    'not identify. PREDISCLOSURE IS NOW CONFIRMED ON THE STATUTE rather than a summary, and (5)(c) '
    'is the limb that governs every order on this marketplace: "For sales conducted for pickup or '
    'delivery, such notification shall be provided at the producer''s private home, on the '
    'producer''s website, if such website exists, and in any print, radio, television, or Internet '
    'advertisement for such sales." WARNING — THIS IS NOT YET SATISFIED BY THE PLATFORM: '
    'product_label_disclosure() cannot render a seller-written statement, because seller_statement '
    'is collected at print time and is not stored anywhere a storefront listing can read. Until it '
    'has a permanent home on the seller profile, a Nebraska listing does not carry the notification '
    '(5)(c) requires on the producer''s website.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Nebraska.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'NE' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 81-2,280(2)(g) bans "hermetically sealed acidified food"; an unsealed acidified food is not on
  -- the list.
  cat_acidified = 'conditional',
  -- (7)(b): TCS food must be delivered by the producer in person, so the post is not open to it.
  mail_delivery = 'restricted',
  direct_delivery = 'allowed',
  venue_note =
    'PICKUP AND DELIVERY FROM THE HOME ARE EXPRESSLY CONTEMPLATED, and the row previously said "No '
    'restrictions". Neb. Rev. Stat. 81-2,245.01(7) excludes from "food establishment" a private home '
    'where a producer meeting 81-2,280 prepares food "for sale directly to the consumer including, '
    'but not limited to, at a farmers market, fair, festival, craft show, or other public event or '
    'for pick up at or delivery from such private home" — an open list ("including, but not limited '
    'to") that names our two fulfilment modes. DELIVERY IS CONDITIONED BY FOOD TYPE. 81-2,280(7): '
    '"(a) Food that is not time/temperature control for safety food may be delivered by United '
    'States mail or a commercial mail delivery service. (b) Food that is time/temperature control '
    'for safety food shall be delivered only by the producer to the consumer in person. When '
    'transported, such food shall be maintained at a temperature in accordance with the Nebraska '
    'Pure Food Act and not be transported for longer than two hours." That is why mail_delivery is '
    'restricted rather than simply allowed. LOCAL LAW IS PREEMPTED — (8): "The provisions of this '
    'section supersede and preempt any ordinance, rule, regulation, or resolution regulating food '
    'safety and handling adopted or enacted by a political subdivision that is not in conformance '
    'with this section."',
  category_note =
    'TCS FOOD IS PERMITTED EXCEPT NINE NAMED TYPES — which is why cat_refrigerated is allowed. Neb. '
    'Rev. Stat. 81-2,280(2): "Such producer shall only provide food that is not adulterated and is '
    'not any of the following types of time/temperature control for safety food: (a) Any part of an '
    'animal, vertebrate or invertebrate, or animal by-product; (b) Fluid milk or milk products as '
    'defined in the Grade A Pasteurized Milk Ordinance ...; (c) Raw eggs; (d) Unpasteurized juice; '
    '(e) Infused oils or honey; (f) Sprouts; (g) Low-acid canned food and hermetically sealed '
    'acidified food; (h) Tofu, tempeh, or similar meat substitutes; or (i) Kimchi, kombucha, or '
    'similar fermented foods." Meat is banned by (a), low-acid canned by (g), and fermented food by '
    '(i), all by name. ACIDIFIED IS NOT FLATLY BANNED: (g) reaches "hermetically sealed" acidified '
    'food, so a refrigerated unsealed pickle is not on the list — conditional rather than banned. '
    'Milk, raw eggs, juice, infused oils and honey, sprouts and meat substitutes are also excluded '
    'and have no axis here.',
  license_note =
    'Registration and training, both with the same carve-out. 81-2,280(4): "The producer shall '
    'register with the department prior to conducting any sales of food", giving name, address and '
    'telephone number, the food safety course taken and its date, and "proof of private well water '
    'testing for contamination by nitrate or bacteria if the producer uses private well water" — but '
    '"This subsection shall not apply to a producer of food that is not time/temperature control for '
    'safety food selling directly to the consumer at a farmers market." (3) imposes the same '
    'condition on training, requiring before any sales "(a) A nationally accredited food safety and '
    'handling education course ...; (b) A certified food safety and handling training course offered '
    'at a culinary school or as required by a county, city, or village to obtain a food handler '
    'permit; or (c) A food safety and handling education course approved by the department." No '
    'revenue cap appears in the section.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Nebraska.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'NE' and ordinal = 1 and verified_at is null;
