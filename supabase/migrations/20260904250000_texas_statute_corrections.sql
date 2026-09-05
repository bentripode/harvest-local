-- Harvest Local — correct the Texas program against the statute.
--
-- The programs and label rules were seeded from the Institute for Justice's state pages, which are
-- a summary of the law. Checking Texas against Texas Health & Safety Code Chapter 437 turned up
-- three things the summary got wrong or left out. Nine other fields checked out exactly, which is
-- roughly the hit rate the verify gate exists to measure.
--
-- 1. THE LABEL DISCLAIMER WAS WRONG. The seed carried "This food is made in a home kitchen and is
--    not inspected by the Department of State Health Services or a local health department."
--    §437.0193(b)(2) requires a materially different sentence, in capitals. The generator would
--    have printed non-compliant text onto food.
--
-- 2. `direct_delivery` was 'unclear'. §437.0194(b)(1) answers it outright: an internet sale is
--    permitted ONLY IF the operator, their employee or a household member personally delivers the
--    food. Delivery is not merely allowed, it is the required fulfilment method — and it must be
--    personal, which is why mail and third-party carriers stay banned.
--
-- 3. The $150,000 cap is not a fixed figure. §437.001(2-b)(B) has the department adjust it annually
--    for inflation using CPI-U, so the stored number is a point-in-time value.
--
-- `verified_at` is deliberately NOT set. These corrections are ours; the sign-off belongs to an
-- admin reviewing the row at /admin/programs.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. The statutory disclaimer, verbatim and in the capitals the statute uses.
-- ---------------------------------------------------------------------------
update public.state_label_rules lr
  set disclaimer_text = 'THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION.',
      disclaimer_all_caps = true,
      notes = 'Disclaimer wording is Texas Health & Safety Code §437.0193(b)(2), taken from the '
              'statute rather than a summary. Frozen food must additionally carry, in 12-point or '
              'larger: "SAFE HANDLING INSTRUCTIONS: To prevent illness from bacteria, keep this '
              'food frozen until preparing for consumption". Under §437.0193(b-1) the operation''s '
              'address may be omitted from the label if the operation registers with DSHS.',
      source_url = 'https://statutes.capitol.texas.gov/Docs/HS/htm/HS.437.htm',
      source_checked_at = date '2026-09-04'
  from public.state_food_programs fp
  where fp.id = lr.program_id
    and fp.state_code = 'TX';

-- ---------------------------------------------------------------------------
-- 2 & 3. Delivery is answered by statute, and the cap moves with inflation.
-- ---------------------------------------------------------------------------
update public.state_food_programs
  set direct_delivery = 'allowed',
      venue_note = 'An internet sale is permitted only if the operator, their employee or a '
                   'household member personally delivers the food to the consumer '
                   '(§437.0194(b)(1)). No mail, no third-party carriers.',
      cap_note = 'Adjusted annually for inflation by the department using CPI-U '
                 '(§437.001(2-b)(B)), so this figure is point-in-time.',
      source_url = 'https://statutes.capitol.texas.gov/Docs/HS/htm/HS.437.htm',
      source_checked_at = date '2026-09-04'
  where state_code = 'TX';

-- Not corrected here, because it is a feature rather than a data fix: §437.0194(b)(2) requires the
-- labelling information to be shown to the buyer BEFORE payment is accepted — on the product page,
-- not only on the package. The storefront shows allergens and net weight today, not the disclaimer.
