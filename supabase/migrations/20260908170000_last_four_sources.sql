-- Harvest Local — the four the sweep could not reach, reached.
--
-- AL, DE, NJ and GA were left open not because their law was unclear but because a script could not
-- fetch it: a WAF that refuses curl at the TLS layer, two client-rendered sites, and a chapter index
-- with no text in it. A real browser reads all four. Two of them were carrying wrong text.
--
-- =========================================================================
-- GEORGIA — right all along, and only unreachable
-- =========================================================================
-- rules.sos.ga.gov answers every scripted request with a 168-byte block page, its own root included,
-- so this was never a URL problem. Read in the browser on 2026-09-08, Rule 40-7-19-.09(1)(b):
--
--   The following statement must be conspicuously labeled on the package, "MADE IN A COTTAGE FOOD
--   OPERATION THAT IS NOT SUBJECT TO STATE FOOD SAFETY INSPECTIONS." This statement must: 1. Appear
--   in Times New Roman or Arial font, in at least 10-point type; and 2. In a color that contrasts to
--   the background color of the label.
--
-- The full stop is INSIDE the quotation marks, so our stored text — which has it — is exact. Nothing
-- changes but the record of how it was verified.
--
-- =========================================================================
-- NEW JERSEY — right all along, and the difference was a dropped hyphen
-- =========================================================================
-- The only source was a compilation PDF whose typesetting drops the hyphen in "N.J.A.C. 8:24-11",
-- which is what the sweep kept reporting. The Department publishes the rule itself. N.J.A.C.
-- 8:24-11.4, read 2026-09-08:
--
--   (b) ... a placard that states, "This food is prepared pursuant to N.J.A.C. 8:24-11 in a home
--       kitchen that has not been inspected by the Department of Health."
--   (c)6. The statement, "This food is prepared pursuant to N.J.A.C. 8:24-11 in a home kitchen that
--       has not been inspected by the Department of Health.
--
-- Both match ours exactly, hyphen and full stop included. (c)6 is missing its closing quotation mark
-- in the published rule; that is the state's typo and not something to reproduce. Source moves off
-- the compilation.
--
-- =========================================================================
-- DELAWARE — a full stop we added, now confirmed on the regulation
-- =========================================================================
-- regulations.delaware.gov is client-rendered, and the URL this row used redirects to the Title 16
-- index. The rule is at /AdminCode/title16/4458A. 16 Del. Admin. Code 4458A § 8.2.4:
--
--   Labels shall include the following statement: "This food is made in a Cottage Food Establishment
--   and is NOT subject to routine Government Food Safety Inspections".
--
-- The quotation CLOSES BEFORE the full stop, so the sentence ends at "Inspections" — the period we
-- store is ours. The compilation suggested exactly this and was not enough to act on; the regulation
-- is. "NOT" is genuinely capitalised and "routine" is genuinely there, both of which a normalised
-- reading of the page had quietly flattened.
--
-- ALSO CONFIRMED FROM THE SAME REGULATION: § 3.1.3.2, "Online sales are not permitted. Online
-- advertising and marketing are permitted." Delaware's online ban has been recorded against a
-- compilation until now; it is now on the rule, and the advertising half is worth having because it
-- is the distinction a seller will ask about.
--
-- =========================================================================
-- ALABAMA — an invented sentence in a state that prescribes none
-- =========================================================================
-- Ala. Code § 22-20-5.1(e), read at alison.legislature.state.al.us on 2026-09-08:
--
--   The label shall include in at least size 10-point font the common or usual name of the food, the
--   name, home or P.O. Box address of the cottage food production operation, and A STATEMENT THAT
--   THE FOOD IS NOT INSPECTED BY THE DEPARTMENT OR LOCAL HEALTH DEPARTMENT. The label shall also
--   contain a list of the ingredients in the food in descending order of predominance and shall
--   include A DISCLAIMER THAT THE FOOD MAY CONTAIN ALLERGENS.
--
-- Two requirements of substance, neither with prescribed wording — and we stored a sentence of our
-- own in `disclaimer_text`, the column that exists to hold quoted law printed onto food without
-- review. It even named the department more narrowly than the statute does. This is the Louisiana
-- shape, so it becomes a `seller_statement` with the statute's own words as the prompt, exactly as
-- LA, MO, MT, NE and Utah's two routes did.
--
-- `allergens` stays: the statute's "disclaimer that the food may contain allergens" is a generic
-- caution rather than the federal list, and a seller needs both. The prompt says so.
--
-- NOT A PROBLEM, and worth recording because it easily could have been: § 22-20-5.1(a)(2)b permits
-- selling "whether in-person, by phone, or online, in the state" and c. permits delivery "in person,
-- through an agent of the producer, or by mail". Our online_orders and mail_delivery were already
-- `allowed`; the statute confirms both.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Georgia: unchanged text, recorded verification.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_checked_at = now(),
  notes = notes ||
    ' VERIFIED (20260908170000): read in a browser at rules.sos.ga.gov, which blocks every scripted '
    'request — including curl with browser headers and a cookie session, and including its own root '
    '— so this was an access problem and never a data one. Rule 40-7-19-.09(1)(b) requires the '
    'statement ''"MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO STATE FOOD SAFETY '
    'INSPECTIONS."'' with the full stop INSIDE the quotation marks, in Times New Roman or Arial at '
    'least 10-point, in a contrasting colour. Our stored text is exact. The sweep will keep '
    'reporting this row as unreachable and that is expected.'
where program_id in (select id from public.state_food_programs where state_code = 'GA' and ordinal = 1)
  and notes not like '%20260908170000%';

-- ---------------------------------------------------------------------------
-- New Jersey: unchanged text, real source.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  source_url = 'https://www.nj.gov/health/cottagefood/rules-resources/rules/',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  notes = notes ||
    ' VERIFIED (20260908170000): the reported difference was an artifact — the compilation PDF drops '
    'the hyphen in "N.J.A.C. 8:24-11". The Department publishes the rule itself, read 2026-09-08. '
    'N.J.A.C. 8:24-11.4(b) prescribes the placard and (c)6 the label statement, both matching ours '
    'exactly including the hyphen and the full stop inside the quotation marks. (c)6 is missing its '
    'closing quotation mark in the published rule — the state''s typo, not ours to reproduce. Source '
    'moved off the National Agricultural Law Center compilation onto nj.gov.'
where program_id in (select id from public.state_food_programs where state_code = 'NJ' and ordinal = 1)
  and notes not like '%20260908170000%';

-- ---------------------------------------------------------------------------
-- Delaware: drop the full stop we added, and cite the regulation.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_text =
    'This food is made in a Cottage Food Establishment and is NOT subject to routine Government Food '
    'Safety Inspections',
  source_url = 'https://regulations.delaware.gov/AdminCode/title16/4458A',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  notes = notes ||
    ' CORRECTED (20260908170000): 16 Del. Admin. Code 4458A § 8.2.4 reads ''Labels shall include the '
    'following statement: "This food is made in a Cottage Food Establishment and is NOT subject to '
    'routine Government Food Safety Inspections".'' THE QUOTATION CLOSES BEFORE THE FULL STOP, so '
    'the sentence ends at "Inspections" and the period was ours — the third instance of an added '
    'period after California and New Hampshire. "NOT" is genuinely capitalised and "routine" is '
    'genuinely present; a normalised reading of the page had flattened both, which is why the raw '
    'text mattered. The row previously cited a URL that redirects to the Title 16 index; the rule '
    'itself is at /AdminCode/title16/4458A. § 8.2.5 also confirms the 10-point minimum and the '
    'contrasting-colour requirement this row already carries.'
where program_id in (select id from public.state_food_programs where state_code = 'DE' and ordinal = 1)
  and notes not like '%20260908170000%';

update public.state_food_programs set
  source_url = 'https://regulations.delaware.gov/AdminCode/title16/4458A',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  venue_note = coalesce(venue_note, '') ||
    ' PRIMARY TEXT (20260908170000): the online ban is now on the regulation rather than a '
    'compilation. 16 Del. Admin. Code 4458A § 3.1.3.2: "Online sales are not permitted. Online '
    'advertising and marketing are permitted." The second sentence is worth keeping — advertising '
    'online is expressly allowed, which is the distinction a Delaware seller will ask about, and '
    '§ 3.1.3.1 confines them to direct sales with consumers in Delaware "without the use of an '
    'independent retailer or other intermediary".'
where state_code = 'DE' and ordinal = 1
  and coalesce(venue_note, '') not like '%20260908170000%';

-- ---------------------------------------------------------------------------
-- Alabama: the state prescribes substance, so the seller writes the sentence.
-- ---------------------------------------------------------------------------
update public.state_label_rules set
  disclaimer_text = null,
  disclaimer_min_pt = 10,
  required_elements = array[
    'product_name', 'producer_name', 'producer_address', 'ingredients_desc_by_weight',
    'allergens', 'seller_statement'
  ],
  seller_statement_prompt =
    'Alabama requires two things in your own words, in at least 10-point type: a statement that the '
    'food is not inspected by the department or local health department, and a disclaimer that the '
    'food may contain allergens. Ala. Code § 22-20-5.1(e) prescribes no wording for either.',
  source_url = 'https://alison.legislature.state.al.us/code-of-alabama?section=22-20-5.1',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  notes = notes ||
    ' CORRECTED (20260908170000): THE SENTENCE WAS INVENTED. Ala. Code § 22-20-5.1(e), read at '
    'alison.legislature.state.al.us on 2026-09-08, requires "a statement that the food is not '
    'inspected by the department or local health department" and separately "a disclaimer that the '
    'food may contain allergens" — substance with no wording prescribed for either. We stored "This '
    'food is not inspected by the Alabama Department of Public Health or a local health department." '
    'in disclaimer_text, which is the column for quoted law printed onto food without review, and it '
    'named the department more narrowly than the statute does. It is now a seller_statement with the '
    'statute''s own words as the prompt — the Louisiana shape, as in MO, MT, NE and both Utah '
    'routes. '
    'ALLERGENS STAYS: the statutory "disclaimer that the food may contain allergens" is a generic '
    'caution rather than the federal list, and a seller needs both. '
    'CONFIRMED, NOT CHANGED: (a)(2)b permits selling "whether in-person, by phone, or online, in the '
    'state" and c. permits delivery "in person, through an agent of the producer, or by mail", so '
    'this state''s allowed online_orders and mail_delivery now rest on the statute. Source moved off '
    'the National Agricultural Law Center compilation.'
where program_id in (select id from public.state_food_programs where state_code = 'AL' and ordinal = 1)
  and notes not like '%20260908170000%';

update public.state_food_programs set
  source_url = 'https://alison.legislature.state.al.us/code-of-alabama?section=22-20-5.1',
  source_etag = null,
  source_last_modified = null,
  source_content_hash = null,
  source_signal = null,
  source_fetched_at = null,
  source_changed_at = null,
  source_checked_at = now(),
  venue_note = coalesce(venue_note, '') ||
    ' PRIMARY TEXT (20260908170000): Ala. Code § 22-20-5.1(a)(2) defines a cottage food production '
    'operation as one that "[s]ells the foods ... only directly to consumers, whether in-person, by '
    'phone, or online, in the state" and "[d]elivers the foods ... directly to consumers in the '
    'state, whether in person, through an agent of the producer, or by mail." Online selling and '
    'mail delivery are both expressly permitted, and both were already recorded as allowed — now on '
    'the statute rather than a summary.'
where state_code = 'AL' and ordinal = 1
  and coalesce(venue_note, '') not like '%20260908170000%';
