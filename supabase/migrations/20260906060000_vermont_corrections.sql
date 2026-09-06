-- Harvest Local — Vermont, corrected against the administrative code as well as the statute.
--
-- `20260906020000` mapped Vermont's programmes from 18 V.S.A. 4353 and 4358 and removed the seeded
-- $6,500 threshold on Home Baker as "not in the statute". That was true of the statute and wrong as
-- a conclusion. VT Admin. Code 12-5-52 section 6.1.1 lists what is exempt from the licensing
-- requirement in 4353 and 4358:
--
--   6.1.1.1  "A non-bakery food manufacturing establishment that has gross annual sales of $10,000
--            or less"
--   6.1.1.2  "An individual manufacturing and selling bakery products, as defined in this rule,
--            from ones own home kitchen whose average gross retail sales do not exceed $125.00 per
--            week."
--
-- $125 a week is $6,500 a year. The seeded figure was the annualised form of a weekly rule, so it
-- is restored — recorded as the weekly figure it actually is, since a seller reads $125/week and
-- our cap machinery reads an annual number.
--
-- Home Baker also goes back to `conditional` rather than `yes`: below the threshold it is exempt,
-- above it the bakery bracket in 4353(3)(B) charges $100 for a home bakery.
--
-- One more thing worth recording rather than smoothing over: 6.1.1 lists only two exempt
-- categories, and a cottage food operation is not among them — yet 4353(3)(C) exempts cottage food
-- operations below $30,000. The statute is the higher authority and is the later word, so the
-- Cottage Food Operation row stands, but the rule has not obviously caught up with it and someone
-- verifying Vermont properly should resolve that against the Department rather than against us.
--
-- Section 6.1 also confirms the exempt routes are conditional rather than free: "Prior to
-- operation, a food manufacturing establishment claiming a license exemption shall submit the
-- Departments Self-Certification of Licensing Exemption form to the Department. The manufacturer is
-- exempt from licensure once the Department confirms, in writing, the receipt" of it.
--
-- `verified_at` stays null on every row. This corrects the fields that were checked — thresholds,
-- licence position, and the filing duty — and does not touch the food-category axes, mail delivery
-- or the venue fields, which have not been read against Vermont law.

set search_path = public;

update public.state_food_programs set
  license_threshold = 6500,
  license_required = 'conditional',
  license_note =
    'VT Admin. Code 12-5-52 6.1.1.2 exempts "An individual manufacturing and selling bakery '
    'products, as defined in this rule, from ones own home kitchen whose average gross retail sales '
    'do not exceed $125.00 per week" — $6,500 a year, which is the figure recorded here because the '
    'cap machinery works in annual terms. Tell a seller the weekly number. Above it, 18 V.S.A. '
    '4353(3)(B)I charges $100 annually for a home bakery. Exemption is not automatic: 6.1 requires '
    'the Department''s Self-Certification of Licensing Exemption form before operating, and the '
    'exemption begins only once the Department confirms receipt in writing.'
where state_code = 'VT' and ordinal = 1 and verified_at is null;

update public.state_food_programs set
  license_note =
    'VT Admin. Code 12-5-52 6.1.1.1 exempts "A non-bakery food manufacturing establishment that has '
    'gross annual sales of $10,000 or less", matching the fee schedule at 18 V.S.A. 4353(3)(A)III. '
    'Above it, $175 to $50,000 and $275 beyond. Exemption is not automatic: 6.1 requires the '
    'Department''s Self-Certification of Licensing Exemption form before operating, and the '
    'exemption begins only once the Department confirms receipt in writing.'
where state_code = 'VT' and ordinal = 2 and verified_at is null;

update public.state_food_programs set
  license_note =
    '18 V.S.A. 4353(3)(C): "Gross receipts of $30,000.00 or less from the sale of cottage food '
    'products are exempt pursuant to section 4358 of this title", and 4358(b) confirms the licence '
    'and fee obligations do not apply below that figure. NOTE a tension worth resolving with the '
    'Department: VT Admin. Code 12-5-52 6.1.1 lists only two exempt categories — non-bakery under '
    '$10,000 and home bakery under $125/week — and does not mention cottage food operations at all. '
    'The statute is the higher authority and the later word, so this row stands on 4353(3)(C), but '
    'the rule appears not to have caught up. 6.1 also requires the Self-Certification of Licensing '
    'Exemption form before operating.'
where state_code = 'VT' and ordinal = 4 and verified_at is null;
