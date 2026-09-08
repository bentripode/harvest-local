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

set search_path = public;

with v(program_id, url) as (values
  ('c56d7252-61b3-4c1b-af6c-faf079c0dd0b'::uuid, 'https://codes.findlaw.com/ar/title-20-public-health-and-welfare/ar-code-sect-20-57-504/'),
  ('6fc707ec-b3e8-4bad-b52f-a763d218cd26'::uuid, 'https://www.azleg.gov/ars/36/00931.htm'),
  ('d3d65bfb-67a3-4af5-aabc-7cb5e6d5c332'::uuid, 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=114365.'),
  ('f8f17277-ff81-4477-912c-ded93b83628d'::uuid, 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=114365.'),
  ('86b4e005-5439-4de1-8c82-9873f3f35753'::uuid, 'https://codes.findlaw.com/co/title-25-health/co-rev-st-sect-25-4-1614/'),
  ('e5550e17-8100-436c-9e59-be9174cc256c'::uuid, 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0500/Sections/0500.80.html'),
  ('89461988-4147-47e4-acc3-6475e1a05473'::uuid, 'https://codes.findlaw.com/ga/title-26-food-drugs-and-cosmetics/ga-code-sect-26-2-21/'),
  ('c7483d3b-9900-4975-852e-a6d85cd89f62'::uuid, 'https://law.justia.com/codes/iowa/title-iv/chapter-137d/'),
  ('16a97cd9-3bb8-446a-9023-a993e62db899'::uuid, 'https://legislature.idaho.gov/statutesrules/idstat/Title37/T37CH2/SECT37-205/'),
  ('7f790632-ec94-4f75-93ff-19c8fe3afa0a'::uuid, 'https://law.justia.com/codes/illinois/chapter-410/act-410-ilcs-625/'),
  ('b052d2c2-6b0b-4e25-ac27-ba3247049f81'::uuid, 'https://law.justia.com/codes/indiana/title-16/article-42/chapter-5-3/'),
  ('27255e07-58b1-458b-8421-f88995a3e277'::uuid, 'https://www.ksrevisor.gov/statutes/chapters/ch65/065_006_0089.html'),
  ('01c3566c-4e3a-4dbb-b099-7b421fb379b0'::uuid, 'https://www.maine.gov/sos/cec/rules/01/001/001c345.doc'),
  ('d23972d5-7b7a-4d56-8fff-3778bfca27ba'::uuid, 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-289-4102'),
  ('3edc8c10-eb42-4551-8e9c-58b54dc54691'::uuid, 'https://www.revisor.mn.gov/statutes/cite/28A.152'),
  ('0500ebcb-428b-4000-9441-56fca8f16351'::uuid, 'https://revisor.mo.gov/main/OneSection.aspx?section=196.298'),
  ('654268ec-04af-4da4-b96d-6e0beb78722a'::uuid, 'https://codes.findlaw.com/ms/title-75-regulation-of-trade-commerce-and-investments/ms-code-sect-75-29-951/'),
  ('e7ff24d8-09da-452d-a48a-7e7aac05bb6c'::uuid, 'https://archive.legmt.gov/bills/mca/title_0500/chapter_0490/part_0020/section_0030/0500-0490-0020-0030.html'),
  ('fb7bf343-5923-46d5-b6f5-46097d1801a1'::uuid, 'https://law.justia.com/codes/north-dakota/title-23/chapter-23-09-5/'),
  ('c1224ad9-2472-4ae0-a565-d520dd9af8a7'::uuid, 'https://nebraskalegislature.gov/laws/statutes.php?statute=81-2,245'),
  ('80a62749-b46c-4302-950a-fb260850706e'::uuid, 'https://www.gencourt.state.nh.us/rsa/html/X/143-A/143-A-12.htm'),
  ('d2f8241c-5871-4335-9ce0-b695a85caaa5'::uuid, 'https://www.gencourt.state.nh.us/rsa/html/X/143-A/143-A-12.htm'),
  ('bf557964-6575-4267-8c35-a9b007dcfa0c'::uuid, 'https://law.justia.com/codes/new-mexico/chapter-25/article-12/section-25-12-3/'),
  ('81e38203-6396-43d5-b9bf-72544be39cfe'::uuid, 'https://www.leg.state.nv.us/NRS/NRS-446.html'),
  ('0eb878a7-6d5a-4bef-9d80-95ae4a6c1b2a'::uuid, 'https://codes.ohio.gov/ohio-revised-code/section-3715.025'),
  ('264c7cae-8d16-4794-a4d1-86319dc9f4b7'::uuid, 'https://codes.ohio.gov/ohio-revised-code/section-3715.025'),
  ('30b9e486-b255-4209-a9ef-24c344d445fc'::uuid, 'https://law.justia.com/codes/oklahoma/title-2/section-2-5-4-2/'),
  ('6543dd91-2c31-4107-bbe6-cdde73614e84'::uuid, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('a8f6042f-b424-43a6-8334-dccbff84413c'::uuid, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('1195351b-3bf4-4a79-9772-063674e7b510'::uuid, 'https://www.oregonlegislature.gov/bills_laws/ors/ors616.html'),
  ('a9c7a2a5-4717-4e13-bc83-ceee5cc3f524'::uuid, 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/007/chapter46/s46.212.html'),
  ('040713bd-3689-48d9-b84c-9009743db18b'::uuid, 'https://webserver.rilegislature.gov/Statutes/TITLE21/21-27/21-27-6.1.htm'),
  ('1f3cc706-3406-43d4-aa9a-69c92acbd0f3'::uuid, 'https://webserver.rilegislature.gov/Statutes/TITLE21/21-27/21-27-6.1.htm'),
  ('60f61857-4b57-4ce7-85a9-ebc6811bed82'::uuid, 'https://www.scstatehouse.gov/code/t44c001.php'),
  ('a0f2bda3-4368-4e34-9b8a-836982d23896'::uuid, 'https://law.justia.com/codes/south-dakota/title-34/chapter-18/section-34-18-38/'))
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
 where p.id = v.program_id
   and p.source_url is distinct from v.url;
