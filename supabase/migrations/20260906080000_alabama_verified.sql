-- Harvest Local — Alabama's programme and label rule, from AL Code 22-20-5.1 and Ala. Admin. Code
-- r. 420-3-22-.01.
--
-- Three corrections, one of which is blocking sellers today.
--
-- ACIDIFIED FOODS were recorded as banned. 22-20-5.1(a)(1) defines cottage food to INCLUDE, at (g),
-- "Fermented or preserved vegetables or fruit that do not result in the production of alcohol and
-- that have an acidity level allowed by the department." Pickles and other acidified vegetables are
-- permitted subject to that acidity standard, so the axis is `conditional`, not `banned`. As it
-- stood, an Alabama seller could not list a product the statute expressly names.
--
-- DIRECT DELIVERY was `unclear`. The definition requires the operator to deliver "the foods produced
-- under paragraph a. directly to consumers in the state, whether in person, through an agent of the
-- producer, or by mail", so delivering to a buyer is not merely permitted, it is part of what the
-- operation is.
--
-- THE LABEL had no disclaimer and no minimum size, and Alabama prescribes both a statement and a
-- size. 22-20-5.1(e): the label "shall include in at least size 10-point font: 1. The common or
-- usual name of the food. 2. The name, home or P.O. Box address of the cottage food production
-- operation. 3. A statement that the food is not inspected by the department or local health
-- department. 4. A list of the ingredients in the food in descending order of predominance and
-- shall include a disclaimer that the food may contain allergens."
--
-- The five required elements we already held were right. The 10-point minimum and the not-inspected
-- statement were missing, so an Alabama label printed from our data was undersized and silent on
-- inspection.
--
-- A MODELLING NOTE, because this differs from Texas and Vermont. Alabama describes the required
-- statement's SUBSTANCE without prescribing its WORDING — unlike Tex. Health & Safety Code
-- 437.0193(b), which fixes the sentence exactly, or VT Admin. Code 12-5-52 6.2.1.1.7, which does
-- the same. `disclaimer_text` is documented as verbatim quoted law, so storing a sentence Alabama
-- never wrote strains that. It is stored anyway, because the alternative is a label that omits a
-- required statement entirely, and `disclaimer_font_note` says plainly that this is our compliant
-- rendering of a described requirement rather than a quotation. Anyone printing at scale in Alabama
-- should confirm the wording with ADPH.
--
-- `verified_at` stays null: the axes and channel fields below were read against the statute, the
-- remaining columns on the row were not.

set search_path = public;

update public.state_food_programs set
  cat_acidified = 'conditional',
  direct_delivery = 'allowed',
  category_note =
    'AL Code 22-20-5.1(a)(1) lists what counts as cottage food: baked goods (cakes, breads, Danish, '
    'pastries, donuts, pies), jam, jellies and fruit preserves, candy, dried and dehydrated herbs, '
    'herb mixes, vegetables and fruits, roasted coffee, dried baking mixes, and at (g) "Fermented '
    'or preserved vegetables or fruit that do not result in the production of alcohol and that have '
    'an acidity level allowed by the department" — hence acidified is conditional on that acidity '
    'standard rather than banned. The definition excludes meat, poultry and fish, and is limited to '
    'non-potentially-hazardous food, which is what bans the refrigerated and low-acid canned axes.',
  venue_note =
    'Sales and delivery are both confined to the state and both expressly include remote channels. '
    'A cottage food production operation "Sells the foods produced under paragraph a. only directly '
    'to consumers, whether in-person, by phone, or online, in the state" and "Delivers the foods '
    'produced under paragraph a. directly to consumers in the state, whether in person, through an '
    'agent of the producer, or by mail."',
  license_note =
    'No permit: 22-20-5.1(b) "A cottage food production operation is not a food service '
    'establishment and is not required to have a food service permit issued by the county health '
    'department", and (c) bars both the State Department of Public Health and county health '
    'departments from regulating production. Training IS required: (e) an operator "shall complete '
    'a food safety course approved by the department".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Alabama.pdf'
where state_code = 'AL' and ordinal = 1 and verified_at is null;

update public.state_label_rules set
  disclaimer_text = 'This food is not inspected by the Alabama Department of Public Health or a local health department.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note =
    'Size is prescribed: the whole label must be "in at least size 10-point font" (AL Code '
    '22-20-5.1(e)). WORDING IS NOT. Alabama requires "A statement that the food is not inspected by '
    'the department or local health department" and does not fix the sentence, so unlike Texas and '
    'Vermont the text stored here is our compliant rendering of a described requirement, not a '
    'quotation. Confirm the wording with ADPH before printing at scale.',
  notes =
    'AL Code 22-20-5.1(e) and Ala. Admin. Code r. 420-3-22-.01, read 2026-09-06. The label must '
    'carry the common or usual name of the food; the name and home or P.O. Box address of the '
    'operation; a statement that the food is not inspected; and the ingredients in descending order '
    'of predominance including a disclaimer that the food may contain allergens. Note what is NOT '
    'required: Alabama does not ask for a net weight, so that element is deliberately absent.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Alabama.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'AL' and ordinal = 1
)
and verified_at is null;
