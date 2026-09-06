-- Harvest Local — Alaska's programme and label rule, from AS 17.20.332 to 17.20.338.
--
-- THE LABEL was wrong in both directions. It required a `permit_number` from a programme that has
-- no permit — 17.20.332 exempts homemade food from "state labeling, licensing, packaging,
-- permitting, and inspection requirements" — and it carried no disclaimer, though Alaska prescribes
-- one word for word. A packaged item must show "the producer's name, current address, telephone
-- number, and, if applicable, the producer's business license number", together with:
--
--     "This food was made in a home kitchen, is not regulated or inspected, except for meat and
--      meat products, and may contain allergens."
--
-- That is quoted statute and is stored verbatim. Unpackaged food is not exempt from the substance:
-- the seller must tell the buyer the same things out loud.
--
-- `permit_number` is REMOVED rather than remapped. Alaska asks for a business licence number "if
-- applicable", and `required_elements` has no way to say "if applicable" — a required element that
-- a producer legitimately lacks makes `renderLabel()` refuse to print at all. Leaving it out lets
-- the label print for the many producers with no business licence; the note tells the ones who have
-- a number to add it.
--
-- MEAT was recorded as allowed. It is prohibited with an exception: the statute bars "the purchase
-- or sale of (i) meat or meat products, except as provided in (h) of this section; (ii) seafood;
-- (iii) a controlled substance; (iv) oil rendered from animal fat; or (v) game meat", and (h) then
-- permits meat under that section. Conditional, not allowed — and seafood and game meat are barred
-- outright, which no axis of ours can express.
--
-- ONLINE and MAIL were `allowed` and `restricted`. Neither is in the statute. The venues are
-- exhaustive — "a farmers' market, an agricultural fair, a farm, a ranch, the producer's home or
-- office, the retail location of a third-party seller, or a location agreed on between the producer
-- and the buyer" — and interstate commerce is barred, but the internet is named nowhere. Both go to
-- `unclear`, which after `20260906010000` records the gap without blocking anyone. DIRECT DELIVERY
-- does become `allowed`: "a location agreed on between the producer and the buyer" is exactly that.
--
-- Confirmed as already correct: third-party retail (the statute names "a third-party vendor,
-- including a retail shop or grocery store" for non-hazardous items), refrigerated as conditional
-- (potentially hazardous homemade food may be sold, but "The seller of a potentially hazardous
-- homemade food, except eggs, must also be the producer"), no training requirement, no preemption.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_food_programs set
  online_orders = 'unclear',
  mail_delivery = 'unclear',
  direct_delivery = 'allowed',
  cat_meat = 'conditional',
  retail_allowed = true,
  venue_note =
    'AS 17.20.332 enumerates where a sale must occur: "a farmers'' market, an agricultural fair, a '
    'farm, a ranch, the producer''s home or office, the retail location of a third-party seller, or '
    'a location agreed on between the producer and the buyer". Interstate commerce is prohibited. '
    'The internet is named nowhere, so online and mail are recorded as unclear rather than read '
    'either way. Non-hazardous items may be sold by "the producer, an agent of the producer, or a '
    'third-party vendor, including a retail shop or grocery store"; for potentially hazardous food, '
    '"The seller ... except eggs, must also be the producer."',
  category_note =
    'Potentially hazardous homemade food MAY be sold, which is unusual — 17.20.338 defines it as '
    'food "that requires time or temperature control for safety" — subject to the seller also being '
    'the producer. Prohibited outright: "(i) meat or meat products, except as provided in (h) of '
    'this section; (ii) seafood; (iii) a controlled substance; (iv) oil rendered from animal fat; '
    'or (v) game meat." Meat is therefore conditional on (h). Note that the seafood and game-meat '
    'bans have no axis here and are not expressed anywhere in this row.',
  license_note =
    'None required. 17.20.332: a homemade food produced, sold and consumed in compliance with the '
    'section "is exempt from state labeling, licensing, packaging, permitting, and inspection '
    'requirements." No food safety training requirement and no preemption clause appear in the '
    'sections read.',
  source_url = 'https://codes.findlaw.com/ak/title-17-food-and-drugs/ak-st-sect-17-20-332/'
where state_code = 'AK' and ordinal = 1 and verified_at is null;

update public.state_label_rules set
  required_elements = array['producer_name', 'producer_address', 'producer_phone'],
  disclaimer_text = 'This food was made in a home kitchen, is not regulated or inspected, except for meat and meat products, and may contain allergens.',
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  metric_required = false,
  placard_required = false,
  notes =
    'AS 17.20.332, read 2026-09-06. A packaged item must carry "the producer''s name, current '
    'address, telephone number, and, if applicable, the producer''s business license number" plus '
    'the quoted statement. Two things this row cannot express. First, the business licence number '
    'is required only "if applicable", and required_elements has no conditional form — a required '
    'element the producer lacks stops renderLabel() printing at all — so permit_number is left out '
    'and a producer who HAS an Alaska business licence number should add it. Second, unpackaged '
    'food is not exempt from the substance: the seller must tell the buyer the same information '
    'verbally. Alaska asks for no net weight and no ingredient list.',
  source_url = 'https://codes.findlaw.com/ak/title-17-food-and-drugs/ak-st-sect-17-20-332/',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'AK' and ordinal = 1
)
and verified_at is null;
