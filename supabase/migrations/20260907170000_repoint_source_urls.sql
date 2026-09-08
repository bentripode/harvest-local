-- Harvest Local — point the sources at the statutes, not at somebody's compilation of them.
--
-- The alphabetical verification pass read primary text for all 51 jurisdictions and recorded the
-- citations in each row's notes. It only updated `source_url` for the later batches. So 49 of the
-- 70 programme rows still pointed at a National Agricultural Law Center compilation PDF — a serious
-- document, but a third party's reproduction, and one whose own currency line (20260907160000) says
-- most of them are current only through DECEMBER 2024.
--
-- That matters now that something reads those URLs. The staleness watcher (20260907150000) was
-- watching NALC's publishing schedule for two-thirds of the country instead of the legislatures'.
--
-- =========================================================================
-- 35 OF THE 49, AND EVERY ONE WAS CHECKED RATHER THAN GUESSED
-- =========================================================================
-- Each candidate URL was fetched and accepted only if the document it returned actually contains
-- the section number the row's notes cite — Idaho's URL has to contain "37-205", Nebraska's
-- "81-2,245", South Dakota's "34-18-38". A URL that resolves to a plausible-looking page is not
-- evidence; a wrong one would be worse than the compilation, because it would make both the
-- citation and the tripwire point somewhere the law is not.
--
-- The remaining 14 (AL, CT, DE ×2, HI, KY ×2, LA, MA, MD ×2, ME's second programme, NJ, NY) keep
-- their NALC URL. Their statutes live behind JavaScript-rendered viewers, in admin-code PDFs whose
-- paths could not be confirmed, or on a host that began refusing us partway through. They are not
-- worse off than before, and an unverified pointer is not an improvement on a verified one.
--
-- =========================================================================
-- THE FINGERPRINTS HAVE TO GO WITH THE URL
-- =========================================================================
-- `source_etag`, `source_last_modified`, `source_content_hash`, `source_signal` and `source_version`
-- all describe the OLD document. Left in place, the next watcher run would compare a legislature's
-- statute page against an NALC PDF's fingerprint and report a change that never happened — the
-- exact false alarm that makes a tripwire worthless. They are cleared, and the watcher re-baselines
-- on its next run.
--
-- `source_checked_at` is NOT cleared. It records when a person last read the law, and they did —
-- that reading is where these citations came from. What changes is where the app sends the next
-- person to look.
--
-- =========================================================================
-- LABEL RULES ARE LEFT ALONE, DELIBERATELY
-- =========================================================================
-- A labelling provision often sits in a different instrument from the venue rule: Delaware's is in
-- 16 Del. Admin. Code 4458A while its programme rules are elsewhere, and Utah's whole label list is
-- in R70-560-6 rather than in § 4-5-501. Repointing a label rule at a statute verified only for
-- containing the PROGRAMME's section would trade one unverified pointer for another, and would look
-- like progress. Those need their own pass, against their own citations.

-- =========================================================================
-- KEYED ON (state_code, ordinal), NOT ON id
-- =========================================================================
-- The first version of this migration matched on programme UUID, taken from the hosted database.
-- Those ids are generated per environment, so on a database built from scratch it matched nothing
-- and silently did nothing — which CI caught. A migration has to be reproducible anywhere, and
-- (state_code, ordinal) is the pair the seed actually fixes.

set search_path = public;

with v(state_code, ordinal, url) as (values
  ('AR', 1, 'https://codes.findlaw.com/ar/title-20-public-health-and-welfare/ar-code-sect-20-57-504/'),
  ('AZ', 1, 'https://www.azleg.gov/ars/36/00931.htm'),
  ('CA', 1, 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=114365.'),
  ('CA', 2, 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=114365.'),
  ('CO', 1, 'https://codes.findlaw.com/co/title-25-health/co-rev-st-sect-25-4-1614/'),
  ('FL', 1, 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0500/Sections/0500.80.html'),
  ('GA', 1, 'https://codes.findlaw.com/ga/title-26-food-drugs-and-cosmetics/ga-code-sect-26-2-21/'),
  ('IA', 2, 'https://law.justia.com/codes/iowa/title-iv/chapter-137d/'),
  ('ID', 1, 'https://legislature.idaho.gov/statutesrules/idstat/Title37/T37CH2/SECT37-205/'),
  ('IL', 1, 'https://law.justia.com/codes/illinois/chapter-410/act-410-ilcs-625/'),
  ('IN', 1, 'https://law.justia.com/codes/indiana/title-16/article-42/chapter-5-3/'),
  ('KS', 1, 'https://www.ksrevisor.gov/statutes/chapters/ch65/065_006_0089.html'),
  ('ME', 1, 'https://www.maine.gov/sos/cec/rules/01/001/001c345.doc'),
  ('MI', 1, 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-289-4102'),
  ('MN', 1, 'https://www.revisor.mn.gov/statutes/cite/28A.152'),
  ('MO', 1, 'https://revisor.mo.gov/main/OneSection.aspx?section=196.298'),
  ('MS', 1, 'https://codes.findlaw.com/ms/title-75-regulation-of-trade-commerce-and-investments/ms-code-sect-75-29-951/'),
  ('MT', 1, 'https://archive.legmt.gov/bills/mca/title_0500/chapter_0490/part_0020/section_0030/0500-0490-0020-0030.html'),
  ('ND', 1, 'https://law.justia.com/codes/north-dakota/title-23/chapter-23-09-5/'),
  ('NE', 1, 'https://nebraskalegislature.gov/laws/statutes.php?statute=81-2,245'),
  ('NH', 1, 'https://www.gencourt.state.nh.us/rsa/html/X/143-A/143-A-12.htm'),
  ('NH', 2, 'https://www.gencourt.state.nh.us/rsa/html/X/143-A/143-A-12.htm'),
  ('NM', 1, 'https://law.justia.com/codes/new-mexico/chapter-25/article-12/section-25-12-3/'),
  ('NV', 1, 'https://www.leg.state.nv.us/NRS/NRS-446.html'),
  ('OH', 1, 'https://codes.ohio.gov/ohio-revised-code/section-3715.025'),
  ('OH', 2, 'https://codes.ohio.gov/ohio-revised-code/section-3715.025'),
  ('OK', 1, 'https://law.justia.com/codes/oklahoma/title-2/section-2-5-4-2/'),
  ('OR', 1, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('OR', 2, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('OR', 3, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('PA', 1, 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/007/chapter46/s46.212.html'),
  ('RI', 1, 'https://webserver.rilegislature.gov/Statutes/TITLE21/21-27/21-27-6.1.htm'),
  ('RI', 2, 'https://webserver.rilegislature.gov/Statutes/TITLE21/21-27/21-27-6.1.htm'),
  ('SC', 1, 'https://www.scstatehouse.gov/code/t44c001.php'),
  ('SD', 1, 'https://law.justia.com/codes/south-dakota/title-34/chapter-18/section-34-18-38/')
)
update public.state_food_programs p
   set source_url = v.url,
       -- The fingerprints belong to the document we are leaving behind.
       source_version = null,
       source_etag = null,
       source_last_modified = null,
       source_content_hash = null,
       source_signal = null,
       source_fetched_at = null,
       source_changed_at = null
  from v
 where p.state_code = v.state_code
   and p.ordinal = v.ordinal
   and p.source_url is distinct from v.url;
