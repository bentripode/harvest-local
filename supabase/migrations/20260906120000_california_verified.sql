-- Harvest Local — California, from Cal. Health & Saf. Code 113758, 114365, 114365.2, 114365.3,
-- 114365.5, 113849 and 114367.6.
--
-- Two findings. One corrects the data. The other is not about the data at all and is recorded here
-- because there is nowhere better for it to live yet.
--
-- =========================================================================
-- 1. CLASS A AND CLASS B REQUIRE DISCLOSURE IN INTERNET ADVERTISING
-- =========================================================================
-- 114365.3(f): "A cottage food operation that advertises to the public, including through an
-- internet website, social media platform, newspaper, newsletter, or other public announcement,
-- shall indicate the following on the advertisement: (1) The county of approval. (2) The permit or
-- registration number. (3) A statement that the food prepared is Made in a Home Kitchen or
-- Repackaged in a Home Kitchen, as applicable."
--
-- A storefront listing is an internet advertisement. So California joins Texas and Nebraska as a
-- state whose rules reach what the buyer sees BEFORE they buy, and `predisclosure_required` becomes
-- true for both cottage food classes. It stays false for MEHKO, which 113849(b)(2) expressly
-- excludes from being a cottage food operation, so (f) does not reach it.
--
-- The label also needs the county. 114365.3(e)(4) requires "The registration or permit number of
-- the Class A or Class B cottage food operation ... and the name of the county of the local
-- enforcement agency that issued the permit or registration number." `municipality` is the element
-- for it and was missing. The 12-point minimum and the "Made in a Home Kitchen" wording were
-- already right.
--
-- =========================================================================
-- 2. THE PLATFORM ITSELF IS REGULATED WHEN A MEHKO SELLS THROUGH IT
-- =========================================================================
-- This is not a seller obligation and no column here can carry it.
--
-- 113849(a) provides that selling through "the internet website or mobile application of an
-- internet food service intermediary, as defined in Section 114367.6, is a direct sale to
-- consumers", and that such an operation "shall consent to the disclosures specified in paragraphs
-- (6) and (7) of subdivision (a) of Section 114367.6."
--
-- 114367.6 defines an internet food service intermediary as "an entity that provides a platform on
-- its internet website or mobile application through which a microenterprise home kitchen operation
-- may choose to offer food for sale and from which the internet food service intermediary derives
-- revenues." Harvest Local, taking a subscription from sellers who list on it, is that entity.
--
-- Subdivision (a) then places SEVEN duties on the intermediary, the first of which is a licence:
--
--   (1) "Be registered with the department. A registration, once issued, is nontransferable."
--   (2) Post the MEHKO permitting requirements clearly and conspicuously, at a high-school reading
--       level.
--   (3) Display platform and third-party delivery fees clearly and conspicuously to both consumers
--       and operators, and give operators at least one month's notice of any fee increase over 2%.
--   (4) Post whether the intermediary carries liability insurance covering incidents arising from
--       the sale or consumption of food.
--   (5) Provide a dedicated field on the platform for the operation to post its permit number and
--       the name of its enforcement agency.
--   (6) Display how consumers may contact the intermediary with a food safety or hygiene complaint,
--       and link to the department's site for filing enforcement complaints.
--   (7) Report an operation's name and permit number to the enforcement agency on receiving "three
--       or more unrelated individual food safety or hygiene complaints in a calendar year".
--
-- None of this is implemented. (5) has no equivalent — `seller_licenses` is an admin review queue,
-- not a per-listing field. (7) is close to the `reports` table but nothing counts complaints per
-- seller per year or notifies an agency. (1) is a registration the company would have to hold
-- before a single California MEHKO listed.
--
-- Recorded on the MEHKO row so it is discoverable from the data, and it belongs in LAUNCH.md rather
-- than a migration comment. Until it is dealt with, California MEHKO is the one programme in this
-- dataset that the platform cannot lawfully serve simply by getting the seller's paperwork right.
--
-- `verified_at` stays null on all three rows.

set search_path = public;

-- Class A and Class B: the advertising rule reaches the storefront listing.
update public.state_label_rules set
  required_elements = array[
    'business_name', 'producer_address', 'permit_number', 'municipality',
    'product_name', 'ingredients_desc_by_weight', 'allergens', 'net_weight'
  ],
  predisclosure_required = true,
  disclaimer_font_note =
    'The words must appear "in 12-point type on the cottage food product''s primary display panel" '
    '(114365.3(e)(1)). Use "Repackaged in a Home Kitchen" instead where applicable, with a '
    'description of any purchased whole ready-to-eat product not used as an ingredient.',
  notes =
    'Cal. Health & Saf. Code 114365.3(e) and (f), read 2026-09-06. The label carries the Made in a '
    'Home Kitchen statement at 12pt on the primary display panel, the food''s common or descriptive '
    'name, the name of the operation, the registration or permit number AND "the name of the county '
    'of the local enforcement agency that issued" it, and the ingredients in descending order where '
    'there are two or more. Federal labelling under 21 U.S.C. 343 applies on top, which is where '
    'net weight and allergens come from. PREDISCLOSURE IS REQUIRED: (f) obliges an operation that '
    'advertises "through an internet website, social media platform" to show the county of '
    'approval, the permit or registration number, and the Made in a Home Kitchen statement on the '
    'advertisement itself — a storefront listing is an advertisement.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/California.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'CA' and ordinal in (1, 2)
)
and verified_at is null;

update public.state_food_programs set
  direct_delivery = 'allowed',
  license_note =
    'Class A registers with the local enforcement agency on a self-certification checklist; Class B '
    'holds a permit and is inspected. 113851(b): "Registration shall have the same meaning as '
    'permit for purposes of implementation and enforcement of this part." Both are county-level: '
    'the label and any internet advertisement must name the county of approval.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/California.pdf'
where state_code = 'CA' and ordinal in (1, 2) and verified_at is null;

-- MEHKO: the platform-level obligation.
update public.state_food_programs set
  direct_delivery = 'allowed',
  venue_note =
    'PLATFORM OBLIGATION, NOT A SELLER ONE — see the migration comment and LAUNCH.md. 113849(a) '
    'makes a sale through "the internet website or mobile application of an internet food service '
    'intermediary, as defined in Section 114367.6" a direct sale to consumers, and requires the '
    'operation to consent to the disclosures in 114367.6(a)(6) and (7). 114367.6 defines that '
    'intermediary as "an entity that provides a platform on its internet website or mobile '
    'application through which a microenterprise home kitchen operation may choose to offer food '
    'for sale and from which the internet food service intermediary derives revenues" — which is '
    'this marketplace — and places seven duties on it, beginning with "Be registered with the '
    'department." Also required: publishing MEHKO permitting requirements, fee transparency with a '
    'month''s notice of increases over 2%, an insurance disclosure, a dedicated per-listing field '
    'for the permit number and enforcement agency, a complaints channel linked to the department, '
    'and reporting an operation to its agency after three unrelated food safety or hygiene '
    'complaints in a calendar year. NONE OF THIS IS BUILT. Do not enable California MEHKO listings '
    'until it is.',
  category_note =
    '113849(b) excludes a catering operation and "A cottage food operation, as defined in Section '
    '113758" from being a MEHKO, so the cottage food rules — including the 114365.3(f) advertising '
    'disclosure — do not reach this programme. 113849(d) defines a meal as "the amount or quantity '
    'of food that is intended to be consumed by one customer in one sitting", which is why this '
    'route looks nothing like the shelf-stable programmes elsewhere in this table.',
  source_url = 'https://codes.findlaw.com/ca/health-and-safety-code/hsc-sect-114367-6/'
where state_code = 'CA' and ordinal = 3 and verified_at is null;
