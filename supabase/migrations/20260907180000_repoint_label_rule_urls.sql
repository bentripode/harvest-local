-- Harvest Local — the label rules, repointed against their OWN citations.
--
-- 20260907170000 moved 35 programme rows off the National Agricultural Law Center compilations and
-- deliberately left the label rules alone, because a labelling provision often sits in a different
-- instrument from the venue rule. That caution was justified: of the 51 label rules still on a
-- compilation, only 29 could be verified, and the reasons the other 22 could not are the reasons
-- the shortcut would have been wrong.
--
-- =========================================================================
-- THE TEST IS THE RULE'S OWN SECTION, NOT THE PROGRAMME'S
-- =========================================================================
-- Each candidate document was fetched and accepted only if it contains the section the LABEL rule's
-- notes cite. Kentucky is the clearest case: its programmes are KRS 217.136 and 217.137, but the
-- labelling is 902 KAR 45:090, a different instrument on a different site — so both Kentucky label
-- rules move to the regulation while their programmes stay on the statute. Arkansas is the mirror
-- image: the programme is 20-57-504 and the label is 20-57-505, one section along, and the 504 page
-- does not contain 505, so it was not silently reused.
--
-- Where the labelling genuinely IS in the same section — Florida's 500.80(3), Idaho's 37-205(3)(b),
-- Minnesota's 28A.152 — the programme's URL is reused, because that is where the provision is.
--
-- Subsection markers are stripped before matching. "22-20-5.1(e)" is rendered as "22-20-5.1"
-- followed by "(e)" and almost never survives as a contiguous string; the section is what decides
-- whether a document is the right one anyway.
--
-- =========================================================================
-- WHAT THE REMAINING 22 ARE, AND ONE THAT IS WORTH KNOWING
-- =========================================================================
-- Six have no citation in their notes to verify against at all (CA ×3, CT, IL, ME's second
-- programme, OR ×2) — the earlier passes recorded the requirement without pinning the provision.
-- The rest are behind JavaScript viewers, in admin-code PDFs whose paths could not be confirmed, or
-- on hosts that refused us.
--
-- TEXAS IS THE ONE TO KNOW ABOUT. Its programme row already points at
-- statutes.capitol.texas.gov/Docs/HS/htm/HS.437.htm, which is now a JavaScript application shell:
-- fetching it — HTML or PDF path — returns a 250KB bundle containing none of the statute. So the
-- staleness watcher hashing that URL is hashing a front-end deployment, not chapter 437. It will
-- report a change when the site redeploys and stay silent when the legislature amends the chapter,
-- which is the wrong answer twice. Recorded here rather than fixed, because fixing it means finding
-- Texas a machine-readable source, and that is its own piece of work.
--
-- Fingerprints are cleared for the same reason as last time: they describe the document being left
-- behind, and comparing a new document against an old one's hash is the false alarm that makes a
-- tripwire worthless.

set search_path = public;

with v(state_code, ordinal, url) as (values
  ('AR', 1, 'https://codes.findlaw.com/ar/title-20-public-health-and-welfare/ar-code-sect-20-57-504/'),
  ('AZ', 1, 'https://www.azleg.gov/ars/36/00932.htm'),
  ('CO', 1, 'https://codes.findlaw.com/co/title-25-health/co-rev-st-sect-25-4-1614/'),
  ('FL', 1, 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0500/Sections/0500.80.html'),
  ('IA', 2, 'https://law.justia.com/codes/iowa/title-iv/chapter-137d/'),
  ('ID', 1, 'https://legislature.idaho.gov/statutesrules/idstat/Title37/T37CH2/SECT37-205/'),
  ('IN', 1, 'https://law.justia.com/codes/indiana/title-16/article-42/chapter-5-3/'),
  ('KS', 1, 'https://www.ksrevisor.gov/statutes/chapters/ch65/065_006_0089.html'),
  ('KY', 1, 'https://apps.legislature.ky.gov/law/kar/titles/902/045/090/'),
  ('KY', 2, 'https://apps.legislature.ky.gov/law/kar/titles/902/045/090/'),
  ('MI', 1, 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-289-4102'),
  ('MN', 1, 'https://www.revisor.mn.gov/statutes/cite/28A.152'),
  ('MS', 1, 'https://codes.findlaw.com/ms/title-75-regulation-of-trade-commerce-and-investments/ms-code-sect-75-29-951/'),
  ('MT', 1, 'https://archive.legmt.gov/bills/mca/title_0500/chapter_0490/part_0020/section_0030/0500-0490-0020-0030.html'),
  ('ND', 1, 'https://law.justia.com/codes/north-dakota/title-23/chapter-23-09-5/'),
  ('NE', 1, 'https://nebraskalegislature.gov/laws/statutes.php?statute=81-2,245'),
  ('NH', 1, 'https://www.gencourt.state.nh.us/rules/state_agencies/he-p2300.html'),
  ('NH', 2, 'https://www.gencourt.state.nh.us/rules/state_agencies/he-p2300.html'),
  ('NM', 1, 'https://law.justia.com/codes/new-mexico/chapter-25/article-12/section-25-12-3/'),
  ('NV', 1, 'https://www.leg.state.nv.us/NRS/NRS-446.html'),
  ('OH', 1, 'https://codes.ohio.gov/ohio-revised-code/section-3715.023'),
  ('OH', 2, 'https://codes.ohio.gov/ohio-revised-code/section-3715.023'),
  ('OK', 1, 'https://law.justia.com/codes/oklahoma/title-2/section-2-5-4-2/'),
  ('OR', 3, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('PA', 1, 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/007/chapter46/s46.212.html'),
  ('RI', 1, 'https://webserver.rilegislature.gov/Statutes/TITLE21/21-27/21-27-6.1.htm'),
  ('RI', 2, 'https://webserver.rilegislature.gov/Statutes/TITLE21/21-27/21-27-6.1.htm'),
  ('SC', 1, 'https://www.scstatehouse.gov/code/t44c001.php'),
  ('SD', 1, 'https://law.justia.com/codes/south-dakota/title-34/chapter-18/section-34-18-38/'))
update public.state_label_rules r
   set source_url = v.url,
       source_version = null,
       source_etag = null,
       source_last_modified = null,
       source_content_hash = null,
       source_signal = null,
       source_fetched_at = null,
       source_changed_at = null
  from v, public.state_food_programs p
 where p.state_code = v.state_code
   and p.ordinal = v.ordinal
   and r.program_id = p.id
   and r.source_url is distinct from v.url;
