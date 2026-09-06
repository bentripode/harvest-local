-- Harvest Local — Indiana, from Ind. Code 16-42-5.3-1 through -10, read 2026-09-06.
--
-- =========================================================================
-- 1. INDIANA REQUIRES THE WHOLE LABEL ON THE WEBSITE
-- =========================================================================
-- Ind. Code 16-42-5.3-5(b), in full: "A home based vendor shall post the label of each food product
-- on the vendor's website."
--
-- One sentence, and it is the strongest pre-checkout duty found in this pass. Texas requires the
-- labelling information before payment is accepted; Illinois requires a notice on the online sales
-- interface; Indiana requires THE LABEL, EACH PRODUCT, ON THE WEBSITE. That is exactly what
-- `product_label_disclosure()` returns and what the storefront listing renders, so
-- `predisclosure_required` becomes true and the feature does real work here rather than approximate
-- work.
--
-- =========================================================================
-- 2. EVERY CHANNEL WE USE IS NAMED IN THE STATUTE
-- =========================================================================
-- `venue_note` said "No restrictions". Ind. Code 16-42-5.3-4 is a list of conditions, two of which
-- are about channel: a home based vendor shall prepare and sell only a food product that is "(5)
-- sold in person, by telephone, or through the Internet; and (6) delivered to the end consumer in
-- person, by mail, or by a third party carrier."
--
-- Online selling, delivery and post are each named as permitted. Section 6 then conditions them:
-- "(a) A home based vendor may not ship or deliver a food product to an end consumer who is located
-- outside Indiana", and (b) requires a tamper-evident sealed package, a record of "the shipping or
-- delivery address of each end consumer the vendor sells a food product to for at least one (1) year
-- after the date of the sale", and production of that record to the state department on request.
--
-- =========================================================================
-- 3. REFRIGERATED FOOD WAS RECORDED AS ALLOWED AND IS EXCLUDED
-- =========================================================================
-- `cat_refrigerated` was `allowed`. Ind. Code 16-42-5.3-4(2) permits only a food product that is
-- "not a time temperature control for safety food". A food requiring refrigeration for safety is the
-- paradigm case of one. Corrected to banned.
--
-- The other axes need care, because that single phrase is the chapter's ONLY category limit and the
-- chapter does not define it — "time temperature control for safety food" is a term of art from the
-- retail food code, which has not been read here.
--
--   `cat_low_acid_canned` stays banned. Heat-treated low-acid food in a hermetically sealed
--   container is inside the standard definition, and this is the one where being wrong is dangerous.
--   `cat_acidified` and `cat_fermented` become `unclear`. Acidified was banned on nothing and
--   fermented was allowed on nothing; both were the summary's. Food below pH 4.6 is outside the
--   standard definition, which would make both permitted — but that reasoning runs through a
--   definition this chapter does not contain, so it is recorded as unchecked rather than asserted
--   in either direction. Neither value blocks a listing.
--
-- =========================================================================
-- 4. THE MEAT ALLOWANCE DOES NOT REACH AN ONLINE SALE
-- =========================================================================
-- `cat_meat` was already `conditional` with the note "Personally-raised poultry and rabbit", and the
-- condition is real but narrower than that reads. Section 10 is headed "Sale of Poultry and Rabbits
-- AT A FARMERS MARKET OR ROADSIDE STAND" and opens: "(a) This section applies to the sale of poultry
-- and rabbits by an individual vendor of a farmers' market or roadside stand." A "roadside stand" is
-- defined at 16-42-5.3-1(b) as a physical structure "visible from a road" and within a hundred feet
-- of it.
--
-- So an Indiana seller may sell exempt poultry and rabbit at a market or a stand and not through
-- this marketplace. `conditional` still does not block a listing, which is right — the condition is
-- a qualification for the seller to meet, not a prohibition on the food — but the note now says
-- where the qualification bites.
--
-- =========================================================================
-- 5. LOCAL PREEMPTION WAS ASSERTED AND IS NOT IN THE CHAPTER
-- =========================================================================
-- `local_preemption` was true. Section 3 exempts a home based vendor from "the requirements of this
-- title that apply to food establishments" — a state title, not local ordinances — and section 7(c)
-- points the other way, requiring the vendor to give a copy of the food handler certificate "to the
-- local health department in the county where the home based vendor's residence is located". The
-- chapter says nothing about preempting local rules, so the flag goes to null.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'producer_name', 'producer_address', 'product_name', 'ingredients_desc_by_weight',
    'net_weight', 'production_date'
  ],
  disclaimer_text = 'This product is home produced and processed and the production area has not been inspected by the Indiana Department of Health. NOT FOR RESALE.',
  disclaimer_min_pt = 10,
  disclaimer_all_caps = false,
  disclaimer_font_note = 'Ind. Code 16-42-5.3-5(a)(6) requires the statement "in at least 10 point type".',
  predisclosure_required = true,
  notes =
    'Ind. Code 16-42-5.3-5, read 2026-09-06: "(a) A home based vendor shall include a label for '
    'packaged food or a sign for unpackaged food that contains the following information: (1) The '
    'name and address of the producer of the food product. (2) The common or usual name of the food '
    'product. (3) The ingredients of the food product, in descending order by predominance by '
    'weight. (4) The net weight or volume of the food product by standard measure or numerical '
    'count. (5) The date on which the food product was processed. (6) The following statement in at '
    'least 10 point type: [the disclaimer]. (b) A home based vendor shall post the label of each '
    'food product on the vendor''s website." (b) IS WHY predisclosure_required IS TRUE, and Indiana '
    'asks for more than any other state found so far: not a notice or a sentence, but the whole '
    'label, per product, on the website. NO ALLERGEN ELEMENT — the statutory list has none, and '
    'federal labelling law reaches the seller independently. placard_required stays FALSE even '
    'though (a) offers "a sign for unpackaged food": that is an alternative form for food sold '
    'loose, not an additional point-of-sale notice, and a marketplace order is packaged. Compare '
    'Idaho, where the sign is one of three interchangeable forms for all food and the flag is true.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Indiana.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'IN' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  -- 16-42-5.3-4(6): "delivered to the end consumer in person".
  direct_delivery = 'allowed',
  -- 16-42-5.3-4(2) permits only food that is "not a time temperature control for safety food".
  cat_refrigerated = 'banned',
  -- Both were the summary's, in opposite directions, and the chapter's only limit runs through a
  -- definition it does not contain.
  cat_acidified = 'unclear',
  cat_fermented = 'unclear',
  -- Not addressed in the chapter; section 7(c) points the other way.
  local_preemption = null,
  venue_note =
    'EVERY CHANNEL IS NAMED IN THE STATUTE, and this row previously said "No restrictions". Ind. '
    'Code 16-42-5.3-4: a home based vendor shall prepare and sell only a food product that is "(1) '
    'made, grown, or raised by an individual at the individual''s primary residence, including any '
    'permanent structure that is on the same property as the residence; (2) not a time temperature '
    'control for safety food; (3) prepared using proper sanitary procedures ...; (4) not resold; (5) '
    'sold in person, by telephone, or through the Internet; and (6) delivered to the end consumer in '
    'person, by mail, or by a third party carrier." Section 6 conditions the last two: "(a) A home '
    'based vendor may not ship or deliver a food product to an end consumer who is located outside '
    'Indiana", and (b) requires a tamper-evident sealed package, a record of "the shipping or '
    'delivery address of each end consumer the vendor sells a food product to for at least one (1) '
    'year after the date of the sale", and production of that record to the state department on '
    'request — an obligation our order history already satisfies, though nothing here surfaces it to '
    'the seller. retail_allowed is false on (4) and on 16-42-5.3-1(a), which defines an end consumer '
    'as "the last person to purchase any food product and who does not resell the food product".',
  category_note =
    'ONE LIMIT, AND THE CHAPTER DOES NOT DEFINE IT. 16-42-5.3-4(2) permits only a food product that '
    'is "not a time temperature control for safety food"; there is no approved list and no '
    'prohibited list, which is why cat_shelf_stable is unrestricted. Refrigerated food and '
    'heat-treated low-acid canned food are inside the standard meaning of that term and are banned. '
    'Acidified and fermented food below pH 4.6 would be outside it — but that reasoning runs through '
    'a definition this chapter does not carry and which has not been read, so both are unclear '
    'rather than asserted; previously one was banned and the other allowed, both from the summary. '
    'MEAT: section 10 is the exemption and it is venue-bound. Its heading is "Sale of Poultry and '
    'Rabbits at a Farmers Market or Roadside Stand", and (a) reads "This section applies to the sale '
    'of poultry and rabbits by an individual vendor of a farmers'''' market or roadside stand", with '
    'a roadside stand defined at 16-42-5.3-1(b) as a structure "visible from a road" and "located '
    'not more than one hundred (100) feet from the edge of the side of the road". An Indiana seller '
    'may sell exempt poultry and rabbit there, not through this marketplace.',
  license_note =
    'No licence, no registration, no cap. Section 2: "A person may prepare and sell food products as '
    'a home based vendor if the person complies with the requirements of this chapter." Section 3: '
    'the production and sale "are exempt from the requirements of this title that apply to food '
    'establishments." Inspection is reactive only — section 8(a) makes a vendor subject to sampling '
    'and inspection if the state department determines the product is misbranded or adulterated, or '
    'if "a consumer complaint has been received", and 8(b) lets it order production and sale to stop '
    'where "an imminent health hazard exists". No revenue cap appears anywhere in the chapter. '
    'LOCAL PREEMPTION IS NOT ADDRESSED: the exemption in section 3 is from a state title, and 7(c) '
    'requires filing the food handler certificate with the county health department.',
  training_note =
    'Required and accredited: section 7(a), "A home based vendor shall obtain a food handler '
    'certificate from a certificate issuer that is accredited by the American National Standards '
    'Institute." (b) requires a copy on request to the state department OR AN END CONSUMER, and (c) '
    'requires a copy to be filed with the local health department in the vendor''s county.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Indiana.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'IN' and ordinal = 1 and verified_at is null;
