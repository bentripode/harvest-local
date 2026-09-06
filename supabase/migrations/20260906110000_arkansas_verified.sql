-- Harvest Local — Arkansas, from Ark. Code Ann. 20-57-501 to 20-57-507 (Food Freedom Act).
--
-- THE LABEL RULE NEEDED NOTHING, which is the first time in this pass. 20-57-505(a) requires the
-- production date; the producer's name, address and telephone number; the common or usual name of
-- the product; the ingredients in descending order of predominance; and the statement "This product
-- was produced in a private residence that is exempt from state licensing and inspection. This
-- product may contain allergens." Every element was already present and the disclaimer was already
-- stored verbatim. Recorded here so the row carries its citation rather than a summary link.
--
-- ACIDIFIED was recorded as plainly allowed. It is permitted with real conditions attached.
-- 20-57-503(5)(B): non-TCS food "includes without limitation pickled cucumbers and other acidified
-- vegetables that have an equilibrium pH value of 4.6 or less if: (i)(a) The recipe: (1) Is from a
-- source approved by the department; or (2) Has been tested by an appropriately certified
-- laboratory that confirmed the finished product has an equilibrium pH value of 4.6 or less. (b) If
-- a recipe is not as described ... the producer shall test each batch of the recipe with a
-- calibrated pH meter". Conditional, and the existing `recipe_approval = conditional` was right for
-- the same reason.
--
-- FERMENTED was recorded as banned and nothing supports that. The statute names acidified foods
-- expressly and says the non-TCS category "includes WITHOUT LIMITATION" them, so the list is open
-- rather than exhaustive — a shelf-stable fermented product that is genuinely non-TCS would qualify
-- on the general definition. But fermentation is not named, and the pH conditions the statute
-- attaches to acidified foods are not obviously written for it. `unclear` records that honestly;
-- `banned` asserted a prohibition the text does not contain.
--
-- DIRECT DELIVERY was unclear. 20-57-504(b)(4) requires a transaction to "Be delivered by the
-- producer, agent of the producer, third-party vendor, or third-party carrier to the informed end
-- consumer" — delivery is not merely permitted, it is part of the required shape of the sale.
--
-- Confirmed already correct: no licence (20-57-504(a) exempts compliant products from "state
-- licensure, certification, inspection, and packaging and labeling requirements"), retail through a
-- third-party vendor, online selling, mail via third-party carrier, and the bans on meat, poultry,
-- seafood and time/temperature-control foods.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_food_programs set
  cat_acidified = 'conditional',
  cat_fermented = 'unclear',
  direct_delivery = 'allowed',
  category_note =
    'Ark. Code Ann. 20-57-504(b)(3) bars "the sale of meat, poultry, seafood, or time/temperature '
    'control for safety food products". 20-57-503(5)(B) then brings acidified foods back in with '
    'conditions: non-TCS food "includes without limitation pickled cucumbers and other acidified '
    'vegetables that have an equilibrium pH value of 4.6 or less" where the recipe is from a '
    'department-approved source or lab-tested, failing which "the producer shall test each batch of '
    'the recipe with a calibrated pH meter". Fermented foods are not named either way — the '
    '"without limitation" phrasing means the category is open, so a genuinely non-TCS fermented '
    'product would likely qualify, but the statute does not say so and neither do we.',
  venue_note =
    'Unusually permissive on channel. 20-57-504(b) requires the transaction to be "directly between '
    'the seller and the informed end consumer", but the seller "may be the producer ... an agent of '
    'the producer, or a third-party vendor, including a retail shop or grocery store", it may '
    '"Occur in Arkansas or in another state if the seller complies with all applicable federal '
    'laws", and it must "Be delivered by the producer, agent of the producer, third-party vendor, '
    'or third-party carrier". 20-57-505(b)(3) contemplates online selling directly, requiring the '
    'disclosures on "The website on which the homemade food or drink product is offered for sale if '
    'the product is offered for sale online."',
  license_note =
    'None. 20-57-504(a): "homemade food or drink products produced and sold in compliance with this '
    'subchapter are exempt from state licensure, certification, inspection, and packaging and '
    'labeling requirements." The buyer must be an "informed end consumer", defined as one who "Has '
    'been informed that the homemade food or drink product ... Is not regulated, inspected, '
    'certified, or subject to state packaging or labeling requirements".',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arkansas.pdf'
where state_code = 'AR' and ordinal = 1 and verified_at is null;

update public.state_label_rules set
  notes =
    'Ark. Code Ann. 20-57-505(a), read 2026-09-06. NO CORRECTION WAS NEEDED — every required '
    'element was already present and the disclaimer already stored verbatim. The statute requires '
    'the production date; "The name, address, and telephone number of the producer ... or an '
    'identification number provided by the Department of Agriculture if requested by the producer '
    'to protect the producer''s safety"; the common or usual name; the ingredients in descending '
    'order of predominance; and the quoted statement. Note the safety alternative: a producer may '
    'substitute a department-issued identification number for their name, address and phone, which '
    'this row cannot express — a seller relying on it should not use the generated label as-is. '
    'Delivery channel decides where the disclosure goes: a label on the package, or a placard at '
    'the point of sale for unpackaged goods, or the website where the product is offered online.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Arkansas.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'AR' and ordinal = 1
)
and verified_at is null;
