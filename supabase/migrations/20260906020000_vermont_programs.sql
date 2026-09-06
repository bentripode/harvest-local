-- Harvest Local — resolve Vermont's programme mapping, and add the route that was missing.
--
-- Vermont's three seeded rows were flagged rather than verified because their names did not line up
-- with the statute's categories. Reading 18 V.S.A. 4353 (the fee schedule) and 4358 (exemptions)
-- resolves it, and shows one route absent altogether.
--
-- What 4353 actually lists:
--
--   * Restaurants, VII: "Home Caterer; $155.00"                          -> our Home Caterer
--   * Food manufacturing establishments; NONBAKERIES:
--       "Gross receipts of $10,000.00 or less are exempt pursuant to      -> our Home Food Processor
--        section 4358"
--   * Food manufacturing establishments; BAKERIES: "I Home bakery;        -> our Home Baker
--        $100.00" — with NO exemption row in that bracket
--   * Food manufacturing establishments; COTTAGE FOOD OPERATIONS:         -> MISSING from our data
--       "Gross receipts of $30,000.00 or less from the sale of cottage
--        food products are exempt pursuant to section 4358"
--
-- Two consequences.
--
-- The seeded $6,500 threshold on Home Baker is not in the statute and never was: the bakery bracket
-- carries a flat $100 home bakery licence and no exemption figure. It is removed and the row is
-- corrected to a licensed one.
--
-- The cottage food operation route — the one a Vermont seller of shelf-stable homemade food would
-- actually be on, and the only one with the $30,000 exemption — had no row at all, so a Vermont
-- seller could not pick it during onboarding. It is added here.
--
-- 4358(c) applies across the exempt routes and is worth recording: exemption is not silence. "a food
-- manufacturing establishment claiming a licensing exemption pursuant to this title shall submit to
-- the Department a licensing exemption filing as required by rule", attesting to any training the
-- rules require. So `license_required = 'conditional'` on the exempt routes rather than 'no'.
--
-- `verified_at` is left null throughout: this settles the mapping and the figures, it does not
-- constitute a field-by-field review of the other columns on these rows.

set search_path = public;

-- Home Baker -> the bakery bracket: a flat licence, no exemption threshold.
update public.state_food_programs set
  license_threshold = null,
  license_required = 'yes',
  license_note =
    '18 V.S.A. 4353(3)(B): "Food manufacturing establishments; bakeries — I Home bakery; $100.00". '
    'That bracket lists no exemption threshold, unlike the nonbakery and cottage food brackets, so '
    'a home bakery is licensed from the first sale. The $6,500 previously recorded here does not '
    'appear in the statute. A baker selling shelf-stable cottage food products may instead belong '
    'on the Cottage Food Operation row, which is exempt below $30,000.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Vermont.pdf'
where state_code = 'VT' and ordinal = 1 and verified_at is null;

-- Home Food Processor -> the nonbakery bracket. Figure already right; record the filing duty.
update public.state_food_programs set
  license_threshold = 10000,
  license_required = 'conditional',
  license_note =
    '18 V.S.A. 4353(3)(A): "Gross receipts of $10,000.00 or less are exempt pursuant to section '
    '4358 of this title"; above that, $175 to $50,000 and $275 beyond. Exemption is not silence — '
    '4358(c) still requires an annual licensing exemption filing attesting to any training the '
    'rules require.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Vermont.pdf'
where state_code = 'VT' and ordinal = 2 and verified_at is null;

-- The missing route. Ordinal 4 keeps the existing three in place.
insert into public.state_food_programs (
  state_code, ordinal, name,
  online_orders, mail_delivery, direct_delivery,
  revenue_cap, cap_basis, license_threshold,
  license_required, license_note,
  inspection_required, recipe_approval, training_required,
  local_preemption, source_url, source_checked_at
)
select
  'VT', 4, 'Vermont Cottage Food Operation',
  -- Matches the other Vermont rows; the statute read here does not address internet sales either
  -- way, and after 20260906010000 only a recorded ban blocks.
  'allowed', 'unclear', 'unclear',
  null, 'none', 30000,
  'conditional',
  '18 V.S.A. 4353(3)(C): "Gross receipts of $30,000.00 or less from the sale of cottage food '
  'products are exempt pursuant to section 4358 of this title." 4358(b) confirms the licence and '
  'fee obligations do not apply to a cottage food operation below that figure, and 4358(c) still '
  'requires an annual licensing exemption filing attesting to any required training — hence '
  'conditional rather than no. 4301(a) defines a cottage food operator as one producing or '
  'packaging cottage food products "solely in the home kitchen of the person''s private residential '
  'dwelling or a kitchen on the person''s personal property", and a cottage food product as food '
  'that does not require refrigeration or time or temperature control.',
  false, 'unclear', 'unclear',
  false,
  'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Vermont.pdf',
  '2026-09-06'
where not exists (
  select 1 from public.state_food_programs where state_code = 'VT' and ordinal = 4
);
