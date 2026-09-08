-- Harvest Local — the citation gap, which was smaller and worse than reported.
--
-- 20260907210000 said seven label rules had no citation recorded and could not be verified against
-- any source. THAT WAS WRONG, and the error was mine rather than the data's: the token regex used
-- to survey the notes matched section numbers shaped like "97.29(2)(b)2.e" and missed every
-- citation written in prose — "Cal. Health & Saf. Code 114365.3(e)", "410 ILCS 625/4(b)(7)",
-- "01-001-345-7 Me. Code R.". Five of the seven were cited all along.
--
-- Reading the four that were genuinely thin turned up two more inherited disclaimers and pinned two
-- section numbers that had been recorded only by description.
--
-- =========================================================================
-- 1. CALIFORNIA'S MICROENTERPRISE ROUTE HAS NO LABEL RULE AT ALL
-- =========================================================================
-- Health & Saf. Code chapter 11.6, §§ 114367 to 114367.6, read 2026-09-07 at leginfo: 163KB of
-- statute containing the word "label" ZERO times. A microenterprise home kitchen sells meals for
-- immediate consumption, and California asks nothing of their packaging.
--
-- This row was carrying "Made in a Home Kitchen." at 12pt, plus a seven-element list — all of it
-- inherited from Class A and Class B, whose § 114365.3(e) prescribes exactly that and does not
-- reach chapter 11.6. It is the same fault as Vermont's licensed rows, Maryland's on-farm route and
-- Ohio's home bakery, and it is the last instance of it in the table.
--
-- The elements go with the disclaimer. A MEHKO seller has no state labelling duty to print, and a
-- generated label that looks official and cites nothing is worse than no label.
--
-- =========================================================================
-- 2. MAINE'S FOOD SOVEREIGNTY ROUTE DOES NOT REGULATE LABELS EITHER
-- =========================================================================
-- 7 M.R.S. ch. 8-F, §§ 281 to 286, read 2026-09-07: no labelling provision anywhere in the Act.
-- § 284 devolves the question — "Pursuant to the home rule authority granted to municipalities" —
-- so what a Food Sovereignty seller must put on a jar is a MUNICIPAL ordinance question that no
-- state-level row can answer.
--
-- This row's note read "No label is required for products sold directly to consumers from home.
-- These requirements apply to products sold anywhere else", which is Maine's OTHER programme — the
-- Home Food Manufacturing rule at 01-001-345-7 — described on the wrong row. Its element list came
-- from there too. Both are recorded as unsourced rather than removed, because unlike California
-- the answer is not "nothing is required": it is "we cannot know from here".
--
-- =========================================================================
-- 3. TWO OREGON SECTIONS PINNED
-- =========================================================================
-- Both rows described their provisions without naming them. Reading ORS chapter 616:
--
--   HOME BAKING is ORS 616.718, "Waiver of routine inspection; rules" — which is why it was hard to
--   find by name. The label statement this row stores is subsection (6)(a) and the element list is
--   (6)(b). The exemption is drafted as a waiver of inspection, not as a cottage food programme.
--
--   FARM DIRECT is ORS 616.683, "Regulatory exemption for sales location and farm direct marketer
--   of certain agricultural products; rules", with 616.686 authorising the department to make rules
--   for it. NEITHER SECTION PRESCRIBES A LABEL. So the gap this row's note recorded — "Oregon's
--   Farm Direct Marketing labelling requirements are not in the compilation" — is now precise:
--   they are not in the STATUTE either, they are in the rules made under 616.686 (OAR chapter 603,
--   division 25), which this pass has not read.
--
-- =========================================================================
-- 4. WHAT IS NOT CHANGED
-- =========================================================================
-- Connecticut, Illinois and Maine's Home Food Manufacturing rule were already cited correctly
-- (§ 21a-62g, 410 ILCS 625/4(b)(7) and (10), 01-001-345-7) and are left alone. California's Class A
-- and Class B rows cite § 114365.3(e) and (f) and keep their URLs: leginfo reset the connection
-- partway through this pass, so their sources could not be re-verified today and an unverified
-- change is not an improvement.

set search_path = public;

-- ---------------------------------------------------------------------------
-- California's microenterprise route: no label, because there is no rule.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  required_elements = array[]::text[],
  optional_elements = array[]::text[],
  element_alternatives = '[]'::jsonb,
  disclaimer_text = null,
  disclaimer_min_pt = null,
  disclaimer_all_caps = false,
  disclaimer_font_note = null,
  source_url = 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=HSC&division=104.&title=&part=7.&chapter=11.6.',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes =
    'Cal. Health & Saf. Code chapter 11.6, §§ 114367 to 114367.6, read 2026-09-07 at leginfo. THE '
    'CHAPTER CONTAINS THE WORD "label" ZERO TIMES. A microenterprise home kitchen sells meals for '
    'immediate consumption and California prescribes nothing for their packaging, so this row is '
    'deliberately empty and the label generator will refuse to print rather than invent one. '
    'WHAT WAS HERE WAS ANOTHER PROGRAMME''S. The row carried "Made in a Home Kitchen." at 12pt and '
    'a seven-element list, all of it from § 114365.3(e), which governs Cottage Food Class A and '
    'Class B and does not reach chapter 11.6. Same fault as Vermont''s licensed rows, Maryland''s '
    'on-farm route and Ohio''s home bakery. '
    'IF SOMETHING IS EVER REQUIRED HERE it will come from the local enforcement agency: § 114367 '
    'lets a city or county authorise MEHKO permitting by ordinance, and § 114367.2(d)(2) forbids '
    'that agency imposing food safety requirements beyond the chapter — but labelling is not a food '
    'safety requirement in those words, so a local rule is possible and would not be visible here.'
where program_id in (select id from public.state_food_programs where state_code = 'CA' and ordinal = 3);

-- ---------------------------------------------------------------------------
-- Maine's food sovereignty route: the Act devolves the question.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://legislature.maine.gov/statutes/7/title7ch8-Fsec0.html',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes =
    '7 M.R.S. ch. 8-F, the Maine Food Sovereignty Act, §§ 281 to 286, read 2026-09-07. NO LABELLING '
    'PROVISION EXISTS IN THE ACT. § 284 devolves the question instead — "Pursuant to the home rule '
    'authority granted to municipalities by Title 30-A, section 3001" — so what a food sovereignty '
    'seller must put on a jar is set by the ordinance of the town they sell in, and no state-level '
    'row can answer it. '
    'THE NOTE THAT WAS HERE DESCRIBED THE OTHER MAINE PROGRAMME. It read "No label is required for '
    'products sold directly to consumers from home. These requirements apply to products sold '
    'anywhere else", which is 01-001-345-7 Me. Code R., the Home Food Manufacturing rule on the '
    'ordinal 1 row. The element list came from there too and is NOT sourced for this route. '
    'It is left in place rather than emptied, because unlike California''s microenterprise chapter '
    'the answer here is not "nothing is required" — it is "this cannot be known from the state '
    'code". A seller on this route should be asked which municipality they sell in.'
where program_id in (select id from public.state_food_programs where state_code = 'ME' and ordinal = 2);

-- ---------------------------------------------------------------------------
-- Oregon: two sections pinned, and one gap made precise.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' SECTION PINNED (20260907220000): the "home baking statute" this note describes is ORS 616.718, '
    '"Waiver of routine inspection; rules" — read in chapter 616 on 2026-09-07. The statement stored '
    'here is 616.718(6)(a) and the element list is 616.718(6)(b). It was hard to find by name '
    'because Oregon drafted the exemption as a waiver of inspection rather than as a cottage food '
    'programme.'
where program_id in (select id from public.state_food_programs where state_code = 'OR' and ordinal = 1)
  and notes not like '%20260907220000%';

update public.state_label_rules set
  source_url = 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  notes = notes ||
    ' GAP MADE PRECISE (20260907220000): Farm Direct is ORS 616.683, "Regulatory exemption for sales '
    'location and farm direct marketer of certain agricultural products; rules", with 616.686 '
    'authorising department rules for it. Both were read in chapter 616 on 2026-09-07 and NEITHER '
    'PRESCRIBES A LABEL. So the requirements are not merely absent from the compilation, as this '
    'note previously said — they are absent from the statute, and live in the rules made under '
    '616.686, which is OAR chapter 603 division 25. That is what an admin should read; the element '
    'list here remains the ordinary packaged-food set and is not sourced.'
where program_id in (select id from public.state_food_programs where state_code = 'OR' and ordinal = 2)
  and notes not like '%20260907220000%';
