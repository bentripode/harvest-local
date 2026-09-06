-- Harvest Local — North Carolina, the last of the 51.
--
-- NC was held back from `20260905140000` and `20260905150000` because no compilation covers it and
-- the only reachable sources were NC State Extension pages, which sit a step below the department's
-- own rules. The NCDA&CS Home Processor Program page is that department's own rules, and it is the
-- source recorded here.
--
-- North Carolina has no cottage food statute. Home food production runs through the Home Processor
-- Program instead, and the shape of it is unlike anywhere else verified so far:
--
--   * NO PERMIT IS ISSUED. A Food Regulatory Specialist inspects the home and the processor
--     receives "a copy of the inspection report and the 'Notice of Inspection'" - documentation
--     that an inspection happened, not a licence to operate.
--   * BUT AN INSPECTION IS MANDATORY, on application, before selling.
--
-- `requires_license` is set TRUE, and the distinction from Texas is the reason. Texas issues nothing
-- at all - 437.0192(a) forbids a local authority from even requiring a permit - so demanding a
-- document there asked for something that does not exist, which is the bug
-- `20260905130000_permit_required_only_where_law_says.sql` was written to fix. North Carolina
-- mandates an approval step AND hands the processor a document at the end of it. A seller lawfully
-- operating in NC HAS a Notice of Inspection, so asking for one is both meaningful and satisfiable,
-- and a seller who cannot produce one has not been inspected.
--
-- The document our checklist calls a "Cottage food permit" is, in North Carolina, that Notice of
-- Inspection. The note says so, since the label would otherwise send a seller looking for a permit
-- their state does not issue.
--
-- `verified_at` is not seeded, as with every other state: the figure and the citation travel in
-- migrations, the attestation is per-environment.

set search_path = public;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against the NCDA&CS Home Processor Program (www.ncagr.gov/divisions/food-drug-protection/food-program/food-drug-food-program-home-processor), read 2026-09-06. North Carolina has NO cottage food statute; home food production runs through this programme instead. No sales cap is set. No permit is issued: after application, "a Food Regulatory Specialist will contact you to arrange a home processing facility inspection", and the processor receives "a copy of the inspection report and the Notice of Inspection". requires_license is nonetheless TRUE, because unlike Texas - which issues nothing and where asking for a document was therefore impossible to satisfy - the inspection is mandatory before selling and the processor ends up holding a document. What our checklist calls a "Cottage food permit" is, here, that Notice of Inspection. Low-risk shelf-stable products only: baked goods needing no refrigeration, jams, jellies and preserves, candies, dried mixes and spices, acid and acidified foods, freeze-dried candies. High-risk products are not permitted, including refrigerated or frozen items, low-acid canned goods, dairy, seafood, bottled water or juice, and bakery products with cream fillings. Shipping is contemplated rather than barred: labelling is required "if products are shipped using postal services such as USPS or FEDEX".'
where state_code = 'NC' and verified_at is null;
